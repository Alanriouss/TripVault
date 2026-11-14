import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const v8Key = 'tripvault-timelocked-external-v8';
const v7Key = 'tripvault-timelocked-external-v7';
const output = process.env.TRIPVAULT_TEST_HTML || 'outputs/TripVault_TimeLocked_ExternalBills_v8.html';
const source = readFileSync(output, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const start = new Date((Math.floor(Date.now() / 3600000) + 2) * 3600000).toISOString();
const end = new Date(Date.parse(start) + 3600000).toISOString();
const flush = () => new Promise(resolve => setImmediate(resolve));

async function launch(options = {}, script = source) {
  const storage = options.storage || new Map();
  const page = { innerHTML: '' };
  let draftForm;
  const sheet = {
    open: false, showModal() { this.open = true; }, close() { this.open = false; draftForm = undefined; },
    querySelector(selector) {
      if (!this.open || !draftForm) return null;
      if (selector === '#bill-form[data-room]') return draftForm;
      if (selector === 'button[form="bill-form"]') return draftForm.submit;
      return null;
    },
  };
  const toast = { classList: { add() {}, remove() {} } };
  const events = {};
  const session = options.session || new Map();
  const timers = new Map();
  let timerId = 0;
  let now = Date.parse(start) - 60000;
  let rate = options.rate === undefined ? 25000 : options.rate;
  let requests = 0;
  runInNewContext(script, {
    AbortController, TextEncoder, URL, URLSearchParams,
    clearTimeout(id) { timers.delete(id); },
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    Date: class extends Date { static now() { return now; } },
    document: {
      getElementById: id => ({ app: page, sheet, toast }[id]),
      addEventListener: (name, listener) => { events[name] = listener; },
    },
    navigator: { language: options.language || 'vi' },
    window: { ethereum: options.provider, avalanche: options.core,
      location: options.url ? new URL(options.url) : undefined,
      scrollTo() {}, addEventListener: (name, listener) => { events[name] = listener; },
    },
    sessionStorage: {
      getItem: key => session.get(key) || null,
      setItem: (key, value) => { session.set(key, value); },
      removeItem: key => { session.delete(key); },
    },
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => {
        if (options.denyStorage) throw Error('Storage denied');
        storage.set(key, value);
      },
    },
    fetch: async (url, request) => {
      if (url.startsWith('/api/') && options.api) return options.api(new Request(new URL(url, options.url), request));
      if (url === 'https://api.avax-test.network/ext/bc/C/rpc' && options.fujiRpc) {
        const { method, params } = JSON.parse(request.body);
        return options.fujiRpc(method, params);
      }
      requests++;
      if (rate === null) throw Error('Network unavailable');
      return { ok: true, json: async () => ({ result: 'success', rates: { VND: rate }, time_last_update_utc: 'Test timestamp' }) };
    },
    FormData: class {
      constructor(form) { this.fields = form.fields; }
      get(name) { return this.fields[name] ?? null; }
      getAll(name) { return this.fields[name] ?? []; }
    },
  }, { timeout: 1000 });
  await flush();
  const click = (act, data = {}) => events.click({ target: { closest: () => ({
    dataset: { act, ...data }, closest: selector => sheet.querySelector(selector),
  }) } });
  const submit = (id, fields) => {
    const error = { textContent: '' };
    events.submit({ preventDefault() {}, target: { id, fields, querySelector: () => error } });
    return error.textContent;
  };
  const workspace = () => JSON.parse(storage.get(v8Key));
  const active = () => {
    const value = workspace();
    return value.trips.find(trip => trip.id === value.activeTripId);
  };
  const view = view => click('navigate', { view });
  const member = id => click('choose-member', { id });
  const create = (name = 'Audit trip', others = 'B', mode = 'organizer', dates = {}) =>
    submit('create-form', { name, location: 'Da Lat', yourname: 'A', others, mode, minimum: '5', startTime: start, endTime: end, ...dates });
  const approvals = (members = ['m0', 'm1']) => {
    for (const id of members) { member(id); click('approve-split'); }
    member('m0');
  };
  const approveBill = id => click('approve-bill', { id: String(id) });
  const bill = (amount, payer = 'm0', participant = ['m0', 'm1']) =>
    submit('bill-form', { label: 'Test bill', amount: String(amount), payer, participant });
  return {
    page, sheet, toast, storage, workspace, active, click, view, member, create, bill, approvals, approveBill, submit,
    billDraft: fields => {
      const room = sheet.innerHTML.match(/id="bill-form"[^>]+data-room="([^"]+)"/)?.[1];
      assert.ok(room);
      const status = { innerHTML: '' };
      draftForm = { fields, dataset: { room }, submit: {}, status, querySelector: () => status };
      events.input();
      return draftForm;
    },
    now: time => { now = Date.parse(time); },
    poll: async () => {
      const next = [...timers].find(([, task]) => task.delay === 2000);
      assert.ok(next, 'room polling scheduled');
      timers.delete(next[0]);
      await next[1].callback();
      await flush();
    },
    rate: value => { rate = value; },
    requests: () => requests,
    fund: (amount, kind = 'deposit') => submit('fund-form', { amount: String(amount), kind }),
    button: act => (page.innerHTML.match(/<button\b[^>]*>/g) || []).find(tag => tag.includes('data-act="' + act + '"')),
    prepare: async () => { view('split'); click('prepare-split'); await flush(); },
  };
}

const happy = await launch();
assert.match(happy.page.innerHTML, /No trips yet/);
assert.equal(happy.sheet.open, true);
assert.equal(happy.sheet.lang, 'vi');
assert.match(happy.sheet.innerHTML, /Cách dùng TripVault/);
const illustratedGuide = source.includes('const GUIDE_PICTURES');
if (illustratedGuide) {
  assert.match(happy.sheet.innerHTML, /Bỏ qua/);
  const upgradedVisit = await launch({ storage: new Map([['tripvault-rooms-guide-seen-v2', 'true']]) });
  assert.equal(upgradedVisit.sheet.open, true);
  assert.match(upgradedVisit.sheet.innerHTML, /hạn nạp/);
  const pictures = new Set();
  for (let step = 0; step < 5; step++) {
    if (step > 0) happy.click('guide-step', { id: String(step) });
    assert.match(happy.sheet.innerHTML, new RegExp('Bước ' + (step + 1) + ' / 5'));
    assert.doesNotMatch(happy.sheet.innerHTML, /Circle Faucet|Nhận USDC thử nghiệm vào ví/);
    const image = happy.sheet.innerHTML.match(/<img src="(data:image\/png;base64,[^"]+)" alt="([^"]+)"/);
    assert.ok(image);
    pictures.add(image[1]);
    if (step === 1 || step === 2) assert.doesNotMatch(happy.sheet.innerHTML, /MetaMask/);
    if (step === 2) {
      assert.match(happy.sheet.innerHTML, /Nạp vào quỹ trước hạn/);
      assert.match(happy.sheet.innerHTML, /Deposit USDC/);
      assert.doesNotMatch(happy.sheet.innerHTML, /Deposit test USDC/);
    }
  }
  assert.equal(pictures.size, 5);
  assert.match(happy.sheet.innerHTML, /Rejected/);
  assert.match(happy.sheet.innerHTML, /Đã hiểu/);
} else {
  assert.match(happy.sheet.innerHTML, /Prepare final split/);
}
happy.click('close-sheet');
assert.equal(happy.sheet.open, false);
const returnVisit = await launch({ storage: happy.storage });
assert.equal(returnVisit.sheet.open, false);
returnVisit.click('guide');
assert.equal(returnVisit.sheet.open, true);
assert.match(returnVisit.sheet.innerHTML, illustratedGuide ? /Bước 1 \/ 5/ : /Đã hiểu/);
console.log('PASS: Vietnamese first-visit guide opens once, dismisses, and reopens on demand');
assert.equal(happy.create('Trip A', 'B', 'everyone'), '');
happy.fund(5);
happy.member('m1');
happy.fund(5);
happy.bill(300000);
happy.bill(100000, 'm1', ['m1']);
assert.deepEqual(happy.active().depositUnits, { m0: 5_000_000, m1: 5_000_000 });
assert.equal(happy.active().bills.filter(bill => bill.status === 'pending').length, 2);
assert.equal(happy.fund(1, 'withdraw'), '');
happy.now(start);
assert.match(happy.fund(1, 'withdraw'), /unavailable/);
happy.fund(1);
happy.approveBill(1);
happy.approveBill(2);
assert.equal(happy.active().bills[0].status, 'pending');
happy.member('m0');
happy.approveBill(1);
happy.approveBill(2);
const requestBeforePreparation = happy.requests();
await happy.prepare();
assert.equal(happy.requests(), requestBeforePreparation + 1);
happy.approvals();
assert.match(happy.button('settle'), /disabled/);
happy.now(end);
happy.view('split');
assert.match(happy.page.innerHTML, /B<\/span><\/span><\/span><strong>1\.00 USDC/);
assert.match(happy.button('settle'), /disabled/);
happy.member('m1');
happy.fund(1);
happy.member('m0');
assert.doesNotMatch(happy.button('settle'), /disabled/);
happy.click('settle');
assert.deepEqual(happy.active().depositUnits, { m0: 11_000_000, m1: 0 });
happy.click('settle');
assert.deepEqual(happy.active().depositUnits, { m0: 11_000_000, m1: 0 });
happy.view('wallet');
assert.match(happy.button('deposit'), /disabled/);
assert.match(happy.fund(1), /unavailable/);
happy.click('claim');
happy.click('claim');
assert.deepEqual(happy.active().depositUnits, { m0: 0, m1: 0 });
console.log('PASS: original two-member flow, two pending bills, time lock, approvals, 1 USDC top-up, 11 USDC payout, claim and repeat guards');

const multi = await launch();
multi.create('Three travelers', 'B\nC');
for (const id of ['m0', 'm1', 'm2']) { multi.member(id); multi.fund(5); }
multi.member('m0');
multi.bill(100000, 'm0', ['m1']);
multi.bill(100000, 'm2', ['m1']);
multi.approveBill(1);
multi.approveBill(2);
await multi.prepare();
multi.approvals(['m0', 'm1', 'm2']);
multi.now(end);
multi.view('split');
assert.match(multi.button('settle'), /disabled/);
assert.match(multi.page.innerHTML, /B<\/span><\/span><\/span><strong>3\.00 USDC/);
multi.click('settle');
assert.deepEqual(multi.active().depositUnits, { m0: 5_000_000, m1: 5_000_000, m2: 5_000_000 });
assert.equal(multi.button('quick-top-up'), undefined);
multi.member('m1');
const getSelection = button => Object.fromEntries(
  [...button.matchAll(/data-(trip|member|revision|units)="([^"]*)"/g)].map(match => [match[1], match[2]]),
);
assert.match(multi.page.innerHTML, />Top up 3\.00 USDC<\/button>/);
const staleSelection = getSelection(multi.button('quick-top-up'));
assert.equal(staleSelection.units, '3000000');
multi.member('m0');
multi.click('quick-top-up', staleSelection);
assert.deepEqual(multi.active().depositUnits, { m0: 5_000_000, m1: 5_000_000, m2: 5_000_000 });
multi.member('m1');
multi.fund(1);
multi.click('quick-top-up', staleSelection);
assert.equal(multi.active().depositUnits.m1, 6_000_000);
assert.match(multi.page.innerHTML, />Top up 2\.00 USDC<\/button>/);
const exactSelection = getSelection(multi.button('quick-top-up'));
multi.click('quick-top-up', exactSelection);
assert.equal(multi.active().depositUnits.m1, 8_000_000);
assert.equal(multi.button('quick-top-up'), undefined);
multi.click('quick-top-up', exactSelection);
assert.equal(multi.active().depositUnits.m1, 8_000_000);
multi.member('m0');
multi.click('settle');
assert.deepEqual(multi.active().depositUnits, { m0: 9_000_000, m1: 0, m2: 9_000_000 });
console.log('PASS: quick top-up shows aggregate shortage, updates only the selected debtor, rejects stale amounts and repeat clicks, and allows settlement');

const quote = await launch();
quote.create();
quote.fund(5);
quote.member('m1');
quote.fund(6);
quote.member('m0');
quote.bill(300000);
quote.approveBill(1);
quote.click('approve-split');
assert.deepEqual(quote.active().splitApprovals, []);
assert.equal(quote.button('quick-top-up'), undefined);
await quote.prepare();
quote.approvals();
quote.rate(30000);
quote.click('refresh-fx');
await flush();
assert.equal(quote.active().reviewQuote.rate, 25000);
assert.match(quote.page.innerHTML, /6\.00 USDC/);
assert.equal(quote.active().splitApprovals.length, 2);
quote.click('reopen-split');
assert.deepEqual(quote.active().splitApprovals, []);
await quote.prepare();
assert.equal(quote.active().reviewQuote.rate, 30000);
assert.match(quote.page.innerHTML, /5\.00 USDC/);
assert.match(quote.button('settle'), /disabled/);
quote.approvals();
quote.bill(100, 'm0', ['m0']);
assert.equal(quote.active().reviewQuote, null);
assert.deepEqual(quote.active().splitApprovals, []);
console.log('PASS: changed market estimate leaves reviewed payout intact, reopening and recording new bills invalidate approvals');

const offline = await launch({ rate: null });
offline.create();
offline.bill(300000);
offline.approveBill(1);
await offline.prepare();
assert.equal(offline.active().reviewQuote, null);
assert.match(offline.page.innerHTML, /Market rate unavailable/);
assert.match(offline.page.innerHTML, /not live/);
offline.click('use-fallback');
assert.equal(offline.active().reviewQuote.live, false);
assert.match(offline.page.innerHTML, /Locked for approval .*not live/);
console.log('PASS: offline fallback requires an explicit selection and remains labeled through review');

const list = await launch();
list.create('First');
const first = list.active().id;
assert.equal(list.fund('8.03'), '');
list.bill(300000);
list.create('Second');
const second = list.active().id;
assert.notEqual(first, second);
list.click('trip-list');
assert.match(list.page.innerHTML, /First/);
assert.match(list.page.innerHTML, /Second/);
list.click('open-trip', { id: first });
assert.equal(list.active().depositUnits.m0, 8_030_000);
assert.equal(list.active().bills.length, 1);
const reopened = await launch({ storage: list.storage });
assert.equal(reopened.active().id, first);
const concurrent = await launch({ storage: list.storage });
list.create('Third');
concurrent.create('Fourth');
assert.equal(list.workspace().trips.length, 4);
list.click('trip-list');
assert.match(list.page.innerHTML, /Fourth/);
console.log('PASS: separate trips retain balances and bills after reload and creation from two tabs; 8.03 USDC accepted');

const precision = await launch();
precision.create();
precision.fund(5);
precision.member('m1');
precision.fund(5);
precision.member('m0');
precision.bill(100);
precision.approveBill(1);
await precision.prepare();
assert.match(precision.page.innerHTML, /0\.002 USDC/);
precision.approvals();
precision.now(end);
precision.click('settle');
assert.deepEqual(precision.active().depositUnits, { m0: 5_002_000, m1: 4_998_000 });
console.log('PASS: 50 VND debt at 25,000 VND/USD settles as 0.002 USDC without rounding down to zero');

const legacy = {
  name: 'Original v7 trip', location: 'Da Lat', owner: 'm0', members: [{ id: 'm0', name: 'A' }, { id: 'm1', name: 'B' }],
  minimum: 5, deposits: { m0: 5.5, m1: 6 }, approvalMode: 'organizer',
  startTime: start, endTime: end, rate: 25000, rateLocked: false,
  bills: [{ id: 1, label: 'Old bill', amount: 300000, payer: 'm0', participants: ['m0', 'm1'], approvals: ['m0'], status: 'approved' }],
  nextBillId: 2, splitApprovals: ['m0', 'm1'], revision: 3, reviewing: true, settled: false,
};
const oldRecord = JSON.stringify({ trip: legacy, actor: 'm1', view: 'split' });
const migrated = await launch({ storage: new Map([[v7Key, oldRecord]]) });
assert.equal(migrated.storage.get(v7Key), oldRecord);
assert.equal(migrated.active().name, legacy.name);
assert.deepEqual(migrated.active().depositUnits, { m0: 5_500_000, m1: 6_000_000 });
assert.deepEqual(migrated.active().bills[0].approvals, ['m0']);
assert.deepEqual(migrated.active().splitApprovals, []);
assert.equal(migrated.active().revision, 4);
assert.equal(migrated.workspace().actor, 'm1');
const settledOld = { ...legacy, settled: true, rateLocked: true, deposits: { m0: 11.5, m1: 0 } };
const history = await launch({ storage: new Map([[v7Key, JSON.stringify({ trip: settledOld, view: 'split' })]]) });
assert.equal(history.active().settled, true);
assert.match(history.page.innerHTML, /Historical rate/);
assert.deepEqual(history.active().depositUnits, { m0: 11_500_000, m1: 0 });
console.log('PASS: existing v7 data migrates when accessible, including settled history, while open split approvals reset');

const denied = await launch({ denyStorage: true });
denied.create('First in memory');
denied.create('Second in memory');
denied.click('trip-list');
assert.match(denied.page.innerHTML, /First in memory/);
assert.match(denied.page.innerHTML, /Second in memory/);
assert.match(denied.page.innerHTML, /Local storage is unavailable/);
console.log('PASS: browser storage failure shows a warning and preserves the current session');

const localized = await launch({ language: 'en-US' });
assert.equal(localized.sheet.lang, 'en');
assert.match(localized.sheet.innerHTML, /How to use TripVault/);
if (illustratedGuide) {
  localized.click('guide-step', { id: '1' });
  assert.match(localized.sheet.innerHTML, /Step 2 of 5/);
}
localized.click('guide-language', { id: 'vi' });
assert.equal(localized.sheet.lang, 'vi');
if (illustratedGuide) assert.match(localized.sheet.innerHTML, /Bước 2 \/ 5/);
localized.click('guide-language', { id: 'en' });
assert.equal(localized.sheet.lang, 'en');
const savedPreference = await launch({ language: 'vi-VN', storage: localized.storage });
assert.equal(savedPreference.sheet.open, false);
savedPreference.click('guide');
assert.equal(savedPreference.sheet.lang, 'en');
console.log('PASS: bilingual guide follows browser language and persists explicit choices');

const { testFuji } = await import('./test-tripvault-fuji.js');
await testFuji({ launch, end, flush, source });

if (source.includes('function enableRooms()')) {
  const { testRoomsUi } = await import('./tripvault-room-server/test-ui.js');
  await testRoomsUi({ launch, flush, start, end });
}

async function testJudgeDemo(url, script) {
  const judge = await launch({ url, rate: null, language: 'en' }, script);
  judge.click('close-sheet');
  assert.match(judge.page.innerHTML, /TripVault demo/);
  assert.equal(judge.requests(), 0);
  assert.equal(judge.button('fuji-connect'), undefined);
  judge.click('judge-demo-sample');
  judge.bill(100000);
  judge.approveBill(1);
  judge.member('m1');
  judge.approveBill(1);
  judge.member('m0');
  await judge.prepare();
  judge.approvals();
  judge.click('settle');
  const demo = JSON.parse(judge.storage.get('tripvault-judge-demo-v1'));
  assert.equal(demo.trips.length, 1);
  assert.equal(demo.trips[0].settled, true);
  assert.deepEqual(demo.trips[0].depositUnits, { m0: 7_000_000, m1: 3_000_000 });
  assert.equal(judge.storage.has(v8Key), false);
  assert.equal(judge.requests(), 0);
  judge.click('judge-demo-sample');
  const reset = JSON.parse(judge.storage.get('tripvault-judge-demo-v1'));
  assert.equal(reset.trips.length, 1);
  assert.equal(reset.trips[0].settled, false);
}

if (source.includes('function startJudgeSample()')) {
  await testJudgeDemo('http://127.0.0.1:8788/?demo=1', source);
  const staticDemo = readFileSync('docs/index.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  await testJudgeDemo('https://example.github.io/TripVault/', staticDemo);
  console.log('PASS: both the local and GitHub Pages demo settle with no wallet or network requests');
}
