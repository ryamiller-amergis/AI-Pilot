import { useState, useMemo, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { startOfMonth, endOfMonth } from 'date-fns';
import { ScrumCalendar } from './components/ScrumCalendar';
import { UnscheduledList } from './components/UnscheduledList';
import { DetailsPanel } from './components/DetailsPanel';
import { CycleTimeAnalytics } from './components/CycleTimeAnalytics';
import { useWorkItems } from './hooks/useWorkItems';
import { WorkItem } from './types/workitem';
import './App.css';

function App() {
  const [currentDate] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [currentView, setCurrentView] = useState<'calendar' | 'analytics'>('calendar');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const startDate = startOfMonth(currentDate);
  const endDate = endOfMonth(currentDate);

  const { workItems, loading, error, updateDueDate } = useWorkItems(
    startDate,
    endDate
  );

  const scheduledItems = useMemo(
    () => workItems.filter((item) => item.dueDate),
    [workItems]
  );

  const unscheduledItems = useMemo(
    () => workItems.filter((item) => !item.dueDate),
    [workItems]
  );

  // Keep selectedItem in sync with workItems
  useEffect(() => {
    if (selectedItem) {
      const updatedItem = workItems.find(item => item.id === selectedItem.id);
      if (updatedItem) {
        setSelectedItem(updatedItem);
      }
    }
  }, [workItems, selectedItem?.id]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Loading work items...</p>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app">
        <div className="app-header">
          <div className="view-switcher">
            <button 
              className={`view-btn ${currentView === 'calendar' ? 'active' : ''}`}
              onClick={() => setCurrentView('calendar')}
            >
              Calendar
            </button>
            <button 
              className={`view-btn ${currentView === 'analytics' ? 'active' : ''}`}
              onClick={() => setCurrentView('analytics')}
            >
              Analytics
            </button>
          </div>
          <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
        {error && <div className="error-banner">{error}</div>}
        
        {currentView === 'calendar' ? (
          <div className="calendar-view">
            <UnscheduledList
              workItems={unscheduledItems}
              onSelectItem={setSelectedItem}
              onUpdateDueDate={(id, dueDate) => {
                // Close details panel when dragging items
                setSelectedItem(null);
                updateDueDate(id, dueDate);
              }}
            />
            <ScrumCalendar
              workItems={scheduledItems}
              onUpdateDueDate={(id, dueDate) => {
                // Close details panel when dragging items
                setSelectedItem(null);
                updateDueDate(id, dueDate);
              }}
              onSelectItem={setSelectedItem}
            />
            {selectedItem && (
              <DetailsPanel
                workItem={selectedItem}
                onClose={() => setSelectedItem(null)}
                onUpdateDueDate={updateDueDate}
              />
            )}
          </div>
        ) : (
          <CycleTimeAnalytics workItems={workItems} />
        )}
      </div>
    </DndProvider>
  );
}

export default App;
