  const TRIP_PROGRESS_STEPS = ['Set up', 'Add funds', 'Record bills', 'Final payments', 'Done'];

  function tripProgress(trip) {
    if (isDemoTrip(trip)) return demoTripProgress(trip);
    const vault = currentVault();
    const funding = getDisplayedFunding(trip);
    const organizer = isRoomOrganizer(trip);
    const end = vault ? vault.end * 1000 : roomEndTime(trip);
    const now = vault ? vault.timestamp * 1000 : Date.now();
    const ended = Boolean(trip.endedAt) || (funding?.ended ?? (now >= end));
    const pendingBills = trip.bills.filter(bill => !['approved', 'rejected'].includes(bill.status)).length;

    if (roomFundingCancelled(trip)) {
      return { step: 4, title: 'Trip cancelled',
        message: trip.fuji?.address ? 'Someone was below the minimum at the deadline. Open Wallet to take back your deposit.'
          : 'The deposit deadline passed without a linked trip fund.', view: 'wallet' };
    }
    if (trip.settled || vault?.settled) {
      const index = vault?.members.indexOf(walletSession.account) ?? -1;
      return {
        step: 4, title: 'Group payments complete',
        message: vault?.settled && index >= 0 && vault.balances[index] === 0 ? 'Your balance in the trip fund is zero.'
          : 'Open Wallet to send any remaining balance to your wallet.',
        view: 'wallet',
      };
    }
    if ((vault && vault.timestamp >= vault.refundDeadline) || funding?.closed) {
      return { step: 4, title: 'Payment window closed', message: 'Open Wallet to check what you can take back.', view: 'wallet' };
    }
    if (!trip.fuji?.address) {
      if (!trip.locked && !ended) {
        return { step: 0, title: 'Invite your group',
          message: organizer ? 'Share the invite link or six-digit code below.'
            : 'The organizer sets up the trip fund once everyone has joined.',
          view: organizer ? 'wallet' : 'people',
          shortcut: organizer ? 'Go to vault setup' : 'View members',
          focus: organizer ? 'fuji-deploy' : '' };
      }
      return { step: 0, title: 'Set up the trip fund',
        message: organizer ? 'Open Wallet to create or link the fund for this trip.'
          : 'Waiting for the organizer to set up the trip fund.', view: 'wallet',
        shortcut: organizer ? 'Go to vault setup' : '',
        focus: organizer ? 'fuji-deploy' : '' };
    }

    if (!ended) {
      const balances = funding?.balances || vault?.balances;
      if (!balances) {
        return { step: 1, title: 'Check group deposits',
          message: funding?.failed ? 'Could not check balances. Open Wallet to refresh.' : 'Checking who has added the minimum.',
          view: 'wallet' };
      }
      const funded = balances.filter(units => units >= trip.minimumUnits).length;
      const needsTopUp = funding?.rate && roomFundingShortfalls(trip, funding).length > 0;
      if (funded < trip.members.length || needsTopUp) {
        return { step: 1, title: funded < trip.members.length ? 'Waiting for deposits' : 'Waiting for top-ups',
          message: funded < trip.members.length
            ? `${funded} of ${trip.members.length} members have added at least ${money(trip.minimumUnits)}.`
            : 'Someone needs to add funds before the group can save more bills.', view: 'wallet' };
      }
      if (trip.depositDeadline && !(funding?.started ?? (now >= Date.parse(trip.startTime)))) {
        return { step: 1, title: funding?.deadlineReached ? 'Trip confirmed' : 'Minimum deposits reached',
          message: funding?.deadlineReached ? 'The trip will begin at its scheduled start.'
            : 'Everyone has added the minimum. Deposits are checked again at the deadline.', view: 'wallet' };
      }
      return { step: 2, title: 'Record shared expenses',
        message: pendingBills ? `${pendingBills} ${pendingBills === 1 ? 'bill needs' : 'bills need'} approval.`
          : 'Add payments made outside TripVault as bills.', view: 'bills' };
    }

    if (pendingBills) {
      return { step: 3, title: 'Finish bill reviews',
        message: 'The trip has ended. Resolve any requested changes or removal requests before making final payments.', view: 'bills' };
    }
    if (!trip.reviewQuote || !trip.fuji.publishedRevision) {
      return { step: 3, title: 'Prepare final payments',
        message: organizer ? 'Open Final split to calculate and share what each person owes.'
          : 'Waiting for the organizer to share the final amounts.', view: 'split' };
    }
    if (!vault) {
      return { step: 3, title: 'Check final payments',
        message: 'Open Final split to check the latest approvals and top-ups.', view: 'split' };
    }
    if (!matchesFujiDraft(trip, vault)) {
      return { step: 3, title: 'Share updated amounts',
        message: organizer ? 'The amounts changed. Share the update in Final split.'
          : 'Waiting for the organizer to share the updated amounts.', view: 'split' };
    }

    const approved = vault.approvals.filter(Boolean).length;
    const short = vault.members.filter((_, index) => fujiShortfall(vault, index) > 0).length;
    if (approved < trip.members.length || short) {
      return { step: 3, title: 'Waiting for approvals or top-ups',
        message: `${approved} of ${trip.members.length} approved.` +
          (short ? ` ${short} ${short === 1 ? 'person still needs' : 'people still need'} to top up.` : ''),
        view: 'split' };
    }
    return { step: 3, title: 'Ready to make group payments',
      message: organizer ? 'Everyone is ready. Open Final split and choose Make group payments.'
        : 'Everyone is ready. The organizer can make the group payments.', view: 'split' };
  }

  function roomProgressPanel(trip) {
    const { step, title, message, view, shortcut, focus } = tripProgress(trip);
    const target = shortcut || { wallet: 'Open Wallet', bills: 'Open Bills', split: 'Open Final split' }[view];
    const nextAction = target ? btn(target, 'navigate', {
      data: `data-view="${view}"${focus ? ` data-focus="${focus}"` : ''}`,
    }) : '';
    const showEnd = showEarlyEndControl(trip);
    const canEnd = showEnd && canEndRoom(trip);
    const endAction = showEnd ? btn('End trip early', 'room-end', {
      tone: 'danger', disabled: !canEnd || walletSession.busy || trip.fuji?.lastTx?.phase === 'pending',
      data: canEnd ? '' : 'aria-describedby="trip-early-end-help"',
    }) : '';
    return `<section class="panel trip-progress" aria-labelledby="trip-progress-title">
      <h2 id="trip-progress-title">Trip progress</h2>
      <ol class="trip-progress-steps" aria-label="Trip steps">
        ${TRIP_PROGRESS_STEPS.map((label, index) => `<li${index === step ? ' aria-current="step"' : ''}>${label}</li>`).join('')}
      </ol>
      <div class="trip-progress-next">
        <div><h3>${title}</h3><p class="subtitle">${message}</p></div>
        ${nextAction || endAction ? `<div class="inline">${nextAction}${endAction}</div>` : ''}
      </div>
      ${showEnd && !canEnd ? '<p class="subtitle" id="trip-early-end-help">You can end the trip early once everyone has funded it and the trip starts.</p>' : ''}
    </section>`;
  }
