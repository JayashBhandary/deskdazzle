import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Cloud, Droplets, Loader2, Plus, RefreshCw, Trash2, WifiOff, Wind } from 'lucide-react'
import { useStore } from '@/lib/store/WorkspaceProvider'
import { fetchJson } from '@/lib/fetchJson'
import { newId as genId } from '@/lib/id'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

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

const newId = () => genId();

function OfflineCard() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-4 text-center text-muted-foreground">
        <WifiOff className="size-8" aria-hidden="true" />
        <p className="font-medium">You&apos;re offline</p>
        <p className="hidden text-sm @sm:block">Weather lookups need an internet connection. This tool will work again once you&apos;re back online.</p>
      </CardContent>
    </Card>
  );
}

// The Weather app — one component rendered by both the full page and the desktop
// widget. Mirrors the Clock's world-clock: you save any number of cities (kept
// in the synced workspace store, so they persist and follow you across devices),
// and each row shows that city's live current conditions. A `@container` root
// keeps rows compact in the ~300px widget and roomier (humidity + wind) on the
// full page, reflowing live as the container is resized.
function WeatherApp() {
  // Saved cities: geocoded once at add-time so weather refreshes never re-geocode.
  // Shape: { id, name, country, latitude, longitude }.
  const [cities, setCities] = useStore('weatherCities', []);
  // Current conditions keyed by city id — transient (re-fetched), not persisted.
  const [wx, setWx] = useState({});
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  // Read the latest cities inside async callbacks without making them a dep
  // (which would churn on every store update); the string key below drives when
  // a refresh actually needs to re-run.
  const citiesRef = useRef(cities);
  citiesRef.current = cities;
  const citiesKey = cities.map((c) => `${c.id}:${c.latitude},${c.longitude}`).join('|');

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // Fetch current conditions for every saved city in a single batched request
  // (Open-Meteo accepts comma-separated coordinates and returns one result per
  // coordinate, in order). Keeps the last known values on failure/offline.
  const refresh = useCallback(async () => {
    const list = citiesRef.current;
    if (!list.length) { setWx({}); return; }
    if (!navigator.onLine) { setOnline(false); return; }
    setRefreshing(true);
    try {
      const lats = list.map((c) => c.latitude).join(',');
      const lons = list.map((c) => c.longitude).join(',');
      const res = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&temperature_unit=celsius`);
      const arr = Array.isArray(res) ? res : [res]; // single coord -> object
      const map = {};
      list.forEach((c, i) => { if (arr[i]?.current) map[c.id] = arr[i].current; });
      setWx(map);
    } catch {
      /* keep last known values */
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Refresh on the set of cities changing and when we come back online, plus a
  // periodic top-up so long-open windows don't show stale weather.
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15 * 60 * 1000);
    return () => clearInterval(t);
  }, [citiesKey, online, refresh]);

  const add = async () => {
    const q = query.trim();
    if (!q) return;
    if (!navigator.onLine) { setOnline(false); return; }
    setAdding(true);
    setAddError('');
    try {
      const geo = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`);
      if (!geo.results?.length) {
        setAddError('City not found.');
        return;
      }
      const { latitude, longitude, name, country } = geo.results[0];
      let dup = false;
      setCities((list) => {
        if (list.some((c) => c.name === name && c.country === country)) { dup = true; return list; }
        return [...list, { id: newId(), name, country, latitude, longitude }];
      });
      if (dup) setAddError(`${name} is already saved.`);
      else setQuery('');
    } catch {
      setOnline(false);
    } finally {
      setAdding(false);
    }
  };

  const remove = (id) => {
    setCities((list) => list.filter((c) => c.id !== id));
    setWx((m) => { const next = { ...m }; delete next[id]; return next; });
  };

  const showOffline = !online;

  return (
    <div className="@container flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 gap-2">
        <Input
          value={query}
          placeholder="Add a city"
          onChange={(e) => { setQuery(e.target.value); if (addError) setAddError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          aria-label="City name"
        />
        <Button onClick={add} disabled={showOffline || adding} aria-label="Add city">
          {adding ? <Loader2 className="animate-spin" /> : <Plus />}
          <span className="hidden @sm:inline">Add</span>
        </Button>
        {cities.length > 0 && (
          <Button
            variant="outline"
            size="icon"
            onClick={refresh}
            disabled={showOffline || refreshing}
            aria-label="Refresh weather"
            title="Refresh"
          >
            <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
          </Button>
        )}
      </div>

      {addError && <p className="shrink-0 text-sm text-destructive">{addError}</p>}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
        {showOffline && cities.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <WifiOff className="size-3.5" aria-hidden="true" /> Offline — showing last update.
          </p>
        )}

        {cities.length === 0 ? (
          showOffline ? (
            <OfflineCard />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center text-muted-foreground">
              <Cloud className="size-8 opacity-50" aria-hidden="true" />
              <p className="text-sm">No cities yet — add one above.</p>
            </div>
          )
        ) : (
          <ul className="divide-y rounded-lg border">
            {cities.map((c) => {
              const cur = wx[c.id];
              const [label, emoji] = WEATHER_CODES[cur?.weather_code] || ['—', '🌡️'];
              return (
                <li key={c.id} className="group flex items-center justify-between gap-3 px-3 py-2.5 @sm:px-4 @sm:py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium @sm:text-base">
                      {c.name}
                      {c.country && <span className="font-normal text-muted-foreground">, {c.country}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground @sm:text-xs">
                      <span className="truncate">{cur ? label : 'Loading…'}</span>
                      {cur && (
                        <span className="hidden items-center gap-1 @sm:flex">
                          <Droplets className="size-3" aria-hidden="true" />{cur.relative_humidity_2m}%
                        </span>
                      )}
                      {cur && (
                        <span className="hidden items-center gap-1 @sm:flex">
                          <Wind className="size-3" aria-hidden="true" />{cur.wind_speed_10m} km/h
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {cur ? (
                      <>
                        <span className="text-2xl @sm:text-3xl" aria-hidden="true">{emoji}</span>
                        <span className="font-mono text-lg font-semibold tabular-nums @sm:text-2xl">
                          {Math.round(cur.temperature_2m)}°
                        </span>
                      </>
                    ) : (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 opacity-60 transition-opacity @sm:size-8 @sm:opacity-0 @sm:group-hover:opacity-100"
                      onClick={() => remove(c.id)}
                      aria-label={`Remove ${c.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default WeatherApp
