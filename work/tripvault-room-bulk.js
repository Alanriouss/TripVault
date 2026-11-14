  let deleteSelectionMode = false;
  const selectedTrips = new Set();
  let deleteSelectionSnapshot = null;

  function clearTripSelection() {
    deleteSelectionMode = false;
    selectedTrips.clear();
    deleteSelectionSnapshot = null;
  }

  function canSelectTripForDeletion(trip) {
    return canDeleteRoom(trip) && trip.fuji?.lastTx?.phase !== 'pending';
  }

  function toggleTripSelectionMode() {
    if (!rooms.canBulkDelete || rooms.busy || walletSession.busy) return;
    if (deleteSelectionMode) clearTripSelection();
    else deleteSelectionMode = true;
    render();
  }

  function selectTripForDeletion(id) {
    if (!deleteSelectionMode || !canSelectTripForDeletion(rooms.list.get(id))) return;
    if (selectedTrips.has(id)) selectedTrips.delete(id);
    else selectedTrips.add(id);
    render();
    app.querySelector?.(`[data-act="room-select-delete"][data-id="${id}"]`)?.focus();
  }

  function tripsSelectedForDeletion() {
    return [...rooms.list.values()].filter(trip => selectedTrips.has(trip.id) && canSelectTripForDeletion(trip));
  }

  function tripSelectionControls() {
    if (!rooms.canBulkDelete || ![...rooms.list.values()].some(canDeleteRoom)) return '';
    if (!deleteSelectionMode) {
      return `<div class="trip-list-tools">${btn('Select trips', 'room-delete-select-mode', {
        tone: 'secondary', disabled: rooms.busy || walletSession.busy,
      })}</div>`;
    }
    const count = tripsSelectedForDeletion().length;
    return `<div class="trip-list-tools">
      <span role="status">${count} selected</span>
      <span class="inline">
        ${btn('Cancel selection', 'room-delete-select-mode', { tone: 'ghost', disabled: rooms.busy })}
        ${btn('Delete selected', 'room-delete-selected', {
          tone: 'danger', disabled: count === 0 || rooms.busy || walletSession.busy,
        })}
      </span>
    </div>`;
  }

  function tripDeletionCheckbox(trip) {
    if (!deleteSelectionMode || !canDeleteRoom(trip)) return '';
    return `<label class="trip-delete-checkbox">
      <input type="checkbox" data-act="room-select-delete" data-id="${safe(trip.id)}"
        aria-label="${safe('Select trip ' + trip.name)}"
        ${selectedTrips.has(trip.id) ? 'checked' : ''}
        ${canSelectTripForDeletion(trip) && !rooms.busy && !walletSession.busy ? '' : 'disabled'}>
    </label>`;
  }

  function confirmDeleteSelectedTrips() {
    if (!deleteSelectionMode || rooms.busy || walletSession.busy) return;
    const chosen = tripsSelectedForDeletion();
    if (!chosen.length) return;
    deleteSelectionSnapshot = chosen.map(trip => ({ id: trip.id, version: trip.version }));
    const title = chosen.length === 1 ? 'Delete selected trip?' : 'Delete ' + chosen.length + ' trips?';
    sheetOpen(title, '',
      `<div class="stack">
        <p>The selected rooms, their bills, and their invites will be permanently removed for all members.</p>
        <ul class="trip-delete-list">${chosen.map(trip => '<li>' + safe(trip.name) + '</li>').join('')}</ul>
        ${chosen.some(trip => trip.fuji?.address) ? '<p class="notice warn">Linked vaults must be closed with all balances claimed.</p>' : ''}
        <p id="room-delete-error" class="form-error" role="status"></p>
      </div>`,
      '<div class="inline">' + btn('Cancel', 'close-sheet', { tone: 'secondary' })
        + btn('Delete selected', 'room-delete-selected-confirm', { tone: 'danger' }) + '</div>',
    );
  }

  async function deleteSelectedTrips() {
    if (!deleteSelectionSnapshot?.length || !rooms.token || rooms.busy || walletSession.busy) return;
    const entries = deleteSelectionSnapshot;
    const token = rooms.token;
    const errorMessage = sheet.querySelector('#room-delete-error');
    const fail = message => {
      if (errorMessage) errorMessage.textContent = message;
      else notice(message);
    };
    if (entries.some(entry => {
      const trip = rooms.list.get(entry.id);
      return !canSelectTripForDeletion(trip) || trip.version !== entry.version;
    })) {
      fail('The selected trips changed. Close this dialog and review your selection.');
      return;
    }

    const button = sheet.querySelector('[data-act="room-delete-selected-confirm"]');
    rooms.busy = true;
    if (button) button.disabled = true;
    if (errorMessage) errorMessage.textContent = '';
    try {
      const result = await roomApi('/rooms/bulk-delete', { trips: entries }, token);
      if (!Array.isArray(result.deleted) || result.deleted.length !== entries.length
        || entries.some(entry => !result.deleted.includes(entry.id))) {
        throw new Error('The server did not confirm deletion.');
      }
      for (const id of result.deleted) forgetRoom(id);
      if (deleteSelectionSnapshot === entries) {
        clearTripSelection();
        if (sheet.open) sheet.close();
      }
      notice(result.deleted.length === 1 ? 'Trip deleted.' : result.deleted.length + ' trips deleted.');
    } catch (error) {
      if (token === rooms.token && error.status === 401) clearRoomSession();
      else if (error.status === 404 || error.status === 409) await syncRooms();
      fail(walletError(error));
    } finally {
      rooms.busy = false;
      if (button) button.disabled = false;
      if (!state.trip) render();
    }
  }
