/* app/routes/passport-upload.tsx */
import {
  json,
  unstable_parseMultipartFormData as parseMultipartFormData,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
} from '@remix-run/node';
import { Form, useActionData, useNavigation } from '@remix-run/react';
import { getUserFromSession } from '~/utils/auth.server';
import FrontLayout from '~/components/FrontLayout';
import { frontendLinks } from '~/utils/frontend-links';

export const links = frontendLinks;
import { useEffect, useRef } from 'react';
import { OpenAI } from 'openai';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { pdfToPng } from 'pdf-to-png-converter';
import { createWorker } from 'tesseract.js';
import { parse as parseDate, formatISO } from 'date-fns';

export async function loader({ request }) {
  return { user: await getUserFromSession(request) };
}

/* ───────── helpers ───────── */
function tryParse(str?: string | null) {
  if (!str) return null;
  const fmts = ['dd MMM yyyy', 'd MMM yyyy', 'dd MMM yy', 'd MMM yy'];
  for (const f of fmts) {
    const d = parseDate(str.toUpperCase(), f, new Date());
    if (!Number.isNaN(d.valueOf())) return d;
  }
  return null;
}

/* ───────── Remix action ───────── */
export const action = async ({ request }) => {
  const formData = await parseMultipartFormData(request, composeUploadHandlers(createMemoryUploadHandler({ maxPartSize: 10_000_000 })));

  const file = formData.get('passport') as File | undefined;
  if (!file) return json({ status: 'ERROR', messages: ['No file supplied'] }, 400);

  const isPdf = file.type === 'application/pdf';
  const isImage = file.type.startsWith('image/');

  if (!isPdf && !isImage) return json({ status: 'ERROR', messages: ['Only PDF, JPEG or PNG files are accepted'] }, 400);

  const fileBuf = Buffer.from(await file.arrayBuffer());
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  /* ---------- plain-text extraction (PDF only) ---------- */
  let pdfText = '';
  if (isPdf) {
    try {
      pdfText = (await pdfParse(fileBuf)).text;
    } catch {}
  }

  /* ---------- render pages / build pngPages array ---------- */
  const pngPages: { content: Buffer }[] = [];
  const errors: string[] = [];

  if (isPdf) {
    try {
      const pages = await pdfToPng(new Uint8Array(fileBuf), { viewportScale: 2 });
      pngPages.push(...pages);
    } catch (e: any) {
      errors.push(`pdfToPng failed: ${e.message}`);
    }
    if (!pngPages.length) return json({ status: 'ERROR', messages: ['No images found', ...errors] });
  } else {
    /* image upload – push directly */
    pngPages.push({ content: fileBuf });
  }

  /* ---------- OpenAI Vision helper ---------- */
  const systemPrompt = `Return ONLY JSON:
{first_name,surname,passport_number,nationality,dob,issue_date,sex,expiry,mrz,photo_base64,errors}`;

  const visionOCR = async (buf: Buffer) =>
    JSON.parse(
      (
        await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          response_format: { type: 'json_object' },
          temperature: 0,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:image/png;base64,${buf.toString('base64')}`, detail: 'high' },
                },
              ],
            },
          ],
        })
      ).choices[0].message.content
    );

  /* ---------- OCR loop with Tesseract fallback ---------- */
  const pageResults: any[] = [];
  for (const { content } of pngPages) {
    try {
      pageResults.push(await visionOCR(content));
    } catch (vErr: any) {
      try {
        const worker = await createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        const {
          data: { text },
        } = await worker.recognize(content);
        await worker.terminate();
        pageResults.push({ mrz: text.trim(), errors: [`Vision failed: ${vErr.message}`] });
      } catch (tErr: any) {
        pageResults.push({ errors: [`Vision failed: ${vErr.message}`, `Tesseract failed: ${tErr.message}`] });
      }
    }
  }

  /* ---------- merge results ---------- */
  const pretty: any = { errors, source_text: pdfText };
  for (const p of pageResults) {
    if (p && typeof p === 'object') {
      for (const [k, v] of Object.entries(p)) {
        if (v && pretty[k] == null) pretty[k] = v;
      }
    }
  }

  /* ---------- ISO date fields ---------- */
  const db = { ...pretty };
  const dob = tryParse(pretty.dob);
  const iss = tryParse(pretty.issue_date);
  const exp = tryParse(pretty.expiry);
  if (dob) db.dob = formatISO(dob);
  if (iss) db.issue_date = formatISO(iss);
  if (exp) db.expiry = formatISO(exp);

  return json({ status: 'OK', pretty, db });
};

/* ───────── UI helpers ───────── */
function PassportCard({ data }: { data: any }) {
  return (
    <div className="card mx-auto mb-4 mt-4 shadow-sm">
      <div className="card-body">
        <h5 className="card-title">
          {data.first_name ?? '—'} {data.surname ?? ''}
        </h5>
        <table className="table table-sm mb-0">
          <tbody>
            <tr>
              <th scope="row">Passport #</th>
              <td>{data.passport_number ?? '—'}</td>
            </tr>
            <tr>
              <th scope="row">Nationality</th>
              <td>{data.nationality ?? '—'}</td>
            </tr>
            <tr>
              <th scope="row">Issue&nbsp;Date</th>
              <td>{data.issue_date ?? '—'}</td>
            </tr>
            <tr>
              <th scope="row">DOB</th>
              <td>{data.dob ?? '—'}</td>
            </tr>
            <tr>
              <th scope="row">Sex</th>
              <td>{data.sex ?? '—'}</td>
            </tr>
            <tr>
              <th scope="row">Expiry</th>
              <td>{data.expiry ?? '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {data.mrz && <div className="card-footer bg-dark text-success small text-monospace py-2">{data.mrz}</div>}
    </div>
  );
}

/* ───────── Page component ───────── */
export default function PassportUpload() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (navigation.state === 'idle' && actionData?.status === 'OK') fileInput.current && (fileInput.current.value = '');
  }, [navigation.state, actionData]);

  return (
    <FrontLayout>
      <section className="document-container bg-light py-5">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-7">
              {/* Hero / disclaimer */}
              <div className="text-center mb-5">
                <h2 className="fw-bold mb-2">AI-Powered Passport Extractor</h2>
                <p className="text-muted mb-1">
                  Upload a scanned passport PDF <em>or</em> a clear JPEG/PNG photo and we’ll pull out the key details automatically.
                </p>
                <p className="text-muted small">
                  We do <strong>not</strong> store your file or extracted data; everything is discarded as soon as you close this window.
                </p>
              </div>

              {/* Error alert */}
              {actionData?.status === 'ERROR' && <div className="alert alert-danger">{actionData.messages?.join(' • ')}</div>}

              {/* Form */}
              <Form method="post" encType="multipart/form-data" className="card p-4">
                <div className="mb-3">
                  <label className="form-label" htmlFor="passport">
                    Passport PDF / Image
                  </label>
                  <input ref={fileInput} type="file" name="passport" id="passport" accept="application/pdf,image/jpeg,image/png" className="form-control" required />
                </div>
                <button className="btn btn-primary w-100" type="submit" disabled={navigation.state === 'submitting'}>
                  {navigation.state === 'submitting' ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      Extracting…
                    </>
                  ) : (
                    'Upload & Extract'
                  )}
                </button>
              </Form>

              {/* Overlay spinner */}
              {navigation.state === 'submitting' && (
                <div
                  className="position-fixed top-0 start-0 w-100 h-100 bg-white bg-opacity-75
                                d-flex flex-column justify-content-center align-items-center">
                  <div className="spinner-border text-primary mb-3" role="status" />
                  <p className="fw-semibold">Processing document…</p>
                </div>
              )}

              {/* Result */}
              {actionData?.status === 'OK' && (
                <>
                  <PassportCard data={actionData.pretty} />

                  <div className="accordion" id="jsonAccordion">
                    <div className="accordion-item">
                      <h2 className="accordion-header" id="headingOne">
                        <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne">
                          JSON (pretty)
                        </button>
                      </h2>
                      <div id="collapseOne" className="accordion-collapse collapse" data-bs-parent="#jsonAccordion">
                        <div className="accordion-body">
                          <pre className="small bg-light p-3 border rounded">{JSON.stringify(actionData.pretty, null, 2)}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </FrontLayout>
  );
}
