// app/routes/portal/chatbots/add.tsx
import { useLoaderData, useActionData } from "@remix-run/react";
import { useEffect } from "react";
import {
  redirect,
  json,
  unstable_parseMultipartFormData as parseMultipartFormData,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_composeUploadHandlers as composeUploadHandlers,
} from "@remix-run/node";
import { getUserFromSession, requireUserSession } from "~/utils/auth.server";
import { s3UploadHandler } from "~/utils/storage";
import { ChatBot } from "~/models/chatbot";
import { User } from "~/models/user";
import ChatbotForm from "./Form";
import { getCurrentPlan, canCreateBot } from "~/utils/plans";

export async function loader({ request }) {
  await requireUserSession(request);
  let user = await getUserFromSession(request);
  const AWSS3_BUCKET_FILES = process.env.AWSS3_BUCKET_FILES;
  const userId = user._id;
  const isSuperAdmin = user.roles.includes("SUPER_ADMIN");

  let clients = [];
  if (isSuperAdmin) {
    clients = (await User.find({ roles: { $in: ["CLIENT"] } }).lean()) || [];
  } else {
    clients = (await User.find({ _id: userId }).lean()) || [];
  }

  const currentPlan = await getCurrentPlan(userId, user);
  const canCreate = await canCreateBot(userId, user);
  console.log("canCreate", canCreate);

  // Calculate plan limits
  let maxDocuments = null;
  let remainingDocuments = null;

  if (currentPlan && currentPlan.planId) {
    const isYearly = currentPlan.period === "yearly";
    maxDocuments = isYearly
      ? currentPlan.planId.maxDocuments * 2
      : currentPlan.planId.maxDocuments;

    // Calculate total documents used across all chatbots
    const chatBots = await ChatBot.find({ clients: userId });
    let totalDocumentsUsed = 0;
    chatBots.forEach((bot) => {
      totalDocumentsUsed += bot.documents.length;
    });

    remainingDocuments = maxDocuments - totalDocumentsUsed;
  }

  return {
    user,
    clients,
    AWSS3_BUCKET_FILES,
    currentPlan,
    canCreate,
    maxDocuments,
    remainingDocuments,
  };
}

export async function action({ request }) {
  const user = await getUserFromSession(request);
  if (!user) return redirect("/login");

  let formData;
  try {
    const uploadHandler = composeUploadHandlers(
      s3UploadHandler,
      createMemoryUploadHandler()
    );
    formData = await parseMultipartFormData(request, uploadHandler);
  } catch (error) {
    console.error("Error parsing multipart form data:", error);
    return json({
      messages: [
        `File upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }. ` + `Please check that S3 storage is properly configured.`,
      ],
      status: "ERROR",
    });
  }

  let { name, client, prompt, theme, ...values } = Object.fromEntries(formData);

  // Validate prompt
  prompt = prompt.trim();
  if (prompt === "") {
    return json({ messages: ["Prompt is required."], status: "ERROR" });
  }

  // Validate name
  name = name.trim();
  if (name === "") {
    return json({ messages: ["Name is required."], status: "ERROR" });
  }

  //check name already exists
  const nameExists = await ChatBot.findOne({ name });
  if (nameExists) {
    return json({ messages: ["Name already exists."], status: "ERROR" });
  }

  // Validate client
  if (!client) {
    return json({ messages: ["Client is required."], status: "ERROR" });
  }

  // Get all documents from formData
  const documents = formData
    .getAll("documents")
    .filter((doc) => doc.trim() !== "");

  //at least one document is required
  if (documents.length === 0) {
    return json({
      messages: ["At least one document is required."],
      status: "ERROR",
    });
  }

  // Bypass plan checks for SUPER_ADMIN
  const isSuperAdmin =
    user.roles &&
    (user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN"));

  // Check plan limits (skip for super admin)
  if (!isSuperAdmin) {
    const userPlan = await getCurrentPlan(user._id, user);
    if (userPlan && userPlan.planId) {
      const isYearly = userPlan.period === "yearly";
      const effectiveMaxDocuments = isYearly
        ? userPlan.planId.maxDocuments * 2
        : userPlan.planId.maxDocuments;

      // Calculate total documents used across all chatbots
      const chatBots = await ChatBot.find({ clients: user._id });
      let totalDocumentsUsed = 0;
      chatBots.forEach((bot) => {
        totalDocumentsUsed += bot.documents.length;
      });

      // Check if adding new documents would exceed limit
      if (totalDocumentsUsed + documents.length > effectiveMaxDocuments) {
        return json({
          messages: [
            `You cannot upload more than ${effectiveMaxDocuments} documents. You currently have ${totalDocumentsUsed} documents across all chat agents.`,
          ],
          status: "ERROR",
        });
      }
    }
  }

  console.log("values", values);
  // Parse theme JSON from form input
  theme = JSON.parse(theme || "{}");

  const agentId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // Create new chatbot
  const newChatbot = {
    name,
    clients: client,
    agentId,
    prompt,
    temperature: 1,
    theme,
    documents,
    addedBy: user._id,
  };

  try {
    await ChatBot.create(newChatbot);
    return redirect("/portal/chatagents");
  } catch (error) {
    console.error(error);
    return json({
      messages: ["An error occurred while creating the chat agent."],
      status: "ERROR",
    });
  }
}

export default function AddChatbot() {
  const { AWSS3_BUCKET_FILES, currentPlan, canCreate } = useLoaderData();
  const actionData = useActionData();

  // Log errors when they occur
  useEffect(() => {
    if (actionData?.status === "ERROR") {
      console.error("[File Upload] Server returned error:", {
        status: actionData.status,
        messages: actionData.messages,
        timestamp: new Date().toISOString(),
      });
    }
  }, [actionData]);

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">New Chat Agent</h5>
      </div>
      <div className="card-body">
        {actionData?.status === "ERROR" && (
          <div className="alert alert-danger">
            {actionData.messages.map((message, index) => (
              <div key={index}>{message}</div>
            ))}
          </div>
        )}
        <ChatbotForm AWSS3_BUCKET_FILES={AWSS3_BUCKET_FILES} />
      </div>
    </div>
  );
}
