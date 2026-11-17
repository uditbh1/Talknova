import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useEffect } from "react";
import FrontLayout from "~/components/FrontLayout";
import { ForgotPassword } from "~/models/forgotpassword.server";
import { User } from "~/models/user";
import { getUserFromSession, createUserSession } from "~/utils/auth.server";
import { sendVerificationConfirmationEmail } from "~/utils/email.server";
import { getCurrentPlan, assignFreePlanToUser } from "~/utils/plans";
import { frontendLinks } from "~/utils/frontend-links";

export const links = frontendLinks;

export async function loader({ request, params }) {
  // Check if user is already logged in
  const user = await getUserFromSession(request);
  if (user) return redirect("/portal");

  const { token } = params;

  if (!token) {
    return json({
      status: "ERROR",
      message: "Missing verification token.",
    });
  }

  // Find the verification record
  const record = await ForgotPassword.findOne({ token }).populate("user_id");

  console.log("Verification attempt:", {
    token: token.substring(0, 10) + "...",
    recordFound: !!record,
    recordId: record?._id,
    userId: record?.user_id?._id || record?.user_id,
    expDate: record?.exp_date,
    now: new Date(),
    isExpired: record?.exp_date ? record.exp_date < new Date() : null,
  });

  if (!record) {
    console.error(
      "Verification token not found in database:",
      token.substring(0, 10) + "..."
    );
    return json({
      status: "ERROR",
      message:
        "This verification link is invalid or has already been used. The token was not found in the database.",
    });
  }

  // Check if token has expired
  if (record.exp_date && record.exp_date < new Date()) {
    console.error("Verification token expired:", {
      token: token.substring(0, 10) + "...",
      expDate: record.exp_date,
      now: new Date(),
      diffHours: (new Date() - record.exp_date) / (1000 * 60 * 60),
    });
    await ForgotPassword.deleteOne({ _id: record._id });
    return json({
      status: "ERROR",
      message: `This verification link has expired. It expired on ${record.exp_date.toLocaleString()}. Please request a new verification email.`,
    });
  }

  // Verify the email
  const userToVerify = await User.findById(record.user_id);

  if (!userToVerify) {
    return json({
      status: "ERROR",
      message: "User account not found.",
    });
  }

  // If already verified, just redirect
  if (userToVerify.emailVerified) {
    // Clean up the token
    await ForgotPassword.deleteMany({ user_id: userToVerify._id });
    return json({
      status: "ALREADY_VERIFIED",
      message: "Your email has already been verified.",
    });
  }

  // Verify the email and activate the account
  userToVerify.emailVerified = true;
  userToVerify.status = true; // Activate the account
  await userToVerify.save();

  console.log("Email verified successfully:", {
    userId: userToVerify._id,
    email: userToVerify.email,
    emailVerified: userToVerify.emailVerified,
    status: userToVerify.status,
  });

  // Check if there's a pending plan (from buy-plan-reg signup flow)
  const pendingPlanId = record.pendingPlanId;
  const pendingPlanPeriod = record.pendingPlanPeriod || "monthly";

  // Retrieve temporary password from record BEFORE deleting it
  const temporaryPassword = record.temporaryPassword || null;

  // If there's a pending plan (from buy-plan-reg), DON'T assign plan yet - user needs to fill billing details first
  // Plan will be assigned after payment, password will be sent after payment
  if (pendingPlanId) {
    // Send simple verification confirmation email (no password, no plan details yet)
    // isPaymentComplete = false because this is email verification, not payment completion
    // hideLoginButton = true because user can't login until they pay and get temporary password
    try {
      await sendVerificationConfirmationEmail(
        userToVerify,
        null,
        null,
        false,
        true
      ); // No plan, no password yet, hide login button
      console.log(
        "Verification confirmation email sent to buy-plan-reg user (no login button):",
        userToVerify.email
      );
    } catch (emailError) {
      console.error(
        "Failed to send verification confirmation email:",
        emailError
      );
      // Don't fail verification if email fails
    }

    // Clean up the verification token
    await ForgotPassword.deleteMany({ user_id: userToVerify._id });

    // Format user object for session
    const userObj = userToVerify.toObject();
    userObj.fullName = `${userObj.firstName} ${userObj.lastName}`;
    userObj.initials = `${userObj.firstName.charAt(0)}${userObj.lastName.charAt(
      0
    )}`;
    delete userObj.password;
    const redirectUrl = `/buy-plan?plan=${pendingPlanId}&period=${pendingPlanPeriod}&fromVerification=true`;
    return createUserSession(userObj, redirectUrl);
  }

  // For free trial signup flow, get plan details and send password
  // Get user's plan details for the confirmation email
  const currentPlan = await getCurrentPlan(userToVerify._id);

  // Send confirmation email with plan details and temporary password (for free trial)
  // isPaymentComplete = false because this is email verification, not payment completion
  try {
    await sendVerificationConfirmationEmail(
      userToVerify,
      currentPlan,
      temporaryPassword,
      false
    );
    console.log(
      "Verification confirmation email with password sent to:",
      userToVerify.email
    );
  } catch (emailError) {
    console.error(
      "Failed to send verification confirmation email:",
      emailError
    );
    // Don't fail verification if email fails
  }

  // Clean up the verification token
  await ForgotPassword.deleteMany({ user_id: userToVerify._id });

  // For free trial signup flow, redirect to login page (don't auto-login)
  // User will receive password in email and can log in manually
  return redirect("/login?verified=true");
}

export default function VerifyEmailPage() {
  const data = useLoaderData();

  // If successful, this should redirect, but handle edge cases
  if (data.status === "ALREADY_VERIFIED") {
    return (
      <FrontLayout>
        <section className="contact-container">
          <div className="container">
            <div className="row d-grid d-flex justify-content-center">
              <div className="col-lg-6 col-md-8">
                <div className="card shadow-sm">
                  <div className="card-body p-4 text-center">
                    <div className="text-success mb-3">
                      <i className="fas fa-check-circle fa-3x"></i>
                    </div>
                    <h3 className="text-success mb-3">
                      Email Already Verified
                    </h3>
                    <p className="text-muted mb-0">{data.message}</p>
                    <div className="mt-4">
                      <Link to="/login" className="document-btn">
                        Go to Login
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </FrontLayout>
    );
  }

  if (data.status === "ERROR") {
    return (
      <FrontLayout>
        <section className="contact-container">
          <div className="container">
            <div className="row d-grid d-flex justify-content-center">
              <div className="col-lg-6 col-md-8">
                <div className="card shadow-sm">
                  <div className="card-body p-4 text-center">
                    <div className="text-danger mb-3">
                      <i className="fas fa-times-circle fa-3x"></i>
                    </div>
                    <h3 className="text-danger mb-3">Verification Failed</h3>
                    <p className="text-muted mb-0">{data.message}</p>
                    <div className="mt-4">
                      <Link to="/login" className="document-btn">
                        Go to Login
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </FrontLayout>
    );
  }

  if (data.status === "SUCCESS") {
    return (
      <FrontLayout>
        <section className="contact-container">
          <div className="container">
            <div className="row d-grid d-flex justify-content-center">
              <div className="col-lg-6 col-md-8">
                <div className="card shadow-sm">
                  <div className="card-body p-4 text-center">
                    <div className="text-success mb-3">
                      <i className="fas fa-check-circle fa-3x"></i>
                    </div>
                    <h3 className="text-success mb-3">Email Verified</h3>
                    <p className="text-muted mb-0">
                      Your account has been activated.
                    </p>
                    <div className="mt-4">
                      <Link to="/login" className="document-btn">
                        Go to Login
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </FrontLayout>
    );
  }

  // This shouldn't render if successful, but just in case
  return (
    <FrontLayout>
      <section className="contact-container">
        <div className="container">
          <div className="row d-grid d-flex justify-content-center">
            <div className="col-lg-6 col-md-8">
              <div className="card shadow-sm">
                <div className="card-body p-4 text-center">
                  <div
                    className="spinner-border text-primary mb-3"
                    role="status"
                  >
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="text-muted">Verifying your email...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </FrontLayout>
  );
}
