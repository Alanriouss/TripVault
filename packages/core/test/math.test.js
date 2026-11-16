import assert from 'node:assert/strict';
import {
  calculateShares,
  calculateMemberStats,
  vndToUsdcUnits,
  calculateSettlementPlan,
  calculateZeroSumChanges,
  calculateRoomFundingShortfalls,
  USDC_SCALE,
} from '../src/math.js';

console.log('--- Testing @tripvault/core math module ---');

// Test 1: calculateShares
{
  const bill = { amount: 100_000, participants: ['m0', 'm1', 'm2'] };
  const shares = calculateShares(bill);
  assert.equal(shares.length, 3);
  assert.equal(shares[0].amount, 33_334);
  assert.equal(shares[1].amount, 33_333);
  assert.equal(shares[2].amount, 33_333);
  const total = shares.reduce((acc, s) => acc + s.amount, 0);
  assert.equal(total, 100_000, 'Sum of shares must match bill amount exactly');
  console.log('PASS: calculateShares preserves total amount with remainders');
}

// Test 2: calculateMemberStats
{
  const trip = {
    members: [{ id: 'm0' }, { id: 'm1' }, { id: 'm2' }],
    bills: [
      { id: 'b1', amount: 300_000, payer: 'm0', participants: ['m0', 'm1', 'm2'], status: 'approved' },
      { id: 'b2', amount: 150_000, payer: 'm1', participants: ['m1', 'm2'], status: 'approved' },
      { id: 'b3', amount: 50_000, payer: 'm2', participants: ['m0', 'm2'], status: 'pending' }, // Pending bill should be excluded
    ],
  };
  const stats = calculateMemberStats(trip);
  assert.equal(stats.length, 3);
  // m0 paid 300k, owes 100k -> net +200k
  assert.equal(stats[0].net, 200_000);
  // m1 paid 150k, owes 100k + 75k = 175k -> net -25k
  assert.equal(stats[1].net, -25_000);
  // m2 paid 0, owes 100k + 75k = 175k -> net -175k
  assert.equal(stats[2].net, -175_000);

  const netSum = stats.reduce((acc, s) => acc + s.net, 0);
  assert.equal(netSum, 0, 'Net balance sum across all members must be 0');
  console.log('PASS: calculateMemberStats ignores pending bills and preserves zero-sum net');
}

// Test 3: Zero-Sum Balancer on Avalanche Fuji changes[]
{
  // Test with 7 members and irregular amounts
  const members = Array.from({ length: 7 }, (_, i) => ({ id: `m${i}` }));
  const trip = {
    members,
    bills: [
      { id: 'b1', amount: 777_777, payer: 'm0', participants: members.map(m => m.id), status: 'approved' },
      { id: 'b2', amount: 123_456, payer: 'm3', participants: ['m1', 'm2', 'm4', 'm5'], status: 'approved' },
      { id: 'b3', amount: 999_999, payer: 'm6', participants: ['m0', 'm2', 'm4', 'm6'], status: 'approved' },
    ],
    depositUnits: {},
  };

  const quotes = [
    { rate: 25_000 },
    { rate: 25_431.85 },
    { rate: 26_111.11, historical: true },
  ];

  for (const quote of quotes) {
    const changes = calculateZeroSumChanges(trip, quote);
    assert(Array.isArray(changes), 'Changes must be an array');
    assert.equal(changes.length, 7, 'Must have 7 entries for 7 members');
    const sum = changes.reduce((acc, c) => acc + c, 0);
    assert.equal(sum, 0, `Sum of changes must be exactly 0 under rate ${quote.rate}, got: ${sum}`);
  }
  console.log('PASS: calculateZeroSumChanges guarantees sum(changes) === 0 across various exchange rates');
}

// Test 4: calculateRoomFundingShortfalls
{
  const trip = {
    members: [{ id: 'm0' }, { id: 'm1' }],
    minimumUnits: 20 * USDC_SCALE,
    bills: [
      { id: 'b1', amount: 1_000_000, payer: 'm0', participants: ['m0', 'm1'], status: 'approved' },
    ],
  };
  const funding = {
    balances: [20 * USDC_SCALE, 10 * USDC_SCALE], // m1 only deposited 10 USDC
    rate: 25_000,
  };
  // m1 owes 500,000 VND / 25,000 = 20 USDC. Required is max(minDeposit: 20, debt: 20) = 20 USDC.
  // m1 balance is 10 USDC -> shortfall = 10 USDC = 10,000,000 units.
  const shortfalls = calculateRoomFundingShortfalls(trip, funding);
  assert.equal(shortfalls.length, 1);
  assert.equal(shortfalls[0].id, 'm1');
  assert.equal(shortfalls[0].units, 10 * USDC_SCALE);
  console.log('PASS: calculateRoomFundingShortfalls correctly calculates deposit deficits');
}

console.log('ALL TESTS PASSED in @tripvault/core!');
