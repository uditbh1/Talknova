import { Form } from '@remix-run/react';
import { useState } from 'react';

export default function TestEmailModal({ templateId, templateName, templateSubject, templateBody }) {
  const [recipient, setRecipient] = useState('');

  return (
    <div className="modal fade" id={`testEmailModal-${templateId}`} tabIndex={-1} aria-labelledby="testEmailModalLabel" aria-hidden="true">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="testEmailModalLabel">
              Test Email: {templateName}
            </h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <Form method="post">
            <div className="modal-body">
              <div className="mb-3">
                <label htmlFor="recipient" className="form-label">
                  Send Test Email To
                </label>
                <input type="email" className="form-control" id="recipient" name="recipient" required value={recipient} onChange={e => setRecipient(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label">Subject</label>
                <p className="form-control-plaintext">{templateSubject}</p>
              </div>
              <div className="mb-3">
                <label className="form-label">Preview</label>
                <div className="border p-3 bg-light" style={{ maxHeight: '200px', overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: templateBody }}></div>
              </div>
              <input type="hidden" name="_action" value="TEST_EMAIL" />
              <input type="hidden" name="templateId" value={templateId} />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">
                Close
              </button>
              <button type="submit" className="btn btn-primary">
                Send Test Email
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
