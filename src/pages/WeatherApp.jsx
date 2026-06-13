import React, { useContext, useState } from 'react'
import { ThemeContext } from '../App';

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

function WeatherApp() {
  const { theme } = useContext(ThemeContext);
  const [city, setCity] = useState('');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [error, setError] = useState('');

  const search = async () => {
    if (!city.trim()) return;
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
      setStatus('error');
      setError('Could not fetch weather. Try again.');
    }
  };

  const code = data?.current?.weather_code;
  const [label, emoji] = WEATHER_CODES[code] || ['Unknown', '🌡️'];

  return (
    <div className='page'>
      <div className='page__content'>
        <label>🌦️ WeatherApp</label>
        <div className='content'>
          <div className='tool'>
            <div className='tool__panel' style={{ maxWidth: '500px', width: '100%' }}>
              <div className='card'>
                <input
                  className={`${theme ? 'dark' : 'light'}`}
                  value={city}
                  placeholder='Enter a city'
                  onChange={(e) => setCity(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && search()}
                />
                <button className='submit-btn' style={{ color: theme ? 'white' : 'black' }} onClick={search}>Search</button>
              </div>
              {status === 'loading' && <p>Loading...</p>}
              {status === 'error' && <p className='tool__error'>{error}</p>}
              {data && (
                <div className={`weather-card ${theme ? 'dark' : 'light'}`}>
                  <h2>{data.name}, {data.country}</h2>
                  <div className='weather-card__main'>
                    <span className='weather-card__emoji'>{emoji}</span>
                    <span className='weather-card__temp'>{Math.round(data.current.temperature_2m)}°C</span>
                  </div>
                  <p>{label}</p>
                  <div className='weather-card__meta'>
                    <span>💧 {data.current.relative_humidity_2m}%</span>
                    <span>💨 {data.current.wind_speed_10m} km/h</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WeatherApp
