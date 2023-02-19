import React, { useContext } from 'react'
import { Link } from 'react-router-dom';
import { ThemeContext } from '../App';

function Footer() {
  const { theme } = useContext(ThemeContext);
  return (
    <footer>
      <div className='footer__options'>
      <div className='footertop'></div>
      <div className='footermiddle'>
        <section className='middlesec'>
          <h6 style={{fontWeight: 'bold'}}>DeskDazzle</h6>
          <Link  className={`footer__a ${theme ? "dark" : "light"}`} to='/'>Home</Link>
          <Link className={`footer__a ${theme ? "dark" : "light"}`} to='/'>Github</Link>
          <Link className={`footer__a ${theme ? "dark" : "light"}`} to='/docs'>Go to Docs</Link>
        </section>
        <section className='middlesec'>
          <h6 style={{fontWeight: 'bold'}}>Support</h6>
          <Link className={`footer__a ${theme ? "dark" : "light"}`} to='/'>Contact Us</Link>
          <Link className={`footer__a ${theme ? "dark" : "light"}`} href='/'>Help</Link>
        </section>
        
        <section></section>
      </div>
      <div style={{fontSize: '16px',paddingBottom: '30px'}} className='footerbottom'>{"Developed with ❤️ by "}<a style={{fontSize: '16px', textDecoration: 'underline'}} className={theme ? "dark" : "light"} href='https://www.instagram.com/jayash_bhandary_' target='_blank' rel="noreferrer">Jayash Bhandary</a></div>
      </div>
    </footer>
  )
}

export default Footer


/**<section className='middlesec'>
          <h6 style={{fontWeight: 'bold'}}>Legal</h6>
          <Link className={`footer__a ${theme ? "dark" : "light"}`} to='/'>Privacy</Link>
          <Link className={`footer__a ${theme ? "dark" : "light"}`} to='/'>Terms of Use</Link>
          <Link className={`footer__a ${theme ? "dark" : "light"}`} to='/'>Legal Notice</Link>
        </section> */