// ErrBoundary component

import { Link } from 'react-router-dom';
import { useNavigate } from '@remix-run/react';
import { Form } from '@remix-run/react';
import Modal from '~/components/ui/Modal';
import SubmitButton from '~/components/ui/SubmitBtn';

function ErrBoundary({
  title = "We're sorry, something unexpected happened. Our team has been notified and is working to fix it.",
  msg = 'The page you are looking for not avaible!',
  ...props
}) {
  const navigate = useNavigate();
  const goBack = () => navigate(-1);

  //add last dot if not present in msg
  if (msg[msg.length - 1] != '.') msg += '.';

  const showHelpForm = e => {
    e.preventDefault();
    $('#systemModal').modal('show');
  };

  const helpFormSubmit = e => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    formData.append('page', window.location.href);
    fetch('/api/help', {
      method: 'POST',
      body: formData,
    })
      .then(res => res.json())
      .then(data => {
        if (data.status == 'OK') {
          $('#systemModal').modal('hide');
          alert('Your message has been sent successfully.');
        } else {
          alert(data.msg);
        }
      });
  };

  const closeHelpForm = e => {
    e.preventDefault();
    $('#systemModal').modal('hide');
  };

  return (
    <section className="page_404">
      <div className="container">
        <Modal title="Report a problem" id="systemModal" size="lg">
          <Form onSubmit={helpFormSubmit} method="post">
            <div className="row">
              <div className="col-lg-12">
                <label className="form-label"> Message </label>
                <textarea minLength="3" required className="form-control" name="message" />
              </div>

              <div className="col-lg-12">
                <Link onClick={closeHelpForm} to="" className="btn btn-change-number" style={{ float: 'right', marginLeft: '20px' }}>
                  Cancel
                </Link>

                <SubmitButton className="btn btn-change-number" style={{ float: 'right' }} />
              </div>
            </div>

            <input type="hidden" name="alert" value={msg} />
          </Form>
        </Modal>
        <div className="row">
          <div className="col-sm-12 ">
            <div className="col-sm-10 col-sm-offset-1  text-center">
              <div className="four_zero_four_bg">
                <i className="fa fa-exclamation-triangle fa-3x" style={{ margin: 10 }} aria-hidden="true"></i>
              </div>

              <div className="contant_box_404">
                <img width="32px" src="/assets/images/error/error_exclamation.png" alt="Image" />
                <h4>{title}</h4>
                <p>{msg}</p>

                <Link to="/" className="btn btn-outline-primary mb-2">
                  Home
                </Link>

                {/* <a href="javascript:void(0)" onClick={showHelpForm} className="btn btn-outline-primary mb-2 ms-3">
                  Report
                </a> */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ErrBoundary;
