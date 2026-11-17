import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import { json, redirect } from "@remix-run/node";
import { getUserFromSession, requireUserSession } from "~/utils/auth.server";
import { ReviewModel } from "~/models/review";
import moment from "moment-timezone";

export async function loader({ request }) {
  await requireUserSession(request);
  const user = await getUserFromSession(request);
  
  const reviews = await ReviewModel.find({})
    .populate('addedBy', 'name')
    .populate('updatedBy', 'name')
    .sort({ createdAt: -1 })
    .lean();

  return json({ reviews, user });
}

export async function action({ request }) {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const { _action, _id } = Object.fromEntries(formData);

  if (_action === 'DELETE') {
    try {
      await ReviewModel.findByIdAndDelete(_id);
      return json({ success: true });
    } catch (error) {
      return json({ error: 'Failed to delete review' }, { status: 400 });
    }
  }

  if (_action === 'TOGGLE_PUBLISH') {
    try {
      const review = await ReviewModel.findById(_id);
      if (review) {
        review.isPublished = !review.isPublished;
        review.updatedBy = user._id;
        await review.save();
      }
      return json({ success: true });
    } catch (error) {
      return json({ error: 'Failed to update review' }, { status: 400 });
    }
  }

  return json({ error: 'Invalid action' }, { status: 400 });
}

export default function ReviewsIndex() {
  const { reviews } = useLoaderData();
  const fetcher = useFetcher();

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this review?')) {
      fetcher.submit(
        { _action: 'DELETE', _id: id },
        { method: 'post' }
      );
    }
  };

  const handleTogglePublish = (id) => {
    fetcher.submit(
      { _action: 'TOGGLE_PUBLISH', _id: id },
      { method: 'post' }
    );
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-lg-12">
          <div className="mb-5 d-flex justify-content-between align-items-center">
            <h3 className="mb-0 text-white">Reviews Management</h3>
            <Link className="btn btn-white" to="add">
              Add Review
            </Link>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-12">
          <div className="card mb-4">
            <div className="card-body">
              {reviews && reviews.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Rating</th>
                        <th>Review</th>
                        <th>Status</th>
                        <th>Added Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviews.map((review) => (
                        <tr key={review._id}>
                          <td>{review.name}</td>
                          <td>{review.email}</td>
                          <td>
                            <div className="d-flex">
                              {[...Array(5)].map((_, i) => (
                                <span
                                  key={i}
                                  className={`text-${i < review.rating ? 'warning' : 'muted'}`}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <div style={{ maxWidth: '300px' }}>
                              {review.reviewText.length > 100
                                ? `${review.reviewText.substring(0, 100)}...`
                                : review.reviewText}
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${review.isPublished ? 'bg-success' : 'bg-secondary'}`}>
                              {review.isPublished ? 'Published' : 'Draft'}
                            </span>
                          </td>
                          <td>{moment(review.createdAt).format('MMM DD, YYYY')}</td>
                          <td>
                            <div className="btn-group" role="group">
                              <Link
                                to={review._id.toString()}
                                className="btn btn-sm btn-outline-primary"
                              >
                                Edit
                              </Link>
                              <button
                                type="button"
                                className={`btn btn-sm ${review.isPublished ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                onClick={() => handleTogglePublish(review._id)}
                                disabled={fetcher.state === 'submitting'}
                              >
                                {review.isPublished ? 'Unpublish' : 'Publish'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(review._id)}
                                disabled={fetcher.state === 'submitting'}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted">No reviews found.</p>
                  <Link className="btn btn-primary" to="add">
                    Add First Review
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}