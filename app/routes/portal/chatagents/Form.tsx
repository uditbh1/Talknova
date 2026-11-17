import { Form, useLoaderData } from "@remix-run/react";
import { useState, useEffect } from "react";
import SubmitButton from "~/components/ui/SubmitBtn";
import CancelBackBtn from "~/components/ui/CancelBackBtn";

function buildFileUrl(baseUrl: string, key: string) {
  if (!key) return "";
  if (/^https?:\/\//i.test(key)) return key;
  if (!baseUrl) return key;
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedKey = key.startsWith("/") ? key.slice(1) : key;
  return `${normalizedBase}${normalizedKey}`;
}

export default function ChatbotForm({ data = {}, AWSS3_BUCKET_FILES }) {
  /* ───────── Loader data ──────── */
  const { clients, canCreate, maxDocuments, remainingDocuments } =
    useLoaderData();

  /* ───────── Theme state ──────── */
  const defaults = {
    button: { backgroundColor: "#004729", iconColor: "#ffffff", size: 68 },
    tooltip: {
      tooltipMessage: "Hi There 👋!",
      tooltipBackgroundColor: "#004729",
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

  const [theme, setTheme] = useState(() => ({
    button: {
      backgroundColor:
        data.theme?.button?.backgroundColor ?? defaults.button.backgroundColor,
      iconColor: data.theme?.button?.iconColor ?? defaults.button.iconColor,
      size: data.theme?.button?.size ?? defaults.button.size,
    },
    tooltip: {
      tooltipMessage:
        data.theme?.tooltip?.tooltipMessage ?? defaults.tooltip.tooltipMessage,
      tooltipBackgroundColor:
        data.theme?.tooltip?.tooltipBackgroundColor ??
        defaults.tooltip.tooltipBackgroundColor,
    },
    chatWindow: {
      title: data.theme?.chatWindow?.title ?? defaults.chatWindow.title,
      welcomeMessage:
        data.theme?.chatWindow?.welcomeMessage ??
        defaults.chatWindow.welcomeMessage,
      backgroundColor:
        data.theme?.chatWindow?.backgroundColor ??
        defaults.chatWindow.backgroundColor,
      textColor:
        data.theme?.chatWindow?.textColor ?? defaults.chatWindow.textColor,
      headerColor:
        data.theme?.chatWindow?.headerColor ?? defaults.chatWindow.headerColor,
    },
  }));

  /* ───────── File state ──────── */
  const [fileInputs, setFileInputs] = useState<{ id: number }[]>([]);
  const [documents, setDocuments] = useState<
    { name: string; isNew: boolean }[]
  >((data.documents || []).map((d: string) => ({ name: d, isNew: false })));

  /* ───────── Preview chat state ──────── */
  const [previewMsgs, setPreviewMsgs] = useState<string[]>([
    theme.chatWindow.welcomeMessage,
  ]);
  const [draft, setDraft] = useState("");

  /* Keep first bubble synced with Welcome-Message input */
  useEffect(() => {
    setPreviewMsgs((old) => {
      const copy = [...old];
      copy[0] = theme.chatWindow.welcomeMessage;
      return copy;
    });
  }, [theme.chatWindow.welcomeMessage]);

  /* ───────── Helpers ──────── */
  const handleThemeChange = (
    section: keyof typeof theme,
    key: string,
    value: any,
  ) =>
    setTheme((prev) => ({
      ...prev,
      [section]: { ...(prev as any)[section], [key]: value },
    }));

  const handleAddFileInput = () => {
    try {
      console.log("[File Upload] Add another file clicked", {
        currentDocuments: documents.length,
        currentFileInputs: fileInputs.length,
        maxDocuments,
        remainingDocuments,
      });

      // Calculate current documents count (existing + new inputs)
      const currentCount = documents.length + fileInputs.length;

      // Use plan limit instead of hardcoded 15
      if (maxDocuments && currentCount >= maxDocuments) {
        const errorMsg = `You cannot upload more than ${maxDocuments} files. Your plan allows ${maxDocuments} documents.`;
        console.error("[File Upload] Plan limit exceeded:", {
          currentCount,
          maxDocuments,
          error: errorMsg,
        });
        alert(errorMsg);
        return;
      }

      // Also check remaining documents across all bots
      if (remainingDocuments !== undefined && remainingDocuments <= 0) {
        const errorMsg = `You have reached your plan's document limit of ${maxDocuments} documents across all chat agents.`;
        console.error("[File Upload] Remaining documents limit reached:", {
          remainingDocuments,
          maxDocuments,
          error: errorMsg,
        });
        alert(errorMsg);
        return;
      }

      const newInputId = Date.now();
      console.log("[File Upload] Adding new file input:", { id: newInputId });
      setFileInputs((fi) => [...fi, { id: newInputId }]);
    } catch (error) {
      console.error("[File Upload] Error in handleAddFileInput:", error);
      alert(
        `Error adding file input: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  };

  const handleDeleteDocument = (idx: number) =>
    setDocuments((docs) => docs.filter((_, i) => i !== idx));

  const handleDeleteFileInput = (id: number) =>
    setFileInputs((fi) => fi.filter((f) => f.id !== id));

  const handleSendPreview = (e: React.FormEvent) => {
    e.preventDefault();
    alert("This is only a preview – the real AI chat is not available here.");
  };

  /* ───────── Constant prompt text ──────── */
  const defaultPromptText = `You are "AI Assistant," a highly focused and knowledgeable virtual assistant. Your primary responsibility is to provide accurate and reliable answers strictly based on the information available in the provided knowledge documents. …`;

  /* ───────── Form submission handler ──────── */
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    try {
      console.log("[File Upload] Form submission started", {
        documentsCount: documents.length,
        fileInputsCount: fileInputs.length,
        totalFiles: documents.length + fileInputs.length,
      });

      // Validate that at least one file is selected or exists
      const fileInputElements = document.querySelectorAll<HTMLInputElement>(
        'input[type="file"][name="documents"]',
      );
      let hasFiles = false;

      fileInputElements.forEach((input, index) => {
        if (input.files && input.files.length > 0) {
          hasFiles = true;
          console.log(`[File Upload] File input ${index} has file:`, {
            fileName: input.files[0].name,
            fileSize: input.files[0].size,
          });
        }
      });

      if (documents.length === 0 && !hasFiles) {
        const errorMsg = "Please select at least one file to upload.";
        console.error("[File Upload] Form validation failed:", {
          error: errorMsg,
          documentsCount: documents.length,
          fileInputsCount: fileInputs.length,
        });
        alert(errorMsg);
        e.preventDefault();
        return;
      }

      console.log("[File Upload] Form validation passed, submitting...");
    } catch (error) {
      console.error("[File Upload] Error in form submission handler:", error);
      // Don't prevent submission, let server handle it
    }
  };

  /* ───────── Render ──────── */
  return (
    <Form
      method="post"
      encType="multipart/form-data"
      onSubmit={handleFormSubmit}
    >
      <div className="container-fluid">
        <div className="row">
          {/* ──────────── FORM side ──────────── */}
          <div className="col-lg-12">
            {/* ===== Basic settings ===== */}
            <div className="row">
              {canCreate?.message && (
                <div className="col-12">
                  <div className="alert alert-warning">{canCreate.message}</div>
                </div>
              )}

              <div className="col-lg-6">
                <div className="mb-3">
                  <label htmlFor="client" className="form-label">
                    Client
                  </label>
                  <select
                    id="client"
                    name="client"
                    className="form-select"
                    required
                    defaultValue={data.clients?.[0] ?? ""}
                  >
                    <option value="">Select Client</option>
                    {clients?.map((c: any) => (
                      <option key={c._id} value={c._id}>
                        {`${c.firstName} ${c.lastName}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="col-lg-6">
                <div className="mb-3">
                  <label htmlFor="name" className="form-label">
                    Ai Chat Agent Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    className="form-control"
                    minLength={3}
                    required
                    defaultValue={data.name}
                  />
                </div>
              </div>

              {/*  <div className="col-lg-4">
                <div className="mb-3">
                  <label htmlFor="temperature" className="form-label">
                    Temperature
                  </label>
                  <input
                    id="temperature"
                    name="temperature"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="0.9"
                    required
                    className="form-control"
                    defaultValue={data.temperature ?? 0.5}
                  />
                </div>
              </div> */}

              <div className="col-12">
                <div className="mb-3">
                  <label htmlFor="prompt" className="form-label">
                    Prompt
                  </label>
                  <textarea
                    id="prompt"
                    name="prompt"
                    rows={3}
                    required
                    className="form-control"
                    defaultValue={data.prompt ?? defaultPromptText}
                  />
                </div>
              </div>
            </div>

            {/* ===== Documents ===== */}
            <div className="row">
              <div className="col-12">
                <div className="card mb-4">
                  <div className="card-header">
                    <h5>
                      Documents{" "}
                      <small className="text-muted">
                        (knowledge base files)
                      </small>
                    </h5>
                  </div>
                  <div className="card-body">
                    {documents.length > 0 && (
                      <table className="table table-bordered">
                        <thead>
                          <tr>
                            <th>File Name</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {documents.map((doc, i) => (
                            <tr key={i}>
                              <td>
                                <a
                                  href={buildFileUrl(
                                    AWSS3_BUCKET_FILES,
                                    doc.name,
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {doc.name}
                                </a>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDeleteDocument(i)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {fileInputs.map((input) => (
                      <div
                        key={input.id}
                        className="d-flex align-items-center gap-2 mt-2"
                      >
                        <input
                          type="file"
                          name="documents"
                          accept=".pdf,.doc,.docx,.txt"
                          required
                          onChange={(e) => {
                            try {
                              const file = e.target.files?.[0];
                              if (file) {
                                console.log("[File Upload] File selected:", {
                                  fileName: file.name,
                                  fileSize: file.size,
                                  fileType: file.type,
                                  inputId: input.id,
                                });

                                // Validate file size (e.g., 50MB limit)
                                const maxSize = 50 * 1024 * 1024; // 50MB
                                if (file.size > maxSize) {
                                  const errorMsg = `File ${file.name} is too large. Maximum size is 50MB.`;
                                  console.error(
                                    "[File Upload] File size validation failed:",
                                    {
                                      fileName: file.name,
                                      fileSize: file.size,
                                      maxSize,
                                      error: errorMsg,
                                    },
                                  );
                                  alert(errorMsg);
                                  e.target.value = ""; // Clear the input
                                  return;
                                }

                                // Validate file type
                                const allowedTypes = [
                                  ".pdf",
                                  ".doc",
                                  ".docx",
                                  ".txt",
                                ];
                                const fileExtension =
                                  "." +
                                  file.name.split(".").pop()?.toLowerCase();
                                if (!allowedTypes.includes(fileExtension)) {
                                  const errorMsg = `File type ${fileExtension} is not allowed. Allowed types: ${allowedTypes.join(
                                    ", ",
                                  )}`;
                                  console.error(
                                    "[File Upload] File type validation failed:",
                                    {
                                      fileName: file.name,
                                      fileExtension,
                                      allowedTypes,
                                      error: errorMsg,
                                    },
                                  );
                                  alert(errorMsg);
                                  e.target.value = ""; // Clear the input
                                  return;
                                }
                              }
                            } catch (error) {
                              console.error(
                                "[File Upload] Error handling file selection:",
                                {
                                  inputId: input.id,
                                  error:
                                    error instanceof Error
                                      ? error.message
                                      : String(error),
                                },
                              );
                              alert(
                                `Error selecting file: ${
                                  error instanceof Error
                                    ? error.message
                                    : "Unknown error"
                                }`,
                              );
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteFileInput(input.id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      className="btn btn-link p-0 mt-2"
                      onClick={handleAddFileInput}
                    >
                      Add another file
                    </button>

                    {documents.map((doc, i) => (
                      <input
                        key={i}
                        type="hidden"
                        name="existingDocuments"
                        value={doc.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ===== Theme customisation ===== */}
            {/* ------------ Chat Box Header & colours (col-8 in design) ------------- */}
            <div className="row">
              <div className="col-12">
                <div className="card mb-4">
                  <div className="card-header">
                    <h5>Chat Box Theme Setting</h5>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      {/* --- Left side (designer col-lg-8) --- */}
                      <div className="col-lg-8">
                        <div className="row">
                          <h5 className="mb-3">Chat Box Header</h5>
                          {/* Title */}
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">
                                Chat Box Title
                              </label>
                              <input
                                type="text"
                                className="form-control"
                                name="theme[chatWindow][title]"
                                value={theme.chatWindow.title}
                                onChange={(e) =>
                                  handleThemeChange(
                                    "chatWindow",
                                    "title",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          {/* Greeting */}
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Greeting</label>
                              <input
                                type="text"
                                className="form-control"
                                name="theme[tooltip][tooltipMessage]"
                                value={theme.tooltip.tooltipMessage}
                                onChange={(e) =>
                                  handleThemeChange(
                                    "tooltip",
                                    "tooltipMessage",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          {/* Welcome Message */}
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">
                                Welcome Message
                              </label>
                              <textarea
                                className="form-control"
                                name="theme[chatWindow][welcomeMessage]"
                                value={theme.chatWindow.welcomeMessage}
                                onChange={(e) =>
                                  handleThemeChange(
                                    "chatWindow",
                                    "welcomeMessage",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          {/* Colours */}
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label">
                                Background Color
                              </label>
                              <input
                                type="color"
                                className="form-control form-control-color"
                                name="theme[chatWindow][backgroundColor]"
                                value={theme.chatWindow.backgroundColor}
                                onChange={(e) =>
                                  handleThemeChange(
                                    "chatWindow",
                                    "backgroundColor",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label">Text Color</label>
                              <input
                                type="color"
                                className="form-control form-control-color"
                                name="theme[chatWindow][textColor]"
                                value={theme.chatWindow.textColor}
                                onChange={(e) =>
                                  handleThemeChange(
                                    "chatWindow",
                                    "textColor",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label">
                                Message Background Color
                              </label>
                              <input
                                type="color"
                                className="form-control form-control-color"
                                name="theme[tooltip][tooltipBackgroundColor]"
                                value={theme.tooltip.tooltipBackgroundColor}
                                onChange={(e) =>
                                  handleThemeChange(
                                    "tooltip",
                                    "tooltipBackgroundColor",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label">Header Color</label>
                              <input
                                type="color"
                                className="form-control form-control-color"
                                name="theme[chatWindow][headerColor]"
                                value={theme.chatWindow.headerColor}
                                onChange={(e) =>
                                  handleThemeChange(
                                    "chatWindow",
                                    "headerColor",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>

                          {/* Chat Button settings header */}
                          <div className="col-md-12">
                            <h5>Chat Button On Your Website</h5>
                          </div>
                          {/* Chat Button fields */}
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label">
                                Background Color
                              </label>
                              <input
                                type="color"
                                className="form-control form-control-color"
                                name="theme[button][backgroundColor]"
                                value={theme.button.backgroundColor}
                                onChange={(e) =>
                                  handleThemeChange(
                                    "button",
                                    "backgroundColor",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label">Icon Color</label>
                              <input
                                type="color"
                                className="form-control form-control-color"
                                name="theme[button][iconColor]"
                                value={theme.button.iconColor}
                                onChange={(e) =>
                                  handleThemeChange(
                                    "button",
                                    "iconColor",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label">Size</label>
                              <input
                                type="number"
                                className="form-control"
                                name="theme[button][size]"
                                value={theme.button.size}
                                onChange={(e) =>
                                  handleThemeChange(
                                    "button",
                                    "size",
                                    Number(e.target.value),
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* --- Right side preview (designer col-lg-4) --- */}
                      <div className="col-lg-4 mt-4 mt-lg-0">
                        <div
                          className="card h-100 position-relative"
                          style={{
                            minHeight: 420,
                            maxHeight: 520,
                            backgroundColor: theme.chatWindow.backgroundColor,
                            color: theme.chatWindow.textColor,
                          }}
                        >
                          <div className="card-body d-flex flex-column p-0">
                            {/* Header (chart-header class preserved) */}
                            <h4
                              className="chart-header d-flex justify-content-between align-items-center m-0"
                              style={{
                                backgroundColor: theme.chatWindow.headerColor,
                                color: "#fff",
                                padding: "0.75rem 1rem",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                              }}
                            >
                              <span className="flex-grow-1">
                                {theme.chatWindow.title}
                              </span>
                              <span className="ms-2 flex-shrink-0">
                                <i
                                  data-feather="refresh-ccw"
                                  className="icon-xs me-2"
                                />
                                <i data-feather="x" className="icon-xs" />
                              </span>
                            </h4>

                            {/* Chat area */}
                            <div
                              className="ai-chat-area flex-grow-1 d-flex flex-column"
                              style={{ overflowY: "auto", padding: "1rem" }}
                            >
                              {previewMsgs.map((msg, i) => (
                                <div
                                  key={i}
                                  className="chat-msg mb-2 p-2 rounded"
                                  style={{
                                    maxWidth: "85%",
                                    backgroundColor:
                                      theme.tooltip.tooltipBackgroundColor,
                                    color: "#fff",
                                    alignSelf:
                                      i === 0 ? "flex-start" : "flex-end",
                                  }}
                                >
                                  {msg}
                                </div>
                              ))}
                            </div>

                            {/* Input */}
                            <div className="type-msg border-top">
                              <Form onSubmit={handleSendPreview}>
                                <div className="input-group">
                                  <input
                                    type="text"
                                    className="form-control rounded-0 border-0 py-4 bg-light"
                                    placeholder="Type a message"
                                    aria-describedby="button-addon2"
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                  />
                                  <div className="input-group-append">
                                    <button
                                      id="button-addon2"
                                      type="button"
                                      className="btn btn-link"
                                      onClick={() => {
                                        alert(
                                          "This is only a preview – the real AI chat is not available here.",
                                        );
                                        setPreviewMsgs((old) => [
                                          ...old,
                                          draft,
                                        ]);
                                        setDraft("");
                                      }}
                                    >
                                      <i
                                        data-feather="send"
                                        className="icon-sm"
                                      />
                                    </button>
                                  </div>
                                </div>
                              </Form>
                            </div>

                            {/* Floating chat button */}
                            <div
                              className="chat-button "
                              style={{
                                right: 16,
                                left: "50%",
                                bottom: 16,
                                width: theme.button.size,
                                height: theme.button.size,
                                borderRadius: "50%",
                                backgroundColor: theme.button.backgroundColor,
                                color: theme.button.iconColor,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <i
                                data-feather="message-circle"
                                className="icon-md"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* end col-lg-4 preview */}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== Submit / Cancel ===== */}
            <div className="d-flex justify-content-between mt-4">
              <SubmitButton className="btn btn-primary" />
              <CancelBackBtn />
            </div>
          </div>

          {/* ──────────── End form column ──────────── */}
        </div>

        {/* Hidden fields */}
        {data._id && <input type="hidden" name="_id" value={data._id} />}
        <input type="hidden" name="theme" value={JSON.stringify(theme)} />
      </div>
    </Form>
  );
}
