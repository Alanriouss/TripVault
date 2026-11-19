  // Demo uses the shared trip components, with local balances and actions.
  const standaloneDemo = false;

  function demoExitUrl() {
    return standaloneDemo ? 'https://test-public-zeta.vercel.app/' : '/';
  }

  function demoModeBanner() {
    return demoMode ? `<section class="demo-mode-banner" aria-label="${ui('Demo trip')}">
      <div><strong>Demo trip</strong><p>Changes here only affect this sample trip. All trips returns to wallet-connected mode.</p></div>
    </section>` : '';
  }

  function openDemoTrip() {
    const sample = state.trips.find(trip => trip.id === 'judges-sample');
    if (!sample) return startJudgeSample();
    state.trip = sample;
    state.actor = sample.members.some(person => person.id === state.actor) ? state.actor : sample.owner;
    commit(sample);
  }

  function addDemoMemberForm() {
    const trip = state.trip;
    if (!isDemoTrip(trip) || trip.locked || roomDeadlinePassed(trip) || trip.members.length >= 12) return;
    sheetOpen('Add demo member', { user: trip.name },
      `<form class="stack" id="demo-member-form">
        <label class="field">Your display name<input name="displayName" maxlength="40" required autofocus></label>
        <p id="sheet-error" class="form-error" role="status"></p>
      </form>`, '<button class="btn full" type="submit" form="demo-member-form">Add demo member</button>');
  }

  function submitDemoMember(data, fail) {
    const trip = state.trip;
    if (!isDemoTrip(trip) || trip.locked || roomDeadlinePassed(trip) || trip.members.length >= 12) return fail('This action is unavailable.');
    const name = String(data.get('displayName') || '').trim();
    if (!name || name.length > 40) return fail('Enter a valid display name.');
    const id = 'm' + trip.members.length;
    trip.members.push({ id, name, joinedAt: Date.now() });
    trip.depositUnits[id] = 0;
    if (sheet.open) sheet.close();
    commit(trip, 'Demo member added.');
  }

  function isDemoTrip(trip = state.trip) {
    return Boolean(trip && !trip.shared && (demoMode || trip.demoVersion === 2
      || trip.id === 'judges-sample' || (!trip.fuji && !walletSession.account)));
  }

  function demoFundReady(trip) {
    return trip.demoFundReady !== false;
  }

  function demoFunding(trip) {
    const now = Date.now();
    const balances = trip.members.map(person => depositUnits(trip, person.id));
    const deadlineReached = Boolean(trip.depositDeadline && now >= Date.parse(trip.depositDeadline));
    const cancelled = Boolean(trip.demoCancelled || (!trip.settled && deadlineReached &&
      (!demoFundReady(trip) || balances.some(units => units < trip.minimumUnits))));
    return { balances, rate: (trip.reviewQuote || fx).rate, cancelled, deadlineReached,
      started: now >= Date.parse(trip.startTime) && !cancelled,
      ended: now >= roomEndTime(trip),
      closed: cancelled || trip.settled || now >= roomEndTime(trip) + 7 * 86_400_000 };
  }

  function refreshDemoState(trip) {
    if (!isDemoTrip(trip)) return;
    let changed = false;
    if (!trip.billsClosedAt && roomEndTime(trip) <= Date.now()) {
      trip.billsClosedAt = new Date(roomEndTime(trip)).toISOString();
      changed = true;
    }
    if (demoFunding(trip).cancelled && !trip.demoCancelled) { trip.demoCancelled = true; changed = true; }
    for (const bill of trip.bills) {
      if (bill.status !== 'pending' || !bill.reviewBy || bill.reviewBy > Date.now() || trip.settled || trip.reviewQuote) continue;
      bill.autoApprovals = bill.participants.filter(id => !bill.approvals.includes(id));
      bill.approvals = [...new Set([...bill.approvals, ...bill.participants])];
      bill.status = 'approved';
      invalidateSplit(trip);
      changed = true;
    }
    if (changed) save(trip);
  }

  function changeDemoTrip(trip, type, fields = {}, completed, fail = notice) {
    if (type.startsWith('bill.')) return changeDemoBill(trip, type, fields, completed, fail);
    const owner = state.actor === trip.owner;
    if (type === 'room.rename-member') {
      const name = String(fields.name || '').trim();
      if (!name || name.length > 40) return fail('Enter a valid display name.');
      member(state.actor).name = name;
    } else if (type === 'room.rename') {
      if (!canRenameTrip(trip)) return fail('The trip name can only be changed before the deposit deadline.');
      const name = String(fields.name || '').trim();
      if (!name || name.length > 70) return fail('Enter a valid trip name.');
      trip.name = name;
    } else if (type === 'room.end') {
      if (!owner || !canEndRoom(trip)) return fail('This trip cannot be ended early.');
      trip.endedAt = new Date(Date.now()).toISOString();
      trip.billsClosedAt = trip.endedAt;
    } else return fail('This action is unavailable.');
    commit(trip);
    completed?.(trip);
    return trip;
  }

  function handleDemoAction(action, selection = {}) {
    const trip = state.trip;
    if (!isDemoTrip(trip)) return;
    if (action === 'demo-add-member') return addDemoMemberForm();
    if (action === 'demo-deploy') {
      if (state.actor !== trip.owner || roomDeadlinePassed(trip)) return;
      return sheetOpen('Lock room roster', { user: trip.name },
        '<p class="notice">Lock the member list when everyone has joined. The Fuji vault uses these wallet addresses, and new members cannot join after locking.</p>' + roomMembers(trip),
        btn('Lock roster', 'demo-deploy-confirm', { tone: 'full' }));
    } else if (action === 'demo-deploy-confirm') {
      if (state.actor !== trip.owner || roomDeadlinePassed(trip)) return;
      if (sheet.open) sheet.close();
      trip.demoFundReady = true;
      trip.locked = true;
      trip.rosterLockedAt = Date.now();
      commit(trip, 'Vault verified and linked.');
    } else if (action === 'demo-refresh') {
      refreshDemoState(trip);
      render();
      notice('Trip status updated.');
    } else if (action === 'demo-review-plan') {
      if (state.actor !== trip.owner || !roomBillsClosed(trip) || !trip.reviewQuote || hasPendingBills(trip)) return;
      const draft = fujiDraft(trip);
      if (draft) paymentReviewSheet(trip, draft, 'demo-publish');
    } else if (action === 'demo-publish') {
      if (state.actor !== trip.owner || !trip.reviewQuote || hasPendingBills(trip)
        || String(trip.revision) !== selection.revision || !roomBillsClosed(trip)) return;
      trip.demoPublishedRevision = trip.revision;
      trip.demoPublishedAt = Date.now();
      trip.splitApprovals = [trip.owner];
      if (sheet.open) sheet.close();
      commit(trip);
    } else if (action === 'demo-start') {
      const funding = demoFunding(trip);
      if (state.actor !== trip.owner || !demoFundReady(trip) || funding.cancelled
        || funding.balances.some(units => units < trip.minimumUnits)) return;
      trip.depositDeadline = new Date(Date.now() - 120000).toISOString();
      trip.startTime = new Date(Date.now() - 60000).toISOString();
      commit(trip);
    }
  }

  function sendDemoReminder(trip, form) {
    if (form?.dataset.room !== trip.id || roomBillsClosed(trip)) return;
    const draft = readBillDraft(form);
    if (!draft?.label) return;
    const shortfalls = roomFundingShortfalls(trip, demoFunding(trip), draft).filter(item => item.id !== state.actor);
    for (const item of shortfalls) {
      const id = 'demo-reminder-' + Date.now() + '-' + item.id;
      const sameDraft = old => old.recipient === item.id && JSON.stringify(old.draft) === JSON.stringify(draft);
      trip.demoReminders = [...(trip.demoReminders || []).filter(old => !sameDraft(old)), {
        id, roomId: trip.id, recipient: item.id, units: item.units, draft,
        sender: member(state.actor).name, receivedAt: Date.now(),
      }];
    }
    save(trip);
    const feedback = form.querySelector('#bill-reminder-feedback');
    if (feedback) feedback.textContent = ui('Reminders sent in TripVault.');
    notice('Reminders sent in TripVault.');
  }

  function changeDemoBill(trip, type, fields, completed, fail) {
    refreshDemoState(trip);
    const actor = state.actor;
    const bill = trip.bills.find(item => item.id === fields.id);
    const creator = bill && (bill.createdBy || bill.payer);
    const voters = bill ? [...new Set([creator, bill.payer, ...bill.participants])] : [];
    const editable = bill && ['pending', 'disputed'].includes(bill.status);
    const reject = message => { fail(message); return null; };
    if (!trip.members.some(person => person.id === actor) || trip.settled || trip.reviewQuote) {
      return reject('This bill is closed for review.');
    }
    if (type !== 'bill.add' && (!bill || bill.status === 'rejected')) return reject('This bill is closed for review.');
    const stamp = Date.now();
    const eventId = () => 'demo-' + stamp + '-' + (trip.nextReviewEvent = (trip.nextReviewEvent || 0) + 1);
    const log = (kind, recipients, comment, id = eventId()) => {
      bill.notificationLog = [...(bill.notificationLog || []), {
        id, kind, actor, recipients: [...new Set(recipients)].filter(id => id !== actor),
        receivedAt: stamp, label: bill.label, comment,
      }].slice(-50);
    };
    const status = () => bill.cancellation ? 'cancellation' : bill.feedback?.length ? 'disputed'
      : bill.participants.every(id => bill.approvals.includes(id)) ? 'approved' : 'pending';
    if (type === 'bill.add' || type === 'bill.edit') {
      if (type === 'bill.edit' && (!editable || creator !== actor)) return reject('Only the bill creator can edit it.');
      const funding = roomBillFunding(trip, fields, type === 'bill.edit' ? bill.id : undefined);
      if (!funding.ready) return reject(funding.message);
      const next = {
        id: bill?.id ?? trip.nextBillId++, label: fields.label, amount: fields.amount, payer: fields.payer,
        participants: fields.participants, splitType: fields.splitType, customShares: fields.customShares,
        createdBy: actor, approvals: [], status: 'pending', reviewStartedAt: stamp, reviewBy: stamp + 86_400_000,
        feedbackLog: bill?.feedbackLog || [], notificationLog: bill?.notificationLog || [],
        history: bill ? [...(bill.history || []), {
          label: bill.label, amount: bill.amount, payer: bill.payer, feedback: bill.feedback || [],
        }].slice(-25) : [],
      };
      if (bill) trip.bills[trip.bills.indexOf(bill)] = next;
      else trip.bills.push(next);
    } else if (type === 'bill.feedback-vote') {
      const suggestion = bill.feedback?.find(item => item.id === fields.suggestion && item.author === fields.author);
      if (!editable || bill.status !== 'disputed' || !voters.includes(actor)
        || !suggestion || suggestion.author === actor || typeof fields.agree !== 'boolean') {
        return reject('This suggestion is closed for review.');
      }
      const responses = suggestion.responses || [];
      if (responses.find(item => item.member === actor)?.agree === fields.agree) return trip;
      suggestion.responses = [...responses.filter(item => item.member !== actor), { member: actor, agree: fields.agree }];
      log(fields.agree ? 'suggestion-agreed' : 'suggestion-disagreed', [suggestion.author, creator], suggestion.comment);
    } else if (type === 'bill.cancel') {
      if (!voters.includes(actor) || typeof fields.agree !== 'boolean') return reject('This bill is closed for review.');
      const existing = bill.cancellation;
      if (!fields.agree) {
        if (!existing) return reject('There is no request to remove this bill.');
        log('cancellation-declined', voters, existing.reason);
        delete bill.cancellation;
        bill.status = status();
        if (bill.status === 'pending') bill.reviewBy = stamp + 86_400_000;
      } else {
        if (!existing && (!String(fields.reason || '').trim() || String(fields.reason).length > 500)) {
          return reject('Enter a reason for cancellation.');
        }
        const cancellation = existing || { id: eventId(), previous: bill.status, votes: [],
          requestedBy: actor, reason: String(fields.reason).trim(), requestedAt: stamp };
        if (cancellation.votes.includes(actor)) return trip;
        cancellation.votes.push(actor);
        bill.cancellation = cancellation;
        bill.status = voters.every(id => cancellation.votes.includes(id)) ? 'rejected' : 'cancellation';
        if (!existing) log('cancellation-requested', trip.members.map(person => person.id), cancellation.reason, cancellation.id);
        if (bill.status === 'rejected') cancellation.resolvedAt = stamp;
      }
    } else if (type === 'bill.feedback' || type === 'bill.approve') {
      if (!bill.participants.includes(actor) || (!editable && !(type === 'bill.approve' && fields.approve === false && bill.status === 'approved'))) {
        return reject('This bill is closed for review.');
      }
      if (type === 'bill.feedback') {
        const comment = String(fields.comment || '').trim();
        if (!comment || comment.length > 500) return reject('Enter a reason or suggested change.');
        const active = bill.feedback || [];
        if (active.some(item => item.author === actor && item.comment === comment)) return trip;
        const feedback = { id: eventId(), author: actor, comment, receivedAt: stamp };
        bill.feedback = [...active.filter(item => item.author !== actor), feedback];
        bill.feedbackLog = [...(bill.feedbackLog || []), { ...feedback, label: bill.label,
          recipients: voters.filter(id => id !== actor) }].slice(-25);
        bill.approvals = bill.approvals.filter(id => id !== actor);
      } else {
        bill.feedback = (bill.feedback || []).filter(item => item.author !== actor);
        bill.approvals = fields.approve ? [...new Set([...bill.approvals, actor])] : bill.approvals.filter(id => id !== actor);
      }
      bill.status = status();
    } else return reject('This bill is closed for review.');
    invalidateSplit(trip);
    commit(trip);
    completed?.(trip);
    return trip;
  }

  function demoTripProgress(trip) {
    const funding = demoFunding(trip);
    if (funding.cancelled) return { step: 4, title: 'Trip cancelled',
      message: 'Open Wallet to check what you can take back.', view: 'wallet' };
    if (trip.settled) return { step: 4, title: 'Group payments complete',
      message: 'Open Wallet to send any remaining balance to your wallet.', view: 'wallet' };
    if (!demoFundReady(trip)) return { step: 0, title: 'Set up the trip fund',
      message: 'Open Wallet to create or link the fund for this trip.', view: 'wallet', shortcut: 'Go to vault setup' };
    if (!funding.started) return { step: 1, title: funding.balances.every(units => units >= trip.minimumUnits)
      ? 'Minimum deposits reached' : 'Waiting for deposits',
      message: 'Everyone must fund the trip before the deadline. Bills open at the scheduled start.', view: 'wallet' };
    if (Date.now() < roomEndTime(trip)) return { step: 2, title: 'Record shared expenses',
      message: 'Add payments made outside TripVault as bills.', view: 'bills' };
    if (hasPendingBills(trip)) return { step: 3, title: 'Finish bill reviews',
      message: 'Finish open bill reviews before making final payments.', view: 'bills' };
    return { step: 3, title: trip.reviewQuote ? 'Check final payments' : 'Prepare final payments',
      message: trip.reviewQuote ? 'Open Final split to check the latest approvals and top-ups.'
        : 'Open Final split to calculate and share what each person owes.', view: 'split' };
  }

  function demoWallet(trip) {
    const funding = demoFunding(trip);
    const units = depositUnits(trip, state.actor);
    const canDeposit = demoFundReady(trip) && !funding.closed
      && (!trip.depositDeadline || Date.now() < Date.parse(trip.depositDeadline) || funding.started);
    const canWithdraw = !funding.closed && units > 0
      && Date.now() < Math.min(Date.parse(trip.depositDeadline || trip.startTime), roomEndTime(trip));
    let controls = '';
    let content = '';
    if (!demoFundReady(trip)) {
      content = '<p class="notice">The organizer sets up the trip fund once everyone has joined.</p>';
      if (state.actor === trip.owner && !funding.cancelled) controls += btn('Deploy Fuji vault', 'demo-deploy');
    } else {
      if (canDeposit) controls += btn('Deposit USDC', 'deposit');
      if (canWithdraw) controls += btn('Withdraw my deposit', 'withdraw', { tone: 'secondary' });
      if ((trip.settled || funding.cancelled) && units > 0) controls += btn('Send ' + money(units) + ' to my wallet', 'claim');
      if (!trip.settled && !funding.cancelled) content += fujiDepositTiming({ timestamp: Math.floor(Date.now() / 1000),
        start: Date.parse(trip.startTime) / 1000, end: roomEndTime(trip) / 1000,
        minimum: trip.minimumUnits,
        depositDeadline: trip.depositDeadline ? Date.parse(trip.depositDeadline) / 1000 : undefined });
      if (funding.cancelled) content += '<p class="notice warn">Trip cancelled. At least one person was below the minimum at the deposit deadline. Each person can take back their own deposit.</p>';
    }
    const walletDetails = row(userText(member(state.actor).name), ui('Local demo'))
      + (demoFundReady(trip) ? row('Your balance in the trip fund', money(units)) : '');
    content += finalSplitDetails('funding', 'Funding progress', trip.members.map(person => row(userText(person.name),
      money(depositUnits(trip, person.id)), depositUnits(trip, person.id) >= trip.minimumUnits ? 'Minimum reached' : 'Below minimum')).join(''));
    return tripWalletPanel({ subtitle: 'These are simulated member balances, not real connected wallets.',
      walletDetails, content, controls,
      utilities: btn('Refresh balances', 'demo-refresh', { tone: 'ghost' }) });
  }

  function demoMemberControls() {
    return `<details class="demo-controls"><summary>${ui('Demo controls')}</summary><div class="demo-controls-body">
      <p class="subtitle">These are simulated member balances, not real connected wallets.</p>
      <div class="inline">${btn('Switch demo member', 'switch-member', { tone: 'secondary' })}
        ${btn('Restart with setup', 'judge-demo-sample', { tone: 'ghost', data: 'data-stage="setup"' })}
        ${btn('Reset demo', 'judge-demo-sample', { tone: 'ghost' })}</div>
      ${Date.parse(state.trip.startTime) > Date.now() ? btn('Start funded demo trip', 'demo-start', { tone: 'secondary',
        disabled: state.actor !== state.trip.owner || !demoFundReady(state.trip) || demoFunding(state.trip).balances.some(units => units < state.trip.minimumUnits) }) : ''}
      ${!state.trip.locked && !roomDeadlinePassed(state.trip) ? btn('Add demo member', 'demo-add-member', { tone: 'secondary', disabled: state.trip.members.length >= 12 }) : ''}
    </div></details>`;
  }

  function demoPaymentsPanel(trip, plan) {
    const pending = hasPendingBills(trip);
    const quote = trip.reviewQuote;
    const approved = trip.splitApprovals.includes(state.actor);
    const organizer = state.actor === trip.owner;
    const ended = Date.now() >= roomEndTime(trip);
    const published = trip.demoPublishedRevision === trip.revision;
    let message = '';
    let actions = '';
    let utilities = '';
    let reviewUtility = '';
    if (trip.settled) {
      const members = trip.members.map(person => person.id);
      const net = Object.fromEntries(members.map(id => [id, 0]));
      for (const transfer of plan.transfers) { net[transfer.from] -= transfer.units; net[transfer.to] += transfer.units; }
      message = fujiSettlementSummary(trip, { members, balances: members.map(id => depositUnits(trip, id)),
        payouts: trip.demoPayouts ? members.map(id => trip.demoPayouts[id]) : undefined, net: members.map(id => net[id]) }, true);
      const units = depositUnits(trip, state.actor);
      if (units > 0) actions = btn('Send ' + money(units) + ' to my wallet', 'claim');
    } else if (!ended) {
      message = '<p class="subtitle">Group payments can start after the trip ends.</p>'
        + '<p class="split-date">' + safe(formatTripTime(roomEndTime(trip))) + '</p>';
    } else if (pending) {
      message = '<p class="subtitle">Finish open bill reviews before making final payments.</p>';
      actions = btn('Review open bills', 'navigate', { data: 'data-view="bills"' });
    } else if (!quote) {
      message = '<p class="subtitle">The organizer prepares the split and locks the rate for approval.</p>';
      if (organizer) actions = btn('Calculate final amounts', 'prepare-split', { disabled: preparingTrip === trip });
    } else if (!published) {
      if (organizer) {
        actions = btn('Review payment amounts', 'demo-review-plan');
        reviewUtility = btn('Start a new review', 'reopen-split', { tone: 'ghost' });
      } else message = '<p class="subtitle">Waiting for the organizer to share the final amounts.</p>';
    } else {
      message = `<p class="subtitle">${trip.splitApprovals.length} of ${trip.members.length} approved.</p>`;
      actions = approved ? '' : btn('Approve my amount', 'approve-split', { disabled: plan.invalid });
      if (approved) utilities += btn('Undo my approval', 'revoke-split', { tone: 'danger cancel-approval' });
      const shortfall = plan.shortfalls.find(person => person.id === state.actor);
      if (approved && !shortfall) {
        if (trip.splitApprovals.length < trip.members.length || plan.shortfalls.length) message += '<p class="subtitle">Waiting for other members to approve or top up.</p>';
        else if (!organizer) message += '<p class="subtitle">The organizer can make the group payments now.</p>';
      }
      if (shortfall) actions += btn('Top up ' + money(shortfall.units), 'quick-top-up', {
        data: `data-trip="${safe(trip.id)}" data-member="${safe(state.actor)}" data-revision="${trip.revision}" data-units="${shortfall.units}"`,
      });
      if (organizer) {
        if (canSettle(trip, plan)) actions += btn('Make group payments', 'settle');
        reviewUtility = btn('Start a new review', 'reopen-split', { tone: 'ghost' });
      }
      if (plan.shortfalls.length) message += `<p class="subtitle">Top up the following balances before settlement.</p>
        ${plan.shortfalls.map(person => row(userText(member(person.id).name), money(person.units))).join('')}`;
      if (plan.invalid) message += '<p class="notice warn">The current transfers cannot be represented in USDC. Reopen the split and check the rate before settling.</p>';
    }
    const net = Object.fromEntries(trip.members.map(person => [person.id, 0]));
    for (const transfer of plan.transfers) {
      net[transfer.from] -= transfer.units;
      net[transfer.to] += transfer.units;
    }
    const personalAmount = quote && published && !trip.settled ? `<div class="split-amount"><span>Your amount</span><strong>${fujiPaymentAmount(net[state.actor])}</strong></div>` : '';
    const paymentDetails = quote && published && !trip.settled ? trip.members.map(person => row(userText(person.name), fujiPaymentAmount(net[person.id]),
      trip.splitApprovals.includes(person.id) ? 'Approved' : 'Waiting for approval')).join('') : '';
    return groupPaymentsPanel({ personalAmount, message, actions, paymentDetails,
      utilities: utilities + btn('Refresh status', 'demo-refresh', { tone: 'ghost' }) + reviewUtility,
      details: '<p class="subtitle">These are simulated member balances, not real connected wallets.</p>'
        + row(userText(member(state.actor).name), money(depositUnits(trip, state.actor))) });
  }
