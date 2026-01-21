import { WorkItem, DeveloperDueDateStats } from '../types/workitem';
import './DevStats.css';
import { useState, useMemo, useEffect } from 'react';

interface DevStatsProps {
  workItems: WorkItem[];
  project: string;
  areaPath: string;
}

const LOADING_STATE_KEY = 'devStatsLoadingState';
const DATA_STATE_KEY = 'devStatsData';
const FILTER_STATE_KEY = 'devStatsFilters';

export const DevStats: React.FC<DevStatsProps> = ({ workItems, project, areaPath }) => {
  // Restore data from sessionStorage on mount
  const [dueDateStats, setDueDateStats] = useState<DeveloperDueDateStats[]>(() => {
    const savedData = sessionStorage.getItem(DATA_STATE_KEY);
    return savedData ? JSON.parse(savedData).stats : [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(() => {
    const savedData = sessionStorage.getItem(DATA_STATE_KEY);
    return savedData ? JSON.parse(savedData).hasLoaded : false;
  });
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  
  // Filter states - restore from sessionStorage
  const [selectedDeveloper, setSelectedDeveloper] = useState<string>(() => {
    const savedFilters = sessionStorage.getItem(FILTER_STATE_KEY);
    return savedFilters ? JSON.parse(savedFilters).selectedDeveloper : 'all';
  });
  const [timeFrame, setTimeFrame] = useState<string>(() => {
    const savedFilters = sessionStorage.getItem(FILTER_STATE_KEY);
    return savedFilters ? JSON.parse(savedFilters).timeFrame : '30';
  });
  const [customFromDate, setCustomFromDate] = useState(() => {
    const savedFilters = sessionStorage.getItem(FILTER_STATE_KEY);
    return savedFilters ? JSON.parse(savedFilters).customFromDate : '';
  });
  const [customToDate, setCustomToDate] = useState(() => {
    const savedFilters = sessionStorage.getItem(FILTER_STATE_KEY);
    return savedFilters ? JSON.parse(savedFilters).customToDate : '';
  });

  // Get unique developers from stats data (not local workItems)
  const developers = useMemo(() => {
    if (dueDateStats.length === 0) return [];
    const devSet = new Set<string>();
    dueDateStats.forEach(stat => {
      devSet.add(stat.developer);
    });
    const devList = Array.from(devSet).sort();
    console.log('DevStats - Developers from stats:', devList);
    console.log('DevStats - Stats data:', dueDateStats);
    return devList;
  }, [dueDateStats]);

  // Team selection state
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Available teams
  const teams = [
    { id: 'all', name: 'All Teams' },
    { id: 'maxview-dev', name: 'MaxView - Dev', teamName: 'MaxView - Dev', project: 'MaxView' },
    { id: 'maxview-infra', name: 'MaxView Infra Team', teamName: 'MaxView Infra Team', project: 'MaxView' },
    { id: 'mobile-dev', name: 'Mobile - Dev', teamName: 'Mobile - Dev', project: 'MaxView' }
  ];

  // Fetch team members when team selection changes
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (selectedTeam === 'all') {
        setTeamMembers([]);
        return;
      }

      const team = teams.find(t => t.id === selectedTeam);
      if (!team || !('teamName' in team) || !team.teamName || !team.project) return;

      try {
        setLoadingMembers(true);
        const params = new URLSearchParams();
        params.append('project', team.project);
        params.append('teamName', team.teamName);
        
        const response = await fetch(`/api/team-members?${params.toString()}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const members = await response.json();
          console.log(`DevStats - Loaded ${members.length} members for ${team.name}:`, members);
          setTeamMembers(members);
        }
      } catch (error) {
        console.error('Error fetching team members:', error);
        setTeamMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchTeamMembers();
  }, [selectedTeam]); // Run when team selection changes

  // Poll sessionStorage to sync loading state and data across navigation
  useEffect(() => {
    const checkState = () => {
      // Check loading state
      const savedLoadingState = sessionStorage.getItem(LOADING_STATE_KEY);
      if (savedLoadingState) {
        const { loading: isLoading } = JSON.parse(savedLoadingState);
        if (isLoading && !loading) {
          setLoading(true);
          setShowNotification(true);
          setNotificationMessage('Loading statistics in background...');
        } else if (!isLoading && loading) {
          setLoading(false);
        }
      } else if (loading) {
        // If sessionStorage was cleared but we're still loading locally, sync it
        setLoading(false);
        setShowNotification(false);
      }

      // Check for data updates
      const savedData = sessionStorage.getItem(DATA_STATE_KEY);
      if (savedData) {
        const { stats, hasLoaded: dataHasLoaded } = JSON.parse(savedData);
        // Only update if the data has changed
        if (JSON.stringify(stats) !== JSON.stringify(dueDateStats)) {
          setDueDateStats(stats);
        }
        if (dataHasLoaded !== hasLoaded) {
          setHasLoaded(dataHasLoaded);
        }
      }
    };

    // Check immediately on mount
    checkState();

    // Poll every 500ms to detect changes
    const interval = setInterval(checkState, 500);

    return () => clearInterval(interval);
  }, [loading, dueDateStats, hasLoaded]);

  // Persist filter selections to sessionStorage whenever they change
  useEffect(() => {
    const filters = {
      selectedDeveloper,
      timeFrame,
      customFromDate,
      customToDate
    };
    sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(filters));
  }, [selectedDeveloper, timeFrame, customFromDate, customToDate]);

  // Persist data and hasLoaded state to sessionStorage
  useEffect(() => {
    const data = {
      stats: dueDateStats,
      hasLoaded
    };
    sessionStorage.setItem(DATA_STATE_KEY, JSON.stringify(data));
  }, [dueDateStats, hasLoaded]);

  const fetchDueDateStats = async () => {
    setLoading(true);
    setError(null);
    setShowNotification(true);
    setNotificationMessage('Loading statistics in background...');
    
    // Store loading state in sessionStorage
    sessionStorage.setItem(LOADING_STATE_KEY, JSON.stringify({ loading: true, timestamp: Date.now() }));
    
    try {
      // Calculate date range based on time frame
      let fromDate = '';
      let toDate = new Date().toISOString().split('T')[0];
      
      if (timeFrame === 'custom') {
        fromDate = customFromDate;
        toDate = customToDate;
      } else {
        const daysBack = parseInt(timeFrame);
        const from = new Date();
        from.setDate(from.getDate() - daysBack);
        fromDate = from.toISOString().split('T')[0];
      }
      
      // Build query params
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      if (selectedDeveloper !== 'all') params.append('developer', selectedDeveloper);
      // Note: project and areaPath are not sent - stats pull from hardcoded teams on server
      
      const response = await fetch(`/api/due-date-stats?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch due date statistics');
      }
      const data = await response.json();
      
      console.log('DevStats - API returned data:', {
        count: data.length,
        developers: data.map((s: any) => s.developer)
      });
      
      // Save to sessionStorage immediately (works even if component unmounts)
      sessionStorage.setItem(DATA_STATE_KEY, JSON.stringify({ 
        stats: data, 
        hasLoaded: true 
      }));
      
      // Update component state (only works if still mounted)
      setDueDateStats(data);
      setHasLoaded(true);
      setNotificationMessage('Statistics loaded successfully!');
      
      // Auto-hide success notification after 3 seconds
      setTimeout(() => {
        setShowNotification(false);
      }, 3000);
    } catch (err) {
      console.error('Error fetching due date stats:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      setNotificationMessage(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
      // Clear loading state from sessionStorage
      sessionStorage.removeItem(LOADING_STATE_KEY);
    }
  };

  // Filter the results by developer if needed, and by team if selected
  const filteredStats = useMemo(() => {
    let stats = dueDateStats;
    
    console.log('DevStats - Filtering:', {
      totalStats: dueDateStats.length,
      selectedTeam,
      teamMembersCount: teamMembers.length,
      selectedDeveloper
    });
    
    // Filter by team members if a specific team is selected
    if (selectedTeam !== 'all' && teamMembers.length > 0) {
      stats = stats.filter(stat => teamMembers.includes(stat.developer));
      console.log('DevStats - After team filter:', stats.length);
    }
    
    // Further filter by specific developer if selected
    if (selectedDeveloper !== 'all') {
      stats = stats.filter(stat => stat.developer === selectedDeveloper);
      console.log('DevStats - After developer filter:', stats.length);
    }
    
    console.log('DevStats - Final filtered stats:', stats.length);
    return stats;
  }, [dueDateStats, selectedDeveloper, selectedTeam, teamMembers]);

  return (
    <div className="dev-stats-container">
      <h2>Developer Statistics</h2>
      
      <div className="stats-section">
        <h3>Due Date Changes by Developer</h3>
        
        <div className="filter-controls">
          <div className="filter-row">
            <div className="filter-group">
              <label htmlFor="team-filter">Team:</label>
              <select 
                id="team-filter"
                value={selectedTeam} 
                onChange={(e) => {
                  setSelectedTeam(e.target.value);
                  setSelectedDeveloper('all'); // Reset developer filter when team changes
                }}
                className="filter-select"
              >
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="developer-filter">Developer:</label>
              <select 
                id="developer-filter"
                value={selectedDeveloper} 
                onChange={(e) => setSelectedDeveloper(e.target.value)}
                className="filter-select"
                disabled={loadingMembers}
              >
                <option value="all">
                  {selectedTeam === 'all' ? 'All Developers' : 'All Team Members'}
                </option>
                {(selectedTeam === 'all' ? developers : teamMembers).map(dev => (
                  <option key={dev} value={dev}>{dev}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label htmlFor="timeframe-filter">Time Frame:</label>
              <select 
                id="timeframe-filter"
                value={timeFrame} 
                onChange={(e) => setTimeFrame(e.target.value)}
                className="filter-select"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="60">Last 60 days</option>
                <option value="90">Last 90 days</option>
                <option value="180">Last 6 months</option>
                <option value="365">Last year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>
          
          {timeFrame === 'custom' && (
            <div className="filter-row">
              <div className="filter-group">
                <label htmlFor="from-date">From:</label>
                <input 
                  id="from-date"
                  type="date" 
                  value={customFromDate} 
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="filter-input"
                />
              </div>
              
              <div className="filter-group">
                <label htmlFor="to-date">To:</label>
                <input 
                  id="to-date"
                  type="date" 
                  value={customToDate} 
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="filter-input"
                />
              </div>
            </div>
          )}
          
          <div className="filter-actions">
            <button 
              onClick={fetchDueDateStats} 
              disabled={loading || (timeFrame === 'custom' && (!customFromDate || !customToDate))}
              className="load-stats-button"
            >
              {loading ? 'Loading...' : hasLoaded ? 'Refresh Statistics' : 'Load Statistics'}
            </button>
          </div>
        </div>
        
        {(showNotification || loading) && (
          <div className={`background-notification ${loading ? 'loading' : error ? 'error' : 'success'}`}>
            {loading && <div className="notification-spinner"></div>}
            <span className="notification-text">{loading ? 'Loading statistics in background...' : notificationMessage}</span>
            {!loading && (
              <button 
                className="notification-close" 
                onClick={() => setShowNotification(false)}
                aria-label="Close notification"
              >
                ×
              </button>
            )}
          </div>
        )}
        
        {!hasLoaded && !loading && (
          <p className="placeholder-text">Select filters and click "Load Statistics" to view due date change statistics.</p>
        )}
        
        {hasLoaded && !loading && filteredStats.length === 0 && (
          <p className="placeholder-text">No due date changes found for the selected filters.</p>
        )}
        
        {hasLoaded && !loading && filteredStats.length > 0 && (
          <div className="developer-stats-list">
            {filteredStats.map((devStats, index) => (
              <div key={index} className="developer-stat-card">
                <div className="developer-header">
                  <span className="developer-name">{devStats.developer}</span>
                  <span className="total-changes">{devStats.totalChanges} changes</span>
                </div>
                
                <div className="reason-breakdown">
                  <h4>Reasons:</h4>
                  <ul className="reason-list">
                    {Object.entries(devStats.reasonBreakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([reason, count], idx) => (
                        <li key={idx} className="reason-item">
                          <span className="reason-text">{reason}</span>
                          <span className="reason-count">{count}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
