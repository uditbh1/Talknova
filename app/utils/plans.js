import { UserPlanModel } from "~/models/userplan";
import { PlanModel } from "~/models/plan";
import { addDays } from "date-fns";
import { ChatBot } from "~/models/chatbot";

/**
 * Revoke services for a user when plan expires
 * Disables all chatbots/agents for the user
 * @param {Object} userId - The user ID to revoke services for
 */
export async function revokeServicesOnExpiry(userId) {
  try {
    const ChatBot = (await import("~/models/chatbot")).ChatBot;

    // Disable all chatbots for this user
    const result = await ChatBot.updateMany(
      { clients: userId },
      {
        $set: {
          status: false,
          isApproved: false,
        },
      }
    );

    console.log(
      `Revoked services for user ${userId}: ${result.modifiedCount} chatbot(s) disabled`
    );
    return result.modifiedCount;
  } catch (error) {
    console.error("Error revoking services on expiry:", error);
    return 0;
  }
}

/**
 * Check and process expired plans for a user
 * Deactivates plan, sends email, and revokes services
 * @param {Object} userId - The user ID to check
 * @returns {Object|null} - The expired plan info or null if not expired
 */
export async function checkAndProcessExpiredPlan(userId, user = null) {
  try {
    // Bypass expiry checks for SUPER_ADMIN
    if (
      user &&
      user.roles &&
      (user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN"))
    ) {
      return null;
    }

    // Find active plan that has expired
    const expiredPlan = await UserPlanModel.findOne({
      clientId: userId,
      isActive: true,
      isDeleted: false,
      expiryDate: { $lt: new Date() },
    })
      .populate("planId")
      .populate("clientId")
      .lean();

    if (!expiredPlan) {
      return null;
    }

    // Deactivate the expired plan
    await UserPlanModel.findByIdAndUpdate(expiredPlan._id, { isActive: false });
    console.log(`Plan expired and deactivated for user ${userId}`);

    // Revoke services (disable chatbots)
    await revokeServicesOnExpiry(userId);

    // Send expiry email notification
    if (expiredPlan.clientId && expiredPlan.clientId.email) {
      const { sendPlanExpiredEmail } = await import("~/utils/email");
      try {
        await sendPlanExpiredEmail(expiredPlan.clientId, expiredPlan);
        console.log(`Expiry email sent to ${expiredPlan.clientId.email}`);
      } catch (emailError) {
        console.error("Failed to send expiry email:", emailError);
      }
    }

    return expiredPlan;
  } catch (error) {
    console.error("Error checking/processing expired plan:", error);
    return null;
  }
}

export async function getCurrentPlan(clientId, user = null) {
  // Bypass plan checks for SUPER_ADMIN
  if (
    user &&
    user.roles &&
    (user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN"))
  ) {
    // Return a dummy plan object for super admin to bypass restrictions
    return {
      _id: "super-admin-plan",
      clientId: user._id,
      planId: {
        _id: "super-admin-plan-id",
        name: "Super Admin Plan",
        maxDocuments: 999999,
        maxFileSize: 999999,
        maxUrls: 999999,
        allowedAgents: 999999,
      },
      startDate: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 100), // 100 years from now
      period: "yearly",
      isActive: true,
    };
  }

  // First, check and process any expired plans
  await checkAndProcessExpiredPlan(clientId, user);

  // Lean from the start
  const currentPlan = await UserPlanModel.findOne({
    clientId,
    isActive: true,
    isDeleted: false,
  })
    .populate("planId") // might need a separate lean on the populate, see note below
    .lean();

  if (!currentPlan) {
    return null;
  }

  if (currentPlan.expiryDate < new Date()) {
    // Because it's lean, we can't do currentPlan.save()
    // so use a separate update query
    await UserPlanModel.findByIdAndUpdate(currentPlan._id, { isActive: false });
    return null;
  }

  return currentPlan; // This is already a plain object
}

export async function assignPlan({
  clientId,
  planId,
  startDate = new Date(),
  expiryDate,
  addedVia = "ADMIN",
  addedBy,
  transactionId,
  period = "monthly",
  notes = "",
}) {
  // Deactivate current plan if exists
  const currentPlan = await getCurrentPlan(clientId);

  if (currentPlan) {
    // Use update query since getCurrentPlan returns lean object
    await UserPlanModel.findByIdAndUpdate(currentPlan._id, { isActive: false });
  }

  // Calculate expiry date if not provided (30 days from start)
  const calculatedExpiryDate = expiryDate || addDays(startDate, 30);

  // Create new plan assignment
  return await UserPlanModel.create({
    clientId,
    planId,
    startDate,
    expiryDate: calculatedExpiryDate,
    addedVia,
    addedBy,
    previousPlanId: currentPlan?.planId,
    transactionId, // Link to transaction if applicable
    period,
    notes,
    isActive: true,
  });
}

export async function updatePlanDates({ userPlanId, startDate, expiryDate }) {
  const userPlan = await UserPlanModel.findById(userPlanId);
  if (!userPlan) throw new Error("Plan not found");

  userPlan.startDate = startDate || userPlan.startDate;
  userPlan.expiryDate = expiryDate || userPlan.expiryDate;

  return await userPlan.save();
}

export async function getPlanHistory(clientId) {
  return await UserPlanModel.find({
    clientId,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .populate("planId")
    .populate("addedBy", "firstName lastName email");
}

export async function deactivatePlan(userPlanId) {
  const userPlan = await UserPlanModel.findById(userPlanId);
  if (!userPlan) throw new Error("Plan not found");

  userPlan.isActive = false;
  return await userPlan.save();
}

/**
 * Check if a plan is expiring within a specified number of days
 * @param {Object} currentPlan - The current plan object with expiryDate
 * @param {number} daysThreshold - Number of days before expiry to warn (default: 5)
 * @returns {Object} - { isExpiringSoon: boolean, daysRemaining: number, expiryDate: Date }
 */
export function checkPlanExpiringSoon(currentPlan, daysThreshold = 5) {
  if (!currentPlan || !currentPlan.expiryDate) {
    return {
      isExpiringSoon: false,
      daysRemaining: null,
      expiryDate: null,
    };
  }

  const expiryDate = new Date(currentPlan.expiryDate);
  const now = new Date();
  const diffTime = expiryDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    isExpiringSoon: diffDays > 0 && diffDays <= daysThreshold,
    daysRemaining: diffDays,
    expiryDate: expiryDate,
  };
}

/**
 * Assign FREE plan to a new user by default
 * This ensures all new users get a FREE plan with 30-day trial
 * @param {Object} userId - The user ID to assign the plan to
 * @param {Object} addedBy - The user ID who is creating this (usually the same as userId for self-signup)
 * @returns {Object} - The created user plan or null if failed
 */
export async function assignFreePlanToUser(userId, addedBy = null) {
  try {
    // First, ensure default plans exist (seed if needed)
    const existingPlans = await PlanModel.find({
      isDefault: true,
      isDeleted: false,
    });
    if (existingPlans.length === 0) {
      console.log("No default plans found, seeding plans...");
      const { seedDefaultPlans } = await import("~/models/seeds/plans.server");
      await seedDefaultPlans();
    }

    // Find FREE plan
    const freePlan = await PlanModel.findOne({
      defaultPlanType: "FREE",
      isActive: true,
      isDeleted: false,
    });

    if (!freePlan) {
      console.error("FREE plan not found even after seeding");
      return null;
    }

    // Check if user already has an active plan
    const existingPlan = await getCurrentPlan(userId);
    if (existingPlan) {
      console.log(
        `User ${userId} already has an active plan, skipping FREE plan assignment`
      );
      return existingPlan;
    }

    // Assign FREE plan with 30-day trial period
    const trialStartDate = new Date();
    const trialExpiryDate = addDays(trialStartDate, 30);

    const userPlan = await assignPlan({
      clientId: userId,
      planId: freePlan._id,
      startDate: trialStartDate,
      expiryDate: trialExpiryDate,
      addedVia: "SYSTEM",
      addedBy: addedBy || userId,
      period: "monthly",
      notes: "Free trial plan assigned automatically on signup",
    });

    console.log("FREE plan assigned to user:", userId);
    return userPlan;
  } catch (error) {
    console.error("Failed to assign free plan to user:", error);
    console.error("Plan assignment error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      userId: userId,
    });
    // Don't throw - return null so user creation can still succeed
    return null;
  }
}

export async function canCreateBot(userId, user = null) {
  // Bypass all checks for SUPER_ADMIN
  if (
    user &&
    user.roles &&
    (user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN"))
  ) {
    return {
      status: true,
      plan: {
        name: "Super Admin Plan",
        maxDocuments: 999999,
        maxFileSize: 999999,
        maxUrls: 999999,
        allowedAgents: 999999,
      },
      message: "Super Admin: Unlimited access to all features.",
    };
  }

  // 1. Get the current active, non-expired plan
  const userPlan = await getCurrentPlan(userId, user);

  // If no plan or plan expired
  if (!userPlan || !userPlan.planId) {
    return {
      status: false,
      plan: null,
      message:
        "You do not have an active plan or your plan has expired. Please subscribe to a plan.",
    };
  }

  const plan = userPlan.planId; // The actual plan document (populated)

  // 2. Get the effective plan limits based on billing period (2x for yearly)
  const isYearly = userPlan.period === "yearly";
  const effectiveMaxDocuments = isYearly
    ? plan.maxDocuments * 2
    : plan.maxDocuments;
  const effectiveMaxUrls = isYearly ? plan.maxUrls * 2 : plan.maxUrls;
  const effectiveAllowedAgents = isYearly
    ? (plan.allowedAgents || 1) * 2
    : plan.allowedAgents || 1;

  // 3. Calculate usage for documents and URLs
  const chatBots = await ChatBot.find({ clients: userId });

  let totalDocumentsUsed = 0;
  let totalWeburlsUsed = 0;

  chatBots.forEach((bot) => {
    totalDocumentsUsed += bot.documents.length;
    totalWeburlsUsed += bot.weburls.length;
  });

  // 4. Check plan limits against effective limits
  if (totalDocumentsUsed >= effectiveMaxDocuments) {
    return {
      status: false,
      plan,
      message: `You have used all ${effectiveMaxDocuments} documents allowed by your ${
        isYearly ? "yearly" : "monthly"
      } plan. Please upgrade your plan to add more documents.`,
    };
  }

  if (totalWeburlsUsed >= effectiveMaxUrls) {
    return {
      status: false,
      plan,
      message: `You have used all ${effectiveMaxUrls} URLs allowed by your ${
        isYearly ? "yearly" : "monthly"
      } plan. Please upgrade your plan to add more web URLs.`,
    };
  }

  // 5. All good – return how many documents/URLs remain with effective limits
  const remainingDocs = effectiveMaxDocuments - totalDocumentsUsed;
  const remainingUrls = effectiveMaxUrls - totalWeburlsUsed;

  return {
    status: true,
    plan,
    message: `You can create ${effectiveAllowedAgents} agent(s) with your current ${
      isYearly ? "yearly" : "monthly"
    } plan which allows ${remainingDocs} documents and ${remainingUrls} URLs${
      isYearly ? " (2x yearly bonus)" : ""
    }.`,
  };
}
