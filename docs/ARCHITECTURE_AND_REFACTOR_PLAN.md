# TripVault · Kế Hoạch Tái Cấu Trúc & Kiến Trúc Dự Án (Refactoring & Architecture Plan)

> **Mục tiêu dự án:** MVP cho Hackathon trong hệ sinh thái **Avalanche**.  
> **Nguyên tắc:** Tập trung hoàn thiện kiến trúc nền tảng, logic toán học và bảo mật; chưa can thiệp giao diện (UI) ở giai đoạn này.

---

## 1. Tóm Tắt Thấu Hiểu (Understanding Summary)

* **Sản phẩm:** **TripVault** là ứng dụng Web2 + Web3 kết hợp chi tiêu ngoài đời thực bằng tiền mặt (VND off-chain) và quỹ bảo chứng ký quỹ khóa theo thời gian bằng USDC trên mạng **Avalanche Fuji Testnet** (on-chain).
* **Vấn đề giải quyết:** Xóa bỏ rủi ro "ứng tiền trước - đòi tiền sau khó khăn" trong các chuyến du lịch nhóm (4–12 thành viên) bằng hợp đồng thông minh Avalanche Escrow.
* **Nguyên tắc đồng thuận:** Tuân thủ nguyên tắc **100% thành viên duyệt phương án chia tiền (`settle`)** trước khi giải ngân, phù hợp với sự tin cậy trong nhóm bạn thân.
* **Chiến lược Refactor:** 
  1. Tách logic toán học và thuật toán bù trừ nợ bảo toàn Zero-Sum ra module độc lập có test tự động.
  2. Chuẩn hóa Backend (Bun & Node.js cross-runtime) với SQLite WAL mode.
  3. Loại bỏ script build Python nối chuỗi HTML, thay bằng cơ chế đóng gói hiện đại tiêu chuẩn.
  4. Đóng gói Demo Zero-Setup (Web Cloud link cho Ban Giám Khảo & 1-Click launcher cho Local Dev).
* **Ranh giới (Non-goals):** Chưa thay đổi UI/UX, CSS ở giai đoạn này; không sử dụng Oracle on-chain phức tạp cho tỷ giá VND/USDC trong khuôn khổ MVP.

---

## 2. Giả Định Hệ Thống (System Assumptions)

1. **Mạng Blockchain:** Avalanche Fuji Testnet (Chain ID `43113`), token thanh toán là Testnet USDC (`0x5425890298aed601595a70AB815c96711a31Bc65`).
2. **Quy mô:** Mỗi phòng du lịch tối đa 12 thành viên (`MAX_MEMBERS = 12`).
3. **Môi trường chạy:** Node.js 18+ hoặc Bun 1.1+, database SQLite với chế độ ghi WAL.
4. **Xác thực:** EIP-4361 Sign-In with Ethereum (SIWE) không cần mật khẩu.

---

## 3. Nhật Ký Quyết Định Kiến Trúc (Decision Log)

| Mã | Quyết định | Các phương án đã xem xét | Lý do lựa chọn |
| :--- | :--- | :--- | :--- |
| **DEC-01** | **Nguyên tắc đồng thuận 100% khi Settle** | Cơ chế đa số quá bán (51%), Quyền quyết định của Organizer | Đảm bảo tính công bằng tuyệt đối cho nhóm bạn, ngăn chặn gian lận số liệu chi tiêu. |
| **DEC-02** | **Quản lý lịch sử sửa đổi qua `REFACTORING_LOG.md`** | Chỉ dùng Git commit, Viết tài liệu ADR riêng rẽ | Đảm bảo mỗi thay đổi đều có bối cảnh, lý do, kết quả test và phân tích rủi ro tập trung. |
| **DEC-03** | **Lựa chọn Kiến trúc Modular hóa + Zero-Setup Deploy (Hướng 1)** | Vá tại chỗ Monolith (Hướng 3), Chuyển toàn bộ sang Serverless D1 (Hướng 2) | Giải quyết tận gốc nợ kỹ thuật, loại bỏ build script Python mong manh, tạo nền tảng vững chắc để sau này nâng cấp UI. |
| **DEC-04** | **Bảo toàn Zero-Sum trong quy đổi VND/USDC** | Làm tròn độc lập từng cặp chuyển khoản (Pairwise Rounding) | Ngăn ngừa lỗi `InvalidPlan()` do tổng `net != 0` trên Smart contract khi có sai số làm tròn số thập phân. |
| **DEC-05** | **Tạo tài liệu hướng dẫn kỹ thuật nội bộ (`TEAM_GUIDE.md`)** | Để tài liệu rải rác trong code comment | Giúp các thành viên mới nắm bắt nhanh cơ chế SIWE, vòng đời hợp đồng Avalanche và luồng dữ liệu. |

---

## 4. Kiến Trúc Hệ Thống Chi Tiết

### 4.1. Phân Tách Gói Mã Nguồn (Modular Structure)

```ini
TripVault/
├── packages/
│   ├── core/                    # Pure ESM/TypeScript module (Logic toán học & ABI)
│   │   ├── src/
│   │   │   ├── math/            # Thuật toán chia bill, quy đổi tỷ giá, Zero-Sum balancer
│   │   │   ├── contracts/       # ABI và type definitions cho TripVault Avalanche
│   │   │   └── types/           # Định nghĩa cấu trúc Room, Bill, Member, Plan
│   │   └── test/                # Unit test toán học (chạy siêu nhanh, 100% coverage)
│   │
│   ├── server/                  # Backend REST API (Cross-runtime Bun & Node.js)
│   │   ├── src/
│   │   │   ├── routes/          # auth (SIWE), rooms, bills, top-up reminders
│   │   │   ├── services/        # fuji-rpc validator, quote fetcher
│   │   │   └── db/              # SQLite connection (better-sqlite3 / bun:sqlite)
│   │   └── test/                # Integration test API
│   │
│   └── client/                  # Frontend SPA (Giữ nguyên toàn bộ DOM & CSS hiện tại)
│       ├── src/                 # Tách từ file JS khổng lồ thành các module giao diện
│       └── vite.config.ts       # Công cụ build chuẩn, thay thế build-tripvault-rooms.py
│
├── docs/                        # Tài liệu dự án
│   ├── ARCHITECTURE_AND_REFACTOR_PLAN.md
│   └── TEAM_GUIDE.md            # Hướng dẫn chi tiết cho các thành viên trong team
│
├── REFACTORING_LOG.md           # Nhật ký ghi nhận từng lần chỉnh sửa mã nguồn
└── scripts/                     # Launchers và verify scripts
    ├── run-demo.bat             # 1-Click demo cho Windows
    └── run-demo.sh              # 1-Click demo cho macOS/Linux
```

### 4.2. Thuật Toán Cân Bằng Sai Số Làm Tròn (Zero-Sum Balancer)

Khi quy đổi từ VND sang micro-USDC ($1 \text{ USDC} = 10^6 \text{ units}$):
1. **Tính Net VND:** Mỗi bill được chia đều cho danh sách người tham gia, phần dư được chia tuần tự theo chỉ mục. Tổng Net VND của phòng luôn $\equiv 0$.
2. **Quy đổi dự thảo:** $targetUnits[i] = \text{round}\left(\frac{netVND[i] \times 10^6}{rate}\right)$.
3. **Hiệu chỉnh sai số:**
   $$\Delta = \sum_{i=1}^{N} targetUnits[i]$$
   Nếu $\Delta \neq 0$: Phân bổ giá trị bù trừ $-\Delta$ vào vị trí có sai số làm tròn lớn nhất sao cho $\sum changes[i] \equiv 0$.
4. **Băm kế hoạch:**
   $$planHash = \text{keccak256}(\text{abi.encode}(vaultAddress, revision, changes))$$

### 4.3. Vòng Đời Smart Contract trên Avalanche Fuji

1. **Khởi tạo (`TripVaultDeadline.sol`):**
   * Tham số: `members[]`, `depositDeadline`, `startsAt`, `endsAt`, `minDeposit`.
2. **Ký quỹ (Deposit):**
   * Các thành viên nạp tối thiểu `minDeposit` USDC.
   * **Ngoại lệ:** Nếu đến `depositDeadline` có thành viên chưa nạp, `fundingFailed()` bật `true` $\to$ Cho phép mọi người gọi `claim()` rút lại tiền ngay lập tức.
3. **Khóa quỹ & Chuyến đi (Trip Active):**
   * Sau `startsAt`, rút tiền bị khóa. Chi tiêu thực tế bằng VND diễn ra ngoài đời và được ghi nhận trên Room Server.
4. **Đề xuất thanh toán (Propose Split):**
   * Sau khi chuyến đi kết thúc (hoặc Organizer gọi `endTripEarly()`), Organizer gửi `changes[]` bảo đảm `net == 0`.
5. **Đồng thuận 100% & Settle:**
   * Các thành viên ký duyệt `approve(planHash, true)`.
   * Thành viên nợ nạp bù khoản thiếu qua `depositForPlan(amount, planHash)`.
   * Organizer kích hoạt `settle(planHash)`.
6. **Rút tiền & Cứu hộ khẩn cấp:**
   * Sau khi settle, thành viên gọi `claim()` rút USDC về ví.
   * Nếu không thể settle, sau 7 ngày (`endsAt + 7 days`), cơ chế `claim()` khẩn cấp tự động mở để mọi người rút lại phần tiền gốc đã nạp.

---

## 5. Kế Hoạch Triển Khai Từng Bước (Implementation Phases)

Mọi bước triển khai bắt buộc ghi nhật ký vào `REFACTORING_LOG.md` và kiểm thử xác nhận trước khi chuyển bước tiếp theo:

* **Pha 1: Khởi tạo Nền tảng & Nhật Ký**
  * Khởi tạo file `REFACTORING_LOG.md` với định dạng chuẩn.
  * Xuất bản tài liệu `docs/TEAM_GUIDE.md` giải thích chi tiết cơ chế cho cả nhóm.
* **Pha 2: Tách Module Toán học & Logic Cốt lõi (`packages/core`)**
  * Đóng gói logic chia nợ, quy đổi tỷ giá và thuật toán Zero-Sum Balancer.
  * Viết unit test bao phủ toàn bộ case biên số lẻ và tỷ giá biến động.
* **Pha 3: Chuẩn Hóa Backend API (`packages/server`)**
  * Tách `server.js` thành các route và service rõ ràng.
  * Hỗ trợ dual-runtime: Node.js (`better-sqlite3`) và Bun (`bun:sqlite`).
  * Bổ sung test tự động cho luồng xác thực chữ ký ví EIP-4361 SIWE.
* **Pha 4: Hiện Đại Hóa Build Pipeline & Đóng Gói Demo**
  * Chuyển đổi mã nguồn client sang hệ thống bundle hiện đại, giữ nguyên 100% UI/CSS.
  * Cấu hình triển khai Web Demo 1-link (Vercel / Cloudflare Pages) cho Hackathon.
  * Tạo script launcher 1-click cho môi trường local.
