import React from 'react';
import ToolPage from '../components/ToolPage';
import ExcelApp from '../apps/excel/ExcelApp';

// Thin route host: the Excel app lives in src/apps/excel and is shared with the
// desktop widget. Workbooks export to real .xlsx via the office WASM core.
function Spreadsheet() {
  return (
    <ToolPage
      fill
      icon="📊"
      title="Excel"
      description="Build spreadsheets and save them as real .xlsx — multiple sheets, numbers and =formulas, all on-device."
    >
      <div className="h-full">
        <ExcelApp />
      </div>
    </ToolPage>
  );
}

export default Spreadsheet;
