import { useActionData, Form, useLoaderData } from '@remix-run/react';
import { json, redirect } from '@remix-run/node';
import { useState } from 'react';
import FrontLayout from '~/components/FrontLayout';
import { getUserFromSession } from '~/utils/auth.server';
import DisplayActionResponse from '~/components/ui/DisplayActionResponse';
import { ReviewModel } from '~/models/review';
import { frontendLinks } from '~/utils/frontend-links';

export const links = frontendLinks;

export async function loader({ request }) {
  let user = await getUserFromSession(request);

  if (!user) return redirect('/login');

  return { user };
}

export async function action({ request }) {
  const formData = await request.formData();
  const { name, email, rating, reviewText } = Object.fromEntries(formData);

  // Validation
  if (!name) return json({ messages: ['Name is required.'], status: 'ERROR' });
  if (!email) return json({ messages: ['Email is required.'], status: 'ERROR' });
  if (!rating) return json({ messages: ['Rating is required.'], status: 'ERROR' });
  if (!reviewText) return json({ messages: ['Review text is required.'], status: 'ERROR' });

  // Validate rating
  const ratingNum = parseInt(rating);
  if (ratingNum < 1 || ratingNum > 5) {
    return json({ messages: ['Please select a rating between 1 and 5 stars.'], status: 'ERROR' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return json({ messages: ['Please enter a valid email address.'], status: 'ERROR' });
  }

  // Save data (as draft - admin will publish)
  try {
    await ReviewModel.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      rating: ratingNum,
      reviewText: reviewText.trim(),
      isPublished: false, // Customer reviews start as drafts
    });
    return json({
      messages: ['Thank you for your review! It will be published after admin approval.'],
      status: 'SUCCESS',
    });
  } catch (error) {
    console.error('Error creating review:', error);
    return json({ messages: ['An error occurred while submitting your review. Please try again.'], status: 'ERROR' });
  }
}

export default function SubmitReview() {
  const actionResponse = useActionData();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const { user } = useLoaderData();

  const handleStarClick = starRating => {
    setRating(starRating);
  };

  const handleStarHover = starRating => {
    setHoverRating(starRating);
  };

  const handleStarLeave = () => {
    setHoverRating(0);
  };

  return (
    <FrontLayout>
      <div className="main-content">
        <section className="py-5">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-8">
                <div className="card shadow">
                  <div className="card-body p-5">
                    <h2 className="card-title text-center mb-4">Submit a Review</h2>
                    <p className="text-muted text-center mb-4">Share your experience with us! Your review will be published after admin approval.</p>

                    {actionResponse && <DisplayActionResponse actionResponse={actionResponse} />}

                    {actionResponse?.status !== 'SUCCESS' && (
                      <Form method="post">
                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <label htmlFor="name" className="form-label">
                              Your Name <span className="text-danger">*</span>
                            </label>
                            <input type="text" className="form-control" id="name" name="name" required placeholder="Enter your full name" />
                          </div>
                          <div className="col-md-6 mb-3">
                            <label htmlFor="email" className="form-label">
                              Email Address <span className="text-danger">*</span>
                            </label>
                            <input type="email" className="form-control" id="email" name="email" required placeholder="Enter your email" />
                          </div>
                        </div>

                        <div className="mb-4">
                          <label className="form-label">
                            Rating <span className="text-danger">*</span>
                          </label>
                          <div className="d-flex align-items-center">
                            <div className="star-rating me-3">
                              {[1, 2, 3, 4, 5].map(star => (
                                <span
                                  key={star}
                                  className={`star ${star <= (hoverRating || rating) ? 'active' : ''}`}
                                  style={{
                                    fontSize: '28px',
                                    cursor: 'pointer',
                                    color: star <= (hoverRating || rating) ? '#ffc107' : '#e4e5e9',
                                    marginRight: '8px',
                                    transition: 'color 0.2s',
                                  }}
                                  onClick={() => handleStarClick(star)}
                                  onMouseEnter={() => handleStarHover(star)}
                                  onMouseLeave={handleStarLeave}>
                                  ★
                                </span>
                              ))}
                            </div>
                            <span className="text-muted">
                              ({rating} star{rating !== 1 ? 's' : ''})
                            </span>
                          </div>
                          <input type="hidden" name="rating" value={rating} />
                        </div>

                        <div className="mb-4">
                          <label htmlFor="reviewText" className="form-label">
                            Your Review <span className="text-danger">*</span>
                          </label>
                          <textarea className="form-control" id="reviewText" name="reviewText" rows="5" required placeholder="Tell us about your experience..." />
                        </div>

                        <div className="text-center">
                          <button type="submit" className="btn btn-primary btn-lg px-5">
                            Submit Review
                          </button>
                        </div>
                      </Form>
                    )}

                    {actionResponse?.status === 'SUCCESS' && (
                      <div className="text-center">
                        <div className="mb-3">
                          <i className="fas fa-check-circle text-success" style={{ fontSize: '48px' }}></i>
                        </div>
                        <a href="/" className="btn btn-primary">
                          Back to Home
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </FrontLayout>
  );
}
