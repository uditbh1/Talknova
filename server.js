import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createRequestHandler } from "@remix-run/express";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Talknova — Temporarily Unavailable</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .box { text-align: center; padding: 2rem; max-width: 28rem; }
    h1 { color: #333; font-size: 1.5rem; }
    p { color: #666; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="box">
    <h1>We'll be back soon</h1>
    <p>Talknova is temporarily unavailable. Please try again later.</p>
  </div>
</body>
</html>`;

function isMaintenanceMode() {
  return process.env.MAINTENANCE_MODE === "true";
}

function isAllowedDuringMaintenance(reqPath) {
  return (
    reqPath.startsWith("/api/") ||
    reqPath.startsWith("/frontend/") ||
    reqPath.startsWith("/assets/") ||
    reqPath.startsWith("/build/")
  );
}

// CRITICAL: Serve static files from build/client BEFORE Remix handler
app.use(
  express.static(path.join(__dirname, "build/client"), {
    maxAge: "1y",
    immutable: true,
  }),
);

// Serve public folder
app.use(express.static(path.join(__dirname, "public")));

// Block website routes during maintenance; keep chatbot APIs and static assets alive
app.use((req, res, next) => {
  if (!isMaintenanceMode() || isAllowedDuringMaintenance(req.path)) {
    return next();
  }
  res.status(503).type("html").send(MAINTENANCE_HTML);
});

// Remix handler (must be last - catch-all)
const build = await import("./build/server/index.js");

app.all(
  "*",
  createRequestHandler({
    build,
    mode: process.env.NODE_ENV || "production",
    getLoadContext: () => ({}),
  }),
);

const port = process.env.PORT || 3025;
app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
  console.log(
    `Serving static files from: ${path.join(__dirname, "build/client")}`,
  );
  if (isMaintenanceMode()) {
    console.log(
      "MAINTENANCE_MODE is enabled — website routes return 503; /api/* still active",
    );
  }
});
