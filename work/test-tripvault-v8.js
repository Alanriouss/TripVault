import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { launch, source, start, end, flush, output, v8Key, v7Key } from './tripvault-test-harness.js';

if (source.includes('const vietnameseUI =')) {
  const dictionary = source.slice(source.indexOf('  const vietnameseUI ='), source.indexOf('  function localizeUI('));
  const subtitle = runInNewContext("const siteLanguage = 'vi';" + dictionary
    + "ui('Create a trip or join one with your wallet.')");
  assert.equal(subtitle, 'Tạo chuyến đi hoặc dùng ví để tham gia chuyến đi có sẵn.');
  assert.match(readFileSync(output, 'utf8'), /dialog.guide-modal .sheet-body \{\s*display: block;\s*min-height: 0;/);
}

const happy = await launch();
assert.match(happy.page.innerHTML, /No trips yet/);
if (source.includes('data-split-trip')) {
  const savedSplit = await launch({ storage: new Map([[v8Key, JSON.stringify({
    trips: [], activeTripId: null, view: 'split',
  })]]) });
  assert.match(savedSplit.page.innerHTML, /No trips yet/);
}
assert.equal(happy.sheet.open, true);
assert.equal(happy.sheet.lang, 'vi');
assert.match(happy.sheet.innerHTML, /Cách dùng TripVault/);
const illustratedGuide = source.includes('const GUIDE_PICTURES');
if (illustratedGuide) {
  assert.match(happy.sheet.innerHTML, /Bỏ qua/);
  const upgradedVisit = await launch({ storage: new Map([['tripvault-rooms-guide-seen-v2', 'true']]) });
  assert.equal(upgradedVisit.sheet.open, true);
  assert.match(upgradedVisit.sheet.innerHTML, /hạn nạp/i);
  const totalSteps = happy.sheet.innerHTML.includes('/ 4') ? 4 : 5;
  const pictures = new Set();
  for (let step = 0; step < totalSteps; step++) {
    if (step > 0) happy.click('guide-step', { id: String(step) });
    assert.match(happy.sheet.innerHTML, new RegExp('Bước ' + (step + 1) + ' / ' + totalSteps));
    assert.doesNotMatch(happy.sheet.innerHTML, /Circle Faucet|Nhận USDC thử nghiệm vào ví/);
    const image = happy.sheet.innerHTML.match(/<img src="(data:image\/png;base64,[^"]+)" alt="([^"]+)"/);
    assert.ok(image);
    pictures.add(image[1]);
    if (step === 1 || step === 2) assert.doesNotMatch(happy.sheet.innerHTML, /MetaMask/);
    if (step === 2 && totalSteps === 5) {
      assert.match(happy.sheet.innerHTML, /Nạp vào quỹ trước hạn/);
      assert.match(happy.sheet.innerHTML, /Deposit USDC/);
      assert.doesNotMatch(happy.sheet.innerHTML, /Deposit test USDC/);
    }
  }
  assert.equal(pictures.size, totalSteps);
  if (totalSteps === 5) {
    assert.match(happy.sheet.innerHTML, /Rejected/);
    assert.match(happy.sheet.innerHTML, /Đã hiểu/);
  }
} else {
  assert.match(happy.sheet.innerHTML, /Prepare final split/);
}
happy.click('close-sheet');
assert.equal(happy.sheet.open, false);
const returnVisit = await launch({ storage: happy.storage });
assert.equal(returnVisit.sheet.open, false);
returnVisit.click('guide');
assert.equal(returnVisit.sheet.open, true);
assert.match(returnVisit.sheet.innerHTML, illustratedGuide ? /Bước 1 \/ [45]/ : /Đã hiểu/);
console.log('PASS: Vietnamese first-visit guide opens once, dismisses, and reopens on demand');
// Demo now enforces the same lifecycle as shared trips: bills open after
// funding/start, and final amounts are published after ending the trip.
if (source.includes('function demoWallet(')) {
  const { testDemoUi } = await import('./test-tripvault-demo-ui.js');
  await testDemoUi({ launch });
}

const list = await launch();
list.create('First');
const first = list.active().id;
assert.equal(list.fund('8.03'), '');
list.member('m1');
list.fund(6);
list.member('m0');
list.now(start);
list.bill(300000);
list.create('Second', 'B', 'organizer', {startTime:new Date(Date.parse(start)+3600000).toISOString(),endTime:new Date(Date.parse(end)+3600000).toISOString()});
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
list.create('Third', 'B', 'organizer', {startTime:new Date(Date.parse(start)+3600000).toISOString(),endTime:new Date(Date.parse(end)+3600000).toISOString()});
concurrent.create('Fourth');
assert.equal(list.workspace().trips.length, 4);
list.click('trip-list');
assert.match(list.page.innerHTML, /Fourth/);
console.log('PASS: separate trips retain balances and bills after reload and creation from two tabs; 8.03 USDC accepted');

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
  assert.match(localized.sheet.innerHTML, /Step 2 of [45]/);
}
localized.click('guide-language', { id: 'vi' });
assert.equal(localized.sheet.lang, 'vi');
if (illustratedGuide) assert.match(localized.sheet.innerHTML, /Bước 2 \/ [45]/);
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

async function testDemoNotifications() {
  const judge = await launch({ url: 'http://127.0.0.1:8788/?demo=1', language: 'en' });
  judge.click('judge-demo-sample');
  judge.click('room-end-confirm', { id: 'judges-sample' });
  assert.match(judge.page.innerHTML, /25,000 VND \/ USD/);
  assert.match(judge.page.innerHTML, /Fixed demo rate/);
  assert.doesNotMatch(judge.page.innerHTML, /2001/);
  assert.match(judge.page.innerHTML, /class="trip-bell-dot" aria-hidden="true">2/);
  judge.click('room-notifications');
  assert.match(judge.sheet.innerHTML, /Trip ended/);
  assert.match(judge.sheet.innerHTML, /Minimum deposits reached/);
  assert.match(judge.page.innerHTML, /class="trip-bell-dot" aria-hidden="true">2/);
  const noticeId = judge.sheet.innerHTML.match(/data-notification-id="([^"]+:ended)"/)[1];
  judge.click('mark-room-notification-read', { id: noticeId });
  assert.match(judge.page.innerHTML, /class="trip-bell-dot" aria-hidden="true">1/);
  judge.click('open-room-notification', { id: noticeId });
  assert.match(judge.page.innerHTML, /<h1>Final split<\/h1>/);
  assert.equal(judge.requests(), 0);
}

if (source.includes('function sampleNotifications(')) await testDemoNotifications();

async function testJudgeDemo(url, script) {
  const judge = await launch({ url, rate: null, language: 'en' }, script);
  judge.click('close-sheet');
  assert.match(judge.page.innerHTML, /Đà Lạt weekend/);
  assert.doesNotMatch(judge.page.innerHTML, /<h1>Your trips/);
  assert.equal(judge.requests(), 0);
  assert.equal(judge.button('fuji-connect'), undefined);
  judge.click('judge-demo-sample');
  judge.bill(100000);
  judge.approveBill(1);
  judge.member('m1');
  judge.approveBill(1);
  judge.member('m0');
  judge.click('room-end-confirm', { id: 'judges-sample' });
  await judge.prepare();
  judge.click('demo-review-plan');
  const review = JSON.parse(judge.storage.get('tripvault-judge-demo-v1')).trips[0];
  judge.click('demo-publish', { revision: String(review.revision) });
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

if (source.includes('function startJudgeSample(')) {
  await testJudgeDemo('http://127.0.0.1:8788/?demo=1', source);
  const staticDemo = readFileSync('docs/index.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  await testJudgeDemo('https://example.github.io/TripVault/', staticDemo);
  console.log('PASS: both the local and GitHub Pages demo settle with no wallet or network requests');
}
