import { Database } from 'bun:sqlite';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getAddress, Interface, verifyMessage } from 'ethers';
import { roomFundingShortfalls } from '../tripvault-room-funding.js';

const CONTRACT = /*ROOM_CONTRACT*/null;
const CHAIN = 43113;
const RPC = 'https://api.avax-test.network/ext/bc/C/rpc';
const MAX_MEMBERS = 12;
const FIVE_MINUTES = 300_000;
const DAY = 86_400_000;
const REFUND_DELAY_SECONDS = 7n * 86_400n;
const LOCAL_HTML = 'TripVault_Rooms_v9.html';
const ZERO = /^0x0{40}$/i;
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const HASH = /^0x[0-9a-f]{64}$/i;
const ROOM_ID = /^room-[a-f0-9-]{36}$/;

class RoomError extends Error {
  constructor(status, message, funding) {
    super(message);
    this.status = status;
    this.funding = funding;
  }
}

function assert(value, status, message) {
  if (!value) throw new RoomError(status, message);
}

function text(value, max, label, required = true) {
  assert(typeof value === 'string', 400, `Enter a valid ${label}.`);
  const clean = value.trim();
  assert(clean.length <= max && (!required || clean.length), 400, `Enter a valid ${label}.`);
  return clean;
}

function safeAddress(input) {
  assert(typeof input === 'string' && ADDRESS.test(input) && !ZERO.test(input), 400, 'Invalid wallet address.');
  return input.toLowerCase();
}

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

async function marketFundingRate() {
  const response = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(7000) });
  if (!response.ok) return null;
  const quote = await response.json();
  return quote.result === 'success' ? quote.rates?.VND : null;
}

async function readFujiFunding(trip, rpc) {
  const address = trip.fuji.address;
  const block = await rpc('eth_getBlockByNumber', ['latest', false]);
  assert(block && /^0x[0-9a-f]+$/i.test(block.number) && /^0x[0-9a-f]+$/i.test(block.timestamp),
    503, 'Could not verify vault funding on Fuji. Try again.');
  const raw = await rpc('eth_call', [{ to: address, data: iface.encodeFunctionData('snapshot') }, block.number]);
  const [members, balances, , , , start, end, minimum, settled] = iface.decodeFunctionResult('snapshot', raw);
  assert(members.length === trip.members.length && balances.length === members.length
    && members.every((member, index) => member.toLowerCase() === trip.members[index].address)
    && minimum === BigInt(trip.minimumUnits)
    && balances.every(balance => balance <= BigInt(Number.MAX_SAFE_INTEGER)),
  503, 'Could not verify vault balances for this room.');
  let deadline = end + REFUND_DELAY_SECONDS;
  const now = BigInt(block.timestamp);
  if (!settled && now >= deadline && trip.fuji.contractVersion >= 2) {
    const result = await rpc('eth_call', [{ to: address, data: iface.encodeFunctionData('refundDeadline') }, block.number]);
    [deadline] = iface.decodeFunctionResult('refundDeadline', result);
  }
  const hasDeadline = trip.fuji.contractVersion === 3;
  const deadlineReached = hasDeadline && now >= BigInt(Math.floor(Date.parse(trip.depositDeadline) / 1000));
  const cancelled = deadlineReached && await vaultFundingFailed(address, block.number, rpc);
  return { balances: balances.map(Number), closed: cancelled || settled || now >= deadline,
    ...(hasDeadline ? { cancelled, deadlineReached, started: now >= start, ended: now >= end } : {}) };
}

function tripEnd(trip) {
  return Date.parse(trip.endedAt || trip.endTime);
}

async function verifyChainProof(trip, address, data, rpc) {
  assert(typeof data.hash === 'string' && HASH.test(data.hash), 400, 'Invalid transaction hash.');
  assert(['deploy', 'fuji-publish', 'fuji-settle', 'fuji-end'].includes(data.kind), 400, 'Unknown Fuji proof.');
  const [receipt, transaction] = await Promise.all([
    rpc('eth_getTransactionReceipt', [data.hash]), rpc('eth_getTransactionByHash', [data.hash]),
  ]);
  assert(receipt?.status === '0x1' && receipt.transactionHash?.toLowerCase() === data.hash.toLowerCase()
    && transaction?.hash?.toLowerCase() === data.hash.toLowerCase() && transaction.from?.toLowerCase() === address
    && /^0x[0-9a-f]+$/i.test(receipt.blockNumber) && /^0x[0-9a-f]+$/i.test(receipt.transactionIndex),
  409, 'Fuji has not confirmed this organizer transaction.');
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

async function checkVaultCanBeDeleted(address, contractVersion, rpc) {
  const block = await rpc('eth_getBlockByNumber', ['latest', false]);
  assert(block && /^0x[0-9a-f]+$/i.test(block.number) && /^0x[0-9a-f]+$/i.test(block.timestamp),
    503, 'Fuji is unavailable. Try checking the vault again.');
  const raw = await rpc('eth_call', [{ to: address, data: iface.encodeFunctionData('snapshot') }, block.number]);
  const [members, balances, , , , , end, , settled] = iface.decodeFunctionResult('snapshot', raw);
  assert(members.length > 0 && members.length === balances.length, 503, 'Fuji vault balances could not be verified.');
  const cancelled = contractVersion === 3 && await vaultFundingFailed(address, block.number, rpc);
  if (!settled && !cancelled) {
    let deadline = end + REFUND_DELAY_SECONDS;
    if (contractVersion >= 2) {
      const rawDeadline = await rpc('eth_call', [{ to: address, data: iface.encodeFunctionData('refundDeadline') }, block.number]);
      [deadline] = iface.decodeFunctionResult('refundDeadline', rawDeadline);
    }
    assert(BigInt(block.timestamp) >= deadline, 409,
      'The Fuji vault is still open. Settle the trip or wait until the refund window opens.');
  }
  assert(balances.every(balance => balance === 0n), 409,
    'Members must claim their remaining Fuji balances before this trip can be deleted.');
}

function isAllowedOrigin(from, origin) {
  if (!from || from === origin) return true;
  try {
    const fromUrl = new URL(from);
    const originUrl = new URL(origin);
    const isLocalFrom = fromUrl.hostname === '127.0.0.1' || fromUrl.hostname === 'localhost';
    const isLocalOrigin = originUrl.hostname === '127.0.0.1' || originUrl.hostname === 'localhost';
    return isLocalFrom && isLocalOrigin && fromUrl.port === originUrl.port;
  } catch {
    return false;
  }
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

  function authenticate(request) {
    const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{32})$/)?.[1];
    const session = token && getSession.get(digest(token), Date.now());
    assert(session, 401, 'Connect and sign in with your wallet again.');
    return session.address;
  }

  function presentation(record, address) {
    const trip = JSON.parse(record.snapshot);
    const self = trip.members.find(member => member.address === address);
    assert(self, 404, 'Room unavailable.');
    for (const bill of trip.bills) {
      if (bill.feedbackLog) {
        bill.feedbackLog = bill.feedbackLog.filter(item => item.recipients.includes(self.id));
      }
      if (bill.notificationLog) {
        bill.notificationLog = bill.notificationLog.filter(item => item.recipients.includes(self.id));
      }
    }
    return self.id === trip.owner ? { ...trip, code: record.code, invite: record.invite } : trip;
  }

  function readMemberRoom(id, address) {
    const record = getRoom.get(id);
    assert(record, 404, 'Room unavailable.');
    const trip = JSON.parse(record.snapshot);
    const self = trip.members.find(member => member.address === address);
    assert(self, 404, 'Room unavailable.');
    return { record, trip, self };
  }

  function persist(record, trip, address) {
    trip.version++;
    const snapshot = JSON.stringify(trip);
    updateRoom.run(snapshot, record.id);
    return presentation({ ...record, snapshot }, address);
  }

  function closeTripBills(trip) {
    if (trip.billsClosedAt || tripEnd(trip) > now()) return false;
    trip.billsClosedAt = new Date(tripEnd(trip)).toISOString();
    clearRoomReminders.run(trip.id);
    return true;
  }

  function refreshBillReviews(trip, time) {
    let changed = false;
    let autoApproved = false;
    for (const bill of trip.bills) {
      if (bill.status !== 'pending') continue;
      if (!bill.reviewBy) {
        bill.createdBy = bill.payer;
        bill.approvals = bill.approvals.filter(id => bill.participants.includes(id));
        bill.reviewBy = time + DAY;
        bill.status = billStatus(bill);
        changed = true;
        if (bill.status === 'approved') {
          autoApproved = true;
          continue;
        }
      }
      if (!trip.reviewQuote && !trip.settled && bill.reviewBy <= time) {
        bill.autoApprovals = bill.participants.filter(id => !bill.approvals.includes(id));
        bill.status = 'approved';
        autoApproved = true;
      }
    }
    if (autoApproved) invalidateSplit(trip);
    return changed || autoApproved;
  }

  const refreshBills = db.transaction((records) => {
    for (const record of records) {
      const latest = getRoom.get(record.id);
      if (!latest) continue;
      const trip = JSON.parse(latest.snapshot);
      const closed = closeTripBills(trip);
      if (refreshBillReviews(trip, now()) || closed) {
        trip.version++;
        updateRoom.run(JSON.stringify(trip), trip.id);
      }
    }
  });

  function refreshDueBills(records) {
    const time = now();
    const due = records.filter(record => {
      const trip = JSON.parse(record.snapshot);
      return (!trip.billsClosedAt && tripEnd(trip) <= time)
        || trip.bills.some(bill => bill.status === 'pending' && (!bill.reviewBy || bill.reviewBy <= time));
    });
    if (due.length) refreshBills.immediate(due);
    return due.length > 0;
  }

  function remindersFor(address) {
    return getReminders.all(address).map(row => {
      const trip = JSON.parse(row.snapshot);
      return { id: row.id, roomId: row.room_id, tripName: trip.name, draft: JSON.parse(row.draft),
        sender: trip.members.find(member => member.address === row.sender)?.name,
        units: JSON.parse(row.recipient).units, receivedAt: row.updated };
    });
  }

  const sendTopUpReminder = db.transaction((id, address, version, draft, funding) => {
    const { trip, self } = readMemberRoom(id, address);
    assert(trip.version === version, 409, 'The trip changed. Check the amounts and try again.');
    assert(tripEnd(trip) > now(), 409, 'The trip has ended. New bills are closed.');
    assert(!trip.settled && !funding.closed && funding.started !== false, 409, 'Bills are not open for this trip.');
    assert(funding.rate, 503, 'Could not check the exchange rate. Try again.');
    const recipients = roomFundingShortfalls(trip, funding, draft)
      .filter(item => item.id !== self.id)
      .map(item => ({ address: trip.members.find(member => member.id === item.id).address, units: item.units }));
    assert(recipients.length, 409, 'Everyone else has already added enough for this bill.');
    saveReminder.run(randomUUID(), id, address, JSON.stringify(draft), JSON.stringify(recipients), Date.now());
    return { sent: recipients.length };
  });

  const createRoom = db.transaction((address, settings) => {
    let code;
    do { code = String(randomInt(1_000_000)).padStart(6, '0'); } while (getCode.get(code));
    const id = 'room-' + randomUUID();
    const invite = opaque();
    const snapshot = JSON.stringify(makeTrip(settings, address, id));
    insertRoom.run(id, code, invite, snapshot, Date.now());
    insertMember.run(id, address);
    return presentation({ id, code, invite, snapshot }, address);
  });

  const joinRoom = db.transaction((address, data) => {
    const key = text(data.key, 32, 'room code or link');
    const byCode = /^\d{6}$/.test(key);
    assert(byCode || /^[A-Za-z0-9_-]{32}$/.test(key), 400, 'Enter a six-digit room code or a valid invite link.');
    const record = byCode ? getCode.get(key) : getInvite.get(key);
    assert(record, 404, 'Room unavailable or invitations have closed.');
    const trip = JSON.parse(record.snapshot);
    if (trip.members.some(member => member.address === address)) return presentation(record, address);
    const inviteDeadline = trip.depositDeadline ? Date.parse(trip.depositDeadline) : tripEnd(trip);
    assert(!trip.locked && !trip.settled && inviteDeadline > Date.now(), 404, 'Room unavailable or invitations have closed.');
    assert(trip.members.length < MAX_MEMBERS, 409, 'This room has reached 12 members.');
    const name = text(data.displayName, 40, 'display name', false) || shorten(address);
    const id = 'm' + trip.members.length;
    trip.members.push({ id, name, address });
    insertMember.run(record.id, address);
    invalidateSplit(trip);
    return persist(record, trip, address);
  });

  const signIn = db.transaction((data) => {
    const nonce = text(data.nonce, 48, 'sign-in nonce');
    const challenge = getChallenge.get(nonce, Date.now());
    assert(challenge?.message.includes(' wants you to sign in with your Ethereum account:\n'), 401, 'Wallet sign-in expired. Try again.');
    assert(typeof data.signature === 'string' && /^0x[0-9a-f]{130}$/i.test(data.signature), 401, 'Invalid wallet signature.');
    let signer;
    try { signer = verifyMessage(challenge.message, data.signature).toLowerCase(); } catch {}
    assert(signer === challenge.address, 401, 'The selected wallet did not sign this request.');
    deleteChallenge.run(nonce);
    const token = opaque();
    insertSession.run(digest(token), signer, Date.now() + DAY);
    return { token, address: signer };
  });

  const mutate = db.transaction((id, address, data, funding) => {
    const { record, trip, self } = readMemberRoom(id, address);
    const organizer = self.id === trip.owner;
    if (data.type === 'room.freeze') {
      assert(organizer, 403, 'Only the organizer can lock the roster.');
      if (trip.locked) return presentation(record, address);
      assert(!trip.depositDeadline || Date.parse(trip.depositDeadline) > Date.now(), 409, 'The deposit deadline has passed.');
      trip.locked = true;
      trip.rosterLockedAt = now();
      return persist(record, trip, address);
    }
    assert(!trip.settled || data.type === 'room.rename-member', 409, 'The room has already settled on Fuji.');
    assert(data.version === trip.version, 409, 'The room changed. Refresh and try again.');
    switch (data.type) {
      case 'room.rename': {
        assert(organizer, 403, 'Only the organizer can rename the trip.');
        assert(now() < Math.min(Date.parse(trip.depositDeadline || trip.startTime), tripEnd(trip)),
          409, 'The trip name can only be changed before the deposit deadline.');
        trip.name = text(data.name, 70, 'name');
        break;
      }
      case 'room.rename-member': {
        const name = text(data.name, 40, 'name');
        if (self.name === name) return presentation(record, address);
        self.name = name;
        break;
      }
      case 'room.end': {
        assert(organizer, 403, 'Only the organizer can end this trip.');
        assert(!trip.fuji?.address, 409, 'End this trip from its Fuji vault.');
        assert(!trip.depositDeadline, 409, 'Trips with a deposit deadline need a funded vault before they can end early.');
        if (tripEnd(trip) <= now()) return presentation(record, address);
        trip.endedAt = new Date(Math.floor(now() / 1000) * 1000).toISOString();
        if (!trip.locked) trip.rosterLockedAt = now();
        trip.locked = true;
        closeTripBills(trip);
        break;
      }
      case 'bill.add':
      case 'bill.edit': {
        const editing = data.type === 'bill.edit';
        const previous = editing && trip.bills.find(item => item.id === data.id);
        if (editing) {
          assert(previous && (previous.createdBy || previous.payer) === self.id, 403, 'Only the bill creator can edit it.');
          assert(['pending', 'disputed'].includes(previous.status) && !trip.reviewQuote, 409, 'This bill cannot be edited now.');
          assert(previous.status !== 'pending' || previous.reviewBy > now(), 409, 'The bill review time has ended. Refresh the trip.');
        } else {
          assert(tripEnd(trip) > now(), 409, 'The trip has ended. New bills are closed.');
        }
        const draft = billDetails(trip, data);
        assert(editing || trip.bills.length < 1000, 409, 'This room has reached 1,000 bills.');
        assert(funding?.version === trip.version && !funding.closed, 409, 'The Fuji vault is closed to new bills.');
        assert(funding.started !== false, 409, 'Bills open at the scheduled trip start.');
        if (!funding.rate) throw new RoomError(503, 'The USD/VND rate is unavailable. Try again to check funding.', funding);
        const reviewStartedAt = now();
        const bill = { ...draft, id: previous?.id ?? trip.nextBillId, createdBy: self.id,
          approvals: [], status: 'pending', reviewStartedAt, reviewBy: reviewStartedAt + DAY,
          ...(previous?.feedbackLog ? { feedbackLog: previous.feedbackLog } : {}),
          ...(previous?.notificationLog ? { notificationLog: previous.notificationLog } : {}),
          history: previous ? [...(previous.history || []), {
            ...billDetails(trip, previous), reviewBy: previous.reviewBy, feedback: previous.feedback || [],
          }].slice(-25) : [] };
        const otherBills = editing ? trip.bills.filter(item => item.id !== bill.id) : trip.bills;
        const shortfalls = roomFundingShortfalls({ ...trip, bills: otherBills }, funding, bill);
        if (shortfalls.length) {
          const amounts = shortfalls.map(({ id, units }) =>
            trip.members.find(member => member.id === id).name + ' needs ' + (units / 1_000_000).toFixed(6) + ' USDC');
          throw new RoomError(409, 'Top up before saving this bill. ' + amounts.join(' · '), funding);
        }
        if (editing) trip.bills[trip.bills.indexOf(previous)] = bill;
        else {
          trip.nextBillId++;
          trip.bills.push(bill);
        }
        clearBillReminder.run(id, JSON.stringify(draft));
        invalidateSplit(trip);
        break;
      }
      case 'bill.feedback-vote': {
        const bill = trip.bills.find(item => item.id === data.id);
        assert(bill && bill.status === 'disputed' && !trip.reviewQuote, 409, 'This suggestion is closed for review.');
        assert(billReviewers(bill).includes(self.id), 403, 'Only people involved in the bill can respond to suggestions.');
        assert(typeof data.agree === 'boolean', 400, 'Choose whether you agree with the suggestion.');
        const suggestion = bill.feedback?.find(item => item.author === data.author && (item.id || '') === data.suggestion);
        assert(suggestion, 409, 'This suggestion changed. Open the bill again.');
        assert(suggestion.author !== self.id, 403, 'Someone else must respond to your suggestion.');
        const responses = suggestion.responses || [];
        if (responses.find(item => item.member === self.id)?.agree === data.agree) return presentation(record, address);
        suggestion.responses = [...responses.filter(item => item.member !== self.id), { member: self.id, agree: data.agree }];
        logBillNotification(bill, data.agree ? 'suggestion-agreed' : 'suggestion-disagreed', self.id,
          [suggestion.author, bill.createdBy || bill.payer], now(), suggestion.comment);
        break;
      }
      case 'bill.approve':
      case 'bill.feedback':
      case 'bill.cancel': {
        const bill = trip.bills.find(item => item.id === data.id);
        assert(bill && bill.status !== 'rejected' && !trip.reviewQuote, 409, 'This bill is closed for review.');
        assert(bill.status !== 'pending' || bill.reviewBy > now(), 409, 'The bill review time has ended. Refresh the trip.');
        if (data.type === 'bill.cancel') {
          const voters = billReviewers(bill);
          assert(voters.includes(self.id), 403, 'Only the bill creator, payer and listed people can agree to remove it.');
          assert(typeof data.agree === 'boolean', 400, 'Choose whether to agree to remove this bill.');
          const existing = bill.cancellation;
          assert(data.agree || existing, 409, 'There is no request to remove this bill.');
          if (!data.agree) {
            logBillNotification(bill, 'cancellation-declined', self.id,
              [existing.requestedBy || existing.votes[0], ...voters].filter(Boolean), now(), existing.reason);
            delete bill.cancellation;
            bill.status = existing.previous;
            if (bill.status === 'pending') bill.reviewBy = now() + DAY;
          } else {
            assert(!existing || data.reason === undefined, 409,
              'A cancellation request already exists. Read the reason before voting.');
            const cancellation = existing || {
              id: randomUUID(), previous: bill.status, votes: [], requestedBy: self.id,
              reason: text(data.reason, 500, 'reason for cancellation'), requestedAt: now(),
            };
            if (cancellation.votes.includes(self.id)) return presentation(record, address);
            cancellation.votes.push(self.id);
            bill.cancellation = cancellation;
            bill.status = voters.every(id => cancellation.votes.includes(id)) ? 'rejected' : 'cancellation';
            if (!existing && bill.status === 'cancellation') {
              logBillNotification(bill, 'cancellation-requested', self.id,
                trip.members.map(member => member.id), cancellation.requestedAt, cancellation.reason, cancellation.id);
            }
            if (bill.status === 'rejected') cancellation.resolvedAt = now();
          }
        } else {
          assert(bill.participants.includes(self.id), 403, 'Only people listed on the bill can review it.');
          assert(bill.status === 'pending' || bill.status === 'disputed', 409, 'This bill is closed for review.');
          if (data.type === 'bill.feedback') {
            const comment = text(data.comment, 500, 'reason or suggested change');
            const active = bill.feedback || [];
            const requestId = data.requestId;
            assert(requestId === undefined || (typeof requestId === 'string' && /^[a-f0-9-]{36}$/i.test(requestId)),
              400, 'The suggestion could not be sent. Open the form again.');
            const alreadySaved = (bill.feedbackLog || []).some(item => item.author === self.id
              && (requestId ? item.requestId === requestId : item.comment === comment && active.some(entry => entry.id === item.id)));
            if (alreadySaved) {
              return presentation(record, address);
            }
            const feedback = { id: randomUUID(), author: self.id, comment, receivedAt: now() };
            const recipients = billReviewers(bill).filter(member => member !== self.id);
            bill.feedback = [...active.filter(item => item.author !== self.id), feedback];
            bill.feedbackLog = [...(bill.feedbackLog || []), {
              ...feedback, requestId, label: bill.label, recipients,
            }].slice(-25);
            bill.approvals = bill.approvals.filter(id => id !== self.id);
          } else {
            assert(data.approve === true, 400, 'Choose to approve the current bill.');
            if (bill.approvals.includes(self.id) && !bill.feedback?.some(item => item.author === self.id)) {
              return presentation(record, address);
            }
            bill.feedback = (bill.feedback || []).filter(item => item.author !== self.id);
            bill.approvals = [...new Set([...bill.approvals, self.id])];
          }
          const wasDisputed = bill.status === 'disputed';
          bill.status = billStatus(bill);
          if (wasDisputed && bill.status === 'pending') bill.reviewBy = now() + DAY;
        }
        invalidateSplit(trip);
        break;
      }
      case 'split.lock':
        assert(organizer, 403, 'Only the organizer can prepare the split.');
        assert(!trip.depositDeadline || (funding?.started && !funding.closed), 409, 'Final amounts can only be prepared for a funded trip.');
        assert(tripEnd(trip) <= now(), 409, 'Final amounts can be prepared when the trip ends.');
        assert(!trip.reviewQuote && trip.bills.every(bill => ['approved', 'rejected'].includes(bill.status)), 409, 'Resolve open bill reviews before preparing final amounts.');
        trip.reviewQuote = cleanQuote(data.quote);
        break;
      case 'split.reopen':
        assert(organizer, 403, 'Only the organizer can reopen the split.');
        if (!trip.reviewQuote) return presentation(record, address);
        invalidateSplit(trip);
        break;
      default:
        throw new RoomError(400, 'Unknown room action.');
    }
    return persist(record, trip, address);
  });

  function roomToDelete(id, address, version) {
    const { trip, self } = readMemberRoom(id, address);
    assert(self.id === trip.owner, 403, 'Only the organizer can delete this trip.');
    assert(trip.version === version, 409, 'The room changed. Review it before trying again.');
    return trip;
  }

  const removeRooms = db.transaction((entries, address) => {
    for (const entry of entries) {
      const trip = roomToDelete(entry.id, address, entry.version);
      assert((trip.fuji?.address || null) === entry.vault, 409, 'A Fuji vault changed. Review the selected trips and try again.');
    }
    for (const { id } of entries) {
      deleteMembers.run(id);
      deleteRoom.run(id);
    }
    return entries.map(entry => entry.id);
  });

  async function deleteTrips(entries, address, includeName) {
    const checked = entries.map(({ id, version }) => {
      const trip = roomToDelete(id, address, version);
      return { id, version, name: trip.name, vault: trip.fuji?.address || null, contractVersion: trip.fuji?.contractVersion };
    });
    const linked = checked.filter(entry => entry.vault);
    if (linked.length) throttle('delete-vault', address, 30);
    for (let index = 0; index < linked.length; index += 4) {
      await Promise.all(linked.slice(index, index + 4).map(async entry => {
        try {
          await checkVaultCanBeDeleted(entry.vault, entry.contractVersion, rpc);
        } catch (error) {
          if (includeName && error instanceof RoomError) {
            throw new RoomError(error.status, entry.name + ' — ' + error.message);
          }
          throw error;
        }
      }));
    }
    return removeRooms.immediate(checked, address);
  }

  const saveProof = db.transaction((id, address, proof) => {
    const { record, trip, self } = readMemberRoom(id, address);
    assert(self.id === trip.owner, 403, 'Only the organizer can verify a Fuji transaction for this room.');
    if (proof.kind === 'deploy') {
      const previousRoom = db.query("SELECT id FROM rooms WHERE json_extract(snapshot, '$.fuji.address') = ?").get(proof.address);
      assert(!previousRoom || previousRoom.id === id, 409, 'This vault is already linked to another room.');
      assert(!trip.fuji?.address || trip.fuji.address === proof.address, 409, 'This room already has a different vault.');
      if (trip.fuji?.address === proof.address) return presentation(record, address);
      trip.fuji = { address: proof.address, contractVersion: proof.version, linkedAt: now() };
    } else if (proof.kind === 'fuji-end') {
      if (trip.endedAt === proof.endedAt) return presentation(record, address);
      trip.endedAt = proof.endedAt;
      closeTripBills(trip);
    } else if (proof.kind === 'fuji-settle') {
      if (trip.settled && trip.fuji.settlementTx) return presentation(record, address);
      trip.settled = true;
      trip.fuji.settlementTx = proof.hash;
      trip.fuji.settledAt = now();
    } else {
      const last = trip.fuji.publishedPosition;
      if (trip.settled || (last && (last.block > proof.block || (last.block === proof.block && last.index >= proof.index)))) {
        return presentation(record, address);
      }
      trip.fuji.publishedRevision = proof.revision;
      trip.fuji.publishedAt = now();
      trip.fuji.publishedPosition = { block: proof.block, index: proof.index };
    }
    return persist(record, trip, address);
  });

  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
  const json = (data, status = 200) => Response.json(data, { status, headers });

  async function readJson(request) {
    assert(/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || ''), 415, 'Expected a JSON request.');
    assert(Number(request.headers.get('content-length') || 0) <= 16_384, 413, 'Request too large.');
    try {
      const body = await request.text();
      assert(body.length <= 16_384, 413, 'Request too large.');
      const data = JSON.parse(body);
      assert(data && typeof data === 'object' && !Array.isArray(data), 400, 'Invalid request.');
      return data;
    } catch (error) {
      if (error instanceof RoomError) throw error;
      throw new RoomError(400, 'Invalid JSON.');
    }
  }

  return async function handle(request, ip = 'local') {
    try {
      const path = new URL(request.url).pathname;
      const method = request.method;
      if (method === 'GET' && path === '/api/health') return json({ app: 'tripvault-rooms', rooms: true, chainId: CHAIN, deleteTrip: true, endTrip: true, bulkDelete: true, billFunding: true, topUpReminders: true, depositDeadline: true, billReview: true, billCancellationReason: true, notificationTimestamps: true, suggestionResponses: true });
      if (method === 'POST') {
        const from = request.headers.get('origin');
        assert(isAllowedOrigin(from, origin), 403, 'Open TripVault at its configured web address.');
      }
      if (method === 'POST' && path === '/api/auth/challenge') {
        throttle('challenge', ip, 90);
        const from = request.headers.get('origin');
        const reqOrigin = (from && isAllowedOrigin(from, origin)) ? from : origin;
        const reqDomain = new URL(reqOrigin).host;
        const reqHeader = `${reqDomain} wants you to sign in with your Ethereum account:`;
        const data = await readJson(request);
        const address = safeAddress(data.address);
        const nonce = randomBytes(16).toString('hex');
        const now = Date.now();
        const expires = now + FIVE_MINUTES;
        db.query('DELETE FROM auth_challenges WHERE expires <= ?').run(now);
        db.query('DELETE FROM auth_sessions WHERE expires <= ?').run(now);
        const message = `${reqHeader}\n${getAddress(address)}\n\nSign in to TripVault rooms. This signature does not send a transaction.\n\nURI: ${reqOrigin}\nVersion: 1\nChain ID: ${CHAIN}\nNonce: ${nonce}\nIssued At: ${new Date(now).toISOString()}\nExpiration Time: ${new Date(expires).toISOString()}`;
        insertChallenge.run(nonce, address, message, expires);
        return json({ nonce, message });
      }
      if (method === 'POST' && path === '/api/auth/verify') {
        throttle('verify', ip, 90);
        return json(signIn.immediate(await readJson(request)));
      }
      const address = authenticate(request);
      if (method === 'GET' && path === '/api/wallet/fuji-nonce') {
        throttle('wallet-nonce', address, 60);
        const reads = await Promise.allSettled(['latest', 'pending'].map(tag => rpc('eth_getTransactionCount', [address, tag])));
        let nonce = null;
        for (const read of reads) {
          if (read.status !== 'fulfilled' || typeof read.value !== 'string' || !/^0x[0-9a-f]{1,16}$/i.test(read.value)) continue;
          const count = BigInt(read.value);
          if (nonce === null || count > nonce) nonce = count;
        }
        assert(nonce !== null, 503, 'Fuji transaction number is unavailable.');
        return json({ nonce: '0x' + nonce.toString(16) });
      }
      if (method === 'POST' && path === '/api/rooms/bulk-delete') {
        const { trips } = await readJson(request);
        assert(Array.isArray(trips) && trips.length > 0
          && trips.every(trip => typeof trip?.id === 'string' && ROOM_ID.test(trip.id)
            && Number.isSafeInteger(trip.version) && trip.version > 0)
          && new Set(trips.map(trip => trip.id)).size === trips.length, 400, 'Select valid, distinct trips.');
        return json({ deleted: await deleteTrips(trips, address, true) });
      }
      if (method === 'GET' && path === '/api/rooms') {
        const records = getRooms.all(address);
        const updated = refreshDueBills(records) ? getRooms.all(address) : records;
        return json({ rooms: updated.map(record => presentation(record, address)), reminders: remindersFor(address) });
      }
      if (method === 'POST' && path === '/api/rooms') {
        throttle('create', address, 20);
        return json(createRoom.immediate(address, await readJson(request)), 201);
      }
      if (method === 'POST' && path === '/api/rooms/join') {
        throttle('join-ip', ip, 50);
        throttle('join-wallet', address, 20);
        return json(joinRoom.immediate(address, await readJson(request)));
      }
      const match = /^\/api\/rooms\/(room-[a-f0-9-]{36})(?:\/(actions|chain-proof|funding|top-up-reminder))?$/.exec(path);
      assert(match, 404, 'Page unavailable.');
      const [, id, action] = match;
      const { record } = readMemberRoom(id, address);
      refreshDueBills([record]);
      if (method === 'GET' && !action) return json(presentation(readMemberRoom(id, address).record, address));
      if (method === 'GET' && action === 'funding') {
        const { trip } = readMemberRoom(id, address);
        return json(await getRoomFunding(trip));
      }
      if (method === 'POST' && action === 'top-up-reminder') {
        throttle('top-up-reminder', address, 20);
        const data = await readJson(request);
        const { trip } = readMemberRoom(id, address);
        assert(trip.version === data.version && !trip.settled, 409, 'The trip changed. Check the amounts and try again.');
        const draft = billDetails(trip, data);
        return json(sendTopUpReminder.immediate(id, address, trip.version, draft, await getRoomFunding(trip)));
      }
      if (method === 'POST' && action === 'actions') {
        const data = await readJson(request);
        if (['bill.add', 'bill.edit', 'split.lock'].includes(data.type)) {
          const { trip } = readMemberRoom(id, address);
          if (data.type === 'bill.add') assert(tripEnd(trip) > now(), 409, 'The trip has ended. New bills are closed.');
          if (data.type === 'split.lock' && !trip.depositDeadline) return json(mutate.immediate(id, address, data));
          assert(!trip.settled, 409, 'The room has already settled on Fuji.');
          assert(data.version === trip.version, 409, 'The room changed. Refresh and try again.');
          return json(mutate.immediate(id, address, data, await getRoomFunding(trip)));
        }
        if (data.type !== 'room.delete') return json(mutate.immediate(id, address, data));
        await deleteTrips([{ id, version: data.version }], address, false);
        return json({ id, deleted: true });
      }
      if (method === 'POST' && action === 'chain-proof') {
        throttle('proof', address, 60);
        const { trip, self } = readMemberRoom(id, address);
        assert(self.id === trip.owner, 403, 'Only the organizer can verify a Fuji transaction for this room.');
        const proof = await verifyChainProof(trip, address, await readJson(request), rpc);
        return json(saveProof.immediate(id, address, proof));
      }
      return json({ error: 'Page unavailable.' }, 404);
    } catch (error) {
      if (error instanceof RoomError) return json({ error: error.message, funding: error.funding }, error.status);
      console.error('TripVault request failed:', error.message);
      return json({ error: 'TripVault could not complete that request. Try again.' }, 503);
    }
  };
}

if (import.meta.main) {
  const host = process.env.TRIPVAULT_HOST || process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
  const port = Number(process.env.PORT || process.env.TRIPVAULT_PORT || '8788');
  const origin = new URL(process.env.TRIPVAULT_ORIGIN || `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`).origin;
  const databasePath = resolve(process.env.TRIPVAULT_DB || resolve(import.meta.dir, '../work/tripvault-rooms.sqlite3'));
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  const api = createRoomApi({ database: db, origin });
  const page = Bun.file(resolve(import.meta.dir, LOCAL_HTML));
  if (!(await page.exists())) throw new Error(`Place ${LOCAL_HTML} next to this server file.`);
  const server = Bun.serve({
    hostname: host, port, maxRequestBodySize: 16_384,
    fetch(request, listener) {
      const path = new URL(request.url).pathname;
      if (path.startsWith('/api/')) return api(request, listener.requestIP(request)?.address || 'local');
      if (request.method === 'GET' && (path === '/' || path === '/' + LOCAL_HTML)) {
        return new Response(Bun.file(resolve(import.meta.dir, LOCAL_HTML)), { headers: {
          'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        } });
      }
      return new Response('Page unavailable.', { status: 404 });
    },
  });
  console.log(`TripVault Rooms: ${origin} (listening on ${host}:${server.port})`);
}
