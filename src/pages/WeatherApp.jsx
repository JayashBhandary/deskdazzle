import React from 'react';
import ToolPage from '../components/ToolPage';
import WeatherApp from '../apps/weather/WeatherApp';

// Thin route host: the Weather app itself lives in src/apps/weather and is
// shared with the desktop widget. Here we just wrap it in the page shell.
function WeatherAppPage() {
  return (
    <ToolPage
      icon="🌦️"
      title="Weather App"
      description="Current conditions for any city, powered by Open-Meteo."
    >
      <div className="mx-auto h-[70vh] w-full max-w-md">
        <WeatherApp />
      </div>
    </ToolPage>
  );
}

export default WeatherAppPage;
