# Secure Chat Web

## 1. Giới thiệu dự án
- **Tên dự án:** Secure Chat Web
- **Mục tiêu:** Chuyển đổi và nâng cấp ứng dụng nhắn tin bảo mật từ phiên bản desktop (Python/Flask/PyQt5) sang ứng dụng web hiện đại, mở rộng khả năng tiếp cận và tối ưu trải nghiệm người dùng trên nền tảng trình duyệt.

## 2. Công nghệ dự kiến
- **Backend:** NestJS + TypeScript.
- **Frontend:** Next.js + TypeScript.
- **Database:** Tiếp tục sử dụng cơ sở dữ liệu MySQL hiện tại.
- **Realtime:** Socket.IO.
- **Mã hóa:** Duy trì và bảo toàn giao thức mã hóa đầu cuối (E2EE) tương thích với logic mã hóa đã có sau khi xác minh mã nguồn gốc.

## 3. Nguyên tắc bảo toàn dữ liệu và bảo mật
- **Bảo toàn E2EE:** Đảm bảo toàn bộ quy trình mã hóa và giải mã đầu cuối thực hiện ở phía client, giữ nguyên khả năng giải mã các tin nhắn cũ đã lưu trữ trong cơ sở dữ liệu.
- **Bảo toàn dữ liệu cũ:** Giữ nguyên vẹn mô hình dữ liệu, tài khoản người dùng và lịch sử tin nhắn trong MySQL, đảm bảo tính liên tục của dữ liệu khi chuyển dịch sang hệ thống mới.
- **Bảo mật mã nguồn:** Không đưa thông tin nhạy cảm (Private Key, file cấu hình `.env`, chuỗi kết nối chứa mật khẩu thật, database dump) vào repository.

## 4. Trạng thái hiện tại
- **Trạng thái:** Giai đoạn khởi tạo repository và chuẩn bị môi trường làm việc độc lập.
- **Ghi chú:** Chưa tiến hành cài đặt package hoặc triển khai mã nguồn backend/frontend trong giai đoạn này.

## 5. Các giai đoạn thực hiện dự kiến
1. **Phân tích source cũ:** Kiểm tra cấu trúc ứng dụng Python/PyQt5/Flask hiện tại, bóc tách luồng nghiệp vụ, giao thức mã hóa E2EE và lược đồ cơ sở dữ liệu MySQL.
2. **Thiết kế kiến trúc:** Lập ma trận truy vết nghiệp vụ, thiết kế kiến trúc backend NestJS, frontend Next.js, API contracts và đặc tả luồng Socket.IO.
3. **Triển khai Backend:** Xây dựng hệ thống REST API, module xác thực, tích hợp TypeORM với cơ sở dữ liệu MySQL và Socket.IO Gateway.
4. **Triển khai E2EE phía Client:** Chuyển dịch và kiểm thử thư viện mã hóa phía client (Web Crypto API / tương đương) đảm bảo đồng nhất với thuật toán hiện tại.
5. **Triển khai Frontend:** Xây dựng giao diện ứng dụng web bằng Next.js, tích hợp luồng tin nhắn realtime và quản lý khóa người dùng an toàn.
6. **Kiểm thử và chuyển đổi:** Kiểm thử hồi quy, kiểm thử giải mã dữ liệu cũ, nghiệm thu bảo mật và đưa hệ thống vào vận hành.
