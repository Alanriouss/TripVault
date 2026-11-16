/**
 * @tripvault/core - Math & Settlement Logic
 * Pure ESM logic for bill splitting, currency conversion, and Zero-Sum debt balancing.
 */

export const USDC_SCALE = 1_000_000; // 1 USDC = 1,000,000 micro-units (6 decimals)

/**
 * Split an integer VND bill among participants.
 * Guarantees that sum(shares.amount) === bill.amount exactly.
 */
export function calculateShares(bill) {
  if (!bill || !Array.isArray(bill.participants) || bill.participants.length === 0) {
    return [];
  }
  const count = bill.participants.length;
  const amount = Math.round(Number(bill.amount) || 0);
  const base = Math.floor(amount / count);
  const remainder = amount - base * count;

  return bill.participants.map((id, index) => ({
    id,
    amount: base + (index < remainder ? 1 : 0),
  }));
}

/**
 * Calculate net VND balances for all members in a trip.
 * Only includes bills with status === 'approved'.
 * Guarantees: sum(member.net) === 0 across all members.
 */
export function calculateMemberStats(trip) {
  if (!trip || !Array.isArray(trip.members)) return [];

  const bills = Array.isArray(trip.bills) ? trip.bills : [];
  const approvedBills = bills.filter(b => b.status === 'approved');

  return trip.members.map(member => {
    let paid = 0;
    let owed = 0;

    for (const bill of approvedBills) {
      if (bill.payer === member.id) {
        paid += Math.round(Number(bill.amount) || 0);
      }
      const participantShares = calculateShares(bill);
      const share = participantShares.find(s => s.id === member.id);
      if (share) {
        owed += share.amount;
      }
    }

    return {
      ...member,
      paid,
      owed,
      net: paid - owed, // Positive = Creditor (needs payout), Negative = Debtor (owes money)
    };
  });
}

/**
 * Convert VND amount to micro-USDC units given an exchange rate.
 * Uses historical round-trip logic if historical flag is set, otherwise direct conversion.
 */
export function vndToUsdcUnits(vnd, rate, historical = false) {
  if (!rate || rate <= 0 || !Number.isFinite(rate)) return 0;
  if (historical) {
    return Math.round((Math.round((vnd / rate) * 100) / 100) * USDC_SCALE);
  }
  return Math.round((vnd / rate) * USDC_SCALE);
}

/**
 * Generates pairwise settlement transfers between debtors and creditors.
 */
export function calculateSettlementPlan(trip, quote) {
  if (!quote || !quote.rate || quote.rate <= 0) {
    return { transfers: [], shortfalls: [], invalid: true, due: {} };
  }

  const balances = calculateMemberStats(trip);
  const debtors = balances.filter(item => item.net < 0).map(item => ({ id: item.id, amount: -item.net }));
  const creditors = balances.filter(item => item.net > 0).map(item => ({ id: item.id, amount: item.net }));
  const transfers = [];
  const due = new Map();

  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const vnd = Math.min(debtor.amount, creditor.amount);
    const units = vndToUsdcUnits(vnd, quote.rate, Boolean(quote.historical));

    transfers.push({
      from: debtor.id,
      to: creditor.id,
      vnd,
      units,
    });

    due.set(debtor.id, (due.get(debtor.id) || 0) + units);
    debtor.amount -= vnd;
    creditor.amount -= vnd;

    if (debtor.amount === 0) debtorIndex++;
    if (creditor.amount === 0) creditorIndex++;
  }

  const invalid = transfers.some(t => !Number.isSafeInteger(t.units) || t.units <= 0)
    || [...due.values()].some(u => !Number.isSafeInteger(u));

  const depositUnitsMap = trip.depositUnits || {};
  const shortfalls = [...due].map(([id, units]) => ({
    id,
    units: units - (depositUnitsMap[id] || 0),
  })).filter(item => item.units > 0);

  return {
    transfers,
    shortfalls,
    invalid,
    due: Object.fromEntries(due),
  };
}

/**
 * Generates the signed int256[] array for Avalanche Fuji contract propose(int256[]).
 * Applies Zero-Sum Balancer to guarantee sum(changes) === 0.
 *
 * @param {Object} trip - Room object with members and bills
 * @param {Object} quote - Exchange rate quote { rate: number, ... }
 * @returns {number[] | null} Array of signed micro-USDC units in roster order.
 */
export function calculateZeroSumChanges(trip, quote) {
  if (!trip || !Array.isArray(trip.members) || !quote || !quote.rate) {
    return null;
  }

  const hasPending = Array.isArray(trip.bills) && trip.bills.some(b => b.status !== 'approved' && b.status !== 'rejected');
  if (hasPending) return null;

  const plan = calculateSettlementPlan(trip, quote);
  if (plan.invalid) return null;

  // Calculate net changes per member from transfers
  const net = new Map(trip.members.map(m => [m.id, 0n]));
  for (const item of plan.transfers) {
    const units = BigInt(item.units);
    net.set(item.from, net.get(item.from) - units);
    net.set(item.to, net.get(item.to) + units);
  }

  // Verify total sum
  let totalDelta = 0n;
  for (const val of net.values()) {
    totalDelta += val;
  }

  // Zero-Sum Balancer: If any rounding drift occurred (totalDelta !== 0n),
  // adjust the largest non-zero participant so sum is exactly 0.
  if (totalDelta !== 0n) {
    let maxId = null;
    let maxAbs = -1n;
    for (const [id, val] of net.entries()) {
      const absVal = val < 0n ? -val : val;
      if (absVal > maxAbs) {
        maxAbs = absVal;
        maxId = id;
      }
    }
    if (maxId) {
      net.set(maxId, net.get(maxId) - totalDelta);
    }
  }

  const result = trip.members.map(m => Number(net.get(m.id)));
  return result.every(Number.isSafeInteger) ? result : null;
}

/**
 * Calculates any funding shortages for members.
 * Accounts for draft bills and minimum required deposits.
 */
export function calculateRoomFundingShortfalls(trip, funding, draft) {
  if (!trip || !Array.isArray(trip.members)) return [];

  const net = new Map(trip.members.map(member => [member.id, 0]));
  const bills = draft ? [...(trip.bills || []), draft] : (trip.bills || []);

  for (const bill of bills) {
    if (bill.status === 'rejected') continue;
    const count = bill.participants.length;
    if (count === 0) continue;

    const share = Math.floor(bill.amount / count);
    const remainder = bill.amount % count;
    const payerShare = bill.participants.indexOf(bill.payer);

    if (bill.status === 'approved') {
      net.set(bill.payer, net.get(bill.payer) + bill.amount);
    }
    for (const [index, id] of bill.participants.entries()) {
      if (bill.status !== 'approved' && index === payerShare) continue;
      net.set(id, net.get(id) - share - (index < remainder ? 1 : 0));
    }
  }

  const balances = funding?.balances || [];
  const rate = funding?.rate || 0;
  const minimumUnits = trip.minimumUnits || 0;

  return trip.members.map((member, index) => {
    const debt = rate ? Math.ceil(Math.max(0, -net.get(member.id)) * USDC_SCALE / rate) : 0;
    const required = Math.max(minimumUnits, debt);
    const balance = balances[index] || 0;
    return { id: member.id, units: required - balance };
  }).filter(item => item.units > 0);
}
