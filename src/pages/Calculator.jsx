import React from 'react';
import ToolPage from '../components/ToolPage';
import CalculatorApp from '../apps/calculator/CalculatorApp';

// Thin route host: the Calculator app itself lives in src/apps/calculator and is
// shared with the desktop widget. Here we just wrap it in the page shell.
function Calculator() {
  return (
    <ToolPage
      icon="🧮"
      title="Calculator"
      description="Quick arithmetic with full keyboard support — try typing an expression."
    >
      <div className="h-[70vh]">
        <CalculatorApp />
      </div>
    </ToolPage>
  );
}

export default Calculator;
