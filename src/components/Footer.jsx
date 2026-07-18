import React from 'react'
import { Link } from 'react-router-dom';

const footerLinkClass = 'text-sm text-muted-foreground transition-colors hover:text-foreground';

function Footer() {
  return (
    <footer className='border-t bg-background'>
      <div className='mx-auto max-w-6xl px-4 py-10'>
        <div className='flex flex-wrap gap-x-16 gap-y-8'>
          <section className='flex flex-col gap-2'>
            <h6 className='text-sm font-semibold text-foreground'>DeskDazzle</h6>
            <Link className={footerLinkClass} to='/'>Home</Link>
            <Link className={footerLinkClass} to='/'>Github</Link>
            <Link className={footerLinkClass} to='/docs'>Go to Docs</Link>
          </section>
          <section className='flex flex-col gap-2'>
            <h6 className='text-sm font-semibold text-foreground'>Support</h6>
            <Link className={footerLinkClass} to='/'>Contact Us</Link>
            <Link className={footerLinkClass} to='/'>Help</Link>
          </section>
        </div>
        <p className='mt-10 text-sm text-muted-foreground'>
          {'Developed with ❤️ by '}
          <a
            className='underline underline-offset-4 transition-colors hover:text-foreground'
            href='https://www.instagram.com/jayash_bhandary_'
            target='_blank'
            rel='noreferrer'
          >
            Jayash Bhandary
          </a>
        </p>
      </div>
    </footer>
  )
}

export default Footer
