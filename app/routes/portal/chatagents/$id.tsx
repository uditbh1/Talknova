// app/routes/portal/chatbots/$id.tsx
import { useLoaderData, useActionData } from "@remix-run/react";
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
import { getCurrentPlan } from "~/utils/plans";

export async function loader({ request, params }) {
  await requireUserSession(request);
  const user = await getUserFromSession(request);
  const AWSS3_BUCKET_FILES = process.env.AWSS3_BUCKET_FILES;
  const userId = user._id;
  const isSuperAdmin = user.roles.includes("SUPER_ADMIN");

  const chatbot = await ChatBot.findById(params.id).lean();
  if (!chatbot) throw new Error("Chat agent not found");

  let clients = [];
  if (isSuperAdmin) {
    clients = (await User.find({ roles: { $in: ["CLIENT"] } }).lean()) || [];
  } else {
    clients = (await User.find({ _id: userId }).lean()) || [];
  }

  const currentPlan = await getCurrentPlan(userId, user);

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
    data: chatbot,
    clients,
    user,
    AWSS3_BUCKET_FILES,
    maxDocuments,
    remainingDocuments,
  };
}

export async function action({ request, params }) {
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

  let { name, client, prompt, temperature, theme } =
    Object.fromEntries(formData);

  console.log("formData", formData);

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

  // Validate client
  if (!client) {
    return json({ messages: ["Client is required."], status: "ERROR" });
  }

  // Parse theme JSON from form input
  theme = JSON.parse(theme || "{}");

  console.log("theme", theme);

  // Get existing documents from formData
  const existingDocuments = formData.getAll("existingDocuments");

  // Get new documents from formData
  const newFiles = formData.getAll("documents");

  // Combine existing and new documents
  const totalDocuments = existingDocuments.length + newFiles.length;

  // Bypass plan checks for SUPER_ADMIN
  const isSuperAdmin =
    user.roles &&
    (user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN"));

  // Check plan limits instead of hardcoded 15 (skip for super admin)
  if (!isSuperAdmin) {
    const userPlan = await getCurrentPlan(user._id, user);
    if (userPlan && userPlan.planId) {
      const isYearly = userPlan.period === "yearly";
      const effectiveMaxDocuments = isYearly
        ? userPlan.planId.maxDocuments * 2
        : userPlan.planId.maxDocuments;

      // Calculate total documents used across ALL chatbots (not just this one)
      const chatBots = await ChatBot.find({ clients: user._id });
      let totalDocumentsUsed = 0;
      chatBots.forEach((bot) => {
        // Don't count documents from the current bot we're editing
        if (bot._id.toString() !== params.id) {
          totalDocumentsUsed += bot.documents.length;
        }
      });

      // Add documents that will remain in this bot after update
      const documentsInThisBot = existingDocuments.length;
      const newDocumentsToAdd = newFiles.length;
      const totalAfterUpdate =
        totalDocumentsUsed + documentsInThisBot + newDocumentsToAdd;

      if (totalAfterUpdate > effectiveMaxDocuments) {
        return json({
          messages: [
            `You cannot have more than ${effectiveMaxDocuments} documents across all chat agents. You currently have ${totalDocumentsUsed} documents in other agents, and this would result in ${totalAfterUpdate} total documents.`,
          ],
          status: "ERROR",
        });
      }
    }
  }

  // Fetch the chatbot from the database
  const chatbot = await ChatBot.findById(params.id);
  if (!chatbot) {
    return json({ messages: ["Chat agent not found."], status: "ERROR" });
  }

  // Identify deleted documents
  const deletedDocuments = chatbot.documents.filter(
    (doc) => !existingDocuments.includes(doc)
  );

  // Remove deleted documents from S3
  for (const doc of deletedDocuments) {
    // Implement your S3 delete logic here
    // Example: await deleteFromS3(doc);
  }

  const updatedDocuments = [...existingDocuments, ...newFiles];
  console.log("existingDocuments", existingDocuments);
  console.log("newFiles", newFiles);

  console.log("updatedDocuments", updatedDocuments);

  try {
    await ChatBot.findByIdAndUpdate(params.id, {
      name,
      clients: client,
      prompt,
      temperature: parseFloat(temperature) || 0.5,
      documents: updatedDocuments,
      theme,
      updatedBy: user._id,
    });
    return redirect("/portal/chatagents");
  } catch (error) {
    return json({
      messages: ["An error occurred while updating the chat agent."],
      status: "ERROR",
    });
  }
}

export default function EditChatbot() {
  const { data, AWSS3_BUCKET_FILES, maxDocuments, remainingDocuments } =
    useLoaderData();
  const actionData = useActionData();

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">Edit Chat Agent</h5>
      </div>
      <div className="card-body">
        {actionData?.status === "ERROR" && (
          <div className="alert alert-danger">
            {actionData.messages.map((message, index) => (
              <div key={index}>{message}</div>
            ))}
          </div>
        )}

        <ChatbotForm data={data} AWSS3_BUCKET_FILES={AWSS3_BUCKET_FILES} />
      </div>
    </div>
  );
}
