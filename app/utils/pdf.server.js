import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";
import { Upload } from "@aws-sdk/lib-storage";
import { randomUUID } from "crypto";
import { createR2ClientAndBucket } from "~/utils/r2.server";

/**
 * Generate a single landscape PDF from multiple URLs.
 * Uses STORAGE_* env vars for S3 credentials & bucket.
 */
export async function generatePdfFromUrls({ urls, saveAs = "" }) {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const pdfBuffers = [];
  try {
    for (const url of urls) {
      const page = await browser.newPage();

      /* 1️⃣  Open the page in a wide viewport so desktop CSS is chosen */
      const VIEWPORT_WIDTH = 1920; // wide enough for most sites :contentReference[oaicite:2]{index=2}
      await page.setViewport({ width: VIEWPORT_WIDTH, height: 1080 });
      await page.goto(url, { waitUntil: "networkidle2" });
      await page.emulateMediaType("screen");

      /* 2️⃣  Compute how much we need to shrink to fit A4-landscape width */
      const contentWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      ); // reports rendered CSS px width

      // Printable width of A4 landscape = 297 mm ≈ 11.7 in ≈ 1122 px at 96 DPI
      const PRINTABLE_PX = 1122;
      const scale = Math.min(1, PRINTABLE_PX / contentWidth); // never upscale

      /* 3️⃣  Produce an individual PDF page with zero margins */
      pdfBuffers.push(
        await page.pdf({
          format: "A4",
          landscape: true, // wider page :contentReference[oaicite:3]{index=3}
          printBackground: true, // keep colours :contentReference[oaicite:4]{index=4}
          margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
          scale, // dynamic shrink factor
          preferCSSPageSize: false, // override site @page if present :contentReference[oaicite:5]{index=5}
        }),
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }

  /* 4️⃣  Merge all individual PDFs */
  const merged = await PDFDocument.create();
  for (const buf of pdfBuffers) {
    const src = await PDFDocument.load(buf);
    const pages = await merged.copyPages(src, src.getPageIndices()); // :contentReference[oaicite:6]{index=6}
    pages.forEach((p) => merged.addPage(p));
  }
  const finalPdf = await merged.save();

  /* 5️⃣  Upload to S3 using multipart-aware helper */
  const { client, bucket } = createR2ClientAndBucket();

  const Key = `${saveAs}.pdf`; // unique name :contentReference[oaicite:7]{index=7}
  await new Upload({
    client,
    params: {
      Bucket: bucket,
      Key,
      ContentType: "application/pdf",
      Body: Buffer.from(finalPdf),
    },
  }).done();

  return Key;
}
