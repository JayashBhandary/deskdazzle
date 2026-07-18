import React, { useEffect, useState } from 'react'
import { Droplets, Loader2, Search, WifiOff, Wind } from 'lucide-react';
import ToolPage from '../components/ToolPage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

// Open-Meteo WMO weather codes -> label + emoji.
const WEATHER_CODES = {
  0: ['Clear sky', '☀️'], 1: ['Mainly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Rime fog', '🌫️'],
  51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Dense drizzle', '🌧️'],
  61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
  71: ['Light snow', '🌨️'], 73: ['Snow', '❄️'], 75: ['Heavy snow', '❄️'],
  80: ['Rain showers', '🌦️'], 81: ['Rain showers', '🌧️'], 82: ['Violent showers', '⛈️'],
  95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm + hail', '⛈️'], 99: ['Thunderstorm + hail', '⛈️'],
};

function OfflineCard() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-4 text-center text-muted-foreground">
        <WifiOff className="size-8" aria-hidden="true" />
        <p className="font-medium">You&apos;re offline</p>
        <p className="text-sm">Weather lookups need an internet connection. This tool will work again once you&apos;re back online.</p>
      </CardContent>
    </Card>
  );
}

function WeatherApp() {
  const [city, setCity] = useState('');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | error | offline
  const [error, setError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => {
      setOnline(true);
      setStatus((s) => (s === 'offline' ? 'idle' : s));
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const search = async () => {
    if (!city.trim()) return;
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    setStatus('loading');
    setError('');
    setData(null);
    try {
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`).then((r) => r.json());
      if (!geo.results?.length) {
        setStatus('error');
        setError('City not found.');
        return;
      }
      const { latitude, longitude, name, country } = geo.results[0];
      const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&temperature_unit=celsius`).then((r) => r.json());
      setData({ name, country, current: w.current });
      setStatus('idle');
    } catch {
      setStatus('offline');
    }
  };

  const code = data?.current?.weather_code;
  const [label, emoji] = WEATHER_CODES[code] || ['Unknown', '🌡️'];
  const showOffline = !online || status === 'offline';

  return (
    <ToolPage
      icon="🌦️"
      title="Weather App"
      description="Current conditions for any city, powered by Open-Meteo."
    >
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="flex gap-2">
          <Input
            value={city}
            placeholder="Enter a city"
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            aria-label="City name"
          />
          <Button onClick={search} disabled={showOffline || status === 'loading'}>
            {status === 'loading' ? <Loader2 className="animate-spin" /> : <Search />}
            Search
          </Button>
        </div>

        {showOffline ? (
          <OfflineCard />
        ) : (
          <>
            {status === 'loading' && (
              <p className="text-center text-sm text-muted-foreground">Loading…</p>
            )}
            {status === 'error' && (
              <p className="text-center text-sm text-destructive">{error}</p>
            )}
            {data && (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 text-center">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {data.name}, {data.country}
                  </h2>
                  <div className="flex items-center gap-4">
                    <span className="text-5xl" aria-hidden="true">{emoji}</span>
                    <span className="text-5xl font-bold tracking-tight">
                      {Math.round(data.current.temperature_2m)}°C
                    </span>
                  </div>
                  <p className="text-muted-foreground">{label}</p>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Droplets className="size-4" aria-hidden="true" />
                      {data.current.relative_humidity_2m}%
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Wind className="size-4" aria-hidden="true" />
                      {data.current.wind_speed_10m} km/h
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </ToolPage>
  )
}

export default WeatherApp
