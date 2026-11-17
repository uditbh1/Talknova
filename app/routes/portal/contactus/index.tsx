import { useLoaderData, useFetcher } from '@remix-run/react';
import { redirect, json } from '@remix-run/node';
import { useState } from 'react';
import { Modal } from 'react-bootstrap';
import { format } from 'date-fns';
import { ContactUsModel } from '~/models/contact';
import { getUserFromSession } from '~/utils/auth.server';

export async function loader({ request }) {
  let user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  const contacts = await ContactUsModel.find().sort({ createdAt: -1 }).lean();
  return json({ user, contacts });
}

export default function Index() {
  const { contacts } = useLoaderData();
  const [showModal, setShowModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);

  const handleView = (contact) => {
    setSelectedContact(contact);
    setShowModal(true);
  };

  return (
    <>
      <div className="row">
        <div className="col-lg-12 col-md-12 col-12">
          <div className="d-flex justify-content-between align-items-center mb-5">
            <div className="mb-2 mb-lg-0">
              <h3 className="mb-0 text-white">Contact Inquiries</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xl-12 col-12 mb-5">
          <div className="card">
            <div className="card-header">
              <h4 className="mb-0">Inquiries List</h4>
            </div>

            <div className="card-body">
              <div className="table-responsive table-card">
                <table className="table text-nowrap mb-0 table-centered table-hover">
                  <thead className="table-light">
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Company</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <tr key={contact._id}>
                        <td>{contact.name}</td>
                        <td>{contact.email}</td>
                        <td>{contact.company}</td>
                        <td>{format(new Date(contact.createdAt), 'dd MMM yyyy HH:mm')}</td>
                        <td>
                          <button
                            className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip"
                            onClick={() => handleView(contact)}
                            data-template="viewDetails"
                          >
                            <i data-feather="eye" className="icon-xs" />
                            <div id="viewDetails" className="d-none">
                              <span>View Details</span>
                            </div>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Details Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Contact Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedContact && (
            <div className="container">
              <div className="row mb-3">
                <div className="col-md-4"><strong>Name:</strong></div>
                <div className="col-md-8">{selectedContact.name}</div>
              </div>
              <div className="row mb-3">
                <div className="col-md-4"><strong>Email:</strong></div>
                <div className="col-md-8">{selectedContact.email}</div>
              </div>
              <div className="row mb-3">
                <div className="col-md-4"><strong>Phone:</strong></div>
                <div className="col-md-8">{selectedContact.phone}</div>
              </div>
              <div className="row mb-3">
                <div className="col-md-4"><strong>Company:</strong></div>
                <div className="col-md-8">{selectedContact.company}</div>
              </div>
              <div className="row mb-3">
                <div className="col-md-4"><strong>Message:</strong></div>
                <div className="col-md-8">{selectedContact.message}</div>
              </div>
              <div className="row mb-3">
                <div className="col-md-4"><strong>Date:</strong></div>
                <div className="col-md-8">
                  {format(new Date(selectedContact.createdAt), 'dd MMM yyyy HH:mm')}
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
            Close
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
} 