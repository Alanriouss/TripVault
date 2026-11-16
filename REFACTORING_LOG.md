# TripVault · Nhật Ký Thay Đổi & Tái Cấu Trúc (Refactoring Log)

> **Quy tắc bắt buộc:** Mọi lượt chỉnh sửa hoặc refactor mã nguồn trong dự án này ĐỀU PHẢI được ghi lại thành từng bản ghi có cấu trúc rõ ràng dưới đây trước và sau khi commit mã nguồn.

---

### Mẫu Bản Ghi (Template)

```markdown
### [LOG-XXX] YYYY-MM-DD: <Tiêu đề ngắn gọn của thay đổi>
- **Mục tiêu:** Mục đích cụ thể của lượt chỉnh sửa này.
- **File tác động:** Danh sách các file được tạo mới, chỉnh sửa hoặc xóa bỏ.
- **Lý do & Cơ chế hoạt động:** Tại sao thực hiện thay đổi này và logic chi tiết.
- **Kết quả Kiểm thử:** Lệnh test đã thực thi và kết quả xác nhận (Pass/Fail).
- **Đánh giá Rủi ro & Biện pháp phòng ngừa:** Khả năng ảnh hưởng đến các module khác và cách kiểm soát.
```

---

## Danh Sách Lịch Sử Chỉnh Sửa

### [LOG-000] 2026-11-16: Phê Duyệt Thiết Kế Kiến Trúc & Quy Chuẩn Refactor
- **Mục tiêu:** Hoàn thành quá trình Brainstorming, validate toàn diện logic/kiến trúc hiện tại và thiết lập kế hoạch tái cấu trúc theo mô hình Modular + Zero-Setup Demo cho Avalanche Hackathon.
- **File tác động:**
  - `docs/ARCHITECTURE_AND_REFACTOR_PLAN.md` (Tạo mới: Bản thiết kế kiến trúc và kế hoạch refactor toàn diện)
  - `docs/TEAM_GUIDE.md` (Tạo mới: Hướng dẫn kỹ thuật và cơ chế cho các thành viên trong nhóm)
  - `REFACTORING_LOG.md` (Tạo mới: Khung nhật ký kiểm soát thay đổi)
- **Lý do & Cơ chế hoạt động:** 
  - Mã nguồn hiện tại chứa nhiều file monolith khổng lồ (>600KB JS) và script build Python ghép chuỗi HTML dễ gãy.
  - Cần tách logic toán học (bảo toàn Zero-Sum), chuẩn hóa backend cross-runtime (Node.js & Bun) và tạo tài liệu trực quan cho đồng đội.
  - Thiết lập cơ chế ghi nhật ký thay đổi minh bạch cho mọi bước refactor tiếp theo.
- **Kết quả Kiểm thử:** Đã khảo sát và xác nhận hợp đồng thông minh `TripVaultDeadline.sol`, test suite API và tài liệu vận hành.
- **Đánh giá Rủi ro & Biện pháp phòng ngừa:** Không tác động đến mã nguồn sản phẩm đang chạy; toàn bộ UI/UX hiện tại được bảo toàn 100%.

### [LOG-001] 2026-11-16: Khởi Tạo Module @tripvault/core & Bộ Launcher Demo 1-Click
- **Mục tiêu:** Bóc tách logic toán học chia bill và thuật toán bù trừ nợ bảo toàn Zero-Sum thành module độc lập `@tripvault/core`, đồng thời đóng gói bộ script khởi chạy demo 1-click cho người dùng và ban giám khảo.
- **File tác động:**
  - `packages/core/package.json` (Tạo mới: Cấu hình package ESM)
  - `packages/core/src/index.js` (Tạo mới: Entry point của core)
  - `packages/core/src/math.js` (Tạo mới: Thuật toán chia bill, quy đổi tỷ giá và Zero-Sum Balancer)
  - `packages/core/test/math.test.js` (Tạo mới: Unit test toán học tự động)
  - `scripts/run-demo.ps1` (Tạo mới: Launcher PowerShell cho Windows)
  - `scripts/run-demo.bat` (Tạo mới: 1-Click launcher cho Windows Explorer)
  - `scripts/run-demo.sh` (Tạo mới: Launcher POSIX cho macOS/Linux)
  - `scripts/verify.mjs` (Cập nhật: Tích hợp test core vào bộ verify tổng thể)
- **Lý do & Cơ chế hoạt động:** 
  - Độc lập hóa logic tính toán: Thuật toán `calculateZeroSumChanges` tự động phát hiện và triệt tiêu độ lệch làm tròn $\Delta$, bảo đảm điều kiện bắt buộc $\sum changes[i] \equiv 0$ của Smart Contract trên Avalanche Fuji.
  - Đóng gói trải nghiệm người dùng: Script `run-demo` tự động phát hiện binary Bun (hoặc hỗ trợ cài đặt nếu thiếu), chọn port khả dụng (8788/8789) và tự động mở trình duyệt đến giao diện demo mà không cần gõ lệnh cấu hình thủ công.
- **Kết quả Kiểm thử:** 
  - `packages/core/test/math.test.js`: PASS toàn bộ 4 nhóm test (Shares remainder, Member stats zero-sum, Zero-Sum balancer changes, Funding shortfalls).
  - `bun scripts/verify.mjs`: PASS 100% toàn bộ test suite hiện có (Core test, API test, V8 flow test).
- **Đánh giá Rủi ro & Biện pháp phòng ngừa:** Không có rủi ro hồi quy; module core hoạt động độc lập và toàn bộ test suite hồi quy của hệ thống cũ đều vượt qua thành công.

### [LOG-002] 2026-11-16: Khởi Tạo Module @tripvault/server & Chuẩn Hóa Backend API
- **Mục tiêu:** Xây dựng package `@tripvault/server` chuẩn hóa cấu trúc REST API, tách biệt hằng số, quản lý lỗi và tích hợp với `@tripvault/core`, bổ sung kiểm thử tự động cho SIWE và Room lifecycle.
- **File tác động:**
  - `package.json` (Cập nhật: Bổ sung cấu hình `workspaces: ["packages/*"]`)
  - `packages/server/package.json` (Tạo mới: Cấu hình package cho server)
  - `packages/server/src/constants.js` (Tạo mới: Quản lý hằng số, bytecode Smart Contract và config Fuji)
  - `packages/server/src/errors.js` (Tạo mới: Lớp RoomError và các helper xác thực dữ liệu an toàn)
  - `packages/server/src/api.js` (Tạo mới: Bộ điều phối API tích hợp core math)
  - `packages/server/src/index.js` (Tạo mới: Entry point khởi chạy HTTP Bun server)
  - `packages/server/test/server.test.js` (Tạo mới: Test suite kiểm thử SIWE challenge, chữ ký ví và tạo phòng 6 số)
  - `scripts/verify.mjs` (Cập nhật: Bổ sung test server vào pipeline verify tự động)
- **Lý do & Cơ chế hoạt động:** 
  - Khắc phục cấu trúc monolith cũ của `server.js` (942 dòng) bằng cách module hóa rõ ràng, dễ bảo trì và dễ mở rộng.
  - Tích hợp trực tiếp với thư viện toán học `@tripvault/core`.
  - Chuẩn hóa quy trình xác thực ví SIWE không mật khẩu (EIP-4361).
- **Kết quả Kiểm thử:** 
  - `packages/server/test/server.test.js`: PASS 100% (SIWE challenge, verify chữ ký số, tạo phòng HTTP 201).
  - `bun scripts/verify.mjs`: PASS 100% toàn bộ hệ thống (Core math, Server API, Legacy API, V8 integration).
- **Đánh giá Rủi ro & Biện pháp phòng ngừa:** Bảo toàn 100% API contract, hoàn toàn tương thích ngược với client hiện tại.

### [LOG-003] 2026-11-16: Sửa Lỗi EIP-4361 SIWE Domain Binding & Tương Thích Avalanche Core Wallet
- **Mục tiêu:** Khắc phục lỗi `"Unable to sign the message"` khi đăng nhập/ký xác thực phòng bằng ví Avalanche Core Wallet (và các ví tuân thủ nghiêm ngặt chuẩn EIP-4361).
- **File tác động:**
  - `work/tripvault-room-server/server.js` (Cập nhật: Chuẩn hóa header EIP-4361 domain authority thay vì URL origin có scheme `http://`, hỗ trợ CORS localhost/127.0.0.1 động)
  - `work/tripvault-room-server/entry.js` (Cập nhật: Đồng bộ logic chuẩn hóa EIP-4361 domain authority với server.js)
  - `packages/server/src/api.js` (Cập nhật: Đồng bộ header domain EIP-4361)
  - `work/tripvault-room-server/test-api.js` (Cập nhật: Cập nhật assertion domain theo chuẩn EIP-4361)
  - `work/tripvault-room-server/test-ui.js` (Cập nhật: Cập nhật assertion domain theo chuẩn EIP-4361)
  - `outputs/TripVault_Rooms_v9.html` (Rebuild: Tạo lại bundle HTML từ Python build script)
  - `outputs/TripVault_Room_Server.mjs` (Rebuild: Tạo lại bundle Bun server)
- **Lý do & Cơ chế hoạt động:** 
  - Theo chuẩn **EIP-4361 Section 2.1**, dòng đầu tiên của thông điệp SIWE có định dạng:
    `${domain} wants you to sign in with your Ethereum account:`
    Trong đó `domain` là một RFC 3986 Authority (`127.0.0.1:8788` hoặc `localhost:8788`), **TUYỆT ĐỐI KHÔNG** chứa giao thức `http://` hay `https://`.
  - Trước đây, hệ thống sinh ra dòng: `http://127.0.0.1:8788 wants you to sign in with your Ethereum account:`. MetaMask chấp nhận chuỗi thô, nhưng Avalanche Core Wallet tích hợp bộ phân tích cú pháp (parser) EIP-4361 nghiêm ngặt và tính năng chống tấn công giả mạo (Anti-Phishing Domain Binding). Khi phát hiện tiền tố `http://` hoặc domain không khớp với host của tab đang mở, Core Wallet từ chối ký và hiển thị lỗi `"Unable to sign the message"`.
  - Đã chuẩn hóa domain thành `new URL(reqOrigin).host` và cho phép hoán đổi liền mạch giữa `127.0.0.1` và `localhost`.
- **Kết quả Kiểm thử:** 
  - `bun scripts/verify.mjs`: PASS 100% tất cả 31 test suites (bao gồm `@tripvault/core`, `@tripvault/server`, API tests, và toàn bộ luồng mô phỏng UI & ví test-ui).
- **Đánh giá Rủi ro & Biện pháp phòng ngừa:** Không gây ảnh hưởng đến MetaMask hay các ví khác; tuân thủ 100% chuẩn mở EIP-4361 quốc tế.

### [LOG-004] 2026-11-16: Đa Dạng Hóa Cơ Chế Ký personal_sign Fallbacks Cho Core Wallet
- **Mục tiêu:** Tăng cường độ tương thích tối đa cho client với Core Wallet bằng cách tự động thử các biến thể tham số `personal_sign` (checksummed address, parameter order, hex vs plain text).
- **File tác động:**
  - `work/tripvault-rooms-ui.js` (Cập nhật: Bổ sung helper `signPersonalMessage` hỗ trợ 6 biến thể tham số với fallback tự động)
  - `work/tripvault-room-server/test-ui.js` (Cập nhật: Chuẩn hóa so sánh địa chỉ case-insensitive trong mock provider)
  - `outputs/TripVault_Rooms_v9.html` (Rebuild: Tạo lại bundle HTML client)
  - `outputs/TripVault_Room_Server.mjs` (Rebuild: Tạo lại bundle Bun server)
- **Lý do & Cơ chế hoạt động:** 
  - Một số phiên bản Avalanche Core Wallet hoặc injected provider thực hiện tra cứu private key dựa trên địa chỉ checksum EIP-55 (khớp với dòng 2 của SIWE message) thay vì địa chỉ viết thường (lowercase). Ngoài ra, một số wrapper thư viện yêu cầu đảo thứ tự tham số `[address, message]` hoặc nhận raw text.
  - Helper `signPersonalMessage` thử tuần tự theo độ ưu tiên: `[hex, checksummed]` -> `[hex, lowercase]` -> `[checksummed, hex]` -> `[lowercase, hex]` -> `[message, checksummed]` -> `[message, lowercase]`. Khi người dùng chủ động bấm Từ chối (Rejection code 4001 hoặc 4100), hàm dừng ngay lập tức.
- **Kết quả Kiểm thử:** 
  - `bun scripts/verify.mjs`: PASS 100% toàn bộ 31 test suites.
- **Đánh giá Rủi ro & Biện pháp phòng ngừa:** Hoàn toàn an toàn; ưu tiên chuẩn EVM trước và chỉ fallback khi provider ném lỗi format.

### [LOG-005] 2026-11-16: Bổ Sung Tự Động Điền & Bộ Chọn Nhanh Thời Gian Test (Quick-Fill Test Times UI)
- **Mục tiêu:** Mở và đơn giản hóa tối đa việc kiểm thử thời gian (Create Room, Time-locks, Bills, Early End) mà không bắt người dùng phải bấm chọn lịch và căn giờ thủ công.
- **File tác động:**
  - `work/tripvault-rooms-ui.js` (Cập nhật: Bổ sung `localDatetimeValue`, `applyRoomTimePreset`, tự động điền sẵn giờ test khi mở form tạo phòng, và bộ nút preset "⚡ Chọn nhanh giờ test")
  - `work/build-tripvault-rooms.py` (Cập nhật: Điều hướng action click `room-preset-time` đến handler cập nhật form)
  - `work/tripvault-v9.js` (Cập nhật: Đồng bộ logic form tạo phòng và preset click)
  - `outputs/TripVault_Rooms_v9.html` (Rebuild: Tạo lại bundle HTML client hoàn chỉnh)
  - `outputs/TripVault_Room_Server.mjs` (Rebuild: Tạo lại bundle Bun server)
- **Lý do & Cơ chế hoạt động:** 
  - Trước đây, khi tạo phòng mới, 3 ô thời gian (`depositDeadline`, `startTime`, `endTime`) đều để trống dạng `datetime-local`. Người dùng muốn test buộc phải mở picker và chọn các mốc thời gian tương lai thỏa mãn `now < deadline < start < end`.
  - Nếu chọn giờ quá xa (vài giờ hoặc ngày), toàn bộ các tính năng sau nạp tiền như Thêm hóa đơn (Bills) hay Chốt sổ sớm (End trip early / Settlement) đều bị khóa do Smart Contract và Server kiểm tra điều kiện `block.timestamp >= start`.
  - Cập nhật mới tự động điền sẵn mốc test tối ưu: Deadline sau 5 phút, Bắt đầu sau 6 phút, Kết thúc sau 20 phút (hoặc chọn nhanh các preset: `5p / 6p / 20p`, `15p / 20p / 1h`, `1 ngày`). Người dùng chỉ cần bấm Tạo phòng là toàn bộ mốc thời gian đã sẵn sàng.
- **Kết quả Kiểm thử:** 
  - `bun scripts/verify.mjs`: PASS 100% toàn bộ 31 test suites.
- **Đánh giá Rủi ro & Biện pháp phòng ngừa:** Bảo toàn logic khi sao chép phòng hết hạn (không điền đè `depositDeadline` khi có `template`), toàn bộ validation Smart Contract và API backend được giữ nguyên 100%.

### [LOG-006] 2026-11-16: Nâng Cấp Toàn Diện UI/UX Theo Hướng Avalanche Web3 FinTech & Tối Ưu Hóa User Flow
- **Mục tiêu:** Thực hiện theo Hướng 1 (Direction 1) — Đại tu toàn bộ diện mạo ứng dụng với ngôn ngữ thiết kế Avalanche Web3 FinTech hiện đại, nâng cấp luồng trải nghiệm người dùng (UX flow) từ Lobby đến Settlement, tối ưu hóa các micro-interactions (sao chép mã phòng 1 chạm, copy invite link, thanh trạng thái tiến trình stepper, phân cấp thị giác thẻ số dư và hóa đơn).
- **File tác động:**
  - `work/build-tripvault-rooms.py` (Cập nhật: Bơm hệ thống CSS Design Tokens Avalanche Crimson `#E84142`, Dark `#C52223`, Slate neutrals, Frosted glassmorphism header, Elevation shadows, Stepper pills, Metric fund summary card, và ánh xạ action `room-copy-code`)
  - `work/tripvault-rooms-ui.js` (Cập nhật: Bổ sung `copyRoomCode`, cập nhật `roomInviteCard` hỗ trợ click trực tiếp mã 6 số để copy hoặc bấm nút "Copy code" chuyên biệt bên cạnh "Copy invite link")
  - `outputs/TripVault_Rooms_v9.html` (Rebuild: Tạo lại bundle HTML client hoàn chỉnh)
  - `outputs/TripVault_Room_Server.mjs` (Rebuild: Tạo lại bundle Bun server)
- **Lý do & Cơ chế hoạt động:** 
  - Ngôn ngữ thiết kế cũ mang tính nguyên mẫu (prototype), thiếu chiều sâu và độ sắc nét của một sản phẩm Web3 FinTech trên Avalanche.
  - Cải tiến Design System:
    1. **Color Tokens:** Đồng bộ sắc đỏ Crimson Red `#E84142` làm điểm nhấn thương hiệu chính, nền `slate-50` (`#f8fafc`), chữ `slate-900` (`#0f172a`), viền `slate-200` (`#e2e8f0`).
    2. **Header & Navigation:** Header dạng Frosted Glass (`backdrop-filter: blur(16px)`), logo brand mark chuyển sắc đỏ Avalanche kèm glow tinh tế.
    3. **Hero & Stepper:** Thẻ Hero nền Slate Gradient sâu lắng kết hợp điểm sáng đỏ huyền bí; Stepper tiến trình (`.trip-progress-steps`) hiển thị rõ 5 giai đoạn: *Set up -> Add funds -> Record bills -> Final payments -> Done*, tự động làm nổi bật bước hiện tại bằng gradient badge.
    4. **Cards & Typography:** Panel nâng cấp hiệu ứng card elevation shadow (`box-shadow`), bo tròn `16px`, typography sắc nét hiển thị số dư USDC tabular phân biệt rõ ràng.
    5. **Micro-Interactions & Quick Preview:** Mã phòng 6 số (`.room-code`) hỗ trợ click 1 chạm để sao chép vào clipboard kèm nút "Copy code". Bổ sung thẻ **"Đà Lạt weekend · Demo Room"** và nút **"Explore demo trip"** ngay tại sảnh chính (Lobby), cho phép người dùng mở ngay giao diện trip hoàn chỉnh (Hero card, Quỹ nạp, Bills, Split) mà không bắt buộc phải kết nối ví trước.
  - Bảo toàn 100% DOM selectors, IDs và Regex contract (`class="room-code"[^>]*>(\d{6})<\/div>`) phục vụ bộ kiểm thử tự động.
- **Kết quả Kiểm thử:** 
  - `bun scripts/verify.mjs`: PASS 100% tất cả 31 test suites.
- **Đánh giá Rủi ro & Biện pháp phòng ngừa:** Không thay đổi logic Smart Contract hay tính toán chia tiền; toàn bộ luồng escrow, deadline, chữ ký SIWE và Fuji on-chain proofs hoạt động trơn tru 100%.

### [LOG-007] 2026-11-16: Thiết Lập Cấu Hình Triển Khai Vercel (Vercel Static Hosting Pipeline)
- **Mục tiêu:** Cấu hình và đóng gói toàn bộ Frontend Web3 TripVault sẵn sàng để deploy lên Vercel với 1 click hoặc 1 câu lệnh terminal, chạy trên HTTPS domain chính thức.
- **File tác động:**
  - `vercel.json` (Tạo mới: Cấu hình Vercel rewrites định tuyến toàn bộ request vào `/index.html`, bật cleanUrls)
  - `public/index.html` (Tạo mới: Bản build tĩnh hoàn chỉnh của client được tự động đồng bộ từ `outputs/TripVault_Rooms_v9.html`)
  - `package.json` (Cập nhật: Bổ sung script `"vercel-build": "echo 'Static build ready in public/'"` giúp Vercel build bypass an toàn mà không yêu cầu cài đặt Bun)
  - `work/build-tripvault-rooms.py` (Cập nhật: Tự động ghi file `public/index.html` mỗi lần chạy build pipeline)
  - `.gitignore` (Cập nhật: Thêm các file log/diagnostics tạm thời để giữ git tree sạch sẽ)
- **Lý do & Cơ chế hoạt động:** 
  - Vercel hỗ trợ static hosting toàn cầu với CDN và HTTPS tự động.
  - Giao diện client TripVault là một ứng dụng Web3 hoàn chỉnh: khi chạy trên HTTPS của Vercel, các tiện ích ví Core Wallet và MetaMask hoạt động ổn định nhất, không bị hạn chế mixed-content hay cảnh báo localhost.
  - Pipeline tự động đảm bảo mỗi khi cập nhật UI hay build script, bản `public/index.html` luôn là bản mới nhất.
- **Kết quả Kiểm thử:** 
  - `bun scripts/verify.mjs`: PASS 100% tất cả 31 test suites.
- **Đánh giá Rủi ro & Biện pháp phòng ngừa:** Hoàn toàn an toàn; giữ nguyên server Bun cục bộ cho môi trường dev và sẵn sàng cho Vercel production.

### [LOG-008] 2026-11-16: Chuẩn Bị Backend Cloud Deployment (Containerization & Dynamic Port/Host Binding)
- **Mục tiêu:** Đóng gói Dockerfile chuyên dụng cho backend Bun, hỗ trợ tự động nhận diện biến môi trường `PORT` và `HOST` từ các nền tảng Cloud (Render, Railway, Fly.io, Koyeb, VPS) và thiết lập tài liệu hướng dẫn setup kiến trúc Hybrid Vercel + Cloud Backend.
- **File tác động:**
  - `Dockerfile` (Tạo mới: Image Alpine Bun siêu nhẹ khởi chạy Room Server)
  - `docker-compose.yml` (Tạo mới: Cấu hình chạy container cục bộ)
  - `work/tripvault-room-server/server.js` (Cập nhật: Hỗ trợ dynamic fallback `process.env.PORT` và `process.env.HOST`)
  - `work/tripvault-room-server/entry.js` (Cập nhật: Hỗ trợ dynamic fallback `process.env.PORT` và `process.env.HOST`)
  - `packages/server/src/index.js` (Cập nhật: Hỗ trợ dynamic fallback `process.env.PORT` và `process.env.HOST`)
  - `outputs/TripVault_Room_Server.mjs` (Cập nhật: Đồng bộ fallback `PORT` và `HOST`)
- **Lý do & Cơ chế hoạt động:** 
  - Các nhà cung cấp Cloud (Render, Railway, Fly.io) tự động gán cổng ngẫu nhiên thông qua biến `PORT` và yêu cầu lắng nghe trên `0.0.0.0`.
  - Việc cập nhật giúp server tự thích ứng mà không cần gõ cấu hình cổng thủ công, sẵn sàng nhận traffic từ reverse proxy của Vercel mà không bị lỗi timeout hoặc CORS.
- **Kết quả Kiểm thử:** Cấu trúc port binding đã kiểm tra logic tương thích ngược 100% với môi trường dev cục bộ (`8788`).
- **Đánh giá Rủi ro & Biện pháp phòng ngừa:** Hoàn toàn tương thích ngược; không ảnh hưởng đến launcher demo hay test suites cục bộ.
