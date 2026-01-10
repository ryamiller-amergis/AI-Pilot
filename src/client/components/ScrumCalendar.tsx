import { useState, useMemo, useCallback, useRef } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUSLocale from 'date-fns/locale/en-US';
import { WorkItem } from '../types/workitem';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './ScrumCalendar.css';

const DragAndDropCalendar = withDragAndDrop(Calendar);

const locales = {
  'en-US': enUSLocale,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface ScrumCalendarProps {
  workItems: WorkItem[];
  onUpdateDueDate: (id: number, dueDate: string | null) => void;
  onSelectItem: (item: WorkItem) => void;
}

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: WorkItem;
  allDay?: boolean;
}

export const ScrumCalendar: React.FC<ScrumCalendarProps> = ({
  workItems,
  onUpdateDueDate,
  onSelectItem,
}) => {
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [isDragging, setIsDragging] = useState(false);
  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>('');
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get unique assigned to values
  const assignedToOptions = useMemo(() => {
    const unique = new Set<string>();
    workItems.forEach(item => {
      if (item.assignedTo) {
        unique.add(item.assignedTo);
      }
    });
    return Array.from(unique).sort();
  }, [workItems]);

  // Filter work items based on selected filters
  const filteredWorkItems = useMemo(() => {
    return workItems.filter(item => {
      if (selectedAssignedTo && item.assignedTo !== selectedAssignedTo) {
        return false;
      }
      return true;
    });
  }, [workItems, selectedAssignedTo]);

  const events: CalendarEvent[] = useMemo(() => {
    return filteredWorkItems
      .filter((item) => item.dueDate)
      .map((item) => {
        // Parse the date string directly (YYYY-MM-DD format)
        const [year, month, day] = item.dueDate!.split('-').map(Number);
        const eventDate = new Date(year, month - 1, day);
        
        // Create event with custom onDragStart
        const event: CalendarEvent = {
          id: item.id,
          title: `#${item.id}: ${item.title}`,
          start: eventDate,
          end: eventDate,
          resource: item,
          allDay: true,
        };
        
        return event;
      });
  }, [filteredWorkItems]);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    // Reset dragging state and open details
    setIsDragging(false);
    onSelectItem(event.resource);
  }, [onSelectItem]);

  const handleEventDrop = useCallback(({ event, start, end, allDay }: any) => {
    setIsDragging(false);
    
    // Use the local date components to avoid timezone issues
    const year = start.getFullYear();
    const month = start.getMonth();
    const day = start.getDate();
    const dropDate = new Date(year, month, day);
    
    // Format as YYYY-MM-DD
    const newDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentDate = event.resource.dueDate;
    
    console.log('Drop event:', { 
      start, 
      year,
      month,
      day,
      dropDate,
      newDate, 
      currentDate,
      workItemId: event.resource.id,
      allDay
    });
    
    // Only update if the date actually changed
    if (newDate === currentDate) {
      console.log('Date unchanged, skipping update');
      return;
    }

    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce the update slightly to prevent rapid-fire updates
    updateTimeoutRef.current = setTimeout(() => {
      console.log('Updating due date:', event.resource.id, newDate);
      onUpdateDueDate(event.resource.id, newDate);
    }, 100);
  }, [onUpdateDueDate]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleEventDragStart = useCallback((event: CalendarEvent) => {
    // Set global reference for unscheduled list to pick up
    console.log('Calendar drag start:', event.resource);
    (window as any).__DRAGGED_CALENDAR_ITEM__ = event.resource;
  }, []);

  const handleDropFromOutside = useCallback(({ start, end, allDay }: any) => {
    // This handles drops from external sources (unscheduled items)
    const draggedItem = (window as any).__DRAGGED_WORK_ITEM__;
    
    if (!draggedItem) {
      return;
    }

    // Use the local date components to avoid timezone issues
    const year = start.getFullYear();
    const month = start.getMonth();
    const day = start.getDate();
    
    // Format as YYYY-MM-DD
    const newDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    console.log('Drop from outside:', { 
      workItemId: draggedItem.id,
      newDate,
      start,
      year,
      month,
      day
    });
    
    onUpdateDueDate(draggedItem.id, newDate);
    
    // Clear the dragged item reference
    (window as any).__DRAGGED_WORK_ITEM__ = null;
  }, [onUpdateDueDate]);

  const AgendaEvent = ({ event }: { event: CalendarEvent }) => {
    return (
      <div>
        <div style={{ fontWeight: 500, marginBottom: '4px' }}>{event.title}</div>
        <div style={{ fontSize: '0.85em', color: '#666' }}>
          <strong>Assigned To:</strong> {event.resource.assignedTo || 'Unassigned'}
        </div>
      </div>
    );
  };

  return (
    <div className="scrum-calendar-container">
      <div className="calendar-filters">
        <div className="filter-group">
          <label htmlFor="assignedTo">Assigned To:</label>
          <select 
            id="assignedTo"
            value={selectedAssignedTo} 
            onChange={(e) => {
              setSelectedAssignedTo(e.target.value);
              onSelectItem(null as any); // Close details panel
            }}
            className="filter-select"
          >
            <option value="">All</option>
            {assignedToOptions.map(person => (
              <option key={person} value={person}>{person}</option>
            ))}
          </select>
        </div>
        {selectedAssignedTo && (
          <button 
            className="clear-filters-btn"
            onClick={() => {
              setSelectedAssignedTo('');
              onSelectItem(null as any); // Close details panel
            }}
          >
            Clear Filters
          </button>
        )}
      </div>
      <DragAndDropCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        allDayAccessor="allDay"
        style={{ height: 'calc(100vh - 60px)' }}
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        onSelectEvent={handleSelectEvent}
        onEventDrop={handleEventDrop}
        onDropFromOutside={handleDropFromOutside}
        onDragStart={(args: any) => {
          handleDragStart();
          handleEventDragStart(args.event);
        }}
        draggableAccessor={() => true}
        resizable={false}
        step={60}
        showMultiDayTimes
        defaultDate={new Date()}
        components={{
          agenda: {
            event: AgendaEvent,
          },
        }}
      />
    </div>
  );
};
