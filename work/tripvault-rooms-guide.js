  const GUIDE_PICTURES = /*ROOM_GUIDE_PICTURES*/;
  const GUIDE_CONTENT = {
    vi: {
      title: 'Cách dùng TripVault',
      subtitle: 'Tạo chuyến đi, nạp quỹ, ghi hóa đơn và quyết toán.',
      language: 'Ngôn ngữ hướng dẫn', close: 'Bắt đầu dùng ngay', skip: 'Bỏ qua', back: 'Quay lại', next: 'Tiếp theo',
      progress: (step, total) => `Bước ${step} / ${total}`,
      steps: [
        {
          title: 'Bước 1 · Tạo chuyến đi mới',
          copy: `<p>Mở màn hình <b>Chuyến đi của bạn</b> và chọn <b>Tạo chuyến đi</b>.</p>
                 <div class="guide-step-card">
                   <div class="guide-card-tag">💡 Mục đích của TripVault</div>
                   <p><b>Quỹ chung cho các chuyến đi nhiều ngày.</b></p>
                   <ul style="margin: 6px 0 0 18px; padding: 0; line-height: 1.6;">
                     <li>Đặt tên chuyến đi và mức tiền nạp tối thiểu.</li>
                     <li>Chọn 3 mốc thời gian: hạn nạp quỹ, bắt đầu, kết thúc.</li>
                   </ul>
                 </div>`,
          alt: 'Màn hình Your trips và giao diện tạo phòng với các trường tên chuyến, mức nạp và 3 mốc thời gian.',
        },
        {
          title: 'Bước 2 · Mời thành viên',
          copy: `<p>Gửi mã mời 6 số hoặc sao chép liên kết mời cho bạn bè.</p><p>Mỗi người chọn <b>Tham gia chuyến đi</b>, kết nối ví rồi ký yêu cầu đăng nhập. Trước hạn nạp quỹ, mọi người cần nạp đủ mức tối thiểu.</p>`,
          alt: 'Màn hình hiển thị mã phòng 6 chữ số và nút sao chép liên kết mời thành viên.',
        },
        {
          title: 'Bước 3 · Các mục chính',
          copy: `<ul><li><b>Tổng quan</b> xem lời mời, tiến độ và số dư quỹ.</li><li><b>Thành viên</b> xem những người cùng đi.</li><li><b>Hóa đơn</b> ghi tiền đã ứng và duyệt phần được chia.</li><li><b>Quyết toán</b> xem ai trả hoặc nhận bao nhiêu.</li><li><b>Ví</b> nạp quỹ, rút trước hạn nạp hoặc nhận số dư sau quyết toán.</li></ul>`,
          alt: 'Thanh điều hướng bên trái hiển thị 5 mục: Overview, People, Bills, Final split, Wallet.',
        },
        {
          title: 'Bước 4 · Duyệt và quyết toán',
          copy: `<p>Hãy xử lý các hóa đơn đang chờ duyệt, yêu cầu sửa hoặc hủy.</p><p>Trưởng nhóm mở <b>Quyết toán</b> để chốt tỷ giá và công bố số tiền. Tất cả thành viên duyệt phần của mình, rồi trưởng nhóm thực hiện quyết toán. Sau đó mỗi người mở <b>Ví</b> để nhận số dư.</p>`,
          alt: 'Màn hình Final split hiển thị bảng quyết toán và các nút Approve xác nhận của thành viên.',
        },
      ],
    },
    en: {
      title: 'How to use TripVault',
      subtitle: 'Create a trip, add to the shared fund, record bills, and settle.',
      language: 'Guide language', close: 'Get started', skip: 'Skip for now', back: 'Back', next: 'Next',
      progress: (step, total) => `Step ${step} of ${total}`,
      steps: [
        {
          title: 'Step 1 · Create a trip',
          copy: `<p>Open <b>Your trips</b> and click <b>Create a trip</b>.</p>
                 <div class="guide-step-card">
                   <div class="guide-card-tag">💡 Purpose of TripVault</div>
                   <p><b>A shared fund for multi-day trips.</b></p>
                   <ul style="margin: 6px 0 0 18px; padding: 0; line-height: 1.6;">
                     <li>Name the trip and set the minimum deposit.</li>
                     <li>Pick 3 dates: deposit deadline, start, end.</li>
                   </ul>
                 </div>`,
          alt: 'Your trips view with Create a room button and the form showing name, deposit and times.',
        },
        {
          title: 'Step 2 · Invite members',
          copy: `<p>Share the six-digit invite code or copy the invite link.</p><p>Each member selects <b>Join a trip</b>, connects a wallet, and signs in. Everyone must add the minimum deposit before the deposit deadline.</p>`,
          alt: 'Room invite card showing 6-digit room code and copy invite link button.',
        },
        {
          title: 'Step 3 · Main tools',
          copy: `<ul><li><b>Overview</b> shows invitations, progress, and the shared fund balance.</li><li><b>People</b> lists your travel companions.</li><li><b>Bills</b> records payments and collects approvals.</li><li><b>Final split</b> shows who pays or receives money.</li><li><b>Wallet</b> adds funds, withdraws before the deposit deadline, and claims the balance after settlement.</li></ul>`,
          alt: 'Sidebar showing 5 navigation tabs: Overview, People, Bills, Final split, Wallet.',
        },
        {
          title: 'Step 4 · Review and settle',
          copy: `<p>Resolve pending bills, suggested changes, and cancellation requests first.</p><p>The organizer opens <b>Final split</b> to lock the rate and share the amounts. Every member approves their amount, then the organizer settles the group. Each member can claim their remaining balance in <b>Wallet</b>.</p>`,
          alt: 'Final split screen showing member balance reviews and approval buttons.',
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
    const stepImage = (GUIDE_PICTURES.length >= 5
      ? [GUIDE_PICTURES[0], GUIDE_PICTURES[1], GUIDE_PICTURES[3], GUIDE_PICTURES[4]][guideStep]
      : GUIDE_PICTURES[guideStep]) || GUIDE_PICTURES[0];
    
    sheet?.classList?.add('guide-modal');
    sheetOpen(guide.title, guide.subtitle,
      `<div class="guide-toolbar">
        <div class="inline" role="group" aria-label="${guide.language}">${languageOptions}</div>
        <span class="chip">${guide.progress(guideStep + 1, guide.steps.length)}</span>
       </div>
       <figure class="guide-illustration">
        <img src="${stepImage}" alt="${safe(step.alt)}" width="968" height="408">
       </figure>
       <div class="guide-description">
        <h3 id="guide-step-title" tabindex="-1">${step.title}</h3>
        <div class="guide-copy">${step.copy}</div>
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
    sheet?.classList?.remove('guide-modal');
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
    if (!Number.isInteger(step) || step < 0 || step >= 4) return;
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
