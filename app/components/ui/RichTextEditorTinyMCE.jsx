import { Editor } from '@tinymce/tinymce-react';
import { useRef } from 'react';

/**
 * A simple TinyMCE editor component pointing at a self-hosted TinyMCE script.
 * This avoids the "A valid API key is required" error from Tiny Cloud usage.
 */
export default function RichTextEditorTinyMCE({
  value,
  onChange,
  // If you don't want to pass props, you can remove ...props
  // but it can be convenient for controlling things from the parent.
  ...props
}) {
  const editorRef = useRef(null);

  const handleEditorChange = content => {
    if (onChange) onChange(content);
  };

  return (
    <Editor
      // Use self-hosted TinyMCE script:
      tinymceScriptSrc="https://ldtraining.klaspad.com/js/tinymce/tinymce.min.js"
      onInit={(evt, editor) => (editorRef.current = editor)}
      initialValue={value}
      // Basic example config:
      init={{
        branding: false,
        height: 300,
        menubar: false,
        // Include the plugins you want, including `code` for editing raw HTML:
        plugins: [
          'advlist',
          'autolink',
          'lists',
          'link',
          'image',
          'charmap',
          'print',
          'preview',
          'anchor',
          'searchreplace',
          'visualblocks',
          'code',
          'fullscreen',
          'insertdatetime',
          'media',
          'table',
          'paste',
          'help',
          'wordcount',
        ],
        // Include `code` in your toolbar so you can open the HTML editor:
        toolbar:
          'undo redo | formatselect | ' +
          'bold italic backcolor | alignleft aligncenter ' +
          'alignright alignjustify | bullist numlist outdent indent | ' +
          'removeformat | help | code',
      }}
      {...props}
      // This event fires whenever the content changes:
      onEditorChange={handleEditorChange}
    />
  );
}
