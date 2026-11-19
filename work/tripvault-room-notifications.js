  let notificationReadKey;
  let readNotifications;
  let migratedNotificationRooms;
  let notificationDismissedKey;
  let dismissedNotifications;
  let notificationAttention = false;
  let notificationAttentionTimer;

  const BILL_EVENT_HEADINGS = {
    'suggestion-agreed': 'Someone agreed with the suggestion',
    'suggestion-disagreed': 'Someone disagreed with the suggestion',
    'cancellation-requested': 'Bill removal requested',
    'cancellation-declined': 'Bill cancellation declined',
  };

  function billFeedbackNotifications(trip, bill, member, involved) {
    const entries = new Map();
    const add = (id, label, feedback) => entries.set(id, {
      id: 'feedback:' + bill.id + ':' + id, billId: bill.id, title: label,
      heading: 'Bill change requested', message: feedback.comment, userMessage: true,
      changeRequest: true,
      receivedAt: feedback.receivedAt,
      sender: trip.members.find(person => person.id === feedback.author)?.name,
    });
    for (const feedback of bill.feedbackLog || []) {
      if (isDemoTrip(trip) && (!feedback.recipients?.includes(member.id) || feedback.author === member.id)) continue;
      add(feedback.id, feedback.label, feedback);
    }
    if (involved) {
      const versions = [...(bill.history || []), bill];
      for (const version of versions) {
        for (const feedback of version.feedback || []) {
          if (feedback.author === member.id || entries.has(feedback.id)) continue;
          if (feedback.id) {
            add(feedback.id, version.label, feedback);
            continue;
          }
          let fingerprint = 0;
          for (const char of feedback.comment) fingerprint = Math.imul(fingerprint, 31) + char.codePointAt(0) | 0;
          add([feedback.author, version.reviewBy, fingerprint].join(':'), version.label, feedback);
        }
      }
    }
    return [...entries.values()].reverse();
  }

  function tripNotificationEntries(trip) {
    const member = isDemoTrip(trip) ? trip.members.find(item => item.id === state.actor)
      : trip.members.find(item => item.address === rooms.account);
    if (!member) return [];

    const bills = trip.bills.slice().reverse().flatMap(bill => {
      const involved = [bill.createdBy || bill.payer, bill.payer, ...bill.participants].includes(member.id);
      const feedback = billFeedbackNotifications(trip, bill, member, involved);
      const related = { billId: bill.id, title: bill.label };
      const review = (bill.notificationLog || [])
        .filter(event => !isDemoTrip(trip) || event.recipients?.includes(member.id)).map(event => ({
        ...related, title: event.label,
        id: (event.kind === 'cancellation-requested' ? 'removal' : 'bill-event') + ':' + bill.id + ':' + event.id,
        heading: BILL_EVENT_HEADINGS[event.kind], receivedAt: event.receivedAt,
        message: event.comment, userMessage: Boolean(event.comment),
        sender: trip.members.find(person => person.id === event.actor)?.name,
      }));
      if (involved && bill.status === 'pending' && bill.participants.includes(member.id)
        && !bill.approvals.includes(member.id) && (bill.createdBy || bill.payer) !== member.id) {
        review.push({ ...related, id: 'review:' + bill.id + ':' + bill.reviewBy,
          heading: 'Bill needs your approval',
          receivedAt: bill.reviewStartedAt || (bill.reviewBy ? bill.reviewBy - 86_400_000 : undefined),
          sender: trip.members.find(person => person.id === (bill.createdBy || bill.payer))?.name });
      }
      const cancellation = bill.cancellation;
      if (bill.status === 'cancellation' && cancellation && (involved || cancellation.reason)
        && !cancellation.votes.includes(member.id)
        && !review.some(item => item.id === 'removal:' + bill.id + ':' + cancellation.id)) {
        review.push({ ...related, id: 'removal:' + bill.id + ':' + (cancellation.id || bill.reviewBy),
          heading: 'Bill removal requested', message: cancellation.reason, userMessage: Boolean(cancellation.reason),
          receivedAt: cancellation.requestedAt,
          sender: trip.members.find(person => person.id === (cancellation.requestedBy || cancellation.votes[0]))?.name });
      }
      if (bill.status === 'rejected' && (involved || cancellation?.reason)) {
        review.push({ ...related, id: 'removed:' + bill.id, heading: 'Bill removed',
          receivedAt: cancellation?.resolvedAt,
          message: 'Everyone involved agreed to handle this bill separately. It is excluded from the final amounts.' });
      }
      return [...feedback, ...review];
    });

    const reminders = rooms.reminders.filter(reminder => reminder.roomId === trip.id).map(reminder => ({
      id: 'top-up:' + reminder.id, reminder, heading: 'Top-up reminder', title: reminder.draft.label,
      sender: reminder.sender, receivedAt: reminder.receivedAt,
    }));

    const notices = trip.members.slice(trip.members.indexOf(member) + 1)
      .filter(person => Number.isSafeInteger(person.joinedAt) && person.joinedAt > 0)
      .map(person => ({
        id: 'member-joined:' + person.id, heading: 'New member joined',
        sender: person.name, receivedAt: person.joinedAt, view: 'people',
      }));
    if (roomFundingCancelled(trip)) {
      notices.push({ id: 'cancelled', heading: 'Trip cancelled', view: 'wallet',
        receivedAt: Date.parse(trip.depositDeadline),
        message: trip.fuji?.address ? 'Someone was below the minimum at the deadline. Open Wallet to take back your deposit.'
          : 'The deposit deadline passed without a linked trip fund.' });
    } else if (trip.settled) {
      notices.push({ id: 'settled', heading: 'Group payments complete', view: 'wallet',
        receivedAt: trip.fuji?.settledAt,
        message: 'Open Wallet to send any remaining balance to your wallet.' });
    } else if (trip.billsClosedAt) {
      notices.push({ id: 'ended', heading: trip.endedAt ? 'Trip ended early' : 'Trip ended', view: trip.endedAt ? 'split' : 'bills',
        receivedAt: Date.parse(trip.billsClosedAt),
        message: trip.endedAt ? 'Open Final split to review the trip expenses.' : 'The trip has ended. Review any bills that are still open.' });
      if (trip.owner !== member.id && trip.fuji?.publishedRevision) {
        notices.push({ id: 'split:' + trip.fuji.publishedRevision, heading: 'Final amounts are ready to review',
          receivedAt: trip.fuji.publishedAt, view: 'split' });
      }
    } else if (trip.locked) {
      notices.push({ id: 'roster-locked', heading: 'Roster locked', view: 'people',
        receivedAt: trip.rosterLockedAt,
        message: 'The vault uses the member list saved at setup. Invitations are closed.' });
      if (trip.owner === member.id && trip.fuji?.address && trip.fuji.contractVersion < 2 && roomEndTime(trip) > Date.now()) {
        notices.push({ id: 'original-end', heading: 'Trip end', view: 'wallet',
          receivedAt: trip.fuji.linkedAt,
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

  function sampleNotificationTrip() {
    const trip = state.trip;
    return trip?.id === 'judges-sample' && !trip.shared ? trip : null;
  }

  function notificationAccount() {
    return sampleNotificationTrip() ? 'demo:' + state.actor : rooms.account;
  }

  function sampleNotifications(trip) {
    const sample = { roomId: trip.id, roomName: trip.name };
    const prefix = trip.id + ':' + trip.endTime + ':';
    return [...tripNotificationEntries(trip),
      { ...sample, id: prefix + 'ended', heading: 'Trip ended', view: 'split',
        receivedAt: Date.parse(trip.endTime), message: 'The trip has ended. Review any bills that are still open.' },
      { ...sample, id: prefix + 'funded', heading: 'Minimum deposits reached', view: 'wallet',
        receivedAt: Date.parse(trip.startTime) },
    ];
  }

  function readRoomNotifications() {
    if (!notificationAccount()) return [];
    const dismissed = dismissedRoomNotifications();
    const sample = sampleNotificationTrip();
    const entries = sample ? sampleNotifications(sample) : [...rooms.list.values()].flatMap(tripNotificationEntries);
    const items = entries.filter(item => !dismissed.has(item.id));
    return items.sort((a, b) => (b.receivedAt || 0) - (a.receivedAt || 0) || a.id.localeCompare(b.id));
  }

  function notificationIds() {
    return new Set(readRoomNotifications().map(item => item.id));
  }

  function dismissedRoomNotifications() {
    const key = 'tripvault-notifications-dismissed:' + notificationAccount();
    if (key !== notificationDismissedKey) {
      notificationDismissedKey = key;
      const saved = readStorage(key);
      dismissedNotifications = new Set(Array.isArray(saved) ? saved : []);
    }
    return dismissedNotifications;
  }

  function clearRoomNotifications() {
    if (!notificationAccount() || !sheet.open) return;
    const items = readRoomNotifications();
    if (!items.length) return;
    const dismissed = dismissedRoomNotifications();
    items.forEach(item => dismissed.add(item.id));
    try {
      localStorage.setItem(notificationDismissedKey, JSON.stringify([...dismissed]));
    } catch {}
    if (!refreshNotificationSheet()) openRoomNotifications();
  }

  window.addEventListener('storage', event => {
    if (!notificationAccount() || event.key !== notificationDismissedKey) return;
    notificationDismissedKey = undefined;
    if (!refreshNotificationSheet()) render();
  });

  function seenRoomNotifications() {
    const key = 'tripvault-notifications-read:' + notificationAccount();
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
    if (!notificationAccount()) return '';
    const seen = seenRoomNotifications();
    const unreadCount = readRoomNotifications().filter(item => !seen.has(item.id)).length;
    const unread = unreadCount > 0;
    const badgeText = unreadCount > 9 ? '9+' : unreadCount;
    return `<button type="button" class="btn secondary trip-bell${unread && notificationAttention ? ' attention' : ''}" data-act="room-notifications"
      aria-label="${unread ? 'Notifications · Unread' : 'Notifications'}" aria-haspopup="dialog">
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>
      </svg>${unread ? `<span class="trip-bell-dot" aria-hidden="true">${badgeText}</span>` : ''}
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

  function notificationTime(timestamp) {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '<small class="notification-time">Time unavailable</small>';
    const date = new Date(timestamp);
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
    const formatter = new Intl.RelativeTimeFormat(siteLanguage === 'vi' ? 'vi-VN' : 'en-US', { numeric: 'always' });
    let elapsed = ui('Just now');
    if (minutes >= 1440) elapsed = formatter.format(-Math.floor(minutes / 1440), 'day');
    else if (minutes >= 60) elapsed = formatter.format(-Math.floor(minutes / 60), 'hour');
    else if (minutes) elapsed = formatter.format(-minutes, 'minute');
    return `<small class="notification-time"><time datetime="${date.toISOString()}">${safe(formatTripTime(timestamp))}</time>
      <span aria-hidden="true"> · </span><span>${safe(elapsed)}</span></small>`;
  }

  function notificationCategory(item) {
    if (item.reminder || item.heading === 'Top-up reminder' || item.heading === 'Your top-up') {
      return 'notif-topup';
    }
    if (item.heading === 'Bill change requested' || item.heading === 'Bill needs your approval' || item.heading === 'Bill removal requested' || item.heading === 'Bill cancellation declined') {
      return 'notif-warning';
    }
    if (item.heading === 'Someone agreed with the suggestion' || item.heading === 'Group payments complete' || item.heading === 'Bill removed') {
      return 'notif-success';
    }
    return 'notif-info';
  }

  function roomNotificationsBody(trip, items, seen) {
    if (!items.length) {
      return `<div class="empty-notifications">
        <div class="empty-notif-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>
          </svg>
        </div>
        <h3>No notifications yet</h3>
        <p class="subtitle">All updates about funding, bills, and approvals will appear here.</p>
        <span style="display:none">You have no trip notifications.</span>
      </div>`;
    }
    return '<div class="inline notification-tools">' +
      btn('Clear notifications', 'clear-room-notifications', { tone: 'secondary' }) + '</div>' + items.map(item => {
      const current = trip?.id === item.roomId;
      const [message, action] = item.reminder ? topUpNotificationDetails(current ? trip : null, item.reminder) : [
        item.message, btn(item.billId ? 'Open bill' : item.view === 'split' ? 'Open Final split' : 'Open trip', 'open-room-notification',
          { tone: 'secondary', data: `data-id="${safe(item.id)}"` }),
      ];
      const context = [item.roomName, item.sender, item.title].filter(Boolean).map(userText).join(' · ');
      const category = notificationCategory(item);
      const isUnread = !seen.has(item.id);
      return `<article class="trip-notification ${category}${isUnread ? ' unread' : ''}"
        data-notification-id="${safe(item.id)}" data-act="mark-room-notification-read" data-id="${safe(item.id)}">
        <div class="notif-header">
          <button type="button" class="notif-title" data-act="mark-room-notification-read" data-id="${safe(item.id)}">
            ${isUnread ? '<span class="notif-dot" aria-hidden="true"></span>' : ''}
            <strong>${item.heading}</strong>
          </button>
          ${notificationTime(item.receivedAt)}
        </div>
        ${context ? '<span class="notif-context">' + context + '</span>' : ''}
        ${message ? '<small class="notif-message">' + (item.userMessage ? userText(message) : safe(message)) + '</small>' : ''}
        ${action ? '<div class="inline notif-actions">' + action + '</div>' : ''}
      </article>`;
    }).join('');
  }

  function openRoomNotifications() {
    if (!notificationAccount()) return;
    const seen = seenRoomNotifications();
    const items = readRoomNotifications();
    const markup = roomNotificationsBody(state.trip, items, seen);
    sheetOpen('Notifications', 'Your trips',
      '<div class="stack" data-room-notifications>' + markup + '</div>' + (sampleNotificationTrip() ? '' : billSignInButton()));
    const panel = sheet.querySelector('[data-room-notifications]');
    if (panel) panel.notificationMarkup = markup;
    render();
    if (!sampleNotificationTrip()) syncRooms();
  }

  function markRoomNotificationRead(id) {
    const seen = seenRoomNotifications();
    if (!id || seen.has(id)) return;
    seen.add(id);
    try {
      localStorage.setItem(notificationReadKey, JSON.stringify([...seen].slice(-2000)));
    } catch {}
    if (!refreshNotificationSheet()) render();
  }

  function refreshNotificationSheet(items = readRoomNotifications()) {
    const panel = sheet.open && sheet.querySelector('[data-room-notifications]');
    if (!panel) return false;
    const markup = roomNotificationsBody(state.trip, items, seenRoomNotifications());
    if (panel.notificationMarkup !== markup) {
      panel.innerHTML = markup;
      localizeUI(panel);
      panel.notificationMarkup = markup;
      render();
    }
    return true;
  }

  function updateRoomNotifications(previous) {
    if (!rooms.account) return;
    const seen = seenRoomNotifications();
    const items = readRoomNotifications();
    if (refreshNotificationSheet(items)) return;
    const incoming = items.filter(item => !previous.has(item.id) && !seen.has(item.id));
    if (!incoming.length) return;
    const message = incoming.some(item => item.changeRequest) ? 'New bill change request' : 'New trip notification';
    notificationAttention = true;
    clearTimeout(notificationAttentionTimer);
    notificationAttentionTimer = setTimeout(() => {
      notificationAttention = false;
      app.querySelector?.('.trip-bell')?.classList.remove('attention');
    }, 1800);
    render();
    const sheetAlert = sheet.open && sheet.querySelector('[data-sheet-notification]');
    if (sheetAlert) {
      sheetAlert.querySelector('[role="status"]').textContent = ui(message);
      sheetAlert.hidden = false;
    }
    notice(message);
  }

  function openRoomNotification(id) {
    const item = readRoomNotifications().find(notification => notification.id === id);
    if (!item) return openRoomNotifications();
    const sample = sampleNotificationTrip();
    const targetTrip = sample?.id === item.roomId ? sample : rooms.list.get(item.roomId);
    if (!targetTrip) return;
    markRoomNotificationRead(id);
    const actor = state.actor;
    selectTrip(targetTrip);
    if (isDemoTrip(targetTrip) && targetTrip.members.some(person => person.id === actor)) {
      state.actor = actor;
      save();
    }
    state.view = item.view || 'bills';
    render();
    window.scrollTo(0, 0);
    if (targetTrip.shared && ['wallet', 'split'].includes(item.view)) refreshVault();
    if (targetTrip.shared && item.view === 'split') refreshRoomFunding();
    if (item.billId) roomBillDetail(item.billId);
  }
