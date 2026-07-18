import React from 'react';
import ToolPage from '../components/ToolPage';
import CalendarApp from '../apps/calendar/CalendarApp';

// Thin route host: the Calendar app itself lives in src/apps/calendar and is
// shared with the desktop widget. Here we just wrap it in the page shell.
function Calender() {
  return (
    <ToolPage icon='📅' title='Calendar' description='Browse a monthly calendar.'>
      <div className="h-[70vh]">
        <CalendarApp />
      </div>
    </ToolPage>
  )
}

export default Calender
