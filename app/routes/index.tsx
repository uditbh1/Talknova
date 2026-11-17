/* ---------------------------------------------------------------------- */
/*  app/routes/_index.tsx (Remix v2, TS) – updated with new UI & toggle   */
/* ---------------------------------------------------------------------- */
import { useLoaderData, useActionData, Link, Form } from "@remix-run/react";
import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useEffect, useState, useRef } from "react";
import Typed from "typed.js";
import ReCAPTCHA from "react-google-recaptcha";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
// FlowiseChat component import removed - not currently used (embedded chatbot uses inline initialization)
// import { FlowiseChat } from '~/components/FlowiseChat';

// Type declaration for Flowise web component (optional - TypeScript may not recognize web components)
// Using @ts-ignore on the element itself as a workaround

/* ───── Models ───── */
import { getUserFromSession } from "~/utils/auth.server";
import { ContactUsModel } from "~/models/contact";
import { PlanModel } from "~/models/plan";
import type { Plan } from "~/routes/portal/plans/index";

/* ───── Layout & Error ───── */
import FrontLayout from "~/components/FrontLayout";
import ErrorBoundary from "~/components/ErrorBoundary";

/* ───── Frontend CSS ───── */
import { frontendLinks } from "~/utils/frontend-links";
export const links = frontendLinks;

/* ---------------------------------------------------------------------- */
/*  LOADER                                                                */
/* ---------------------------------------------------------------------- */
type LoaderData = {
  user: any;
  AWSS3_BUCKET_FILES: string;
  RECAPTCHA_SITE_KEY: string;
  plans: Plan[];
};

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const [user, plans] = await Promise.all([
      getUserFromSession(request),
      PlanModel.find({
        isActive: true,
        isDeleted: false,
        isDefault: true,
      })
        .lean()
        .select(
          "name price yearlyPrice maxDocuments maxFileSize maxUrls defaultPlanType",
        )
        .exec(),
    ]);

    console.log("Loader user:", plans);

    return json<LoaderData>({
      user,
      plans,
      AWSS3_BUCKET_FILES: process.env.AWSS3_BUCKET_FILES ?? "",
      RECAPTCHA_SITE_KEY: process.env.RECAPTCHA_SITE_KEY ?? "",
    });
  } catch (error) {
    console.error("Index loader error:", error);
    throw new Error("Failed to load page data");
  }
};

/* ---------------------------------------------------------------------- */
/*  ACTION (contact‑us form)                                              */
/* ---------------------------------------------------------------------- */
export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const { name, email, phone, company, message, recaptchaToken } =
    Object.fromEntries(formData);

  if (!recaptchaToken) {
    return json(
      { success: false, message: "Please complete the reCAPTCHA verification" },
      { status: 400 },
    );
  }

  /* ---- Verify reCAPTCHA ---- */
  const recaptchaRes = await fetch(
    "https://www.google.com/recaptcha/api/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
    },
  ).then((r) => r.json());

  if (!recaptchaRes.success) {
    return json(
      { success: false, message: "reCAPTCHA verification failed" },
      { status: 400 },
    );
  }

  /* ---- Save message ---- */
  try {
    await ContactUsModel.create({ name, email, phone, company, message });
    return json({
      success: true,
      message: "Thank you for your message. We will contact you soon!",
    });
  } catch (err) {
    console.error("Contact form error:", err);
    return json(
      { success: false, message: "An error occurred. Please try again later." },
      { status: 500 },
    );
  }
};

/* ---------------------------------------------------------------------- */
/*  COMPONENT                                                             */
/* ---------------------------------------------------------------------- */
export default function Index() {
  const { user, RECAPTCHA_SITE_KEY, plans } = useLoaderData<LoaderData>();
  const actionData = useActionData<typeof action>();
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const flowiseRef = useRef<HTMLDivElement>(null);
  const [chatResetKey, setChatResetKey] = useState(0);

  // Initialize embedded Flowise chatbot in AI Support tab
  useEffect(() => {
    if (typeof window === "undefined") return; // SSR guard
    let cancelled = false;

    const agentId = 175330218138519;
    const clientId = agentId;

    /* helper: find the localStorage key that ends with "_EXTERNAL" */
    function getFlowiseKey(chatflowId: string) {
      return Object.keys(localStorage).find(
        (k) => k.startsWith(chatflowId) && k.endsWith("_EXTERNAL"),
      );
    }

    (async () => {
      try {
        // Load the correct Flowise embed library for fullchatbot element
        // NOTE: Using 'flowise-embed' (not 'FlowiseChatEmbed') because we need Chatbot.init() for embedded chatbot
        const { default: Chatbot } = await import(
          "https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js"
        );
        if (cancelled) return;

        // Wait for DOM to be ready and flowise-fullchatbot element to exist
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check if flowise-fullchatbot element exists
        const fullchatbotElement = document.querySelector(
          "flowise-fullchatbot",
        );
        if (!fullchatbotElement) {
          console.warn(
            "flowise-fullchatbot element not found, chatbot may not initialize",
          );
          return;
        }

        // Fetch chatbot configuration
        const response = await fetch("https://www.talknova.ai/api/chatagent", {
          method: "POST",
          body: new URLSearchParams({ id: agentId.toString() }),
        });

        if (!response.ok) {
          throw new Error("Failed to load chatbot configuration");
        }

        const CHATFLOW_ID = "e7b45b6f-14f0-4430-b005-ea25f107d88c";

        /* ------- local, persistent chatId fallback ------- */
        const KEY = `flowise-chat-${clientId}`;
        let fallbackChatId = localStorage.getItem(KEY);
        if (!fallbackChatId) {
          /* crypto.randomUUID is native in all modern browsers ≥ 92 / 95 / 15.4 */
          fallbackChatId = crypto.randomUUID();
          localStorage.setItem(KEY, fallbackChatId);
        }

        const data = await response.json();
        const { prompt, botName, _id, theme } = data;

        console.log("Chatbot configuration:>>>>", data);

        // Initialize embedded Chatbot (not initFull - that creates full-screen overlay)
        // Chatbot.init() initializes the flowise-fullchatbot element that exists in the DOM
        if (typeof Chatbot !== "undefined") {
          Chatbot.init({
            chatflowid: CHATFLOW_ID,
            apiHost: "https://flowise.aidera.co.uk",
            chatflowConfig: {
              responsePrompt: prompt,
              returnSourceDocuments: false,
              qdrantFilter: {
                should: [
                  {
                    key: "metadata.bot",
                    match: {
                      value: agentId,
                    },
                  },
                ],
              },
            },
            overrideConfig: { vars: { clientId: agentId } },
            observersConfig: {
              observeMessages: () => {
                /* read the up-to-date blob from localStorage */
                const key = getFlowiseKey(CHATFLOW_ID);
                if (!key) return; /* first few ms before Flowise writes */
                let raw;
                try {
                  raw = JSON.parse(localStorage.getItem(key) || "{}");
                } catch {
                  return;
                }

                /* POST everything to Remix */
                fetch("/api/chatevents", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    clientId,
                    chatId: raw.chatId,
                    agent: _id, // Flowise agent ID
                    lead: raw.lead, // {name,email,phone}
                    transcript: raw.chatHistory, // [{message,type,dateTime,…}]
                  }),
                }).catch(console.error);
              },
            },
            theme: theme, // Include the theme from API response
          });
        } else {
          console.error("Chatbot script not loaded.");
        }
      } catch (error) {
        console.error("Error initializing chatbot:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ====================================================================== */
  /* DELETED CODE - OLD initFull() IMPLEMENTATION (kept for revert reference) */
  /* ====================================================================== */
  /*
  // OLD CODE - This used Chatbot.initFull() which creates a full-screen overlay modal
  // NOT suitable for embedded chatbot-app div. This was the reason AI Support tab showed empty.
  // 
  // If you need to revert, restore this code and:
  // 1. Change import back to: 'https://cdn.jsdelivr.net/gh/xor83/FlowiseChatEmbed/dist/web.js'
  // 2. Change Chatbot.init() back to Chatbot.initFull()
  // 3. Remove the flowise-fullchatbot element check
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const agentId = 175330218138519;
    const clientId = agentId;
    function getFlowiseKey(chatflowId: string) {
      return Object.keys(localStorage).find(k => k.startsWith(chatflowId) && k.endsWith('_EXTERNAL'));
    }
    (async () => {
      try {
        const { default: Chatbot } = await import('https://cdn.jsdelivr.net/gh/xor83/FlowiseChatEmbed/dist/web.js');
        if (cancelled) return;
        await new Promise(resolve => setTimeout(resolve, 1000));
        const response = await fetch('https://www.talknova.ai/api/chatagent', {
          method: 'POST',
          body: new URLSearchParams({ id: agentId }),
        });
        if (!response.ok) throw new Error('Failed to load chatbot configuration');
        const CHATFLOW_ID = 'e7b45b6f-14f0-4430-b005-ea25f107d88c';
        const KEY = `flowise-chat-${clientId}`;
        let fallbackChatId = localStorage.getItem(KEY);
        if (!fallbackChatId) {
          fallbackChatId = crypto.randomUUID();
          localStorage.setItem(KEY, fallbackChatId);
        }
        const data = await response.json();
        const { prompt, botName, _id, theme } = data;
        console.log('Chatbot configuration:>>>>', data);
        if (typeof Chatbot !== 'undefined') {
          Chatbot.initFull({  // <-- THIS WAS THE PROBLEM: initFull() creates full-screen overlay
            chatflowid: CHATFLOW_ID,
            apiHost: 'https://flowise.aidera.co.uk',
            chatflowConfig: {
              responsePrompt: prompt,
              returnSourceDocuments: false,
              qdrantFilter: {
                should: [{ key: 'metadata.bot', match: { value: agentId } }],
              },
            },
            overrideConfig: { vars: { clientId: agentId } },
            observersConfig: {
              observeMessages: () => {
                const key = getFlowiseKey(CHATFLOW_ID);
                if (!key) return;
                let raw;
                try {
                  raw = JSON.parse(localStorage.getItem(key) || '{}');
                } catch { return; }
                fetch('/api/chatevents', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    clientId,
                    chatId: raw.chatId,
                    agent: _id,
                    lead: raw.lead,
                    transcript: raw.chatHistory,
                  }),
                }).catch(console.error);
              },
            },
            theme: theme,
          });
        } else {
          console.error('Chatbot script not loaded.');
        }
      } catch (error) {
        console.error('Error initializing chatbot:', error);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  */
  /* ====================================================================== */

  /* ---- Typed.js banner text ---- */
  useEffect(() => {}, []);

  /* ---- Toasts ---- */
  useEffect(() => {
    if (!actionData) return;
    actionData.success
      ? toast.success(actionData.message)
      : toast.error(actionData.message);
    if (actionData.success) {
      formRef.current?.reset();
      recaptchaRef.current?.reset();
    }
  }, [actionData]);

  /* ---- reCAPTCHA only on client ---- */
  const [showRecaptcha, setShowRecaptcha] = useState(false);
  useEffect(() => setShowRecaptcha(true), []);

  /* ---- AI Support Chat Functions ---- */
  // Function to reload/reset chat for AI Support tab
  const handleReloadChat = () => {
    // Clear chat history from DOM
    const chatArea = document.querySelector(".ai-chat-messages .ai-chat");
    if (chatArea) {
      // Clear all messages except the initial greeting
      const greeting = chatArea.querySelector(".sender:first-child");
      chatArea.innerHTML = "";

      // Re-add the greeting immediately
      if (greeting) {
        chatArea.appendChild(greeting.cloneNode(true));
      } else {
        // If greeting doesn't exist, create it
        const greetingDiv = document.createElement("div");
        greetingDiv.className = "sender";
        greetingDiv.innerHTML = `
          <div class="recent-message-box">
            <div class="img-message-box">
              <img src="/frontend/images/logo.png" alt="Chat" />
            </div>
            <div class="detail-message-box">
              <span>Hi there!</span>
            </div>
            <div class="sender-msg">
              <p>Hi there 👋</p>
              <p>You are now speaking with TalkNova. How can I help?</p>
            </div>
          </div>
        `;
        chatArea.appendChild(greetingDiv);
      }
    }

    // Clear chat history from localStorage
    const CHATFLOW_ID = "e7b45b6f-14f0-4430-b005-ea25f107d88c";
    const agentId = 175330218138519;
    const KEY = `flowise-chat-${agentId}`;

    try {
      const flowiseData = JSON.parse(localStorage.getItem(KEY) || "{}");
      flowiseData.chatHistory = [];
      localStorage.setItem(KEY, JSON.stringify(flowiseData));
    } catch (e) {
      console.warn("Could not clear chat history", e);
    }

    // Increment reset key to force re-render
    setChatResetKey((prev) => prev + 1);
  };

  /* ---- Load social media scripts ---- */
  useEffect(() => {
    if (typeof window === "undefined") return; // SSR guard

    // Load Instagram embed script
    const instagramScript = document.createElement("script");
    instagramScript.async = true;
    instagramScript.src = "//www.instagram.com/embed.js";
    document.body.appendChild(instagramScript);

    // Load Twitter embed script
    const twitterScript = document.createElement("script");
    twitterScript.async = true;
    twitterScript.src = "https://platform.twitter.com/widgets.js";
    twitterScript.charset = "utf-8";
    document.body.appendChild(twitterScript);

    // Cleanup function
    return () => {
      // Remove scripts on unmount
      const scripts = document.querySelectorAll(
        'script[src*="instagram.com"], script[src*="twitter.com"]',
      );
      scripts.forEach((script) => script.remove());
    };
  }, []);

  /* ---- Billing toggle (Monthly / Yearly) ---- */
  const [billingPeriod, setBillingPeriod] = useState<"MONTHLY" | "YEARLY">(
    "MONTHLY",
  );
  const toggleBilling = () =>
    setBillingPeriod((prev) => (prev === "MONTHLY" ? "YEARLY" : "MONTHLY"));

  /* ---- Reviews state ---- */
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  /* ---- Fetch reviews ---- */
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch("/api/reviews");
        const data = await response.json();
        setReviews(data.reviews || []);
      } catch (error) {
        console.error("Error fetching reviews:", error);
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchReviews();
  }, []);

  /* ---- Format date helper ---- */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  /* ---- Render star rating ---- */
  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <span className="text-warning me-0">
        {[...Array(fullStars)].map((_, i) => (
          <i
            key={`full-${i}`}
            className="fas fa-star fs-0"
            aria-hidden="true"
          ></i>
        ))}
        {hasHalfStar && (
          <i className="fas fa-star-half-stroke fs-0" aria-hidden="true"></i>
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <i
            key={`empty-${i}`}
            className="far fa-star fs-0"
            aria-hidden="true"
          ></i>
        ))}
      </span>
    );
  };

  /* ---- Generate initials from name ---- */
  const getInitials = (name) => {
    if (!name) return "";
    const words = name.trim().split(" ");
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (
      words[0].charAt(0).toUpperCase() +
      words[words.length - 1].charAt(0).toUpperCase()
    );
  };

  /* ---- Render helpers ---- */
  const formatPrice = (p: number) => `£${p.toFixed(2)}`;

  return (
    <FrontLayout>
      <ToastContainer />

      {/* ─────────────────────────  HERO / BANNER  ───────────────────────── */}
      <section className="new-banner">
        <div className="container">
          <div className="row">
            {/* Left column – headline & CTA */}
            <div className="col-lg-6 col-md-6">
              <h1>
                AI‑powered multilingual
                <br /> support assistant for your <br /> website
              </h1>

              {/* Desktop CTAs */}
              <div className="d-none d-md-block mt-4">
                <Link to="/signup" className="document-btn me-2">
                  Start Free Trial
                </Link>
                <a
                  href="/contact-us"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="document-btn me-2"
                >
                  Book a Demo
                </a>
                <Link to="/contact-us" className="document-btn">
                  Contact&nbsp;Us
                </Link>
              </div>
            </div>

            {/* Right column – Chatbot mock‑up (static HTML from designer) */}
            <div className="col-lg-6 col-md-6 banner-right">
              {/* ----  Tabs scaffold copied & converted to JSX ---- */}
              <div className="chatbot-app">
                <ul className="nav nav-pills" id="bannerTabs" role="tablist">
                  {[
                    { id: "home", icon: "fa-home", label: "Home" },
                    {
                      id: "support",
                      icon: "fa-envelope-open",
                      label: "AI Support",
                    },
                    {
                      id: "review",
                      icon: "fa-star-half-alt",
                      label: "Reviews",
                    },
                    { id: "media", icon: "fa-mobile", label: "Media" },
                  ].map(({ id, icon, label }, idx) => (
                    <li className="nav-item" role="presentation" key={id}>
                      <button
                        className={`nav-link ${idx === 0 ? "active" : ""}`}
                        id={`${id}-tab`}
                        data-bs-toggle="pill"
                        data-bs-target={`#tab-${id}`}
                        type="button"
                        role="tab"
                        aria-controls={`tab-${id}`}
                        aria-selected={idx === 0}
                      >
                        <span>
                          <i className={`fas ${icon}`} />
                        </span>
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="tab-content" id="bannerTabsContent">
                  {/* Only the “Home” tab is kept live for brevity */}
                  <div
                    className="tab-pane fade show active"
                    id="tab-home"
                    role="tabpanel"
                    aria-labelledby="home-tab"
                  >
                    {/* Logo + greeting */}
                    <div className="chat-home">
                      <a className="navbar-brand" href="/">
                        <img src="/frontend/images/logo.png" alt="Talknova" />
                      </a>
                      <h2>
                        Hello there.
                        <br />
                        How can we help?
                      </h2>

                      {/* Recent message card – static */}

                      {/* Video & benefits block (desktop only) */}
                      <h4 className="d-none d-md-block">Key advantages:</h4>
                      <div className="card recent-message">
                        <div className="card-body">
                          <div className="chat-post-img">
                            <video
                              controls
                              src="/frontend/video/talknova-video.mp4"
                              style={{ width: "100%" }}
                            />
                          </div>
                          <div className="chat-post-detail price-box">
                            <ul>
                              <li>Join for FREE</li>
                              <li>
                                Add URLs from your website so AI learns about
                                your content
                              </li>
                              <li>
                                Upload extra docs about your products, services,
                                or support
                              </li>
                              <li>
                                Add a greeting message or any other direction to
                                the chat assistant
                              </li>
                              <li>
                                Paste the generated script on your webpage
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="card recent-message">
                        <div className="card-body">
                          <div className="chat-post-img ">
                            <video
                              controls
                              src="/frontend/video//websupport-video.mp4"
                            ></video>
                          </div>
                          <div className="chat-post-detail">
                            <a href="#">
                              <strong>TALKNOVA AI</strong>
                              <p>
                                Welcome to TALKNOVA - where intelligent
                                automation meets real results! We're excited to
                                launch our page and introduce you to the future
                                of customer engagement. At TALKNOVA , we build
                                AI-powered Chat Agents and Business Solutions
                                that help businesses automate customer service,
                                generate leads, and drive conversions 24/7.
                              </p>
                              <p>
                                Whether you're in e-commerce, SaaS, or a
                                service-based industry, our chatbots are
                                tailored to your needs, designed to save time,
                                reduce costs, and deliver better customer
                                experiences.
                              </p>
                              <p>
                                We also build bespoke AI business solutions that
                                help companies streamline operations, scale
                                smarter, and unlock the full potential of
                                automation.
                              </p>
                              <p> Stay tuned for:</p>
                              <p> - AI insights &amp; chatbot tips</p>
                              <p> - Client success stories</p>
                              <p> - New product features</p>
                              <p> - Behind-the-scenes innovation</p>

                              <p>
                                We’d love to connect with you! Follow our page,
                                drop us a message, or comment below to say
                                hello. Let’s build smarter, together.
                              </p>
                            </a>
                          </div>
                        </div>
                      </div>

                      <div className="card recent-message">
                        <div className="card-body news-post-list">
                          <h4>FAQs</h4>

                          <div
                            className="accordion accordion-flush"
                            id="accordionFlushExample"
                          >
                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading1"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse1"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse1"
                                >
                                  1. What is Talknova?
                                </button>
                              </div>
                              <div
                                id="flush-collapse1"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading1"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        Talknova is a UK-based SaaS company that
                                        provides intelligent AI chat agents for
                                        websites. Our chatbots help businesses
                                        automate customer support, capture
                                        leads, and improve conversions—24/7
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading2"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse2"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse2"
                                >
                                  2. Who can use Talknova's chat agents?
                                </button>
                              </div>
                              <div
                                id="flush-collapse2"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading2"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        Our solutions are ideal for e-commerce
                                        stores, SaaS platforms, and
                                        service-based businesses of all sizes.
                                        If you need to engage visitors, automate
                                        queries, or reduce response times,
                                        Talknova is for you.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading3"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse3"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse3"
                                >
                                  3. How do Talknova’s AI agents work?
                                </button>
                              </div>
                              <div
                                id="flush-collapse3"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading3"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        Our AI chat agents can be trained on
                                        your website content, FAQs, and
                                        business-specific data. They use natural
                                        language processing (NLP) to deliver
                                        human-like responses to your customers
                                        in real time.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading4"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse4"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse4"
                                >
                                  4. Is there a free trial available?
                                </button>
                              </div>
                              <div
                                id="flush-collapse4"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading4"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        Yes! We offer a 1-month free trial so
                                        you can test our platform with full
                                        access—no credit card required.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading5"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse5"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse5"
                                >
                                  5. What happens after the free trial ends?
                                </button>
                              </div>
                              <div
                                id="flush-collapse5"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading5"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        If you wish to continue using our
                                        service, you can subscribe to one of our
                                        paid plans. If not, your account will be
                                        paused and no charges will be made
                                        unless you opt in.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading6"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse6"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse6"
                                >
                                  6. How do I install the chat agent on my
                                  website?
                                </button>
                              </div>
                              <div
                                id="flush-collapse6"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading6"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        You simply copy and paste a script into
                                        your website’s HTML (or install a plugin
                                        if you’re using WordPress or Shopify).
                                        Full installation instructions are
                                        available in your dashboard.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading7"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse7"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse7"
                                >
                                  7. Can I crawl any website to train the AI?
                                </button>
                              </div>
                              <div
                                id="flush-collapse7"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading7"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        <b>No</b>.You may{" "}
                                        <b>only crawl websites you own</b> or
                                        have full legal rights to access.
                                        Unauthorized crawling is strictly
                                        prohibited.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading8"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse8"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse8"
                                >
                                  8. What type of content is prohibited?
                                </button>
                              </div>
                              <div
                                id="flush-collapse8"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading8"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        You must not upload or train the chatbot
                                        with <b>derogatory</b>, <b>political</b>
                                        , <b>sexual</b>, <b>racist</b>, or{" "}
                                        <b>discriminatory content</b>. Any such
                                        violation will result in immediate
                                        suspension or termination.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading9"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse9"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse9"
                                >
                                  9. Is my data secure?
                                </button>
                              </div>
                              <div
                                id="flush-collapse9"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading9"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        Yes. We follow UK GDPR regulations and
                                        use encryption and best-in-class cloud
                                        infrastructure to ensure your data and
                                        your customers’ information are secure.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading10"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse10"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse10"
                                >
                                  10. Who owns the chatbot content and data?
                                </button>
                              </div>
                              <div
                                id="flush-collapse10"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading10"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        You retain ownership of the content you
                                        provide and the chat data generated
                                        through your agent. Talknova acts as a
                                        data processor on your behalf.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading11"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse11"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse11"
                                >
                                  11. What are your pricing plans?
                                </button>
                              </div>
                              <div
                                id="flush-collapse11"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading11"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        We offer flexible monthly and annual
                                        plans based on usage, features, and
                                        support levels. Pricing details are
                                        available on our website or by
                                        contacting our sales team.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading12"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse12"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse12"
                                >
                                  12. Can I cancel my subscription at any time?
                                </button>
                              </div>
                              <div
                                id="flush-collapse12"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading12"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        Yes. You can cancel your subscription at
                                        any time from your dashboard. Your
                                        service will remain active until the end
                                        of your current billing cycle.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading13"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse13"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse13"
                                >
                                  13. Do you offer refunds?
                                </button>
                              </div>
                              <div
                                id="flush-collapse13"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading13"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        No, we do not offer refunds as each
                                        client gets a full 1-month free trial to
                                        test the service before subscribing. See
                                        our Refund Policy for more details.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading14"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse14"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse14"
                                >
                                  14. Can I customize my chatbot?
                                </button>
                              </div>
                              <div
                                id="flush-collapse14"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading14"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        Absolutely. You can train the AI with
                                        your content, choose its tone and
                                        personality, and configure workflows to
                                        suit your business needs.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading15"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse15"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse15"
                                >
                                  15. Do you offer custom AI solutions beyond
                                  chat agents?
                                </button>
                              </div>
                              <div
                                id="flush-collapse15"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading15"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        Yes. We also build{" "}
                                        <b>bespoke AI-powered business tools</b>{" "}
                                        such as workflow automation,
                                        integrations with CRMs, and
                                        industry-specific AI solutions.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading16"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse16"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse16"
                                >
                                  16. What support is available?
                                </button>
                              </div>
                              <div
                                id="flush-collapse16"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading16"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        All plans include email and live chat
                                        support. Priority support and onboarding
                                        assistance are available on higher-tier
                                        plans.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading17"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse17"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse17"
                                >
                                  17. Can the chatbot handle complex queries?
                                </button>
                              </div>
                              <div
                                id="flush-collapse17"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading17"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        Yes. Our agents are powered by advanced
                                        NLP and can answer layered questions,
                                        guide users through processes, and
                                        escalate to human agents when needed.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading18"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse18"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse18"
                                >
                                  18. Does it integrate with third-party
                                  platforms?
                                </button>
                              </div>
                              <div
                                id="flush-collapse18"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading18"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        Yes, our platform supports integrations
                                        with CRMs, helpdesks, WhatsApp,
                                        Messenger, Slack, and more.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading19"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse19"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse19"
                                >
                                  19. Can I view chatbot analytics?
                                </button>
                              </div>
                              <div
                                id="flush-collapse19"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading19"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        Yes. You can track usage, response
                                        accuracy, missed queries, and customer
                                        interactions directly from your
                                        dashboard.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-heading20"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapse20"
                                  aria-expanded="false"
                                  aria-controls="flush-collapse20"
                                >
                                  20. Can I white-label the chatbot for my
                                  brand?
                                </button>
                              </div>
                              <div
                                id="flush-collapse20"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-heading20"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <p>
                                        Yes. We offer white-labeling options for
                                        agencies or enterprises looking to
                                        resell or present the bot under their
                                        own brand.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <p>
                              For any other query please{" "}
                              <a href="/contact-us">Contact us</a>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="tab-pane "
                    id="tab-support"
                    role="tabpanel"
                    aria-labelledby="support-tab"
                  >
                    <div className="ai-chat-messages">
                      <div
                        className="heading-chat-message"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <h3 style={{ margin: 0, flex: 1 }}> AI Support</h3>
                        <button
                          onClick={handleReloadChat}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#004729",
                            cursor: "pointer",
                            padding: "5px 10px",
                            fontSize: "16px",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            transition: "all 0.2s ease",
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.color = "#006644";
                            e.currentTarget.style.transform = "rotate(180deg)";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.color = "#004729";
                            e.currentTarget.style.transform = "rotate(0deg)";
                          }}
                          title="Reload Chat"
                        >
                          <i className="fa fa-refresh" aria-hidden="true"></i>
                        </button>
                      </div>

                      {/* AI Support tab - custom chat interface */}
                      <div className="ai-chat" key={`chat-${chatResetKey}`}>
                        <div className="sender">
                          <div className="recent-message-box">
                            <div className="img-message-box">
                              <img src="/frontend/images/logo.png" alt="Chat" />
                            </div>
                            <div className="detail-message-box">
                              <span>TalkNova</span>
                            </div>
                            <div className="sender-msg">
                              <p>Hi there 👋</p>
                              <p>
                                You are now speaking with TalkNova. How can I
                                help?
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Send box - always visible for AI Support */}
                      <div className="send-box">
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const form = e.currentTarget;
                            const input = form.querySelector(
                              'input[type="text"]',
                            ) as HTMLInputElement;
                            const message = input?.value.trim();

                            if (!message) return;

                            const chatArea = form
                              .closest(".ai-chat-messages")
                              ?.querySelector(".ai-chat");
                            if (!chatArea) return;

                            // Disable input while sending
                            if (input) {
                              input.disabled = true;
                            }

                            // Add user message to chat
                            const replyDiv = document.createElement("div");
                            replyDiv.className = "reply-outer";
                            replyDiv.innerHTML = `<div class="repaly">${message}</div>`;
                            chatArea.appendChild(replyDiv);

                            // Scroll to bottom
                            chatArea.scrollTop = chatArea.scrollHeight;

                            // Clear input
                            if (input) {
                              input.value = "";
                            }

                            try {
                              // Get chatbot configuration
                              const agentId = 175330218138519;
                              const configResponse = await fetch(
                                "https://www.talknova.ai/api/chatagent",
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type":
                                      "application/x-www-form-urlencoded",
                                  },
                                  body: new URLSearchParams({
                                    id: agentId.toString(),
                                  }),
                                },
                              );

                              if (!configResponse.ok) {
                                throw new Error(
                                  "Failed to load chatbot configuration",
                                );
                              }

                              const config = await configResponse.json();
                              const CHATFLOW_ID =
                                "e7b45b6f-14f0-4430-b005-ea25f107d88c";
                              const API_HOST = "https://flowise.aidera.co.uk";

                              // Get or create chatId
                              const KEY = `flowise-chat-${agentId}`;
                              let flowiseData = null;
                              try {
                                flowiseData = JSON.parse(
                                  localStorage.getItem(KEY) || "{}",
                                );
                              } catch (e) {
                                flowiseData = {};
                              }

                              let chatId = flowiseData.chatId;
                              if (!chatId) {
                                chatId = crypto.randomUUID();
                                flowiseData.chatId = chatId;
                                localStorage.setItem(
                                  KEY,
                                  JSON.stringify(flowiseData),
                                );
                              }

                              // Get chat history from localStorage
                              const flowiseKey = Object.keys(localStorage).find(
                                (k) =>
                                  k.startsWith(CHATFLOW_ID) &&
                                  k.endsWith("_EXTERNAL"),
                              );
                              let chatHistory: any[] = [];

                              // Try to get chat history from our key format
                              try {
                                const flowiseData = JSON.parse(
                                  localStorage.getItem(KEY) || "{}",
                                );
                                chatHistory = flowiseData.chatHistory || [];
                              } catch (e) {
                                console.warn(
                                  "Could not parse chat history from KEY",
                                  e,
                                );
                              }

                              // Also try Flowise external key format
                              if (flowiseKey) {
                                try {
                                  const flowiseData = JSON.parse(
                                    localStorage.getItem(flowiseKey) || "{}",
                                  );
                                  chatHistory =
                                    flowiseData.chatHistory || chatHistory;
                                } catch (e) {
                                  console.warn(
                                    "Could not parse Flowise chat history",
                                    e,
                                  );
                                }
                              }

                              // Add user message to history
                              chatHistory.push({
                                message: message,
                                type: "user",
                                dateTime: new Date().toISOString(),
                              });

                              // Send message to Flowise API
                              const response = await fetch(
                                `${API_HOST}/api/v1/prediction/${CHATFLOW_ID}`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    question: message,
                                    history: chatHistory
                                      .slice(-10)
                                      .map((msg: any) => ({
                                        message: msg.message,
                                        type: msg.type,
                                      })),
                                    overrideConfig: {
                                      vars: {
                                        clientId: agentId.toString(),
                                      },
                                    },
                                    chatflowConfig: {
                                      responsePrompt: config.prompt,
                                      returnSourceDocuments: false,
                                      qdrantFilter: {
                                        should: [
                                          {
                                            key: "metadata.bot",
                                            match: {
                                              value: agentId.toString(),
                                            },
                                          },
                                        ],
                                      },
                                    },
                                  }),
                                },
                              );

                              if (!response.ok) {
                                throw new Error(
                                  `Flowise API error: ${response.status}`,
                                );
                              }

                              const data = await response.json();
                              const aiResponse =
                                data.text ||
                                data.answer ||
                                "I apologize, but I could not generate a response.";

                              // Add AI response to chat
                              const senderDiv = document.createElement("div");
                              senderDiv.className = "sender";
                              senderDiv.innerHTML = `
                                  <div class="recent-message-box">
                                    <div class="img-message-box">
                                      <img src="/frontend/images/logo.png" alt="Chat" />
                                    </div>
                                    <div class="detail-message-box">
                                      <span>TalkNova</span>
                                    </div>
                                    <div class="sender-msg">
                                      <p>${aiResponse}</p>
                                    </div>
                                  </div>
                                `;
                              chatArea.appendChild(senderDiv);

                              // Update chat history in localStorage
                              chatHistory.push({
                                message: aiResponse,
                                type: "apiMessage",
                                dateTime: new Date().toISOString(),
                              });

                              // Store chat history in our key format
                              try {
                                const flowiseData = JSON.parse(
                                  localStorage.getItem(KEY) || "{}",
                                );
                                flowiseData.chatHistory = chatHistory;
                                flowiseData.chatId = chatId;
                                localStorage.setItem(
                                  KEY,
                                  JSON.stringify(flowiseData),
                                );
                              } catch (e) {
                                console.warn(
                                  "Could not update chat history",
                                  e,
                                );
                              }

                              // Also update Flowise external key if it exists
                              if (flowiseKey) {
                                try {
                                  const flowiseData = JSON.parse(
                                    localStorage.getItem(flowiseKey) || "{}",
                                  );
                                  flowiseData.chatHistory = chatHistory;
                                  localStorage.setItem(
                                    flowiseKey,
                                    JSON.stringify(flowiseData),
                                  );
                                } catch (e) {
                                  console.warn(
                                    "Could not update Flowise chat history",
                                    e,
                                  );
                                }
                              }

                              // Scroll to bottom
                              chatArea.scrollTop = chatArea.scrollHeight;
                            } catch (error) {
                              console.error("Error sending message:", error);

                              // Show error message
                              const errorDiv = document.createElement("div");
                              errorDiv.className = "sender";
                              errorDiv.innerHTML = `
                                  <div class="recent-message-box">
                                    <div class="img-message-box">
                                      <img src="/frontend/images/logo.png" alt="Chat" />
                                    </div>
                                    <div class="detail-message-box">
                                      <span>TalkNova</span>
                                    </div>
                                    <div class="sender-msg">
                                      <p>Sorry, I encountered an error. Please try again.</p>
                                    </div>
                                  </div>
                                `;
                              chatArea.appendChild(errorDiv);
                              chatArea.scrollTop = chatArea.scrollHeight;
                            } finally {
                              // Re-enable input
                              if (input) {
                                input.disabled = false;
                                input.focus();
                              }
                            }
                          }}
                        >
                          <input
                            type="text"
                            className="form-control"
                            aria-label="message…"
                            placeholder="Write message…"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const form = e.currentTarget.closest("form");
                                if (form) {
                                  form.requestSubmit();
                                }
                              }
                            }}
                          />
                          <button className="chat-send-btn" type="submit">
                            <i
                              className="fa fa-paper-plane"
                              aria-hidden="true"
                            ></i>
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>

                  <div
                    className="tab-pane "
                    id="tab-review"
                    role="tabpanel"
                    aria-labelledby="review-tab"
                  >
                    <div className="ai-chat-messages">
                      <div className="heading-chat-message">
                        <h3>Reviews</h3>
                        <div className="text-end mt-2">
                          <Link
                            to="/submit-review"
                            className="btn btn-sm btn-review"
                          >
                            Submit a Review
                          </Link>
                        </div>
                      </div>
                    </div>
                    <div className="blog-post-list">
                      {reviewsLoading ? (
                        <div className="text-center py-4">
                          <div
                            className="spinner-border text-primary"
                            role="status"
                          >
                            <span className="visually-hidden">
                              Loading reviews...
                            </span>
                          </div>
                        </div>
                      ) : reviews && reviews.length > 0 ? (
                        reviews.map((review, index) => (
                          <div
                            key={review._id || `review-${index}`}
                            className="card shadow-sm text-start mb-3"
                          >
                            <div className="card-body">
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <div className="d-flex align-items-center">
                                  <div className="me-3">
                                    <div
                                      className="rounded-circle d-flex align-items-center justify-content-center"
                                      style={{
                                        width: "40px",
                                        height: "40px",
                                        backgroundColor: "#004729",
                                        color: "white",
                                        fontSize: "14px",
                                        fontWeight: "600",
                                      }}
                                    >
                                      {getInitials(review.name)}
                                    </div>
                                  </div>
                                  <div>
                                    <h6 className="card-title mb-0">
                                      {getInitials(review.name)}
                                    </h6>
                                    <small className="text-muted mb-0">
                                      {formatDate(review.createdAt)}
                                    </small>
                                  </div>
                                </div>
                              </div>
                              <div className="d-flex mb-2">
                                {renderStars(review.rating)}
                              </div>
                              <p className="card-text mb-0">
                                {review.reviewText}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-muted mb-3">
                            No reviews yet. Be the first to share your
                            experience!
                          </p>
                          <Link to="/submit-review" className="btn btn-primary">
                            Submit the First Review
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className="tab-pane "
                    id="tab-media"
                    role="tabpanel"
                    aria-labelledby="media-tab"
                  >
                    <div className="ai-chat-messages">
                      <div className="heading-chat-message">
                        <h3> Social Media </h3>
                      </div>
                      <div className="news-post-outer">
                        <h4>Latest</h4>
                        <p>From Team Talknova</p>

                        <div className="news-post-list">
                          <div
                            className="accordion accordion-flush"
                            id="accordionFlushExample"
                          >
                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-headingOne"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapseOne"
                                  aria-expanded="false"
                                  aria-controls="flush-collapseOne"
                                >
                                  <i className="fab fa-instagram me-2"></i>{" "}
                                  Instagram
                                </button>
                              </div>
                              <div
                                id="flush-collapseOne"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-headingOne"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <blockquote
                                        className="instagram-media"
                                        data-instgrm-captioned
                                        data-instgrm-permalink="https://www.instagram.com/p/DMSk_NvIHOC/?utm_source=ig_embed&utm_campaign=loading"
                                        data-instgrm-version="14"
                                        style={{
                                          background: "#FFF",
                                          border: 0,
                                          borderRadius: "3px",
                                          boxShadow:
                                            "0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)",
                                          margin: "1px",
                                          maxWidth: "540px",
                                          minWidth: "326px",
                                          padding: 0,
                                          width: "99.375%",
                                        }}
                                      >
                                        <div style={{ padding: "16px" }}>
                                          <a
                                            href="https://www.instagram.com/p/DMSk_NvIHOC/?utm_source=ig_embed&utm_campaign=loading"
                                            style={{
                                              background: "#FFFFFF",
                                              lineHeight: 0,
                                              padding: "0 0",
                                              textAlign: "center",
                                              textDecoration: "none",
                                              width: "100%",
                                            }}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            <div
                                              style={{
                                                display: "flex",
                                                flexDirection: "row",
                                                alignItems: "center",
                                              }}
                                            >
                                              <div
                                                style={{
                                                  backgroundColor: "#F4F4F4",
                                                  borderRadius: "50%",
                                                  flexGrow: 0,
                                                  height: "40px",
                                                  marginRight: "14px",
                                                  width: "40px",
                                                }}
                                              ></div>
                                              <div
                                                style={{
                                                  display: "flex",
                                                  flexDirection: "column",
                                                  flexGrow: 1,
                                                  justifyContent: "center",
                                                }}
                                              >
                                                <div
                                                  style={{
                                                    backgroundColor: "#F4F4F4",
                                                    borderRadius: "4px",
                                                    flexGrow: 0,
                                                    height: "14px",
                                                    marginBottom: "6px",
                                                    width: "100px",
                                                  }}
                                                ></div>
                                                <div
                                                  style={{
                                                    backgroundColor: "#F4F4F4",
                                                    borderRadius: "4px",
                                                    flexGrow: 0,
                                                    height: "14px",
                                                    width: "60px",
                                                  }}
                                                ></div>
                                              </div>
                                            </div>
                                            <div
                                              style={{ padding: "19% 0" }}
                                            ></div>
                                            <div
                                              style={{
                                                display: "block",
                                                height: "50px",
                                                margin: "0 auto 12px",
                                                width: "50px",
                                              }}
                                            >
                                              <svg
                                                width="50px"
                                                height="50px"
                                                viewBox="0 0 60 60"
                                                version="1.1"
                                                xmlns="http://www.w3.org/2000/svg"
                                              >
                                                <g
                                                  stroke="none"
                                                  strokeWidth="1"
                                                  fill="none"
                                                  fillRule="evenodd"
                                                >
                                                  <g
                                                    transform="translate(-511.000000, -20.000000)"
                                                    fill="#000000"
                                                  >
                                                    <g>
                                                      <path d="M556.869,30.41 C554.814,30.41 553.148,32.076 553.148,34.131 C553.148,36.186 554.814,37.852 556.869,37.852 C558.924,37.852 560.59,36.186 560.59,34.131 C560.59,32.076 558.924,30.41 556.869,30.41 M541,60.657 C535.114,60.657 530.342,55.887 530.342,50 C530.342,44.114 535.114,39.342 541,39.342 C546.887,39.342 551.658,44.114 551.658,50 C551.658,55.887 546.887,60.657 541,60.657 M541,33.886 C532.1,33.886 524.886,41.1 524.886,50 C524.886,58.899 532.1,66.113 541,66.113 C549.9,66.113 557.115,58.899 557.115,50 C557.115,41.1 549.9,33.886 541,33.886 M565.378,62.101 C565.244,65.022 564.756,66.606 564.346,67.663 C563.803,69.06 563.154,70.057 562.106,71.106 C561.058,72.155 560.06,72.803 558.662,73.347 C557.607,73.757 556.021,74.244 553.102,74.378 C549.944,74.521 548.997,74.552 541,74.552 C533.003,74.552 532.056,74.521 528.898,74.378 C525.979,74.244 524.393,73.757 523.338,73.347 C521.94,72.803 520.942,72.155 519.894,71.106 C518.846,70.057 518.197,69.06 517.654,67.663 C517.244,66.606 516.755,65.022 516.623,62.101 C516.479,58.943 516.448,57.996 516.448,50 C516.448,42.003 516.479,41.056 516.623,37.899 C516.755,34.978 517.244,33.391 517.654,32.338 C518.197,30.938 518.846,29.942 519.894,28.894 C520.942,27.846 521.94,27.196 523.338,26.654 C524.393,26.244 525.979,25.756 528.898,25.623 C532.057,25.479 533.004,25.448 541,25.448 C548.997,25.448 549.943,25.479 553.102,25.623 C556.021,25.756 557.607,26.244 558.662,26.654 C560.06,27.196 561.058,27.846 562.106,28.894 C563.154,29.942 563.803,30.938 564.346,32.338 C564.756,33.391 565.244,34.978 565.378,37.899 C565.522,41.056 565.552,42.003 565.552,50 C565.552,57.996 565.522,58.943 565.378,62.101 M570.82,37.631 C570.674,34.438 570.167,32.258 569.425,30.349 C568.659,28.377 567.633,26.702 565.965,25.035 C564.297,23.368 562.623,22.342 560.652,21.575 C558.743,20.834 556.562,20.326 553.369,20.18 C550.169,20.033 549.148,20 541,20 C532.853,20 531.831,20.033 528.631,20.18 C525.438,20.326 523.257,20.834 521.349,21.575 C519.376,22.342 517.703,23.368 516.035,25.035 C514.368,26.702 513.342,28.377 512.574,30.349 C511.834,32.258 511.326,34.438 511.181,37.631 C511.035,40.831 511,41.851 511,50 C511,58.147 511.035,59.17 511.181,62.369 C511.326,65.562 511.834,67.743 512.574,69.651 C513.342,71.625 514.368,73.296 516.035,74.965 C517.703,76.634 519.376,77.658 521.349,78.425 C523.257,79.167 525.438,79.673 528.631,79.82 C531.831,79.965 532.853,80.001 541,80.001 C549.148,80.001 550.169,79.965 553.369,79.82 C556.562,79.673 558.743,79.167 560.652,78.425 C562.623,77.658 564.297,76.634 565.965,74.965 C567.633,73.296 568.659,71.625 569.425,69.651 C570.167,67.743 570.674,65.562 570.82,62.369 C570.966,59.17 571,58.147 571,50 C571,41.851 570.966,40.831 570.82,37.631"></path>
                                                    </g>
                                                  </g>
                                                </g>
                                              </svg>
                                            </div>
                                            <div style={{ paddingTop: "8px" }}>
                                              <div
                                                style={{
                                                  color: "#3897f0",
                                                  fontFamily:
                                                    "Arial,sans-serif",
                                                  fontSize: "14px",
                                                  fontStyle: "normal",
                                                  fontWeight: "550",
                                                  lineHeight: "18px",
                                                }}
                                              >
                                                View this post on Instagram
                                              </div>
                                            </div>
                                            <div
                                              style={{ padding: "12.5% 0" }}
                                            ></div>
                                          </a>
                                          <p
                                            style={{
                                              color: "#c9c8cd",
                                              fontFamily: "Arial,sans-serif",
                                              fontSize: "14px",
                                              lineHeight: "17px",
                                              marginBottom: 0,
                                              marginTop: "8px",
                                              overflow: "hidden",
                                              padding: "8px 0 7px",
                                              textAlign: "center",
                                              textOverflow: "ellipsis",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            <a
                                              href="https://www.instagram.com/p/DMSk_NvIHOC/?utm_source=ig_embed&utm_campaign=loading"
                                              style={{
                                                color: "#c9c8cd",
                                                fontFamily: "Arial,sans-serif",
                                                fontSize: "14px",
                                                fontStyle: "normal",
                                                fontWeight: "normal",
                                                lineHeight: "17px",
                                                textDecoration: "none",
                                              }}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                            >
                                              A post shared by Talknova AI
                                              (@talknova_ai)
                                            </a>
                                          </p>
                                        </div>
                                      </blockquote>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-headingTwo"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapseTwo"
                                  aria-expanded="false"
                                  aria-controls="flush-collapseTwo"
                                >
                                  X
                                </button>
                              </div>
                              <div
                                id="flush-collapseTwo"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-headingTwo"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card recent-message">
                                    <div className="card-body">
                                      <blockquote className="twitter-tweet">
                                        <p lang="en" dir="ltr">
                                          New AI chatbot, userfriendly and cost
                                          effective.
                                        </p>
                                        &mdash; Talknova (@AmbrishBan14281)
                                        <a href="https://twitter.com/AmbrishBan14281/status/1947309326999122398?ref_src=twsrc%5Etfw">
                                          July 21, 2025
                                        </a>
                                      </blockquote>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-headingThree"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapseThree"
                                  aria-expanded="false"
                                  aria-controls="flush-collapseThree"
                                >
                                  <i className="fab fa-facebook-square me-2"></i>
                                  Facebook
                                </button>
                              </div>
                              <div
                                id="flush-collapseThree"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-headingThree"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card-body">
                                    <iframe
                                      src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fpermalink.php%3Fstory_fbid%3Dpfbid02r9SJhcwjyvS6JfNuWBKM5LxwMtpBpihmuCnze4WGw8EwpTn8PETAuyf4Rm7WPhnbl%26id%3D61578158835683&show_text=true&width=500"
                                      width="100%"
                                      height="500"
                                      style={{
                                        border: "none",
                                        overflow: "hidden",
                                      }}
                                      scrolling="no"
                                      frameBorder="0"
                                      allowFullScreen={true}
                                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                                      title="Facebook Embedded Post"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="accordion-item">
                              <div
                                className="accordion-header"
                                id="flush-headingFour"
                              >
                                <button
                                  className="accordion-button collapsed"
                                  type="button"
                                  data-bs-toggle="collapse"
                                  data-bs-target="#flush-collapseFour"
                                  aria-expanded="false"
                                  aria-controls="flush-collapseThree"
                                >
                                  <i className="fab fa-linkedin-in me-2"></i>
                                  Linkedin
                                </button>
                              </div>
                              <div
                                id="flush-collapseFour"
                                className="accordion-collapse collapse"
                                aria-labelledby="flush-headingFour"
                                data-bs-parent="#accordionFlushExample"
                              >
                                <div className="accordion-body">
                                  <div className="card-body">
                                    <iframe
                                      src="https://www.linkedin.com/embed/feed/update/urn:li:share:7352598958088544258?collapsed=1"
                                      height="400"
                                      width="100%"
                                      frameBorder="0"
                                      allowFullScreen={true}
                                      title="LinkedIn Embedded Post"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Other tabs omitted for brevity – add as needed */}
                </div>
              </div>
            </div>

            {/* Mobile CTAs */}
            <div className="d-md-none text-center mt-4">
              <Link to="/signup" className="document-btn me-2">
                Start Trial
              </Link>
              <a
                href="contact-us"
                target="_blank"
                rel="noopener noreferrer"
                className="document-btn me-2"
              >
                Book a Demo
              </a>
              <Link to="/contact-us" className="document-btn">
                Contact&nbsp;Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────  WHY TALKNOVA  ─────────────────────────── */}
      <section className="choose-container">
        <div className="container">
          <div className="choose-rightbar">
            <h2>Why TALKNOVA?</h2>
            <ul>
              {[
                {
                  title: "Cost‑Effective",
                  text:
                    "An affordable AI chatbot that cuts operational costs " +
                    "while supporting customers and generating leads.",
                },
                {
                  title: "Consistency & Accuracy",
                  text:
                    "Delivers reliable responses by following scripts and " +
                    "guidelines, minimising human error.",
                },
                {
                  title: "Scalability",
                  text:
                    "Handles thousands of conversations simultaneously, perfect " +
                    "for growth and peak demand.",
                },
                {
                  title: "Secure Interactions",
                  text: "Robust data‑protection ensures customer privacy and regulatory compliance.",
                },
                {
                  title: "Knowledge",
                  text: "Instantly learns about your company, products and processes from existing data sources.",
                },
                {
                  title: "Multilingual Capabilities",
                  text: "Supports multiple languages for a truly global audience.",
                },
              ].map(({ title, text }) => (
                <li key={title}>
                  <span>
                    <i className="fas fa-check-circle" />
                  </span>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </li>
              ))}
            </ul>

            <div className="text-center-mobile">
              <Link to="/signup" className="document-btn me-2">
                Start Trial
              </Link>
              <a
                href="/contact-us"
                target="_blank"
                rel="noopener noreferrer"
                className="document-btn me-2"
              >
                Book a Demo
              </a>
              <Link to="/contact-us" className="document-btn">
                Contact&nbsp;Us
              </Link>
            </div>
          </div>

          {/* “Who we are” block – left side */}
          <div className="choose-leftbar">
            <div className="choose-app text-center text-md-start">
              <a className="navbar-brand" href="/">
                <img src="/frontend/images/logo.png" alt="Talknova" />
              </a>
              <h3>Who we are?</h3>

              <div className="row">
                {[
                  {
                    icon: "fa-globe",
                    title: "Global",
                    text: "Diverse professionals",
                  },
                  { icon: "fa-users", title: "Clients", text: "10,000 + " },
                  {
                    icon: "far fa-smile",
                    title: "Happy community",
                    text: "96% positive reviews",
                  },
                ].map(({ icon, title, text }) => (
                  <div className="col-12 we-block" key={title}>
                    <span>
                      <i className={`fas ${icon}`} />
                    </span>
                    <h4>{title}</h4>
                    <p>{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────  PRICING  ────────────────────────────── */}
      <section className="buy-container">
        <div className="container gd">
          <h3 className="text-center mb-4">Pricing</h3>

          {/* Billing toggle */}
          <div className="d-flex justify-content-center mb-4">
            <div
              className="form-check form-switch"
              style={{ userSelect: "none", cursor: "pointer" }}
            >
              <input
                id="billingToggle"
                className="form-check-input"
                type="checkbox"
                role="switch"
                onChange={toggleBilling}
                checked={billingPeriod === "YEARLY"}
                data-size="md"
              />
              <label className="form-check-label" htmlFor="billingToggle">
                {billingPeriod === "MONTHLY" ? "Monthly" : "Yearly"}
                {billingPeriod === "YEARLY" && (
                  <span className="badge bg-success ms-2 fs-6">
                    <i className="fas fa-gift me-1"></i>
                    2x Benefits!
                  </span>
                )}
              </label>
            </div>
          </div>

          {/* Yearly bonus message */}
          {billingPeriod === "YEARLY" && (
            <div className="text-center mb-4">
              <div className="alert alert-success d-inline-block">
                <i className="fas fa-star text-warning me-2"></i>
                <strong>Yearly Bonus:</strong> Get 2x documents, file size, and
                URLs with any yearly plan!
                <i className="fas fa-star text-warning ms-2"></i>
              </div>
            </div>
          )}

          <div className="row d-grid d-flex justify-content-center g-4">
            {plans.map((plan) => {
              const isYearly = billingPeriod === "YEARLY";
              const rawPrice = isYearly
                ? plan.yearlyPrice ?? plan.price * 12
                : plan.price;
              const price = rawPrice > 0 ? formatPrice(rawPrice) : "FREE";
              const link =
                rawPrice === 0
                  ? "/signup"
                  : `/buy-plan?plan=${plan._id}&period=${
                      isYearly ? "yearly" : "monthly"
                    }`;
              const cta = rawPrice === 0 ? "Start Now" : "Subscribe Now";

              return (
                <div
                  key={plan._id}
                  className="col-xl-3 col-lg-6 col-md-12 col-sm-12 mb-3"
                >
                  <div className="card price-box h-100">
                    {plan.defaultPlanType === "BUSINESS" && (
                      <div className="rating-block">Most Popular</div>
                    )}

                    <h4>
                      <span>
                        {plan.name}{" "}
                        {rawPrice > 0 && (
                          <small>
                            {price} / {isYearly ? "Year" : "Month"}
                          </small>
                        )}
                        {rawPrice === 0 && <small>(30&nbsp;days only)</small>}
                      </span>
                    </h4>

                    <div className="card-body">
                      <table className="table table-bordered">
                        <tbody>
                          <tr>
                            <td>Documents upload</td>
                            <td>
                              Up to{" "}
                              {isYearly && rawPrice > 0
                                ? plan.maxDocuments * 2
                                : plan.maxDocuments}{" "}
                              files
                              {isYearly && rawPrice > 0 && (
                                <span className="text-success ms-1 fw-bold">
                                  (2x)
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td>Total size of files</td>
                            <td>
                              {isYearly && rawPrice > 0
                                ? plan.maxFileSize * 2
                                : plan.maxFileSize}{" "}
                              MB
                              {isYearly && rawPrice > 0 && (
                                <span className="text-success ms-1 fw-bold">
                                  (2x)
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td>Number of URL’s from your site</td>
                            <td>
                              {isYearly && rawPrice > 0
                                ? plan.maxUrls * 2
                                : plan.maxUrls}
                              {isYearly && rawPrice > 0 && (
                                <span className="text-success ms-1 fw-bold">
                                  (2x)
                                </span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="p-3 pt-0">
                      <Link to={link} className="document-btn buy-btn w-100">
                        {cta}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* ENTERPRISE (static) */}
            <div className="col-xl-3 col-lg-6 col-md-12 col-sm-12 mb-3">
              <div className="card price-box h-100">
                <h4>
                  <span>
                    ENTERPRISE <br />
                    <small>Fully integrated AI support</small>
                  </span>
                </h4>
                <div className="card-body">
                  <h6 className="mb-5">
                    Use our expertise in&nbsp;AI to develop customised,
                    enterprise‑level AI solutions.
                  </h6>
                </div>
                <div className="p-3 pt-0">
                  <Link to="/contact-us" className="document-btn buy-btn w-100">
                    Contact&nbsp;Now
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────  CONTACT‑US / MAP  ───────────────────────── */}
      {/* (Your original contact + map code is left untouched below) */}
      <section id="contact" className="buy-container">
        <div className="container">
          <div className="row d-grid d-flex justify-content-center">
            <h3>Contact Us</h3>

            {/* ---- Contact form ---- */}
            <div className="col-lg-6 mb-3">
              <div className="card h-100">
                <div className="card-body">
                  <Form ref={formRef} method="post">
                    <div className="row">
                      {[
                        { name: "name", label: "Full Name", type: "text" },
                        { name: "email", label: "Email", type: "email" },
                        { name: "phone", label: "Phone", type: "tel" },
                        {
                          name: "company",
                          label: "Company/Institute",
                          type: "text",
                        },
                      ].map(({ name, label, type }) => (
                        <div className="col-lg-6 mb-3" key={name}>
                          <label>{label}</label>
                          <input
                            name={name}
                            type={type}
                            className="form-control input-field"
                            required
                          />
                        </div>
                      ))}

                      <div className="col-12 mb-3">
                        <label>Message</label>
                        <textarea
                          name="message"
                          rows={5}
                          className="form-control textarea-input rounded-0"
                          required
                        />
                      </div>

                      {/* Hidden reCAPTCHA token */}
                      <input
                        type="hidden"
                        name="recaptchaToken"
                        value=""
                        /* populated by ref below */ readOnly
                      />

                      {showRecaptcha && (
                        <div className="mb-3">
                          <ReCAPTCHA
                            ref={recaptchaRef}
                            sitekey={RECAPTCHA_SITE_KEY}
                            onChange={(token) => {
                              (
                                formRef.current?.elements.namedItem(
                                  "recaptchaToken",
                                ) as HTMLInputElement
                              ).value = token ?? "";
                            }}
                          />
                        </div>
                      )}

                      <div className="col-12 mt-3">
                        <button
                          type="submit"
                          className="document-btn buy-btn"
                          disabled={!showRecaptcha}
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                  </Form>
                </div>
              </div>
            </div>

            {/* ---- Google map ---- */}
            <div className="col-lg-6 mb-3">
              <div className="card h-100">
                <div className="card-body">
                  <iframe
                    title="Talknova office map"
                    src="https://www.google.com/maps/embed?pb=!1m16!1m12!1m3!1d2484.2206089640135!2d0.06166377641914261!3d51.49081901191473!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!2m1!1s1004%20The%20Vista%20Building%2030%20Calderwood%20Street%20London%20SE18%206JH%20%20!5e0!3m2!1sen!2sin!4v1753357741050!5m2!1sen!2sin"
                    width="100%"
                    height={450}
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </FrontLayout>
  );
}

/* ---------------------------------------------------------------------- */
/*  ERROR BOUNDARY                                                        */
/* ---------------------------------------------------------------------- */
export function PageErrorBoundary({ error }: { error: Error }) {
  return <ErrorBoundary error={error} />;
}
