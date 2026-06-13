import React, { useState, useContext, useRef } from 'react'
import html2canvas from 'html2canvas';
import { ThemeContext } from '../App';

function GradientGenerator() {
  const { theme } = useContext(ThemeContext);
  const [startColor, setStartColor] = useState('#ff0000');
  const [endColor, setEndColor] = useState('#0033ff');
  const [horizontal, setHorizontal] = useState("right");
  const [vertical, setVertical] = useState("top");
  const gradientRef = useRef(null);


  const copyToClipboard = (text) => {
    navigator.permissions.query({ name: "clipboard-write" }).then((result) => {
      if (result.state === "granted" || result.state === "prompt") {
        navigator.clipboard.writeText(text).then(() => {
          // Alert the user that the action took place.
          // Nobody likes hidden stuff being done under the hood!
          alert("Copied to clipboard");
        });
      }

    });
  }

  const handleStartColorChange = (event) => {
    setStartColor(event.target.value);
  };

  const handleEndColorChange = (event) => {
    setEndColor(event.target.value);
  };

  const saveImage = () => {
    html2canvas(gradientRef.current).then(function (canvas) {
      const link = document.createElement('a');
      link.download = `DeskDazzle ${startColor} ${endColor}.png`;
      link.href = canvas.toDataURL();
      link.click();
    });
  };
  

  const gradientStyle = {
    backgroundImage: `linear-gradient(to ${horizontal} ${vertical}, ${startColor}, ${endColor})`,
  };


  return (
    <div className='page'>
      <div className='page__content'>

        <label>🌈 GradientGenerator</label>

        <div className='content'>
          <div style={gradientStyle} className="gradient-preview" ref={gradientRef} onClick={saveImage}>
            <p style={{position: 'relative', top: '10px', left: '5px', color: 'rgba(255,255,255,0.5)',fontWeight: 'bold'}}>Desk Dazzle</p>
            <p style={{position: 'relative', top: '20px', left: '5px', color: 'rgba(255,255,255,0.5)',fontWeight: 'bold'}}>{startColor}</p>
            <p style={{position: 'relative', top: '30px', left: '5px', color: 'rgba(255,255,255,0.5)',fontWeight: 'bold'}}>{endColor}</p>
            <p style={{position: 'relative', top: '40px', left: '5px', color: 'rgba(255,255,255,0.5)',fontWeight: 'bold', fontSize: '15px'}}>{`linear-gradient(to ${horizontal} ${vertical}, ${startColor}, ${endColor})`}</p>
            </div>
          <p>Click on the gradient to download the image.</p>
          <div className='gradientcontrols'>
            <div className='gradientoption'>
              <div className='custom-select'>
                <p htmlFor="start-color">Start Color: </p>
                <input type="color" id="start-color" value={startColor} onChange={handleStartColorChange} />
              </div>
              <div className='custom-select'>
                <p htmlFor="end-color">End Color: </p>
                <input type="color" id="end-color" value={endColor} onChange={handleEndColorChange} />
              </div>
              <div className='custom-select'>
                <p htmlFor="vertical">Vertical:</p>
                <select style={{ backgroundColor: theme ? "white" : "#f5f5f5" }} value={vertical} onChange={(e) => setVertical(e.target.value)}>
                  <option>Vertical</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                </select>
              </div>
              <div className='custom-select'>
                <p htmlFor="horizontal">Horizontal: </p>
                <select style={{ backgroundColor: theme ? "white" : "#f5f5f5" }} value={horizontal} onChange={(e) => setHorizontal(e.target.value)}>
                  <option>Horizontal</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} onClick={() => copyToClipboard(`linear-gradient(to ${horizontal} ${vertical}, ${startColor}, ${endColor})`)}>
              <p style={{ margin: '2px', padding: '15px', color: theme ? "#000000" : "#ffffff", backgroundColor: theme ? "#ffffff" : "#000000", borderRadius: '20px' }}>{`linear-gradient(to ${horizontal} ${vertical}, ${startColor}, ${endColor})`}</p>
              <p style={{ color: theme ? "#ffffff" : "#000000", }} onClick={async () => {
                try {
                  const data = { text: `linear-gradient(to ${horizontal} ${vertical}, ${startColor}, ${endColor})` }
                  await navigator.share(data);
                } catch (error) {
                  alert(error)
                }
              }}>👆Click to Copy</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GradientGenerator