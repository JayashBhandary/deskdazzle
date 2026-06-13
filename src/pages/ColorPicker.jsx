import React from 'react'
import { ColorPicker, useColor } from "react-color-palette";
import "react-color-palette/css";

function ColorPickers() {
  const [color, setColor] = useColor("#121212");

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

  return (
    <div className='page'>
      <div className='page__content'>
        <label>🎨 ColorPicker</label>
        <div className='content'>
          <div style={{ display: 'flex', flexDirection: 'column', margin: '24px', cursor: 'pointer' }} onClick={async () => {
            try {
              const data = { text: color.hex }
              await navigator.share(data);
            } catch (error) {
              alert(error)
            }
          }}>
            <div style={{ width: '300px', height: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: color.hex, borderRadius: '20px' }}>
              <p style={{ margin: '0px', padding: '0px', border: 'none', fontWeight: 'bold' }}>COPY HEX</p>
            </div>

          </div>

          <ColorPicker
            color={color}
            onChange={setColor}
          />

        </div>
      </div>
    </div>
  )
}

export default ColorPickers