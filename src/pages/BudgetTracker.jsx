import React from 'react';
import ToolPage from '../components/ToolPage';
import BudgetApp from '../apps/budget/BudgetApp';

// Thin route host: the Budget app itself lives in src/apps/budget and is shared
// with the desktop widget. Here we just wrap it in the page shell.
function BudgetTracker() {
  return (
    <ToolPage
      icon="💳"
      title="Budget Tracker"
      description="Track income and expenses at a glance."
    >
      <div className="h-[70vh]">
        <BudgetApp />
      </div>
    </ToolPage>
  );
}

export default BudgetTracker;
