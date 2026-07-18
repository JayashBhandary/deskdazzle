import React, { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PasswordPanel } from './parts/PasswordGenerator'
import { EncryptPanel } from './parts/TextEncryptor'

export const VAULT_TABS = [
  { value: 'passwords', label: 'Passwords', Panel: PasswordPanel },
  { value: 'encrypt', label: 'Encrypt', Panel: EncryptPanel },
]
export const VAULT_TAB_KEYS = VAULT_TABS.map((t) => t.value)

// The Vault app — the tabbed container (Password generator + Text encryptor).
// Tabs can be driven externally (the page syncs `tab` to the URL) or managed
// internally, via the controlled/uncontrolled `tab`/`onTabChange` props.
function VaultApp({ tab: tabProp, onTabChange }) {
  const [tabState, setTabState] = useState('passwords')
  const tab = tabProp ?? tabState
  const setTab = (v) => {
    if (onTabChange) onTabChange(v)
    else setTabState(v)
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
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
  )
}

export default VaultApp
