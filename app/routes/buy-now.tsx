import { Link, useLoaderData } from '@remix-run/react';
import FrontLayout from '~/components/FrontLayout';
import { getUserFromSession } from '~/utils/auth.server';
import { frontendLinks } from '~/utils/frontend-links';

export const links = frontendLinks;

export async function loader({ request, params }) {
  let user = await getUserFromSession(request);
  return { user };
}

export default function BuyNow() {
  const { user } = useLoaderData();

  return (
    <FrontLayout>
      <section className="document-container bg-light">
        <div className="container">
          <div className="document-block">
            <div className="row d-grid d-flex justify-content-center">
              <div className="col-lg-4 col-md-6 col-sm-12 col-xs-12">
                <form method="post" action="/cart">
                  <h4>Add Credits</h4>
                  <div className="card">
                    <div className="card-body">
                      <div className="col-lg-col-lg-12 mb-2">
                        <label className="form-label">Amount to add</label>
                        <select className="form-select" aria-label="Default select example">
                          <option value="">Select</option>
                          <option value="5.00">£5.00 (1,000 Credits)</option>
                          <option value="10.00">£10.00 (3,000 Credits)</option>
                          <option value="25.00">£25.00 (8000 Credits)</option>
                          <option value="50.00">£50.00 (20,000 Credits)</option>
                          <option value="100.00">£100.00 (50,000 Credits)</option>
                          <option value="500.00">£500.00 (300,000 Credits)</option>
                          <option value="1000.00">£1,000.00 (1,000,000 Credits)</option>
                        </select>
                      </div>

                      <div className="col-lg-col-lg-12 mb-3">
                        <label className="form-label">Promotions</label>
                        <div className="code-coupon">
                          <div className="input-group mb-2">
                            <input 
                              type="text" 
                              className="form-control"
                              placeholder="Enter Coupon" 
                              name="couponCode" 
                            />
                            <button className="btn btn-apply" type="submit">Apply</button>
                          </div>
                        </div>
                      </div>

                      <div className="col-lg-12 mt-3 mb-3">
                        <button type="submit" className="document-btn">Proceed</button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </FrontLayout>
  );
} 