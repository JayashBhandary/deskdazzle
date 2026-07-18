import React from 'react';
import ToolPage from '../components/ToolPage';
import DesignApp from '../apps/design/DesignApp';

// Thin route host: the Design app (colour picker + gradient tabs) lives in
// src/apps/design and keeps its own ?tab= URL sync. Here we just wrap it in the
// page shell.
function Design() {
  return (
    <ToolPage
      wide
      icon="🎨"
      title="Design"
      description="Pick colours and build CSS gradients."
    >
      <DesignApp />
    </ToolPage>
  );
}

export default Design;
