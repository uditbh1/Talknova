import { Form, Link, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import SubmitButton from "~/components/ui/SubmitBtn";

function FormView() {
  const { data = {} } = useLoaderData();
  const [rating, setRating] = useState(data.rating || 5);
  const [hoverRating, setHoverRating] = useState(0);
  
  data._action = data._id ? "UPDATE" : "ADD";

  const handleStarClick = (starRating) => {
    setRating(starRating);
  };

  const handleStarHover = (starRating) => {
    setHoverRating(starRating);
  };

  const handleStarLeave = () => {
    setHoverRating(0);
  };

  return (
    <Form method="post">
      <div className="row">
        <div className="col-lg-6">
          <label htmlFor="name" className="col-form-label">
            Name <span className="text-danger">*</span>
          </label>
          <input
            required
            type="text"
            className="form-control"
            name="name"
            id="name"
            defaultValue={data.name}
          />
        </div>
        <div className="col-lg-6">
          <label htmlFor="email" className="col-form-label">
            Email <span className="text-danger">*</span>
          </label>
          <input
            required
            type="email"
            className="form-control"
            name="email"
            id="email"
            defaultValue={data.email}
          />
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-lg-12">
          <label className="col-form-label">
            Rating <span className="text-danger">*</span>
          </label>
          <div className="d-flex align-items-center">
            <div className="star-rating me-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`star ${
                    star <= (hoverRating || rating) ? 'active' : ''
                  }`}
                  style={{
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: star <= (hoverRating || rating) ? '#ffc107' : '#e4e5e9',
                    marginRight: '5px'
                  }}
                  onClick={() => handleStarClick(star)}
                  onMouseEnter={() => handleStarHover(star)}
                  onMouseLeave={handleStarLeave}
                >
                  ★
                </span>
              ))}
            </div>
            <span className="text-muted">({rating} star{rating !== 1 ? 's' : ''})</span>
          </div>
          <input type="hidden" name="rating" value={rating} />
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-lg-12">
          <label htmlFor="reviewText" className="col-form-label">
            Review Text <span className="text-danger">*</span>
          </label>
          <textarea
            required
            className="form-control"
            name="reviewText"
            id="reviewText"
            rows="4"
            defaultValue={data.reviewText}
            placeholder="Enter review text..."
          />
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-lg-12">
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              name="isPublished"
              id="isPublished"
              defaultChecked={data.isPublished}
            />
            <label className="form-check-label" htmlFor="isPublished">
              Publish this review on the frontend
            </label>
          </div>
        </div>
      </div>

      {/* Submit and Cancel buttons */}
      <div className="d-grid d-flex justify-content-between mt-4">
        <div className="w-40 py-3">
          <SubmitButton className="btn btn-primary" />
          <Link className="btn btn-secondary ms-3" to="../">
            Cancel
          </Link>
        </div>
      </div>

      {/* Hidden fields */}
      <input name="_id" value={data._id} type="hidden" />
      <input name="_action" defaultValue={data._action} type="hidden" />
    </Form>
  );
}

export default FormView;