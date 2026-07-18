import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ToolPage from '../components/ToolPage';
import ImagesApp, { IMAGES_TABS } from '../apps/images/ImagesApp';

// Thin route host: the Images app itself lives in src/apps/images. Here we just
// wrap it in the page shell and keep the active tab in the URL (?tab=…), so
// deep links like /images?tab=batch work and survive reloads.
function Images() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('tab');
  const tab = IMAGES_TABS.includes(param) ? param : 'resize';

  return (
    <ToolPage
      wide
      icon="🖼️"
      title="Images"
      description="Resize, optimize and batch-convert images — all on-device."
    >
      <ImagesApp tab={tab} onTabChange={(t) => setSearchParams({ tab: t }, { replace: true })} />
    </ToolPage>
  );
}

export default Images;
