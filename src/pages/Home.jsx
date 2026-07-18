import React from 'react'

function Home() {
  return (
    <div className='flex min-h-[70vh] w-full flex-col items-center justify-center gap-8 px-4 py-16 text-center'>
      <h1 className='max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl'>
        We're brewing <span className='text-primary'>something</span> special.
      </h1>
      <img
        className='w-64 max-w-full rounded-xl border shadow-sm'
        src='https://media.tenor.com/7_04RHsB3AEAAAAC/loading-mys5.gif'
        alt='loading'
      />
    </div>
  )
}

export default Home
