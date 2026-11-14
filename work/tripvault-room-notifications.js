  let notificationReadKey;
  let readNotifications;
  let notificationSnapshot = [];

  function readTripNotifications(trip) {
    if (!trip?.shared || !rooms.account) return [];
    const member = trip.members.find(item => item.address === rooms.account);
    if (!member) return [];

    const feedback = trip.bills.flatMap(bill => {
      if (!['disputed', 'cancellation'].includes(bill.status)
        || ![bill.createdBy || bill.payer, bill.payer, ...bill.participants].includes(member.id)) return [];
      return (bill.feedback || []).filter(item => item.author !== member.id).map(item => {
        // An unchanged suggestion keeps its read status when other room details change.
        let fingerprint = 0;
        for (const char of item.comment) fingerprint = Math.imul(fingerprint, 31) + char.codePointAt(0) | 0;
        return {
          id: ['feedback', bill.id, item.author, bill.reviewBy, fingerprint].join(':'),
          billId: bill.id, title: bill.label, message: item.comment,
          sender: trip.members.find(member => member.id === item.author)?.name,
        };
      });
    }).reverse();

    return [
      ...feedback,
      ...rooms.reminders.filter(reminder => reminder.roomId === trip.id).map(reminder => ({
        id: 'top-up:' + reminder.id, reminderId: reminder.id, title: reminder.draft.label,
        sender: reminder.sender, message: money(reminder.units),
      })),
    ];
  }

  function seenTripNotifications(trip) {
    const key = 'tripvault-notifications-read:' + rooms.account + ':' + trip.id;
    if (key !== notificationReadKey) {
      notificationReadKey = key;
      const saved = readStorage(key);
      readNotifications = new Set(Array.isArray(saved) ? saved : []);
    }
    return readNotifications;
  }

  function roomBell(trip) {
    if (!trip?.shared) return '';
    const seen = seenTripNotifications(trip);
    const unread = readTripNotifications(trip).some(item => !seen.has(item.id));
    return `<button type="button" class="btn secondary trip-bell" data-act="room-notifications"
      aria-label="${unread ? 'Notifications · Unread' : 'Notifications'}" aria-haspopup="dialog">
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>
      </svg>${unread ? '<span class="trip-bell-dot" aria-hidden="true"></span>' : ''}
    </button>`;
  }

  function roomNotificationsBody(items, seen) {
    return items.length ? items.map(item => `<button type="button" class="trip-notification${seen.has(item.id) ? '' : ' unread'}"
      data-act="open-room-notification" data-id="${safe(item.id)}">
      <strong>${item.billId ? 'Bill change requested' : 'Top-up reminder'}</strong>
      <span>${userText(item.sender)} <span aria-hidden="true">·</span> ${userText(item.title)}</span>
      <small>${userText(item.message)}</small>
    </button>`).join('') : '<p class="notice">You have no trip notifications.</p>';
  }

  function openRoomNotifications(trip) {
    if (!trip?.shared) return;
    notificationSnapshot = readTripNotifications(trip);
    sheetOpen('Notifications', { user: trip.name },
      '<div class="stack" data-room-notifications>' + roomNotificationsBody(notificationSnapshot, seenTripNotifications(trip)) + '</div>');
    markTripNotificationsRead(trip, notificationSnapshot);
    render();
  }

  function markTripNotificationsRead(trip, items) {
    const seen = seenTripNotifications(trip);
    items.forEach(item => seen.add(item.id));
    try {
      localStorage.setItem(notificationReadKey, JSON.stringify([...seen].slice(-2000)));
    } catch {}
  }

  function updateRoomNotifications(trip, previous) {
    if (!trip?.shared) return;
    const items = readTripNotifications(trip);
    const panel = sheet.querySelector('[data-room-notifications]');
    if (sheet.open && panel) {
      if (JSON.stringify(notificationSnapshot) === JSON.stringify(items)) return;
      notificationSnapshot = items;
      panel.innerHTML = roomNotificationsBody(items, seenTripNotifications(trip));
      localizeUI(panel);
      markTripNotificationsRead(trip, items);
      render();
      return;
    }
    const seen = seenTripNotifications(trip);
    if (!items.some(item => !previous.has(item.id) && !seen.has(item.id))) return;
    const bell = app.querySelector?.('.trip-bell');
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      bell?.querySelector('svg')?.animate?.([
        { transform: 'rotate(0)' }, { transform: 'rotate(15deg)' }, { transform: 'rotate(-15deg)' }, { transform: 'rotate(0)' },
      ], { duration: 550, iterations: 2 });
    }
    notice('New trip notification');
  }

  function openRoomNotification(trip, id) {
    const item = readTripNotifications(trip).find(notification => notification.id === id);
    if (!item) return openRoomNotifications(trip);
    if (item.reminderId) {
      sheet.close();
      return openTopUpReminder(item.reminderId);
    }
    state.view = 'bills';
    render();
    roomBillDetail(item.billId);
  }
