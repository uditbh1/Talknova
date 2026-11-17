// 1) Use ESM imports instead of require
import nodemailer from "nodemailer";
//import moment from 'moment-timezone';
//import { hash, compare } from 'bcryptjs';

// Mongoose models (adjust import paths as needed)
import { EmailTemplate } from "~/models/emailtemplate.js";
import { MailHistory } from "~/models/mailhistory.js";
import { ForgotPassword } from "~/models/forgotpassword.server";

// Example: fallback definitions (remove if you have real imports)
const fromMail = "Talknova <no-reply@talknova.ai>";
const bcc = ["klaspaddeveloper@gmail.com"];

////////////////////////////////////////////////////////////////
// getUserMailHistory
////////////////////////////////////////////////////////////////
export async function getUserMailHistory(emailId) {
  try {
    return await MailHistory.find({ to: emailId })
      .populate("user")
      .populate("tplId")
      .lean();
  } catch (error) {
    console.error(error);
    return null;
  }
}

////////////////////////////////////////////////////////////////
// getTemplate
////////////////////////////////////////////////////////////////
export async function getTemplate(tpl_id) {
  try {
    return await EmailTemplate.findOne({ tpl_id }, (err, tpl) => tpl);
  } catch (error) {
    console.error(error);
    return null;
  }
}

////////////////////////////////////////////////////////////////
// getMailTransporter
// Uses environment variables for SMTP configuration
// Defaults to Mailtrap for development if SMTP_HOST is not set
////////////////////////////////////////////////////////////////
export async function getMailTransporter() {
  const isProduction = process.env.NODE_ENV === "production";

  // Production SMTP configuration (default for production)
  const productionSmtp = {
    host: "mail.talknova.ai",
    port: 465,
    secure: true,
    auth: {
      user: "no-reply@talknova.ai",
      pass: "arYME343s57",
    },
  };

  // Development SMTP configuration (Mailtrap for testing)
  const developmentSmtp = {
    host: "sandbox.smtp.mailtrap.io",
    port: 587,
    secure: false, // false for STARTTLS on port 587
    auth: {
      user: "278d5397ee8d06",
      pass: "9438e705342962",
    },
  };

  // Build SMTP config: environment variables override everything, otherwise use defaults based on environment
  const smtp = {
    host:
      process.env.SMTP_HOST ||
      (isProduction ? productionSmtp.host : developmentSmtp.host),
    port: parseInt(
      process.env.SMTP_PORT ||
        (isProduction ? productionSmtp.port : developmentSmtp.port),
      10
    ),
    secure:
      process.env.SMTP_SECURE === "true"
        ? true
        : process.env.SMTP_SECURE === "false"
        ? false
        : isProduction
        ? productionSmtp.secure
        : developmentSmtp.secure,
    debug: !isProduction,
    auth: {
      user:
        process.env.SMTP_USER ||
        (isProduction ? productionSmtp.auth.user : developmentSmtp.auth.user),
      pass:
        process.env.SMTP_PASS ||
        (isProduction ? productionSmtp.auth.pass : developmentSmtp.auth.pass),
    },
  };

  // Validate that we have all required SMTP config
  if (!smtp.host || !smtp.auth.user || !smtp.auth.pass) {
    throw new Error(
      "SMTP configuration is incomplete. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables."
    );
  }

  console.log("SMTP Configuration:", {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    user: smtp.auth.user,
    environment: process.env.NODE_ENV || "development",
    source: process.env.SMTP_HOST
      ? "environment variables"
      : isProduction
      ? "production defaults"
      : "development defaults (Mailtrap)",
  });

  return nodemailer.createTransport(smtp);
}

////////////////////////////////////////////////////////////////
// saveMail
////////////////////////////////////////////////////////////////
export async function saveMail(data) {
  try {
    // If you rely on session, ensure it's imported or properly defined
    if (session?.user_id) {
      data.user = session.user_id;
    }

    // Optional: store CC addresses if passed in
    data.cc = data.ccEmail || [];

    // Save to MailHistory
    await MailHistory.create(data);
  } catch (error) {
    console.error(error);
  }
}

////////////////////////////////////////////////////////////////
// sendForgotPasswordEmail
////////////////////////////////////////////////////////////////
export async function sendForgotPasswordEmail(data) {
  try {
    const tpl = await getTemplate("FORGOT_PASSWORD");
    const SITE_URL = process.env.SITE_URL;

    // Remove old requests
    await ForgotPassword.deleteMany({ user_id: data._id });

    // Create a new forgot password record
    const forgot_pass_model = new ForgotPassword();
    forgot_pass_model.user_id = data._id;
    forgot_pass_model.token =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    await forgot_pass_model.save();

    // Build reset link
    const resetLink = `${SITE_URL}forgot-password/${forgot_pass_model.token}`;

    let msg;
    let subject;

    if (!tpl) {
      // TEMPLATE NOT FOUND: fallback
      console.log("Email template not found, sending fallback email.");
      subject = "Reset Your Password";
      msg = `
        Hello ${data.user_fname || ""} ${data.user_lname || ""},<br><br>
        You requested to reset your password. Please click the link below to reset it:<br><br>
        <a href="${resetLink}">${resetLink}</a><br><br>
        If you did not request this reset, you can safely ignore this email.
      `;
    } else {
      // TEMPLATE FOUND
      msg = tpl.tpl_body;
      subject = tpl.tpl_subject;
      // Replace placeholders in your template
      msg = msg.replace("{{name}}", `${data.user_fname} ${data.user_lname}`);
      msg = msg.replace(
        "{{reset_link}}",
        `<a href="${resetLink}">${resetLink}</a>`
      );
    }

    const mailOptions = {
      from: fromMail,
      to: data.user_email,
      bcc: bcc,
      subject,
      html: msg,
    };

    // Send mail
    const transporter = await getMailTransporter();
    const eml_rep = await transporter.sendMail(mailOptions);

    console.log("eml_rep:", eml_rep);

    // Save a copy of the mail in database
    //await saveMail({ ...mailOptions, tplId: tpl?._id });

    if (!eml_rep) {
      return false;
    }

    console.log("Email sent to:", data.user_email);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

////////////////////////////////////////////////////////////////
// sendOfferLetterTemplate
////////////////////////////////////////////////////////////////
export async function sendOfferLetterTemplate(student) {
  try {
    // Implement your logic here...
    // For example:
    /*
    const tpl = await EmailTemplate.findOne({ tpl_id: 'OFFER_LETTER' })
      .where('campuses').in(student.campuses)
      .populate('campuses');
    
    if (!student || !tpl) return false;

    // Replace placeholders etc.
    ...
    await transporter.sendMail(mailOptions);
    await saveMail({ ...mailOptions, tplId: tpl._id });
    */
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

////////////////////////////////////////////////////////////////
// setPlaceholderReplacements (example, if used)
////////////////////////////////////////////////////////////////
export async function setPlaceholderReplacements(msg, student) {
  // ...
  return msg;
}

////////////////////////////////////////////////////////////////
// sendMagicLinkStudentEmail
////////////////////////////////////////////////////////////////
export async function sendMagicLinkStudentEmail(data) {
  try {
    // ...
    console.log("Email sent to:", data.user_email);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export async function testEmail(to, subject, message) {
  try {
    const mailOptions = {
      from: fromMail,
      to: to,
      bcc: bcc,
      subject,
      html: message,
    };

    const transporter = await getMailTransporter();
    const eml_rep = await transporter.sendMail(mailOptions);

    if (!eml_rep) {
      return false;
    }

    console.log("Email sent to:", to);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

/**
 * Send a test email using the provided template
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} body - Email body content (HTML)
 * @returns {Promise<boolean>} - Success status
 */
export async function sendTestEmail(to, subject, body) {
  try {
    if (!to || !subject || !body) {
      console.error("Missing required parameters for test email");
      return false;
    }

    // Get mail transporter
    const transporter = await getMailTransporter();

    // Add a test email prefix to subject for clarity
    const testSubject = `[TEST EMAIL] ${subject}`;

    // Add a note to the email body indicating it's a test
    const testBody = `
      <div style="background-color: #ffff99; padding: 10px; margin-bottom: 15px; border-left: 4px solid #ffcc00;">
        <strong>This is a test email sent from the Email Template Management system.</strong>
      </div>
      ${body}
      <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px; font-size: 12px; color: #666;">
        This is an automated test message. Please do not reply to this email.
      </div>
    `;

    // Email options
    const mailOptions = {
      from: fromMail,
      to: to,
      subject: testSubject,
      html: testBody,
    };

    // Send the email
    const result = await transporter.sendMail(mailOptions);

    if (!result) {
      console.error("Failed to send test email");
      return false;
    }

    console.log("Test email sent successfully to:", to);

    // Save in the mail history database (optional)
    try {
      await MailHistory.create({
        to: to,
        subject: testSubject,
        body: testBody,
        type: "TEST_EMAIL",
        status: "SENT",
      });
    } catch (err) {
      console.error("Error saving mail history:", err);
      // Continue even if saving history fails
    }

    return true;
  } catch (error) {
    console.error("Error sending test email:", error);
    return false;
  }
}

/**
 * Send the new credentials & embed code to a client user.
 *
 * Expects an EmailTemplate in DB with uniqueId: 'SEND_CHATBOT_CREDENTIALS',
 * or falls back to a built-in message if not found.
 *
 * Placeholders used in template body:
 *   {{CLIENT_NAME}}
 *   {{CLIENT_EMAIL}}
 *   {{PASSWORD}}
 *   {{LOGIN_URL}}
 *   {{AGENT_SNIPPET}}
 *   {{AGENT_NAME}}
 *
 * @param {Object} options
 * @param {Object} options.clientUser - The user object from DB
 * @param {Object} options.chatbot - The chatbot object from DB
 * @param {String} options.plainPassword - The new plain text password
 * @param {String} options.codeSnippet - The embed code snippet
 * @returns {Boolean} true if sent, false otherwise
 */
/**
 * Send templated email using the designer HTML template
 * @param {string} recipientEmail - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} contentHtml - HTML content to insert into {{content}} placeholder
 * @param {Object} placeholders - Optional object with additional placeholders to replace
 * @returns {Promise<boolean>} - Success status
 */
export async function sendTemplatedEmail(
  recipientEmail,
  subject,
  contentHtml,
  placeholders = {}
) {
  try {
    // Fetch the HTML template from the designer link
    const templateHtml = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>TalkNova</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4;">
              <tr>
                  <td align="center" style="padding: 20px 0;">
                      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                          <!-- Header -->
                          <tr>
                              <td align="center" style="padding: 30px 0 20px 0;">
                                  <img src="https://talknova.ai/logo.png" alt="TalkNova" style="max-width: 200px; height: auto;">
                              </td>
                          </tr>
                          <!-- Content -->
                          <tr>
                              <td style="padding: 0 40px 30px 40px;">
                                  {{content}}
                              </td>
                          </tr>
                          <!-- Footer -->
                          <tr>
                              <td style="padding: 20px 40px 30px 40px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
                                  <p>Best regards,<br>The TalkNova Team</p>
                                  <p>
                                      <a href="https://talknova.ai" style="color: #007bff; text-decoration: none;">Visit our website</a> | 
                                      <a href="mailto:support@talknova.ai" style="color: #007bff; text-decoration: none;">Contact Support</a>
                                  </p>
                                  <p style="font-size: 12px; color: #999;">
                                      TalkNova AI Solutions<br>
                                      This email was sent from an automated system. Please do not reply directly to this email.
                                  </p>
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
          </table>
      </body>
      </html>
    `;

    // Replace the main content placeholder
    let emailHtml = templateHtml.replace("{{content}}", contentHtml);

    // Replace any additional placeholders
    Object.keys(placeholders).forEach((key) => {
      const placeholder = `{{${key}}}`;
      emailHtml = emailHtml.replace(
        new RegExp(placeholder, "gi"),
        placeholders[key]
      );
    });

    // Send the email
    const transporter = await getMailTransporter();
    const mailOptions = {
      from: fromMail,
      to: recipientEmail,
      bcc: bcc,
      subject,
      html: emailHtml,
    };

    const result = await transporter.sendMail(mailOptions);

    if (!result) {
      console.error("Failed to send templated email");
      return false;
    }

    // Save to mail history
    try {
      await MailHistory.create({
        to: recipientEmail,
        subject,
        body: emailHtml,
        type: "TEMPLATED_EMAIL",
        status: "SENT",
      });
    } catch (err) {
      console.error("Error saving mail history:", err);
      // Continue even if saving history fails
    }

    console.log("Templated email sent successfully to:", recipientEmail);
    return true;
  } catch (error) {
    console.error("Error sending templated email:", error);
    return false;
  }
}

/**
 * Send welcome email after user registration
 * @param {Object} user - User object
 * @param {string} temporaryPassword - Optional temporary password if provided
 * @param {string} verificationLink - Optional email verification link
 * @returns {Promise<boolean>} - Success status
 */
export async function sendWelcomeEmail(
  user,
  temporaryPassword = null,
  verificationLink = null
) {
  try {
    const subject = "Verify Your Email - TalkNova";

    let contentHtml = `
      <h2 style="color: #333; margin-bottom: 20px;">Verify Your Email</h2>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Hello ${user.firstName || "there"},
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Please verify your email to continue.
      </p>
    `;

    if (verificationLink) {
      contentHtml += `
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <div style="text-align: center; margin: 15px 0;">
            <a href="${verificationLink}" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Verify Email
            </a>
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 15px; text-align: center;">
            Link expires in 24 hours.
          </p>
        </div>
      `;
    }

    // Only include password if explicitly provided (for other flows, not signup)
    if (temporaryPassword) {
      contentHtml += `
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Login Credentials</h3>
          <p style="margin: 10px 0;"><strong>Email:</strong> ${user.email}</p>
          <p style="margin: 10px 0;"><strong>Password:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px;">${temporaryPassword}</code></p>
        </div>
      `;
    }

    contentHtml += `
      <p style="font-size: 14px; line-height: 1.6; color: #666; margin-top: 20px;">
        Best regards,<br>
        The TalkNova Team
      </p>
    `;

    return await sendTemplatedEmail(user.email, subject, contentHtml);
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return false;
  }
}

/**
 * Send verification confirmation email after email verification
 * @param {Object} user - User object
 * @param {Object} currentPlan - Current plan object (optional)
 * @returns {Promise<boolean>} - Success status
 */
export async function sendVerificationConfirmationEmail(
  user,
  currentPlan = null,
  temporaryPassword = null,
  isPaymentComplete = false,
  hideLoginButton = false // New parameter: hide login button for buy-plan-reg users who haven't paid yet
) {
  try {
    // Determine subject and title based on context
    const subject = isPaymentComplete ? "Payment Complete - Your Login Details" : "Email Verified - Your Login Details";
    const title = isPaymentComplete ? "Payment Complete!" : "Email Verified";

    let contentHtml = `
      <h2 style="color: #28a745; margin-bottom: 20px;">${title}</h2>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Hello ${user.firstName || "there"},
      </p>
    `;

    // Include temporary password if provided (after payment)
    if (temporaryPassword) {
      contentHtml += `
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Login Credentials</h3>
          <p style="margin: 10px 0;"><strong>Email:</strong> ${user.email}</p>
          <p style="margin: 10px 0;"><strong>Password:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px;">${temporaryPassword}</code></p>
        </div>
      `;
    } else {
      if (hideLoginButton) {
        // For buy-plan-reg users: they need to complete payment before they can log in
        contentHtml += `
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Your email has been verified. Please complete your payment to activate your account and receive your login credentials.
          </p>
        `;
      } else {
        contentHtml += `
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Your email has been verified. Your account is now active.
          </p>
        `;
      }
    }

    if (currentPlan && currentPlan.planId) {
      const plan = currentPlan.planId;
      contentHtml += `
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Your Plan: ${plan.name}</h3>
          <p style="margin: 5px 0;">• ${plan.maxDocuments} Documents</p>
          <p style="margin: 5px 0;">• ${plan.maxFileSize}MB Max File Size</p>
          <p style="margin: 5px 0;">• ${plan.maxUrls} Web URLs</p>
        </div>
      `;
    }

    // Only show login button if not hidden (for buy-plan-reg users who haven't paid yet)
    if (!hideLoginButton) {
      contentHtml += `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${
            process.env.SITE_URL || "https://www.talknova.ai"
          }/login" style="display: inline-block; padding: 15px 35px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Log In
          </a>
        </div>
      `;
    }

    return await sendTemplatedEmail(user.email, subject, contentHtml);
  } catch (error) {
    console.error("Error sending verification confirmation email:", error);
    return false;
  }
}

/**
 * Send email notification after plan purchase with credentials
 * @param {Object} user - User object
 * @param {Object} plan - Plan object
 * @param {string} plainPassword - Generated password
 * @returns {Promise<boolean>} - Success status
 */
export async function sendPlanPurchaseEmail(user, plan, plainPassword) {
  try {
    const subject = `Welcome to TalkNova ${plan.name} Plan!`;

    const contentHtml = `
      <h2 style="color: #333; margin-bottom: 20px;">Welcome to TalkNova!</h2>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Hello ${user.firstName || "there"},
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Thank you for purchasing the <strong>${
          plan.name
        }</strong> plan! Your account has been created and is ready to use.
      </p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #333; margin-top: 0;">Your Login Credentials</h3>
        <p style="margin: 10px 0;"><strong>Email:</strong> ${user.email}</p>
        <p style="margin: 10px 0;"><strong>Password:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px;">${plainPassword}</code></p>
        <p style="font-size: 14px; color: #666; margin-top: 15px;">
          <strong>Important:</strong> Please save this password securely and consider changing it after your first login.
        </p>
      </div>

      <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #333; margin-top: 0;">Your ${
          plan.name
        } Plan Features</h3>
        <ul style="font-size: 16px; line-height: 1.8; color: #555; margin: 10px 0;">
          <li><strong>${plan.maxDocuments}</strong> document uploads</li>
          <li><strong>${plan.maxFileSize} MB</strong> total file size</li>
          <li><strong>${plan.maxUrls}</strong> website URLs</li>
          <li><strong>${plan.allowedAgents || 1}</strong> AI agent(s)</li>
        </ul>
      </div>

      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Get started by logging in at <a href="${
          process.env.SITE_URL
        }login" style="color: #007bff;">talknova.ai/login</a> and begin building your AI chatbot.
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        If you need any help getting started, our support team is here to assist you.
      </p>
    `;

    return await sendTemplatedEmail(user.email, subject, contentHtml);
  } catch (error) {
    console.error("Error sending plan purchase email:", error);
    return false;
  }
}

/**
 * Send plan expiry notification email
 * @param {Object} user - User document
 * @param {Object} expiredPlan - The expired plan object
 * @returns {Promise<boolean>} - Success status
 */
export async function sendPlanExpiredEmail(user, expiredPlan) {
  try {
    const subject = `Your TalkNova ${
      expiredPlan?.planId?.name || "Plan"
    } Has Expired`;
    const planName = expiredPlan?.planId?.name || "Your plan";
    const expiryDate = expiredPlan?.expiryDate
      ? new Date(expiredPlan.expiryDate).toLocaleDateString("en-GB", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "recently";

    const contentHtml = `
      <h2 style="color: #dc3545; margin-bottom: 20px;">⚠️ Plan Expired</h2>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Hello ${user.firstName || "there"},
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        We're writing to inform you that your <strong>${planName}</strong> subscription has expired on <strong>${expiryDate}</strong>.
      </p>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <h3 style="color: #856404; margin-top: 0;">⚠️ Service Access Revoked</h3>
        <p style="font-size: 16px; line-height: 1.6; color: #856404; margin: 10px 0;">
          As a result of your plan expiration, the following services have been temporarily disabled:
        </p>
        <ul style="font-size: 16px; line-height: 1.8; color: #856404; margin: 10px 0;">
          <li>All AI chatbots and agents</li>
          <li>Document uploads and processing</li>
          <li>Website URL crawling</li>
          <li>Chatbot interactions</li>
        </ul>
      </div>

      <div style="background-color: #d1ecf1; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #0c5460; margin-top: 0;">🔄 Renew Your Subscription</h3>
        <p style="font-size: 16px; line-height: 1.6; color: #0c5460; margin: 10px 0;">
          To restore access to all services, please renew your subscription or upgrade to a new plan.
        </p>
        <p style="margin: 20px 0;">
          <a href="${process.env.SITE_URL || "https://www.talknova.ai"}/portal" 
             style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            View Plans & Renew
          </a>
        </p>
      </div>

      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        If you have any questions or need assistance, please don't hesitate to contact our support team.
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Thank you for using TalkNova!
      </p>
    `;

    return await sendTemplatedEmail(user.email, subject, contentHtml);
  } catch (error) {
    console.error("Error sending plan expired email:", error);
    return false;
  }
}

/**
 * Send invoice email with plan details after successful payment
 * @param {Object} user - User document
 * @param {Object} plan - Plan document
 * @param {Object} transaction - Transaction document
 * @param {Object} currentPlan - Current user plan assignment
 * @param {string} temporaryPassword - Temporary password (optional, for new signups)
 * @returns {Promise<boolean>} - Success status
 */
export async function sendInvoiceEmail(user, plan, transaction, currentPlan, temporaryPassword = null) {
  try {
    const subject = `Invoice for ${plan.name} Plan - ${transaction.vendorTxCode}`;
    
    const expiryDate = currentPlan?.expiryDate
      ? new Date(currentPlan.expiryDate).toLocaleDateString("en-GB", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "N/A";

    const startDate = currentPlan?.startDate
      ? new Date(currentPlan.startDate).toLocaleDateString("en-GB", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : new Date().toLocaleDateString("en-GB", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

    const contentHtml = `
      <h2 style="color: #333; margin-bottom: 20px;">Invoice - Payment Confirmed</h2>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Hello ${user.firstName || "there"},
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Thank you for your payment! Your subscription to the <strong>${plan.name}</strong> plan has been activated successfully.
      </p>
      
      ${temporaryPassword ? `
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #333; margin-top: 0;">Login Credentials</h3>
        <p style="margin: 10px 0;"><strong>Email:</strong> ${user.email}</p>
        <p style="margin: 10px 0;"><strong>Password:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px;">${temporaryPassword}</code></p>
        <p style="font-size: 14px; color: #666; margin-top: 15px;">
          Use these credentials to log in to your account.
        </p>
      </div>
      ` : `
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #333; margin-top: 0;">Log In to Your Account</h3>
        <p style="margin: 10px 0;">
          You can log in to your account using your existing credentials.
        </p>
      </div>
      `}
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #333; margin-top: 0;">Invoice Details</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Transaction Reference:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${transaction.vendorTxCode}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Plan:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${plan.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Billing Period:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${transaction.period === "yearly" ? "Yearly" : "Monthly"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Amount Paid:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">£${transaction.amount.toFixed(2)} ${transaction.currency}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Start Date:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${startDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Expiry Date:</strong></td>
            <td style="padding: 8px 0;">${expiryDate}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #333; margin-top: 0;">Your ${plan.name} Plan Features</h3>
        <ul style="font-size: 16px; line-height: 1.8; color: #555; margin: 10px 0;">
          <li><strong>${transaction.period === "yearly" ? plan.maxDocuments * 2 : plan.maxDocuments}</strong> document uploads${transaction.period === "yearly" ? " (2x bonus)" : ""}</li>
          <li><strong>${transaction.period === "yearly" ? plan.maxFileSize * 2 : plan.maxFileSize} MB</strong> total file size${transaction.period === "yearly" ? " (2x bonus)" : ""}</li>
          <li><strong>${transaction.period === "yearly" ? plan.maxUrls * 2 : plan.maxUrls}</strong> website URLs${transaction.period === "yearly" ? " (2x bonus)" : ""}</li>
        </ul>
      </div>

      <div style="background-color: #d1ecf1; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #0c5460; margin-top: 0;">Billing Information</h3>
        <p style="font-size: 14px; line-height: 1.6; color: #0c5460; margin: 5px 0;">
          <strong>Billed To:</strong><br>
          ${transaction.billingFirstNames} ${transaction.billingSurname}<br>
          ${transaction.billingAddress1}${transaction.billingAddress2 ? `, ${transaction.billingAddress2}` : ""}<br>
          ${transaction.billingCity} ${transaction.billingPostCode}<br>
          ${transaction.billingCountry}${transaction.billingState ? `, ${transaction.billingState}` : ""}
        </p>
      </div>

      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        You can now access all features of your ${plan.name} plan. Log in to your account to get started.
      </p>
      <p style="margin: 20px 0;">
        <a href="${process.env.SITE_URL || "https://www.talknova.ai"}/login" 
           style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Log In to Your Account
        </a>
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        If you have any questions or need assistance, please don't hesitate to contact our support team.
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Thank you for choosing TalkNova!
      </p>
    `;

    return await sendTemplatedEmail(user.email, subject, contentHtml);
  } catch (error) {
    console.error("Error sending invoice email:", error);
    return false;
  }
}

/**
 * Send registration confirmation with system-generated password
 * @param {Object} user - Newly created user document
 * @param {Object} plan - Selected plan document
 * @param {string} temporaryPassword - Generated password before verification
 */
export async function sendRegistrationPasswordEmail(
  user,
  plan,
  temporaryPassword
) {
  try {
    const dashboardUrl = `${process.env.SITE_URL}login`;
    const subject = `Your ${plan?.name || ""} registration details`;

    const contentHtml = `
      <h2 style="color: #333; margin-bottom: 20px;">You're almost there!</h2>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Hi ${
          user.firstName || "there"
        }, thanks for registering for the <strong>${
      plan?.name || "selected"
    } plan</strong>.
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        We've created a secure temporary password for your account. You'll be able to set your own password
        once your payment is confirmed.
      </p>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">Temporary Credentials</h3>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Temporary Password:</strong> <code style="background-color: #eef2f7; padding: 4px 8px; border-radius: 4px;">${temporaryPassword}</code></p>
        <p style="font-size: 14px; color: #666;">
          Your login will be enabled after we confirm your payment and you set a new password via the secure link we'll send.
        </p>
      </div>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        If you have any questions, feel free to contact our support team. In the meantime, you can bookmark your dashboard link below:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
          View Dashboard
        </a>
      </div>
    `;

    return await sendTemplatedEmail(user.email, subject, contentHtml);
  } catch (error) {
    console.error("Error sending registration password email:", error);
    return false;
  }
}

/**
 * Send email prompting the user to set their own password after payment
 * @param {Object} user - User document
 * @param {string} link - Direct link to password setup page
 */
export async function sendPasswordSetupEmail(user, link) {
  try {
    const subject = "Complete your TalkNova account setup";

    const contentHtml = `
      <h2 style="color: #333; margin-bottom: 20px;">Set Your Password</h2>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Hi ${user.firstName || "there"},
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Your payment was successful! To start using your TalkNova account, please set your own password using the secure link below.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${link}" style="display: inline-block; padding: 15px 35px; background-color: #198754; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Set My Password
        </a>
      </div>
      <p style="font-size: 15px; color: #555;">This link is valid for 24 hours. If it expires, you can request a new one from the login page.</p>
      <p style="font-size: 15px; color: #555;">Once your password is set, your account will be activated automatically.</p>
    `;

    return await sendTemplatedEmail(user.email, subject, contentHtml);
  } catch (error) {
    console.error("Error sending password setup email:", error);
    return false;
  }
}

/**
 * Send forgot password reset email with new temporary password
 * @param {Object} user - User object
 * @param {string} newPassword - New temporary password
 * @returns {Promise<boolean>} - Success status
 */
export async function sendPasswordResetEmail(user, newPassword) {
  try {
    const subject = "Your TalkNova Password Has Been Reset";

    const contentHtml = `
      <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Hello ${user.firstName || "there"},
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Your password has been successfully reset as requested.
      </p>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <h3 style="color: #333; margin-top: 0;">Your New Temporary Password</h3>
        <p style="margin: 10px 0;"><strong>Email:</strong> ${user.email}</p>
        <p style="margin: 10px 0;"><strong>New Password:</strong> <code style="background-color: #e9ecef; padding: 4px 8px; border-radius: 3px; font-size: 16px;">${newPassword}</code></p>
        <p style="font-size: 14px; color: #666; margin-top: 15px;">
          <strong>Important:</strong> This is a temporary password. Please log in and change it immediately for security purposes.
        </p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${
          process.env.SITE_URL
        }login" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Log In Now
        </a>
      </div>

      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        If you did not request this password reset, please contact our support team immediately.
      </p>
    `;

    return await sendTemplatedEmail(user.email, subject, contentHtml);
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return false;
  }
}

/**
 * Send magic link login email
 * @param {string} email - User email
 * @param {string} magicLink - Magic link URL
 * @returns {Promise<boolean>} - Success status
 */
export async function sendMagicLinkEmail(email, magicLink) {
  try {
    const subject = "Your TalkNova Magic Login Link";

    const contentHtml = `
      <h2 style="color: #333; margin-bottom: 20px;">Magic Link Login</h2>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Hello,
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        You requested a magic link to log in to your TalkNova account. Click the button below to access your account:
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${magicLink}" style="display: inline-block; padding: 15px 40px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
          🔐 Log In with Magic Link
        </a>
      </div>

      <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
        <p style="font-size: 14px; color: #721c24; margin: 0;">
          <strong>Security Notice:</strong> This link will expire in 5 minutes and can only be used once. 
          If you didn't request this login link, please ignore this email.
        </p>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #666;">
        If the button doesn't work, you can copy and paste this link into your browser:<br>
        <a href="${magicLink}" style="color: #007bff; word-break: break-all;">${magicLink}</a>
      </p>
    `;

    return await sendTemplatedEmail(email, subject, contentHtml);
  } catch (error) {
    console.error("Error sending magic link email:", error);
    return false;
  }
}

/**
 * Send email verification link to user
 * @param {Object} user - User object
 * @param {string} verificationLink - Verification link URL
 * @returns {Promise<boolean>} - Success status
 */
export async function sendEmailVerificationEmail(user, verificationLink) {
  try {
    const subject = "Verify Your TalkNova Email Address";

    const contentHtml = `
      <h2 style="color: #333; margin-bottom: 20px;">Verify Your Email Address</h2>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Hello ${user.firstName || "there"},
      </p>
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Thank you for signing up for TalkNova! To complete your registration and activate your account, please verify your email address by clicking the button below.
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" style="display: inline-block; padding: 15px 40px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
          Verify Email Address
        </a>
      </div>

      <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0c5460;">
        <p style="font-size: 14px; color: #0c5460; margin: 0;">
          <strong>Important:</strong> This verification link will expire in 24 hours. If you didn't create an account with TalkNova, please ignore this email.
        </p>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #666;">
        If the button doesn't work, you can copy and paste this link into your browser:<br>
        <a href="${verificationLink}" style="color: #007bff; word-break: break-all;">${verificationLink}</a>
      </p>
    `;

    return await sendTemplatedEmail(user.email, subject, contentHtml);
  } catch (error) {
    console.error("Error sending email verification email:", error);
    return false;
  }
}

export async function sendClientChatbotCredentialsEmail({
  clientUser,
  chatbot,
  plainPassword,
  codeSnippet,
}) {
  try {
    const loginUrl = process.env.SITE_URL + "login";
    const fromMail = "Talknova <no-reply@talknova.ai>";
    const bcc = ["klaspaddeveloper@gmail.com"];

    // 1) Try to find your template by uniqueId
    //    In your question, you might name it "CHATBOT_CREDENTIALS" or "SEND_CHATBOT_CREDENTIALS".
    const templateUniqueId = "SEND_CHATBOT_CREDENTIALS";
    const tpl = await EmailTemplate.findOne({
      uniqueId: templateUniqueId,
      status: true,
    });

    let subject;
    let body;

    if (!tpl) {
      // Fallback if template not found
      subject = "Your TalkNova Chatbot Access Details";
      body = `
      <p>Dear ${clientUser.firstName || ""},</p>
      <p>Your chatbot is now ready. Below are your new login credentials and the embed snippet:</p>
      <p>
        <strong>Login URL:</strong> <a href="${loginUrl}" target="_blank">${loginUrl}</a><br>
        <strong>Email:</strong> ${clientUser.email}<br>
        <strong>Password:</strong> ${plainPassword}
      </p>
      
      <p>
        If you have any issues or questions, please contact our support at 
        <a href="mailto:support@talknova.ai">support@talknova.ai</a>.
      </p>
      <p>Best regards,<br>TalkNova Support Team</p>
      `;
    } else {
      subject = tpl.subject;
      body = tpl.body;

      // Replace placeholders
      const clientName =
        (clientUser.firstName || "") + " " + (clientUser.lastName || "");
      body = body
        .replace(/{{CLIENT_NAME}}/gi, clientName.trim())
        .replace(/{{CLIENT_EMAIL}}/gi, clientUser.email || "")
        .replace(/{{PASSWORD}}/gi, plainPassword)
        .replace(/{{LOGIN_URL}}/gi, loginUrl)
        .replace(/{{AGENT_SNIPPET}}/gi, codeSnippet)
        .replace(/{{AGENT_NAME}}/gi, chatbot.name || "");
    }

    // 2) Send via nodemailer
    const transporter = await getMailTransporter();
    const mailOptions = {
      from: fromMail,
      to: clientUser.email,
      bcc: bcc,
      subject,
      html: body,
    };

    const sendResult = await transporter.sendMail(mailOptions);
    if (!sendResult) {
      console.error("Failed to send email: No result");
      return false;
    }

    // 3) Save to mail history
    try {
      await MailHistory.create({
        to: clientUser.email,
        subject,
        body,
        tplId: tpl?._id,
        type: "SEND_CHATBOT_CREDENTIALS",
        status: "SENT",
        user: clientUser._id,
      });
    } catch (mhError) {
      console.error("Could not save mail history:", mhError);
      // continue
    }

    console.log("Credentials email successfully sent to:", clientUser.email);
    return true;
  } catch (err) {
    console.error("Error in sendClientChatbotCredentialsEmail:", err);
    return false;
  }
}
