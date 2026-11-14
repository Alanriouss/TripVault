  function fujiSettlementSummary(trip, vault) {
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
      <div><h3>What each person gets back</h3>${rows}</div>`;
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

  function fujiPanel(section = 'wallet') {
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
    if (!account) {
      controls = btn('Connect Wallet', 'fuji-connect', { disabled: busy });
    } else {
      content = row(userText(name), onFuji ? 'Avalanche Fuji' : 'Wrong network', safe(account));
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
      content += row('Trip fund address',
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
      content += row('Your balance in the trip fund', money(vault.balances[index]));

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
        content += fujiSettlementSummary(trip, vault);
      } else if (!expired && !vault.cancelled && now < vault.end) {
        content += '<p class="notice">The organizer can share the final amounts for approval when the trip ends.</p>';
      } else if (!expired && !vault.cancelled) {
        if (hasPlan) {
          content += vault.members.map((member, position) => {
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
          content += '<p class="notice">Check your amount, approve it, and top up if needed. Once everyone is ready, the organizer can make the group payments.</p>';
        } else {
          content += '<p class="notice">The trip has ended. The organizer can calculate who pays whom below and share the amounts for approval.</p>';
        }
        if (index === 0 && (!hasPlan || stalePlan) && fujiDraft(trip)) {
          controls += btn(hasPlan ? 'Review updated amounts' : 'Review payment amounts', 'fuji-plan', { disabled });
        }
        if (hasPlan) {
          const hash = 'data-hash="' + safe(vault.hash) + '"';
          const approved = vault.approvals[index];
          if (approved) utilities += btn('Undo my approval', 'fuji-revoke', { data: hash, tone: 'danger cancel-approval', disabled });
          else controls += btn('Approve my amount', 'fuji-approve', { data: hash, disabled: disabled || stalePlan });
          if (shortage > 0 && !stalePlan) {
            controls += btn('Top up ' + money(shortage), 'fuji-top-up', {
              data: hash + ' data-units="' + shortage + '"', disabled,
            });
          }
          if (index === 0) {
            controls += btn('Make group payments', 'fuji-settle', {
              data: hash, disabled: disabled || stalePlan || !vault.approvals.every(Boolean)
                || vault.members.some((_, position) => fujiShortfall(vault, position) > 0),
            });
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
    if (account) utilities += btn('Disconnect wallet', 'fuji-disconnect', { tone: 'ghost', disabled: busy });
    return `<section class="panel stack">
      <div><h2>${section === 'split' ? 'Group payments' : 'Wallet and trip fund'}</h2>
        <p class="subtitle">${trip?.shared ? 'This trip uses test USDC on Avalanche Fuji.' : 'Transactions use test USDC on Avalanche Fuji. Local demo balances are separate.'}</p>
      </div>
      ${content}
      ${controls ? '<div class="inline wallet-actions">' + controls + '</div>' : ''}
      ${fujiTransactionCard(trip)}
      ${utilities ? '<div class="inline wallet-utilities">' + utilities + '</div>' : ''}
    </section>`;
  }
