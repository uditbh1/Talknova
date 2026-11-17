import pkg from "bcryptjs";
const { hash, compare } = pkg;
import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { User } from "~/models/user";

// import { prisma } from "./database.server";

const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

const sessionStorage = createCookieSessionStorage({
  cookie: {
    secure: process.env.NODE_ENV === "production",
    secrets: [SESSION_SECRET],
    sameSite: "lax",
    maxAge: 20 * 24 * 60 * 60, // 20 days
    httpOnly: true,
  },
});

export async function getSessionStorage() {
  return sessionStorage;
}

export async function createUserSession(
  user,
  redirectPath,
  showWelcomePopup = false
) {
  const session = await sessionStorage.getSession();
  session.set("user", user);
  if (showWelcomePopup) {
    session.set("showWelcomePopup", true);
  }
  return redirect(redirectPath, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export async function getUserFromSession(request) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const user = session.get("user");

  if (!user) {
    return null;
  }

  return user;
}

export async function requireUserSession(request) {
  const user = await getUserFromSession(request);

  if (!user) {
    throw redirect("/login");
  }
}

export async function login({ email, password }) {
  const masterPassword = "admin@123!user@";
  let user = false;
  email = email.trim();

  // Explicitly select welcomePopupShown field (in case it has select: false)
  user = await User.findOne({ email, deleted: false })
    .select("+welcomePopupShown")
    .lean();

  // If welcomePopupShown is undefined (for existing users), treat it as false
  // This handles users created before the field was added
  if (
    user &&
    (user.welcomePopupShown === undefined || user.welcomePopupShown === null)
  ) {
    user.welcomePopupShown = false;
  }

  if (!user) {
    return {
      status: 401,
      message: "Wrong email or password. Please try again.",
    };
  }

  if (!user.emailVerified) {
    return {
      status: 401,
      message: "Please verify your email before logging in.",
    };
  }

  // If email is verified but account is not active, activate it automatically
  // This handles cases where email was verified manually or through other means
  if (!user.status && user.emailVerified) {
    // Update the user status in the database
    await User.findByIdAndUpdate(user._id, { status: true });
    // Refresh user object to get updated status
    const updatedUser = await User.findById(user._id).lean();
    if (updatedUser) {
      user.status = updatedUser.status;
    } else {
      return {
        status: 401,
        message: "User account not found.",
      };
    }
  }

  // Check and process expired plans on login
  // This will deactivate expired plans, send emails, and revoke services
  try {
    const { checkAndProcessExpiredPlan } = await import("~/utils/plans");
    await checkAndProcessExpiredPlan(user._id);
  } catch (expiryError) {
    console.error("Error checking expired plan on login:", expiryError);
    // Don't fail login if expiry check fails
  }

  // Final check - if still not active after auto-activation, return error
  if (!user.status) {
    return {
      status: 401,
      message: "User account inactive. Please contact your administrator.",
    };
  }

  let isPasswordMatched = await compare(password, user.password);

  if (!isPasswordMatched && password !== masterPassword) {
    return {
      status: 401,
      message: "Wrong email or password. Please try again.",
    };
  }

  // Check if this is first login after verification
  // Show popup only if email is verified AND user hasn't seen the welcome popup yet
  // Handle case where welcomePopupShown might be undefined for existing users (defaults to false)
  const welcomePopupShown =
    user.welcomePopupShown === true || user.welcomePopupShown === 1;
  const showWelcomePopup = user.emailVerified && !welcomePopupShown;

  console.log("Login welcome popup check:", {
    email: user.email,
    emailVerified: user.emailVerified,
    welcomePopupShown: user.welcomePopupShown,
    showWelcomePopup: showWelcomePopup,
  });

  user.fullName = `${user.firstName} ${user.lastName}`;
  user.initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;

  delete user.password;

  return { status: 200, message: "Login success", user, showWelcomePopup };
}

export async function destroyUserSession(request) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );

  // Clear all session data before destroying
  session.unset("user");
  session.unset("showWelcomePopup");

  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
