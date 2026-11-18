  const ROOM_AUTH_KEY = 'tripvault-room-auth';
  const ROOM_TX_KEY = 'tripvault-room-transactions';
  const rooms = {
    online: false, canDelete: false, canBulkDelete: false, canEnd: false, canSendTopUpReminders: false,
    canSaveCancellationReason: false, canRespondToSuggestions: false,
    account: '', token: '', list: new Map(), reminders: [], removed: new Set(), intent: null,
    busy: false, refreshing: false, timer: null, lastVaultPoll: 0, lastFundingPoll: 0, transactions: {},
  };

  function roomStorage(key, value) {
    try {
      if (arguments.length === 1) return JSON.parse(sessionStorage.getItem(key));
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      return null;
    }
  }

  function availableTrips() {
    return [...state.trips, ...rooms.list.values()];
  }

  async function roomApi(path, body, token = rooms.token, timeoutMs = 0) {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const controller = timeoutMs ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetch('/api' + path, {
        method: body === undefined ? 'GET' : 'POST', headers, cache: 'no-store', signal: controller?.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.error || 'Room request failed.'), { status: response.status });
      return data;
    } catch (error) {
      if (controller?.signal.aborted) throw new Error('The server took too long to respond. Try again.');
      throw error;
    } finally {
      if (timeout !== null) clearTimeout(timeout);
    }
  }

  function roomTxKey(id, address) {
    return id + ':' + address;
  }

  function keepRoom(incoming, select = false) {
    if (rooms.removed.has(incoming.id)) return;
    const member = incoming.members.find(item => item.address === rooms.account);
    if (!member) return;
    const cached = rooms.list.get(incoming.id);
    const selected = select || state.trip?.id === incoming.id;
    const current = cached?.version > incoming.version ? cached : incoming;
    const previousAddress = cached?.fuji?.address;
    const tx = rooms.transactions[roomTxKey(incoming.id, rooms.account)];
    const next = { ...current, fuji: tx ? { ...current.fuji, lastTx: tx } : current.fuji };
    const changed = !cached || JSON.stringify(cached) !== JSON.stringify(next);
    if (changed) rooms.list.set(next.id, next);
    if (selected && (changed || select)) {
      if (select && state.trip?.id !== next.id) state.view = 'overview';
      state.trip = next;
      state.actor = member.id;
    }
    if (changed || select) {
      render();
      const billDetail = selected && !rooms.busy && sheet.open && sheet.querySelector('[data-bill-review]');
      if (billDetail) roomBillDetail(Number(billDetail.dataset.billReview));
    }
    if (selected && next.fuji?.address && (select || previousAddress !== next.fuji.address || cached?.settled !== next.settled)) refreshVault();
    if (selected && (select || cached?.version !== next.version)) refreshRoomFunding();
  }

  function forgetRoom(id, message = '') {
    rooms.removed.add(id);
    selectedTrips.delete(id);
    const listed = rooms.list.delete(id);
    if (state.trip?.id === id) selectTrip(null);
    else if (listed) render();
    if (message) notice(message);
  }

  function clearRoomSession() {
    clearTripSelection();
    rooms.account = '';
    rooms.token = '';
    rooms.list.clear();
    rooms.reminders = [];
    roomStorage(ROOM_AUTH_KEY, null);
    if (state.trip?.shared) {
      if (sheet.open) sheet.close();
      state.trip = null;
      state.actor = null;
      state.view = 'overview';
    }
    render();
  }

  function expireRoomSignIn() {
    rooms.token = '';
    roomStorage(ROOM_AUTH_KEY, null);
    if (!state.trip?.shared || rooms.account !== walletSession.account) clearRoomSession();
    else render();
  }

  async function syncRooms() {
    const token = rooms.token;
    if (!token || rooms.account !== walletSession.account) return false;
    if (rooms.refreshing?.token === token) return rooms.refreshing.promise;
    const known = new Map(rooms.list);
    const refresh = { token, promise: loadRooms(token, known) };
    rooms.refreshing = refresh;
    try {
      return await refresh.promise;
    } finally {
      if (rooms.refreshing === refresh) rooms.refreshing = null;
    }
  }

  async function loadRooms(token, known) {
    try {
      const { rooms: active, reminders = [] } = await roomApi('/rooms', undefined, token, 8000);
      if (token !== rooms.token || rooms.account !== walletSession.account) return false;
      const previousNotifications = notificationIds();
      const remindersChanged = JSON.stringify(rooms.reminders) !== JSON.stringify(reminders);
      rooms.reminders = reminders;
      const current = new Set(active.map(room => room.id));
      for (const room of active) keepRoom(room);
      for (const [id, snapshot] of known) {
        if (!current.has(id) && rooms.list.get(id) === snapshot) {
          forgetRoom(id, state.trip?.id === id ? 'The organizer deleted this trip.' : '');
        }
      }
      if (remindersChanged) {
        render();
        if (rooms.reminders.some(reminder => reminder.roomId === state.trip?.id)) refreshRoomFunding();
      }
      updateRoomNotifications(previousNotifications);
      return true;
    } catch (error) {
      if (token === rooms.token && error.status === 401) {
        expireRoomSignIn();
        notice('Room sign-in expired. Sign in again with your wallet.');
      }
      return false;
    }
  }

  function pollRooms() {
    clearTimeout(rooms.timer);
    if (!rooms.online || !rooms.token) return;
    rooms.timer = setTimeout(async () => {
      await syncRooms();
      if (state.trip?.shared && (['overview', 'bills'].includes(state.view)
        || rooms.reminders.some(reminder => reminder.roomId === state.trip.id))
        && Date.now() - rooms.lastFundingPoll >= 6000) {
        rooms.lastFundingPoll = Date.now();
        refreshRoomFunding();
      }
      if (state.trip?.shared && state.trip.fuji?.address
        && (['wallet', 'split'].includes(state.view)
          || (state.view === 'overview' && roomEndTime(state.trip) <= Date.now() && !state.trip.settled))
        && !walletSession.busy && Date.now() - rooms.lastVaultPoll >= 6000) {
        rooms.lastVaultPoll = Date.now();
        refreshVault(true);
      }
      pollRooms();
    }, 2000);
  }

  function roomWalletChanged() {
    if (!rooms.online) return;
    const account = walletSession.account;
    if (rooms.account && account !== rooms.account) clearRoomSession();
    const saved = roomStorage(ROOM_AUTH_KEY);
    if (account && !rooms.token && saved?.address === account && typeof saved.token === 'string') {
      rooms.account = account;
      rooms.token = saved.token;
      syncRooms();
      pollRooms();
    }
    if (rooms.intent) showRoomIntent();
  }

  async function enableRooms() {
    if (!['http:', 'https:'].includes(window.location?.protocol)) return;
    try {
      const status = await roomApi('/health');
      if (status.rooms !== true) return;
      rooms.online = true;
      rooms.canDelete = status.deleteTrip === true;
      rooms.canBulkDelete = status.bulkDelete === true;
      rooms.canEnd = status.endTrip === true;
      rooms.canSendTopUpReminders = status.topUpReminders === true;
      rooms.canSaveCancellationReason = status.billCancellationReason === true;
      rooms.canRespondToSuggestions = status.suggestionResponses === true;
      rooms.transactions = roomStorage(ROOM_TX_KEY) || {};
      roomWalletChanged();
      const invite = new URLSearchParams(window.location.search).get('join');
      if (invite) {
        if (!/^(?:\d{6}|[A-Za-z0-9_-]{32})$/.test(invite)) {
          notice('This invitation is invalid.');
        } else {
          if (guideOpen && sheet.open) pendingGuideInvite = invite;
          else startRoomFlow('join', invite);
        }
      }
      window.addEventListener('focus', syncRooms);
      window.addEventListener('pageshow', syncRooms);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') syncRooms();
      });
      render();
    } catch {
      // The standalone HTML still supports the local demo.
    }
  }

  function walletAuthMessage(message) {
    return '0x' + Array.from(new TextEncoder().encode(message), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function signPersonalMessage(provider, message, account) {
    const hex = walletAuthMessage(message);
    const checksummed = message.split('\n')[1] || account;
    const attempts = [
      [hex, checksummed],
      [hex, account],
      [checksummed, hex],
      [account, hex],
      [message, checksummed],
      [message, account],
    ];
    let lastError = null;
    for (const params of attempts) {
      try {
        return await request(provider, 'personal_sign', params);
      } catch (err) {
        lastError = err;
        if (err?.code === 4001 || Number(err?.code) === 4100 || err?.code === 'ACTION_REJECTED') throw err;
      }
    }
    throw lastError;
  }

  async function authenticateRoomWallet() {
    const context = walletContext();
    await checkWallet(context);
    if (rooms.token && rooms.account === context.account) return rooms.token;
    const challenge = await roomApi('/auth/challenge', { address: context.account }, '');
    await checkWallet(context);
    const signature = await signPersonalMessage(context.provider, challenge.message, context.account);
    await checkWallet(context);
    const auth = await roomApi('/auth/verify', { nonce: challenge.nonce, signature }, '');
    if (auth.address !== walletSession.account) throw new Error('The wallet account changed. Try again.');
    rooms.account = auth.address;
    rooms.token = auth.token;
    roomStorage(ROOM_AUTH_KEY, auth);
    pollRooms();
    return auth.token;
  }

  function startRoomFlow(kind, key = '', template = null) {
    if (!rooms.online) {
      sheetOpen('TripVault Rooms', 'Open the room server',
        '<p class="notice">Open the TripVault Rooms launcher to create or join a shared room.</p>');
      return;
    }
    rooms.intent = { kind, key, template };
    showRoomIntent();
  }

  function openReplacementTrip(trip) {
    if (!isRoomOrganizer(trip) || !roomDeadlinePassed(trip) || trip.fuji?.address) return;
    startRoomFlow('create', '', {
      name: trip.name,
      location: trip.location,
      minimum: trip.minimumUnits / USDC_SCALE,
      displayName: member(state.actor)?.name,
    });
  }

  function localDatetimeValue(minutesFromNow) {
    const d = new Date(Date.now() + minutesFromNow * 60 * 1000);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatRelativeDuration(ms) {
    if (ms <= 0) return '0p';
    if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))} phút`;
    if (ms < 86_400_000) {
      const h = Math.floor(ms / 3_600_000);
      const m = Math.round((ms % 3_600_000) / 60_000);
      return m > 0 ? `${h}h ${m}p` : `${h} giờ`;
    }
    const days = (ms / 86_400_000).toFixed(1).replace('.0', '');
    return `${days} ngày`;
  }

  function formatTimeSimple(d) {
    if (!d || isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} (${pad(d.getDate())}/${pad(d.getMonth() + 1)})`;
  }

  function updateRoomTimeTimeline(form = sheet.querySelector('#room-form')) {
    if (!form) return;
    const container = form.querySelector('#room-time-timeline');
    if (!container) return;
    const deadlineInput = form.querySelector('input[name="depositDeadline"]');
    const startInput = form.querySelector('input[name="startTime"]');
    const endInput = form.querySelector('input[name="endTime"]');
    if (!deadlineInput || !startInput || !endInput) return;

    const nowLocal = localDatetimeValue(0);
    deadlineInput.min = nowLocal;
    if (deadlineInput.value) startInput.min = deadlineInput.value;
    if (startInput.value) endInput.min = startInput.value;

    const dVal = deadlineInput.value ? new Date(deadlineInput.value) : null;
    const sVal = startInput.value ? new Date(startInput.value) : null;
    const eVal = endInput.value ? new Date(endInput.value) : null;

    if (!dVal || !sVal || !eVal || isNaN(dVal.getTime()) || isNaN(sVal.getTime()) || isNaN(eVal.getTime())) {
      container.innerHTML = '<p class="notice" style="margin:0;">Vui lòng chọn đủ 3 mốc thời gian để xem tiến trình.</p>';
      return;
    }

    const now = Date.now();
    let error = '';
    if (dVal.getTime() <= now) {
      error = '⚠️ Hạn nạp tiền phải ở thời điểm tương lai.';
      deadlineInput.setAttribute('aria-invalid', 'true');
    } else {
      deadlineInput.removeAttribute('aria-invalid');
    }

    if (sVal.getTime() < dVal.getTime()) {
      error = '⚠️ Giờ bắt đầu chuyến đi phải sau hạn nạp quỹ.';
      startInput.setAttribute('aria-invalid', 'true');
    } else {
      startInput.removeAttribute('aria-invalid');
    }

    if (eVal.getTime() <= sVal.getTime()) {
      error = '⚠️ Giờ kết thúc phải sau giờ bắt đầu.';
      endInput.setAttribute('aria-invalid', 'true');
    } else {
      endInput.removeAttribute('aria-invalid');
    }

    const tzOffsetMinutes = -new Date().getTimezoneOffset();
    const tzSign = tzOffsetMinutes >= 0 ? '+' : '-';
    const tzHours = Math.floor(Math.abs(tzOffsetMinutes) / 60);
    const tzString = `GMT${tzSign}${tzHours}`;

    if (error) {
      container.innerHTML = `<div class="timeline-header">
          <span>⏱️ Tiến trình thời gian</span>
          <span class="timeline-badge">${tzString}</span>
        </div>
        <div class="timeline-error">${error}</div>`;
      return;
    }

    const depositWindow = formatRelativeDuration(dVal.getTime() - now);
    const tripDuration = formatRelativeDuration(eVal.getTime() - sVal.getTime());

    container.innerHTML = `<div class="timeline-header">
        <span>⏱️ Tiến trình thời gian (Dự kiến)</span>
        <span class="timeline-badge">${tzString}</span>
      </div>
      <div class="timeline-items">
        <div class="timeline-item">
          <strong>⏳ Hạn nạp tiền</strong>
          <span>${formatTimeSimple(dVal)}</span>
          <span style="color:var(--accent-dark); font-weight:600;">(còn ${depositWindow})</span>
        </div>
        <div class="timeline-arrow">→</div>
        <div class="timeline-item">
          <strong>🚀 Khởi hành</strong>
          <span>${formatTimeSimple(sVal)}</span>
          <span>(Mở hóa đơn & top-up)</span>
        </div>
        <div class="timeline-arrow">→</div>
        <div class="timeline-item">
          <strong>🏁 Chốt sổ & Chia tiền</strong>
          <span>${formatTimeSimple(eVal)}</span>
          <span style="color:var(--positive); font-weight:600;">(Thời lượng: ${tripDuration})</span>
        </div>
      </div>`;
  }

  let customDtState = {
    targetName: null,
    targetInput: null,
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
    selectedYear: new Date().getFullYear(),
    selectedMonth: new Date().getMonth(),
    selectedDay: new Date().getDate(),
    hours: new Date().getHours(),
    minutes: Math.ceil(new Date().getMinutes() / 5) * 5 % 60,
  };

  function openCustomDateTimePicker(targetName, inputElement) {
    if (!inputElement) return;
    const now = new Date();
    customDtState.targetName = targetName;
    customDtState.targetInput = inputElement;

    if (inputElement.value) {
      const cur = new Date(inputElement.value);
      if (!isNaN(cur.getTime())) {
        customDtState.viewYear = cur.getFullYear();
        customDtState.viewMonth = cur.getMonth();
        customDtState.selectedYear = cur.getFullYear();
        customDtState.selectedMonth = cur.getMonth();
        customDtState.selectedDay = cur.getDate();
        customDtState.hours = cur.getHours();
        customDtState.minutes = cur.getMinutes();
      }
    } else {
      customDtState.viewYear = now.getFullYear();
      customDtState.viewMonth = now.getMonth();
      customDtState.selectedYear = now.getFullYear();
      customDtState.selectedMonth = now.getMonth();
      customDtState.selectedDay = now.getDate();
      customDtState.hours = now.getHours();
      customDtState.minutes = Math.ceil(now.getMinutes() / 5) * 5 % 60;
    }

    renderCustomDtPickerModal();
  }

  function closeCustomDateTimePicker() {
    const overlay = document.getElementById('custom-dt-picker-overlay');
    if (overlay) overlay.remove();
    customDtState.targetInput = null;
  }

  function renderCustomDtPickerModal() {
    let overlay = sheet ? sheet.querySelector('#custom-dt-picker-overlay') : document.getElementById('custom-dt-picker-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'custom-dt-picker-overlay';
      overlay.className = 'custom-dt-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Chọn thời gian');
      if (sheet) sheet.appendChild(overlay);
      else document.body.appendChild(overlay);

      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeCustomDateTimePicker();
      });
    }

    const vi = siteLanguage === 'vi';
    const monthNames = vi
      ? ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12']
      : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const weekDays = vi ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    const fieldTitles = {
      depositDeadline: vi ? '⏳ Hạn chốt nạp quỹ' : '⏳ Deposit Deadline',
      startTime: vi ? '🚀 Giờ khởi hành' : '🚀 Trip Start Time',
      endTime: vi ? '🏁 Giờ kết thúc chuyến đi' : '🏁 Trip End Time',
    };
    const titleText = fieldTitles[customDtState.targetName] || (vi ? 'Chọn thời gian' : 'Select Date & Time');

    const year = customDtState.viewYear;
    const month = customDtState.viewMonth;
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = now.getMonth();
    const todayD = now.getDate();

    let gridHtml = '';
    for (let i = 0; i < firstDay; i++) {
      gridHtml += '<span class="custom-dt-weekday"></span>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isPast = new Date(year, month, day, 23, 59, 59) < now;
      const isSelected = (year === customDtState.selectedYear && month === customDtState.selectedMonth && day === customDtState.selectedDay);
      const isToday = (year === todayY && month === todayM && day === todayD);
      const classes = ['custom-dt-day'];
      if (isSelected) classes.push('selected');
      if (isToday) classes.push('today');

      gridHtml += `<button type="button" class="${classes.join(' ')}"${isPast ? ' disabled' : ''} data-dt-act="select-day" data-day="${day}">${day}</button>`;
    }

    const pad = n => String(n).padStart(2, '0');
    const hoursStr = pad(customDtState.hours);
    const minStr = pad(customDtState.minutes);

    const tzOffsetMinutes = -new Date().getTimezoneOffset();
    const tzSign = tzOffsetMinutes >= 0 ? '+' : '-';
    const tzHours = Math.floor(Math.abs(tzOffsetMinutes) / 60);
    const tzString = `GMT${tzSign}${tzHours}`;

    overlay.innerHTML = `
      <div class="custom-dt-card" role="document">
        <div class="custom-dt-head">
          <h3>${titleText}</h3>
          <button type="button" class="btn ghost" style="width:32px;height:32px;padding:0;min-height:0;" data-dt-act="cancel" aria-label="Đóng">✕</button>
        </div>
        <div class="custom-dt-month-nav">
          <button type="button" class="custom-dt-nav-btn" data-dt-act="prev-month" aria-label="Tháng trước">‹</button>
          <strong>${monthNames[month]} ${year}</strong>
          <button type="button" class="custom-dt-nav-btn" data-dt-act="next-month" aria-label="Tháng sau">›</button>
        </div>
        <div class="custom-dt-grid" role="grid">
          ${weekDays.map(w => `<span class="custom-dt-weekday">${w}</span>`).join('')}
          ${gridHtml}
        </div>
        <div class="custom-dt-time-section">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:12px; font-weight:700; color:var(--muted);">${vi ? '🕒 GIỜ VÀ PHÚT:' : '🕒 TIME (HOURS : MINS):'}</span>
            <span class="timeline-badge">${tzString}</span>
          </div>
          <div class="custom-dt-time-steppers">
            <div class="custom-dt-stepper">
              <button type="button" class="custom-dt-stepper-btn" data-dt-act="hour-minus" aria-label="Giảm giờ">−</button>
              <span class="custom-dt-stepper-value">${hoursStr}</span>
              <button type="button" class="custom-dt-stepper-btn" data-dt-act="hour-plus" aria-label="Tăng giờ">+</button>
            </div>
            <span class="custom-dt-colon">:</span>
            <div class="custom-dt-stepper">
              <button type="button" class="custom-dt-stepper-btn" data-dt-act="min-minus" aria-label="Giảm phút">−</button>
              <span class="custom-dt-stepper-value">${minStr}</span>
              <button type="button" class="custom-dt-stepper-btn" data-dt-act="min-plus" aria-label="Tăng phút">+</button>
            </div>
          </div>
          <div class="custom-dt-quick-strip">
            <button type="button" class="custom-dt-quick-btn" data-dt-act="quick-add" data-min="120">+2h</button>
            <button type="button" class="custom-dt-quick-btn" data-dt-act="quick-add" data-min="1440">+1d</button>
            <button type="button" class="custom-dt-quick-btn" data-dt-act="quick-add" data-min="4320">+3d</button>
            <button type="button" class="custom-dt-quick-btn" data-dt-act="quick-add" data-min="10080">+7d</button>
            <button type="button" class="custom-dt-quick-btn" data-dt-act="quick-eod">23:59</button>
          </div>
        </div>
        <div class="custom-dt-footer">
          <button type="button" class="btn secondary" data-dt-act="cancel">${vi ? 'Hủy' : 'Cancel'}</button>
          <button type="button" class="btn" data-dt-act="confirm">${vi ? 'Áp dụng' : 'Apply'}</button>
        </div>
      </div>
    `;

    overlay.onclick = e => {
      const btn = e.target.closest('[data-dt-act]');
      if (!btn) {
        if (!e.target.closest('.custom-dt-card')) closeCustomDateTimePicker();
        return;
      }
      e.stopPropagation();
      const act = btn.dataset.dtAct;
      if (act === 'cancel') {
        closeCustomDateTimePicker();
      } else if (act === 'confirm') {
        const p = n => String(n).padStart(2, '0');
        const formatted = `${customDtState.selectedYear}-${p(customDtState.selectedMonth + 1)}-${p(customDtState.selectedDay)}T${p(customDtState.hours)}:${p(customDtState.minutes)}`;
        if (customDtState.targetInput) {
          customDtState.targetInput.value = formatted;
          const form = customDtState.targetInput.closest('form');
          if (form) {
            form.querySelectorAll('[data-act="room-preset-time"]').forEach(b => b.setAttribute('aria-pressed', 'false'));
            updateRoomTimeTimeline(form);
          }
        }
        closeCustomDateTimePicker();
      } else if (act === 'prev-month') {
        if (customDtState.viewMonth === 0) {
          customDtState.viewMonth = 11;
          customDtState.viewYear--;
        } else {
          customDtState.viewMonth--;
        }
        renderCustomDtPickerModal();
      } else if (act === 'next-month') {
        if (customDtState.viewMonth === 11) {
          customDtState.viewMonth = 0;
          customDtState.viewYear++;
        } else {
          customDtState.viewMonth++;
        }
        renderCustomDtPickerModal();
      } else if (act === 'select-day') {
        customDtState.selectedYear = customDtState.viewYear;
        customDtState.selectedMonth = customDtState.viewMonth;
        customDtState.selectedDay = Number(btn.dataset.day);
        renderCustomDtPickerModal();
      } else if (act === 'hour-minus') {
        customDtState.hours = (customDtState.hours + 23) % 24;
        renderCustomDtPickerModal();
      } else if (act === 'hour-plus') {
        customDtState.hours = (customDtState.hours + 1) % 24;
        renderCustomDtPickerModal();
      } else if (act === 'min-minus') {
        customDtState.minutes = (customDtState.minutes + 55) % 60;
        renderCustomDtPickerModal();
      } else if (act === 'min-plus') {
        customDtState.minutes = (customDtState.minutes + 5) % 60;
        renderCustomDtPickerModal();
      } else if (act === 'quick-add') {
        const addedMin = Number(btn.dataset.min || 5);
        const baseDate = new Date(customDtState.selectedYear, customDtState.selectedMonth, customDtState.selectedDay, customDtState.hours, customDtState.minutes);
        const newDate = new Date(baseDate.getTime() + addedMin * 60 * 1000);
        customDtState.selectedYear = newDate.getFullYear();
        customDtState.selectedMonth = newDate.getMonth();
        customDtState.viewYear = newDate.getFullYear();
        customDtState.viewMonth = newDate.getMonth();
        customDtState.selectedDay = newDate.getDate();
        customDtState.hours = newDate.getHours();
        customDtState.minutes = newDate.getMinutes();
        renderCustomDtPickerModal();
      } else if (act === 'quick-eod') {
        customDtState.hours = 23;
        customDtState.minutes = 59;
        renderCustomDtPickerModal();
      }
    };
  }

  function applyRoomTimePreset(element) {
    const form = sheet.querySelector('#room-form');
    if (!form) return;
    const d = Number(element?.dataset?.d || 5);
    const s = Number(element?.dataset?.s || 6);
    const e = Number(element?.dataset?.e || 20);
    const deadlineInput = form.querySelector('input[name="depositDeadline"]');
    const startInput = form.querySelector('input[name="startTime"]');
    const endInput = form.querySelector('input[name="endTime"]');
    if (deadlineInput) deadlineInput.value = localDatetimeValue(d);
    if (startInput) startInput.value = localDatetimeValue(s);
    if (endInput) endInput.value = localDatetimeValue(e);

    form.querySelectorAll('[data-act="room-preset-time"]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn === element ? 'true' : 'false');
    });

    updateRoomTimeTimeline(form);
  }

  function showRoomIntent() {
    const intent = rooms.intent;
    if (!intent) return;
    const titles = { create: 'Create a room', join: 'Join a room', signin: 'Sign in to rooms' };
    const title = titles[intent.kind];
    const connected = walletSession.account;
    const fuji = walletSession.chain === FUJI.id;
    if (!connected || !fuji) {
      sheetOpen(title, 'Connect the wallet you will use for this trip',
        '<p class="notice">Members join with a wallet. TripVault asks for a sign-in signature when you continue.</p>',
        btn(connected ? 'Switch to Fuji' : 'Connect Wallet', connected ? 'fuji-switch' : 'fuji-connect',
          { tone: 'full' }),
      );
      return;
    }
    const template = intent.template;
    const name = `<label class="field">Your display name <input name="displayName" maxlength="40" placeholder="Optional" value="${safe(template?.displayName)}"></label>`;
    const wallet = '<p class="notice">Wallet: ' + safe(connected) + '</p>';
    let fields = '';
    if (intent.kind === 'create') {
      const defaultDeadline = template?.depositDeadline ? safe(template.depositDeadline.slice(0, 16)) : (template ? '' : localDatetimeValue(120));
      const defaultStart = template?.startTime ? safe(template.startTime.slice(0, 16)) : (template ? '' : localDatetimeValue(125));
      const defaultEnd = template?.endTime ? safe(template.endTime.slice(0, 16)) : (template ? '' : localDatetimeValue(1440));
      const vi = siteLanguage === 'vi';
      const orientationNotice = `<div class="notice app-orientation-notice" style="margin-bottom:14px; font-size:13.5px; border-left:4px solid var(--accent); background:rgba(0,180,216,0.08); padding:12px 14px; border-radius:12px;">
        <strong>🎯 ${vi ? 'Mục đích sử dụng:' : 'Purpose:'}</strong> ${vi ? 'TripVault chuyên dụng cho các chuyến đi và sự kiện trọn vẹn từ <b>1 ngày trở lên</b> có quỹ ký quỹ bảo chứng (không dùng chia tiền lẻ tức thời).' : 'TripVault is dedicated to multi-day trips and complete group events (<b>≥ 1 day</b>) with locked escrow vaults (not for instant single-bill splits).'}
      </div>`;
      fields = `${template ? '<p class="notice">Choose a new deposit deadline and trip dates. This creates a room with a new invite code. Invite your group again before setting up the vault.</p>' : ''}
        ${orientationNotice}
        <label class="field">Trip name<input name="name" required maxlength="70" placeholder="e.g. Da Lat weekend" value="${safe(template?.name)}"></label>
        <label class="field">Destination<input name="location" maxlength="80" value="${safe(template?.location)}"></label>
        ${name}
        <label class="field">Minimum each person adds (test USDC)<input name="minimum" type="number" min="0.000001" step="0.000001" required value="${safe(template?.minimum ?? 5)}"></label>
        <div class="stack" style="gap:6px; margin:4px 0 8px 0;">
          <span style="font-size:12px; font-weight:700; color:var(--muted);">${vi ? '⚡ Chọn nhanh mốc thời gian:' : '⚡ Quick trip duration presets:'}</span>
          <div class="room-time-presets" role="group" aria-label="Quick trip presets">
            <button type="button" class="btn soft" aria-pressed="true" data-act="room-preset-time" data-d="120" data-s="125" data-e="1440">${vi ? '🏖️ 1 ngày (Hạn nạp 2h → Chuyến 1 ngày)' : '🏖️ 1 Day (2h deposit → 1d trip)'}</button>
            <button type="button" class="btn soft" aria-pressed="false" data-act="room-preset-time" data-d="1440" data-s="1445" data-e="4320">${vi ? '🏕️ 3 ngày (Chuyến đi cuối tuần)' : '🏕️ 3 Days (Weekend trip)'}</button>
            <button type="button" class="btn soft" aria-pressed="false" data-act="room-preset-time" data-d="1440" data-s="1445" data-e="10080">${vi ? '✈️ 7 ngày (Kỳ nghỉ dài ngày)' : '✈️ 7 Days (Long vacation)'}</button>
          </div>
          <div id="room-time-timeline" class="room-time-timeline" aria-live="polite"></div>
        </div>
        <label class="field">Deposit deadline
          <div class="datetime-input-wrapper">
            <input name="depositDeadline" type="datetime-local" required aria-describedby="room-deadline-help"${defaultDeadline ? ` value="${defaultDeadline}"` : ''}>
            <button type="button" class="datetime-calendar-badge" data-dt-target="depositDeadline" title="Chọn thời gian nhanh" aria-label="Mở bộ chọn lịch và giờ"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="pointer-events:none;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></button>
          </div>
          <small id="room-deadline-help">Before this time, members can add funds or take back their own deposit. The trip is cancelled if anyone is below the minimum at the deadline.</small>
        </label>
        <label class="field">Trip start
          <div class="datetime-input-wrapper">
            <input name="startTime" type="datetime-local" required aria-describedby="room-start-help"${defaultStart ? ` value="${defaultStart}"` : ''}>
            <button type="button" class="datetime-calendar-badge" data-dt-target="startTime" title="Chọn thời gian nhanh" aria-label="Mở bộ chọn lịch và giờ"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="pointer-events:none;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></button>
          </div>
          <small id="room-start-help">If everyone has funded on time, bills and top-ups open at the scheduled start.</small>
        </label>
        <label class="field">Trip end
          <div class="datetime-input-wrapper">
            <input name="endTime" type="datetime-local" required aria-describedby="room-end-help"${defaultEnd ? ` value="${defaultEnd}"` : ''}>
            <button type="button" class="datetime-calendar-badge" data-dt-target="endTime" title="Chọn thời gian nhanh" aria-label="Mở bộ chọn lịch và giờ"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="pointer-events:none;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></button>
          </div>
          <small id="room-end-help">After this time, the organizer can share the final amounts for approval and make group payments when everyone is ready.</small>
        </label>`;
    } else if (intent.kind === 'join') {
      const fromLink = /^[A-Za-z0-9_-]{32}$/.test(intent.key);
      fields = fromLink
        ? '<input name="key" type="hidden" value="' + safe(intent.key) + '">' + name
        : `<label class="field">Six-digit room code<input name="key" inputmode="numeric" autocomplete="off"
            pattern="[0-9]{6}" minlength="6" maxlength="6" required value="${safe(intent.key)}"></label>${name}`;
    }
    sheetOpen(title, 'Avalanche Fuji',
      `<form class="stack" id="room-form">${wallet}${fields}
        <p id="sheet-error" class="form-error" role="status"></p>
        <div data-wallet-access-recovery hidden>${btn('Allow wallet access', 'room-wallet-access', { tone: 'secondary' })}</div>
      </form>`,
      '<button class="btn full" type="submit" form="room-form">' + title + '</button>',
    );
    if (intent.kind === 'create') {
      const roomForm = sheet.querySelector('#room-form');
      if (roomForm) {
        updateRoomTimeTimeline(roomForm);
        roomForm.addEventListener('input', e => {
          if (['depositDeadline', 'startTime', 'endTime'].includes(e.target.name)) {
            roomForm.querySelectorAll('[data-act="room-preset-time"]').forEach(btn => btn.setAttribute('aria-pressed', 'false'));
            updateRoomTimeTimeline(roomForm);
          }
        });

        roomForm.addEventListener('click', e => {
          const badge = e.target.closest('.datetime-calendar-badge');
          if (badge) {
            e.preventDefault();
            const targetName = badge.dataset.dtTarget;
            const inp = roomForm.querySelector(`input[name="${targetName}"]`);
            if (inp) openCustomDateTimePicker(targetName, inp);
          }
        });
      }
    }
  }

  async function restoreRoomWalletAccess() {
    const context = walletContext();
    if (!context.provider || rooms.busy || walletSession.busy) return;
    const form = sheet.querySelector('#room-form');
    const message = form?.querySelector('#sheet-error');
    rooms.busy = true;
    try {
      const accounts = await request(context.provider, 'eth_requestAccounts');
      if (walletSession.provider !== context.provider) return;
      if (accounts?.[0]?.toLowerCase() !== context.account) {
        await syncWallet(context.provider);
        return;
      }
      if (message) message.textContent = ui('Wallet access restored. Try again and approve the sign-in signature.');
      const recovery = form?.querySelector('[data-wallet-access-recovery]');
      if (recovery) recovery.hidden = true;
    } catch (error) {
      if (message) message.textContent = ui(walletError(error));
    } finally {
      rooms.busy = false;
    }
  }

  async function submitRoomForm(data, fail) {
    const intent = rooms.intent;
    if (!intent || rooms.busy) return;
    const name = String(data.get('displayName') || '').trim();
    const button = sheet.querySelector('button[form="room-form"]');
    let body;
    if (intent.kind === 'create') {
      body = {
        name: String(data.get('name') || ''), location: String(data.get('location') || ''),
        displayName: name, minimumUnits: parseUnits(data.get('minimum')),
        deadline: Date.parse(String(data.get('depositDeadline') || '')),
        start: Date.parse(String(data.get('startTime') || '')),
        end: Date.parse(String(data.get('endTime') || '')),
      };
      if (!body.minimumUnits || !Number.isFinite(body.deadline) || !Number.isFinite(body.start) || !Number.isFinite(body.end)
        || body.deadline <= Date.now() || body.deadline >= body.start || body.start >= body.end) {
        fail('Set a minimum above zero, then choose a future deadline, a later start, and an end after the start.');
        return;
      }
    } else if (intent.kind === 'join') {
      const key = String(data.get('key') || '').trim();
      if (!/^(?:\d{6}|[A-Za-z0-9_-]{32})$/.test(key)) return fail('Enter the six-digit code from your organizer.');
      body = { key, displayName: name };
    }
    rooms.busy = true;
    if (button) button.disabled = true;
    fail(rooms.token ? 'Opening room…' : 'Confirm the sign-in request in your wallet.');
    try {
      const token = await authenticateRoomWallet();
      if (intent.kind === 'signin') {
        await syncRooms();
      } else {
        const room = await roomApi(intent.kind === 'create' ? '/rooms' : '/rooms/join', body, token);
        if (token !== rooms.token || rooms.account !== walletSession.account) return;
        keepRoom(room, true);
      }
      if (rooms.intent === intent) {
        rooms.intent = null;
        if (sheet.open) sheet.close();
        if (window.history && new URLSearchParams(window.location.search).has('join')) {
          const url = new URL(window.location.href);
          url.searchParams.delete('join');
          window.history.replaceState(null, '', url);
        }
        if (intent.kind === 'join' && state.trip?.shared) showJoinedRoomGuide(state.trip);
      }
      notice(intent.kind === 'create' ? 'Room created. Share the link or six-digit code.'
        : intent.kind === 'join' ? 'You joined the room.' : 'Signed in to TripVault rooms.');
    } catch (error) {
      if (error.status === 401 && rooms.token) clearRoomSession();
      const recovery = sheet.querySelector('[data-wallet-access-recovery]');
      if (recovery && walletAccessDenied(error)) recovery.hidden = false;
      fail(walletError(error));
    } finally {
      rooms.busy = false;
      if (button) button.disabled = false;
    }
  }

  async function changeRoom(trip, type, fields = {}, completed, fail = notice) {
    if (rooms.busy || !trip.shared) return null;
    if (!rooms.token || rooms.account !== walletSession.account) {
      return fail('Sign in again with the same wallet, then retry.');
    }
    const token = rooms.token;
    rooms.busy = true;
    const savingBill = type === 'bill.add' || type === 'bill.edit';
    const reviewAction = ['bill.approve', 'bill.feedback', 'bill.feedback-vote'].includes(type);
    const timeout = type === 'bill.feedback' ? 15000 : 0;
    const payload = version => ({ type, version, ...fields });
    const path = '/rooms/' + trip.id + '/actions';
    if (savingBill) updateBillFundingForm();
    try {
      let room;
      try {
        room = await roomApi(path, payload(trip.version), token, timeout);
      } catch (error) {
        if (!reviewAction || error.status !== 409 || !await syncRooms()) throw error;
        const latest = rooms.list.get(trip.id);
        const originalBill = trip.bills.find(bill => bill.id === fields.id);
        const latestBill = latest?.bills.find(bill => bill.id === fields.id);
        if (token !== rooms.token || trip.id !== state.trip?.id || !latest || latest.version <= trip.version
          || !sameBillReview(originalBill, latestBill) || latest.reviewQuote || latest.settled) throw error;
        room = await roomApi(path, payload(latest.version), token, timeout);
      }
      if (token !== rooms.token || rooms.account !== walletSession.account) return null;
      keepRoom(room);
      completed?.(state.trip?.id === room.id ? state.trip : null);
      return room;
    } catch (error) {
      if (error.status === 401) expireRoomSignIn();
      else if (error.status === 409) await syncRooms();
      if (savingBill) refreshRoomFunding();
      fail(walletError(error));
      return null;
    } finally {
      rooms.busy = false;
      if (savingBill) updateBillFundingForm();
    }
  }

  async function reauthenticateRoom() {
    const trip = state.trip;
    if (!trip?.shared || rooms.busy) return;
    if (!walletSession.account || rooms.account !== walletSession.account) {
      return notice('Reconnect the same wallet to continue.');
    }
    const errorText = sheet.querySelector('#sheet-error, #bill-review-error');
    rooms.busy = true;
    try {
      await authenticateRoomWallet();
      await syncRooms();
      if (errorText) errorText.textContent = ui('Signed in. You can retry your action.');
      notice('Signed in. You can retry your action.');
    } catch (error) {
      if (errorText) errorText.textContent = ui(walletError(error));
      notice(walletError(error));
    } finally {
      rooms.busy = false;
      render();
    }
  }

  function roomEndTime(trip) {
    return Date.parse(trip.endedAt || trip.endTime);
  }

  function canEditRoomDisplayName(trip) {
    return Boolean(trip?.shared && rooms.account && rooms.account === walletSession.account
      && trip.members.some(item => item.id === state.actor && item.address === rooms.account));
  }

  function canRenameTrip(trip) {
    return isRoomOrganizer(trip) && !trip.settled
      && Date.now() < Math.min(Date.parse(trip.depositDeadline || trip.startTime), roomEndTime(trip));
  }

  function showRoomRename(trip, kind) {
    const renameTrip = kind === 'room-rename';
    if (renameTrip ? !canRenameTrip(trip) : !canEditRoomDisplayName(trip)) return;
    const current = renameTrip ? trip.name : member(state.actor)?.name;
    const label = renameTrip ? 'Trip name' : 'Your display name';
    sheetOpen(renameTrip ? 'Rename trip' : 'Edit your display name', { user: trip.name }, `<form method="dialog" id="room-rename-form" class="stack">
      <input type="hidden" name="kind" value="${kind}">
      <label class="field">${label}<input name="name" maxlength="${renameTrip ? 70 : 40}" value="${safe(current)}" required autofocus></label>
      <p id="sheet-error" class="form-error" role="status"></p>
      ${billSignInButton()}
    </form>`, '<button class="btn full" type="submit" form="room-rename-form">Save name</button>');
  }

  function submitRoomRename(data, fail) {
    const trip = state.trip;
    const renameTrip = data.get('kind') === 'room-rename';
    if (renameTrip && !canRenameTrip(trip)) return fail('The trip name can only be changed before the deposit deadline.');
    if (!renameTrip && !canEditRoomDisplayName(trip)) return fail('Reconnect the same wallet to continue.');
    const type = renameTrip ? 'room.rename' : 'room.rename-member';
    changeRoom(trip, type, { name: String(data.get('name') || '') }, updated => {
      if (updated && sheet.open) sheet.close();
      if (updated) notice('Name updated.');
    }, fail);
  }

  function roomBillsClosed(trip) {
    return Boolean(trip.shared && (trip.billsClosedAt || Date.now() >= roomEndTime(trip)));
  }

  function roomDeadlinePassed(trip) {
    return Boolean(trip?.depositDeadline && Date.parse(trip.depositDeadline) <= Date.now());
  }

  function roomFundingCancelled(trip) {
    return Boolean(trip?.depositDeadline && ((state.trip?.id === trip.id && currentVault()?.cancelled)
      || getDisplayedFunding(trip)?.cancelled || (!trip.fuji?.address && roomDeadlinePassed(trip))));
  }

  function formatTripTime(timestamp) {
    return new Intl.DateTimeFormat(siteLanguage === 'vi' ? 'vi-VN' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    }).format(timestamp);
  }

  function formatTripTimeSpacious(value) {
    if (!value) return '';
    const date = typeof value === 'object' && value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return String(value);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatShortDateTime(value) {
    return formatTripTimeSpacious(value);
  }

  function formatFxShortTime(raw) {
    if (!raw) return '';
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const pad = n => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return String(raw);
  }

  function fxRowValue(quote) {
    if (!quote) return '';
    const rate = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(quote.rate);
    const shortSource = quote.source ? quote.source.replace(/\s+USD\/VND\s+reference/i, '').replace(/\s+reference/i, '') : '';
    const shortTime = quote.updated ? formatFxShortTime(quote.updated) : '';
    const notLiveLabel = quote.live || quote.historical ? '' : 'not live';
    const details = [shortSource, shortTime, notLiveLabel].filter(Boolean)
      .map(detail => `<span class="fx-rate-sub">${safe(ui(detail))}</span>`).join('');
    return `<span class="fx-rate-container"><strong class="fx-rate-primary">${safe(rate)} VND / USD</strong>${details}</span>`;
  }

  function isRoomOrganizer(trip) {
    return Boolean(trip?.shared && rooms.token && rooms.account === walletSession.account
      && trip.members.some(member => member.id === trip.owner && member.address === rooms.account));
  }

  function canDeleteRoom(trip) {
    return rooms.canDelete && isRoomOrganizer(trip);
  }

  function showEarlyEndControl(trip) {
    return rooms.canEnd && isRoomOrganizer(trip) && !trip.settled && roomEndTime(trip) > Date.now()
      && !roomFundingCancelled(trip) && (!trip.fuji?.address || trip.fuji.contractVersion >= 2);
  }

  function canEndRoom(trip) {
    return showEarlyEndControl(trip)
      && (!trip.depositDeadline || (trip.fuji?.address && Date.parse(trip.startTime) <= Date.now()));
  }

  function showEndRoom(trip) {
    if (!canEndRoom(trip) || walletSession.busy || trip.fuji?.lastTx?.phase === 'pending') return;
    sheetOpen('End trip now?', { user: trip.name },
      '<p>Ending the trip closes new bills. Members can finish reviewing existing bills before the group makes final payments.</p>',
      '<div class="inline">' + btn('Cancel', 'close-sheet', { tone: 'secondary' })
        + btn('End trip now', 'room-end-confirm', { tone: 'danger', data: `data-id="${safe(trip.id)}"` }) + '</div>',
    );
  }

  function endRoomNow(trip, id) {
    if (!canEndRoom(trip) || trip.id !== id || walletSession.busy || trip.fuji?.lastTx?.phase === 'pending') return;
    if (sheet.open) sheet.close();
    if (!trip.fuji?.address) {
      return changeRoom(trip, 'room.end', {}, updated => {
        if (updated) notice('Trip ended. Open Final split to review who pays whom.');
      });
    }
    withFuji('End trip on Fuji', async context => {
      const vault = await fetchVault(context);
      if (vault.version < 2 || vault.members[0] !== context.account || vault.timestamp >= vault.end || vault.settled || vault.cancelled) {
        throw new Error('This vault cannot be ended early.');
      }
      await sendFuji(context, 'End trip on Fuji', 'fuji-end', context.vault, vaultCall('endTripEarly()'));
    });
  }

  function showLinkVault(trip) {
    if (!isRoomOrganizer(trip) || !trip.locked || trip.fuji?.address) return;
    sheetOpen('Link existing vault', { user: trip.name },
      `<form class="stack" id="fuji-link-form">
        <p class="notice">If your wallet activity shows a successful Fuji contract deployment for this room, copy its transaction hash.</p>
        <label class="field">Deployment transaction hash<input name="hash" required pattern="0x[0-9a-fA-F]{64}" placeholder="0x…"></label>
        <p id="sheet-error" class="form-error" role="status"></p>
      </form>`,
      '<button class="btn full" type="submit" form="fuji-link-form">Verify and link vault</button>',
    );
  }

  function linkExistingVault(data, fail) {
    const trip = state.trip;
    const hash = String(data.get('hash') || '').trim().toLowerCase();
    if (!isRoomOrganizer(trip) || !trip.locked || trip.fuji?.address || !isHash(hash)) {
      fail('Enter the successful deployment transaction hash for this room.');
      return;
    }
    withFuji('Link existing Fuji vault', async context => {
      try {
        const receipt = await request(context.provider, 'eth_getTransactionReceipt', [hash]);
        if (receipt?.status !== '0x1' || receipt.from?.toLowerCase() !== context.account
          || !isAddress(receipt.contractAddress)) {
          throw new Error('This hash is not a confirmed vault deployment from the organizer wallet.');
        }
        await verifyRoomTransaction(context, { hash, kind: 'deploy', from: context.account });
        if (sheet.open) sheet.close();
        walletStatus(context.tripId, 'confirmed', 'Link existing Fuji vault', 'Vault verified and linked.', hash);
      } catch (error) {
        fail(walletError(error));
        throw error;
      }
    });
  }

  function confirmDeleteRoom(trip) {
    if (!canDeleteRoom(trip) || walletSession.busy || trip.fuji?.lastTx?.phase === 'pending') return;
    sheetOpen('Delete trip?', { user: trip.name },
      `<div class="stack">
        <p>The room, its bills, and the invite will be permanently removed for all members.</p>
        ${trip.fuji?.address
          ? '<p class="notice warn">The Fuji vault must be closed and all members must claim their balances before deletion.</p>'
          : ''}
        <p id="room-delete-error" class="form-error" role="status"></p>
      </div>`,
      '<div class="inline">' + btn('Cancel', 'close-sheet', { tone: 'secondary' }) +
      btn('Delete trip', 'room-delete-confirm', {
        tone: 'danger', data: `data-id="${safe(trip.id)}" data-version="${trip.version}"`,
      }) + '</div>',
    );
  }

  async function deleteConfirmedRoom(trip, selection) {
    if (!canDeleteRoom(trip) || rooms.busy || walletSession.busy || trip.fuji?.lastTx?.phase === 'pending') return;
    const errorMessage = sheet.querySelector('#room-delete-error');
    if (trip.id !== selection.id || String(trip.version) !== selection.version) {
      if (errorMessage) errorMessage.textContent = ui('The room changed. Close this dialog and review the trip again.');
      return;
    }
    const token = rooms.token;
    const button = sheet.querySelector('[data-act="room-delete-confirm"]');
    rooms.busy = true;
    if (button) button.disabled = true;
    if (errorMessage) errorMessage.textContent = '';
    try {
      const result = await roomApi('/rooms/' + trip.id + '/actions',
        { type: 'room.delete', version: trip.version }, token);
      if (!result.deleted || result.id !== trip.id) throw new Error('The server did not confirm deletion.');
      const confirmation = sheet.querySelector('[data-act="room-delete-confirm"]');
      if (sheet.open && confirmation?.dataset.id === trip.id) sheet.close();
      forgetRoom(trip.id, 'Trip deleted.');
    } catch (error) {
      if (token === rooms.token && error.status === 401) clearRoomSession();
      else if (error.status === 404 || error.status === 409) await syncRooms();
      if (errorMessage) errorMessage.textContent = ui(walletError(error));
      else notice(walletError(error));
    } finally {
      rooms.busy = false;
      if (button) button.disabled = false;
    }
  }

  function roomInviteUrl(trip) {
    const url = new URL('/', window.location.origin);
    url.searchParams.set('join', trip.invite);
    return url.href;
  }

  async function copyRoomInvite(trip) {
    if (!trip?.invite || trip.locked) return;
    const link = roomInviteUrl(trip);
    try {
      await navigator.clipboard.writeText(link);
      notice('Invite link copied.');
    } catch {
      const input = document.getElementById('trip-invite-link');
      input?.select();
      notice('Copy the selected invite link.');
    }
  }

  async function copyRoomCode(trip) {
    if (!trip?.code) return;
    try {
      await navigator.clipboard.writeText(trip.code);
      notice('Room code copied: ' + trip.code);
    } catch {
      notice('Room code: ' + trip.code);
    }
  }

  function roomInviteCard(trip) {
    if (trip.locked || roomDeadlinePassed(trip) || !trip.invite || !trip.code) return '';
    return `<section class="panel stack">
      <h2>Invite members</h2>
      <p class="subtitle">Share the link or have members choose Join a room and enter this code.</p>
      <div class="room-code" data-act="room-copy-code" title="Click to copy room code" aria-label="Room code ${safe(trip.code.split('').join(' '))}">${safe(trip.code)}</div>
      <label class="field">Invite link
        <input id="trip-invite-link" type="url" readonly value="${safe(roomInviteUrl(trip))}">
      </label>
      <div class="inline">${btn('Copy invite link', 'room-copy')}${btn('Copy code', 'room-copy-code', { tone: 'secondary' })}</div>
    </section>`;
  }

  function roomTripToolbar(trip) {
    const profile = member(state.actor);
    return `<div class="trip-return">
      ${btn('All trips', 'trip-list', { tone: 'secondary', symbol: 'back' })}
      ${profile ? `<div class="trip-profile">
        ${avatar(profile)}
        <span class="trip-profile-name" translate="no" title="${safe(profile.name)}">${safe(profile.name)}</span>
        ${canEditRoomDisplayName(trip) ? btn('Edit my name', 'room-rename-member', { tone: 'soft rename-member' }) : ''}
      </div>` : ''}
    </div>`;
  }

  function roomMembers(trip) {
    return `<section class="panel">
      <div class="panel-head"><h2>Members</h2><span class="chip">${trip.members.length} of 12</span></div>
      ${trip.members.map(item => `<div class="row">
        <span class="row-label">${avatar(item)}<span><span class="row-name">${userText(item.name)}${item.id === state.actor ? ' · You' : ''}</span>
        <span class="row-sub room-wallet-address">${safe(item.address)}</span></span></span>
        ${item.id === trip.owner ? '<span class="chip violet">Organizer</span>' : ''}
      </div>`).join('')}
    </section>`;
  }

  function roomOverview() {
    const trip = state.trip;
    const end = roomEndTime(trip);
    const start = Date.parse(trip.startTime);
    const deadline = Math.min(start, end);
    return `<div class="stack">
      <section class="hero">
        <span class="chip">${roomFundingCancelled(trip) ? 'Trip cancelled' : trip.settled ? 'Settled on Fuji' : end <= Date.now() ? 'Trip ended'
          : trip.locked ? (Date.now() < start ? 'Getting ready' : 'Trip in progress') : 'Room open'}</span>
        <h1>${userText(trip.name)}</h1>${trip.location ? '<div>' + userText(trip.location) + '</div>' : ''}
      </section>
      ${roomFundBalance(trip)}
      ${roomProgressPanel(trip)}
      ${roomInviteCard(trip)}
      ${roomMembers(trip)}
      <section class="panel trip-settings-panel"><h2>Trip settings</h2>
        ${row('Minimum each person adds', money(trip.minimumUnits))}
        ${trip.depositDeadline ? row('Deposit deadline', formatTripTimeSpacious(Date.parse(trip.depositDeadline)),
          'Everyone must add the minimum by this time. Before then, you can take back your own deposit.')
          + row('Trip start', formatTripTimeSpacious(start), 'The trip starts if everyone funded it before the deadline.')
          : row(end < start ? 'Withdrawals locked early' : 'Deposit deadline and trip start', formatTripTimeSpacious(deadline),
          end < start ? 'The organizer ended the trip before the original deadline.'
            : 'Add the minimum by this time. You can take back your own deposit before the deadline.')}
        ${row(trip.endedAt ? 'Trip ended early' : 'Trip end', formatTripTimeSpacious(end),
          'The organizer can share the final amounts for approval after this time.')}
        ${row('Exchange rate', fxRowValue(trip.reviewQuote || fx))}
        ${row('Settlement', trip.shared ? 'Avalanche Fuji escrow vault' : 'USDC from vault deposits at trip end')}
        ${isRoomOrganizer(trip) ? `<div class="inline trip-settings-actions">
          ${canRenameTrip(trip) ? btn('Rename trip', 'room-rename', { tone: 'secondary' }) : ''}
          ${canDeleteRoom(trip) ? deleteRoomButton(trip) : ''}
        </div>` : ''}
      </section>
    </div>`;
  }

  function deleteRoomButton(trip) {
    return btn('Delete trip', 'room-delete', {
      tone: 'danger', disabled: walletSession.busy || trip.fuji?.lastTx?.phase === 'pending',
      data: `data-id="${safe(trip.id)}" aria-label="${safe('Delete trip ' + trip.name)}"`,
    });
  }

  function tripListRow(trip) {
    const members = trip.members.length;
    const subtitle = members + (members === 1 ? ' member' : ' members') + (trip.shared ? ' · Shared room' : ' · Local demo');
    return `<div class="trip-list-row">
      <span class="row-label">${tripDeletionCheckbox(trip)}<span class="bill-badge">${icon('home')}</span><span>
        <span class="bill-name">${userText(trip.name)}</span>
        <span class="bill-sub">${subtitle}</span>
      </span></span>
      <span class="inline">
        ${btn('Open', 'open-trip', { tone: 'secondary', data: `data-id="${safe(trip.id)}"` })}
        ${!deleteSelectionMode && canDeleteRoom(trip) ? deleteRoomButton(trip) : ''}
      </span>
    </div>`;
  }

  function roomsHome() {
    const trips = availableTrips().slice().reverse();
    const vi = siteLanguage === 'vi';
    const orientationBanner = `<div class="notice app-orientation-notice" style="margin-bottom:14px; font-size:14px; border-left:4px solid var(--accent); background:rgba(232, 65, 66, 0.05); padding:14px 16px; border-radius:14px; box-shadow:var(--shadow-sm); line-height:1.6;">
      <strong>🎯 ${vi ? 'Mục đích của TripVault:' : 'TripVault Purpose:'}</strong> ${vi ? 'Quỹ chung cho các chuyến đi nhiều ngày: nạp tiền trước, ghi hóa đơn trong chuyến đi, và tất toán một lần khi kết thúc.' : 'Shared trip fund: everyone deposits first, you log bills as you go, and the app settles once at the end.'}
    </div>`;
    return `<div class="section-head"><div><h1>Your trips</h1><p>Create a trip or join one with your wallet.</p></div></div>
      <div class="stack">
        ${orientationBanner}
        <section class="panel stack">
        <div class="inline">
          ${btn('Create a trip', 'room-create', { symbol: 'plus' })}
          ${btn('Join a trip', 'room-join', { tone: 'secondary' })}
          ${!rooms.token ? btn('Sign in', 'room-sign-in', { tone: 'ghost' }) : ''}
        </div>
        ${btn('Try a local demo', 'local-demo', { tone: 'ghost' })}
      </section>
      ${trips.length ? '<section class="panel">' + tripSelectionControls() + trips.map(tripListRow).join('') + '</section>'
        : `<section class="panel stack" style="border: 1px dashed var(--tint-border); background: var(--tint);">
            <div class="panel-head">
              <h2 style="color: var(--accent-dark);">Đà Lạt weekend · Demo Room</h2>
              <span class="chip">UI Preview</span>
            </div>
            <p class="subtitle">Experience the full group expense workflow: funding progress, bills, approvals, and settlements.</p>
            <div class="inline">
              ${btn('Open demo trip', 'judge-demo-sample')}
            </div>
          </section>`}
      ${fujiPanel()}
      </div>`;
  }

  function roomLockForDeploy(trip) {
    if (roomDeadlinePassed(trip)) return notice('The deposit deadline has passed.');
    if (trip.locked) return openFujiDeploy();
    sheetOpen('Lock room roster', { user: trip.name },
      '<p class="notice">Lock the member list when everyone has joined. The Fuji vault uses these wallet addresses, and new members cannot join after locking.</p>' +
      roomMembers(trip),
      btn('Lock roster', 'room-freeze', { tone: 'full' }),
    );
  }

  function rememberRoomTransaction(id, tx) {
    rooms.transactions[roomTxKey(id, tx.from)] = tx;
    roomStorage(ROOM_TX_KEY, rooms.transactions);
    const trip = rooms.list.get(id);
    if (!trip || rooms.account !== tx.from) return;
    const next = { ...trip, fuji: { ...trip.fuji, lastTx: tx } };
    rooms.list.set(trip.id, next);
    if (state.trip?.id === trip.id) state.trip = next;
  }

  async function verifyRoomTransaction(context, tx) {
    if (!context.shared
      || !['deploy', 'fuji-publish', 'fuji-settle', 'fuji-end'].includes(tx.kind)) return;
    if (rooms.account !== context.account || !rooms.token) {
      throw new Error('Sign in with the organizer wallet to finish verifying this transaction.');
    }
    const result = await roomApi('/rooms/' + context.tripId + '/chain-proof',
      { hash: tx.hash, kind: tx.kind, revision: tx.revision ? Number(tx.revision) : undefined });
    keepRoom(result);
  }
