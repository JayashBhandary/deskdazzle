import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ToolPage from '../components/ToolPage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PasswordPanel } from './PasswordGenerator';
import { EncryptPanel } from './TextEncryptor';

const TABS = ['passwords', 'encrypt'];

function Vault() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab = TABS.includes(requested) ? requested : 'passwords';

  const handleTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <ToolPage
      wide
      icon="🔐"
      title="Vault"
      description="Generate strong passwords and encrypt text — 100% on-device."
    >
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="passwords">Passwords</TabsTrigger>
          <TabsTrigger value="encrypt">Encrypt</TabsTrigger>
        </TabsList>

        <TabsContent value="passwords" className="mt-4">
          <PasswordPanel />
        </TabsContent>

        <TabsContent value="encrypt" className="mt-4">
          <EncryptPanel />
        </TabsContent>
      </Tabs>
    </ToolPage>
  );
}

export default Vault;
