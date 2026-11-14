  let notificationReadKey;
  let readNotifications;
  let migratedNotificationRooms;
  let notificationAttention = false;
  let notificationAttentionTimer;

  function billFeedbackNotifications(trip, bill, member, involved) {
    const entries = new Map();
    const add = (id, label, feedback) => entries.set(id, {
      id: 'feedback:' + bill.id + ':' + id, billId: bill.id, title: label,
      heading: 'Bill change requested', message: feedback.comment, userMessage: true,
      receivedAt: feedback.receivedAt,
      sender: trip.members.find(person => person.id === feedback.author)?.name,
    });
    for (const feedback of bill.feedbackLog || []) {
      add(feedback.id, feedback.label, feedback);
    }
    if (involved) {
      const versions = [...(bill.history || []), bill];
      for (const version of versions) {
        for (const feedback of version.feedback || []) {
          if (feedback.id || feedback.author === member.id) continue;
          let fingerprint = 0;
          for (const char of feedback.comment) fingerprint = Math.imul(fingerprint, 31) + char.codePointAt(0) | 0;
          add([feedback.author, version.reviewBy, fingerprint].join(':'), version.label, feedback);
        }
      }
    }
    return [...entries.values()].reverse();
  }

  function tripNotificationEntries(trip) {
    const member = trip.members.find(item => item.address === rooms.account);
    if (!member) return [];

    const bills = trip.bills.slice().reverse().flatMap(bill => {
      const involved = [bill.createdBy || bill.payer, bill.payer, ...bill.participants].includes(member.id);
      const feedback = billFeedbackNotifications(trip, bill, member, involved);
      if (!involved) return feedback;
      const related = { billId: bill.id, title: bill.label };
      const review = [];
      if (bill.status === 'pending' && bill.participants.includes(member.id)
        && !bill.approvals.includes(member.id) && (bill.createdBy || bill.payer) !== member.id) {
        review.push({ ...related, id: 'review:' + bill.id + ':' + bill.reviewBy,
          heading: 'Bill needs your approval', sender: trip.members.find(person => person.id === (bill.createdBy || bill.payer))?.name });
      }
      if (bill.status === 'cancellation' && !bill.cancellation.votes.includes(member.id)) {
        review.push({ ...related, id: 'removal:' + bill.id + ':' + bill.reviewBy,
          heading: 'Bill removal requested', sender: trip.members.find(person => person.id === bill.cancellation.votes[0])?.name });
      }
      if (bill.status === 'rejected') {
        review.push({ ...related, id: 'removed:' + bill.id, heading: 'Bill removed',
          message: 'Everyone involved agreed to handle this bill separately. It is excluded from the final amounts.' });
      }
      return [...feedback, ...review];
    });

    const reminders = rooms.reminders.filter(reminder => reminder.roomId === trip.id).map(reminder => ({
      id: 'top-up:' + reminder.id, reminder, heading: 'Top-up reminder', title: reminder.draft.label,
      sender: reminder.sender,
    }));

    const notices = [];
    if (roomFundingCancelled(trip)) {
      notices.push({ id: 'cancelled', heading: 'Trip cancelled', view: 'wallet',
        message: trip.fuji?.address ? 'Someone was below the minimum at the deadline. Open Wallet to take back your deposit.'
          : 'The deposit deadline passed without a linked trip fund.' });
    } else if (trip.settled) {
      notices.push({ id: 'settled', heading: 'Group payments complete', view: 'wallet',
        message: 'Open Wallet to send any remaining balance to your wallet.' });
    } else if (trip.billsClosedAt) {
      notices.push({ id: 'ended', heading: trip.endedAt ? 'Trip ended early' : 'Trip ended', view: 'bills',
        message: 'The trip has ended. Review any bills that are still open.' });
      if (trip.owner !== member.id && trip.fuji?.publishedRevision) {
        notices.push({ id: 'split:' + trip.fuji.publishedRevision, heading: 'Final amounts are ready to review', view: 'split' });
      }
    } else if (trip.locked) {
      notices.push({ id: 'roster-locked', heading: 'Roster locked', view: 'people',
        message: 'The vault uses the member list saved at setup. Invitations are closed.' });
      if (trip.owner === member.id && trip.fuji?.address && trip.fuji.contractVersion < 2 && roomEndTime(trip) > Date.now()) {
        notices.push({ id: 'original-end', heading: 'Trip end', view: 'wallet',
          message: 'This vault uses its original end time. Early ending is available for newly deployed vaults.' });
      }
      const funding = getDisplayedFunding(trip);
      if (funding && !funding.closed && !funding.failed) {
        const shortfall = roomFundingShortfalls(trip, funding).find(item => item.id === member.id);
        if (shortfall) notices.push({ id: 'funding:' + shortfall.units, heading: 'Your top-up',
          message: money(shortfall.units), view: 'wallet' });
      }
    }

    return [...bills, ...reminders, ...notices].map(item => ({
      ...item, id: trip.id + ':' + item.id, roomId: trip.id, roomName: trip.name,
    }));
  }

  function readRoomNotifications(seen) {
    if (!rooms.account) return [];
    const items = [...rooms.list.values()].flatMap(tripNotificationEntries);
    return items.sort((a, b) => Number(Boolean(seen?.has(a.id))) - Number(Boolean(seen?.has(b.id)))
      || (b.receivedAt || 0) - (a.receivedAt || 0));
  }

  function notificationIds() {
    return new Set(readRoomNotifications().map(item => item.id));
  }

  function seenRoomNotifications() {
    const key = 'tripvault-notifications-read:' + rooms.account;
    if (key !== notificationReadKey) {
      notificationReadKey = key;
      const saved = readStorage(key);
      readNotifications = new Set(Array.isArray(saved) ? saved : []);
      migratedNotificationRooms = new Set();
    }
    // Older versions stored read status under each trip.
    for (const id of rooms.list.keys()) {
      if (migratedNotificationRooms.has(id)) continue;
      migratedNotificationRooms.add(id);
      const previous = readStorage(key + ':' + id);
      if (Array.isArray(previous)) previous.forEach(item => readNotifications.add(id + ':' + item));
    }
    return readNotifications;
  }

  function roomBell() {
    if (!rooms.account) return '';
    const seen = seenRoomNotifications();
    const unread = readRoomNotifications().some(item => !seen.has(item.id));
    return `<button type="button" class="btn secondary trip-bell${unread && notificationAttention ? ' attention' : ''}" data-act="room-notifications"
      aria-label="${unread ? 'Notifications · Unread' : 'Notifications'}" aria-haspopup="dialog">
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>
      </svg>${unread ? '<span class="trip-bell-dot" aria-hidden="true"></span>' : ''}
    </button>`;
  }

  function topUpNotificationDetails(trip, reminder) {
    const id = `data-id="${safe(reminder.id)}"`;
    if (!trip) return [`Requested ${money(reminder.units)}`, btn('Open trip', 'open-top-up-reminder', { tone: 'secondary', data: id })];
    if (trip.settled || getDisplayedFunding(trip)?.closed) return ['The trip fund is closed.', ''];
    const units = reminderBalance(trip, reminder);
    if (units === null) return [`Requested ${money(reminder.units)}. Check the current amount before adding funds.`,
      btn('Check amount', 'room-funding-refresh', { tone: 'secondary' })];
    if (!units) return ['You’ve added enough for this bill.', ''];
    const action = walletSession.chain !== FUJI.id
      ? btn('Switch to Fuji', 'fuji-switch', { disabled: walletSession.busy })
      : btn('Top up ' + money(units), 'pay-top-up-reminder', {
        data: id + ` data-units="${units}"`,
        disabled: payingReminder || walletSession.busy || trip.fuji?.lastTx?.phase === 'pending',
      });
    return [`${money(units)} still needed`, action];
  }

  function roomNotificationsBody(trip, items, seen) {
    return items.length ? items.map(item => {
      const current = trip?.id === item.roomId;
      const [message, action] = item.reminder ? topUpNotificationDetails(current ? trip : null, item.reminder) : [
        item.message, btn(item.billId ? 'Open bill' : 'Open trip', 'open-room-notification',
          { tone: 'secondary', data: `data-id="${safe(item.id)}"` }),
      ];
      const context = [item.roomName, item.sender, item.title].filter(Boolean).map(userText).join(' · ');
      return `<article class="trip-notification${seen.has(item.id) ? '' : ' unread'}">
        <strong>${item.heading}</strong>
        ${context ? '<span>' + context + '</span>' : ''}
        ${message ? '<small>' + (item.userMessage ? userText(message) : safe(message)) + '</small>' : ''}
        ${action ? '<div class="inline">' + action + '</div>' : ''}
      </article>`;
    }).join('') : '<p class="notice">You have no trip notifications.</p>';
  }

  function openRoomNotifications() {
    if (!rooms.account) return;
    const seen = seenRoomNotifications();
    const items = readRoomNotifications(seen);
    const markup = roomNotificationsBody(state.trip, items, seen);
    sheetOpen('Notifications', 'Your trips',
      '<div class="stack" data-room-notifications>' + markup + '</div>' + billSignInButton());
    const panel = sheet.querySelector('[data-room-notifications]');
    if (panel) panel.notificationMarkup = roomNotificationsBody(state.trip, items, markTripNotificationsRead(items));
    else markTripNotificationsRead(items);
    render();
    syncRooms();
  }

  function markTripNotificationsRead(items) {
    const seen = seenRoomNotifications();
    if (!items.some(item => !seen.has(item.id))) return seen;
    items.forEach(item => seen.add(item.id));
    try {
      localStorage.setItem(notificationReadKey, JSON.stringify([...seen].slice(-2000)));
    } catch {}
    return seen;
  }

  function refreshNotificationSheet(items = readRoomNotifications(seenRoomNotifications())) {
    const panel = sheet.open && sheet.querySelector('[data-room-notifications]');
    if (!panel) return false;
    const markup = roomNotificationsBody(state.trip, items, seenRoomNotifications());
    if (panel.notificationMarkup !== markup) {
      panel.innerHTML = markup;
      localizeUI(panel);
      panel.notificationMarkup = roomNotificationsBody(state.trip, items, markTripNotificationsRead(items));
      render();
    }
    return true;
  }

  function updateRoomNotifications(previous) {
    if (!rooms.account) return;
    const seen = seenRoomNotifications();
    const items = readRoomNotifications(seen);
    if (refreshNotificationSheet(items)) return;
    if (!items.some(item => !previous.has(item.id) && !seen.has(item.id))) return;
    notificationAttention = true;
    clearTimeout(notificationAttentionTimer);
    notificationAttentionTimer = setTimeout(() => {
      notificationAttention = false;
      app.querySelector?.('.trip-bell')?.classList.remove('attention');
    }, 1800);
    render();
    notice('New trip notification');
  }

  function openRoomNotification(id) {
    const item = readRoomNotifications().find(notification => notification.id === id);
    if (!item) return openRoomNotifications();
    const targetTrip = rooms.list.get(item.roomId);
    if (!targetTrip) return;
    selectTrip(targetTrip);
    state.view = item.view || 'bills';
    render();
    window.scrollTo(0, 0);
    if (['wallet', 'split'].includes(item.view)) refreshVault();
    if (item.billId) roomBillDetail(item.billId);
  }
