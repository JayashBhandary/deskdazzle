import React, { useContext, useState, useMemo } from 'react'
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ThemeContext } from '../App';

const SAMPLE = `# Hello, Markdown!

Type on the **left**, see the preview on the _right_.

- Lists
- [Links](https://deskdazzle.web.app)
- \`inline code\`

> Blockquotes too.

\`\`\`js
console.log("code blocks");
\`\`\`
`;

function MarkdownPreviewer() {
  const { theme } = useContext(ThemeContext);
  const [text, setText] = useState(SAMPLE);

  const html = useMemo(() => {
    const raw = marked.parse(text || '', { breaks: true, gfm: true });
    return DOMPurify.sanitize(raw);
  }, [text]);

  return (
    <div className='page'>
      <div className='page__content'>
        <label>💻 MarkdownPreviewer</label>
        <div className='content'>
          <div className='tool tool--split'>
            <textarea
              className={`tool__input tool__editor ${theme ? 'dark' : 'light'}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Write some markdown...'
            />
            <div
              className={`tool__markdown ${theme ? 'dark' : 'light'}`}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default MarkdownPreviewer
