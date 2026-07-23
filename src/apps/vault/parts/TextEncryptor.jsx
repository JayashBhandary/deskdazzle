import React, { useState } from 'react';
import { Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { encryptText, decryptText } from '@/lib/crypto/textCrypto';

export function EncryptPanel() {
  const [text, setText] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [screen, setScreen] = useState("encrypt");
  const [busy, setBusy] = useState(false);

  const [encrptedData, setEncrptedData] = useState("");
  const [decrptedData, setDecrptedData] = useState("");

  const switchScreen = (type) => {
    setText("");
    setPassphrase("");
    setEncrptedData("");
    setDecrptedData("");
    setScreen(type);
  };

  const handleClick = async () => {
    if (!text) return;
    if (!passphrase) { toast.error('Enter a passphrase'); return; }
    setBusy(true);
    try {
      if (screen === "encrypt") {
        setEncrptedData(await encryptText(text, passphrase));
      } else {
        setDecrptedData(await decryptText(text, passphrase));
      }
    } catch (err) {
      toast.error(err?.message || 'Operation failed');
    } finally {
      setBusy(false);
    }
  };

  const output = screen === "encrypt" ? encrptedData : decrptedData;

  const copyOutput = () => {
    navigator.clipboard.writeText(output).then(() => {
      toast.success('Copied to clipboard');
    });
  };

  const shareOutput = async () => {
    try {
      const data = { text: output };
      await navigator.share(data);
    } catch (error) {
      toast.error(String(error));
    }
  };

  return (
    <>
      <Tabs value={screen} onValueChange={switchScreen} className="mb-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="encrypt">Encrypt</TabsTrigger>
          <TabsTrigger value="decrypt">Decrypt</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Input
              value={text}
              onChange={({ target }) => setText(target.value)}
              name="text"
              type="text"
              onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
              placeholder={
                screen === "encrypt" ? "Enter Text" : "Enter Encrypted Data"
              }
              aria-label={screen === "encrypt" ? "Text to encrypt" : "Encrypted data to decrypt"}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={passphrase}
                onChange={({ target }) => setPassphrase(target.value)}
                name="passphrase"
                type="password"
                autoComplete="off"
                onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
                placeholder="Passphrase"
                aria-label="Passphrase"
              />
              <Button onClick={handleClick} disabled={busy} className="shrink-0">
                {busy ? '…' : (screen === "encrypt" ? "Encrypt" : "Decrypt")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Encryption runs on-device (AES-GCM, PBKDF2). Your passphrase is never stored or
              transmitted — if you lose it, the data cannot be recovered.
            </p>
          </div>

          {encrptedData || decrptedData ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{screen === "encrypt" ? "Encrypted" : "Decrypted"} Data</Label>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={copyOutput}>
                    <Copy /> Copy
                  </Button>
                  <Button variant="ghost" size="sm" onClick={shareOutput}>
                    <Share2 /> Share
                  </Button>
                </div>
              </div>
              <Textarea
                readOnly
                rows={8}
                value={output}
                className="resize-none font-mono text-sm break-all"
                aria-label="Result"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  )
}
