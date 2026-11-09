// POST /api/lead
// Validates a waitlist lead and writes it to Google Sheets via an Apps Script Web App.
// Secrets live in env vars only (see .env.example).

export const PACKAGES = {
  address: 'Address',
  'vat-ready': 'VAT-ready',
  'vat-ready-ai': 'VAT-ready + AI',
};
export const COMPANY_STATUSES = {
  'not-registered': 'ยังไม่ได้จดทะเบียน',
  'registered-no-vat': 'จดแล้ว ยังไม่จด VAT',
  'vat-relocating': 'จด VAT แล้ว ต้องการย้ายที่อยู่',
};
export const TIMELINES = {
  'within-1-month': 'ภายใน 1 เดือน',
  '1-3-months': '1–3 เดือน',
  'not-sure': 'ยังไม่แน่ใจ ขอดูก่อน',
};
export const ADDONS = {
  'phone-02': 'เบอร์ 02 โอนสายไปมือถือ',
  'doc-storage': 'รับฝากเก็บเอกสารบริษัท',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_FILL_MS = 1500; // faster than this is almost certainly a bot
const MAX_BODY = 10_000;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);

export function validateLead(raw) {
  const lead = {
    name: str(raw.name, 100),
    email: str(raw.email, 160).toLowerCase(),
    company_status: str(raw.company_status, 40),
    package: str(raw.package, 40),
    start_timeline: str(raw.start_timeline, 40),
    addons: Array.isArray(raw.addons) ? [...new Set(raw.addons.map((a) => str(a, 40)))] : [],
    pdpa_consent: raw.pdpa_consent === true,
    utm_source: str(raw.utm_source),
    utm_medium: str(raw.utm_medium),
    utm_campaign: str(raw.utm_campaign),
    utm_content: str(raw.utm_content),
    referrer: str(raw.referrer, 500),
    landing_page: str(raw.landing_page, 500),
  };
  const errors = {};
  if (!lead.name) errors.name = 'required';
  if (!EMAIL_RE.test(lead.email)) errors.email = 'invalid';
  if (!COMPANY_STATUSES[lead.company_status]) errors.company_status = 'invalid';
  if (!PACKAGES[lead.package]) errors.package = 'invalid';
  if (!TIMELINES[lead.start_timeline]) errors.start_timeline = 'invalid';
  if (lead.addons.some((a) => !ADDONS[a])) errors.addons = 'invalid';
  if (!lead.pdpa_consent) errors.pdpa_consent = 'required';
  return { lead, errors };
}

function toSheetRow(lead) {
  return {
    name: lead.name,
    email: lead.email,
    company_status: COMPANY_STATUSES[lead.company_status],
    package: PACKAGES[lead.package],
    start_timeline: TIMELINES[lead.start_timeline],
    addons: lead.addons.map((a) => ADDONS[a]).join(', '),
    pdpa_consent: 'ยินยอม',
    utm_source: lead.utm_source,
    utm_medium: lead.utm_medium,
    utm_campaign: lead.utm_campaign,
    utm_content: lead.utm_content,
    referrer: lead.referrer,
    landing_page: lead.landing_page,
  };
}

async function writeToSheet(row) {
  const res = await fetch(process.env.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.APPS_SCRIPT_SECRET, lead: row }),
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok !== true) {
    throw new Error(`sheet_write_failed status=${res.status} error=${body.error ?? 'unknown'}`);
  }
}

export async function POST(request) {
  let raw;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json(413, { ok: false, error: 'too_large' });
    raw = JSON.parse(text);
  } catch {
    return json(400, { ok: false, error: 'bad_json' });
  }
  if (!raw || typeof raw !== 'object') return json(400, { ok: false, error: 'bad_json' });

  // Spam: honeypot filled or submitted impossibly fast. Pretend success so bots learn nothing.
  if (str(raw.website) || (Number(raw.elapsed_ms) > 0 && Number(raw.elapsed_ms) < MIN_FILL_MS)) {
    return json(200, { ok: true });
  }

  const { lead, errors } = validateLead(raw);
  if (Object.keys(errors).length) return json(400, { ok: false, errors });

  const row = toSheetRow(lead);

  if (!process.env.APPS_SCRIPT_URL) {
    if (process.env.VERCEL_ENV === 'production') {
      console.error('[lead] APPS_SCRIPT_URL is not set');
      return json(500, { ok: false, error: 'not_configured' });
    }
    console.log('[lead] dev mode, not saved:', row);
    return json(200, { ok: true, dev: true });
  }

  try {
    await writeToSheet(row);
  } catch (err) {
    console.error('[lead]', err.message);
    return json(502, { ok: false, error: 'save_failed' });
  }

  return json(200, { ok: true });
}

export function GET() {
  return json(405, { ok: false, error: 'method_not_allowed' });
}
