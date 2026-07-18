import React, { useState } from 'react';
import CryptoJS from 'crypto-js';
import { Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import ToolPage from '../components/ToolPage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function EncryptPanel() {
  const [text, setText] = useState("");
  const [screen, setScreen] = useState("encrypt");

  const [encrptedData, setEncrptedData] = useState("");
  const [decrptedData, setDecrptedData] = useState("");

  const secretPass = "XkhZG4fW2t2x";

  const encryptData = () => {
    const data = CryptoJS.AES.encrypt(
      JSON.stringify(text),
      secretPass
    ).toString();

    setEncrptedData(data);
  };

  const decryptData = () => {
    const bytes = CryptoJS.AES.decrypt(text, secretPass);
    const data = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    setDecrptedData(data);
  };

  const switchScreen = (type) => {
    setText("");
    setEncrptedData("");
    setDecrptedData("");
    setScreen(type);
  };

  const handleClick = () => {
    if (!text) return;

    if (screen === "encrypt") encryptData();
    else decryptData();
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={text}
              onChange={({ target }) => {
                setText(target.value);
              }}
              name="text"
              type="text"
              onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
              placeholder={
                screen === "encrypt" ? "Enter Text" : "Enter Encrypted Data"
              }
              aria-label={screen === "encrypt" ? "Text to encrypt" : "Encrypted data to decrypt"}
            />
            <Button onClick={handleClick} className="shrink-0">
              {screen === "encrypt" ? "Encrypt" : "Decrypt"}
            </Button>
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

function TextEncryptor() {
  return (
    <ToolPage
      icon="🔒"
      title="Text Encryptor"
      description="AES-encrypt and decrypt text right in your browser with crypto-js."
    >
      <EncryptPanel />
    </ToolPage>
  )
}

export default TextEncryptor
