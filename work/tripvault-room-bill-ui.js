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
    if (bill.status !== 'pending' && bill.status !== 'disputed') return ui(status);
    const count = bill.participants.filter(id => bill.approvals.includes(id)).length;
    return ui(status + ' · ' + count + '/' + bill.participants.length + ' approved');
  }

  function showBillReviewError(message) {
    const error = sheet.querySelector('#bill-review-error');
    if (error) error.textContent = ui(message);
    notice(message);
  }

  function roomBillDetail(id, confirmation = '') {
    const trip = state.trip;
    const bill = trip.bills.find(item => item.id === id);
    if (!bill) return;
    const demo = demoMode && !trip.shared;
    const reviewable = !trip.settled && !trip.reviewQuote && bill.status !== 'rejected';
    const editable = reviewable && ['pending', 'disputed'].includes(bill.status);
    const canReview = editable && bill.participants.includes(state.actor);
    const hasApproved = bill.approvals.includes(state.actor);
    const creator = bill.createdBy || bill.payer;
    const voters = [...new Set([creator, bill.payer, ...bill.participants])];
    const votes = bill.cancellation?.votes || [];
    const idData = `data-id="${id}"`;
    const comments = feedback => feedback?.map(item => row(userText(member(item.author)?.name || 'Member'), '', userText(item.comment))).join('') || '';
    const suggestions = (bill.feedback || []).map(item => {
      const responses = item.responses || [];
      const myResponse = responses.find(response => response.member === state.actor);
      const canRespond = rooms.canRespondToSuggestions && editable && bill.status === 'disputed'
        && item.author !== state.actor && voters.includes(state.actor);
      const responseActions = canRespond ? [true, false].map(agree => btn(agree ? 'Agree' : 'Disagree', 'bill-feedback-vote', {
        tone: agree ? '' : 'danger',
        disabled: myResponse?.agree === agree,
        data: idData + ` data-author="${safe(item.author)}" data-suggestion="${safe(item.id)}" data-agree="${agree}"`,
      })).join('') : '';
      return `<div class="bill-suggestion">
        <strong>${userText(member(item.author)?.name || 'Member')}</strong>
        <p class="bill-cancellation-reason">${userText(item.comment)}</p>
        ${responses.map(response => `<p class="subtitle">${userText(member(response.member)?.name || 'Member')} <span aria-hidden="true">·</span>
          <span>${response.agree ? 'Agreed' : 'Disagreed'}</span></p>`).join('')}
        ${responseActions ? '<div class="inline">' + responseActions + '</div>' : ''}
      </div>`;
    }).join('');
    const history = bill.history?.map(item =>
      `<div>${row(userText(item.label), vnd(item.amount), 'Paid by ' + userText(member(item.payer)?.name))}${comments(item.feedback)}</div>`).join('');
    const splitLabel = ui(bill.splitType === 'custom' ? 'Custom split' : 'Equal split');
    const percentage = new Intl.NumberFormat(siteLanguage === 'vi' ? 'vi-VN' : 'en-US', {
      style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1,
    });
    const reviewRows = bill.participants.map(id => {
      const s = shares(bill).find(item => item.id === id);
      const amt = s ? s.amount : 0;
      const pct = bill.amount ? ` (${percentage.format(amt / bill.amount)})` : '';
      return row(userText(member(id).name), vnd(amt) + pct,
        bill.autoApprovals?.includes(id) ? 'Automatically approved' : bill.approvals.includes(id) ? 'Approved' : 'Waiting for approval');
    }).join('');
    const reviewButtons = demo
      ? (!trip.settled && (trip.approvalMode === 'everyone' || state.actor === trip.owner)
        ? btn(hasApproved ? 'Cancel my approval' : 'Approve bill', hasApproved ? 'revoke-bill' : 'approve-bill',
          { tone: hasApproved ? 'danger cancel-approval' : '', data: idData }) : '')
      : canReview
      ? (hasApproved ? '' : btn('Approve bill', 'approve-bill', { data: idData }))
        + btn('Suggest changes', 'bill-feedback', { tone: 'secondary', data: idData })
      : '';
    const editButton = !demo && editable && creator === state.actor ? btn('Edit bill', 'bill-edit', { tone: 'secondary', data: idData }) : '';
    const cancelButtons = !demo && reviewable && voters.includes(state.actor)
      ? (!votes.includes(state.actor) ? btn(bill.cancellation ? 'Agree to cancel' : 'Disagree and request cancellation', 'bill-cancel-yes',
        { tone: 'danger', data: idData }) : '') +
        (bill.cancellation ? btn('Keep bill', 'bill-cancel-no', { tone: 'secondary', data: idData }) : '')
      : '';
    sheetOpen({ user: bill.label }, roomBillStatus(bill), `<div class="stack" data-bill-review="${id}">
      ${row('Amount paid', vnd(bill.amount), 'Paid by ' + userText(member(bill.payer).name))}
      <section class="panel"><h3>${ui('People sharing this bill')} (${splitLabel})</h3>${reviewRows}</section>
      ${bill.status === 'pending' && bill.reviewBy ? `<p class="notice">Automatically approves at ${safe(formatTripTime(bill.reviewBy))} if nobody requests changes or asks to remove it.</p>` : ''}
      ${bill.status === 'approved' ? '<p class="subtitle">This bill has been approved. Suggestions are available while a bill is still being reviewed.</p>' : ''}
      ${suggestions ? `<section class="panel"><h3>Suggested changes</h3>${suggestions}</section>` : ''}
      ${confirmation ? `<p class="notice green" role="status">${safe(confirmation)}</p>` : ''}
      ${history ? `<details class="panel"><summary>Previous versions</summary>${history}</details>` : ''}
      ${bill.cancellation?.reason ? `<section class="notice warn bill-cancellation-note">
        <h3>Reason for cancellation</h3>
        <p>${userText(member(bill.cancellation.requestedBy)?.name || 'Member')}</p>
        <p class="bill-cancellation-reason">${userText(bill.cancellation.reason)}</p>
      </section>` : ''}
      ${bill.status === 'cancellation' ? `<div class="notice">
        <p>${votes.length} of ${voters.length} agreed to remove this bill.</p>
        <p>The bill creator, payer and everyone sharing the bill must agree to cancel it.</p>
      </div>` : ''}
      ${bill.status === 'rejected' ? '<p class="notice">Everyone involved agreed to handle this bill separately. It is excluded from the final amounts.</p>' : ''}
      <p id="bill-review-error" class="form-error" role="status"></p>
      ${reviewButtons || editButton ? `<div class="bill-actions">${reviewButtons}${editButton}</div>` : ''}
      ${cancelButtons ? `<div class="bill-actions bill-removal-actions${reviewButtons || editButton ? '' : ' solo'}">${cancelButtons}</div>` : ''}
      ${reviewable && !demo ? billSignInButton() : ''}
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
        <label class="field">Reason or suggested change<textarea name="comment" rows="4" required maxlength="500" autofocus></textarea></label>
        <p id="sheet-error" class="form-error" role="status"></p>
        ${billSignInButton()}
        <button class="btn full" type="submit">Send suggestion</button>
      </form>`);
    }
    if (action === 'bill-cancel-yes' && !bill.cancellation) {
      return sheetOpen('Request bill cancellation', { user: bill.label }, `<form method="dialog" id="bill-cancellation-form" class="stack">
        <input type="hidden" name="id" value="${id}">
        <label class="field">Reason for cancellation<textarea name="reason" rows="4" required maxlength="500" autofocus></textarea></label>
        <p class="subtitle">Everyone in this trip can read your reason. The bill creator, payer and everyone sharing the bill must agree to cancel it.</p>
        <p id="sheet-error" class="form-error" role="status"></p>
        ${billSignInButton()}</form>`,
      '<button class="btn full danger" type="submit" form="bill-cancellation-form">Send cancellation request</button>');
    }
    changeRoom(trip, 'bill.cancel', { id, agree: action === 'bill-cancel-yes' }, updated => {
      if (updated) roomBillDetail(id);
    }, showBillReviewError);
  }

  function submitBillCancellation(data, fail) {
    const trip = state.trip;
    if (!trip?.shared) return;
    if (!rooms.canSaveCancellationReason) return fail('The server needs an update to save the cancellation reason.');
    const id = Number(data.get('id'));
    const reason = String(data.get('reason') || '').trim();
    if (!reason) return fail('Enter a reason for cancellation.');
    changeRoom(trip, 'bill.cancel', { id, agree: true, reason }, updated => {
      if (updated) roomBillDetail(id);
    }, fail);
  }

  function respondToBillFeedback(id, { author, suggestion, agree }) {
    const trip = state.trip;
    if (!trip?.shared || !rooms.canRespondToSuggestions) return;
    changeRoom(trip, 'bill.feedback-vote', { id, author, suggestion, agree: agree === 'true' }, updated => {
      if (updated && sheet.open) roomBillDetail(id, 'Your response was saved.');
    }, showBillReviewError);
  }

  async function submitBillFeedback(data, fail) {
    const id = Number(data.get('id'));
    if (!state.trip?.shared) return;
    if (rooms.busy) return fail('Another room action is in progress. Try again.');
    const comment = String(data.get('comment') || '').trim();
    if (!comment) return fail('Enter a reason or suggested change.');
    const button = sheet.querySelector('#bill-feedback-form button[type="submit"]');
    const form = button?.form;
    if (form && form.feedbackComment !== comment) {
      form.feedbackComment = comment;
      form.feedbackRequestId = globalThis.crypto?.randomUUID?.();
    }
    if (button) {
      button.disabled = true;
      button.textContent = ui('Sending suggestion…');
    }
    fail('');
    try {
      await changeRoom(state.trip, 'bill.feedback', { id, comment, requestId: form?.feedbackRequestId }, updated => {
        const bill = updated?.bills.find(item => item.id === id);
        if (!bill || !sheet.open) return;
        const creator = bill.createdBy || bill.payer;
        const message = creator !== state.actor
          ? 'Suggestion sent. The bill creator can see it in Notifications.'
          : 'Your suggestion was saved.';
        roomBillDetail(id, message);
        notice(message);
      }, fail);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = ui('Send suggestion');
      }
    }
  }
