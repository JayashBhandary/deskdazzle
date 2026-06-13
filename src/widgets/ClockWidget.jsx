import React, { useEffect, useState } from 'react'

function ClockWidget() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className='widget widget--center'>
      <div className='clock__time'>{time}</div>
      <div className='clock__date'>{date}</div>
    </div>
  )
}

export default ClockWidget
