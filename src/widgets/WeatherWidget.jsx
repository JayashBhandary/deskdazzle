import React, { useContext, useState } from 'react'
import { ThemeContext } from '../App';

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
  const { theme } = useContext(ThemeContext);
  const [city, setCity] = useState('');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle');

  const search = async () => {
    if (!city.trim()) return;
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
      setStatus('error');
    }
  };

  const [label, emoji] = CODES[data?.weather_code] || ['', '🌡️'];

  return (
    <div className='widget'>
      <div className='widget__addrow'>
        <input
          className={`widget__input ${theme ? 'dark' : 'light'}`}
          value={city}
          placeholder='City...'
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button className='widget__addbtn' onClick={search}>🔍</button>
      </div>
      <div className='widget--center' style={{ flex: 1 }}>
        {status === 'loading' && <p className='widget__empty'>Loading...</p>}
        {status === 'error' && <p className='widget__empty'>City not found.</p>}
        {data && status === 'idle' && (
          <>
            <div style={{ fontSize: '46px' }}>{emoji}</div>
            <div className='clock__time' style={{ fontSize: '36px' }}>{Math.round(data.temperature_2m)}°C</div>
            <div className='clock__date'>{data.name} · {label}</div>
          </>
        )}
        {!data && status === 'idle' && <p className='widget__empty'>Search a city.</p>}
      </div>
    </div>
  )
}

export default WeatherWidget
