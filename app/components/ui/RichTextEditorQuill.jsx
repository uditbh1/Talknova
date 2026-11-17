import { useState, useEffect } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import 'react-quill/dist/quill.snow.css';

export default function RichTextEditorQuill({ value, onChange, ...props }) {
  const [ReactQuill, setReactQuill] = useState(null);

  useEffect(() => {
    // Dynamically import react-quill only on the client to avoid SSR issues
    if (typeof window !== 'undefined') {
      import('react-quill').then(mod => {
        setReactQuill(mod.default);
      });
    }
  }, []);

  const handleChange = content => {
    onChange && onChange(content);
  };

  return (
    <ClientOnly fallback={<textarea {...props} value={value} onChange={e => onChange(e.target.value)} />}>
      {() =>
        ReactQuill ? (
          <ReactQuill {...props} theme="snow" value={value} onChange={handleChange} />
        ) : (
          // Fallback while react-quill is loading
          <textarea {...props} value={value} onChange={e => onChange(e.target.value)} />
        )
      }
    </ClientOnly>
  );
}
