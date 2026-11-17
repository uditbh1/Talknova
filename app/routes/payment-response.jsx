/* =============================================================
   app/routes/payment-response.jsx
   Single route that handles both success & cancel returns
   from Stripe Checkout and updates your DB.
   =============================================================*/

import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { addDays } from "date-fns";
import { randomBytes } from "crypto";

import FrontLayout from "~/components/FrontLayout";
import { retrieveCheckoutSession } from "~/utils/stripe.server";
import { Transaction } from "~/models/transaction";
import { PlanModel } from "~/models/plan";
import { assignPlan, assignFreePlanToUser, getCurrentPlan } from "~/utils/plans";
import { User } from "~/models/user";
import { ForgotPassword } from "~/models/forgotpassword.server";
import { getSessionStorage } from "~/utils/auth.server";
import { frontendLinks } from "~/utils/frontend-links";

/* ---------- links (frontend CSS) ---------- */
export const links = frontendLinks;

/* ---------- loader ---------- */
export async function loader({ request }) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  const canceled = url.searchParams.get("canceled");
  // Note: We get user from transaction later, not from session here

  /* customer clicked "Cancel" in Checkout */
  if (canceled) {
    // Try to find transaction by session_id if available
    const canceledSessionId = url.searchParams.get("session_id");
    if (canceledSessionId) {
      try {
        const canceledSession = await retrieveCheckoutSession(
          canceledSessionId
        );
        const txId = canceledSession.client_reference_id;
        const tx = await Transaction.findById(txId);
        if (tx && tx.status === "PENDING") {
          tx.status = "CANCELED";
          await tx.save();

          // Assign FREE plan to user
          try {
            await assignFreePlanToUser(tx.user, tx.user);
            console.log(
              "FREE plan assigned after payment cancellation for user:",
              tx.user
            );
          } catch (planErr) {
            console.error(
              "Failed to assign FREE plan after cancellation:",
              planErr
            );
          }
        }
      } catch (err) {
        console.error("Error handling canceled payment:", err);
      }
    }
    return json({
      status: "CANCELED",
      message: "Payment canceled by user",
    });
  }

  /* must have session_id on success */
  if (!sessionId) {
    return json({
      status: "ERROR",
      message: "No session_id parameter found",
    });
  }

  /* 1. fetch the Checkout Session from Stripe */
  let session;
  try {
    session = await retrieveCheckoutSession(sessionId);
  } catch (err) {
    console.error("Stripe fetch error:", err);
    return json({ status: "ERROR", message: "Unable to retrieve session" });
  }

  console.log("Stripe session:", session);

  /* 2. reconcile with your Transaction */
  const txId = session.client_reference_id;
  const tx = await Transaction.findById(txId);
  if (!tx) {
    return json({ status: "ERROR", message: "Transaction not found" });
  }

  const paid = session.payment_status === "paid";
  const displayStatus = paid ? "OK" : "FAILED";

  // Get user for email verification check
  const txUser = await User.findById(tx.user);

  // Variables to track user type and plan details (scoped outside if blocks)
  let isLikelyNewSignup = false;
  let currentPlanDetails = null;
  let plan = null;

  /* 3. Payment SUCCESS => mark OK & assign plan, do NOT auto-verify email */
  if (paid && tx.status !== "OK") {
    const subId =
      typeof session.subscription === "string"
        ? session.subscription // already an id
        : session.subscription?.id; // object → id

    tx.status = "OK"; // Mark as paid
    tx.stripeSessionId = session.id;
    tx.stripeSubscriptionId = subId;
    tx.period = tx.period || "monthly";
    await tx.save();

    // Assign the purchased plan (STARTER/BUSINESS)
    if (tx.plan) {
      plan = await PlanModel.findById(tx.plan);
      if (plan) {
        const expiryDate =
          tx.period === "yearly"
            ? addDays(new Date(), 365)
            : addDays(new Date(), 30);

        const assignedPlan = await assignPlan({
          clientId: tx.user,
          planId: plan._id,
          startDate: new Date(),
          expiryDate,
          addedVia: "SYSTEM",
          addedBy: tx.user,
          transactionId: tx._id,
          period: tx.period,
          notes: `Plan purchased via Stripe (session ${session.id})`,
        });

        // Get the current plan details for email
        currentPlanDetails = await getCurrentPlan(tx.user);

        // For new signups from buy-plan-reg, generate and assign temporary password
        // Check if user came from buy-plan-reg flow (marked with fromBuyPlanReg flag)
        // This is the most reliable way to distinguish:
        // - New users who signed up via "New Account? Sign Up" in buy-plan-reg (fromBuyPlanReg = true) -> should get password
        // - Existing users who logged in via "Already have an account? Log In" (fromBuyPlanReg = false/undefined) -> should NOT get password
        // Note: We need to check the flag BEFORE any modifications to ensure accurate detection
        const userFromBuyPlanReg = txUser.fromBuyPlanReg === true;
        isLikelyNewSignup = userFromBuyPlanReg;
        console.log("Payment response - User ID:", txUser._id, "fromBuyPlanReg flag:", txUser.fromBuyPlanReg, "isLikelyNewSignup:", isLikelyNewSignup);
        
        let temporaryPassword = null;
        
        if (isLikelyNewSignup) {
          // Generate temporary password for new signups from buy-plan-reg
          temporaryPassword = `${randomBytes(8).toString('hex')}A1!`;
          console.log("Generating temporary password for new user from buy-plan-reg:", txUser._id);
          
          // Update user's password in database (will be hashed by model pre-save hook)
          txUser.password = temporaryPassword;
          // Clear the fromBuyPlanReg flag after password is assigned (so it doesn't affect future payments)
          txUser.fromBuyPlanReg = false;
          await txUser.save();
          console.log("Temporary password assigned and saved for new user:", txUser._id);
        } else {
          console.log("Existing user - no temporary password will be generated");
          // Clear the flag for existing users as well (in case it was somehow set)
          if (txUser.fromBuyPlanReg) {
            txUser.fromBuyPlanReg = false;
            await txUser.save();
          }
        }

        // Send invoice email after payment (always send invoice email)
        if (txUser && txUser.emailVerified) {
          try {
            // Import email functions dynamically (server-only)
            const { sendInvoiceEmail } = await import("~/utils/email.server");
            // Always send invoice email after payment
            // For new signups, include temporary password in the invoice email
            // For existing users, no password included
            await sendInvoiceEmail(txUser, plan, tx, currentPlanDetails, temporaryPassword);
            console.log("Invoice email sent to:", txUser.email);
          } catch (emailErr) {
            console.error("Failed to send invoice email:", emailErr);
            // Don't fail payment if email fails
          }
        }

        // For new users: They're already logged in from verification, but we need to log them out
        // so they can use their new temporary password to log in
        // For existing users: They're already logged in, so they'll see the thank you page and can click "Go to Dashboard"
        if (isLikelyNewSignup && txUser && txUser.emailVerified) {
          // Log out the new user so they can log in with their new temporary password
          // This ensures they see the thank you page and can log in with their credentials
          console.log("Logging out new user so they can log in with temporary password:", txUser._id);
          // We'll destroy the session in the response by not auto-logging them in
          // The session will be cleared when they're redirected to the thank you page
        }
        // Existing users: Don't redirect - let them see the thank you page
        // They're already logged in from when they accessed the payment page, so they can click "Go to Dashboard"
      }
    }

    // If email not verified, send verification email again
    if (txUser && !txUser.emailVerified) {
      try {
        // Import email functions dynamically (server-only)
        const { sendEmailVerificationEmail } = await import("~/utils/email.server");
        // Generate new verification token
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await ForgotPassword.deleteMany({ user_id: txUser._id });
        await ForgotPassword.create({
          user_id: txUser._id,
          token,
          exp_date: expiresAt,
        });

        const baseUrl = process.env.SITE_URL || "https://talknova.ai/";
        const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
        const verificationLink = `${normalizedBase}verify-email/${token}`;

        await sendEmailVerificationEmail(txUser, verificationLink);
        console.log("Verification email resent to:", txUser.email);
      } catch (emailErr) {
        console.error("Failed to resend verification email:", emailErr);
      }
    }
  }

  /* 4. Payment FAILED/CANCELED => assign FREE plan, keep email_verified = false */
  if (!paid && tx.status === "PENDING") {
    tx.status = "FAILED";
    await tx.save();

    // Assign FREE plan to user
    try {
      await assignFreePlanToUser(tx.user, tx.user);
      console.log(
        "FREE plan assigned after payment failure for user:",
        tx.user
      );
    } catch (planErr) {
      console.error(
        "Failed to assign FREE plan after payment failure:",
        planErr
      );
    }
  }

  // For new users: Show thank you page (will redirect to login from component)
  // For failed payments: Show error page
  // If this is a new user from buy-plan-reg, we need to log them out so they can log in with their new password
  let responseHeaders = {};
  if (isLikelyNewSignup && paid && txUser && txUser.emailVerified) {
    // Log out the new user by destroying their session
    // They'll need to log in with their new temporary password
    try {
      const sessionStorage = await getSessionStorage();
      const session = await sessionStorage.getSession(request.headers.get("Cookie"));
      // Clear all session data
      session.unset("user");
      session.unset("showWelcomePopup");
      // Destroy the session and get the cookie header
      const setCookieHeader = await sessionStorage.destroySession(session);
      responseHeaders['Set-Cookie'] = setCookieHeader;
      console.log("Logged out new user after payment so they can log in with temporary password:", txUser._id);
    } catch (logoutError) {
      console.error("Error logging out new user:", logoutError);
      // Continue even if logout fails - the thank you page will still show
    }
  }
  
  return json({
    status: displayStatus,
    vendorTxCode: tx.vendorTxCode,
    amount: tx.amount.toFixed(2),
    period: tx.period,
    message: paid ? "Payment successful" : "Payment failed",
    emailVerified: txUser?.emailVerified || false,
    isNewUser: isLikelyNewSignup || false,
    plan: paid && plan ? plan.toObject() : null,
    planDetails: paid ? currentPlanDetails : null,
  }, Object.keys(responseHeaders).length > 0 ? { headers: responseHeaders } : {});
}

/* ---------- UI component ---------- */
export default function PaymentResponse() {
  const data = useLoaderData();
  const isSuccess = data.status === "OK";
  const isNewUser = data.isNewUser || false;

  return (
    <FrontLayout>
      <div className="container mt-5 mb-5">
        <div className="row justify-content-center">
          <div className="col-md-8 mt-5 mb-5">
            <div className="card shadow-sm">
              <div className="card-body">
                {isSuccess ? (
                  <>
                    <div className="alert alert-success text-center">
                      <h4 className="mb-2">Thank you for your payment!</h4>
                      <p className="mb-0">Here are your plan details:</p>
                    </div>

                    {data.plan && (
                      <div className="mb-4">
                        <h5 className="mb-3">Plan Summary</h5>
                        <table className="table table-bordered">
                          <tbody>
                            <tr>
                              <td><strong>Plan Name</strong></td>
                              <td>{data.plan.name}</td>
                            </tr>
                            <tr>
                              <td><strong>Billing Period</strong></td>
                              <td>{data.period === "yearly" ? "Yearly" : "Monthly"}</td>
                            </tr>
                            {data.planDetails && (
                              <>
                                {data.planDetails.expiryDate && (
                                  <tr>
                                    <td><strong>Expiry Date</strong></td>
                                    <td>
                                      {new Date(data.planDetails.expiryDate).toLocaleDateString("en-GB", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                      })}
                                    </td>
                                  </tr>
                                )}
                              </>
                            )}
                            <tr>
                              <td><strong>Transaction Reference</strong></td>
                              <td>{data.vendorTxCode || "N/A"}</td>
                            </tr>
                            <tr>
                              <td><strong>Amount Paid</strong></td>
                              <td>£{data.amount || "0.00"}</td>
                            </tr>
                            {data.plan.maxDocuments && (
                              <tr>
                                <td><strong>Document Uploads</strong></td>
                                <td>
                                  {data.period === "yearly" ? data.plan.maxDocuments * 2 : data.plan.maxDocuments}
                                  {data.period === "yearly" && " (2x bonus)"}
                                </td>
                              </tr>
                            )}
                            {data.plan.maxFileSize && (
                              <tr>
                                <td><strong>Total File Size</strong></td>
                                <td>
                                  {data.period === "yearly" ? data.plan.maxFileSize * 2 : data.plan.maxFileSize} MB
                                  {data.period === "yearly" && " (2x bonus)"}
                                </td>
                              </tr>
                            )}
                            {data.plan.maxUrls && (
                              <tr>
                                <td><strong>Website URLs</strong></td>
                                <td>
                                  {data.period === "yearly" ? data.plan.maxUrls * 2 : data.plan.maxUrls}
                                  {data.period === "yearly" && " (2x bonus)"}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="text-center mt-4">
                      {isNewUser ? (
                        <>
                          <p className="mb-3">
                            Check your email for your login credentials and invoice.
                          </p>
                          <Link to="/login" className="btn btn-primary btn-lg">
                            Log In
                          </Link>
                        </>
                      ) : (
                        <>
                          <p className="mb-3">
                            An invoice has been sent to your email.
                          </p>
                          <Link to="/portal" className="btn btn-primary btn-lg">
                            Go to Dashboard
                          </Link>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="alert alert-danger text-center">
                      <h4 className="mb-2">Payment failed</h4>
                      <p className="mb-0">{data.message || "Please try again."}</p>
                    </div>
                    <table className="table table-striped table-bordered mt-4">
                      <tbody>
                        <tr>
                          <td>Transaction Reference</td>
                          <td>{data.vendorTxCode || "N/A"}</td>
                        </tr>
                        <tr>
                          <td>Status</td>
                          <td>{data.status}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="text-center mt-4">
                      <Link to="/login" className="btn btn-primary">
                        Go to Login
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </FrontLayout>
  );
}
