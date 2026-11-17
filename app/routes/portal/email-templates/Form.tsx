import { Form, useLoaderData } from '@remix-run/react';
import { useRef, useState } from 'react';

import SubmitButton from '~/components/ui/SubmitBtn';
import CancelBackBtn from '~/components/ui/CancelBackBtn';

import RichTextEditorTinyMCE from '~/components/ui/RichTextEditorTinyMCE';
import RichTextEditorQuill from '~/components/ui/RichTextEditorQuill';

export default function FormView() {
  const { data = {} } = useLoaderData() || {};
  const formRef = useRef();

  const [name, setName] = useState(data?.name || '');
  const [uniqueId, setUniqueId] = useState(data?.uniqueId || '');
  const [body, setBody] = useState(data?.body || '');
  const [editorType, setEditorType] = useState('tinymce');
  // default to tinymce, or 'quill' if you want

  const _action = data?._id ? 'UPDATE' : 'ADD';

  const generateUniqueId = val => {
    return val.toUpperCase().replace(/\s+/g, '_');
  };

  const handleNameChange = e => {
    const newName = e.target.value;
    setName(newName);
    setUniqueId(generateUniqueId(newName));
  };

  return (
    <Form method="post" ref={formRef}>
      <div className="mb-3">
        <div className="row">
          {/* Template Name */}
          <div className="col-lg-6 col-md-6 col-sm-12 col-xs-12 mb-3">
            <label className="form-label">Template Name</label>
            <input type="text" className="form-control" required name="name" value={name} onChange={handleNameChange} />
          </div>

          {/* Unique ID */}
          <div className="col-lg-6 col-md-6 col-sm-12 col-xs-12 mb-3">
            <label className="form-label">Unique ID</label>
            <input type="text" className="form-control" required name="uniqueId" value={uniqueId} readOnly />
            <small className="text-muted">Auto-generated from name</small>
          </div>

          {/* Subject */}
          <div className="col-lg-12 col-md-12 col-sm-12 col-xs-12 mb-3">
            <label className="form-label">Subject</label>
            <input type="text" className="form-control" required name="subject" defaultValue={data?.subject || ''} />
          </div>

          {/* Email Body Editor */}
          <div className="col-lg-12 col-md-12 col-sm-12 col-xs-12 mb-3">
            <label className="form-label">Email Body</label>
            {editorType === 'tinymce' ? (
              <RichTextEditorTinyMCE value={body} onChange={setBody} />
            ) : (
              <RichTextEditorQuill value={body} onChange={setBody} style={{ height: '250px' }} />
            )}

            {/* Hidden field to submit raw HTML */}
            <input type="hidden" name="body" value={body} />
          </div>

          {/* Action Buttons */}
          <div className="d-grid d-flex justify-content-between mt-5">
            <div>
              <SubmitButton className="btn btn-primary" />
              <CancelBackBtn />
            </div>
          </div>
        </div>
      </div>

      {/* Hidden fields for internal logic */}
      <input name="_id" value={data?._id || ''} type="hidden" />
      <input name="_action" value={_action} type="hidden" />
    </Form>
  );
}
