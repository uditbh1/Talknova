import { Links, Meta, useLocation } from "@remix-run/react";
import { type ReactNode, useEffect } from "react";
//import themeStyles from '/assets/css/theme.min.css';
import FrontHeaderBar from "./FrontHeaderBar";
import FrontFooterBar from "./FrontFooter";

// Note: links export doesn't work in components, only in route files
// Stylesheets are loaded via useEffect below

declare global {
  interface Window {
    chatbotConfig?: { agentId: number };
    __talknovaChatbotLoaded?: boolean;
    jQuery?: any;
    bootstrap?: any;
  }
}

const CHATBOT_SCRIPT_ID = "talknova-chatbot-loader";
// Use local file in development, production URL otherwise
const getChatbotScriptUrl = () => {
  if (typeof window === "undefined") {
    return "https://www.talknova.ai/frontend/js/chat-bot.js";
  }
  const hostname = window.location.hostname;
  return hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.includes("localhost")
    ? "/frontend/js/chat-bot.js"
    : "https://www.talknova.ai/frontend/js/chat-bot.js";
};
const CHATBOT_AGENT_ID = 175330218138519;

const ChatbotLoader = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return;

    const setAgentConfig = () => {
      if (window.chatbotConfig?.agentId === CHATBOT_AGENT_ID) return;
      window.chatbotConfig = { agentId: CHATBOT_AGENT_ID };
    };

    const removeExistingScript = () => {
      const existing = document.getElementById(CHATBOT_SCRIPT_ID);
      if (existing) {
        existing.remove();
      }
      window.__talknovaChatbotLoaded = false;
    };

    const injectScript = () => {
      if (document.getElementById(CHATBOT_SCRIPT_ID)) return;

      const script = document.createElement("script");
      script.id = CHATBOT_SCRIPT_ID;
      script.src = getChatbotScriptUrl();
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => {
        window.__talknovaChatbotLoaded = true;
      };
      script.onerror = () => {
        removeExistingScript();
      };
      document.body.appendChild(script);
    };

    const shouldReset = () => {
      const agentMismatch = window.chatbotConfig?.agentId !== CHATBOT_AGENT_ID;
      const widgetMissing =
        !document.querySelector("flowise-chatbot") &&
        !document.getElementById("flowise__chatwindow");
      return agentMismatch || (widgetMissing && window.__talknovaChatbotLoaded);
    };

    const ensureChatbotPresence = () => {
      setAgentConfig();
      if (shouldReset()) {
        removeExistingScript();
      }
      injectScript();
    };

    ensureChatbotPresence();
  }, [location.pathname]);

  return null;
};

type LayoutProps = {
  children: ReactNode;
};

const Layout = ({ children }: LayoutProps) => {
  useEffect(() => {
    // Load scripts after component mounts (client-side only)
    // Stylesheets are loaded via root.tsx links export to prevent FOUC
    if (typeof window === "undefined") return;

    const loadScripts = () => {
      // jQuery
      if (!window.jQuery && !document.querySelector('script[src*="jquery"]')) {
        const jq = document.createElement("script");
        jq.src =
          "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.1/jquery.min.js";
        jq.crossOrigin = "anonymous";
        document.head.appendChild(jq);
      }

      // Bootstrap
      if (
        !window.bootstrap &&
        !document.querySelector('script[src*="bootstrap.bundle"]')
      ) {
        const bs = document.createElement("script");
        bs.src =
          "https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js";
        bs.integrity =
          "sha384-kenU1KFdBIe4zVF0s0G1M5b4hcpxyD9F7jL+jjXkk+Q2h455rYXK/7HAuoJl+0I4";
        bs.crossOrigin = "anonymous";
        document.head.appendChild(bs);
      }

      // Other scripts
      const scripts = [
        "https://cdn.jsdelivr.net/npm/@popperjs/core@2.9.3/dist/umd/popper.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/typed.js/2.0.11/typed.min.js",
        "/frontend/js/customize.js",
        "/frontend/js/owl.carousel.min.js",
        "/assets/libs/feather-icons/dist/feather.min.js",
        "/assets/libs/datatables/media/js/jquery.dataTables.min.js",
        "/assets/libs/datatables.net-bs5/js/dataTables.bootstrap5.min.js",
        "/assets/libs/datatables.net-responsive/js/dataTables.responsive.min.js",
        "/assets/js/vendors/datatable.js",
      ];

      scripts.forEach((src) => {
        if (!document.querySelector(`script[src="${src}"]`)) {
          const script = document.createElement("script");
          script.src = src;
          script.crossOrigin = "anonymous";
          document.head.appendChild(script);
        }
      });
    };

    // Load scripts when DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", loadScripts);
    } else {
      loadScripts();
    }
  }, []);

  return (
    <>
      {/* header */}
      <FrontHeaderBar />
      {/* header */}

      {children}

      <FrontFooterBar />
      <ChatbotLoader />
    </>
  );
};

export default Layout;
