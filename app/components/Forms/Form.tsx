import { Form, useLoaderData, Link } from '@remix-run/react';
import YesNoDropdown from '~/components/ui/YesNoSelect';
import SubmitButton from '~/components/ui/SubmitBtn';
import GenderSelect from '~/components/ui/Gender';

function FormView({ ...props }) {
  const { data = {} } = useLoaderData();
  let isDisabled = false;

  if (data && data._id) {
    data._action = 'UPDATE';
    isDisabled = true;
  } else {
    data._action = 'ADD';
  }

  return (
    <form>
      <div>
        <div className="mb-3">
          <div className="row">
            <div className="col-12 mb-3 text-center">
              <div className="avatar avatar-xxl avatar-indicators">
                <img alt="avatar" src="./assets/images/avatar/office-man.png" className="rounded-circle" />
              </div>
              <br />
              <label className="form-label">Upload Profile Picture</label>
              <input type="file" className="form-control" required />
            </div>
            <div className="col-lg-3 mb-3">
              <label className="form-label">Title</label>
              <select className="form-select" name="title" required>
                <option value="">Select</option>
                <option value="Mr">Mr</option>
                <option value="Ms">Ms</option>
                <option value="Mrs">Mrs</option>
                <option value="Miss">Miss</option>
                <option value="Dr">Dr</option>
                <option value="Prof">Prof</option>
              </select>
            </div>
            <div className="col-lg-3 mb-3">
              <label className="form-label">First Name </label>
              <input type="text" className="form-control" required />
            </div>
            <div className="col-lg-3 mb-3">
              <label className="form-label">Last Name </label>
              <input type="text" className="form-control" required />
            </div>
            <div className="col-lg-3 mb-3">
              <label className="form-label">Likes to be known as </label>
              <input type="text" className="form-control" required />
            </div>
            <div className="col-lg-3 mb-3">
              <label className="form-label">Address Line 1</label>
              <input type="text" className="form-control" required />
            </div>
            <div className="col-lg-3 mb-3">
              <label className="form-label">Address Line 2</label>
              <input type="text" className="form-control" required />
            </div>
            <div className="col-lg-3 mb-3">
              <label className="form-label">City</label>
              <input type="text" className="form-control" required />
            </div>
            <div className="col-lg-3 mb-3">
              <label className="form-label">County</label>
              <input type="text" className="form-control" required />
            </div>
            <div className="col-lg-3 mb-3">
              <label className="form-label">Postcode / Zipcode </label>
              <input type="text" className="form-control" required />
            </div>
            <div className="col-lg-3 mb-3">
              <label className="form-label">Gender</label>
              <GenderSelect name="gender" defaultValue={data.gender} required />
            </div>
            <div className="col-lg-3 mb-3">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" required />
            </div>
            <div className="col-lg-3 mb-3">
              <label className="form-label">Telephone Number</label>
              <input type="text" className="form-control" required />
            </div>
            <div className="col-lg-12 mb-3">
              <label className="form-label">About me</label>
              <textarea className="form-control" id="textarea-input" rows={6} defaultValue={''} />
            </div>
            <div className="col-lg-12 mb-3">
              <label className="form-label">Current Position/ Title</label>
              <input type="text" className="form-control" required />
            </div>
            <h3>Social Media</h3>
            <div className="col-lg-12 mb-3">
              <label className="form-label">Website</label>
              <input type="text" className="form-control" required />
            </div>
            <div className="col-lg-12 mb-3">
              <label className="form-label">Linkedin</label>
              <input type="text" className="form-control" required />
            </div>
            <div className="col-lg-12 mb-3">
              <label className="form-label">Facebook</label>
              <input type="text" className="form-control" required />
            </div>
            <div className="col-lg-12 mb-3">
              <label className="form-label">Twitter</label>
              <input type="text" className="form-control" required />
            </div>
            <div className="col-lg-12 mb-3">
              <label className="form-label">TikTok</label>
              <input type="text" className="form-control" required />
            </div>
            <div className="d-grid d-flex justify-content-between mt-4">
              <div>
                <SubmitButton className="btn btn-primary" />
                <Link className="btn btn-primary ms-3" to="../">
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

export default FormView;
