import { useLoaderData, useActionData } from "@remix-run/react";
import { redirect, json } from "@remix-run/node";
import FormView from "./Form";
import DisplayActionResponse from "~/components/ui/DisplayActionResponse";
import { getUserFromSession, requireUserSession } from "~/utils/auth.server";
import { ReviewModel } from "~/models/review";

export async function loader({ request, params }) {
  await requireUserSession(request);
  const { id } = params;
  if (!id) throw new Error("Id not found");

  const data = await ReviewModel.findById(id).lean();
  if (!data) throw new Error("Review not found");

  return { data };
}

export async function action({ request, params }) {
  const user = await getUserFromSession(request);
  if (!user) return redirect('/login');

  const formData = await request.formData();
  const { _id, name, email, rating, reviewText, isPublished } = Object.fromEntries(formData);
  
  if (!_id) return json({ messages: ["Review not found"], status: "ERROR" });

  // Validation
  if (!name) return json({ messages: ["Name is required."], status: "ERROR" });
  if (!email) return json({ messages: ["Email is required."], status: "ERROR" });
  if (!rating) return json({ messages: ["Rating is required."], status: "ERROR" });
  if (!reviewText) return json({ messages: ["Review text is required."], status: "ERROR" });

  // Validate rating
  const ratingNum = parseInt(rating);
  if (ratingNum < 1 || ratingNum > 5) {
    return json({ messages: ["Rating must be between 1 and 5 stars."], status: "ERROR" });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return json({ messages: ["Please enter a valid email address."], status: "ERROR" });
  }

  // Update data
  try {
    await ReviewModel.findByIdAndUpdate(_id, {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      rating: ratingNum,
      reviewText: reviewText.trim(),
      isPublished: isPublished === 'on',
      updatedBy: user._id
    });
    return redirect('/portal/reviews');
  } catch (error) {
    console.error('Error updating review:', error);
    return json({ messages: ["An error occurred while updating the review."], status: "ERROR" });
  }
}

export default function EditReview() {
  const { data } = useLoaderData();
  const actionResponse = useActionData();

  return (
    <div className="container-fluid">
      {/* Page header */}
      <div className="row">
        <div className="col-lg-12">
          <div className="mb-5">
            <h3 className="mb-0 text-white">Update Review</h3>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="row">
        <div className="col-lg-12">
          <div className="card mb-4">
            <div className="card-body">
              {actionResponse?.status === "ERROR" && (
                <DisplayActionResponse actionResponse={actionResponse} />
              )}
              <FormView />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}