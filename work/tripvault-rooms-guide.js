  const GUIDE_PICTURES = /*ROOM_GUIDE_PICTURES*/;
  const GUIDE_CONTENT = {
    vi: {
      title: 'Cách dùng TripVault',
      subtitle: 'Hướng dẫn tạo phòng, tham gia và quyết toán.',
      language: 'Ngôn ngữ hướng dẫn', close: 'Đã hiểu', skip: 'Bỏ qua', back: 'Quay lại', next: 'Tiếp theo',
      progress: (step, total) => `Bước ${step} / ${total}`,
      steps: [
        {
          title: 'Tạo phòng và mời bạn',
          copy: 'Bấm <b>Create a room</b>, đặt mức nạp tối thiểu và chọn <b>hạn nạp → giờ bắt đầu → giờ kết thúc</b>. Gửi link hoặc mã 6 số cho bạn bè.',
          alt: 'Màn Your trips có nút Create a room. Màn Invite members hiển thị mã ví dụ 624183 và nút Copy invite link.',
        },
        {
          title: 'Tham gia bằng ví',
          copy: 'Mở link mời hoặc chọn <b>Join a room</b>. Kết nối ví hỗ trợ <b>Avalanche Fuji</b>, nhập mã nếu được mời bằng mã 6 số, rồi ký xác nhận.',
          alt: 'Kết nối ví trên Avalanche Fuji rồi nhập mã trong Join a room.',
        },
        {
          title: 'Nạp vào quỹ trước hạn',
          copy: 'Khi đủ thành viên, trưởng nhóm mở <b>Wallet → Deploy Fuji vault</b>. Mỗi người bấm <b>Deposit USDC</b> và có thể rút phần mình đã nạp trước hạn. Đến hạn, nếu có ai nạp thiếu, chuyến tự hủy và mỗi người có thể nhận lại tiền đã nạp. Nếu đủ, quỹ khóa rút và chuyến bắt đầu theo lịch.',
          alt: 'Trong Wallet, trưởng nhóm tạo quỹ rồi từng thành viên nạp USDC trước hạn.',
        },
        {
          title: 'Ghi chi phí bằng VND',
          copy: 'Mở <b>Bills → Add bill</b> để ghi số tiền, người trả và người cùng chia. Chỉ người được chọn mới duyệt. Sau 24 giờ kể từ lúc tạo hoặc sửa, TripVault tự duyệt nếu không còn góp ý hay yêu cầu bỏ bill.',
          alt: 'Một bill ăn trưa 300.000 đồng được lưu vào Bills và duyệt.',
        },
        {
          title: 'Chốt tiền cuối chuyến',
          copy: 'Sau khi chuyến kết thúc, nhóm vẫn có thể duyệt hoặc yêu cầu sửa bill đang chờ. Bill chỉ chuyển sang <b>Rejected</b> khi người tạo, người ứng tiền và tất cả người cùng chia đồng ý bỏ bill để tự tính riêng. Khi các bill đã xử lý xong, trưởng nhóm chốt tiền trong <b>Final split</b>.',
          alt: 'Trong Final split, các thành viên duyệt số tiền, nạp bù nếu cần, rồi trưởng nhóm chốt thanh toán.',
        },
      ],
    },
    en: {
      title: 'How to use TripVault',
      subtitle: 'Create a room, join, and settle up.',
      language: 'Guide language', close: 'Got it', skip: 'Skip for now', back: 'Back', next: 'Next',
      progress: (step, total) => `Step ${step} of ${total}`,
      steps: [
        {
          title: 'Create a room and invite friends',
          copy: 'Choose <b>Create a room</b>, set the minimum deposit and choose a <b>deposit deadline, trip start, and trip end</b> in that order. Share the invite link or six-digit code.',
          alt: 'Your trips shows Create a room. Invite members shows the example code 624183 and the Copy invite link button.',
        },
        {
          title: 'Join with a wallet',
          copy: 'Open the invite link or choose <b>Join a room</b>. Connect a wallet that supports <b>Avalanche Fuji</b>, enter the six-digit code if you have one, and sign in.',
          alt: 'Connect a wallet on Avalanche Fuji, then enter the code in Join a room.',
        },
        {
          title: 'Add money to the trip fund before the deadline',
          copy: 'Once everyone joins, the organizer chooses <b>Wallet → Deploy Fuji vault</b>. Each person chooses <b>Deposit USDC</b> and can withdraw their own deposit before the deadline. If anyone is below the minimum at the deadline, the trip is cancelled and everyone can take back their deposit. If everyone has funded, withdrawals lock and the trip begins as scheduled.',
          alt: 'The organizer sets up the trip fund in Wallet, then members add USDC before the deadline.',
        },
        {
          title: 'Record expenses in VND',
          copy: 'Open <b>Bills → Add bill</b> and enter the amount, who paid, and who shares it. Only the people listed review the bill. TripVault automatically approves it 24 hours after creation or editing if there are no open suggestions or removal requests.',
          alt: 'A 300,000 VND lunch bill is recorded and approved in Bills.',
        },
        {
          title: 'Make final payments',
          copy: 'Members can finish open bill reviews after the trip ends. A bill becomes <b>Rejected</b> when its creator, payer, and everyone sharing it agree to handle it separately. After reviews are complete, the organizer settles in <b>Final split</b>.',
          alt: 'Members review amounts and top up, then the organizer makes group payments.',
        },
      ],
    },
  };

  let guideLanguage;
  let guideStep = 0;
  let guideOpen = false;
  let pendingGuideInvite = '';
  const joinedRoomGuides = new Set();

  function showGuide() {
    const preferred = guideLanguage || readStorage(GUIDE_LANGUAGE_KEY) || readStorage(SITE_LANGUAGE_KEY);
    const browserLanguage = globalThis.navigator?.language || 'vi';
    const language = preferred === 'vi' || preferred === 'en'
      ? preferred : browserLanguage.toLowerCase().startsWith('vi') ? 'vi' : 'en';
    const guide = GUIDE_CONTENT[language];
    const step = guide.steps[guideStep];
    const last = guideStep === guide.steps.length - 1;
    const languageOptions = [['vi', 'Tiếng Việt'], ['en', 'English']].map(([code, label]) =>
      btn(label, 'guide-language', {
        tone: code === language ? 'soft' : 'secondary',
        data: `data-id="${code}" lang="${code}" aria-pressed="${code === language}"`,
      }),
    ).join('');
    const previous = guideStep > 0
      ? btn(guide.back, 'guide-step', { tone: 'secondary', data: `data-id="${guideStep - 1}"` }) : '';
    const next = last
      ? btn(guide.close, 'close-sheet', { data: 'autofocus' })
      : btn(guide.next, 'guide-step', { data: `data-id="${guideStep + 1}" autofocus` });
    const skip = last ? '' : btn(guide.skip, 'close-sheet', { tone: 'ghost' });
    sheetOpen(guide.title, guide.subtitle,
      `<div class="guide-toolbar">
        <div class="inline" role="group" aria-label="${guide.language}">${languageOptions}</div>
        <span class="chip">${guide.progress(guideStep + 1, guide.steps.length)}</span>
       </div>
       <figure class="guide-illustration">
        <img src="${GUIDE_PICTURES[guideStep]}" alt="${safe(step.alt)}" width="968" height="408">
       </figure>
       <div class="guide-description">
        <h3 id="guide-step-title" tabindex="-1">${step.title}</h3>
        <p>${step.copy.replace(/<b>([^<]+)<\/b>/g, (_, label) =>
          '<b>' + label.split(' → ').map(value => safe(ui(value))).join(' → ') + '</b>')}</p>
       </div>`,
      `<div class="guide-actions">${skip}${previous}${next}</div>`,
      language,
    );
  }

  function openGuide() {
    guideStep = 0;
    guideOpen = true;
    showGuide();
  }

  function dismissGuide() {
    guideOpen = false;
    sheet.close();
    const invite = pendingGuideInvite;
    pendingGuideInvite = '';
    if (invite) startRoomFlow('join', invite);
  }

  document.addEventListener('cancel', event => {
    if (event.target !== sheet || !guideOpen) return;
    event.preventDefault();
    dismissGuide();
  }, true);

  function moveGuide(value) {
    const step = Number(value);
    if (!Number.isInteger(step) || step < 0 || step >= GUIDE_PICTURES.length) return;
    guideStep = step;
    showGuide();
    sheet.querySelector('#guide-step-title')?.focus();
  }

  function setGuideLanguage(language) {
    if (language !== 'vi' && language !== 'en') return;
    guideLanguage = language;
    try {
      localStorage.setItem(GUIDE_LANGUAGE_KEY, JSON.stringify(language));
    } catch {
      // Keep the current choice when the browser disallows saving preferences.
    }
    showGuide();
    sheet.querySelector(`[data-act="guide-language"][data-id="${language}"]`)?.focus();
  }

  function showFirstVisitGuide() {
    if (readStorage(GUIDE_KEY) === true) return;
    openGuide();
    try {
      localStorage.setItem(GUIDE_KEY, 'true');
    } catch {
      // The guide remains available even if the browser cannot remember this visit.
    }
  }

  function showJoinedRoomGuide(trip) {
    const key = GUIDE_KEY + ':room:' + rooms.account + ':' + trip.id;
    if (joinedRoomGuides.has(key) || readStorage(key) === true) return;
    joinedRoomGuides.add(key);
    try {
      localStorage.setItem(key, 'true');
    } catch {}
    openGuide();
  }
