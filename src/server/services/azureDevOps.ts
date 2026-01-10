import * as azdev from 'azure-devops-node-api';
import { WorkItem, CycleTimeData } from '../types/workitem';
import { retryWithBackoff } from '../utils/retry';

export class AzureDevOpsService {
  private connection: azdev.WebApi;
  private organization: string;
  private project: string;
  private areaPath: string;

  constructor() {
    const orgUrl = process.env.ADO_ORG;
    const pat = process.env.ADO_PAT;
    this.project = process.env.ADO_PROJECT || '';
    this.areaPath = process.env.ADO_AREA_PATH || '';

    if (!orgUrl || !pat || !this.project) {
      throw new Error(
        'Missing required environment variables: ADO_ORG, ADO_PAT, ADO_PROJECT'
      );
    }

    this.organization = orgUrl;
    const authHandler = azdev.getPersonalAccessTokenHandler(pat);
    // Configure with longer timeout for revision queries (default is 30s, increase to 120s)
    const options = {
      socketTimeout: 120000, // 120 seconds
    };
    this.connection = new azdev.WebApi(orgUrl, authHandler, options);
  }

  async getWorkItems(from?: string, to?: string): Promise<WorkItem[]> {
    return retryWithBackoff(async () => {
      const witApi = await this.connection.getWorkItemTrackingApi();

      // Build WIQL query
      let wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${this.project}' AND [System.WorkItemType] = 'Product Backlog Item'`;

      if (this.areaPath) {
        wiql += ` AND [System.AreaPath] UNDER '${this.areaPath}'`;
      }

      // Query for items in date range OR with no due date
      if (from && to) {
        wiql += ` AND ([Microsoft.VSTS.Scheduling.DueDate] >= '${from}' AND [Microsoft.VSTS.Scheduling.DueDate] <= '${to}' OR [Microsoft.VSTS.Scheduling.DueDate] = '')`;
      }

      wiql += ' ORDER BY [System.ChangedDate] DESC';

      const queryResult = await witApi.queryByWiql(
        { query: wiql },
        { project: this.project }
      );

      if (!queryResult.workItems || queryResult.workItems.length === 0) {
        return [];
      }

      const ids = queryResult.workItems.map((wi) => wi.id!);

      // Fetch work items in batches of 200 (ADO limit)
      const batchSize = 200;
      const batches: number[][] = [];
      for (let i = 0; i < ids.length; i += batchSize) {
        batches.push(ids.slice(i, i + batchSize));
      }

      const fields = [
        'System.Id',
        'System.Title',
        'System.State',
        'System.AssignedTo',
        'System.WorkItemType',
        'System.ChangedDate',
        'System.CreatedDate',
        'Microsoft.VSTS.Common.ClosedDate',
        'System.AreaPath',
        'System.IterationPath',
        'Microsoft.VSTS.Scheduling.DueDate',
      ];

      const allWorkItems: WorkItem[] = [];

      for (const batch of batches) {
        const workItems = await witApi.getWorkItems(
          batch,
          fields,
          undefined,
          undefined,
          undefined
        );

        for (const wi of workItems) {
          if (!wi.id || !wi.fields) continue;

          allWorkItems.push({
            id: wi.id,
            title: wi.fields['System.Title'] || '',
            state: wi.fields['System.State'] || '',
            assignedTo: wi.fields['System.AssignedTo']?.displayName,
            dueDate: wi.fields['Microsoft.VSTS.Scheduling.DueDate']
              ? new Date(wi.fields['Microsoft.VSTS.Scheduling.DueDate'])
                  .toISOString()
                  .split('T')[0]
              : undefined,
            workItemType: wi.fields['System.WorkItemType'] || '',
            changedDate: wi.fields['System.ChangedDate'] || '',
            createdDate: wi.fields['System.CreatedDate'] || '',
            closedDate: wi.fields['Microsoft.VSTS.Common.ClosedDate']
              ? new Date(wi.fields['Microsoft.VSTS.Common.ClosedDate'])
                  .toISOString()
                  .split('T')[0]
              : undefined,
            areaPath: wi.fields['System.AreaPath'] || '',
            iterationPath: wi.fields['System.IterationPath'] || '',
          });
        }
      }

      // Skip cycle time calculation for now to improve load performance
      // Cycle time queries are timing out due to large revision history
      // TODO: Implement background job or on-demand cycle time calculation
      console.log(`Returning ${allWorkItems.length} work items (without cycle time data)`);
      
      return allWorkItems;
    });
  }

  async calculateCycleTime(workItemId: number): Promise<CycleTimeData | undefined> {
    try {
      const witApi = await this.connection.getWorkItemTrackingApi();
      
      // Get all revisions to track state changes
      const revisions = await witApi.getRevisions(workItemId, undefined, undefined, undefined, this.project);
      
      if (!revisions || revisions.length === 0) {
        return undefined;
      }

      let inProgressDate: string | undefined;
      let qaReadyDate: string | undefined;
      let uatReadyDate: string | undefined;
      let assignedToAtInProgress: string | undefined;
      let assignedToAtReadyForTest: string | undefined;

      // Iterate through revisions to find state transitions
      for (let i = 0; i < revisions.length; i++) {
        const revision = revisions[i];
        const state = revision.fields?.['System.State'];
        const changedDate = revision.fields?.['System.ChangedDate'];
        const assignedTo = revision.fields?.['System.AssignedTo'];

        // Track when item moved to "In Progress"
        if (!inProgressDate && state === 'In Progress' && changedDate) {
          inProgressDate = new Date(changedDate).toISOString();
          // Track who was assigned at this point
          assignedToAtInProgress = assignedTo?.displayName || assignedTo?.uniqueName || assignedTo;
        }

        // Track when item moved to "Ready For Test"
        if (!qaReadyDate && state === 'Ready For Test' && changedDate) {
          qaReadyDate = new Date(changedDate).toISOString();
          // Track who was assigned at this point (QA tester)
          assignedToAtReadyForTest = assignedTo?.displayName || assignedTo?.uniqueName || assignedTo;
        }

        // Track when item moved to "UAT - Ready For Test"
        if (!uatReadyDate && state === 'UAT - Ready For Test' && changedDate) {
          uatReadyDate = new Date(changedDate).toISOString();
        }
      }

      // Calculate developer cycle time in days if we have both dates
      let cycleTimeDays: number | undefined;
      if (inProgressDate && qaReadyDate) {
        const start = new Date(inProgressDate);
        const end = new Date(qaReadyDate);
        cycleTimeDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Calculate QA cycle time in days
      let qaCycleTimeDays: number | undefined;
      if (qaReadyDate && uatReadyDate) {
        const start = new Date(qaReadyDate);
        const end = new Date(uatReadyDate);
        qaCycleTimeDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        inProgressDate: inProgressDate ? inProgressDate.split('T')[0] : undefined,
        qaReadyDate: qaReadyDate ? qaReadyDate.split('T')[0] : undefined,
        cycleTimeDays,
        assignedTo: assignedToAtInProgress,
        uatReadyDate: uatReadyDate ? uatReadyDate.split('T')[0] : undefined,
        qaCycleTimeDays,
        qaAssignedTo: assignedToAtReadyForTest,
      };
    } catch (error) {
      console.error(`Error calculating cycle time for work item ${workItemId}:`, error);
      return undefined;
    }
  }

  async updateDueDate(id: number, dueDate: string | null): Promise<void> {
    return retryWithBackoff(async () => {
      const witApi = await this.connection.getWorkItemTrackingApi();

      const patchDocument: any[] = [];

      if (dueDate === null) {
        // Remove the due date field
        patchDocument.push({
          op: 'remove',
          path: '/fields/Microsoft.VSTS.Scheduling.DueDate',
        });
      } else {
        // Add or replace the due date field
        patchDocument.push({
          op: 'add',
          path: '/fields/Microsoft.VSTS.Scheduling.DueDate',
          value: dueDate,
        });
      }

      await witApi.updateWorkItem({}, patchDocument, id, this.project);
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const coreApi = await this.connection.getCoreApi();
      await coreApi.getProject(this.project);
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  async calculateCycleTimeForItems(workItemIds: number[]): Promise<Record<number, CycleTimeData>> {
    const result: Record<number, CycleTimeData> = {};
    const batchSize = 3; // Process fewer items at a time to avoid timeouts
    
    for (let i = 0; i < workItemIds.length; i += batchSize) {
      const batch = workItemIds.slice(i, i + batchSize);
      console.log(`Processing cycle time batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(workItemIds.length / batchSize)}`);
      
      const batchResults = await Promise.all(
        batch.map(async (id) => {
          const cycleTime = await this.calculateCycleTime(id);
          return { id, cycleTime };
        })
      );
      
      batchResults.forEach(({ id, cycleTime }) => {
        if (cycleTime) {
          result[id] = cycleTime;
        }
      });
    }
    
    return result;
  }
}
