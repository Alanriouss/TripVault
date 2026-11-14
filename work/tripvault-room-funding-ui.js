  let roomFundingRequest;
  let roomFundingResult;
  const sendingReminders = new WeakSet();
  let payingReminder = false;

  function getDisplayedFunding(trip) {
    if (roomFundingResult?.id === trip.id && roomFundingResult.token === rooms.token
      && roomFundingResult.data.version === trip.version) return roomFundingResult.data;
    return null;
  }

  async function refreshRoomFunding() {
    const trip = state.trip;
    const token = rooms.token;
    if (!trip?.shared || !trip.fuji?.address || !token || rooms.account !== walletSession.account) return;
    const key = trip.id + ':' + trip.version + ':' + token;
    if (roomFundingRequest?.key === key) return roomFundingRequest.promise;
    const stillCurrent = () => state.trip?.id === trip.id && state.trip.version === trip.version && rooms.token === token;
    const promise = (async () => {
      let data;
      try {
        data = await roomApi('/rooms/' + trip.id + '/funding', undefined, token);
        if (data.version !== trip.version) return;
      } catch {
        data = { version: trip.version, failed: true };
      }
      if (!stillCurrent()) return;
      const previous = getDisplayedFunding(trip);
      const previousNotifications = notificationIds();
      roomFundingResult = { id: trip.id, token, data };
      if (JSON.stringify(data) !== JSON.stringify(previous)) {
        render();
        updateRoomNotifications(previousNotifications);
      }
      return !data.failed;
    })();
    roomFundingRequest = { key, promise };
    try {
      return await promise;
    } finally {
      if (roomFundingRequest?.promise === promise) roomFundingRequest = null;
    }
  }

  function roomBillFunding(trip, draft, editing) {
    if (roomFundingCancelled(trip)) return { message: 'This trip was cancelled at the deposit deadline.', wallet: true };
    if (trip.settled) return { message: 'The trip has settled.' };
    if (roomBillsClosed(trip) && !editing) return { message: 'The trip has ended. Review any bills that are still open.' };
    if (!trip.fuji?.address) {
      return { message: 'Bills unlock after the organizer links the Fuji vault and everyone reaches the minimum deposit.', wallet: true };
    }
    const funding = getDisplayedFunding(trip);
    if (!funding) return { message: 'Checking vault deposits on Fuji…', refresh: true };
    if (funding.failed) return { message: 'Vault balances could not be verified on Fuji.', refresh: true };
    if (funding.closed) return { message: 'The Fuji vault is closed to new bills.' };
    if (funding.started === false) {
      return funding.deadlineReached
        ? { message: 'The trip is funded. Bills open at the scheduled start.' }
        : { message: 'Everyone must fund the trip before the deadline. Bills open at the scheduled start.',
          shortfalls: roomFundingShortfalls(trip, funding), wallet: true };
    }
    const current = editing ? { ...trip, bills: trip.bills.filter(bill => bill.id !== editing) } : trip;
    const shortfalls = roomFundingShortfalls(current, funding, draft);
    if (shortfalls.length) {
      return {
        message: draft ? 'Top up these amounts to save this bill.' : 'Bills are locked until these members top up.',
        shortfalls,
      };
    }
    if (!funding.rate) return { message: 'The USD/VND rate is unavailable for checking bill coverage.', refresh: true };
    return { ready: true };
  }

  function canReviewFundedTrip(trip) {
    if (!trip.depositDeadline) return true;
    const funding = getDisplayedFunding(trip);
    return Boolean(funding?.started && !funding.closed);
  }

  function fundingTopUpButton(units) {
    if (walletSession.chain !== FUJI.id) return btn('Switch to Fuji', 'fuji-switch', { disabled: walletSession.busy });
    const unavailable = walletSession.busy || state.trip.fuji?.lastTx?.phase === 'pending';
    return btn('Top up ' + money(units), 'room-funding-top-up', { disabled: unavailable });
  }

  function roomFundingMessage(trip, status) {
    if (status.ready) return '';
    const own = status.shortfalls?.find(item => item.id === state.actor);
    return `<div class="notice stack">
      <p>${safe(status.message)}</p>
      ${status.shortfalls?.map(({ id, units }) => row(userText(trip.members.find(member => member.id === id).name),
        money(units), id === state.actor ? 'Your top-up' : 'Needs to top up')).join('') || ''}
      ${own ? fundingTopUpButton(own.units) : ''}
      ${status.wallet ? btn('Go to Wallet', 'navigate', { tone: 'secondary', data: 'data-view="wallet"' }) : ''}
      ${status.refresh ? btn('Check funding', 'room-funding-refresh', { tone: 'secondary' }) : ''}
    </div>`;
  }

  function roomFundingPanel(trip) {
    const status = roomBillFunding(trip);
    if (status.ready || trip.settled || (roomBillsClosed(trip) && !roomFundingCancelled(trip))) return '';
    return roomFundingMessage(trip, status);
  }

  function roomFundBalance(trip) {
    const funding = getDisplayedFunding(trip);
    const balances = funding?.failed ? null : funding?.balances ?? currentVault()?.balances;
    let value = 'Fund not set up';
    if (trip.fuji?.address) {
      value = funding?.failed ? 'Could not verify balance' : 'Checking balance…';
      if (balances) {
        const total = balances.reduce((sum, units) => sum + BigInt(units), 0n);
        const locale = siteLanguage === 'vi' ? 'vi-VN' : 'en-US';
        const whole = new Intl.NumberFormat(locale).format(total / 1_000_000n);
        const decimal = new Intl.NumberFormat(locale).formatToParts(0.5).find(part => part.type === 'decimal').value;
        const fraction = (total % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '').padEnd(2, '0');
        value = whole + decimal + fraction + ' USDC';
      }
    }
    return `<section class="panel fund-summary" aria-labelledby="fund-summary-title">
      <div><h2 id="fund-summary-title">Trip fund balance</h2><p class="subtitle">Total held on Avalanche Fuji</p></div>
      <strong>${safe(value)}</strong>
    </section>`;
  }

  function readBillDraft(form) {
    const fields = new FormData(form);
    const label = String(fields.get('label') || '').trim();
    const amount = Number(fields.get('amount'));
    const payer = fields.get('payer');
    const participants = fields.getAll('participant');
    if (Number.isSafeInteger(amount) && amount > 0 && amount <= 1e9 && member(payer)
      && participants.length > 0 && participants.every(id => member(id))) return { label, amount, payer, participants };
    return null;
  }

  function updateBillFundingForm() {
    const form = sheet.querySelector('#bill-form[data-room]');
    const trip = state.trip;
    if (!sheet.open || !form || form.dataset.room !== trip?.id) return;
    const draft = readBillDraft(form);
    const status = roomBillFunding(trip, draft, Number(form.dataset.editing));
    const submit = sheet.querySelector('button[form="bill-form"]');
    const display = form.querySelector('#bill-funding-status');
    if (submit) submit.disabled = !status.ready || !draft || walletSession.busy || rooms.busy;
    if (!display) return;
    let markup = roomFundingMessage(trip, status);
    const otherMembers = status.shortfalls?.filter(item => item.id !== state.actor) || [];
    if (rooms.canSendTopUpReminders && !roomBillsClosed(trip) && !form.dataset.editing && draft?.label && otherMembers.length) {
      const caption = otherMembers.length === 1 ? 'Remind ' + member(otherMembers[0].id).name + ' to top up'
        : 'Send top-up reminders';
      markup += btn(caption, 'send-top-up-reminder', { tone: 'secondary', disabled: sendingReminders.has(form) });
    }
    const visible = walletSession.status?.tripId === trip.id ? walletSession.status : trip.fuji?.lastTx;
    if (visible && (visible.label.startsWith('Deposit ') || visible.label.startsWith('Approve '))) {
      markup += fujiTransactionCard(trip);
      if (visible.message?.includes('Circle faucet')) markup += fujiFaucetNotice();
      if (visible.phase === 'pending') markup += btn('Check transaction', 'fuji-check', { disabled: walletSession.busy });
    }
    if (display.billFundingMarkup !== markup) {
      display.innerHTML = markup;
      display.billFundingMarkup = markup;
      localizeUI(display);
    }
  }

  async function sendBillTopUpReminder(element) {
    const trip = state.trip;
    const form = element.closest('#bill-form[data-room]');
    if (!trip?.shared || form?.dataset.room !== trip.id || sendingReminders.has(form) || !rooms.token) return;
    const draft = readBillDraft(form);
    if (!draft?.label) return;
    const feedback = form.querySelector('#bill-reminder-feedback');
    sendingReminders.add(form);
    if (feedback) feedback.textContent = ui('Sending reminder…');
    updateBillFundingForm();
    try {
      const { sent } = await roomApi('/rooms/' + trip.id + '/top-up-reminder', { ...draft, version: trip.version });
      if (feedback) feedback.textContent = ui(sent === 1 ? 'Reminder sent in TripVault.' : 'Reminders sent in TripVault.');
    } catch (error) {
      if (feedback) feedback.textContent = ui(walletError(error));
      if (error.status === 409) {
        await syncRooms();
        await refreshRoomFunding();
      }
    } finally {
      sendingReminders.delete(form);
      updateBillFundingForm();
    }
  }

  function reminderBalance(trip, reminder) {
    const funding = getDisplayedFunding(trip);
    if (!funding || funding.failed || !funding.rate || funding.closed) return null;
    return roomFundingShortfalls(trip, funding, reminder.draft).find(item => item.id === state.actor)?.units ?? 0;
  }

  function openTopUpReminder(id) {
    const reminder = rooms.reminders.find(item => item.id === id);
    const trip = reminder && rooms.list.get(reminder.roomId);
    if (!trip) return;
    selectTrip(trip);
    state.view = 'wallet';
    render();
    openRoomNotifications();
    refreshRoomFunding();
  }

  async function payTopUpReminder(id, units) {
    const tripId = state.trip?.id;
    const token = rooms.token;
    if (!tripId || !token || walletSession.busy || payingReminder) return;
    payingReminder = true;
    render();
    try {
      if (!await syncRooms()) return notice('Could not check the latest reminder. Try again.');
      await refreshRoomFunding();
      const trip = state.trip;
      if (trip?.id !== tripId || token !== rooms.token || walletSession.busy) return;
      const reminder = rooms.reminders.find(item => item.id === id && item.roomId === tripId);
      const balance = reminder && reminderBalance(trip, reminder);
      if (!balance || balance !== Number(units)) {
        return notice('The amount changed. Check the latest reminder.');
      }
      if (sheet.open && sheet.querySelector('[data-room-notifications]')) sheet.close();
      await fujiDeposit(balance);
      await refreshRoomFunding();
    } finally {
      payingReminder = false;
      render();
      refreshNotificationSheet();
    }
  }

  async function topUpRoomFunding(element) {
    const trip = state.trip;
    if (!trip?.shared || walletSession.busy) return;
    const form = element.closest('#bill-form[data-room]');
    const draft = form ? readBillDraft(form) : null;
    const status = roomBillFunding(trip, draft, Number(form?.dataset.editing));
    const needed = status.shortfalls?.find(item => item.id === state.actor);
    if (needed) {
      await fujiDeposit(needed.units);
      await refreshRoomFunding();
    }
  }

  function fujiFaucetNotice() {
    return '<p class="notice">Get USDC for Avalanche Fuji using this wallet address, then refresh your balance. <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer">Open Circle faucet</a></p>';
  }

  document.addEventListener('input', updateBillFundingForm);
  document.addEventListener('change', updateBillFundingForm);
