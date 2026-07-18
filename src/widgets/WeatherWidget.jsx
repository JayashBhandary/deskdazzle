import React, { useState } from 'react'
import { Loader2, Search, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CODES = {
  0: ['Clear', '☀️'], 1: ['Mainly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Rime fog', '🌫️'],
  51: ['Drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Drizzle', '🌧️'],
  61: ['Rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
  71: ['Snow', '🌨️'], 73: ['Snow', '❄️'], 75: ['Heavy snow', '❄️'],
  80: ['Showers', '🌦️'], 81: ['Showers', '🌧️'], 82: ['Showers', '⛈️'],
  95: ['Storm', '⛈️'], 96: ['Storm', '⛈️'], 99: ['Storm', '⛈️'],
};

function WeatherWidget() {
  const [city, setCity] = useState('');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle');

  const search = async () => {
    if (!city.trim()) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setData(null);
      setStatus('offline');
      return;
    }
    setStatus('loading');
    setData(null);
    try {
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`).then((r) => r.json());
      if (!geo.results?.length) { setStatus('error'); return; }
      const { latitude, longitude, name } = geo.results[0];
      const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`).then((r) => r.json());
      setData({ name, ...w.current });
      setStatus('idle');
    } catch {
      setStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error');
    }
  };

  const [label, emoji] = CODES[data?.weather_code] || ['', '🌡️'];

  return (
    <div className="flex h-full flex-col gap-2.5">
      <div className="flex gap-1.5">
        <Input
          className="h-8 min-w-0 flex-1"
          value={city}
          placeholder="City..."
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <Button size="icon" variant="secondary" className="size-8 shrink-0" onClick={search} aria-label="Search city">
          <Search />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 text-center">
        {status === 'loading' && (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        )}
        {status === 'error' && (
          <p className="text-sm text-muted-foreground">City not found.</p>
        )}
        {status === 'offline' && (
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
            <WifiOff className="size-6" />
            <p className="text-sm">You&apos;re offline.</p>
          </div>
        )}
        {data && status === 'idle' && (
          <>
            <div className="text-5xl leading-none">{emoji}</div>
            <div className="font-mono text-3xl font-extrabold">{Math.round(data.temperature_2m)}°C</div>
            <div className="text-sm text-muted-foreground">{data.name} · {label}</div>
          </>
        )}
        {!data && status === 'idle' && (
          <p className="text-sm text-muted-foreground">Search a city.</p>
        )}
      </div>
    </div>
  )
}

export default WeatherWidget
