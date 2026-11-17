import { json, redirect } from "@remix-run/node";
import { getUserFromSession } from "~/utils/auth.server";
import { User } from "~/models/user";
import { mongoose } from "~/config/db.server";

export async function action({ request }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await getUserFromSession(request);
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Marking welcome popup as shown - Request received:", {
      userId: user._id,
      email: user.email,
      userIdType: typeof user._id,
      userIdString: user._id?.toString(),
    });

    // Ensure we have a valid ObjectId
    let userId;
    if (typeof user._id === "string") {
      userId = new mongoose.Types.ObjectId(user._id);
    } else if (user._id && user._id.toString) {
      userId = user._id;
    } else {
      console.error("Invalid user ID format:", user._id);
      return json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Use findByIdAndUpdate which is more reliable for ensuring the update happens
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { welcomePopupShown: true } },
      {
        new: true, // Return updated document
        runValidators: false, // Skip validation for faster update
      }
    );

    console.log("Update result:", {
      userId: userId.toString(),
      email: user.email,
      updatedUserExists: !!updatedUser,
      welcomePopupShown: updatedUser?.welcomePopupShown,
    });

    if (!updatedUser) {
      console.error("User not found when marking welcome popup:", {
        userId: userId,
        email: user.email,
      });
      return json({ error: "User not found" }, { status: 404 });
    }

    // Verify the update worked by reading the user back directly from DB
    const verifyUser = await User.findById(userId).lean();

    console.log("Welcome popup marked as shown for user:", {
      userId: userId.toString(),
      email: user.email,
      updatedValue: updatedUser.welcomePopupShown,
      verifiedValue: verifyUser?.welcomePopupShown,
      verifiedUserExists: !!verifyUser,
    });

    if (verifyUser && verifyUser.welcomePopupShown === true) {
      return json({ success: true, welcomePopupShown: true });
    } else {
      console.error(
        "✗ Update verification failed - field value:",
        verifyUser?.welcomePopupShown
      );
      // Even if verification fails, return success if the update was acknowledged
      // The field might not be selected in the lean query
      if (updatedUser && updatedUser.welcomePopupShown === true) {
        return json({ success: true, welcomePopupShown: true });
      }
      return json(
        { error: "Update may have failed - please check database" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error marking welcome popup as shown:", {
      error: error.message,
      stack: error.stack,
      userId: user._id,
      errorName: error.name,
    });
    return json(
      { error: "Failed to update: " + error.message },
      { status: 500 }
    );
  }
}
