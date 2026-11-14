import assert from 'node:assert/strict';
import { Database } from 'bun:sqlite';
import { Wallet, Interface, AbiCoder } from 'ethers';
import { readFileSync } from 'node:fs';
import { createRoomApi } from './entry.js';

const origin = 'http://127.0.0.1:8789';
const db = new Database(':memory:');
const compiled = JSON.parse(readFileSync(new URL('../fuji-contract/compiled.json', import.meta.url), 'utf8')).contracts;
const runtime = Object.entries(compiled).find(([name]) => name.endsWith(':TripVaultFuji'))[1]['bin-runtime'];
const iface = new Interface([
  'function snapshot() view returns (address[],uint256[],int256[],bool[],bytes32,uint256,uint256,uint256,bool)',
  'function propose(int256[])', 'function settle(bytes32)', 'function endTripEarly()', 'function refundDeadline() view returns (uint256)',
]);
const vault = '0x' + 'ab'.repeat(20);
const logs = new Map();
let callSnapshot;
let chainBlock;
let refundDeadline;
let vaultReads = 0;
const nonceReads = { latest: '0x6', pending: '0x5' };
async function rpc(method, params) {
  if (method === 'eth_getTransactionReceipt') return logs.get(params[0])?.receipt || null;
  if (method === 'eth_getTransactionByHash') return logs.get(params[0])?.transaction || null;
  if (method === 'eth_getCode') return '0x' + runtime;
  if (method === 'eth_getBlockByNumber') return chainBlock;
  if (method === 'eth_getTransactionCount') {
    assert.ok(params[1] in nonceReads);
    return nonceReads[params[1]];
  }
  if (method === 'eth_call') {
    if (params[0].data === iface.encodeFunctionData('refundDeadline')) {
      assert.equal(params[1], chainBlock.number);
      return AbiCoder.defaultAbiCoder().encode(['uint256'], [refundDeadline]);
    }
    if (params[1] !== 'latest') {
      assert.equal(params[1], chainBlock.number);
      vaultReads++;
    }
    return callSnapshot;
  }
  throw new Error(method);
}
let billingTime;
const api = createRoomApi({ database: db, origin, rpc, fetchFundingRate: async () => 25000,
  now: () => billingTime ?? Date.now() });

async function send(path, { body, token, status = 200, source = origin } = {}) {
  const response = await api(new Request(origin + '/api' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: source, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
}

const owner = Wallet.createRandom();
const guest = Wallet.createRandom();
const friend = Wallet.createRandom();
const stranger = Wallet.createRandom();

async function login(wallet) {
  const challenge = await send('/auth/challenge', { body: { address: wallet.address } });
  assert.equal(challenge.message.split('\n')[0], origin + ' wants you to sign in with your Ethereum account:');
  assert.ok(challenge.message.includes('\nURI: ' + origin + '\n'));
  const body = { nonce: challenge.nonce, signature: await wallet.signMessage(challenge.message) };
  const auth = await send('/auth/verify', { body });
  assert.equal(auth.address, wallet.address.toLowerCase());
  await send('/auth/verify', { body, status: 401 });
  return auth.token;
}

const [a, b, c, d] = await Promise.all([owner, guest, friend, stranger].map(login));
const challenge = await send('/auth/challenge', { body: { address: owner.address } });
await send('/auth/verify', { body: { nonce: challenge.nonce, signature: await stranger.signMessage(challenge.message) }, status: 401 });
await send('/auth/challenge', { body: { address: owner.address }, source: 'https://wrong.example', status: 403 });

const dates = { start: Date.now() + 3_600_000, end: Date.now() + 7_200_000 };
const settings = { name: 'Two-browser trip', location: 'Da Lat', displayName: 'A', minimumUnits: 5_000_000, approvalMode: 'everyone', ...dates };
async function createLegacyRoom(body, token) {
  const trip = await send('/rooms', { body: { ...body, deadline: dates.start - 60_000 }, token, status: 201 });
  db.query("UPDATE rooms SET snapshot = json_remove(snapshot, '$.depositDeadline') WHERE id = ?").run(trip.id);
  delete trip.depositDeadline;
  return trip;
}
await send('/rooms', { body: settings, token: a, status: 400 });
await send('/rooms', { body: { ...settings, deadline: dates.start }, token: a, status: 400 });
const newDeadline = dates.start - 60_000;
const scheduled = await send('/rooms', { body: { ...settings, deadline: newDeadline }, token: a, status: 201 });
assert.equal(Date.parse(scheduled.depositDeadline), newDeadline);
const scheduledPath = '/rooms/' + scheduled.id + '/actions';
const renamed = await send(scheduledPath, { token: a, body: { type: 'room.rename', version: scheduled.version, name: 'New trip name' } });
assert.equal(renamed.name, 'New trip name');
billingTime = newDeadline;
await send(scheduledPath, { token: a, body: { type: 'room.rename', version: renamed.version, name: 'Late name' }, status: 409 });
await send(scheduledPath, { token: a, body: { type: 'room.rename-member', version: renamed.version, name: 'Late name' }, status: 409 });
billingTime = undefined;
await send(scheduledPath, { token: a, body: { type: 'room.delete', version: renamed.version } });
const initial = await createLegacyRoom(settings, a);
assert.match(initial.code, /^\d{6}$/);
assert.match(initial.invite, /^[A-Za-z0-9_-]{32}$/);
assert.deepEqual(initial.members.map(member => member.name), ['A']);
const path = '/rooms/' + initial.id;
const directAction = (token, version, type, extra = {}, status = 200) =>
  send(path + '/actions', { token, body: { version, type, ...extra }, status });
await send(path, { token: d, status: 404 });

const [fromCode, fromLink] = await Promise.all([
  send('/rooms/join', { token: b, body: { key: initial.code, displayName: 'B' } }),
  send('/rooms/join', { token: c, body: { key: initial.invite, displayName: '' } }),
]);
assert.equal(fromCode.code, undefined);
assert.equal(fromLink.invite, undefined);
assert.ok(fromCode.members.some(member => member.address === guest.address.toLowerCase()));
assert.ok(fromLink.members.some(member => member.address === friend.address.toLowerCase()));
let room = await send(path, { token: a });
assert.equal(room.members.length, 3);
const duplicate = await send('/rooms/join', { token: b, body: { key: initial.invite, displayName: 'Renamed' } });
assert.equal(duplicate.members.length, 3);
assert.equal(duplicate.members.find(item => item.address === guest.address.toLowerCase()).name, 'B');

const bill = { label: 'Dinner', amount: 300000, payer: 'm0', participants: room.members.map(member => member.id) };
await directAction(b, initial.version, 'bill.add', bill, 409);
assert.match((await directAction(b, room.version, 'bill.add', bill, 409)).error, /link the Fuji vault/);
await directAction(b, room.version, 'room.freeze', {}, 403);
room = await directAction(a, room.version, 'room.freeze');
assert.equal(room.locked, true);
await send('/rooms/join', { token: d, body: { key: initial.code, displayName: 'Late guest' }, status: 404 });
assert.equal((await send('/rooms/join', { token: b, body: { key: initial.code, displayName: '' } })).members.length, 3);

function proof(hashByte, to, input, contractAddress, block) {
  const hash = '0x' + hashByte.repeat(32);
  logs.set(hash, {
    receipt: { status: '0x1', transactionHash: hash, contractAddress, blockNumber: '0x' + block.toString(16), transactionIndex: '0x0' },
    transaction: { from: owner.address, hash, to, input },
  });
  return hash;
}
callSnapshot = iface.encodeFunctionResult('snapshot', [
  room.members.map(member => member.address), [0, 0, 0], [], [false, false, false], '0x' + '00'.repeat(32),
  Math.floor(dates.start / 1000), Math.floor(dates.end / 1000), settings.minimumUnits, false,
]);
const deployment = proof('11', null, '0x', vault, 30);
await send(path + '/chain-proof', { token: b, body: { kind: 'deploy', hash: deployment }, status: 403 });
room = await send(path + '/chain-proof', { token: a, body: { kind: 'deploy', hash: deployment } });
assert.equal((await send(path, { token: b })).fuji.address, vault);
chainBlock = { number: '0x1e', timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16) };
const fundingSnapshot = balances => iface.encodeFunctionResult('snapshot', [
  room.members.map(member => member.address), balances, [], [false, false, false], '0x' + '00'.repeat(32),
  Math.floor(dates.start / 1000), Math.floor(dates.end / 1000), settings.minimumUnits, false,
]);
await send(path + '/funding', { token: d, status: 404 });
const emptyFunding = await send(path + '/funding', { token: b });
assert.deepEqual(emptyFunding.balances, [0, 0, 0]);
assert.match((await directAction(b, room.version, 'bill.add', { ...bill, balances: [50e6, 50e6, 50e6] }, 409)).error, /5\.000000 USDC/);
callSnapshot = fundingSnapshot([5_000_000, 5_000_000, 5_000_000]);
room = await directAction(b, room.version, 'bill.add', bill);
assert.equal(room.bills.length, 1);
assert.match((await directAction(c, room.version, 'bill.add', bill, 409)).error, /3\.000000 USDC/);
assert.equal((await send(path, { token: c })).bills.length, 1);
const reminderBody = { ...bill, version: room.version, units: 1, recipients: [d] };
await send(path + '/top-up-reminder', { token: d, body: reminderBody, status: 404 });
assert.deepEqual(await send(path + '/top-up-reminder', { token: a, body: reminderBody }), { sent: 2 });
assert.deepEqual(await send(path + '/top-up-reminder', { token: a, body: reminderBody }), { sent: 2 });
assert.deepEqual((await send('/rooms', { token: a })).reminders, []);
assert.deepEqual((await send('/rooms', { token: d })).reminders, []);
for (const token of [b, c]) {
  const { reminders } = await send('/rooms', { token });
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].draft.label, 'Dinner');
  assert.equal(reminders[0].sender, 'A');
  assert.equal(reminders[0].units, 3_000_000);
}
callSnapshot = fundingSnapshot([5_000_000, 8_000_000, 7_999_999]);
assert.match((await directAction(a, room.version, 'bill.add', bill, 409)).error, /0\.000001 USDC/);
callSnapshot = fundingSnapshot([5_000_000, 8_000_000, 8_000_000]);
room = await directAction(a, room.version, 'bill.add', bill);
assert.equal(room.bills.length, 2);
assert.deepEqual((await send('/rooms', { token: b })).reminders, []);
assert.deepEqual((await send('/rooms', { token: c })).reminders, []);
for (const id of [1, 2]) {
  for (const token of [a, b, c]) room = await directAction(token, room.version, 'bill.approve', { id, approve: true });
}
assert.ok(room.bills.every(bill => bill.status === 'approved'));
const daily = 24 * 60 * 60 * 1000;
billingTime = dates.end - 60_000;
const smallBill = { label: 'Taxi', amount: 25000, payer: 'm0', participants: ['m1'] };
callSnapshot = fundingSnapshot([20_000_000, 20_000_000, 20_000_000]);
room = await directAction(a, room.version, 'bill.add', smallBill);
const taxi = room.bills.at(-1);
assert.equal(taxi.reviewBy, billingTime + daily);
await directAction(c, room.version, 'bill.approve', { id: taxi.id, approve: true }, 403);
room = await directAction(b, room.version, 'bill.feedback', { id: taxi.id, comment: 'Use the actual fare' });
assert.equal(room.bills.at(-1).status, 'disputed');
billingTime += daily;
room = await send(path, { token: b });
assert.equal(room.bills.at(-1).status, 'disputed');
await directAction(b, room.version, 'bill.edit', { ...smallBill, id: taxi.id, amount: 20000 }, 403);
room = await directAction(a, room.version, 'bill.edit', { ...smallBill, id: taxi.id, amount: 20000 });
assert.equal(room.bills.at(-1).history[0].feedback[0].comment, 'Use the actual fare');
assert.equal(room.bills.at(-1).reviewBy, billingTime + daily);
billingTime += daily - 1;
room = await send(path, { token: b });
assert.equal(room.bills.at(-1).status, 'pending');
billingTime++;
room = await send(path, { token: b });
assert.equal(room.bills.at(-1).status, 'approved');
assert.deepEqual(room.bills.at(-1).autoApprovals, ['m1']);
room = await directAction(b, room.version, 'bill.cancel', { id: taxi.id, agree: true });
assert.equal(room.bills.at(-1).status, 'cancellation');
await directAction(c, room.version, 'bill.cancel', { id: taxi.id, agree: true }, 403);
room = await directAction(a, room.version, 'bill.cancel', { id: taxi.id, agree: true });
assert.equal(room.bills.at(-1).status, 'rejected');
assert.equal(room.bills.at(-1).amount, 20000);
await directAction(b, room.version, 'split.lock', { quote: { rate: 25000, source: 'Demo', updated: 'Now', live: false } }, 403);
room = await directAction(a, room.version, 'split.lock', { quote: { rate: 25000, source: 'Demo', updated: 'Now', live: false } });
assert.equal(room.reviewQuote.rate, 25000);
billingTime = undefined;
vaultReads = 0;
console.log('PASS: bills require every member’s minimum and confirmed coverage of pending bills plus the new bill');
const publish = proof('22', vault, iface.encodeFunctionData('propose', [[8_000_000, -4_000_000, -4_000_000]]), null, 32);
room = await send(path + '/chain-proof', { token: a, body: { kind: 'fuji-publish', hash: publish, revision: room.revision } });
assert.equal(room.fuji.publishedRevision, String(room.revision));
const stale = proof('33', vault, iface.encodeFunctionData('propose', [[0, 0, 0]]), null, 31);
await send(path + '/chain-proof', { token: a, body: { kind: 'fuji-publish', hash: stale, revision: 1 } });
assert.equal((await send(path, { token: a })).fuji.publishedRevision, String(room.revision));
const settlement = proof('44', vault, iface.encodeFunctionData('settle', ['0x' + '88'.repeat(32)]), null, 33);
room = await send(path + '/chain-proof', { token: a, body: { kind: 'fuji-settle', hash: settlement } });
assert.equal(room.settled, true);
assert.equal(room.fuji.settlementTx, settlement);
await directAction(b, room.version, 'bill.add', bill, 409);
assert.equal((await send('/rooms', { token: b })).rooms[0].id, room.id);
console.log('PASS: signed wallets create and join by code/link, deduplicated and synchronized members, concurrent joins, role permissions, shared bills, roster lock, Fuji proof and readback');

chainBlock = { number: '0x22', timestamp: '0x' + Math.floor(dates.end / 1000).toString(16) };
refundDeadline = Math.floor(dates.end / 1000) + 7 * 86_400;
await directAction(b, room.version, 'room.delete', {}, 403);
assert.equal(vaultReads, 0);
await directAction(a, room.version - 1, 'room.delete', {}, 409);
assert.equal(vaultReads, 0);
await directAction(a, room.version, 'room.delete', {}, 409); // Still open on chain, despite the room's receipt.
const roster = room.members.map(member => member.address);
const snapshot = (balances, settled) => iface.encodeFunctionResult('snapshot', [
  roster, balances, [0, 0, 0], [true, true, true], '0x' + '88'.repeat(32),
  Math.floor(dates.start / 1000), Math.floor(dates.end / 1000), settings.minimumUnits, settled,
]);
callSnapshot = snapshot([11_000_000, 0, 0], true);
await directAction(a, room.version, 'room.delete', {}, 409);
callSnapshot = snapshot([0, 0, 0], true);
assert.deepEqual(await directAction(a, room.version, 'room.delete'), { id: room.id, deleted: true });
assert.equal(vaultReads, 3);
await send(path, { token: b, status: 404 });
await send('/rooms/join', { token: d, body: { key: initial.invite, displayName: '' }, status: 404 });
await send('/rooms/join', { token: d, body: { key: initial.code, displayName: '' }, status: 404 });
assert.equal((await send('/rooms', { token: b })).rooms.length, 0);
assert.equal(db.query('SELECT count(*) AS amount FROM room_members WHERE room_id = ?').get(room.id).amount, 0);

const emptyRoom = await createLegacyRoom({ ...settings, name: 'Delete empty trip' }, a);
const emptyPath = '/rooms/' + emptyRoom.id;
await send(emptyPath + '/actions', { token: a, body: { type: 'room.delete', version: emptyRoom.version } });
await send(emptyPath, { token: a, status: 404 });
assert.equal(vaultReads, 3);

const expiredRoom = await createLegacyRoom({ ...settings, name: 'Expired vault' }, a);
const expiredPath = '/rooms/' + expiredRoom.id;
let expired = await send(expiredPath + '/actions', { token: a, body: { type: 'room.freeze', version: expiredRoom.version } });
callSnapshot = iface.encodeFunctionResult('snapshot', [
  expired.members.map(member => member.address), [0], [], [false], '0x' + '00'.repeat(32),
  Math.floor(dates.start / 1000), Math.floor(dates.end / 1000), settings.minimumUnits, false,
]);
expired = await send(expiredPath + '/chain-proof', { token: a, body: { kind: 'deploy', hash: deployment } });
chainBlock.timestamp = '0x' + (Math.floor(dates.end / 1000) + 7 * 86_400).toString(16);
await send(expiredPath + '/actions', { token: a, body: { type: 'room.delete', version: expired.version } });
await send(expiredPath, { token: a, status: 404 });
console.log('PASS: only owners delete; stale versions rejected; invites and membership removed; open or funded vaults blocked; closed or expired empty vaults allowed');

const publicOrigin = 'https://tripvault.example';
const publicApi = createRoomApi({ database: new Database(':memory:'), origin: publicOrigin });
const publicResponse = await publicApi(new Request(publicOrigin + '/api/auth/challenge', {
  method: 'POST', headers: { Origin: publicOrigin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: owner.address }),
}));
assert.equal(publicResponse.status, 200);
const publicChallenge = await publicResponse.json();
assert.equal(publicChallenge.message.split('\n')[0], publicOrigin + ' wants you to sign in with your Ethereum account:');
assert.ok(publicChallenge.message.includes('\nURI: ' + publicOrigin + '\n'));
console.log('PASS: wallet sign-in messages declare the exact HTTP or HTTPS origin of the app');

const early = await createLegacyRoom({ ...settings, name: 'End early' }, a);
const earlyPath = '/rooms/' + early.id;
const earlyGuest = await send('/rooms/join', { token: b, body: { key: early.code, displayName: 'B' } });
await send(earlyPath + '/actions', { token: b, body: { type: 'room.end', version: earlyGuest.version }, status: 403 });
const endedRoom = await send(earlyPath + '/actions', { token: a, body: { type: 'room.end', version: earlyGuest.version } });
assert.ok(endedRoom.locked && Date.parse(endedRoom.endedAt) < dates.end);
await send('/rooms/join', { token: d, body: { key: early.invite, displayName: '' }, status: 404 });
assert.equal((await send(earlyPath, { token: b })).endedAt, endedRoom.endedAt);

const liveRoom = await createLegacyRoom({ ...settings, name: 'End on Fuji' }, a);
const livePath = '/rooms/' + liveRoom.id;
let linked = await send(livePath + '/actions', { token: a, body: { type: 'room.freeze', version: liveRoom.version } });
callSnapshot = iface.encodeFunctionResult('snapshot', [
  linked.members.map(member => member.address), [0], [], [false], '0x' + '00'.repeat(32),
  Math.floor(dates.start / 1000), Math.floor(dates.end / 1000), settings.minimumUnits, false,
]);
linked = await send(livePath + '/chain-proof', { token: a, body: { kind: 'deploy', hash: deployment } });
assert.equal(linked.fuji.contractVersion, 2);
db.query('UPDATE rooms SET snapshot = json_set(snapshot, \'$.bills\', json(?)) WHERE id = ?').run(JSON.stringify([
  { ...bill, id: 1, participants: ['m0'], status: 'approved', approvals: ['m0'] },
  { ...bill, id: 2, participants: ['m0'], status: 'pending', approvals: [] },
]), linked.id);
await send(livePath + '/actions', { token: a, body: { type: 'room.end', version: linked.version }, status: 409 });
const endHash = proof('55', vault, iface.encodeFunctionData('endTripEarly'), null, 34);
const endedSeconds = Math.floor(Date.now() / 1000);
callSnapshot = iface.encodeFunctionResult('snapshot', [
  linked.members.map(member => member.address), [0], [], [false], '0x' + '00'.repeat(32),
  Math.floor(dates.start / 1000), endedSeconds, settings.minimumUnits, false,
]);
linked = await send(livePath + '/chain-proof', { token: a, body: { kind: 'fuji-end', hash: endHash } });
assert.equal(Date.parse(linked.endedAt), endedSeconds * 1000);
assert.deepEqual(linked.bills.map(item => item.id), [1, 2]);
assert.equal(linked.bills[1].status, 'pending');
assert.deepEqual(JSON.parse(db.query('SELECT snapshot FROM rooms WHERE id = ?').get(linked.id).snapshot).bills.map(item => item.id), [1, 2]);
await send(livePath + '/actions', { token: a, body: { ...bill, type: 'bill.add', version: linked.version }, status: 409 });
await send(livePath + '/actions', { token: a, body: { id: 1, approve: false, type: 'bill.approve', version: linked.version }, status: 409 });
console.log('PASS: organizer-only early ending, invite closure, verified on-chain end proof, and settlement receipt sharing');

assert.deepEqual(await send('/wallet/fuji-nonce', { token: a }), { nonce: '0x6' });
nonceReads.pending = '0x7';
assert.deepEqual(await send('/wallet/fuji-nonce', { token: a }), { nonce: '0x7' });
nonceReads.pending = null;
assert.deepEqual(await send('/wallet/fuji-nonce', { token: a }), { nonce: '0x6' });
nonceReads.latest = 'invalid';
await send('/wallet/fuji-nonce', { token: a, status: 503 });
await send('/wallet/fuji-nonce', { status: 401 });
const bulk = (trips, token, status = 200) => send('/rooms/bulk-delete', { body: { trips }, token, status });
const selection = trip => ({ id: trip.id, version: trip.version });
const bulkA = await createLegacyRoom({ ...settings, name: 'Bulk A' }, a);
const bulkB = await createLegacyRoom({ ...settings, name: 'Bulk B' }, a);
await bulk([selection(bulkA), selection(bulkA)], a, 400);
await bulk([selection(bulkA), { ...selection(bulkB), version: bulkB.version + 1 }], a, 409);
assert.equal((await send('/rooms/' + bulkA.id, { token: a })).name, 'Bulk A');
const memberOwned = await createLegacyRoom({ ...settings, name: 'Member-owned' }, b);
await bulk([selection(memberOwned), selection(endedRoom)], b, 403);
assert.equal((await send('/rooms/' + memberOwned.id, { token: b })).name, 'Member-owned');
chainBlock = { number: '0x22', timestamp: '0x' + endedSeconds.toString(16) };
refundDeadline = endedSeconds + 7 * 86400;
const blocked = await bulk([selection(bulkA), selection(linked)], a, 409);
assert.match(blocked.error, /End on Fuji/);
assert.equal((await send('/rooms/' + bulkA.id, { token: a })).name, 'Bulk A');
assert.deepEqual(await bulk([selection(bulkA), selection(bulkB)], a), { deleted: [bulkA.id, bulkB.id] });
await send('/rooms/' + bulkA.id, { token: a, status: 404 });
await send('/rooms/' + bulkB.id, { token: a, status: 404 });
console.log('PASS: authenticated nonce fallback and all-or-none bulk deletion for eligible organizer trips');
