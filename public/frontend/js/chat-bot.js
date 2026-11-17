// chat-bot.js

(function () {
  /* global Chatbot */
  // Get the agentId from the global configuration
  const agentId = window.chatbotConfig && window.chatbotConfig.agentId;

  if (!agentId) {
    console.error("Agent ID is not defined in chatbotConfig.");
    return;
  }

  const clientId = agentId;

  /* helper: find the localStorage key that ends with "_EXTERNAL" */
  function getFlowiseKey(chatflowId) {
    return Object.keys(localStorage).find(
      (k) => k.startsWith(chatflowId) && k.endsWith("_EXTERNAL"),
    );
  }

  // Flowise embed uses a WebComponent that renders inside a shadowRoot.
  function getChatHostAndRoot() {
    const host =
      document.querySelector("flowise-chatbot") ||
      document.getElementById("flowise__chatwindow");
    const root = host && host.shadowRoot ? host.shadowRoot : host;
    return { host, root };
  }

  // Function to dynamically load a script
  function loadScript(src, type = "text/javascript") {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.type = type;
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Load the external script and initialize the chatbot
  (async function () {
    try {
      // Load the required external script
      await loadScript(
        "https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js",
        "module",
      );

      // Wait for 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Fetch chatbot configuration
      const response = await fetch("https://www.talknova.ai/api/chatagent", {
        method: "POST",
        body: new URLSearchParams({ id: agentId }),
      });

      if (!response.ok) {
        throw new Error("Failed to load chatbot configuration");
      }

      const CHATFLOW_ID = "e7b45b6f-14f0-4430-b005-ea25f107d88c";

      /* ------- 3  local, persistent chatId fallback ------- */
      const KEY = `flowise-chat-${clientId}`;
      let fallbackChatId = localStorage.getItem(KEY);
      if (!fallbackChatId) {
        /* crypto.randomUUID is native in all modern browsers ≥ 92 / 95 / 15.4 */ /* :contentReference[oaicite:1]{index=1} */
        fallbackChatId = crypto.randomUUID();
        localStorage.setItem(KEY, fallbackChatId);
      }

      const data = await response.json();
      const { prompt, _id, theme } = data;

      console.log("Chatbot configuration:>>>>", data);

      // Check if lead exists in localStorage
      const flowiseKey = getFlowiseKey(CHATFLOW_ID);
      let existingLead = null;
      if (flowiseKey) {
        try {
          const flowiseData = JSON.parse(
            localStorage.getItem(flowiseKey) || "{}",
          );
          existingLead = flowiseData.lead;
        } catch (e) {
          console.warn("Could not parse existing Flowise data", e);
        }
      }

      // Function to initialize chatbot
      const initializeChatbot = (leadData) => {
        if (typeof Chatbot === "undefined") {
          console.error("Chatbot script not loaded.");
          return;
        }

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
          overrideConfig: {
            vars: {
              clientId: agentId,
              ...(leadData
                ? {
                    leadName: leadData.name,
                    leadEmail: leadData.email,
                    leadPhone: leadData.phone || "",
                  }
                : {}),
            },
          },
          observersConfig: {
            observeMessages: () => {
              /* read the up-to-date blob from localStorage */
              const key = getFlowiseKey(CHATFLOW_ID);
              if (!key) return; /* first few ms before Flowise writes */
              let raw;
              try {
                raw = JSON.parse(localStorage.getItem(key));
              } catch {
                return;
              }

              // Ensure lead is stored
              if (leadData && !raw.lead) {
                raw.lead = leadData;
                localStorage.setItem(key, JSON.stringify(raw));
              }

              /* POST everything to Remix */
              fetch("https://www.talknova.ai/api/chatevents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  clientId,
                  chatId: raw.chatId,
                  agent: _id, // Flowise agent ID
                  lead: raw.lead || leadData, // {name,email,phone}
                  transcript: raw.chatHistory, // [{message,type,dateTime,…}]
                }),
              }).catch(console.error);
            },
          },
          theme: theme, // Include the theme in the initialization
        });

        // Function to add greeting message (with retry logic)
        const addGreetingMessage = (retryCount = 0) => {
          const { root } = getChatHostAndRoot();
          if (root) {
            // Try multiple selectors to find message area - be more aggressive
            const messageSelectors = [
              ".flowise-chat-message",
              '[class*="message"]',
              ".flowise-chat-body",
              ".flowise-chat-content",
              '[class*="content"]',
              '[class*="body"]',
              '[class*="chat"]',
            ];

            let messageArea = null;
            for (const selector of messageSelectors) {
              const elements = root.querySelectorAll(selector);
              // Find the element that contains messages or is scrollable
              for (const el of elements) {
                // Check if this element is likely the message container
                if (el.scrollHeight > 0 || el.children.length >= 0) {
                  messageArea = el;
                  break;
                }
              }
              if (messageArea) break;
            }

            // If still no message area found, try the chat window itself or any child
            if (!messageArea) {
              // Try to find any div inside the chat window
              const allDivs = root.querySelectorAll("div");
              for (const div of allDivs) {
                if (div.offsetHeight > 50 && div.offsetWidth > 100) {
                  messageArea = div;
                  break;
                }
              }
              // Last resort - use chat window itself
              if (!messageArea) {
                messageArea = root;
              }
            }

            if (messageArea) {
              // Check if greeting already exists
              const existingGreeting = messageArea.querySelector(
                ".flowise-greeting-message",
              );
              if (existingGreeting) {
                existingGreeting.remove();
              }

              // Create greeting message
              const greetingDiv = document.createElement("div");
              greetingDiv.className = "flowise-greeting-message";
              greetingDiv.setAttribute("data-greeting", "true");
              greetingDiv.style.cssText =
                "padding: 12px 16px; margin: 10px 0; background: #f0f0f0; border-radius: 8px; display: block !important;";
              greetingDiv.innerHTML = `
                <p style="margin: 0 0 8px 0; font-weight: 600; font-size: 15px;">Hi, I am Alexa</p>
                <p style="margin: 0; font-size: 14px; color: #555;">How can I help?</p>
              `;

              // Try to insert at the beginning of message area
              if (messageArea.children.length > 0) {
                messageArea.insertBefore(greetingDiv, messageArea.firstChild);
              } else {
                messageArea.appendChild(greetingDiv);
              }

              // Scroll to show greeting
              if (messageArea.scrollTo) {
                messageArea.scrollTo({ top: 0, behavior: "smooth" });
              } else if (messageArea.scrollTop !== undefined) {
                messageArea.scrollTop = 0;
              }
            } else if (retryCount < 10) {
              // Retry if message area not found (increased retries)
              setTimeout(() => addGreetingMessage(retryCount + 1), 300);
            }
          } else if (retryCount < 10) {
            // Retry if chat window not found (increased retries)
            setTimeout(() => addGreetingMessage(retryCount + 1), 300);
          }
        };

        // Add greeting message after chat initializes (if lead exists)
        if (leadData) {
          setTimeout(addGreetingMessage, 2500);
        }

        // Setup observer to detect when chat is reset/cleared
        const setupResetObserver = () => {
          const { root } = getChatHostAndRoot();
          if (!root) {
            setTimeout(setupResetObserver, 500);
            return;
          }

          // Find message area to observe
          const messageSelectors = [
            ".flowise-chat-message",
            '[class*="message"]',
            ".flowise-chat-body",
          ];

          let messageArea = null;
          for (const selector of messageSelectors) {
            messageArea = root.querySelector(selector);
            if (messageArea) break;
          }

          if (messageArea) {
            let lastMessageCount = messageArea.children.length;

            // Use MutationObserver to detect when messages are cleared
            const observer = new MutationObserver(() => {
              const currentMessageCount = messageArea.children.length;

              // If messages were removed (reset happened)
              if (
                currentMessageCount < lastMessageCount &&
                currentMessageCount === 0
              ) {
                // Wait a bit for reset to complete, then add greeting
                setTimeout(() => {
                  const hasGreeting = messageArea.querySelector(
                    ".flowise-greeting-message",
                  );
                  const hasMessages = messageArea.children.length > 0;

                  // If no greeting and no messages, add greeting
                  if (!hasGreeting && !hasMessages) {
                    addGreetingMessage();

                    // Clear chat history from localStorage but keep lead
                    const flowiseKey = getFlowiseKey(CHATFLOW_ID);
                    if (flowiseKey) {
                      try {
                        const flowiseData = JSON.parse(
                          localStorage.getItem(flowiseKey) || "{}",
                        );
                        flowiseData.chatHistory = [];
                        if (flowiseData.lead) {
                          // Keep lead data
                          localStorage.setItem(
                            flowiseKey,
                            JSON.stringify(flowiseData),
                          );
                        }
                      } catch (e) {
                        console.warn(
                          "Could not update Flowise data on reset",
                          e,
                        );
                      }
                    }
                  }
                }, 500);
              }

              lastMessageCount = currentMessageCount;
            });

            // Observe changes to message area
            observer.observe(messageArea, {
              childList: true,
              subtree: true,
            });

            // Use event delegation to catch all clicks on reset buttons (inside shadowRoot too)
            root.addEventListener("click", (e) => {
              const target = e.target;
              const isResetButton =
                target.closest('[class*="refresh"]') ||
                target.closest('[class*="reset"]') ||
                target.closest('[title*="refresh" i]') ||
                target.closest('[title*="reset" i]') ||
                (target.tagName === "BUTTON" &&
                  (target.getAttribute("aria-label") || "")
                    .toLowerCase()
                    .includes("refresh")) ||
                (target.tagName === "BUTTON" &&
                  (target.getAttribute("aria-label") || "")
                    .toLowerCase()
                    .includes("reset")) ||
                target.closest("button")?.querySelector('[class*="refresh"]') ||
                target.closest("button")?.querySelector('[class*="reset"]');

              if (isResetButton) {
                // Clear chat history from localStorage but keep lead
                const flowiseKey = getFlowiseKey(CHATFLOW_ID);
                if (flowiseKey) {
                  try {
                    const flowiseData = JSON.parse(
                      localStorage.getItem(flowiseKey) || "{}",
                    );
                    flowiseData.chatHistory = [];
                    if (flowiseData.lead) {
                      localStorage.setItem(
                        flowiseKey,
                        JSON.stringify(flowiseData),
                      );
                    }
                  } catch (e) {
                    console.warn("Could not update Flowise data on reset", e);
                  }
                }

                // Add greeting multiple times with increasing delays to ensure it appears
                setTimeout(() => addGreetingMessage(), 1000);
                setTimeout(() => addGreetingMessage(), 1500);
                setTimeout(() => addGreetingMessage(), 2000);
                setTimeout(() => addGreetingMessage(), 2500);
              }
            });
          } else {
            setTimeout(setupResetObserver, 500);
          }
        };

        // Setup reset observer after chat initializes
        setTimeout(setupResetObserver, 2000);
      };

      // Initialize chatbot directly - lead will be collected through chat interface
      initializeChatbot(existingLead || null);
    } catch (error) {
      console.error("Error initializing chatbot:", error);
    }
  })();
})();
