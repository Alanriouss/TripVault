  const ROOM_AUTH_KEY = 'tripvault-room-auth';
  const ROOM_TX_KEY = 'tripvault-room-transactions';
  const rooms = {
    online: false, canDelete: false, canBulkDelete: false, canEnd: false, canSendTopUpReminders: false,
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

  async function roomApi(path, body, token = rooms.token) {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch('/api' + path, {
      method: body === undefined ? 'GET' : 'POST', headers, cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'Room request failed.'), { status: response.status });
    return data;
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
      const { rooms: active, reminders = [] } = await roomApi('/rooms', undefined, token);
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

  async function authenticateRoomWallet() {
    const context = walletContext();
    await checkWallet(context);
    if (rooms.token && rooms.account === context.account) return rooms.token;
    const challenge = await roomApi('/auth/challenge', { address: context.account }, '');
    await checkWallet(context);
    const signature = await request(context.provider, 'personal_sign',
      [walletAuthMessage(challenge.message), context.account]);
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
      fields = `${template ? '<p class="notice">Choose a new deposit deadline and trip dates. This creates a room with a new invite code. Invite your group again before setting up the vault.</p>' : ''}
        <label class="field">Trip name<input name="name" required maxlength="70" placeholder="e.g. Da Lat weekend" value="${safe(template?.name)}"></label>
        <label class="field">Destination<input name="location" maxlength="80" value="${safe(template?.location)}"></label>
        ${name}
        <label class="field">Minimum each person adds (test USDC)<input name="minimum" type="number" min="0.000001" step="0.000001" required value="${safe(template?.minimum ?? 5)}"></label>
        <label class="field">Deposit deadline<input name="depositDeadline" type="datetime-local" required aria-describedby="room-deadline-help">
          <small id="room-deadline-help">Before this time, members can add funds or take back their own deposit. The trip is cancelled if anyone is below the minimum at the deadline.</small>
        </label>
        <label class="field">Trip start<input name="startTime" type="datetime-local" required aria-describedby="room-start-help">
          <small id="room-start-help">If everyone has funded on time, bills and top-ups open at the scheduled start.</small>
        </label>
        <label class="field">Trip end<input name="endTime" type="datetime-local" required aria-describedby="room-end-help">
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
      </form>`,
      '<button class="btn full" type="submit" form="room-form">' + title + '</button>',
    );
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
      }
      notice(intent.kind === 'create' ? 'Room created. Share the link or six-digit code.'
        : intent.kind === 'join' ? 'You joined the room.' : 'Signed in to TripVault rooms.');
    } catch (error) {
      if (error.status === 401 && rooms.token) clearRoomSession();
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
    const reviewAction = ['bill.approve', 'bill.feedback'].includes(type);
    const payload = version => ({ type, version, ...fields });
    const path = '/rooms/' + trip.id + '/actions';
    if (savingBill) updateBillFundingForm();
    try {
      let room;
      try {
        room = await roomApi(path, payload(trip.version), token);
      } catch (error) {
        if (!reviewAction || error.status !== 409 || !await syncRooms()) throw error;
        const latest = rooms.list.get(trip.id);
        const originalBill = trip.bills.find(bill => bill.id === fields.id);
        const latestBill = latest?.bills.find(bill => bill.id === fields.id);
        if (token !== rooms.token || trip.id !== state.trip?.id || !latest || latest.version <= trip.version
          || !sameBillReview(originalBill, latestBill) || latest.reviewQuote || latest.settled) throw error;
        room = await roomApi(path, payload(latest.version), token);
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

  function roomInviteCard(trip) {
    if (trip.locked || roomDeadlinePassed(trip) || !trip.invite || !trip.code) return '';
    return `<section class="panel stack">
      <h2>Invite members</h2>
      <p class="subtitle">Share the link or have members choose Join a room and enter this code.</p>
      <div class="room-code" aria-label="Room code ${safe(trip.code.split('').join(' '))}">${safe(trip.code)}</div>
      <label class="field">Invite link
        <input id="trip-invite-link" type="url" readonly value="${safe(roomInviteUrl(trip))}">
      </label>
      <div class="inline">${btn('Copy invite link', 'room-copy')}</div>
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
      <section class="panel"><h2>Trip settings</h2>
        ${row('Minimum each person adds', money(trip.minimumUnits))}
        ${trip.depositDeadline ? row('Deposit deadline', safe(formatTripTime(Date.parse(trip.depositDeadline))),
          'Everyone must add the minimum by this time. Before then, you can take back your own deposit.')
          + row('Trip start', safe(formatTripTime(start)), 'The trip starts if everyone funded it before the deadline.')
          : row(end < start ? 'Withdrawals locked early' : 'Deposit deadline and trip start', safe(formatTripTime(deadline)),
          end < start ? 'The organizer ended the trip before the original deadline.'
            : 'Add the minimum by this time. You can take back your own deposit before the deadline.')}
        ${row(trip.endedAt ? 'Trip ended early' : 'Trip end', safe(formatTripTime(end)),
          'The organizer can share the final amounts for approval after this time.')}
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
    return `<div class="section-head"><div><h1>Your trips</h1><p>Create a room or join one with your wallet.</p></div></div>
      <div class="stack"><section class="panel stack">
        <div class="inline">
          ${btn('Create a room', 'room-create', { symbol: 'plus' })}
          ${btn('Join a room', 'room-join', { tone: 'secondary' })}
          ${!rooms.token ? btn('Sign in to rooms', 'room-sign-in', { tone: 'ghost' }) : ''}
        </div>
        ${btn('Try a local demo', 'local-demo', { tone: 'ghost' })}
      </section>
      ${trips.length ? '<section class="panel">' + tripSelectionControls() + trips.map(tripListRow).join('') + '</section>' : ''}
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
