import React from 'react';
import ToolPage from '../components/ToolPage';
import TodayApp from '../apps/today/TodayApp';

// Thin route host: the Today app lives in src/apps/today and is shared with the
// desktop widget. Here we just wrap it in the page shell.
function Today() {
  return (
    <ToolPage icon='🌅' title='Today' description='Everything due across your workspace, in one agenda.'>
      <div className="h-[70vh]">
        <TodayApp />
      </div>
    </ToolPage>
  )
}

export default Today
