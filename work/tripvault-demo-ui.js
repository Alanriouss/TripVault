  // Demo uses the shared trip components, with local balances and actions.
  function demoTripProgress(trip) {
    if (trip.settled) return { step: 4, title: 'Group payments complete',
      message: 'Open Wallet to send any remaining balance to your wallet.', view: 'wallet' };
    if (Date.now() < Date.parse(trip.startTime)) return { step: 1, title: 'Check group deposits',
      message: 'Checking who has added the minimum.', view: 'wallet' };
    if (Date.now() < roomEndTime(trip)) return { step: 2, title: 'Record shared expenses',
      message: 'Add payments made outside TripVault as bills.', view: 'bills' };
    if (hasPendingBills(trip)) return { step: 3, title: 'Finish bill reviews',
      message: 'Finish open bill reviews before making final payments.', view: 'bills' };
    return { step: 3, title: trip.reviewQuote ? 'Check final payments' : 'Prepare final payments',
      message: trip.reviewQuote ? 'Open Final split to check the latest approvals and top-ups.'
        : 'Open Final split to calculate and share what each person owes.', view: 'split' };
  }

  function demoWallet(trip) {
    const myUnits = depositUnits(trip, state.actor);
    const funding = Date.now() < Date.parse(trip.startTime);
    return `<div class="stack">
      ${roomFundBalance(trip)}
      <section class="panel stack trip-settings-panel">
        <div><h2>Wallet and trip fund</h2><p class="subtitle">These are simulated member balances, not real connected wallets.</p></div>
        ${row('Your balance in the trip fund', money(myUnits), userText(member(state.actor).name))}
        ${row('Minimum each person adds', money(trip.minimumUnits))}
        ${row('Trip start', formatTripTimeSpacious(trip.startTime))}
        ${row('Trip end', formatTripTimeSpacious(trip.endTime))}
        <div class="inline wallet-actions">
          ${btn('Deposit USDC', 'deposit', { disabled: trip.settled })}
          ${btn('Early withdrawal', 'withdraw', { tone: 'secondary', disabled: !funding || myUnits <= 0 })}
          ${trip.settled ? btn('Claim refund', 'claim', { disabled: myUnits <= 0 }) : ''}
        </div>
        <p class="subtitle">Deposits lock after the start time. You can still top up. Early withdrawal is only possible before the start.</p>
      </section>
      <section class="panel"><h2>Funding progress</h2>
        ${trip.members.map(person => row(userText(person.name), money(depositUnits(trip, person.id)),
          depositUnits(trip, person.id) >= trip.minimumUnits ? 'Minimum reached' : 'Below minimum')).join('')}
      </section>
      ${demoMemberControls()}
    </div>`;
  }

  function demoMemberControls() {
    return `<section class="panel stack"><div><h2>Demo member</h2>
      <p class="subtitle">These are simulated member balances, not real connected wallets.</p></div>
      ${row('Previewing as', userText(member(state.actor).name))}
      <div class="inline">${btn('Switch demo member', 'switch-member', { tone: 'secondary' })}
        ${btn('Reset demo', 'judge-demo-sample', { tone: 'ghost' })}</div>
    </section>`;
  }

  function demoPaymentsPanel(trip, plan) {
    const pending = hasPendingBills(trip);
    const quote = trip.reviewQuote;
    const approved = trip.splitApprovals.includes(state.actor);
    const organizer = state.actor === trip.owner;
    const ended = Date.now() >= roomEndTime(trip);
    let message = '';
    let actions = '';
    let utilities = '';
    if (trip.settled) {
      message = '<p class="subtitle">Demo settlement completed. Claim remaining USDC in Wallet.</p>';
      actions = btn('Open Wallet', 'navigate', { data: 'data-view="wallet"' });
    } else if (!ended) {
      message = '<p class="subtitle">Group payments can start after the trip ends.</p>';
    } else if (pending) {
      message = '<p class="subtitle">Finish open bill reviews before making final payments.</p>';
      actions = btn('Review open bills', 'navigate', { data: 'data-view="bills"' });
    } else if (!quote) {
      message = '<p class="subtitle">The organizer prepares the split and locks the rate for approval.</p>';
      if (organizer) actions = btn('Calculate final amounts', 'prepare-split', { disabled: preparingTrip === trip });
    } else {
      message = `<p class="subtitle">${trip.splitApprovals.length} of ${trip.members.length} approved.</p>`;
      actions = approved ? '' : btn('Approve my amount', 'approve-split', { disabled: plan.invalid });
      if (approved) utilities += btn('Undo my approval', 'revoke-split', { tone: 'danger cancel-approval' });
      const shortfall = plan.shortfalls.find(person => person.id === state.actor);
      if (shortfall) actions += btn('Top up ' + money(shortfall.units), 'quick-top-up', {
        data: `data-trip="${safe(trip.id)}" data-member="${safe(state.actor)}" data-revision="${trip.revision}" data-units="${shortfall.units}"`,
      });
      if (organizer) {
        actions += btn('Make group payments', 'settle', { disabled: !canSettle(trip, plan) });
        utilities += btn('Start a new review', 'reopen-split', { tone: 'ghost' });
      }
      if (plan.shortfalls.length) message += `<p class="subtitle">Top up the following balances before settlement.</p>
        ${plan.shortfalls.map(person => row(userText(member(person.id).name), money(person.units))).join('')}`;
      if (plan.invalid) message += '<p class="notice warn">The current transfers cannot be represented in USDC. Reopen the split and check the rate before settling.</p>';
    }
    const me = stats(trip).find(person => person.id === state.actor);
    return `<section class="panel stack split-payment" aria-labelledby="split-payment-title">
      <h2 id="split-payment-title">Group payments</h2>
      ${quote ? `<div class="split-amount"><span>Your amount</span><strong>${vnd(me.net)}</strong></div>` : ''}
      ${message}
      ${actions ? '<div class="inline split-actions">' + actions + '</div>' : ''}
      ${quote ? finalSplitDetails('approvals', 'Member approvals', trip.members.map(person => row(userText(person.name),
        trip.splitApprovals.includes(person.id) ? 'Approved' : 'Waiting for approval')).join('')) : ''}
      ${utilities ? '<div class="inline split-utilities">' + utilities + '</div>' : ''}
      <p class="subtitle">These are simulated member balances, not real connected wallets.</p>
    </section>`;
  }
