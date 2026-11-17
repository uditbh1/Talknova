// app/routes/api/chatagent.js
import { json } from "@remix-run/node";
import { ChatBot } from "~/models/chatbot";
import { User } from "~/models/user";
import { canCreateBot } from "~/utils/plans";

// Helper functions for deep merging objects
function isObject(item) {
  return item && typeof item === "object" && !Array.isArray(item);
}

function mergeDeep(target, source) {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) Object.assign(output, { [key]: source[key] });
        else output[key] = mergeDeep(target[key], source[key]);
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

export async function action({ request }) {
  const formData = await request.formData();
  const agentId = formData.get("id");
  console.log("Fetching chatbot configuration for agent:", agentId);

  try {
    const chatbot = await ChatBot.findOne({
      agentId,
      status: true,
      initialized: true,
    }).select("prompt agentId name documents theme clients");

    if (!chatbot) {
      return json(
        { error: "Chatbot configuration not found" },
        { status: 404 }
      );
    }

    console.log("Chatbot found:", chatbot);

    const userId = chatbot && chatbot.clients && chatbot.clients[0];

    // Fetch user to check if super admin
    const user = userId ? await User.findById(userId).lean() : null;
    const canCreate = await canCreateBot(userId, user);

    // if (!canCreate.status) return json({ error: canCreate.message }, { status: 403 });

    // Default theme values
    const defaultTheme = {
      button: {
        backgroundColor: "#004729",
        iconColor: "#ffffff",
        size: 68,
      },
      tooltip: {
        tooltipMessage: "Hi There 👋!",
        tooltipBackgroundColor: "#004729",
        showTooltip: true,
      },
      chatWindow: {
        title: "Ai Support",
        welcomeMessage:
          "Hello! You are chatting with Ai Support. How can I help you today?",
        backgroundColor: "#ffffff",
        textColor: "#000000",
        headerColor: "#004729",
      },
    };

    // Merge stored theme with default theme
    const theme = mergeDeep(defaultTheme, chatbot.theme || {});

    console.log("Chatbot configuration:", chatbot);

    // Build the final prompt:
    // 1) Use chatbot.prompt in place of the original text
    // 2) Preserve the lines about {context} and REMEMBER...
    const finalPrompt = `
${chatbot.prompt}

------------
{context}
------------
REMEMBER: Don't try to make up an answer. Never break character.
`;

    return json({
      prompt: finalPrompt,
      // documents: chatbot.documents, // If needed, you can include the documents as well
      botName: chatbot.name,
      bot: chatbot.agentId,
      agentId: chatbot.agentId,
      _id: chatbot?.clients?.toString(),
      client: chatbot?.clients?.toString(),
      theme: theme,
    });
  } catch (error) {
    console.error("Error fetching chatbot configuration:", error);
    return json({ error: "Server error" }, { status: 500 });
  }
}
