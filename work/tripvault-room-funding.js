export function roomFundingShortfalls(trip, funding, draft) {
  const net = new Map(trip.members.map(member => [member.id, 0]));
  const bills = draft ? [...trip.bills, draft] : trip.bills;
  for (const bill of bills) {
    if (bill.status === 'rejected') continue;
    const count = bill.participants.length;
    const isCustom = bill.splitType === 'custom' && bill.customShares && typeof bill.customShares === 'object';
    const share = Math.floor(bill.amount / count);
    const remainder = bill.amount % count;
    const payerShare = bill.participants.indexOf(bill.payer);
    if (bill.status === 'approved') {
      net.set(bill.payer, net.get(bill.payer) + bill.amount);
    }
    for (const [index, id] of bill.participants.entries()) {
      // Reserve pending debts without relying on credits that are still unapproved.
      if (bill.status !== 'approved' && index === payerShare) continue;
      const amountOwed = isCustom ? (Math.round(Number(bill.customShares[id])) || 0) : (share + (index < remainder ? 1 : 0));
      net.set(id, net.get(id) - amountOwed);
    }
  }
  return trip.members.map((member, index) => {
    const debt = funding.rate ? Math.ceil(Math.max(0, -net.get(member.id)) * 1_000_000 / funding.rate) : 0;
    const required = Math.max(trip.minimumUnits, debt);
    return { id: member.id, units: required - funding.balances[index] };
  }).filter(item => item.units > 0);
}
