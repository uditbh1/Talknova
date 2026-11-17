import {
  useLoaderData,
  useFetcher,
  useActionData,
  Form,
} from "@remix-run/react";
import { useEffect, useState } from "react";
import { Link } from "@remix-run/react";
import { redirect, json } from "@remix-run/node";
import { getUserFromSession } from "~/utils/auth.server";
import { ChatBot } from "~/models/chatbot";

function buildFileUrl(baseUrl: string, key: string) {
  if (!key) return "";
  if (/^https?:\/\//i.test(key)) return key;
  if (!baseUrl) return key;
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedKey = key.startsWith("/") ? key.slice(1) : key;
  return `${normalizedBase}${normalizedKey}`;
}

// --- LOADER ---
export async function loader({ request }) {
  let user = await getUserFromSession(request);
  if (!user) return redirect("/login");

  // Get agent from query params
  const url = new URL(request.url);
  let agent = url.searchParams.get("agent");
  if (!agent) throw new Error("Agent not found");

  // Populate 'clients'
  const chatBot = await ChatBot.findOne({ agentId: agent })
    .populate("clients")
    .lean();

  if (!chatBot) throw new Error("Chatbot not found");

  return {
    user,
    chatBot,
    agent,
    fileBaseUrl:
      process.env.CLOUDFRONT_URL ||
      process.env.AWSS3_BUCKET_FILES ||
      process.env.S3_BASE_URL ||
      process.env.R2_PUBLIC_URL ||
      "",
  };
}

// --- ACTION (unused for now) ---
export async function action({ request }) {
  // If you need form actions, handle them here
  return null;
}

// --- COMPONENT ---
export default function AgentTestPage() {
  const { user, chatBot, agent, fileBaseUrl } = useLoaderData();
  const actionData = useActionData();

  const [showModal, setShowModal] = useState(false);
  const [mdContent, setMdContent] = useState("");

  useEffect(() => {
    // Configure the chatbot
    window.chatbotConfig = {
      agentId: chatBot.agentId,
    };

    // Use local file in development, production URL otherwise
    const hostname = window.location.hostname;
    const scriptUrl =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.includes("localhost")
        ? "/frontend/js/chat-bot.js"
        : "https://www.talknova.ai/frontend/js/chat-bot.js";

    // Create a script element for loading the Flowise chat
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [chatBot.agentId]);

  // Fetch the md file content
  const handleShowModal = async () => {
    setShowModal(true);
    try {
      const response = await fetch(buildFileUrl(fileBaseUrl, chatBot.mdFile));
      if (!response.ok) {
        console.error("Failed to load MD file:", response.statusText);
        return;
      }
      const data = await response.text();
      setMdContent(data);
    } catch (error) {
      console.error("Error fetching MD file:", error);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setMdContent("");
  };

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Agent Test Page</title>

        <link
          rel="stylesheet"
          href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css"
        />

        {/* Simple inline styles to demonstrate layout */}
        <style>{`
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
          }
          .chat-header {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .chat-header img {
            width: 50px;
            height: 50px;
          }
          .details-section {
            margin-top: 20px;
            padding: 10px;
            border: 1px solid #ccc;
          }
          .details-section h2 {
            margin-top: 0;
          }
          .clients-list,
          .documents-list,
          .weburls-list {
            list-style: inside;
            margin: 0;
            padding-left: 20px;
          }
          .modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: #fff;
  width: 80%;
  max-width: 600px;
  height: 70vh;
  border-radius: 8px;
  position: relative;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 16px;
  background: #f1f1f1;
  display: flex;
  justify-content: flex-end;
}

.modal-body {
  padding: 16px;
  overflow-y: auto;
  flex-grow: 1;
}

.modal-header button {
  border: none;
  background: #ccc;
  cursor: pointer;
  padding: 4px 8px;
}

            
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="chat-header">
            <img src="/assets//images/avatar/robot.png" alt="Robot" />
            <h1>Test Chat for Agent {chatBot.agentId}</h1>
          </div>

          <div id="chat-container"></div>

          {/* ChatBot Details */}
          <div className="details-section">
            <h2>Chatbot Details</h2>
            <p>
              <strong>Name:</strong> {chatBot.name}
            </p>
            <p>
              <strong>Prompt:</strong> {chatBot.prompt}
            </p>
            <p>
              <strong>Temperature:</strong> {chatBot.temperature}
            </p>
            <p>
              <strong>Description:</strong> {chatBot.description}
            </p>
            <p>
              <strong>Is Approved?</strong> {chatBot.isApproved ? "Yes" : "No"}
            </p>
            <p>
              <strong>Status:</strong> {chatBot.status ? "Active" : "Inactive"}
            </p>
            <p>
              <strong>Initialized:</strong> {chatBot.initialized ? "Yes" : "No"}
            </p>
          </div>

          {/* Clients List */}
          <div className="details-section">
            <h2>Clients</h2>
            {chatBot.clients && chatBot.clients.length > 0 ? (
              <ul className="clients-list">
                {chatBot.clients.map((client) => (
                  <li key={client._id}>
                    {/* Adjust to your user's fields, e.g., client.email or client.name */}
                    {client.email}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No clients.</p>
            )}
          </div>

          {/* Documents List */}
          <div className="details-section">
            <h2>Documents</h2>
            {chatBot.documents && chatBot.documents.length > 0 ? (
              <ul className="documents-list">
                {chatBot.documents.map((docKey, idx) => (
                  <li key={idx}>
                    <a
                      href={buildFileUrl(fileBaseUrl, docKey)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {docKey}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No documents found.</p>
            )}
          </div>

          {/* Web URLs (optional) */}
          {chatBot.weburls && chatBot.weburls.length > 0 && (
            <div className="details-section">
              <h2>Web URLs</h2>
              <ul className="weburls-list">
                {chatBot.weburls.map((urlItem, idx) => (
                  <li key={idx}>
                    <a href={urlItem} target="_blank" rel="noreferrer">
                      {urlItem}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* MD File Section & Modal */}
          <div className="details-section">
            <h2>MD File</h2>
            {chatBot.mdFile ? (
              <>
                <p>
                  MD File Key: <code>{chatBot.mdFile}</code>
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleShowModal}
                >
                  Open MD File Content
                </button>
              </>
            ) : (
              <p>No MD File attached.</p>
            )}
          </div>

          {/* Modal for MD File */}
          {showModal && (
            <div className="modal-backdrop">
              <div className="modal-content">
                <div className="modal-header">
                  <button
                    onClick={handleCloseModal}
                    type="button"
                    className="btn btn-primary"
                  >
                    Close
                  </button>
                </div>
                <div className="modal-body">
                  <pre style={{ whiteSpace: "pre-wrap" }}>{mdContent}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
