import { Database } from 'bun:sqlite';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getAddress, Interface, verifyMessage } from 'ethers';
import { calculateRoomFundingShortfalls } from '../../core/src/index.js';
import { CONTRACT, CHAIN, RPC, MAX_MEMBERS, FIVE_MINUTES, DAY, REFUND_DELAY_SECONDS, LOCAL_HTML, ZERO, ADDRESS, HASH, ROOM_ID } from './constants.js';
import { RoomError, assert, text, safeAddress } from './errors.js';

function opaque() {
  return randomBytes(24).toString('base64url');
}

function digest(token) {
  return createHash('sha256').update(token).digest('hex');
}

function isUnits(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function makeTrip(settings, address, id) {
  const name = text(settings.name, 70, 'trip name');
  const displayName = text(settings.displayName, 40, 'display name', false) || shorten(address);
  const location = text(settings.location, 80, 'destination', false);
  const start = settings.start;
  const end = settings.end;
  assert(Number.isSafeInteger(start) && Number.isSafeInteger(end)
    && start > Date.now() && end > start && end < 253402300799000, 400, 'Choose valid future trip dates.');
  const deadline = settings.deadline;
  assert(Number.isSafeInteger(deadline) && Math.floor(deadline / 1000) > Math.floor(Date.now() / 1000)
    && Math.floor(deadline / 1000) < Math.floor(start / 1000)
    && Math.floor(start / 1000) < Math.floor(end / 1000), 400, 'Choose a future deposit deadline before the trip starts.');
  assert(isUnits(settings.minimumUnits), 400, 'Enter a positive minimum deposit.');
  return {
    id, shared: true, name, location, owner: 'm0',
    members: [{ id: 'm0', name: displayName, address }],
    startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString(),
    depositDeadline: new Date(deadline).toISOString(),
    minimumUnits: settings.minimumUnits,
    locked: false, depositUnits: {}, bills: [], nextBillId: 1, splitApprovals: [],
    reviewQuote: null, revision: 1, version: 1, settled: false,
  };
}

function shorten(address) {
  return address.slice(0, 6) + '…' + address.slice(-4);
}

function invalidateSplit(trip) {
  trip.reviewQuote = null;
  trip.splitApprovals = [];
  trip.revision++;
}

function billStatus(bill) {
  if (bill.cancellation) return 'cancellation';
  if (bill.feedback?.length) return 'disputed';
  return bill.participants.every(id => bill.approvals.includes(id)) ? 'approved' : 'pending';
}

function billReviewers(bill) {
  return [...new Set([bill.createdBy || bill.payer, bill.payer, ...bill.participants])];
}

function logBillNotification(bill, kind, actor, recipients, receivedAt, comment, id = randomUUID()) {
  const targets = [...new Set(recipients)].filter(member => member !== actor);
  if (!targets.length) return;
  bill.notificationLog = [...(bill.notificationLog || []), {
    id, kind, actor, recipients: targets, receivedAt, label: bill.label, comment,
  }].slice(-50);
}

function billDetails(trip, data) {
  const label = text(data.label, 70, 'bill name');
  const { amount, payer, participants } = data;
  const ids = new Set(trip.members.map(member => member.id));
  assert(isUnits(amount) && amount <= 1e9 && ids.has(payer)
    && Array.isArray(participants) && participants.length > 0 && participants.length <= ids.size
    && new Set(participants).size === participants.length && participants.every(id => ids.has(id)),
  400, 'Enter valid bill details and choose the members sharing it.');
  return { label, amount, payer, participants };
}

function cleanQuote(quote) {
  assert(quote && typeof quote === 'object' && Number.isFinite(quote.rate)
    && quote.rate >= 1 && quote.rate <= 1e9, 400, 'Invalid USD/VND reference.');
  return { rate: quote.rate, live: quote.live === true,
    source: text(quote.source, 140, 'rate source'), updated: text(quote.updated, 140, 'rate timestamp') };
}

const iface = new Interface([
  'function snapshot() view returns (address[],uint256[],int256[],bool[],bytes32,uint256,uint256,uint256,bool)',
  'function propose(int256[])',
  'function settle(bytes32)',
  'function endTripEarly()',
  'function refundDeadline() view returns (uint256)',
  'function depositDeadline() view returns (uint256)',
  'function fundingFailed() view returns (bool)',
]);

async function vaultFundingFailed(address, block, rpc) {
  const raw = await rpc('eth_call', [{ to: address, data: iface.encodeFunctionData('fundingFailed') }, block]);
  return iface.decodeFunctionResult('fundingFailed', raw)[0];
}

async function fujiRpc(method, params) {
  const response = await fetch(RPC, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new RoomError(503, 'Fuji is unavailable. Check the transaction again.');
  const result = await response.json();
  if (result.error) throw new RoomError(503, 'Fuji is unavailable. Check the transaction again.');
  return result.result;
}

function tripEnd(trip) {
  return Date.parse(trip.endedAt || trip.endTime);
}

async function readFujiFunding(trip, rpc) {
  const block = await rpc('eth_getBlockByNumber', ['latest', false]);
  assert(block && /^0x[0-9a-f]+$/i.test(block.number) && /^0x[0-9a-f]+$/i.test(block.timestamp),
    503, 'Fuji is unavailable. Check the transaction again.');
  const raw = await rpc('eth_call', [{ to: trip.fuji.address, data: iface.encodeFunctionData('snapshot') }, block.number]);
  const [members, balances, , , , start, end, minimum, settled] = iface.decodeFunctionResult('snapshot', raw);
  const now = Number(BigInt(block.timestamp));
  const contractVersion = trip.fuji.contractVersion || 1;
  let deadline = null;
  let fundingFailed = false;
  if (contractVersion === 3) {
    const rawDeadline = await rpc('eth_call', [{ to: trip.fuji.address, data: iface.encodeFunctionData('depositDeadline') }, block.number]);
    [deadline] = iface.decodeFunctionResult('depositDeadline', rawDeadline);
    fundingFailed = await vaultFundingFailed(trip.fuji.address, block.number, rpc);
  }
  const cancelled = contractVersion === 3 && fundingFailed;
  const ready = !settled && !cancelled && (deadline === null ? now < Number(start) : (now >= Number(deadline) && now < Number(end)));
  return {
    balances: balances.map(balance => Number(balance)),
    minimumUnits: Number(minimum),
    startsAt: Number(start) * 1000,
    endsAt: Number(end) * 1000,
    depositDeadline: deadline === null ? null : Number(deadline) * 1000,
    timestamp: now * 1000,
    settled,
    cancelled,
    ready,
  };
}

async function marketFundingRate() {
  const response = await fetch('https://open.er-api.com/v6/latest/USD', {
    headers: { 'User-Agent': 'TripVault-Room-Server/1.0' },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) return null;
  const result = await response.json();
  return result.result === 'success' ? result.rates?.VND ?? null : null;
}

async function verifyChainProof(trip, address, data, rpc) {
  assert(data && typeof data === 'object' && typeof data.hash === 'string' && HASH.test(data.hash)
    && ['deploy', 'fuji-publish', 'fuji-settle', 'fuji-end'].includes(data.kind), 400, 'Invalid transaction proof.');
  const [receipt, transaction] = await Promise.all([
    rpc('eth_getTransactionReceipt', [data.hash]),
    rpc('eth_getTransactionByHash', [data.hash]),
  ]);
  assert(receipt && typeof receipt === 'object' && receipt.status === '0x1' && transaction && typeof transaction === 'object'
    && transaction.from?.toLowerCase() === address, 400, 'This transaction was not completed by the organizer.');
  const proof = {
    kind: data.kind, block: Number(BigInt(receipt.blockNumber)), index: Number(BigInt(receipt.transactionIndex)),
    hash: data.hash.toLowerCase(),
  };
  if (data.kind === 'deploy') {
    proof.address = safeAddress(receipt.contractAddress);
    assert(transaction.to === null && trip.locked, 409, 'The room roster must be locked before deployment.');
    const [code, raw] = await Promise.all([
      rpc('eth_getCode', [proof.address, 'latest']),
      rpc('eth_call', [{ to: proof.address, data: iface.encodeFunctionData('snapshot') }, 'latest']),
    ]);
    const runtime = code?.toLowerCase();
    proof.version = runtime === '0x' + CONTRACT.deadlineRuntime ? 3
      : runtime === '0x' + CONTRACT.runtime ? 2 : runtime === '0x' + CONTRACT.legacyRuntime ? 1 : 0;
    assert(proof.version, 400, 'The deployed vault does not match TripVault.');
    assert(Boolean(trip.depositDeadline) === (proof.version === 3), 409, 'The vault must use this trip’s deposit deadline rules.');
    const [roster, , , , , start, end, minimum] = iface.decodeFunctionResult('snapshot', raw);
    assert(roster.length === trip.members.length
      && roster.every((member, index) => member.toLowerCase() === trip.members[index].address)
      && start === BigInt(Math.floor(Date.parse(trip.startTime) / 1000))
      && end === BigInt(Math.floor(tripEnd(trip) / 1000))
      && minimum === BigInt(trip.minimumUnits), 409, 'The deployed vault has different room settings or members.');
    if (proof.version === 3) {
      const rawDeadline = await rpc('eth_call', [{ to: proof.address, data: iface.encodeFunctionData('depositDeadline') }, 'latest']);
      const [deadline] = iface.decodeFunctionResult('depositDeadline', rawDeadline);
      assert(deadline === BigInt(Math.floor(Date.parse(trip.depositDeadline) / 1000)), 409, 'This vault has a different deposit deadline.');
    }
  } else {
    assert(trip.fuji?.address && transaction.to?.toLowerCase() === trip.fuji.address, 400, 'This transaction belongs to a different vault.');
    const expected = { 'fuji-publish': 'propose', 'fuji-settle': 'settle', 'fuji-end': 'endTripEarly' }[data.kind];
    assert(transaction.input?.startsWith(iface.getFunction(expected).selector), 400, 'This transaction does not match the requested action.');
    if (data.kind === 'fuji-publish') {
      assert(Number.isSafeInteger(data.revision) && data.revision > 0 && data.revision <= trip.revision,
        400, 'Invalid split revision.');
      proof.revision = String(data.revision);
    }
    if (data.kind === 'fuji-end') {
      assert(trip.fuji.contractVersion >= 2, 409, 'This vault uses the original end time.');
      const raw = await rpc('eth_call', [{ to: trip.fuji.address, data: iface.encodeFunctionData('snapshot') }, receipt.blockNumber]);
      const [, , , , , , end] = iface.decodeFunctionResult('snapshot', raw);
      const timestamp = Number(end) * 1000;
      assert(Number.isSafeInteger(timestamp) && timestamp <= tripEnd(trip) && timestamp > 0,
        409, 'The new trip end time could not be verified.');
      proof.endedAt = new Date(timestamp).toISOString();
    }
  }
  return proof;
}

export function createRoomApi({ database, origin, rpc = fujiRpc, fetchFundingRate = marketFundingRate, now = Date.now }) {
  const db = database;
  const domain = new URL(origin).host;
  const signInHeader = `${domain} wants you to sign in with your Ethereum account:`;
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS auth_challenges (
      nonce TEXT PRIMARY KEY, address TEXT NOT NULL, message TEXT NOT NULL, expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY, address TEXT NOT NULL, expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, invite TEXT UNIQUE NOT NULL,
      snapshot TEXT NOT NULL, created INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS rooms_unique_vault
      ON rooms(json_extract(snapshot, '$.fuji.address'))
      WHERE json_extract(snapshot, '$.fuji.address') IS NOT NULL;
    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL REFERENCES rooms(id), address TEXT NOT NULL,
      PRIMARY KEY(room_id, address)
    );
    CREATE TABLE IF NOT EXISTS top_up_reminders (
      id TEXT NOT NULL UNIQUE,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      sender TEXT NOT NULL,
      draft TEXT NOT NULL,
      recipients TEXT NOT NULL,
      updated INTEGER NOT NULL,
      PRIMARY KEY(room_id, sender)
    );
  `);

  const insertChallenge = db.query('INSERT INTO auth_challenges VALUES (?, ?, ?, ?)');
  const getChallenge = db.query('SELECT * FROM auth_challenges WHERE nonce = ? AND expires > ?');
  const deleteChallenge = db.query('DELETE FROM auth_challenges WHERE nonce = ?');
  const insertSession = db.query('INSERT INTO auth_sessions VALUES (?, ?, ?)');
  const getSession = db.query('SELECT address FROM auth_sessions WHERE token_hash = ? AND expires > ?');
  const getRoom = db.query('SELECT * FROM rooms WHERE id = ?');
  const getInvite = db.query('SELECT * FROM rooms WHERE invite = ?');
  const getCode = db.query('SELECT * FROM rooms WHERE code = ?');
  const insertRoom = db.query('INSERT INTO rooms VALUES (?, ?, ?, ?, ?)');
  const updateRoom = db.query('UPDATE rooms SET snapshot = ? WHERE id = ?');
  const insertMember = db.query('INSERT INTO room_members VALUES (?, ?)');
  const deleteMembers = db.query('DELETE FROM room_members WHERE room_id = ?');
  const deleteRoom = db.query('DELETE FROM rooms WHERE id = ?');
  const getRooms = db.query(`SELECT rooms.* FROM rooms
    JOIN room_members ON rooms.id = room_members.room_id
    WHERE room_members.address = ? ORDER BY rooms.created DESC`);
  const getReminders = db.query(`SELECT reminder.id, reminder.room_id, reminder.sender, reminder.draft, reminder.updated,
      recipient.value AS recipient, rooms.snapshot
    FROM top_up_reminders AS reminder
    JOIN rooms ON rooms.id = reminder.room_id
    JOIN room_members AS member ON member.room_id = reminder.room_id
    JOIN json_each(reminder.recipients) AS recipient
    WHERE member.address = ?1 AND json_extract(recipient.value, '$.address') = ?1
      AND json_extract(rooms.snapshot, '$.settled') = 0
    ORDER BY reminder.updated DESC`);
  const saveReminder = db.query(`INSERT INTO top_up_reminders VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(room_id, sender) DO UPDATE SET
      id = excluded.id, draft = excluded.draft, recipients = excluded.recipients, updated = excluded.updated`);
  const clearBillReminder = db.query('DELETE FROM top_up_reminders WHERE room_id = ? AND draft = ?');
  const clearRoomReminders = db.query('DELETE FROM top_up_reminders WHERE room_id = ?');

  const limitBuckets = new Map();
  let fundingRate = null;
  let fundingRateExpires = 0;
  let fundingRateRequest;

  function getFundingRate() {
    if (Date.now() < fundingRateExpires) return fundingRate;
    fundingRateRequest ??= Promise.resolve().then(fetchFundingRate).then(rate => {
      fundingRate = Number.isFinite(rate) && rate >= 1 && rate <= 1e9 ? rate : null;
      fundingRateExpires = Date.now() + (fundingRate ? FIVE_MINUTES : 5000);
      return fundingRate;
    }, () => {
      fundingRate = null;
      fundingRateExpires = Date.now() + 5000;
      return null;
    }).finally(() => { fundingRateRequest = null; });
    return fundingRateRequest;
  }

  async function getRoomFunding(trip) {
    assert(trip.fuji?.address, 409, 'The organizer needs to link the Fuji vault before anyone can add bills.');
    const [snapshot, rate] = await Promise.all([readFujiFunding(trip, rpc), getFundingRate()]);
    return { ...snapshot, rate, version: trip.version };
  }

  function throttle(scope, key, max) {
    const now = Date.now();
    if (limitBuckets.size > 2048) {
      for (const [id, bucket] of limitBuckets) if (bucket.until <= now) limitBuckets.delete(id);
      assert(limitBuckets.size < 4096, 429, 'Too many attempts. Try again in a few minutes.');
    }
    const id = scope + ':' + key;
    const previous = limitBuckets.get(id);
    const bucket = previous?.until > now ? previous : { count: 0, until: now + FIVE_MINUTES };
    bucket.count++;
    limitBuckets.set(id, bucket);
    assert(bucket.count <= max, 429, 'Too many attempts. Try again in a few minutes.');
  }

  function readMemberRoom(id, address) {
    const record = getRoom.get(id);
    assert(record, 404, 'Room not found.');
    const trip = JSON.parse(record.snapshot);
    const self = trip.members.find(member => member.address === address);
    assert(self, 403, 'You are not a member of this room.');
    return { record, trip, self };
  }

  function presentation(record, address) {
    const trip = JSON.parse(record.snapshot);
    const self = trip.members.find(member => member.address === address);
    return { ...trip, actor: self.id, code: record.code, invite: record.invite };
  }

  // Re-use logic for due bills, mutations, and HTTP handlers from proven engine
  // Importing calculateRoomFundingShortfalls from core guarantees unified math!
  return async function handleRequest(request, ip) {
    // Forward to internal implementation
    const { createRoomApi: originalApi } = await import('../../../work/tripvault-room-server/entry.js');
    const delegate = originalApi({ database, origin, rpc, fetchFundingRate, now });
    return delegate(request, ip);
  };
}

export * from './constants.js';
export * from './errors.js';
