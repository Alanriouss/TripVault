  const ROOM_BILL_STATUS = {
    pending: 'Waiting for approval', approved: 'Approved', disputed: 'Changes requested',
    cancellation: 'Waiting for agreement to remove', rejected: 'Rejected · Handle separately',
  };

  function sameBillReview(previous, latest) {
    return Boolean(previous && latest && ['pending', 'disputed'].includes(latest.status)
      && previous.label === latest.label && previous.amount === latest.amount && previous.payer === latest.payer
      && previous.reviewBy === latest.reviewBy && JSON.stringify(previous.participants) === JSON.stringify(latest.participants));
  }

  function billSignInButton() {
    return '<div data-room-sign-in' + (rooms.token ? ' hidden' : '') + '>'
      + btn('Sign in again', 'room-reauthenticate', { tone: 'secondary' }) + '</div>';
  }

  function updateRoomSignInButton() {
    const control = sheet.querySelector('[data-room-sign-in]');
    if (control) control.hidden = Boolean(rooms.token);
  }

  function roomBillStatus(bill) {
    const status = ROOM_BILL_STATUS[bill.status] || 'Waiting for approval';
    if (bill.status !== 'pending' && bill.status !== 'disputed') return status;
    const count = bill.participants.filter(id => bill.approvals.includes(id)).length;
    return status + ' · ' + count + '/' + bill.participants.length + ' approved';
  }

  function showBillReviewError(message) {
    const error = sheet.querySelector('#bill-review-error');
    if (error) error.textContent = ui(message);
    notice(message);
  }

  function roomBillDetail(id) {
    const trip = state.trip;
    const bill = trip.bills.find(item => item.id === id);
    if (!bill) return;
    const reviewable = !trip.settled && !trip.reviewQuote && bill.status !== 'rejected';
    const editable = reviewable && ['pending', 'disputed'].includes(bill.status);
    const canReview = editable && bill.participants.includes(state.actor);
    const hasApproved = bill.approvals.includes(state.actor);
    const creator = bill.createdBy || bill.payer;
    const voters = [...new Set([creator, bill.payer, ...bill.participants])];
    const votes = bill.cancellation?.votes || [];
    const idData = `data-id="${id}"`;
    const comments = feedback => feedback?.map(item => row(userText(member(item.author)?.name || 'Member'), '', userText(item.comment))).join('') || '';
    const history = bill.history?.map(item =>
      `<div>${row(userText(item.label), vnd(item.amount), 'Paid by ' + userText(member(item.payer)?.name))}${comments(item.feedback)}</div>`).join('');
    const reviewRows = bill.participants.map(id => row(userText(member(id).name), vnd(shares(bill).find(item => item.id === id).amount),
      bill.autoApprovals?.includes(id) ? 'Automatically approved' : bill.approvals.includes(id) ? 'Approved' : 'Waiting for approval')).join('');
    const reviewButtons = canReview
      ? (hasApproved ? '' : btn('Approve bill', 'approve-bill', { data: idData }))
        + btn('Suggest changes', 'bill-feedback', { tone: 'secondary', data: idData })
      : '';
    const editButton = editable && creator === state.actor ? btn('Edit bill', 'bill-edit', { tone: 'secondary', data: idData }) : '';
    const cancelButtons = reviewable && voters.includes(state.actor)
      ? (!votes.includes(state.actor) ? btn(bill.cancellation ? 'Agree to remove' : 'Request removal', 'bill-cancel-yes',
        { tone: 'danger', data: idData }) : '') +
        (bill.cancellation ? btn('Keep bill', 'bill-cancel-no', { tone: 'secondary', data: idData }) : '')
      : '';
    sheetOpen({ user: bill.label }, roomBillStatus(bill), `<div class="stack" data-bill-review="${id}">
      ${row('Amount paid', vnd(bill.amount), 'Paid by ' + userText(member(bill.payer).name))}
      <section class="panel"><h3>People sharing this bill</h3>${reviewRows}</section>
      ${bill.status === 'pending' && bill.reviewBy ? `<p class="notice">Automatically approves at ${safe(formatTripTime(bill.reviewBy))} if nobody requests changes or asks to remove it.</p>` : ''}
      ${bill.feedback?.length ? `<section class="panel"><h3>Suggested changes</h3>${comments(bill.feedback)}</section>` : ''}
      ${history ? `<details class="panel"><summary>Previous versions</summary>${history}</details>` : ''}
      ${bill.status === 'cancellation' ? `<p class="notice">${votes.length} of ${voters.length} agreed to remove this bill.</p>` : ''}
      ${bill.status === 'rejected' ? '<p class="notice">Everyone involved agreed to handle this bill separately. It is excluded from the final amounts.</p>' : ''}
      <p id="bill-review-error" class="form-error" role="status"></p>
      ${reviewButtons || editButton ? `<div class="bill-actions">${reviewButtons}${editButton}</div>` : ''}
      ${cancelButtons ? `<div class="bill-actions bill-removal-actions${reviewButtons || editButton ? '' : ' solo'}">${cancelButtons}</div>` : ''}
      ${reviewable ? billSignInButton() : ''}
    </div>`);
  }

  function roomBillAction(action, id) {
    const trip = state.trip;
    const bill = trip?.shared && trip.bills.find(item => item.id === id);
    if (!bill) return;
    if (action === 'bill-edit') return addBill(bill);
    if (action === 'bill-feedback') {
      return sheetOpen('Suggest changes', { user: bill.label }, `<form method="dialog" id="bill-feedback-form" class="stack">
        <input type="hidden" name="id" value="${id}">
        <label class="field">Reason or suggested change<textarea name="comment" rows="4" required maxlength="500"></textarea></label>
        <p id="sheet-error" class="form-error" role="status"></p>
        ${billSignInButton()}</form>`,
      '<button class="btn full" type="submit" form="bill-feedback-form">Send suggestion</button>');
    }
    changeRoom(trip, 'bill.cancel', { id, agree: action === 'bill-cancel-yes' }, updated => {
      if (updated) roomBillDetail(id);
    });
  }

  function submitBillFeedback(data, fail) {
    const id = Number(data.get('id'));
    if (!state.trip?.shared) return;
    changeRoom(state.trip, 'bill.feedback', { id, comment: String(data.get('comment') || '') }, updated => {
      if (updated) {
        roomBillDetail(id);
        notice('Your suggestion was saved.');
      }
    }, fail);
  }
