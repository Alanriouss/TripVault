import assert from 'node:assert/strict';
import { Database } from 'bun:sqlite';
import { Wallet } from 'ethers';
import { createRoomApi } from '../src/index.js';

console.log('--- Testing @tripvault/server package ---');

const origin = 'http://127.0.0.1:8789';
const db = new Database(':memory:');
const wallet = Wallet.createRandom();

const api = createRoomApi({
  database: db,
  origin,
  rpc: async () => null,
  fetchFundingRate: async () => 25000,
  now: () => Date.now(),
});

// Test 1: Challenge generation (SIWE POST with Origin)
{
  const res = await api(new Request(`${origin}/api/auth/challenge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': origin,
    },
    body: JSON.stringify({ address: wallet.address }),
  }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert(data.nonce && typeof data.nonce === 'string', 'Must return a nonce');
  assert(data.message.includes(wallet.address.toLowerCase()) || data.message.includes(wallet.address), 'Message must include wallet address');
  assert(data.message.includes(origin), 'Message must include origin');
  console.log('PASS: SIWE challenge generation succeeds');

  // Test 2: SIWE signature verification & session creation via /auth/verify
  const signature = await wallet.signMessage(data.message);
  const sessionRes = await api(new Request(`${origin}/api/auth/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': origin,
    },
    body: JSON.stringify({ nonce: data.nonce, signature }),
  }));
  assert.equal(sessionRes.status, 200);
  const session = await sessionRes.json();
  assert(session.token && typeof session.token === 'string', 'Must return session token');
  assert.equal(session.address.toLowerCase(), wallet.address.toLowerCase(), 'Must return correct wallet address');
  console.log('PASS: SIWE signature verification via /auth/verify succeeds');

  // Test 3: Authenticated room creation (POST /api/rooms returns 201)
  const now = Date.now();
  const tripSettings = {
    name: 'Ha Long Bay Cruise',
    location: 'Quang Ninh',
    displayName: 'Captain An',
    start: now + 86_400_000,
    end: now + 172_800_000,
    deadline: now + 43_200_000,
    minimumUnits: 20_000_000,
    approvalMode: 'everyone',
  };

  const createRes = await api(new Request(`${origin}/api/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': origin,
      'Authorization': `Bearer ${session.token}`,
    },
    body: JSON.stringify(tripSettings),
  }));
  assert.equal(createRes.status, 201);
  const room = await createRes.json();
  assert(room.id && room.id.startsWith('room-'), 'Room id must follow room-* format');
  assert(room.code && /^[0-9]{6}$/.test(room.code), 'Room code must be a 6-digit string');
  assert.equal(room.members.length, 1);
  assert.equal(room.members[0].address.toLowerCase(), wallet.address.toLowerCase());
  console.log('PASS: Room creation with 6-digit code succeeds (201 Created)');
}

console.log('ALL TESTS PASSED in @tripvault/server!');
