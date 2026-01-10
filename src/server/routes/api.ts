import express, { Request, Response } from 'express';
import { AzureDevOpsService } from '../services/azureDevOps';
import { WorkItemsQuery, UpdateDueDateRequest } from '../types/workitem';

const router = express.Router();
const adoService = new AzureDevOpsService();

// GET /api/workitems - Fetch work items for date range
router.get('/workitems', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query as WorkItemsQuery;
    const workItems = await adoService.getWorkItems(from, to);
    res.json(workItems);
  } catch (error: any) {
    console.error('Error fetching work items:', error);
    res.status(500).json({ error: 'Failed to fetch work items' });
  }
});

// PATCH /api/workitems/:id/due-date - Update due date for a work item
router.patch('/workitems/:id/due-date', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { dueDate } = req.body as UpdateDueDateRequest;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid work item ID' });
    }

    // Validate date format if not null
    if (dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return res
        .status(400)
        .json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    await adoService.updateDueDate(id, dueDate);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating due date:', error);
    res.status(500).json({ error: 'Failed to update due date' });
  }
});

// POST /api/cycle-time - Calculate cycle time for specific work items
router.post('/cycle-time', async (req: Request, res: Response) => {
  try {
    const { workItemIds } = req.body as { workItemIds: number[] };

    if (!Array.isArray(workItemIds) || workItemIds.length === 0) {
      return res.status(400).json({ error: 'workItemIds array is required' });
    }

    console.log(`Calculating cycle time for ${workItemIds.length} work items`);
    const cycleTimeData = await adoService.calculateCycleTimeForItems(workItemIds);
    res.json(cycleTimeData);
  } catch (error: any) {
    console.error('Error calculating cycle time:', error);
    res.status(500).json({ error: 'Failed to calculate cycle time' });
  }
});

// GET /api/health - Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthy = await adoService.healthCheck();
    res.json({ healthy, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('Health check error:', error);
    res.status(503).json({ healthy: false, error: 'Service unavailable' });
  }
});

export default router;
