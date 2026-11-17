// app/components/FlowiseChat.tsx
import { useEffect } from 'react';

const CHATFLOW_ID = 'e7b45b6f-14f0-4430-b005-ea25f107d88c';
const API_HOST = 'https://flowise.aidera.co.uk';
const AGENT_ID = '1750954284916615';

export function FlowiseChat() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const getFlowiseKey = (chatflowId: string) => Object.keys(localStorage).find(k => k.startsWith(chatflowId) && k.endsWith('_EXTERNAL'));

    (async () => {
      try {
        const { default: Chatbot } = await import('https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js');
        if (cancelled) return;

        const KEY = `flowise-chat-${AGENT_ID}`;
        let fallbackChatId = localStorage.getItem(KEY);
        if (!fallbackChatId) {
          fallbackChatId = crypto.randomUUID();
          localStorage.setItem(KEY, fallbackChatId);
        }

        const res = await fetch('/api/chatagent', {
          method: 'POST',
          body: new URLSearchParams({ id: AGENT_ID }),
        });
        if (!res.ok) throw new Error('Failed to load chatbot configuration');
        const { prompt, _id, theme } = await res.json();

        console.log('Initializing FlowiseChat with config:', { theme });

        Chatbot.init({
          chatflowid: CHATFLOW_ID,
          apiHost: API_HOST,
          chatflowConfig: {
            responsePrompt: prompt,
            returnSourceDocuments: false,
            qdrantFilter: {
              should: [{ key: 'metadata.bot', match: { value: AGENT_ID } }],
            },
          },
          overrideConfig: { vars: { clientId: AGENT_ID } },
          observersConfig: {
            observeMessages: () => {
              const key = getFlowiseKey(CHATFLOW_ID);
              if (!key) return;
              let raw: any;
              try {
                raw = JSON.parse(localStorage.getItem(key)!);
              } catch {
                return;
              }
              fetch('/api/chatevents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  clientId: AGENT_ID,
                  chatId: raw.chatId,
                  agent: _id,
                  lead: raw.lead,
                  transcript: raw.chatHistory,
                }),
              }).catch(console.error);
            },
          },
          theme,
        });
      } catch (err) {
        console.error('Error initializing chatbot:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return <flowise-fullchatbot></flowise-fullchatbot>;
}
