import React from 'react';
import ToolPage from '../components/ToolPage';
import QRCodeApp from '../apps/qrcode/QRCodeApp';

// Thin route host: the QR Code app itself lives in src/apps/qrcode.
function QRCodeGenerator() {
  return (
    <ToolPage
      wide
      icon="🔗"
      title="QR Code Generator"
      description="Turn any text or URL into a downloadable QR code — generated entirely in your browser."
    >
      <QRCodeApp />
    </ToolPage>
  );
}

export default QRCodeGenerator;
