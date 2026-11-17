import { useActionData, Form, Link } from "@remix-run/react";
import { json, redirect } from "@remix-run/node";
import { randomBytes } from "crypto";
import { User } from "~/models/user";
import { ForgotPassword } from "~/models/forgotpassword.server";
import FrontLayout from "~/components/FrontLayout";
import { getUserFromSession } from "~/utils/auth.server";
import { sendWelcomeEmail } from "~/utils/email.server";
import { assignFreePlanToUser } from "~/utils/plans";
import { frontendLinks } from "~/utils/frontend-links";

export const links = frontendLinks;

export async function loader({ request }) {
  let user = await getUserFromSession(request);

  if (user) return redirect("/");

  return json({ user });
}

export async function action({ request }) {
  try {
    const formData = await request.formData();
    const { title, firstName, lastName, email, company, phone } =
      Object.fromEntries(formData);

    // Basic validation
    if (!email || !firstName || !lastName) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    // Generate a unique temporary password
    const temporaryPassword = `${randomBytes(8).toString("hex")}A1!`;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return json({ error: "User already exists" }, { status: 400 });
    }

    // Create user in MongoDB database
    // User.create() automatically saves to MongoDB
    let newUser;
    try {
      newUser = await User.create({
        title: title || "Mr",
        firstName,
        roles: ["CLIENT"],
        lastName,
        email: email.toLowerCase().trim(),
        password: temporaryPassword, // Use auto-generated temporary password; hashing handled in model pre-save hook
        company: company || "",
        phone: phone || "",
        emailVerified: false,
        status: false, // Will be activated after email verification
      });

      // Verify the user was saved successfully
      if (!newUser || !newUser._id) {
        console.error("User creation failed: User object not returned");
        return json(
          { error: "Failed to create account. Please try again." },
          { status: 500 }
        );
      }

      console.log("User created successfully in MongoDB:", {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
      });
    } catch (dbError) {
      console.error("Database error while creating user:", dbError);

      // Handle duplicate email error (unique constraint)
      if (dbError.code === 11000 || dbError.name === "MongoServerError") {
        return json(
          { error: "An account with this email already exists" },
          { status: 400 }
        );
      }

      // Handle validation errors
      if (dbError.name === "ValidationError") {
        const errors = Object.values(dbError.errors).map((err) => err.message);
        return json({ error: errors.join(", ") }, { status: 400 });
      }

      return json(
        { error: "Failed to create account. Please try again later." },
        { status: 500 }
      );
    }

    // Generate email verification token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Delete any existing verification tokens for this user
    await ForgotPassword.deleteMany({ user_id: newUser._id });

    // Create verification token record in MongoDB
    // Store temporary password temporarily so we can send it after verification
    try {
      await ForgotPassword.create({
        user_id: newUser._id,
        token,
        exp_date: expiresAt,
        temporaryPassword: temporaryPassword, // Store temporarily for post-verification email
      });
      console.log("Verification token created for user:", newUser._id);
    } catch (tokenError) {
      console.error("Failed to create verification token:", tokenError);
      // Continue even if token creation fails - user can request a new one
    }

    // Build verification link - prioritize local development
    // Use request origin for localhost, otherwise use SITE_URL
    const url = new URL(request.url);
    let baseUrl;

    // If running on localhost, always use localhost (even if SITE_URL is set)
    if (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.includes("localhost")
    ) {
      baseUrl = `${url.protocol}//${url.host}`;
    } else {
      // For production or other domains, use SITE_URL if set, otherwise use request origin
      baseUrl = process.env.SITE_URL || `${url.protocol}//${url.host}`;
    }

    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const verificationLink = `${normalizedBase}verify-email/${token}`;

    console.log("Verification link generated:", {
      requestUrl: request.url,
      requestHost: url.host,
      baseUrl,
      verificationLink,
      token: token.substring(0, 10) + "...",
    });

    // Send verification email WITHOUT temporary password
    // Password will be sent after email verification
    try {
      await sendWelcomeEmail(newUser, null, verificationLink); // Pass null for password
      console.log("Verification email sent to:", newUser.email);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Don't fail registration if email fails - user is already saved
    }

    // Automatically assign FREE plan for free trial
    // Assign FREE plan to new user
    try {
      await assignFreePlanToUser(newUser._id, newUser._id);
    } catch (planError) {
      console.error("Failed to assign free plan:", planError);
      console.error("Plan assignment error details:", {
        message: planError.message,
        stack: planError.stack,
        name: planError.name,
      });
      // Don't fail registration if plan assignment fails - user is already saved
    }

    return json({
      success: true,
      message: "Verification is sent. Please verify before logging in.",
    });
  } catch (error) {
    console.error("Unexpected error in signup action:", error);
    return json(
      {
        error: "An unexpected error occurred. Please try again later.",
      },
      { status: 500 }
    );
  }
}

export default function Signup() {
  const actionData = useActionData();

  return (
    <FrontLayout>
      <div className="contact-container">
        <div className="container">
          <div className="row d-grid d-flex justify-content-center">
            <div className="col-lg-8 col-md-12 col-sm-12 col-xs-12">
              <h3 className="mb-4">Start Your Free Trial</h3>
              {actionData?.error && (
                <div className="alert alert-danger" role="alert">
                  {actionData.error}
                </div>
              )}
              {actionData?.success && (
                <div className="alert alert-success" role="alert">
                  <p className="mb-2">{actionData.message}</p>
                  <p className="mb-0">
                    Check your email (including spam folder) and click the
                    verification link.
                  </p>
                </div>
              )}
              {!actionData?.success && (
                <div className="card bg-white">
                  <div className="card-body text-dark">
                    <div className="alert alert-info mb-3">
                      <strong>Free Trial:</strong> Start with our FREE plan - no
                      credit card required! You'll get 30 days to explore all
                      features.
                    </div>
                    <Form method="post" className="text-start">
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label htmlFor="title">Title</label>
                          <select
                            className="form-select"
                            name="title"
                            id="title"
                          >
                            <option value="Mr">Mr</option>
                            <option value="Mrs">Mrs</option>
                            <option value="Ms">Ms</option>
                            <option value="Dr">Dr</option>
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label htmlFor="firstName">First Name</label>
                          <input
                            type="text"
                            className="form-control"
                            name="firstName"
                            id="firstName"
                            required
                          />
                        </div>
                        <div className="col-md-6">
                          <label htmlFor="lastName">Last Name</label>
                          <input
                            type="text"
                            className="form-control"
                            name="lastName"
                            id="lastName"
                            required
                          />
                        </div>
                        <div className="col-md-6">
                          <label htmlFor="company">Company</label>
                          <input
                            type="text"
                            className="form-control"
                            name="company"
                            id="company"
                          />
                        </div>
                        <div className="col-md-4">
                          <label htmlFor="phone">Phone</label>
                          <input
                            type="text"
                            className="form-control"
                            name="phone"
                            id="phone"
                          />
                        </div>
                        <div className="col-md-6">
                          <label htmlFor="email">Email</label>
                          <input
                            type="email"
                            className="form-control"
                            name="email"
                            id="email"
                            required
                          />
                        </div>
                        <div className="d-grid gap-2">
                          <button type="submit" className="document-btn">
                            Start Free Trial
                          </button>
                        </div>
                      </div>
                    </Form>
                  </div>
                </div>
              )}
            </div>
          </div>
          {!actionData?.success && (
            <div className="document-block text-center mt-3">
              <p className="mb-0">
                Already have an account?{" "}
                <Link to="/login" className="">
                  Log In
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </FrontLayout>
  );
}
