  const GUIDE_PICTURES = /*ROOM_GUIDE_PICTURES*/;
  const GUIDE_CONTENT = {
    vi: {
      title: 'Cách dùng TripVault',
      subtitle: 'Hướng dẫn tạo phòng, nạp quỹ, chia chi phí và quyết toán an toàn.',
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
          title: 'Bước 2 · Mời thành viên (Invite members)',
          copy: `<p>Sau khi tạo phòng, chia sẻ phòng cho các thành viên trong nhóm:</p>
                 <div class="guide-step-card">
                   <ul style="margin: 0 0 0 18px; padding: 0; line-height: 1.6;">
                     <li><b>Mã phòng 6 số</b>: Chia sẻ mã 6 số (ví dụ: <code class="room-code-badge">624183</code>), bạn bè chỉ cần bấm <b>Tham gia phòng (Join a room)</b> và nhập mã.</li>
                     <li><b>Liên kết mời (Invite link)</b>: Bấm <b>Sao chép liên kết mời</b> để gửi qua Zalo, Telegram hoặc tin nhắn.</li>
                     <li>Thành viên kết nối ví hỗ trợ mạng <b>Avalanche Fuji</b> và ký xác nhận SIWE không mật khẩu.</li>
                   </ul>
                 </div>`,
          alt: 'Màn hình hiển thị mã phòng 6 chữ số và nút sao chép liên kết mời thành viên.',
        },
        {
          title: 'Bước 3 · Làm quen thanh menu chức năng (Sidebar navigation)',
          copy: `<p>Thanh điều hướng bên trái (hoặc thanh đáy trên Mobile) cung cấp 5 công cụ chính:</p>
                 <div class="guide-step-card">
                   <ul style="margin: 0 0 0 18px; padding: 0; line-height: 1.7;">
                     <li>🏠 <b>Tổng quan (Overview)</b>: Xem mã phòng, tiến độ chuyến đi, số dư quỹ và cài đặt.</li>
                     <li>👥 <b>Thành viên (People)</b>: Danh sách bạn đồng hành, chi tiết ai đã ứng tiền và ai nợ.</li>
                     <li>🧾 <b>Hóa đơn (Bills)</b>: Ghi nhận chi tiêu thực tế (VND) với 2 phương thức <b>Chia đều</b> hoặc <b>Chia tùy chỉnh</b>.</li>
                     <li>⚖️ <b>Quyết toán (Final split)</b>: Tính toán bù trừ công nợ Zero-Sum bảo toàn và quy đổi sang USDC.</li>
                     <li>💳 <b>Ví & Quỹ (Wallet)</b>: Nạp USDC vào quỹ Avalanche Fuji, rút tiền trước hạn hoặc nhận tiền về ví.</li>
                   </ul>
                 </div>`,
          alt: 'Thanh điều hướng bên trái hiển thị 5 mục: Overview, People, Bills, Final split, Wallet.',
        },
        {
          title: 'Bước 4 · Quyết toán & Bắt buộc duyệt (Approve)',
          copy: `<p>Khi chuyến đi kết thúc, quy trình quyết toán diễn ra minh bạch và an toàn:</p>
                 <div class="guide-step-card">
                   <div class="guide-card-tag danger">⚠️ Lưu ý chốt sổ</div>
                   <ul style="margin: 6px 0 0 18px; padding: 0; line-height: 1.6;">
                     <li><b>Khóa & duyệt hóa đơn</b>: Hoàn tất phê duyệt các hóa đơn đang chờ.</li>
                     <li><b>Trưởng nhóm tính tiền</b>: Mở <b>Quyết toán (Final split)</b> để khóa tỷ giá USD/VND và công bố bảng phân bổ.</li>
                     <li><b>Bắt buộc Approve</b>: <b>Tất cả thành viên phải bấm "Approve" (Xác nhận)</b> số tiền của mình thì hệ thống mới cho phép giải ngân.</li>
                     <li><b>Thanh toán on-chain</b>: Trưởng nhóm thực hiện lệnh quyết toán; các thành viên vào <b>Ví (Wallet)</b> để rút số dư USDC về ví riêng.</li>
                   </ul>
                 </div>`,
          alt: 'Màn hình Final split hiển thị bảng quyết toán và các nút Approve xác nhận của thành viên.',
        },
      ],
    },
    en: {
      title: 'How to use TripVault',
      subtitle: 'Create a room, fund the vault, split expenses, and settle securely.',
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
          title: 'Step 2 · Invite group members (Invite members)',
          copy: `<p>Share the newly created room with your travel companions:</p>
                 <div class="guide-step-card">
                   <ul style="margin: 0 0 0 18px; padding: 0; line-height: 1.6;">
                     <li><b>6-digit room code</b>: Share the code (e.g. <code class="room-code-badge">624183</code>). Members click <b>Join a room</b> and enter it.</li>
                     <li><b>Copy invite link</b>: One click to copy the link and send via chat or social apps.</li>
                     <li>Members connect a wallet on <b>Avalanche Fuji</b> and sign a passwordless SIWE challenge to join.</li>
                   </ul>
                 </div>`,
          alt: 'Room invite card showing 6-digit room code and copy invite link button.',
        },
        {
          title: 'Step 3 · Navigation menu & Key tools (Sidebar)',
          copy: `<p>The sidebar navigation (or bottom bar on mobile) provides 5 essential tools:</p>
                 <div class="guide-step-card">
                   <ul style="margin: 0 0 0 18px; padding: 0; line-height: 1.7;">
                     <li>🏠 <b>Overview</b>: Room code, trip progress stepper, vault balance, and settings.</li>
                     <li>👥 <b>People</b>: Travelers roster, who paid what, who owes, and net positions.</li>
                     <li>🧾 <b>Bills</b>: Record real-world VND expenses with <b>Equal split</b> or <b>Custom split</b>.</li>
                     <li>⚖️ <b>Final split</b>: Calculate Zero-Sum balanced debt offsets converted to USDC.</li>
                     <li>💳 <b>Wallet</b>: Manage Fuji smart contract deposits, early withdrawals, and payouts.</li>
                   </ul>
                 </div>`,
          alt: 'Sidebar showing 5 navigation tabs: Overview, People, Bills, Final split, Wallet.',
        },
        {
          title: 'Step 4 · Settlement & Mandatory approvals (Approve)',
          copy: `<p>Once the journey ends, the settlement process is democratic and transparent:</p>
                 <div class="guide-step-card">
                   <div class="guide-card-tag danger">⚠️ Settlement rule</div>
                   <ul style="margin: 6px 0 0 18px; padding: 0; line-height: 1.6;">
                     <li><b>Finalize open bills</b>: Ensure all recorded bills are reviewed and approved.</li>
                     <li><b>Organizer prepares split</b>: Open <b>Final split</b> to lock the USD/VND reference rate and share amounts.</li>
                     <li><b>Mandatory Approvals</b>: <b>All members must review and click "Approve"</b> on their balance before settlement unlocks.</li>
                     <li><b>On-chain settlement</b>: Organizer triggers group payments; travelers claim their final USDC balances in <b>Wallet</b>.</li>
                   </ul>
                 </div>`,
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
