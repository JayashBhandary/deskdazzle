import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ToolPage from '../components/ToolPage';
import VaultApp, { VAULT_TAB_KEYS } from '../apps/vault/VaultApp';

// Thin route host: the Vault app itself lives in src/apps/vault. Here we just
// wrap it in the page shell and keep the active tab in the URL (?tab=…), so
// deep links like /vault?tab=encrypt work.
function Vault() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab = VAULT_TAB_KEYS.includes(requested) ? requested : 'passwords';

  return (
    <ToolPage
      wide
      icon="🔐"
      title="Vault"
      description="Generate strong passwords and encrypt text — 100% on-device."
    >
      <VaultApp tab={tab} onTabChange={(value) => setSearchParams({ tab: value }, { replace: true })} />
    </ToolPage>
  );
}

export default Vault;
