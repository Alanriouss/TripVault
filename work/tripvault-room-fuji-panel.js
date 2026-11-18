  function fujiSettlementSummary(trip, vault, compact = false) {
    const settlement = trip.fuji?.settlementTx;
    const explorerLink = isHash(settlement)
      ? ` <a href="${FUJI.explorer}/tx/${settlement}" target="_blank" rel="noopener noreferrer">View settlement on Fuji</a>` : '';
    const rows = vault.members.map((address, position) => {
      const remaining = vault.balances[position];
      const allocation = vault.payouts?.[position];
      const net = vault.net[position] || 0;
      const label = userText(trip.members[position]?.name || address);
      const summary = allocation === undefined
        ? (remaining > 0 ? 'Available to claim' : 'No balance left to claim')
        : allocation === 0 ? 'No payout'
          : remaining > 0 ? 'Available to claim · ' + money(remaining)
            : 'Claimed · ' + money(allocation);
      const distribution = allocation === undefined ? ''
        : 'Deposited ' + money(allocation - net) + ' · ' +
          (net > 0 ? 'Receives ' : net < 0 ? 'Pays ' : 'Net ') + money(Math.abs(net)) + ' · ';
      return row(label, money(allocation ?? remaining), distribution + summary);
    }).join('');
    return `<p class="notice green">Group payments are complete. Each person can move their remaining test USDC to their wallet.${explorerLink}</p>
      ${compact ? finalSplitDetails('payouts', 'What each person gets back', rows)
        : '<div><h3>What each person gets back</h3>' + rows + '</div>'}`;
  }

  function fujiWithdrawalDeadline(vault) {
    return Math.min(vault.depositDeadline || vault.start, vault.end);
  }

  function canDepositFuji(vault) {
    return !vault.settled && !vault.cancelled && vault.timestamp < vault.refundDeadline
      && (!vault.depositDeadline || vault.timestamp < vault.depositDeadline || vault.timestamp >= vault.start);
  }

  function fujiPaymentAmount(units) {
    return units < 0 ? 'Pays ' + money(-units) : units > 0 ? 'Gets ' + money(units) : 'No payment';
  }

  function canWithdrawFuji(vault, index) {
    return Boolean(vault && index >= 0 && !vault.settled && vault.balances[index] > 0
      && vault.timestamp < fujiWithdrawalDeadline(vault));
  }

  function fujiDepositTiming(vault) {
    if (vault.timestamp < fujiWithdrawalDeadline(vault)) {
      const deadline = safe(formatTripTime(fujiWithdrawalDeadline(vault) * 1000));
      return `<p class="notice">Add at least <strong>${money(vault.minimum)}</strong> by <strong>${deadline}</strong>.
        You can take back your own deposit before then.</p>`;
    }
    if (vault.timestamp < vault.end) {
      if (vault.depositDeadline && vault.timestamp < vault.start) {
        return '<p class="notice">The trip is confirmed. Deposits are locked until the scheduled start, when top-ups open.</p>';
      }
      return '<p class="notice">Withdrawals are locked. You can still add USDC if you need to top up.</p>';
    }
    return '<p class="notice">The trip has ended. Withdrawals stay locked while the group reviews payments. You can still top up.</p>';
  }

  let refreshingTripStatus;

  async function refreshTripStatus() {
    if (refreshingTripStatus || walletSession.busy) return;
    const trip = state.trip;
    const account = walletSession.account;
    refreshingTripStatus = { id: trip?.id, account };
    render();
    try {
      const roomOk = !trip?.shared || await syncRooms();
      if (state.trip?.id !== trip?.id || walletSession.account !== account) return;
      const fundingRequired = trip?.shared && rooms.token && !state.trip?.settled;
      const [vaultOk, fundingOk] = await Promise.all([
        refreshVault(), fundingRequired ? refreshRoomFunding() : true,
      ]);
      if (state.trip?.id !== trip?.id || walletSession.account !== account) return;
      notice(roomOk && vaultOk && fundingOk ? 'Trip status updated.' : 'Could not fully refresh trip status. Try again.');
    } finally {
      refreshingTripStatus = null;
      render();
    }
  }

  function finalSplitDetails(key, title, content) {
    return `<details class="split-details" data-split-detail="${key}">
      <summary>${title}</summary><div class="split-detail-body">${content}</div>
    </details>`;
  }

  function finalSplitReview(trip, plan) {
    const review = { message: '', action: '', secondary: '' };
    if (trip.settled || roomFundingCancelled(trip) || (!trip.fuji?.address && trip.depositDeadline)) return review;
    const vault = currentVault();
    if (vault && (vault.settled || vault.cancelled || vault.timestamp >= vault.refundDeadline)) return review;

    if (!roomBillsClosed(trip)) {
      review.message = `<p class="subtitle">Group payments can start after the trip ends.</p>
        <p class="split-date">${safe(formatTripTime(roomEndTime(trip)))}</p>`;
    } else if (hasPendingBills(trip)) {
      review.message = '<p class="notice warn">Finish open bill reviews before making final payments.</p>';
      review.action = btn('Review open bills', 'navigate', { data: 'data-view="bills"' });
    } else if (!trip.reviewQuote) {
      review.message = '<p class="subtitle">The organizer prepares the split and locks the rate for approval.</p>';
      if (canPrepare(trip)) {
        const fetching = preparingTrip === trip;
        review.action = btn(fetching ? 'Checking exchange rate…' : 'Calculate final amounts', 'prepare-split', { disabled: fetching });
      }
      if (canUseFallback(fallbackReview)) {
        review.message = `<div class="notice warn">
          <p>Market rate unavailable. You can retry or prepare the split with this reference.</p>
          <p>${safe(fxLabel(fallbackReview.quote))}</p>
        </div>`;
        review.secondary = btn('Use fallback rate', 'use-fallback', { tone: 'secondary' });
      }
    } else {
      if (plan.invalid) review.message = '<p class="notice warn">The current transfers cannot be represented in USDC. Reopen the split and check the rate before settling.</p>';
      else if (vault && !vault.net.length && state.actor !== trip.owner) {
        review.message = '<p class="subtitle">Waiting for the organizer to share the final amounts.</p>';
      }
      if (state.actor === trip.owner) review.secondary = btn('Start a new review', 'reopen-split', { tone: 'ghost' });
    }
    return review;
  }

  function roomFinalSplit(trip) {
    const vault = currentVault();
    const quote = trip.reviewQuote;
    const rate = quote || fx;
    const plan = settlementPlan(trip, rate);
    const settled = trip.settled || vault?.settled;
    const published = vault && matchesFujiDraft(trip, vault);
    const hasApprovedBills = trip.bills.some(bill => bill.status === 'approved');
    const transfers = plan.transfers.map(transfer => row(
      userText(member(transfer.from).name) + ' → ' + userText(member(transfer.to).name),
      money(transfer.units), vnd(transfer.vnd) + ' equivalent',
    )).join('');
    const people = stats(trip).map(person => row(userText(person.name), vnd(person.net),
      'Paid ' + vnd(person.paid) + ' · Owes ' + vnd(person.owed),
    )).join('');
    const rateStatus = quote ? (quote.historical ? 'Historical rate' : 'Locked for approval') : 'Estimate';
    return `<div class="section-head">
      <div><h1>Final split</h1><p>${userText(trip.name)}</p></div>
      ${settled || published ? `<span class="chip violet">${settled ? 'Settled' : 'In review'}</span>` : ''}
    </div>
    <div class="stack room-final-split" data-split-trip="${safe(trip.id)}">
      ${fujiPanel('split', finalSplitReview(trip, plan))}
      <section class="panel stack split-breakdown">
        ${!settled && !hasApprovedBills ? `<div>
          <h2>Nothing to split yet</h2>
          <p class="subtitle">${trip.bills.length ? 'Review open bills before splitting expenses.' : 'Expenses will appear here after a bill is approved.'}</p>
          ${btn('Go to Bills', 'navigate', { tone: 'secondary', data: 'data-view="bills"' })}
        </div>` : ''}
        ${!settled && hasApprovedBills ? `<div class="panel-head"><h2>Who pays whom</h2>${transfers && !published ? '<span class="chip">Estimate</span>' : ''}</div>
          ${plan.invalid ? '<p class="subtitle">Payment amounts are unavailable.</p>'
            : transfers ? '<div>' + transfers + '</div>' : '<p class="subtitle">No transfers needed yet.</p>'}` : ''}
        ${hasApprovedBills ? finalSplitDetails('expenses', 'Expense breakdown', people) : ''}
        ${finalSplitDetails('rate', 'Exchange rate', `<p class="subtitle"><strong>${rateStatus}</strong></p><div class="split-rate">${fxRowValue(rate)}</div>`)}
      </section>
    </div>`;
  }

  function fujiPanel(section = 'wallet', review = null) {
    const trip = state.trip;
    const { account, chain, name, busy } = walletSession;
    const onFuji = chain === FUJI.id;
    const pending = trip?.fuji?.lastTx?.phase === 'pending';
    const disabled = busy || pending;
    const vault = currentVault();
    const index = vault?.members.indexOf(account) ?? -1;
    const address = trip?.fuji?.address;
    const organizer = Boolean(trip && state.actor === trip.owner);
    let controls = '';
    let utilities = '';
    let content = '';
    let walletDetails = '';
    let paymentDetails = '';
    let secondaryActions = '';
    let personalAmount = '';
    if (!account) {
      controls = btn('Connect Wallet', 'fuji-connect', { disabled: busy });
    } else {
      walletDetails = row(userText(name), onFuji ? 'Avalanche Fuji' : 'Wrong network', safe(account));
      if (!onFuji) controls = btn('Switch to Fuji', 'fuji-switch', { disabled: busy });
      if (onFuji && address) {
        const refreshing = refreshingTripStatus?.id === trip?.id && refreshingTripStatus?.account === account;
        utilities = btn(refreshing ? 'Updating status…' : section === 'split' ? 'Refresh status' : 'Refresh balances',
          'fuji-refresh', { tone: 'ghost', disabled: busy || refreshing });
      }
    }
    if (pending && account && onFuji) controls += btn('Check transaction', 'fuji-check', { disabled: busy });

    if (trip?.shared && !address) {
      const ready = Boolean(account && onFuji && organizer);
      const deadlinePassed = roomDeadlinePassed(trip);
      const displayed = walletSession.status;
      const deployment = displayed?.tripId === trip.id && displayed.label === 'Deploy Fuji vault' ? displayed : trip.fuji?.lastTx;
      const canRetry = deployment && (deployment.kind === 'deploy' || deployment.label === 'Deploy Fuji vault')
        && ['rejected', 'failed'].includes(deployment.phase);
      const status = deadlinePassed ? 'The deposit deadline passed. You can link a vault created on time or start a new room with a new deadline.'
        : organizer
        ? (pending ? 'Wait for the deployment to be confirmed before members can deposit.'
          : 'Deploy and link the Fuji vault so every member can deposit test USDC.')
        : 'Waiting for the organizer to deploy and link the Fuji vault. Deposit will unlock here for your wallet.';
      content += '<p class="notice">' + status + '</p>';
      if (ready && !pending) {
        if (!deadlinePassed) controls += btn(canRetry ? 'Retry deploy vault' : 'Deploy Fuji vault', 'fuji-deploy', { disabled: busy });
        if (trip.locked) utilities += btn('Link existing vault', 'fuji-link', { tone: 'secondary', disabled: busy });
      }
      if (deadlinePassed && isRoomOrganizer(trip)) {
        controls += btn('Create new room from this trip', 'room-replace-expired', { disabled: busy });
      }
      if (section === 'wallet') controls += btn('Deposit test USDC', 'fuji-deposit', { disabled: true });
    } else if (!address && account && onFuji && !pending && organizer && section === 'wallet') {
      controls += btn('Deploy Fuji vault', 'fuji-deploy', { disabled });
    }

    if (isAddress(address)) {
      walletDetails += row('Trip fund address',
        `<a href="${FUJI.explorer}/address/${safe(address)}" target="_blank" rel="noopener noreferrer">View on Fuji</a>`,
        safe(address),
      );
      if (!vault) {
        const message = account && onFuji ? 'Loading the trip fund. Try refreshing if it takes a moment.'
          : 'Connect your wallet to view the trip fund.';
        content += '<p class="notice">' + message + '</p>';
        if (section === 'wallet') controls += btn('Deposit test USDC', 'fuji-deposit', { disabled: true });
      }
    }
    if (vault && index < 0) {
      content += '<p class="notice warn">This wallet is not a member of the vault. Switch accounts in your wallet.</p>';
    } else if (vault && index >= 0) {
      const now = vault.timestamp;
      const expired = now >= vault.refundDeadline;
      const hasPlan = vault.net.length > 0;
      const stalePlan = hasPlan && !matchesFujiDraft(trip, vault);
      const shortage = fujiShortfall(vault, index);
      walletDetails += row('Your balance in the trip fund', money(vault.balances[index]));

      if (section === 'wallet') {
        if (vault.usdc <= BigInt(Number.MAX_SAFE_INTEGER)) {
          content += row('Test USDC in your wallet', money(Number(vault.usdc)));
        }
        if (!vault.settled && !expired && !vault.cancelled) {
          const status = walletSession.status;
          if (canDepositFuji(vault) && (vault.usdc === 0n || (status?.tripId === trip.id && status.message?.includes('Circle faucet')))) {
            content += fujiFaucetNotice();
          }
          if (canDepositFuji(vault)) controls += btn('Deposit test USDC', 'fuji-deposit', { disabled });
          content += fujiDepositTiming(vault);
        }
        if (canWithdrawFuji(vault, index)) {
          controls += btn('Withdraw my deposit', 'fuji-withdraw', { tone: 'secondary', disabled });
        }
      } else if (vault.settled) {
        content += fujiSettlementSummary(trip, vault, Boolean(review));
      } else if (!expired && !vault.cancelled && now < vault.end) {
        if (!review) content += '<p class="notice">The organizer can share the final amounts for approval when the trip ends.</p>';
      } else if (!expired && !vault.cancelled) {
        if (hasPlan) {
          paymentDetails = vault.members.map((member, position) => {
            const amount = vault.net[position];
            const due = fujiShortfall(vault, position);
            const status = vault.approvals[position] ? 'Approved' : 'Waiting for approval';
            return row(userText(trip.members[position]?.name || member), fujiPaymentAmount(amount),
              status + (due > 0 ? ' · Top up ' + money(due) : ''),
            );
          }).join('');
        }
        if (stalePlan) {
          content += '<p class="notice warn">The amounts have changed. The organizer needs to share the updated amounts for approval.</p>';
        } else if (hasPlan) {
          if (review) {
            const count = vault.approvals.filter(Boolean).length;
            content += `<p class="subtitle">${count} of ${vault.members.length} approved.</p>`;
            if (vault.approvals[index] && shortage === 0) {
              const ready = count === vault.members.length
                && vault.members.every((_, position) => fujiShortfall(vault, position) === 0);
              if (!ready) content += '<p class="subtitle">Waiting for other members to approve or top up.</p>';
              else if (index !== 0) content += '<p class="subtitle">The organizer can make the group payments now.</p>';
            }
            personalAmount = `<div class="split-amount"><span>Your amount</span><strong>${fujiPaymentAmount(vault.net[index])}</strong></div>`;
          } else {
            content += '<p class="notice">Check your amount, approve it, and top up if needed. Once everyone is ready, the organizer can make the group payments.</p>';
          }
        } else if (!review) {
          content += '<p class="notice">The trip has ended. The organizer can calculate who pays whom below and share the amounts for approval.</p>';
        }
        if (index === 0 && (!hasPlan || stalePlan) && fujiDraft(trip)) {
          controls += btn(hasPlan ? 'Review updated amounts' : 'Review payment amounts', 'fuji-plan', { disabled });
        }
        if (hasPlan) {
          const hash = 'data-hash="' + safe(vault.hash) + '"';
          const approved = vault.approvals[index];
          if (approved) secondaryActions += btn('Undo my approval', 'fuji-revoke', { data: hash, tone: 'danger cancel-approval', disabled });
          else if (!review || !stalePlan) controls += btn('Approve my amount', 'fuji-approve', { data: hash, disabled: disabled || stalePlan });
          if (shortage > 0 && !stalePlan) {
            controls += btn('Top up ' + money(shortage), 'fuji-top-up', {
              data: hash + ' data-units="' + shortage + '"', disabled,
            });
          }
          if (index === 0) {
            const ready = !stalePlan && vault.approvals.every(Boolean)
              && vault.members.every((_, position) => fujiShortfall(vault, position) === 0);
            if (!review || ready) controls += btn('Make group payments', 'fuji-settle', { data: hash, disabled: disabled || !ready });
          }
        }
      }
      if (vault.cancelled) {
        content += '<p class="notice warn">Trip cancelled. At least one person was below the minimum at the deposit deadline. Each person can take back their own deposit.</p>';
      } else if (expired && !vault.settled) {
        content += '<p class="notice">The time to make group payments has passed. Each person can take back their own deposit.</p>';
      }
      if ((vault.settled || expired || vault.cancelled) && vault.balances[index] > 0) {
        controls += btn('Send ' + money(vault.balances[index]) + ' to my wallet', 'fuji-claim', { disabled });
      }
    }
    const disconnect = account ? btn('Disconnect wallet', 'fuji-disconnect', { tone: 'ghost', disabled: busy }) : '';
    if (review) {
      const visible = walletSession.status?.tripId === trip.id ? walletSession.status : trip.fuji?.lastTx;
      const transaction = fujiTransactionCard(trip);
      const confirmed = visible?.phase === 'confirmed';
      const details = '<p class="subtitle">This trip uses test USDC on Avalanche Fuji.</p>'
        + walletDetails + (confirmed ? transaction : '') + (disconnect ? '<div class="inline">' + disconnect + '</div>' : '');
      const actions = review.action + controls;
      return `<section class="panel stack split-payment" aria-labelledby="split-payment-title">
        <h2 id="split-payment-title">Group payments</h2>
        ${personalAmount}${review.message}${content}
        ${actions ? '<div class="inline split-actions">' + actions + '</div>' : ''}
        ${confirmed ? '' : transaction}
        ${paymentDetails ? finalSplitDetails('approvals', 'Member approvals', paymentDetails) : ''}
        ${secondaryActions || utilities || review.secondary ? '<div class="inline split-utilities">' + secondaryActions + utilities + review.secondary + '</div>' : ''}
        ${finalSplitDetails('wallet', 'Wallet and transaction details', details)}
      </section>`;
    }
    utilities = secondaryActions + utilities + disconnect;
    return `<section class="panel stack">
      <div><h2>${section === 'split' ? 'Group payments' : 'Wallet and trip fund'}</h2>
        <p class="subtitle">${trip?.shared ? 'This trip uses test USDC on Avalanche Fuji.' : 'Transactions use test USDC on Avalanche Fuji. Local demo balances are separate.'}</p>
      </div>
      ${walletDetails}${paymentDetails}${content}
      ${controls ? '<div class="inline wallet-actions">' + controls + '</div>' : ''}
      ${fujiTransactionCard(trip)}
      ${utilities ? '<div class="inline wallet-utilities">' + utilities + '</div>' : ''}
    </section>`;
  }
