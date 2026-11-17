# Subscription Expiry Alert - Testing Guide

## Overview

The subscription expiry alert appears when a user's plan is expiring within 5 days. This alert shows a warning message with options to renew or upgrade.

## How to Simulate the Alert

### Method 1: Update MongoDB Directly (Recommended for Testing)

1. **Connect to your MongoDB database** (using MongoDB Compass, Studio 3T, or command line)

2. **Find your user's plan:**

   ```javascript
   // In MongoDB shell or Compass
   db.userplans.findOne({
     clientId: ObjectId("YOUR_USER_ID"),
     isActive: true,
   });
   ```

3. **Update the expiry date to be within 5 days:**

   ```javascript
   // Set expiry to 3 days from now (for example)
   db.userplans.updateOne(
     {
       clientId: ObjectId("YOUR_USER_ID"),
       isActive: true,
     },
     {
       $set: {
         expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
       },
     }
   );
   ```

4. **Refresh your portal dashboard** - the alert should appear!

### Method 2: Using MongoDB Compass (GUI)

1. Open MongoDB Compass
2. Connect to your database
3. Navigate to the `userplans` collection
4. Find the document for your user (filter by `clientId` and `isActive: true`)
5. Edit the `expiryDate` field:
   - Click on the document
   - Click "Edit Document"
   - Change `expiryDate` to a date 5 days or less from today
   - Example: If today is Jan 15, set it to Jan 18 (3 days)
6. Save the document
7. Refresh your portal dashboard

### Method 3: Create a Test Route (For Development)

You can create a temporary test route to quickly set expiry dates:

```typescript
// app/routes/portal/test-expiry.tsx (temporary file for testing)
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import { getUserFromSession } from "~/utils/auth.server";
import { UserPlanModel } from "~/models/userplan";
import { addDays } from "date-fns";

export async function loader({ request }) {
  const user = await getUserFromSession(request);
  if (!user) return redirect("/login");

  const currentPlan = await UserPlanModel.findOne({
    clientId: user._id,
    isActive: true,
  }).populate("planId");

  return json({ currentPlan, userId: user._id });
}

export async function action({ request }) {
  const user = await getUserFromSession(request);
  if (!user) return redirect("/login");

  const formData = await request.formData();
  const days = parseInt(formData.get("days") || "3");

  const plan = await UserPlanModel.findOne({
    clientId: user._id,
    isActive: true,
  });

  if (plan) {
    plan.expiryDate = addDays(new Date(), days);
    await plan.save();
  }

  return redirect("/portal");
}

export default function TestExpiry() {
  const { currentPlan } = useLoaderData();

  return (
    <div className="container mt-5">
      <h2>Test Subscription Expiry</h2>
      <p>
        Current expiry:{" "}
        {currentPlan?.expiryDate
          ? new Date(currentPlan.expiryDate).toLocaleString()
          : "No plan"}
      </p>
      <Form method="post">
        <label>Set expiry to (days from now):</label>
        <input type="number" name="days" defaultValue={3} min={1} max={10} />
        <button type="submit" className="btn btn-primary">
          Update Expiry
        </button>
      </Form>
    </div>
  );
}
```

Then visit: `http://localhost:5173/portal/test-expiry`

## Test Scenarios

### Scenario 1: 5 Days Remaining

- Set expiry to exactly 5 days from now
- Alert should appear

### Scenario 2: 3 Days Remaining

- Set expiry to 3 days from now
- Alert should appear with "expires in 3 days"

### Scenario 3: 1 Day Remaining

- Set expiry to 1 day from now
- Alert should say "expires tomorrow"

### Scenario 4: Expired

- Set expiry to a past date
- Alert should NOT appear (plan is already expired)

### Scenario 5: More than 5 Days

- Set expiry to 10 days from now
- Alert should NOT appear

## What the Alert Shows

- **Warning icon** and yellow alert box
- **Days remaining** message
- **Expiry date** in a readable format
- **Two action buttons:**
  - "Renew Subscription" (links to `/portal/my-subscription`)
  - "Upgrade Plan" (links to `/buy-plan`)
- **Dismiss button** (X) to close the alert

## Notes

- The alert only shows for active plans
- The alert is dismissible (user can close it)
- The alert reappears on each page load if still within 5 days
- After the plan expires, the alert will not show (plan becomes inactive)


