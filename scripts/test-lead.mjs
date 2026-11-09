// Tests api/lead.js with fetch stubbed (no real Sheet calls).
// Usage: npm test
import assert from 'node:assert/strict';

process.env.APPS_SCRIPT_URL = 'https://script.google.com/macros/s/TEST/exec';
process.env.APPS_SCRIPT_SECRET = 'test-secret';

const { POST } = await import('../api/lead.js');

let calls = [];
let sheetResponse = { ok: true };
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).includes('script.google.com')) return new Response(JSON.stringify(sheetResponse), { status: 200 });
  throw new Error('unexpected fetch ' + url);
};

const valid = {
  name: 'สมชาย ใจดี', email: 'Somchai@Example.com',
  company_status: 'registered-no-vat', package: 'vat-ready', start_timeline: 'within-1-month',
  addons: ['phone-02', 'doc-storage'],
  pdpa_consent: true, website: '', elapsed_ms: 12000,
  utm_source: 'facebook', utm_medium: 'paid', utm_campaign: 'launch', utm_content: 'video1',
  referrer: 'https://m.facebook.com/', landing_page: 'https://www.example.com/?utm_source=facebook',
};
const req = (body) => new Request('http://localhost/api/lead', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });

let passed = 0;
async function test(name, fn) {
  calls = []; sheetResponse = { ok: true };
  try { await fn(); passed++; console.log('  ok  ', name); }
  catch (e) { console.error('  FAIL', name, '\n', e); process.exitCode = 1; }
}

await test('valid lead is written to the Sheet', async () => {
  const res = await POST(req(valid));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 1);
  const sheet = JSON.parse(calls[0].init.body);
  assert.equal(sheet.secret, 'test-secret');
  assert.equal(sheet.lead.email, 'somchai@example.com');
  assert.equal(sheet.lead.package, 'VAT-ready');
  assert.equal(sheet.lead.start_timeline, 'ภายใน 1 เดือน');
  assert.equal(sheet.lead.company_status, 'จดแล้ว ยังไม่จด VAT');
  assert.equal(sheet.lead.addons, 'เบอร์ 02 โอนสายไปมือถือ, รับฝากเก็บเอกสารบริษัท');
  assert.equal(sheet.lead.utm_content, 'video1');
  assert.equal(sheet.lead.referrer, 'https://m.facebook.com/');
});

await test('invalid fields return 400 with field errors and no fetch', async () => {
  const res = await POST(req({ ...valid, email: 'nope', package: 'gold', pdpa_consent: false }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.deepEqual(Object.keys(body.errors).sort(), ['email', 'package', 'pdpa_consent']);
  assert.equal(calls.length, 0);
});

await test('no add-ons is fine, unknown add-on is rejected', async () => {
  let res = await POST(req({ ...valid, addons: [] }));
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(calls[0].init.body).lead.addons, '');
  calls = [];
  res = await POST(req({ ...valid, addons: ['gold'] }));
  assert.equal(res.status, 400);
  assert.deepEqual(Object.keys((await res.json()).errors), ['addons']);
});

await test('no phone field is collected', async () => {
  const res = await POST(req({ ...valid, phone: '0812345678' }));
  assert.equal(res.status, 200);
  assert.equal('phone' in JSON.parse(calls[0].init.body).lead, false);
});

await test('honeypot is silently dropped', async () => {
  const res = await POST(req({ ...valid, website: 'http://spam' }));
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
});

await test('too-fast submit is silently dropped', async () => {
  const res = await POST(req({ ...valid, elapsed_ms: 300 }));
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
});

await test('Sheet failure returns 502', async () => {
  sheetResponse = { ok: false, error: 'unauthorized' };
  const res = await POST(req(valid));
  assert.equal(res.status, 502);
  assert.equal(calls.length, 1);
});

await test('bad JSON returns 400', async () => {
  const res = await POST(req('{not json'));
  assert.equal(res.status, 400);
});

console.log(`\n${passed} passed`);
