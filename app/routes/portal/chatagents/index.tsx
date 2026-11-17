import { redirect, json } from "@remix-run/node";
import {
  useLoaderData,
  useFetcher,
  useActionData,
  Link,
} from "@remix-run/react";
import { ChatBot } from "~/models/chatbot";
import { getUserFromSession } from "~/utils/auth.server";
import { useEffect, useState } from "react";
import feather from "feather-icons";
import bcrypt from "bcryptjs";
import { getCurrentPlan, canCreateBot } from "~/utils/plans";

import DisplayActionResponse from "~/components/ui/DisplayActionResponse";
// Import your User model if needed to reset password
import { User } from "~/models/user";
import { sendClientChatbotCredentialsEmail } from "~/utils/email.server"; // we'll define this below

///////////////////////////////////////////////////////////////////////////////
// 1) Loader
///////////////////////////////////////////////////////////////////////////////
export async function loader({ request }) {
  let user = await getUserFromSession(request);
  if (!user) return redirect("/login");
  const userId = user._id;

  const isSuperAdmin = user.roles.includes("SUPER_ADMIN");
  let chatbots = [];

  if (isSuperAdmin) {
    chatbots = await ChatBot.find()
      .sort({ createdAt: -1 })
      .populate("clients")
      .lean();
  } else {
    chatbots = await ChatBot.find({ clients: user._id })
      .sort({ createdAt: -1 })
      .populate("clients")
      .lean();
  }

  const canCreate = await canCreateBot(userId, user);
  const SITE_URL = process.env.SITE_URL;
  return json({ chatbots, isSuperAdmin, SITE_URL, canCreate });
}

// 2) Helper: talk to your express upsert service
// (unchanged from your snippet)
async function uploadDocToVectorDb(chatbot, docs, forceInit = false) {
  try {
    const baseUrl = process.env.QDRANT_UPSERT_SERVICE;
    const username = process.env.API_ENDPOINT_USERNAME;
    const password = process.env.API_ENDPOINT_PASSWORD;
    const agentName = chatbot.name;
    const agentId = chatbot.agentId;

    // Encode credentials to Base64
    const credentials = btoa(`${username}:${password}`);
    const authHeader = `Basic ${credentials}`;

    if (forceInit) {
      const removeRes = await fetch(`${baseUrl}/remove-by-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ agentName }),
      });
      if (!removeRes.ok) {
        console.log("[Remove response]", await removeRes.text());
        console.error(
          "Error removing existing vectors:",
          removeRes.status,
          removeRes.statusText,
        );
      }
    }

    const upsertPayload = {
      agentName: agentId,
      docs: docs.map((filename) => ({ filename })),
      metadata: { bot: agentId, agent: agentName, agentId },
    };

    console.log("[upsertPayload]", upsertPayload);

    const response = await fetch(`${baseUrl}/upsert-openai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(upsertPayload),
      // 300 seconds timeout
      signal: AbortSignal.timeout(300000), // 5 minutes
    });

    const text = await response.text();
    console.log("[Raw response text]", text);

    if (!response.ok) {
      console.error(
        "Upsert request failed:",
        response.status,
        response.statusText,
      );
    }

    try {
      const result = JSON.parse(text);
      console.log("[Parsed upsert result]", result);
      return result;
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError);
      return { status: false, error: "Invalid JSON response" };
    }
  } catch (error) {
    console.error("Error in uploadDocToVectorDb:", error);
    return { status: false, error: error.message };
  }
}

///////////////////////////////////////////////////////////////////////////////
// 3) Action
///////////////////////////////////////////////////////////////////////////////
export async function action({ request }) {
  const user = await getUserFromSession(request);
  if (!user) return json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const _action = formData.get("_action");
  const id = formData.get("id") || null;
  const forceInit = formData.get("forceInit") === "1"; // "1" => true

  // Toggle chatbot active/inactive
  if (_action === "TOGGLE_STATUS") {
    const chatbot = await ChatBot.findById(id);
    if (chatbot) {
      chatbot.status = !chatbot.status;
      chatbot.isApproved = chatbot.status;
      await chatbot.save();
    }
    return null;
  }

  // Create or re-create vectors
  if (_action === "CREATE_VECTOR") {
    const chatbot = await ChatBot.findById(id);
    let upsertMessages = [];

    if (!chatbot) {
      return json({ status: "ERROR", messages: ["Chatbot not found"] });
    }

    // 1) Must be approved
    if (!chatbot.isApproved) {
      return json({ status: "ERROR", messages: ["Chatbot not approved yet"] });
    }

    // 2) Gather docs => documents + otherFiles (if any)
    let docs = [...(chatbot.documents || [])];
    if (
      chatbot.otherFiles &&
      Array.isArray(chatbot.otherFiles) &&
      chatbot.otherFiles.length > 0
    ) {
      // Add otherFiles only if they are not empty
      chatbot.otherFiles = chatbot.otherFiles.filter(
        (file) => file && file.trim() !== "",
      );
      if (chatbot.otherFiles.length > 0) {
        upsertMessages.push(`Found ${chatbot.otherFiles.length} other files`);
      }
      // Add to docs array
      docs.push(...chatbot.otherFiles);
    } else {
      upsertMessages.push("No other files found");
    }

    if (docs.length === 0) {
      return json({
        status: "ERROR",
        messages: ["No documents or html files found"],
      });
    }

    // 3) Upsert vectors
    const upsertResult = await uploadDocToVectorDb(chatbot, docs, forceInit);
    if (!upsertResult?.status) {
      upsertMessages.push("Vector upsert failed");
      if (Array.isArray(upsertResult.results)) {
        upsertResult.results.forEach((result) => {
          if (result.message) {
            upsertMessages.push(result.message);
          }
        });
      }
      return json({ status: "ERROR", messages: upsertMessages });
    }

    // 4) Mark as initialized
    chatbot.initialized = true;
    await chatbot.save();

    upsertMessages.push("Chat agent is initialized (or re-initialized)");
    if (Array.isArray(upsertResult.results)) {
      upsertResult.results.forEach((result) => {
        if (result.message) {
          upsertMessages.push(result.message);
        }
      });
    }

    return json({ status: "OK", messages: upsertMessages });
  }

  // 4) SEND CREDENTIALS to a single client
  if (_action === "SEND_CREDENTIALS") {
    // We expect these fields from the form
    const chatbotId = formData.get("chatbotId");
    const clientId = formData.get("clientId");
    const plainPassword = (formData.get("password") || "").trim();

    // Basic checks
    if (!chatbotId || !clientId) {
      return json({
        status: "ERROR",
        messages: ["Missing chatbotId or clientId"],
      });
    }
    if (plainPassword.length < 6) {
      return json({
        status: "ERROR",
        messages: ["Password must be at least 6 characters"],
      });
    }

    // Fetch the chatbot & user
    const chatbot = await ChatBot.findById(chatbotId).lean();
    if (!chatbot) {
      return json({ status: "ERROR", messages: ["Chatbot not found"] });
    }
    const clientUser = await User.findById(clientId);
    if (!clientUser) {
      return json({ status: "ERROR", messages: ["Client user not found"] });
    }

    // Hash the password and update user
    //const hashedPassword = await bcrypt.hash(plainPassword, 10);
    clientUser.password = plainPassword;
    clientUser.status = true;
    // Optional: forcibly require password reset on next login, etc. => clientUser.forceReset = true
    await clientUser.save();

    // Build the embed code snippet (same as "Show Client Code" logic)
    const SITE_URL = process.env.SITE_URL;
    const codeSnippet = `<!-- Add this to your header or footer to initialize the chatbot -->
<script>
  window.chatbotConfig = {
    agentId: '${chatbot.agentId}',
  };
</script>
<script src="${SITE_URL}frontend/js/chat-bot.js"></script>`;

    // Send email with new password & code snippet
    try {
      const sent = await sendClientChatbotCredentialsEmail({
        clientUser,
        chatbot,
        plainPassword,
        codeSnippet,
      });
      if (!sent) {
        return json({
          status: "ERROR",
          messages: ["Unable to send email. Please check logs."],
        });
      }
      return json({
        status: "OK",
        messages: ["Password reset & email sent successfully"],
      });
    } catch (err) {
      console.error("Error sending client credentials email:", err);
      return json({ status: "ERROR", messages: [err.message] });
    }
  }

  return null;
}

///////////////////////////////////////////////////////////////////////////////
// 5) Default Export: UI
///////////////////////////////////////////////////////////////////////////////
export default function ChatbotList() {
  const { chatbots, isSuperAdmin, SITE_URL, canCreate } = useLoaderData();
  const fetcher = useFetcher(); // useFetcher for all POST actions
  const [showModal, setShowModal] = useState(false);
  const [selectedChatbot, setSelectedChatbot] = useState(null);
  const [copied, setCopied] = useState(false);

  // For sending credentials
  const [showSendCredsModal, setShowSendCredsModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [tempPassword, setTempPassword] = useState("");

  const actionResponse = useActionData();

  /////////////////////////////////////////////////////////////////////////////
  // Effects
  /////////////////////////////////////////////////////////////////////////////
  useEffect(() => {
    // Replace feather icons after render
    feather.replace();
  }, [chatbots]);

  /////////////////////////////////////////////////////////////////////////////
  // Helper to generate random password
  /////////////////////////////////////////////////////////////////////////////
  function generateRandomPassword(length = 8) {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /////////////////////////////////////////////////////////////////////////////
  // Named Functions
  /////////////////////////////////////////////////////////////////////////////

  // Toggle chatbot status
  const handleToggleStatus = (chatbotId) => {
    if (!isSuperAdmin) return; // Only super admin
    fetcher.submit(
      { _action: "TOGGLE_STATUS", id: chatbotId },
      { method: "post" },
    );
  };

  // Initialize or Re-Initialize
  const handleInitialize = (chatbot, force = false) => {
    if (!isSuperAdmin) {
      alert("Only Super Admin can initialize the chatbot");
      return;
    }
    // If re-initializing, confirm
    if (force) {
      const ok = window.confirm(
        "This will remove old vectors and re-create them. Proceed?",
      );
      if (!ok) return;
    }

    fetcher.submit(
      {
        _action: "CREATE_VECTOR",
        id: chatbot._id,
        forceInit: force ? "1" : "",
      },
      { method: "post" },
    );
  };

  // Show the embed code modal
  const showClientCode = (chatbot) => {
    if (!chatbot.status || !chatbot.initialized) {
      alert("Please activate and initialize the chatbot first.");
      return;
    }
    setSelectedChatbot(chatbot);
    setCopied(false);
    setShowModal(true);
  };

  // Hide the embed code modal
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedChatbot(null);
  };

  // Copy embed code
  const codeSnippet = selectedChatbot
    ? `<!-- Add this to your header or footer to initialize the chatbot -->
<script>
  window.chatbotConfig = {
    agentId: ${selectedChatbot.agentId},
  };
</script>
<script src="${SITE_URL}frontend/js/chat-bot.js"></script>`
    : "";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(codeSnippet).then(
      () => setCopied(true),
      (err) => {
        console.error("Could not copy text: ", err);
      },
    );
  };

  // -------------------------------------------
  // Show "Send Credentials" modal (Super Admin)
  // -------------------------------------------
  const openSendCredentialsModal = (chatbot, client) => {
    if (!isSuperAdmin) return;
    // Setup defaults
    setSelectedChatbot(chatbot);
    setSelectedClient(client);
    setTempPassword(generateRandomPassword(8));
    setShowSendCredsModal(true);
  };

  const closeSendCredsModal = () => {
    setShowSendCredsModal(false);
    setSelectedChatbot(null);
    setSelectedClient(null);
    setTempPassword("");
  };

  // Submit the new password & send email
  const handleSendCredentials = () => {
    if (!selectedChatbot || !selectedClient) return;
    // Validate length
    if (tempPassword.trim().length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }
    fetcher.submit(
      {
        _action: "SEND_CREDENTIALS",
        chatbotId: selectedChatbot._id,
        clientId: selectedClient._id,
        password: tempPassword,
      },
      { method: "post" },
    );
    // The result will come in fetcher.data
    closeSendCredsModal();
  };

  /////////////////////////////////////////////////////////////////////////////
  // Render
  /////////////////////////////////////////////////////////////////////////////
  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Chat Agents</h5>
        {/* Only super admin can add new agent */}

        <Link to="add" className="btn btn-primary">
          Add New Agent
        </Link>
      </div>

      <div className="card-body">
        {fetcher?.data && (
          <DisplayActionResponse actionResponse={fetcher.data} />
        )}

        {canCreate && canCreate.message && !isSuperAdmin && (
          <div className="col-lg-12">
            <div className="alert alert-warning">{canCreate.message}</div>
          </div>
        )}

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Name</th>
                <th>Temperature</th>
                <th>Documents</th>
                <th>URLs</th>
                <th>Initialize</th>
                <th>Added On</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {chatbots.map((chatbot) => (
                <tr key={chatbot._id}>
                  <td>
                    {chatbot?.clients
                      ? chatbot.clients
                          .map((client) =>
                            `${client.firstName || ""} ${
                              client.lastName || ""
                            }`.trim(),
                          )
                          .join(", ")
                      : ""}
                  </td>
                  <td>{chatbot.name}</td>
                  <td>{chatbot.temperature}</td>
                  <td>{chatbot.documents.length} files</td>
                  <td>{chatbot.weburls ? chatbot.weburls.length : 0}</td>
                  <td>
                    {chatbot.initialized ? (
                      // If super admin => re-init button. If normal user => show label
                      isSuperAdmin ? (
                        <button
                          type="button"
                          className="btn btn-warning"
                          onClick={() => handleInitialize(chatbot, true)}
                        >
                          {fetcher.state === "submitting"
                            ? "Please wait..."
                            : "Re-Initialize"}
                        </button>
                      ) : (
                        <span className="badge badge-info">Initialized</span>
                      )
                    ) : isSuperAdmin ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleInitialize(chatbot, false)}
                      >
                        {fetcher.state === "submitting"
                          ? "Please wait..."
                          : "Initialize"}
                      </button>
                    ) : (
                      <span className="badge badge-secondary">Not ready</span>
                    )}
                  </td>
                  <td>{new Date(chatbot.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      disabled={!isSuperAdmin}
                      onClick={() => handleToggleStatus(chatbot._id)}
                    >
                      {chatbot.status ? (
                        <span className="badge badge-success-soft">Active</span>
                      ) : (
                        <span className="badge badge-danger-soft">
                          Inactive
                        </span>
                      )}
                    </button>
                  </td>
                  <td>
                    {/* Edit Agent */}
                    <Link
                      to={`/portal/chatagents/${chatbot._id}`}
                      className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip"
                      data-template="eyeOne"
                    >
                      <i data-feather="edit" className="icon-xs" />
                    </Link>

                    {/* WebCrawler Setup */}
                    <Link
                      to={`/portal/chatagents/webcrawler/${chatbot._id}`}
                      className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip"
                      data-template="eyeOne"
                    >
                      <i
                        data-feather="globe"
                        className="icon-xs"
                        style={{
                          color:
                            chatbot.weburls && chatbot.weburls.length > 0
                              ? chatbot.isApproved !== true
                                ? "red"
                                : "green"
                              : "gray",
                        }}
                      />
                    </Link>

                    {/* Test Agent */}
                    <a
                      href={`/test-agent?agent=${chatbot.agentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip"
                      data-template="eyeOne"
                    >
                      <i data-feather="eye" className="icon-xs" />
                    </a>

                    {/* Show Embed Code */}
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip"
                      data-template="eyeOne"
                      onClick={() => showClientCode(chatbot)}
                    >
                      <i data-feather="code" className="icon-xs" />
                    </button>

                    {/* Send Credentials (key icon) - only if super admin AND there is at least 1 client */}
                    {isSuperAdmin &&
                      chatbot.clients &&
                      chatbot.clients.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm rounded-circle texttooltip"
                          data-template="eyeOne"
                          onClick={() =>
                            openSendCredentialsModal(
                              chatbot,
                              chatbot.clients[0],
                            )
                          }
                        >
                          <i data-feather="key" className="icon-xs" />
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 1) Modal for showing embed code */}
        {showModal && (
          <>
            <div
              className="modal fade show"
              tabIndex={-1}
              role="dialog"
              style={{ display: "block" }}
              aria-labelledby="clientCodeModalLabel"
              aria-hidden="false"
            >
              <div className="modal-dialog modal-lg" role="document">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title" id="clientCodeModalLabel">
                      Chatbot Initialization Code
                    </h5>
                    <button
                      type="button"
                      className="close"
                      onClick={handleCloseModal}
                    >
                      <span aria-hidden="true">&times;</span>
                    </button>
                  </div>
                  <div className="modal-body">
                    <p>
                      Please add the following code to your website's{" "}
                      <strong>header</strong> or <strong>footer</strong> to
                      initialize the chatbot:
                    </p>
                    <pre className="bg-light p-3">
                      <code>{codeSnippet}</code>
                    </pre>
                    <button
                      className="btn btn-primary"
                      onClick={copyToClipboard}
                    >
                      {copied ? "Copied!" : "Copy Code"}
                    </button>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCloseModal}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-backdrop fade show"></div>
          </>
        )}

        {/* 2) Modal for "Send Credentials" (Super Admin) */}
        {showSendCredsModal && selectedChatbot && selectedClient && (
          <>
            <div
              className="modal fade show"
              tabIndex={-1}
              role="dialog"
              style={{ display: "block" }}
              aria-labelledby="sendCredsModalLabel"
              aria-hidden="false"
            >
              <div className="modal-dialog" role="document">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title" id="sendCredsModalLabel">
                      Send Credentials to {selectedClient.firstName}{" "}
                      {selectedClient.lastName}
                    </h5>
                    <button
                      type="button"
                      className="close"
                      onClick={closeSendCredsModal}
                    >
                      <span aria-hidden="true">&times;</span>
                    </button>
                  </div>
                  <div className="modal-body">
                    <p className="text-danger">
                      <strong>Warning:</strong> Sending a new password will{" "}
                      <em>reset</em> this user's existing password. Are you
                      sure?
                    </p>
                    <p className="text-warning">
                      Email: {selectedClient.email}
                    </p>
                    <label htmlFor="passwordInput" className="form-label">
                      New Password (min 6 chars):
                    </label>
                    <input
                      type="text"
                      id="passwordInput"
                      className="form-control"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      minLength={6}
                    />
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={closeSendCredsModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSendCredentials}
                    >
                      Send Password
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-backdrop fade show"></div>
          </>
        )}
      </div>
    </div>
  );
}
