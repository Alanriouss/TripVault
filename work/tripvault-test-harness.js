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
  const submit = (id, fields, error = { textContent: '' }) => {
    const form = {
      id: 'id' in fields ? { value: fields.id } : id,
      getAttribute: name => name === 'id' ? id : null,
      fields, querySelector: () => error,
    };
    events.submit({ preventDefault() {}, target: form });
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
    selectSiteLanguage: value => events.change({
      target: { value, matches: selector => selector === '[data-site-language]' },
    }),
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


export { launch, source, start, end, flush, output, v8Key, v7Key };
