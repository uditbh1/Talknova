import { Readability } from "@mozilla/readability";
import { convert } from "html-to-text";
import { JSDOM } from "jsdom";

const FETCH_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent":
    "TalknovaCrawler/1.0 (+https://talknova.ai; AI content ingestion)",
};

const NOISY_SELECTORS = [
  "script",
  "noscript",
  "style",
  "template",
  "iframe",
  "canvas",
  "svg",
  "picture",
  "video",
  "audio",
  "source",
  "object",
  "embed",
  "form",
  "dialog",
  "button",
  "input",
  "select",
  "textarea",
  "meta",
  "link[rel='preload']",
  "link[rel='modulepreload']",
  "link[rel='prefetch']",
  "[aria-hidden='true']",
  "[hidden]",
].join(", ");

function normalizeText(value) {
  return String(value)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getTextLength(text) {
  return normalizeText(text).length;
}

function htmlToMeaningfulText(html) {
  return normalizeText(
    convert(html, {
      baseElements: { selectors: ["body"] },
      selectors: [
        { selector: "a", options: { ignoreHref: true } },
        { selector: "img", format: "skip" },
        { selector: "svg", format: "skip" },
        { selector: "nav", format: "skip" },
        { selector: "footer", format: "skip" },
        { selector: "script", format: "skip" },
        { selector: "style", format: "skip" },
      ],
      wordwrap: false,
      preserveNewlines: true,
      uppercaseHeadings: false,
      singleNewLineParagraphs: false,
    }),
  );
}

function removeComments(document) {
  if (!document.defaultView) return;

  const comments = [];
  const walker = document.createTreeWalker(
    document.documentElement,
    document.defaultView.NodeFilter.SHOW_COMMENT,
  );

  while (walker.nextNode()) {
    comments.push(walker.currentNode);
  }

  comments.forEach((node) => node.remove());
}

function stripAttributes(document) {
  for (const element of document.querySelectorAll("*")) {
    for (const attributeName of element.getAttributeNames()) {
      const normalizedName = attributeName.toLowerCase();

      if (
        normalizedName === "style" ||
        normalizedName === "srcset" ||
        normalizedName === "nonce" ||
        normalizedName === "integrity" ||
        normalizedName === "crossorigin" ||
        normalizedName.startsWith("on") ||
        normalizedName.startsWith("data-")
      ) {
        element.removeAttribute(attributeName);
      }
    }
  }
}

function stripNoise(document) {
  document.querySelectorAll(NOISY_SELECTORS).forEach((element) => {
    element.remove();
  });
  removeComments(document);
  stripAttributes(document);
}

function buildSnapshotText({ title, url, text, excerpt }) {
  return normalizeText(
    [
      title ? `Title: ${title}` : "",
      `Source: ${url}`,
      excerpt ? `Summary: ${excerpt}` : "",
      "Content:",
      text,
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
}

function buildReadableSnapshotText(html, url) {
  const dom = new JSDOM(html, { url });

  try {
    const article = new Readability(dom.window.document, {
      keepClasses: false,
    }).parse();

    if (!article?.content || getTextLength(article.textContent || "") < 200) {
      return null;
    }

    const articleDom = new JSDOM(`<body>${article.content}</body>`, { url });
    try {
      stripNoise(articleDom.window.document);

      const text = htmlToMeaningfulText(
        articleDom.window.document.body.innerHTML,
      );
      if (getTextLength(text) < 200) {
        return null;
      }

      return buildSnapshotText({
        title: article.title,
        url,
        text,
        excerpt: article.excerpt,
      });
    } finally {
      articleDom.window.close();
    }
  } finally {
    dom.window.close();
  }
}

function buildBodySnapshotText(html, url) {
  const dom = new JSDOM(html, { url });

  try {
    const { document } = dom.window;
    stripNoise(document);

    const mainRoot =
      document.querySelector("main, article, [role='main']") ||
      document.body ||
      document.documentElement;

    const mainText = htmlToMeaningfulText(mainRoot.innerHTML || "");
    const bodyText =
      getTextLength(mainText) >= 100
        ? mainText
        : htmlToMeaningfulText(
            (document.body || document.documentElement).innerHTML || "",
          );

    if (getTextLength(bodyText) < 100) {
      return null;
    }

    return buildSnapshotText({
      title: document.title,
      url,
      text: bodyText,
    });
  } finally {
    dom.window.close();
  }
}

export function extractMeaningfulText(html, url) {
  const readableSnapshot = buildReadableSnapshotText(html, url);
  if (readableSnapshot) {
    return readableSnapshot;
  }

  const bodySnapshot = buildBodySnapshotText(html, url);
  if (bodySnapshot) {
    return bodySnapshot;
  }

  throw new Error(`No meaningful body content found for ${url}`);
}

export async function fetchMeaningfulText(url) {
  const response = await fetch(url, {
    headers: FETCH_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType && !/html|xhtml/i.test(contentType)) {
    throw new Error(`Unsupported content type for ${url}: ${contentType}`);
  }

  const html = await response.text();
  return extractMeaningfulText(html, url);
}
