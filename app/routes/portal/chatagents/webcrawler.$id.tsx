import { redirect, json } from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  Form,
  useNavigation,
} from "@remix-run/react";
import { useState, useEffect } from "react";
import invariant from "tiny-invariant";
import feather from "feather-icons";
import { ChatBot } from "~/models/chatbot";
import { randomUUID } from "crypto";
import { getUserFromSession, requireUserSession } from "~/utils/auth.server";
import { getR2ObjectString, putR2TextObject } from "~/utils/r2.server";
import {
  extractMeaningfulText,
  fetchMeaningfulText,
} from "~/utils/web-content.server.js";

// Custom UI helpers
import SubmitButton from "~/components/ui/SubmitBtn";
import CancelBackBtn from "~/components/ui/CancelBackBtn";

/* -------------------------------------------------------------------------- */
/* Loader                                                                     */
/* -------------------------------------------------------------------------- */
function looksLikeHtmlDocument(value) {
  return /<html|<!doctype html|<body|<head|<main|<div/i.test(value);
}

function buildSnapshotUrl(key) {
  const baseUrl =
    process.env.R2_PUBLIC_URL || process.env.AWSS3_BUCKET_FILES || "";

  if (!baseUrl) return "";
  return `${baseUrl.replace(/\/$/, "")}/${String(key).replace(/^\//, "")}`;
}

function buildClientSnapshotUrl(baseUrl, key) {
  if (!baseUrl || !key) return "";
  return `${String(baseUrl).replace(/\/$/, "")}/${String(key).replace(
    /^\//,
    "",
  )}`;
}

export async function loader({ request, params }) {
  const user = await getUserFromSession(request);
  if (!user) return redirect("/login");
  console.log("Loading webcrawler for user:", user);
  invariant(params.id, "Expected 'id' in URL params.");
  const roles = user?.roles || [];
  const isAdmin = roles.includes("SUPER_ADMIN");

  const chatbot = await ChatBot.findById(params.id).lean();
  if (!chatbot) throw new Response("ChatBot not found.", { status: 404 });

  return json({
    chatbot,
    isAdmin,
    snapshotBaseUrl:
      process.env.R2_PUBLIC_URL || process.env.AWSS3_BUCKET_FILES || "",
  });
}

/* -------------------------------------------------------------------------- */
/* Action                                                                     */
/* -------------------------------------------------------------------------- */
export async function action({ request, params }) {
  await requireUserSession(request);
  invariant(params.id, "Expected 'id' in URL params.");

  const formData = await request.formData();
  const intent = formData.get("intent");

  const chatbot = await ChatBot.findById(params.id);
  if (!chatbot)
    return json({ formError: "ChatBot not found." }, { status: 404 });

  /* --------------------------- ADMIN APPROVE ----------------------------- */
  if (intent === "approve") {
    chatbot.isApproved = true;
    await chatbot.save();
    return redirect("/portal/chatagents");
  }

  /* ------------------------------ CRAWL ---------------------------------- */
  if (intent === "crawl") {
    try {
      const urls = formData.getAll("weburls");
      if (urls.length === 0)
        return json({ crawlerError: "No URLs supplied." }, { status: 400 });

      /* -------------------- DOWNLOAD & UPLOAD LOOP ----------------------- */
      const keys = [];
      for (const url of urls) {
        const content = await fetchMeaningfulText(String(url));
        const key = `${randomUUID()}.txt`;

        await putR2TextObject({
          key,
          body: content,
          contentType: "text/plain; charset=utf-8",
        });
        keys.push(key);
      }

      /* ------------- SAVE NEW SNAPSHOTS & CLEAR mdFile ------------------- */
      chatbot.otherFiles = keys; // overwrite previous
      chatbot.mdFile = "";
      await chatbot.save();

      return json({
        newOtherFiles: keys,
        crawlerSuccess:
          "Pages were converted into clean text and stored successfully.",
      });
    } catch (err) {
      console.error(err);
      return json({ crawlerError: err.message });
    }
  }

  /* ---------------------------- PREVIEW --------------------------------- */
  if (intent === "preview") {
    try {
      const key = String(formData.get("key") || "").trim();
      if (!key) {
        return new Response("Missing snapshot key.", {
          status: 400,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }

      const content = await getR2ObjectString(key);
      const previewText = looksLikeHtmlDocument(content)
        ? extractMeaningfulText(content, buildSnapshotUrl(key) || key)
        : content;

      return new Response(previewText, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      console.error(err);
      return new Response(err.message || "Failed to load snapshot.", {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
  }

  /* ---------------------- SAVE / UPDATE URL LIST ------------------------ */
  const rawUrls = formData.getAll("weburls");
  const agreed = formData.get("agreed") === "on";

  if (!agreed)
    return json(
      {
        fieldErrors: {
          checkbox: "You must agree to the terms and conditions.",
        },
      },
      { status: 400 },
    );

  if (rawUrls.length === 0)
    return json(
      { fieldErrors: { weburls: "At least one URL is required." } },
      { status: 400 },
    );

  if (rawUrls.length > 100)
    return json(
      { fieldErrors: { weburls: "You can only add up to 100 URLs." } },
      { status: 400 },
    );

  const badExt = [
    ".pdf",
    ".doc",
    ".docx",
    ".zip",
    ".xlsx",
    ".txt",
    ".jpg",
    ".png",
    ".jpeg",
    ".gif",
  ];
  for (const u of rawUrls) {
    if (!/^https:\/\//i.test(u))
      return json(
        {
          fieldErrors: {
            weburls: `Invalid URL: ${u} (must start with https://)`,
          },
        },
        { status: 400 },
      );
    if (badExt.some((ext) => u.toLowerCase().endsWith(ext)))
      return json(
        {
          fieldErrors: {
            weburls: `Invalid URL: ${u} (looks like a file link)`,
          },
        },
        { status: 400 },
      );
  }

  chatbot.weburls = rawUrls;
  chatbot.isApproved = false; // needs re-approval
  await chatbot.save();

  return redirect("/portal/chatagents");
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */
export default function WebcrawlerPage() {
  const { chatbot, isAdmin, snapshotBaseUrl } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();

  const [weburls, setWeburls] = useState(() =>
    chatbot.weburls?.length ? chatbot.weburls : [""],
  );
  const [otherFiles, setOtherFiles] = useState(chatbot.otherFiles || []);
  const [showModal, setShowModal] = useState(false);
  const [snapshotText, setSnapshotText] = useState("");
  const [agreed, setAgreed] = useState(false);

  const isCrawling =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "crawl";

  /* ------- feedback from server actions ------- */
  useEffect(() => {
    if (actionData?.crawlerSuccess) alert(actionData.crawlerSuccess);
    if (actionData?.crawlerError) alert(actionData.crawlerError);
    if (actionData?.newOtherFiles) setOtherFiles(actionData.newOtherFiles);
  }, [actionData]);

  /*  feather icons refresh  */
  useEffect(() => {
    feather.replace();
  }, [weburls, otherFiles]);

  const badExt = [
    ".pdf",
    ".doc",
    ".docx",
    ".zip",
    ".xlsx",
    ".txt",
    ".jpg",
    ".png",
    ".jpeg",
    ".gif",
  ];
  const isValid = (u) =>
    /^https:\/\//i.test(u) &&
    !badExt.some((ext) => u.toLowerCase().endsWith(ext));

  const addUrl = () => {
    if (weburls.some((u) => !isValid(u)))
      return alert("Fix invalid URLs first.");
    if (weburls.length >= 100) return alert("Only 100 URLs allowed.");
    setWeburls((prev) => [...prev, ""]);
  };

  const rmUrl = (i) => {
    if (weburls.length === 1) return;
    if (confirm("Delete this URL?"))
      setWeburls((prev) => prev.filter((_, idx) => idx !== i));
  };

  const change = (i, v) =>
    setWeburls((prev) => prev.map((u, idx) => (idx === i ? v : u)));

  const showSnapshot = async (key, snapshotUrl) => {
    try {
      const publicUrl =
        snapshotUrl || buildClientSnapshotUrl(snapshotBaseUrl, key);
      let res;

      if (publicUrl) {
        res = await fetch(publicUrl, {
          method: "GET",
          headers: {
            Accept: "text/plain",
          },
          cache: "no-store",
        });
      }

      if (!res || !res.ok) {
        const fd = new FormData();
        fd.append("intent", "preview");
        fd.append("key", key);
        res = await fetch(window.location.pathname, {
          method: "POST",
          body: fd,
          headers: {
            Accept: "text/plain",
          },
        });
      }

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `Failed to load: ${res.statusText}`);
      }

      setSnapshotText(text || "");
      setShowModal(true);
    } catch (e) {
      alert(e.message);
    }
  };

  /* ------------------------------ UI ------------------------------------ */
  return (
    <div className="card">
      <div className="card-header d-flex align-items-center justify-content-between">
        <span className="fw-bold">
          Add Webpages to the Chat Agent&apos;s Knowledge Base
        </span>
      </div>

      <div className="card-body">
        {snapshotBaseUrl && (
          <div className="alert alert-secondary py-2 small" role="alert">
            Snapshot public base URL: {snapshotBaseUrl}
          </div>
        )}

        {/* Notice */}
        <div className="alert alert-primary" role="alert">
          <strong>Important Notice:</strong>
          <p className="mb-0">
            Ensure the URLs you add are legal and appropriate. You take full
            responsibility for submitted content.
          </p>
        </div>

        {/* Status & Approve */}
        <div className="mb-3 d-flex align-items-center">
          <div>
            <strong>Status:</strong>{" "}
            {chatbot.isApproved ? (
              <span className="badge bg-success">Approved</span>
            ) : (
              <span className="badge bg-warning text-dark">
                Pending Approval
              </span>
            )}
          </div>
          {!chatbot.isApproved && isAdmin && (
            <Form method="post" className="ms-3">
              <button
                type="submit"
                name="intent"
                value="approve"
                className="btn btn-sm btn-secondary"
              >
                Approve
              </button>
            </Form>
          )}
        </div>

        {/* Snapshot list */}
        {otherFiles.length > 0 && (
          <div className="mb-3">
            <h6>Uploaded snapshots:</h6>
            <ul className="list-group">
              {otherFiles.map((k) => {
                const snapshotUrl = buildClientSnapshotUrl(snapshotBaseUrl, k);

                return (
                  <li
                    key={k}
                    className="list-group-item d-flex justify-content-between align-items-center"
                  >
                    <span className="text-truncate" style={{ maxWidth: "80%" }}>
                      {k.split("/").pop()}
                    </span>
                    <span className="text-muted small ms-2 me-auto">{k}</span>
                    <a
                      className="btn btn-sm btn-outline-primary"
                      href={snapshotUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => {
                        if (isCrawling) {
                          event.preventDefault();
                          return;
                        }

                        event.preventDefault();
                        showSnapshot(k, snapshotUrl);
                      }}
                      aria-disabled={isCrawling}
                    >
                      View
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Crawl button (only if approved) */}
        {chatbot.isApproved && (
          <Form method="post" className="d-inline">
            <button
              name="intent"
              value="crawl"
              type="submit"
              className="btn btn-primary mb-3 me-3"
              disabled={isCrawling}
            >
              {isCrawling ? "Crawling..." : "Crawl Pages"}
            </button>
            {weburls.map((u, i) => (
              <input key={i} type="hidden" name="weburls" value={u} />
            ))}
            {isCrawling && (
              <div className="d-inline-flex align-items-center text-muted small mb-3">
                <span
                  className="spinner-border spinner-border-sm me-2"
                  aria-hidden="true"
                />
                Fetching pages and extracting readable content...
              </div>
            )}
          </Form>
        )}

        {/* Text preview modal */}
        {showModal && (
          <div className="modal d-block" tabIndex="-1">
            <div className="modal-dialog modal-xl modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Text Snapshot</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowModal(false)}
                  />
                </div>
                <div className="modal-body">
                  <textarea
                    className="form-control"
                    rows={20}
                    value={snapshotText}
                    readOnly
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* URL list form */}
        <Form method="post">
          {/* Global / field errors */}
          {actionData?.formError && (
            <div className="alert alert-danger">{actionData.formError}</div>
          )}
          {actionData?.fieldErrors?.weburls && (
            <div className="alert alert-danger">
              {actionData.fieldErrors.weburls}
            </div>
          )}

          {/* Dynamic URL inputs */}
          <div className="mb-3">
            {weburls.map((u, i) => (
              <div key={i} className="input-group mb-2">
                <span className="input-group-text">{i + 1}</span>
                <input
                  type="text"
                  name="weburls"
                  className="form-control"
                  placeholder="Enter HTTPS URL"
                  value={u}
                  onChange={(e) => change(i, e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={() => rmUrl(i)}
                  disabled={weburls.length === 1}
                >
                  <i data-feather="x-circle" className="icon-xs" />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-link p-0" onClick={addUrl}>
              Add More
            </button>
          </div>

          {/* Checkbox error */}
          {actionData?.fieldErrors?.checkbox && (
            <div className="alert alert-danger">
              {actionData.fieldErrors.checkbox}
            </div>
          )}

          {/* Submit / Cancel / Agreement */}
          <div className="d-flex justify-content-end align-items-center gap-3">
            <SubmitButton className="btn btn-success" disabled={!agreed} />
            <CancelBackBtn />
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="agreeCheckbox"
                name="agreed"
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="agreeCheckbox">
                I agree to take responsibility for the URLs I am adding.
              </label>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}
