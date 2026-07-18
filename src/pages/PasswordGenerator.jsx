import React, { useState, useEffect } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import ToolPage from '../components/ToolPage';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';

export function PasswordPanel() {
  const [password, setPassword] = useState('')
  const [passwordLength, setPasswordLength] = useState(12)
  const [uppercase, setUppercase] = useState(true)
  const [lowercase, setLowercase] = useState(true)
  const [numbers, setNumbers] = useState(true)
  const [symbols, setSymbols] = useState(false)
  const [errors, setErrors] = useState({})

  const copyToClipboard = (text) => {
    navigator.permissions.query({ name: "clipboard-write" }).then((result) => {
      if (result.state === "granted" || result.state === "prompt") {
        navigator.clipboard.writeText(text).then(() => {
          // Alert the user that the action took place.
          // Nobody likes hidden stuff being done under the hood!
          toast.success('Copied to clipboard');
        });
      }
    });
  }

  const generatePassword = () => {
    setErrors({})
    if (!uppercase && !lowercase && !numbers && !symbols) {
      return setErrors('At least one character type must be selected')
    } else if (passwordLength === '0') {
      return setErrors('Password length cannot be 0')
    } else if (passwordLength === '') {
      return setErrors('Invalid password length')
    } else if (passwordLength > 80) {
      return setErrors('Password length cannot exceed 80 characters')
    }

    let password = ''
    for (let i = 0; i < passwordLength; i++) {
      let choice = random(0, 3)
      if (lowercase && choice === 0) {
        password += randomLower()
      } else if (uppercase && choice === 1) {
        password += randomUpper()
      } else if (symbols && choice === 2) {
        password += randomSymbol()
      } else if (numbers && choice === 3) {
        password += random(0, 9)
      } else {
        i--
      }
    }
    setPassword(password)
  }

  const random = (min = 0, max = 1) => {
    return Math.floor(Math.random() * (max + 1 - min) + min)
  }

  const randomLower = () => {
    return String.fromCharCode(random(97, 122))
  }

  const randomUpper = () => {
    return String.fromCharCode(random(65, 90))
  }

  const randomSymbol = () => {
    const symbols = "~*$%@#^&!?*'-=/,.{}()[]<>"
    return symbols[random(0, symbols.length - 1)]
  }

  useEffect(() => {
    generatePassword();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwordLength])

  const options = [
    { id: 'uppercase', label: 'Include Uppercase Letters', checked: uppercase, set: setUppercase },
    { id: 'lowercase', label: 'Include Lowercase Letters', checked: lowercase, set: setLowercase },
    { id: 'numbers', label: 'Include Numbers', checked: numbers, set: setNumbers },
    { id: 'symbols', label: 'Include Symbols', checked: symbols, set: setSymbols },
  ];

  return (
    <Card>
      <CardContent className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={generatePassword}>
            <RefreshCw /> Generate
          </Button>
        </div>

        <button
          type="button"
          onClick={() => copyToClipboard(password)}
          className="group flex w-full items-center justify-between gap-3 rounded-lg border bg-muted/50 px-4 py-3 text-left font-mono text-lg break-all transition-colors hover:bg-muted"
          aria-label="Copy password to clipboard"
        >
          <span className="min-w-0">{password || '—'}</span>
          <Copy className="size-4 shrink-0 text-muted-foreground transition-opacity group-hover:opacity-100 sm:opacity-0" />
        </button>

        <div className="space-y-2">
            <Label htmlFor="length">
              Password length: <span className="tabular-nums">{passwordLength}</span>
            </Label>
            <input
              id="length"
              className="w-full accent-primary"
              type="range"
              name="length"
              min="4"
              max="30"
              defaultValue={passwordLength}
              onChange={(e) => setPasswordLength(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((opt) => (
              <div key={opt.id} className="flex items-center gap-2">
                <Checkbox
                  id={opt.id}
                  name={opt.id}
                  checked={opt.checked}
                  onCheckedChange={(v) => opt.set(v === true)}
                />
                <Label htmlFor={opt.id} className="font-normal">{opt.label}</Label>
              </div>
            ))}
          </div>

          {!!errors.length && (
            <p role="alert" className="text-sm text-destructive">{errors}</p>
          )}
        </CardContent>
      </Card>
  )
}

function PasswordGenerator() {
  return (
    <ToolPage
      icon="🔑"
      title="Password Generator"
      description="Generate a random password on-device. Click the password to copy it."
    >
      <PasswordPanel />
    </ToolPage>
  )
}

export default PasswordGenerator
