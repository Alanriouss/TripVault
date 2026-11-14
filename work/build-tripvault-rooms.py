import json
import base64
from pathlib import Path
from upgrade_tripvault_room_fuji import upgrade

root = Path('.')
source = (root / 'outputs/TripVault_TimeLocked_ExternalBills_v8.html').read_text()
room_ui = (root / 'work/tripvault-rooms-ui.js').read_text() + '\n' + (root / 'work/tripvault-room-bulk.js').read_text()
funding_math = (root / 'work/tripvault-room-funding.js').read_text().replace('export function', 'function', 1)
room_ui += '\n' + funding_math + '\n' + (root / 'work/tripvault-room-funding-ui.js').read_text()
room_ui += '\n' + (root / 'work/tripvault-room-progress.js').read_text()
room_ui += '\n' + (root / 'work/tripvault-room-bill-ui.js').read_text()
room_ui += '\n' + (root / 'work/tripvault-room-notifications.js').read_text()

def replace(old, new):
    global source
    assert source.count(old) == 1, (source.count(old), old[:150])
    source = source.replace(old, new, 1)

replace('<title>TripVault · Trip workspace</title>', '<title>TripVault · Rooms</title>')
replace('</head>', '''<style>
.room-code { width: fit-content; color: var(--accent-dark); background: var(--tint); border-radius: 12px; padding: 6px 12px; font: 750 clamp(22px, 7vw, 34px)/1.25 Inter, sans-serif; letter-spacing: .16em; font-variant-numeric: tabular-nums; }
.room-wallet-address { overflow-wrap: anywhere; }
.trip-settings-actions { margin-top: 12px; }
.trip-list-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px 0; }
.trip-list-row + .trip-list-row { border-top: 1px solid var(--line); }
.trip-list-row > .inline { margin-inline-start: auto; }
.trip-list-row .bill-name { overflow-wrap: anywhere; }
.trip-list-tools { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid var(--line); padding-bottom: 12px; }
.trip-list-tools > .btn:only-child { margin-inline-start: auto; }
.trip-delete-checkbox { display: grid; place-items: center; min-width: 36px; min-height: 44px; }
.trip-delete-checkbox input { width: 18px; height: 18px; accent-color: var(--accent); }
.trip-delete-list { margin: 0; padding-inline-start: 20px; overflow-wrap: anywhere; }
.field > small { color: var(--muted); font-size: 13px; font-weight: 400; line-height: 1.4; }
#bill-reminder-feedback:empty { display: none; }
.btn.danger.cancel-approval { border-color: #e7a6b2; background: #fce2e9; }
.btn.danger.cancel-approval:hover:not(:disabled) { background: #f9d3df; }
.trip-return { display: flex; justify-content: space-between; align-items: center; gap: 8px 16px; flex-wrap: wrap; margin-bottom: 14px; }
.trip-profile { display: flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%; margin-inline-start: auto; }
.trip-profile-name { min-width: 0; color: var(--muted); font-size: 13px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trip-profile .btn { flex-shrink: 0; }
.trip-profile .avatar { width: 32px; height: 32px; flex-shrink: 0; }
.btn.rename-member { border-color: #cbbaf7; }
.ui-language { min-width: 0; width: auto; margin: 0; padding: 0 8px; min-height: 44px; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); color: var(--ink); font: 650 13px Inter, sans-serif; }
.header .breadcrumb { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.wallet-actions { margin-top: 4px; }
.wallet-utilities { padding-top: 8px; border-top: 1px solid var(--line); }
.bill-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.bill-removal-actions { margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--line); }
.bill-removal-actions.solo { margin: 0; padding: 0; border: 0; }
.btn.trip-bell { position: relative; padding: 0; width: 44px; flex: 0 0 44px; color: var(--accent-dark); }
.trip-bell-dot { position: absolute; top: 7px; inset-inline-end: 7px; width: 10px; height: 10px; border: 2px solid white; border-radius: 50%; background: var(--danger); }
.trip-bell.attention svg { transform-origin: 50% 20%; animation: notification-ring 550ms ease-in-out 3; }
.trip-bell.attention .trip-bell-dot { animation: notification-pulse 550ms ease-in-out 3; }
@keyframes notification-ring {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(16deg); }
  70% { transform: rotate(-16deg); }
}
@keyframes notification-pulse {
  50% { box-shadow: 0 0 0 4px var(--tint); }
}
@media (prefers-reduced-motion: reduce) {
  .trip-bell.attention svg, .trip-bell.attention .trip-bell-dot { animation: none; }
}
.trip-notification { width: 100%; display: grid; gap: 4px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); color: var(--ink); text-align: start; overflow-wrap: anywhere; }
.trip-notification.unread { background: var(--tint); }
.trip-notification small { color: var(--muted); }
.trip-notification .inline { margin-top: 4px; }
.fund-summary { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 20px; }
.fund-summary > strong { color: var(--accent-dark); font-size: 1.25rem; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
@media (max-width: 420px) {
  .trip-profile .avatar { display: none; }
  .trip-profile-name { max-width: 96px; }
  .header-inner { gap: 6px; }
  .header .header-demo { display: none; }
}
.trip-progress { display: grid; gap: 14px; }
.trip-progress-steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; list-style: none; padding: 0; margin: 0; }
.trip-progress-steps li { display: grid; align-items: center; min-height: 44px; padding: 6px 9px; border: 1px solid var(--line); border-radius: 10px; color: var(--muted); text-align: center; font-size: 13px; font-weight: 650; }
.trip-progress-steps [aria-current="step"] { background: var(--accent); border-color: var(--accent); color: white; font-weight: 750; }
.trip-progress-next { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.trip-progress-next h3 { font-size: 18px; margin-bottom: 4px; }
@media (max-width: 520px) {
  .trip-progress-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.guide-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.guide-illustration { margin: 0; border-radius: 13px; overflow: hidden; border: 1px solid var(--line); background: var(--tint); }
.guide-illustration img { display: block; width: 100%; height: auto; }
.guide-description { display: grid; gap: 6px; font-size: 14px; }
.guide-description h3 { width: fit-content; font-size: 19px; }
.guide-description p { color: var(--muted); }
.guide-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.guide-actions .btn:last-child { margin-inline-start: auto; }
</style>
</head>''')
replace('  function readStorage(key) {', room_ui + '\n  function readStorage(key) {')
replace("      walletSession.chain = String(chain).toLowerCase();\n      render();", "      walletSession.chain = String(chain).toLowerCase();\n      roomWalletChanged();\n      render();")
replace("const disconnected = () => { clearWallet(); render(); };", "const disconnected = () => { clearWallet(); roomWalletChanged(); render(); };")
replace("      case 'fuji-disconnect': clearWallet(); render(); break;", "      case 'fuji-disconnect': clearWallet(); roomWalletChanged(); render(); break;")
replace("Open TripVault through the Firefox launcher to use it at http://127.0.0.1:8787/.", "Open TripVault through the Rooms launcher to use it at http://127.0.0.1:8788/.")
replace("      walletSession.account = '';\n      walletSession.chain = '';\n      walletStatus", "      walletSession.account = '';\n      walletSession.chain = '';\n      roomWalletChanged();\n      walletStatus")
replace("""    const trip = state.trip?.id === tripId ? state.trip : state.trips.find(item => item.id === tripId);
    if (!trip) return;
    trip.fuji = { ...trip.fuji, lastTx: tx };""", """    const trip = state.trip?.id === tripId ? state.trip : availableTrips().find(item => item.id === tripId);
    if (!trip) return;
    if (trip.shared) return rememberRoomTransaction(trip.id, tx);
    trip.fuji = { ...trip.fuji, lastTx: tx };""")
replace("""        transactionStatus(context, tx, 'confirmed', 'Confirmed on Avalanche Fuji.',""", """        await verifyRoomTransaction(context, tx);
        transactionStatus(context, tx, 'confirmed', 'Confirmed on Avalanche Fuji.',""")
replace("      vault: state.trip?.fuji?.address,", """      vault: state.trip?.fuji?.address, shared: state.trip?.shared === true,
      depositDeadline: state.trip?.depositDeadline ? Math.floor(Date.parse(state.trip.depositDeadline) / 1000) : null,""")
replace("  function rememberFujiTx(tripId, tx, address) {", "  function rememberFujiTx(tripId, tx, address) {\n    if (tripId?.startsWith('room-')) return rememberRoomTransaction(tripId, tx);")
replace("      case 'fuji-deploy': openFujiDeploy(); break;", "      case 'fuji-deploy':\n        if (state.trip?.shared) roomLockForDeploy(state.trip);\n        else openFujiDeploy();\n        break;")
replace("""    if (!trip || trip.fuji?.address || state.actor !== trip.owner
      || walletSession.chain !== FUJI.id || !walletSession.account) return;
    sheetOpen('Deploy Fuji vault', trip.name,""", """    if (!trip || trip.fuji?.address || state.actor !== trip.owner
      || walletSession.chain !== FUJI.id || !walletSession.account
      || (trip.shared && (!trip.locked || trip.members[0].address !== walletSession.account))) return;
    sheetOpen('Deploy Fuji vault', trip.name,""")
replace("""        ${trip.members.map((member, index) =>
          `<label class="field">${safe(member.name)}${index ? '' : ' · Organizer'}""", """        ${trip.shared ? roomMembers(trip) : trip.members.map((member, index) =>
          `<label class="field">${safe(member.name)}${index ? '' : ' · Organizer'}""")
replace("""    const members = data.getAll('address').map(value => String(value).trim().toLowerCase());""", """    const members = trip?.shared ? trip.members.map(member => member.address)
      : data.getAll('address').map(value => String(value).trim().toLowerCase());""")
replace("""    if (!trip || trip.fuji?.address || state.actor !== trip.owner || members.length !== trip.members.length""", """    if (!trip || trip.fuji?.address || state.actor !== trip.owner
      || (trip.shared && !trip.locked) || members.length !== trip.members.length""")
replace("""    const content = trip ? screen() : state.trips.length ? tripsScreen() : empty() + '<div class="stack" style="margin-top:13px">' + fujiPanel() + '</div>';""", """    const content = trip ? screen() : rooms.online ? roomsHome()
      : state.trips.length ? tripsScreen() : empty() + '<div class="stack" style="margin-top:13px">' + fujiPanel() + '</div>';""")
replace("const newTrip = btn('New trip', 'new-trip',", "const newTrip = btn(rooms.online ? 'New room' : 'New trip', 'new-trip',")
replace("const tripsButton = trip ? btn('Trips', 'trip-list', { tone: 'ghost' }) : newTrip;",
        "const tripsButton = trip?.shared ? '' : trip ? btn('Trips', 'trip-list', { tone: 'ghost' }) : newTrip;")
replace("""    const avatarButton = trip
      ? `<button""", """    const avatarButton = trip && !trip.shared
      ? `<button""")
replace('<span class="chip violet header-demo">Demo</span>', '''<span class="chip violet header-demo">${trip?.shared ? 'Room' : 'Demo'}</span>''')
replace("    const saved = storageUnavailable ? null : readStorage(KEY);", "    if (changedTrip?.shared) return true;\n    const saved = storageUnavailable ? null : readStorage(KEY);")
replace("trips, activeTripId: state.trip?.id || null, actor: state.actor, view: state.view,", "trips, activeTripId: state.trip?.shared ? null : state.trip?.id || null, actor: state.actor, view: state.view,")
replace("  function selectTrip(trip) {\n    if (sheet.open) sheet.close();", """  function selectTrip(trip) {
    if (sheet.open) sheet.close();
    if (trip?.shared) return keepRoom(trip, true);""")
replace("""  function lockQuote(trip, quote) {
    trip.reviewQuote""", """  function lockQuote(trip, quote) {
    if (trip.shared) {
      fallbackReview = null;
      changeRoom(trip, 'split.lock', { quote });
      return;
    }
    trip.reviewQuote""")
replace("""    if (bill.approvals.includes(state.actor) === approve) return;
    bill.approvals""", """    if (bill.approvals.includes(state.actor) === approve) return;
    if (trip.shared) {
      changeRoom(trip, 'bill.approve', { id: bill.id, approve }, updated => {
        if (updated) {
          detail(bill.id);
          notice('Your approval was saved.');
        }
      }, showBillReviewError);
      return;
    }
    bill.approvals""")
replace("""    if (act === 'close-sheet') return sheet.close();""", """    if (act === 'close-sheet') {
      if (guideOpen) return dismissGuide();
      rooms.intent = null;
      deleteSelectionSnapshot = null;
      return sheet.close();
    }
    if (act === 'room-create') return startRoomFlow('create');
    if (act === 'room-replace-expired') return openReplacementTrip(trip);
    if (act === 'room-join') return startRoomFlow('join');
    if (act === 'room-sign-in') return startRoomFlow('signin');
    if (act === 'room-copy') return copyRoomInvite(trip);
    if (act === 'room-delete-select-mode') return toggleTripSelectionMode();
    if (act === 'room-select-delete') return selectTripForDeletion(id);
    if (act === 'room-delete-selected') return confirmDeleteSelectedTrips();
    if (act === 'room-delete-selected-confirm') return deleteSelectedTrips();
    if (act === 'room-delete') return confirmDeleteRoom(id ? rooms.list.get(id) : trip);
    if (act === 'room-delete-confirm') return deleteConfirmedRoom(rooms.list.get(id), element.dataset);
    if (act === 'room-end') return showEndRoom(trip);
    if (act === 'room-end-confirm') return endRoomNow(trip, id);
    if (act === 'fuji-link') return showLinkVault(trip);
    if (act === 'room-freeze' && trip?.shared) {
      return changeRoom(trip, 'room.freeze', {}, updated => {
        if (updated) openFujiDeploy();
      });
    }""")
replace("    if (act === 'new-trip') return setup();", "    if (act === 'new-trip') return rooms.online ? startRoomFlow('create') : setup();")
replace("      const selected = state.trips.find(item => item.id === id);", "      const selected = availableTrips().find(item => item.id === id);")
replace("    if (act === 'join-trip') {\n      sheetOpen", "    if (act === 'join-trip') {\n      if (rooms.online) return startRoomFlow('join');\n      sheetOpen")
replace("""    if (!trip) return;

    switch (act) {""", """    if (!trip) return;
    if (trip.shared && ['deposit', 'withdraw', 'claim', 'quick-top-up', 'approve-split',
      'revoke-split', 'settle', 'switch-member', 'choose-member'].includes(act)) return;

    switch (act) {""")
replace("""          invalidateSplit(trip);
          commit(trip, 'Split reopened. Prepare a new rate and collect approvals again.');""", """          if (trip.shared) changeRoom(trip, 'split.reopen');
          else {
            invalidateSplit(trip);
            commit(trip, 'Split reopened. Prepare a new rate and collect approvals again.');
          }""")
replace("""    trip.bills.push({ id: trip.nextBillId++, label, amount, payer, participants, approvals: [], status: 'pending' });""", """    if (trip.shared) {
      const id = Number(data.get('editing'));
      changeRoom(trip, id ? 'bill.edit' : 'bill.add', { id, label, amount, payer, participants }, updated => {
        if (!updated) return;
        if (sheet.open) sheet.close();
        state.view = 'bills';
        render();
        notice(id ? 'Bill updated. A new 24-hour review has started.' : 'Bill posted for review.');
      }, fail);
      return;
    }
    trip.bills.push({ id: trip.nextBillId++, label, amount, payer, participants, approvals: [], status: 'pending' });""")
replace("""'fuji-deploy-form', 'fuji-funds-form'].includes(form.id)""", """'fuji-deploy-form', 'fuji-funds-form', 'fuji-link-form', 'room-form'].includes(form.id)""")
replace("    if (form.id === 'fuji-deploy-form') deployFuji(data, fail);", "    if (form.id === 'room-form') submitRoomForm(data, fail);\n    else if (form.id === 'fuji-link-form') linkExistingVault(data, fail);\n    else if (form.id === 'fuji-deploy-form') deployFuji(data, fail);")
replace("      updateFunds(state.trip, data.get('kind'), parseUnits(data.get('amount')), fail);", "      if (!state.trip.shared) updateFunds(state.trip, data.get('kind'), parseUnits(data.get('amount')), fail);")
replace("  function screen(){return ({overview,people,bills,split,wallet}[state.view]||overview)()}", """  function screen() {
    if (state.trip.shared) {
      if (state.view === 'overview') return roomOverview();
      if (state.view === 'people') return roomMembers(state.trip);
      if (state.view === 'wallet') return fujiPanel();
    }
    return ({ overview, people, bills, split, wallet }[state.view] || overview)();
  }""")
replace("    } else if (!settled && quote) {\n      reviewActions = approved", """    } else if (!settled && quote && trip.shared) {
      if (organizer) reviewActions = btn('Start a new review', 'reopen-split', { tone: 'secondary' });
    } else if (!settled && quote) {
      reviewActions = approved""")
replace("const shortfalls = !settled && !plan.invalid && plan.shortfalls.length", "const shortfalls = !trip.shared && !settled && !plan.invalid && plan.shortfalls.length")
replace("btn('Cancel approval', 'revoke-split', { tone: 'secondary' })",
        "btn('Cancel approval', 'revoke-split', { tone: 'danger cancel-approval' })")
replace("btn('Cancel my approval','revoke-bill',{tone:'secondary',",
        "btn('Cancel my approval','revoke-bill',{tone:'danger cancel-approval',")
replace("function detail(id){const b=", "function detail(id){if(state.trip?.shared)return roomBillDetail(id);const b=")
replace("b.status==='approved'?'Approved':'Pending approval'",
        "state.trip.shared ? roomBillStatus(b) : b.status==='approved'?'Approved':'Pending approval'")
replace("return trip.bills.some(bill => bill.status !== 'approved');",
        "return trip.bills.some(bill => bill.status !== 'approved' && (!trip.shared || bill.status !== 'rejected'));")
replace("${pending ? '<p class=\"notice warn\">Approve all pending bills before the final split.</p>' : ''}",
        """${pending ? '<p class="notice warn">' + (trip.shared ? 'Finish open bill reviews before making final payments.'
          : 'Approve all pending bills before the final split.') + '</p>' : ''}""")
replace("""          <h2>${isAddress(trip.fuji?.address) ? 'Demo split review' : 'Review the balances'}</h2>""", """          <h2>${trip.shared ? 'Review trip expenses' : isAddress(trip.fuji?.address) ? 'Demo split review' : 'Review the balances'}</h2>""")
replace("""          <p class="subtitle">${trip.splitApprovals.length} of ${trip.members.length} approved · Revision ${trip.revision}</p>""", """          <p class="subtitle">${trip.shared ? 'Everyone reviews their amount before the organizer makes the group payments.' : trip.splitApprovals.length + ' of ' + trip.members.length + ' approved · Revision ' + trip.revision}</p>""")
replace("fetching ? 'Fetching market rate…' : 'Prepare final split'", "fetching ? 'Checking exchange rate…' : trip.shared ? 'Calculate final amounts' : 'Prepare final split'")
replace("    if (!settled && !quote && organizer) {", """    if (!settled && !quote && organizer && canReviewFundedTrip(trip)) {""")
replace("    if (!settled && !quote && organizer && canReviewFundedTrip(trip)) {",
        "    if (!settled && !quote && organizer && (!trip.shared || ended) && canReviewFundedTrip(trip)) {")
replace("      && !trip.reviewQuote && !hasPendingBills(trip);",
        "      && !trip.reviewQuote && !hasPendingBills(trip) && (!trip.shared || roomBillsClosed(trip)) && canReviewFundedTrip(trip);")
replace('<h2>Net balances</h2>', "<h2>${trip.shared ? 'What each person owes or gets back' : 'Net balances'}</h2>")
replace('<h2>USDC transfers to settle</h2>', "<h2>${trip.shared ? 'Who pays whom' : 'USDC transfers to settle'}</h2>")
replace('Settlement unlocks after the trip end time.', 'Group payments can start after the trip ends.')
replace("""+ ' · ' + (trip.splitApprovals.includes(item.id) ? 'Approved' : 'Awaiting approval'))).join('')}""", """+ (trip.shared ? '' : ' · ' + (trip.splitApprovals.includes(item.id) ? 'Approved' : 'Awaiting approval')))).join('')}""")
replace("""          <p class="notice">Demo settlement moves balances within the simulated vault. Each member can claim their balance in Wallet.</p>""", """          <p class="notice">${trip.shared ? 'Deploy a Fuji vault in Wallet. The organizer can publish this split after the trip ends.' : 'Demo settlement moves balances within the simulated vault. Each member can claim their balance in Wallet.'}</p>""")
replace("""<p class="subtitle">Transactions use test USDC on Avalanche Fuji. Local demo balances are separate.</p>""", """<p class="subtitle">${trip?.shared ? 'Room members transact with test USDC on Avalanche Fuji.' : 'Transactions use test USDC on Avalanche Fuji. Local demo balances are separate.'}</p>""")
guide_art = ['create', 'join', 'fund-trip', 'bills', 'settlement']
pictures = [
    'data:image/png;base64,' + base64.b64encode((root / f'work/guide-art/{name}.png').read_bytes()).decode('ascii')
    for name in guide_art
]
room_guide = (root / 'work/tripvault-rooms-guide.js').read_text().replace('/*ROOM_GUIDE_PICTURES*/', json.dumps(pictures))
guide_start = source.index('  const GUIDE_CONTENT = {')
guide_end = source.index('  function header() {', guide_start)
source = source[:guide_start] + room_guide + '\n' + source[guide_end:]
replace("const GUIDE_KEY = 'tripvault-guide-seen';", "const GUIDE_KEY = 'tripvault-rooms-guide-seen-v3';")
replace("    if (act === 'guide') return showGuide();",
        "    if (act === 'guide') return openGuide();\n    if (act === 'guide-step') return moveGuide(id);")
replace("  showFirstVisitGuide();\n  refreshFX();", "  showFirstVisitGuide();\n  refreshFX();\n  enableRooms();")
replace("${content}\n          </main>", "${!rooms.online && window.location?.protocol === 'file:' ? '<p class=\"notice warn\">Open the TripVault Rooms launcher for invite links and room codes.</p>' : ''}\n            ${content}\n          </main>")
replace("""        ${btn('Try a local demo', 'local-demo', { tone: 'ghost' })}
""", "")
replace("    const ended = Date.now() >= Date.parse(trip.endTime);", "    const ended = Date.now() >= roomEndTime(trip);")
replace("${isAddress(trip.fuji?.address) ? fujiPanel('split') : ''}", "${trip.shared || isAddress(trip.fuji?.address) ? fujiPanel('split') : ''}")
replace("const next = [state.trip.startTime, state.trip.endTime].map(value => Date.parse(value)).find(time => time > now);",
        "const next = [Date.parse(state.trip.depositDeadline), Date.parse(state.trip.startTime), roomEndTime(state.trip)].find(time => time > now);")
replace("if (next) phaseTimer = setTimeout(render, Math.min(next - now, 2_147_483_647));",
        """if (next) phaseTimer = setTimeout(() => {
      render();
      if (state.trip?.shared) refreshRoomFunding();
      if (!walletSession.busy) refreshVault(true);
    }, Math.min(next - now, 2_147_483_647));""")
replace("trip.shared ? 'Deploy a Fuji vault in Wallet. The organizer can publish this split after the trip ends.' : 'Demo settlement moves balances within the simulated vault. Each member can claim their balance in Wallet.'",
        "trip.shared ? 'These amounts are estimates until the split is published and settled on Fuji.' : 'Demo settlement moves balances within the simulated vault. Each member can claim their balance in Wallet.'")
replace("    if (act === 'room-copy') return copyRoomInvite(trip);", """    if (act === 'room-copy') return copyRoomInvite(trip);
    if (act === 'room-funding-refresh') return refreshRoomFunding();
    if (act === 'room-rename' || act === 'room-rename-member') return showRoomRename(trip, act);
    if (act === 'room-reauthenticate') return reauthenticateRoom();
    if (['bill-edit', 'bill-feedback', 'bill-cancel-yes', 'bill-cancel-no'].includes(act)) return roomBillAction(act, Number(id));
    if (act === 'send-top-up-reminder') return sendBillTopUpReminder(element);
    if (act === 'open-top-up-reminder') return openTopUpReminder(id);
    if (act === 'pay-top-up-reminder') return payTopUpReminder(id, element.dataset.units);
    if (act === 'room-notifications') return openRoomNotifications(trip);
    if (act === 'open-room-notification') return openRoomNotification(trip, id);
    if (act === 'room-funding-top-up') return topUpRoomFunding(element);""")
replace("disabled:!!t.settled})}</div><section class=\"panel\"><div class=\"panel-head\"><h2>Trip expenses",
        "disabled:t.shared ? !roomBillFunding(t).ready : !!t.settled})}</div>${t.shared ? roomFundingPanel(t) : ''}<section class=\"panel\"><div class=\"panel-head\"><h2>Trip expenses")
replace("function addBill(){const t=state.trip;if(t.settled)return;", """function addBill(editing = null) {
    const t = state.trip;
    if (t.settled || (!editing && t.shared && !roomBillFunding(t).ready)) return;
    """.rstrip())
replace("sheetOpen('Add a bill','Record a payment made outside TripVault.'", "sheetOpen(editing ? 'Edit bill' : 'Add a bill','Record a payment made outside TripVault.'")
replace('<form id="bill-form" class="stack">', '<form id="bill-form" class="stack" ${t.shared ? `data-room="${safe(t.id)}" data-editing="${editing?.id || \'\'}"` : \'\'}>${editing ? `<input type="hidden" name="editing" value="${editing.id}">` : \'\'}')
replace('maxlength="70" required placeholder="e.g. Lunch"', 'maxlength="70" required placeholder="e.g. Lunch" value="${safe(editing?.label)}"')
replace('step="1" required placeholder="300000"', 'step="1" required placeholder="300000" value="${editing?.amount || \'\'}"')
replace("m.id===state.actor?'selected':''", "(editing?.payer || state.actor) === m.id ? 'selected' : ''")
replace('name="participant" value="${m.id}" checked', 'name="participant" value="${m.id}" ${!editing || editing.participants.includes(m.id) ? \'checked\' : \'\'}')
replace('<p class="notice">No recipient wallet is needed: the payer is recorded now. USDC recipients are calculated automatically in Final split.</p>',
        """${t.shared ? '<div id="bill-funding-status" aria-live="polite"></div><p id="bill-reminder-feedback" role="status"></p>' : '<p class="notice">USDC recipients are calculated automatically in Final split.</p>'}""")
replace('form="bill-form">Save bill</button>`)}', 'form="bill-form">Save bill</button>`);\n    if (t.shared) updateBillFundingForm();\n  }')
replace('    app.innerHTML = header();', '    app.innerHTML = header();\n    updateBillFundingForm();\n    updateRoomSignInButton();')
replace("            ${content}\n          </main>", """            ${trip?.shared ? roomTripToolbar(trip) : ''}
            ${trip?.shared && !rooms.token ? '<p class="notice warn">Your room sign-in expired. ' + btn('Sign in again', 'room-reauthenticate', { tone: 'secondary' }) + '</p>' : ''}
            ${content}
          </main>""")
replace("          if (view === 'wallet' || view === 'split') refreshVault();", """          if (view === 'wallet' || view === 'split') refreshVault();
          if (view === 'overview' && trip.shared && roomEndTime(trip) <= Date.now()) refreshVault(true);
          if (trip.shared && ['overview', 'bills', 'split'].includes(view)) refreshRoomFunding();""")
replace("""          window.scrollTo(0, 0);
        }
        break;
      case 'deposit':""", """          window.scrollTo(0, 0);
          if (trip.shared && view === 'wallet' && element.dataset.focus === 'fuji-deploy') {
            app.querySelector?.('main [data-act="fuji-deploy"]:not(:disabled)')?.focus();
          }
        }
        break;
      case 'deposit':""")
source, contract = upgrade(source)
replace("    if (trip.settled || (trip.approvalMode === 'organizer' && state.actor !== trip.owner)) return;",
        "    if (trip.settled || (!trip.shared && trip.approvalMode === 'organizer' && state.actor !== trip.owner)) return;")
replace("    if (bill.approvals.includes(state.actor) === approve) return;",
        "    if (!trip.shared && bill.approvals.includes(state.actor) === approve) return;")
replace("'fuji-link-form', 'room-form'].includes(form.id)",
        "'fuji-link-form', 'room-form', 'bill-feedback-form', 'room-rename-form'].includes(form.id)")
replace("    else if (form.id === 'fuji-link-form') linkExistingVault(data, fail);", """    else if (form.id === 'bill-feedback-form') submitBillFeedback(data, fail);
    else if (form.id === 'room-rename-form') submitRoomRename(data, fail);
    else if (form.id === 'fuji-link-form') linkExistingVault(data, fail);""")
replace("""    const calldata = '0x' + VAULT.bytecode + abiWord(128) + abiWord(start) + abiWord(end)
      + abiWord(trip.minimumUnits) + abiArray(members);""", """    const deadline = Math.floor(Date.parse(trip.depositDeadline) / 1000);
    if (deadline && Date.now() >= deadline * 1000) return fail('The deposit deadline has passed.');
    const calldata = deadline
      ? '0x' + VAULT.deadlineBytecode + abiWord(160) + abiWord(deadline) + abiWord(start)
        + abiWord(end) + abiWord(trip.minimumUnits) + abiArray(members)
      : '0x' + VAULT.bytecode + abiWord(128) + abiWord(start) + abiWord(end)
        + abiWord(trip.minimumUnits) + abiArray(members);""")
replace("if (index < 0 || vault.settled || vault.timestamp >= vault.refundDeadline) {", "if (index < 0 || !canDepositFuji(vault)) {")
replace("(!vault.settled && vault.timestamp < vault.refundDeadline)", "(!vault.settled && !vault.cancelled && vault.timestamp < vault.refundDeadline)")
replace("    withFuji('Deposit test USDC', async context => {", "    return withFuji('Deposit test USDC', async context => {")
replace("      if (BigInt(units) > vault.usdc) throw new Error('This wallet needs more Fuji test USDC.');",
        """      if (BigInt(units) > vault.usdc) {
        const available = money(Number(vault.usdc));
        throw new Error(`Your wallet has ${available} on Fuji. This deposit needs ${money(units)}. Get test USDC from the Circle faucet and try again.`);
      }""")
replace("""      walletStatus(context.tripId, error?.code === 4001 ? 'rejected' : 'failed', label, walletError(error));
    } finally {
      walletSession.busy = false;
      render();""", """      walletStatus(context.tripId, error?.code === 4001 ? 'rejected' : 'failed', label, walletError(error));
    } finally {
      walletSession.busy = false;
      render();
      if (context.shared && state.trip?.id === context.tripId) refreshRoomFunding();""")
replace("      case 'fuji-refresh': refreshVault(); break;", "      case 'fuji-refresh': refreshTripStatus(); break;")
replace("""    if (!vault || !vault.members.includes(walletSession.account) || walletSession.busy) return;
    const withdraw = kind === 'withdraw';
    sheetOpen(withdraw ? 'Withdraw test USDC'""", """    const index = vault?.members.indexOf(walletSession.account) ?? -1;
    const withdraw = kind === 'withdraw';
    if (index < 0 || walletSession.busy || (withdraw ? !canWithdrawFuji(vault, index) : !canDepositFuji(vault))) return;
    sheetOpen(withdraw ? 'Withdraw my deposit'""")
replace("""      if (index < 0 || vault.timestamp >= Math.min(vault.start, vault.end) || units > vault.balances[index]) {
        throw new Error('Early withdrawal is unavailable for this amount.');
      }""", """      if (!canWithdrawFuji(vault, index)) {
        throw new Error('You can take back your deposit only before the withdrawal deadline.');
      }
      if (units > vault.balances[index]) throw new Error('Enter an amount up to your balance in the trip fund.');""")
replace("""    if (!draft || vault?.members[0] !== walletSession.account || vault.members.length !== draft.length) return;
    sheetOpen('Review the Fuji split', trip.name,""", """    if (!draft || vault?.members[0] !== walletSession.account || vault.members.length !== draft.length
      || vault.timestamp < vault.end || vault.timestamp >= vault.refundDeadline || vault.settled
      || (vault.net.length && matchesFujiDraft(trip, vault))) return;
    sheetOpen('Review payment amounts', trip.name,""")
replace("safe(trip.members[index].name), (units > 0 ? '+' : '') + money(units), safe(vault.members[index]),",
        "safe(trip.members[index].name), fujiPaymentAmount(units),")
replace('Publishing records these exact amounts and the organizer’s approval on Fuji. Each other member must approve this proposal before settlement.',
        'Sharing these amounts also approves your own amount. Everyone else can then review and approve theirs.')
replace("btn('Publish split on Fuji', 'fuji-publish'", "btn('Share amounts for approval', 'fuji-publish'")
replace("""      'fuji-publish': 'Publish Fuji split', 'fuji-approve': 'Approve Fuji split',
      'fuji-revoke': 'Revoke Fuji approval', 'fuji-settle': 'Settle Fuji vault', 'fuji-claim': 'Claim test USDC',""", """      'fuji-publish': 'Share amounts for approval', 'fuji-approve': 'Approve my amount',
      'fuji-revoke': 'Undo my approval', 'fuji-settle': 'Make group payments', 'fuji-claim': 'Send balance to my wallet',""")
replace("          throw new Error('The split changed or cannot be published. Review the draft again.');",
        "          throw new Error('The amounts changed or cannot be shared yet. Review them again.');")
replace("        calldata = vaultCall('propose(int256[])', 32) + abiArray(draft);", """        if (vault.net.length && matchesFujiDraft(latest, vault)) throw new Error('These amounts are already shared.');
        calldata = vaultCall('propose(int256[])', 32) + abiArray(draft);""")
replace("The local split changed. Publish a replacement before continuing.", "The amounts changed. The organizer needs to share the updated amounts first.")
replace("The organizer can settle after all members approve and fund the plan.", "Everyone needs to approve their amount and add enough USDC before the organizer can pay.")
source = source.replace("'Deposit test USDC'", "'Deposit USDC'")
translation = (root / 'work/tripvault-ui-language.js').read_text()
replace('  function readStorage(key) {', translation + '\n  function readStorage(key) {')
replace("              ${btn('Guide', 'guide', { tone: 'ghost' })}",
        "              ${btn('Guide', 'guide', { tone: 'ghost' })}\n              ${siteLanguageSelect()}\n              ${roomBell(trip)}")
replace("""<span class="chip violet header-demo">${trip?.shared ? 'Room' : 'Demo'}</span>""",
        """${trip?.shared ? '' : '<span class="chip violet header-demo">Demo</span>'}""")
replace("const tripsButton = trip?.shared ? '' : trip ? btn('Trips', 'trip-list', { tone: 'ghost' }) : newTrip;",
        "const tripsButton = trip?.shared || (!trip && rooms.online) ? '' : trip ? btn('Trips', 'trip-list', { tone: 'ghost' }) : newTrip;")
replace("""${trip ? 'Trips / ' + safe(trip.name) : 'Your trips'}""",
        """${trip ? 'Trips / ' + userText(trip.name) : 'Your trips'}""")
replace('    app.innerHTML = header();', """    if (document.documentElement) {
      document.documentElement.lang = siteLanguage;
      document.title = 'TripVault · ' + ui('Rooms');
      const skipLink = document.querySelector('.skip');
      if (skipLink) skipLink.textContent = ui('Skip to content');
    }
    app.innerHTML = header();
    localizeUI(app);""")
replace("function sheetOpen(title,subtitle,body,footer='',language='en'){sheet.lang=language;",
        "function sheetOpen(title,subtitle,body,footer='',language=null){sheet.lang=language || siteLanguage;")
replace('<h2 id="sheet-title">${safe(title)}</h2><p>${safe(subtitle)}</p>',
        '<h2 id="sheet-title">${sheetText(title)}</h2><p>${sheetText(subtitle)}</p>')
replace("if(!sheet.open)sheet.showModal();sheet.scrollTop=0}",
        "if(!language)localizeUI(sheet);if(!sheet.open)sheet.showModal();sheet.scrollTop=0}")
replace("toast.textContent=s;", "toast.textContent=ui(s);")
replace("form.querySelector('#sheet-error').textContent = message;", "form.querySelector('#sheet-error').textContent = ui(message);")
for label in ('Deploy Fuji vault', 'Review payment amounts'):
    replace(f"sheetOpen('{label}', trip.name,", f"sheetOpen('{label}', {{ user: trip.name }},")
source = source.replace('row(safe(trip.members[index].name),', 'row(userText(trip.members[index].name),')
source = source.replace('safe(trip.members[index].name), fujiPaymentAmount(units),',
                        'userText(trip.members[index].name), fujiPaymentAmount(units),')
source = source.replace('row(safe(member(item.id).name),', 'row(userText(member(item.id).name),')
source = source.replace('row(safe(item.name), vnd(item.net),', 'row(userText(item.name), vnd(item.net),')
source = source.replace('<h1>Final split</h1><p>${safe(trip.name)}</p>', '<h1>Final split</h1><p>${userText(trip.name)}</p>')
source = source.replace('>${safe(b.label)}</span>', '>${userText(b.label)}</span>')
source = source.replace('>${safe(m.name)}</span>', '>${userText(m.name)}</span>')
replace("Paid by ${safe(payer?.name||'Unknown')} outside ·", "${siteLanguage === 'vi' ? 'Paid by: ' : 'Paid by '}${userText(payer?.name || 'Unknown')} outside ·")
replace('>${safe(m.name)}</option>', ' translate="no">${safe(m.name)}</option>')
replace("const KEY = 'tripvault-timelocked-external-v8';", """const demoMode = new URLSearchParams(window.location?.search || '').get('demo') === '1';
  const KEY = demoMode ? 'tripvault-judge-demo-v1' : 'tripvault-timelocked-external-v8';""")
replace("const legacy = readStorage(LEGACY_KEY);", "const legacy = demoMode ? null : readStorage(LEGACY_KEY);")
replace("  enableRooms();", "  if (!demoMode) enableRooms();")
replace("""            ${content}
          </main>""", """            ${demoMode ? '<div class="inline judge-demo-actions">' + btn('Start a fresh sample', 'judge-demo-sample') +
              '<a href="/">Open shared-room mode</a></div>' : ''}
            ${content}
          </main>""")
replace('.trip-return { display:', """.judge-demo-actions { margin-bottom: 16px; }
.judge-demo-actions a { color: var(--accent-dark); font-weight: 650; }
.trip-return { display:""")
replace("""    const content = trip ? screen() : rooms.online ? roomsHome()""", """    const content = trip ? screen() : demoMode && !state.trips.length
      ? '<div class="section-head"><div><h1>TripVault demo</h1><p>Try a local simulation with two sample members. No wallet or network fees.</p></div></div>'
      : rooms.online ? roomsHome()""")
replace("    if (act === 'room-create')", """    if (act === 'judge-demo-sample' && demoMode) return startJudgeSample();
    if (act === 'room-create')""")
replace("  function selectTrip(trip) {", """  function startJudgeSample() {
    const members = [{ id: 'm0', name: 'An' }, { id: 'm1', name: 'Bình' }];
    const now = Date.now();
    const trip = {
      id: 'judges-sample', name: 'Đà Lạt weekend', location: 'Đà Lạt', owner: 'm0', members,
      minimumUnits: 5_000_000, depositUnits: { m0: 5_000_000, m1: 5_000_000 },
      startTime: new Date(now - 7_200_000).toISOString(),
      endTime: new Date(now - 60_000).toISOString(),
      approvalMode: 'everyone', bills: [], nextBillId: 1, splitApprovals: [],
      revision: 1, reviewQuote: null, settled: false,
    };
    state.trip = trip;
    state.actor = trip.owner;
    state.view = 'overview';
    fallbackReview = null;
    commit(trip);
    window.scrollTo(0, 0);
  }

  function selectTrip(trip) {""")
replace("    const quote = await marketQuote();\n    syncTrips();",
        "    const quote = demoMode ? { rate: 25000, source: 'Fixed demo rate', updated: '', live: false, historical: true } : await marketQuote();\n    syncTrips();")
replace("        fx = quote;\n        lockQuote(trip, quote);",
        "        if (!demoMode) fx = quote;\n        lockQuote(trip, quote);")
replace("  refreshFX();\n  if (!demoMode) enableRooms();",
        "  if (!demoMode) {\n    refreshFX();\n    enableRooms();\n  }")
replace("  discoverWallets();", "  if (!demoMode) discoverWallets();")
replace("  function fujiPanel(section = 'wallet') {\n    const trip", "  function fujiPanel(section = 'wallet') {\n    if (demoMode) return '';\n    const trip")
replace('!rooms.online && window.location?.protocol', '!demoMode && !rooms.online && window.location?.protocol')

(root / 'outputs/TripVault_Rooms_v9.html').write_text(source)
(root / 'work/tripvault-v9.js').write_text(source.split('<script>\n', 1)[1].split('</script>', 1)[0])
backend = root / 'work/tripvault-room-server/server.js'
generated = backend.read_text().replace('/*ROOM_CONTRACT*/', json.dumps({
    'runtime': contract['runtime'], 'legacyRuntime': contract['legacyRuntime'], 'deadlineRuntime': contract['deadlineRuntime'],
}))
(backend.parent / 'entry.js').write_text(generated)
