# Đưa TripVault lên Render

1. Giải nén gói và đưa bốn tệp trong thư mục này vào thư mục gốc của một repository GitHub riêng tư.
2. Mở [Render Dashboard](https://dashboard.render.com/), chọn **New → Blueprint**, rồi kết nối repository đó. Để **Blueprint Path** là `render.yaml`.
3. Xem lại cấu hình và chi phí trước khi bấm **Deploy Blueprint**. Gói này chọn Web Service Starter ở Singapore và ổ đĩa 1 GB để giữ dữ liệu phòng qua các lần khởi động lại.
4. Khi Render báo **Live**, mở đường dẫn HTTPS `.onrender.com` của dịch vụ. Mở đường dẫn đó trên điện thoại trong trình duyệt của ví hỗ trợ Avalanche Fuji để thử đăng nhập. Trên máy tính, dùng trình duyệt có tiện ích ví.
5. Tạo một phòng thử trên link mới và cho một tài khoản ví khác tham gia qua mã 6 số hoặc link mời.

[Tài liệu Render Blueprints](https://render.com/docs/infrastructure-as-code) · [Ổ đĩa lưu dữ liệu](https://render.com/docs/disks) · [Giá Render](https://render.com/pricing)

## Nếu cần giữ phòng đã tạo trên Mac

Trang mới bắt đầu với danh sách phòng trống. Nếu cần chuyển phòng cũ, hãy chuyển dữ liệu trước khi cả nhóm tạo phòng trên link mới. Tạo bản sao bằng chức năng backup của SQLite để lấy cả thay đổi mới nhất. Có thể dùng lệnh sau trong thư mục dự án trên Mac, nơi có thư mục `work`:

```sh
sqlite3 -readonly work/tripvault-rooms.sqlite3 ".backup 'tripvault-migration.sqlite3'"
sqlite3 tripvault-migration.sqlite3 'DELETE FROM auth_challenges; DELETE FROM auth_sessions; PRAGMA integrity_check;'
```

Giữ bản sao dữ liệu ở nơi riêng tư. Gói triển khai chỉ chứa mã và cấu hình. Sau lần triển khai đầu tiên và trước khi tạo phòng trên link mới, chuyển bản sao trực tiếp qua [SSH/SFTP của Render](https://render.com/docs/disks#transferring-files), lưu ở `/var/data/tripvault-migration.sqlite3`. Sau khi tải xong, đổi giá trị `TRIPVAULT_DB` trong `render.yaml` sang đường dẫn này rồi cập nhật repository để triển khai lại. Chủ phòng và thành viên đăng nhập lại trên link mới bằng đúng tài khoản ví. Lấy lại link mời từ trang mới cho các phòng đang nhận thành viên.

TripVault tiếp tục chạy trên Avalanche Fuji.
