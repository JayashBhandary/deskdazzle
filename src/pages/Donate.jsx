import React, { useState, useContext } from 'react'
import { QRCodeSVG } from 'qrcode.react';
import { ThemeContext } from '../App';

function Donate() {
    const { theme } = useContext(ThemeContext);
    const [amount, setAmount] = useState(5);

    const handleAmount = (event) => {
        setAmount(event.target.value);
    }

    return (
        <div className='page'>
            <div className='page__content'>

                <label>🙌  Donate</label>

                <div className='content'>
                    <div className='donate'>
                        <div className='donate__qr' >
                        <p>Scan the QR Code to donate. Thank you!!!</p>

                            <QRCodeSVG value={`upi://pay?pa=jayashbhandary.famc@idfcbank&pn=DeskDazzle&am=${amount}`} size={200} onClick={async () => {
                                try {
                                    const data = {
                                        text: `jayashbhandary.famc@idfcbank`
                                    }
                                    await navigator.share(data);
                                } catch (error) {
                                    alert(error)
                                }
                            }} />
                            <div style={{ display: 'flex', justifyContent: 'center', fontWeight: 'bold', fontSize: '30px' }}><p style={{ margin: '10px', cursor: 'pointer' }} onClick={() => setAmount(Number(amount) + 1)}>+</p><p style={{ margin: '10px' }}>₹{amount}</p><p style={{ margin: '10px', cursor: 'pointer' }} onClick={() => setAmount(amount - 1)}>-</p></div>
                        </div>
                        <div className='donate__option'>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                                <label className={`header_button ${theme ? "dark" : "light"}`} style={{ fontSize: '22px' }} onClick={() => setAmount(5)} href="#">💰₹5</label>
                                <label className={`header_button ${theme ? "dark" : "light"}`} style={{ fontSize: '22px' }} onClick={() => setAmount(50)} href="#">💸₹50</label>
                                <label className={`header_button ${theme ? "dark" : "light"}`} style={{ fontSize: '22px' }} onClick={() => setAmount(500)} href="#">🤑₹500</label>
                                <label className={`header_button ${theme ? "dark" : "light"}`} style={{ fontSize: '22px' }} onClick={() => setAmount(1000)} href="#">🏦₹1000</label>
                            </div>
                            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><p>₹1</p><input type="range" placeholder='Custom donation' onChange={handleAmount} value={amount} min="1" max="4000" /><p>₹4000</p></div>
                            {/**<a className={`header_button donate_button ${theme ? "dark" : "light"}`} href={`upi://pay?pa=jayashbhandary.famc@idfcbank&pn=DeskDazzle&am=${amount}`}>Click to Donate</a> */}
                            
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Donate