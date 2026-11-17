// app/routes/api/ai/upsert.js
import { json } from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import { QdrantClient } from "@qdrant/js-client-rest";

// 1) unstructured-client imports:
import { UnstructuredClient } from "unstructured-client";
import {
  Strategy,
  ChunkingStrategy,
} from "unstructured-client/sdk/models/shared";

/**
 * ENV & CONFIG (Default values)
 */
const DEFAULT_QDRANT_URL = process.env.QDRANT_URL;
const DEFAULT_QDRANT_API_KEY = process.env.QDRANT_API_KEY || "";
const DEFAULT_OLLAMA_URL = process.env.OLLAMA_URL;
const DEFAULT_COLLECTION_NAME = process.env.COLLECTION_NAME;

const FILE_BASE_URL = process.env.R2_PUBLIC_URL || "";

// If your unstructured service requires an API key:
const UNSTRUCTURED_API_KEY = process.env.UNSTRUCTURED_API_KEY || "";
// Example: "https://my-unstructured.service"
const UNSTRUCTURED_API_URL =
  process.env.UNSTRUCTURED_API_URL ||
  "https://unstructured.aidera.co.uk/general/v0/general";

/**
 * TUNABLE CONSTANTS FOR CHUNKING / UNSTRUCTURED
 * ---------------------------------------------
 * Adjust these for best performance & text size in RAG.
 */
const UNSTRUCTURED_STRATEGY = Strategy.HiRes; // or .Auto, .Fast, etc.
const UNSTRUCTURED_CHUNK_STRATEGY = ChunkingStrategy.ByTitle; // create bigger paragraphs
const CHUNK_SIZE = 2000; // maximum characters per chunk (slightly smaller to force ~5–8 lines)
const CHUNK_OVERLAP = 200; // overlap between adjacent chunks
const SPLIT_PDF_PAGE = true; // split PDF pages
const SPLIT_PDF_ALLOW_FAILED = true;
const SPLIT_PDF_CONCURRENCY = 5; // how many pages to process in parallel

/**
 * unstructured-client
 */
const unstructuredClient = new UnstructuredClient({
  serverURL: UNSTRUCTURED_API_URL,
  security: {
    apiKeyAuth: UNSTRUCTURED_API_KEY,
  },
  // debugLogger: console, // uncomment to see debug logs
});

/**
 * Allowed file extensions
 */
const ALLOWED_EXTENSIONS = new Set([
  // Plaintext
  ".txt",
  ".eml",
  ".msg",
  ".xml",
  ".html",
  ".md",
  ".rst",
  ".json",
  ".rtf",
  // Images
  ".jpeg",
  ".jpg",
  ".png",
  // Documents
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".pdf",
  ".odt",
  ".epub",
  ".csv",
  ".tsv",
  ".xlsx",
]);

////////////////////////////////////////////////////////////////////////////////
// ACTION: /api/ai/upsert
////////////////////////////////////////////////////////////////////////////////
export async function action({ request }) {
  try {
    const body = await request.json();

    // Extract top-level fields
    const {
      agentName,
      docs,
      metadata: topLevelMetadata = {},
      config = {},
    } = body;
    if (!agentName || !docs) {
      return json(
        { status: false, message: "Missing agentName or docs in JSON" },
        { status: 400 },
      );
    }
    if (!Array.isArray(docs) || docs.length === 0) {
      return json(
        { status: false, message: "docs must be a non-empty array" },
        { status: 400 },
      );
    }

    // Extract config overrides (if any)
    const {
      QDRANT_URL: cfgQdrantUrl,
      QDRANT_API_KEY: cfgQdrantApiKey,
      OLLAMA_URL: cfgOllamaUrl,
      COLLECTION_NAME: cfgCollectionName,
      CRAWL4AI_URL: cfgCrawl4aiUrl, // not actually used in the code, but we store it
    } = config;

    // Final fallback to ENV or defaults
    const finalQdrantUrl = cfgQdrantUrl || DEFAULT_QDRANT_URL;
    const finalQdrantApiKey = cfgQdrantApiKey || DEFAULT_QDRANT_API_KEY;
    const finalOllamaUrl = cfgOllamaUrl || DEFAULT_OLLAMA_URL;
    const finalCollectionName = cfgCollectionName || DEFAULT_COLLECTION_NAME;

    // Initialize a local QdrantClient with final config
    const qdrantClient = new QdrantClient({
      url: finalQdrantUrl,
      apiKey: finalQdrantApiKey,
    });

    // Helper: Check if a file is already in Qdrant
    async function checkFileExistsInQdrant(filename, agentName) {
      try {
        const scrollRes = await qdrantClient.scroll(finalCollectionName, {
          limit: 1,
          filter: {
            must: [
              { key: "metadata.filename", match: { value: filename } },
              { key: "metadata.bot", match: { value: agentName } },
            ],
          },
        });
        return scrollRes.points && scrollRes.points.length > 0;
      } catch (err) {
        console.error("Error checking Qdrant:", err.message);
        // If error, treat as not found
        return false;
      }
    }

    // Helper: Check extension
    function isAllowedExtension(filename) {
      const ext = path.extname(filename).toLowerCase();
      return ALLOWED_EXTENSIONS.has(ext);
    }

    // Helper: Download file from public object URL
    async function downloadFile(filename) {
      try {
        if (!FILE_BASE_URL) {
          return { status: false, message: "FILE_BASE_URL is not set." };
        }
        const fileUrl = FILE_BASE_URL.endsWith("/")
          ? `${FILE_BASE_URL}${filename}`
          : `${FILE_BASE_URL}/${filename}`;

        console.log("Downloading file:", fileUrl);
        const resp = await axios.get(fileUrl, { responseType: "arraybuffer" });
        if (resp.status !== 200) {
          return {
            status: false,
            message: `Failed download: ${resp.status}`,
          };
        }

        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "upsert-"));
        const localPath = path.join(tmpDir, path.basename(filename));
        fs.writeFileSync(localPath, resp.data);
        return { status: true, localPath };
      } catch (error) {
        console.error("File download error:", error.message);
        return { status: false, message: error.message };
      }
    }

    // Helper: Parse file => get array of chunk texts
    async function parseFileAndGetChunks(localPath) {
      const fileContent = fs.readFileSync(localPath);

      const result = await unstructuredClient.general.partition({
        partitionParameters: {
          files: {
            content: fileContent,
            fileName: path.basename(localPath),
          },
          strategy: UNSTRUCTURED_STRATEGY,
          chunkingStrategy: UNSTRUCTURED_CHUNK_STRATEGY,
          chunkingParams: {
            maxCharacters: CHUNK_SIZE,
            overlap: CHUNK_OVERLAP,
          },
          splitPdfPage: SPLIT_PDF_PAGE,
          splitPdfAllowFailed: SPLIT_PDF_ALLOW_FAILED,
          splitPdfConcurrencyLevel: SPLIT_PDF_CONCURRENCY,
        },
      });

      if (result.statusCode !== 200) {
        throw new Error(`Unstructured parse error: ${result.statusCode}`);
      }
      if (!result.elements || result.elements.length === 0) {
        return [];
      }

      const chunkedTexts = [];
      for (const elt of result.elements) {
        if (!elt.text) continue;
        const chunk = elt.text.trim();
        if (chunk) {
          chunkedTexts.push(chunk);
        }
      }

      return chunkedTexts;
    }

    // Helper: Get embedding from Ollama
    async function getOllamaEmbedding(text) {
      const payload = {
        prompt: text,
        model: "nomic-embed-text",
      };
      const resp = await axios.post(
        `${finalOllamaUrl}/api/embeddings`,
        payload,
        {
          headers: { "Content-Type": "application/json" },
          timeout: 180000, // 3 minutes
        },
      );
      if (resp.status !== 200 || !resp.data?.embedding) {
        throw new Error(
          `No embedding or invalid Ollama response: ${resp.status}`,
        );
      }
      return resp.data.embedding;
    }

    // Helper: Upsert chunk to Qdrant
    async function upsertChunkToQdrant({
      embedding,
      chunkText,
      filename,
      agentName,
      chunkIndex,
      docMetadata = {},
    }) {
      const pointId = uuidv4();

      // Merge top-level metadata with doc-level metadata
      // (docMetadata itself might already have some merging,
      //  but let's be explicit here if needed.)
      const mergedMetadata = {
        ...topLevelMetadata, // from request.body.metadata
        ...docMetadata, // from doc metadata
      };

      // The payload for Qdrant
      const payload = {
        content: chunkText,
        metadata: {
          filename, // always store the S3 key name
          bot: agentName,
          campus: "klaspadai",
          source: filename,
          description: "BOT",
          chunk_index: chunkIndex,
          ...mergedMetadata, // the merged metadata goes last
        },
      };

      await qdrantClient.upsert(finalCollectionName, {
        points: [
          {
            id: pointId,
            vector: embedding,
            payload,
          },
        ],
      });
    }

    // ------------------------------------------------------------------------
    // Main loop: process each doc
    // ------------------------------------------------------------------------
    const results = [];

    for (const doc of docs) {
      // Each doc can also have its own `metadata` object
      const { filename, metadata: docMetadata = {} } = doc;

      if (!filename) {
        results.push({
          status: false,
          message: "doc missing filename property",
        });
        continue;
      }

      // check extension
      if (!isAllowedExtension(filename)) {
        results.push({
          status: false,
          message: `Unsupported file extension for ${filename}`,
        });
        continue;
      }

      // 1) Qdrant check (skip if already there)
      const exists = await checkFileExistsInQdrant(filename, agentName);
      if (exists) {
        results.push({
          status: true,
          message: `Skipping ${filename}; already in Qdrant.`,
        });
        continue;
      }

      // 2) Download file
      const downloadResult = await downloadFile(filename);
      if (!downloadResult.status) {
        results.push({
          status: false,
          message: `Cannot download ${filename}: ${downloadResult.message}`,
        });
        continue;
      }

      // 3) Parse => get array of chunk texts
      let chunkedTexts;
      try {
        chunkedTexts = await parseFileAndGetChunks(downloadResult.localPath);
      } catch (parseErr) {
        results.push({
          status: false,
          message: `Unstructured parse error for ${filename}: ${parseErr.message}`,
        });
        continue;
      }

      if (!chunkedTexts || chunkedTexts.length === 0) {
        results.push({
          status: false,
          message: `[No usable text extracted from ${filename}]`,
        });
        continue;
      }

      // 4) For each chunk => embed & upsert
      let chunkIndex = 0;
      for (const chunk of chunkedTexts) {
        try {
          // embed
          const embedding = await getOllamaEmbedding(chunk);
          // upsert
          await upsertChunkToQdrant({
            embedding,
            chunkText: chunk,
            filename,
            agentName,
            chunkIndex,
            docMetadata,
          });
          chunkIndex++;
        } catch (err) {
          console.error(
            `Error embedding/upserting chunk #${chunkIndex} of ${filename}:`,
            err,
          );
          // If one chunk fails, we continue with others
        }
      }

      results.push({
        status: true,
        message: `Upserted ${chunkIndex} chunks for ${filename} successfully.`,
      });
    }

    return json({ status: true, results }, { status: 200 });
  } catch (err) {
    console.error("Error in upsert action:", err);
    return json({ status: false, message: err.message }, { status: 500 });
  }
}
