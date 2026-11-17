import { Form, useLoaderData } from '@remix-run/react';
import { useFetcher } from '@remix-run/react';
import { useRef, useState } from 'react';
import SubmitButton from '~/components/ui/SubmitBtn';
import CancelBackBtn from '~/components/ui/CancelBackBtn';
import MultiSelect from '~/components/MultiSelect';

function FormView() {
  const { data = {} } = useLoaderData() || {};

  const formRef = useRef();
  const avatarRef = useRef();
  let isDisabled = false;

  if (data && data._id) {
    data._action = 'UPDATE';
    isDisabled = false;
  } else {
    data._action = 'ADD';
  }

  return (
    <Form method="post" ref={formRef} encType="multipart/form-data">
      <div>
        <div className="mb-3">
          <div className="row">
            <div className="col-lg-4 col-md-4 col-sm-12 col-xs-12 mb-3">
              <label className="form-label">First Name</label>
              <input type="text" className="form-control" required name="firstName" defaultValue={data.firstName} />
            </div>
            <div className="col-lg-4 col-md-4 col-sm-12 col-xs-12 mb-3">
              <label className="form-label">Last Name</label>
              <input type="text" className="form-control" required name="lastName" defaultValue={data.lastName} />
            </div>
            <div className="col-lg-4 col-md-4 col-sm-12 col-xs-12 mb-3">
              <label className="form-label">Telephone</label>
              <input type="text" className="form-control" required name="phone" defaultValue={data.phone} />
            </div>
            <div className="col-lg-4 col-md-4 col-sm-12 col-xs-12 mb-3">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" required name="email" defaultValue={data.email} />
            </div>
            <div className="col-lg-4 col-md-4 col-sm-12 col-xs-12 mb-3">
              <label className="form-label">Password (Leave blank if you don't want to change)</label>
              <input type="password" className="form-control" required name="password" defaultValue="" minLength="6" />
            </div>

            <div className="d-grid d-flex justify-content-between mt-4">
              <div>
                <SubmitButton className="btn btn-primary" />
                <CancelBackBtn />
              </div>
            </div>
          </div>
        </div>
      </div>
      <input name="_id" value={data._id} type="hidden" />
      <input name="_action" defaultValue={data._action} type="hidden" />
    </Form>
  );
}

export default FormView;
