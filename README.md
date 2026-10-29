# SECURE CHAT WEB — HƯỚNG DẪN VẬN HÀNH & TÀI LIỆU KỸ THUẬT TOÀN DIỆN

Hệ thống Secure Chat Web mã hóa đầu-cuối (End-to-End Encryption - E2EE) tương thích hoàn toàn với nền tảng Python legacy và cơ sở dữ liệu MySQL hiện hữu.

---

## 1. Kiến Trúc Kỹ Thuật

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + Web Crypto API + idb-keyval (IndexedDB).
- **Backend:** NestJS 11 + TypeORM + Socket.IO + Passport JWT.
- **Cơ sở dữ liệu:** MySQL 8.x / 9.x (`secure_chat`).
- **Giao thức mật mã:**
  - **Mã hóa tin nhắn:** AES-256-GCM với IV 16 bytes ngẫu nhiên và Authentication Tag 16 bytes (128 bits).
  - **Bọc khóa đối xứng (Key Wrapping):** RSA-OAEP 2048-bit với hàm băm SHA-256.
  - **Bảo vệ khóa riêng (Vault & Backup):** PBKDF2 (100,000 vòng, SHA-256, 16-byte Salt) kết hợp AES-256-GCM (IV 16 bytes, Tag 16 bytes).
  - **Khả năng tương thích:** Hỗ trợ chuẩn PKCS#8 và chuyển đổi ASN.1 DER từ định dạng PKCS#1 (Python legacy).

---

## 2. Hướng Dẫn Cấu Hình Môi Trường & Cơ Sở Dữ Liệu

### 2.1. Cấu hình Cơ sở dữ liệu MySQL
Hệ thống sử dụng cơ sở dữ liệu MySQL hiện hữu tên `secure_chat` (không cần chạy migration mới hay thay đổi cấu trúc bảng).
- Bảng `accounts`: Lưu thông tin định danh, hash mật khẩu và `public_key` (SPKI PEM).
- Bảng `chats`: Lưu danh sách các cuộc hội thoại 1-1 hoặc nhóm.
- Bảng `chat_members`: Quan hệ thành viên tham gia từng cuộc hội thoại.
- Bảng `messages`: Lưu `content` (Bản mã Base64), `iv` (Base64), `tag` (Base64), `aes_key_encrypted` (JSON Map các khóa AES đã bọc).
- Bảng `message_recipients`: Quản lý trạng thái đã đọc (`read_at`) của từng thành viên.

### 2.2. Biến môi trường Backend (`backend/.env`)
Tạo tệp `backend/.env` với nội dung mẫu:
```env
PORT=5000
SOCKET_PORT=5001

DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_mysql_password
DB_DATABASE=secure_chat

JWT_SECRET=jwt_secret_key_production_secure_token
JWT_EXPIRES_IN=1d

CORS_ORIGIN=*
```

### 2.3. Biến môi trường Frontend (`frontend/.env.local`)
Tạo tệp `frontend/.env.local` với nội dung:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5001
```

---

## 3. Cài Đặt & Vận Hành Ứng Dụng

### 3.1. Khởi động Backend (NestJS)
```bash
cd backend
npm install
npm run build
npm run start:prod
# Hoặc ở chế độ phát triển:
npm run start:dev
```
- REST API lắng nghe tại: `http://127.0.0.1:5000`
- Socket.IO Gateway lắng nghe tại: `ws://127.0.0.1:5001`

### 3.2. Khởi động Frontend (Next.js)
```bash
cd frontend
npm install
npm run build
npm run start
# Hoặc ở chế độ phát triển:
npm run dev
```
- Giao diện người dùng truy cập tại: `http://localhost:3000`

---

## 4. Hợp Đồng Giao Tiếp REST API & Socket.IO Thực Tế

### 4.1. REST API Endpoints
| Phương thức | Đường dẫn | Xác thực | Mô tả |
| :--- | :--- | :---: | :--- |
| `POST` | `/auth/register` | Không | Đăng ký tài khoản mới kèm Public Key RSA |
| `POST` | `/auth/login` | Không | Đăng nhập bằng username/password, nhận JWT |
| `GET` | `/users/me` | JWT Bearer | Lấy thông tin tài khoản đang đăng nhập |
| `GET` | `/users/:id` | JWT Bearer | Lấy profile và Public Key của người dùng |
| `GET` | `/chats` | JWT Bearer | Lấy danh sách cuộc trò chuyện và số tin chưa đọc |
| `POST` | `/chats` | JWT Bearer | Tạo cuộc trò chuyện 1-1 hoặc nhóm |
| `GET` | `/chats/:id` | JWT Bearer | Lấy chi tiết thông tin cuộc trò chuyện |
| `GET` | `/chats/:id/messages` | JWT Bearer | Tải danh sách tin nhắn lịch sử (bản mã) |
| `POST` | `/chats/:id/mark_read` | JWT Bearer | Đánh dấu các tin nhắn trong hội thoại là đã đọc |

### 4.2. Socket.IO Events
- **Cổng kết nối:** `ws://127.0.0.1:5001`
- **Handshake Auth:** `io(SOCKET_URL, { auth: { token: "<JWT_TOKEN>" }, transports: ['websocket'] })`
- **Client Emits:**
  - `join_chat`: `{ chat_id: number, user_id?: number }` — Yêu cầu gia nhập room cuộc trò chuyện.
  - `send_message`: `{ chat_id, sender_id, content, aes_key_encrypted, iv, tag }` — Gửi tin nhắn mã hóa.
- **Server Emits:**
  - `receive_message`: `{ id, chat_id, sender_id, content, aes_key_encrypted, iv, tag, timestamp }` — Phát tin nhắn mã hóa tới tất cả thành viên trong room.
  - `online_users`: `number[]` — Phát danh sách `user_id` đang trực tuyến.
  - `error`: `{ msg: string }` — Thông báo lỗi xác thực, phân quyền hoặc sai cú pháp payload.

---

## 5. Quy Trình Quản Lý Vòng Đời Khóa (Key Lifecycle)

1. **Đăng ký mới:**
   - Trình duyệt tự sinh cặp khóa RSA-2048 bằng `WebCryptoService.generateRsaKeyPair()`.
   - Gửi `public_key` (SPKI PEM) lên server cùng thông tin tài khoản.
   - Trình duyệt dùng mật khẩu đăng ký dẫn xuất khóa AES qua PBKDF2 để mã hóa Private Key (PKCS#8).
   - Lưu vault mã hóa `{ ciphertext, iv, tag, salt }` vào IndexedDB và tự động tải về file sao lưu `<username>_private.enc.json`.
2. **Đăng nhập & Mở khóa:**
   - Người dùng đăng nhập nhận JWT Token.
   - Nếu trong IndexedDB của trình duyệt đã có vault, người dùng nhập mật khẩu để giải mã Private Key vào bộ nhớ RAM của phiên làm việc.
3. **Nhập khóa sao lưu (Restore Backup):**
   - Người dùng tải lên file `<username>_private.enc.json`.
   - Hệ thống đối chiếu mật khẩu và giải mã thử.
   - Đối chiếu Public Key trích xuất từ Private Key với Public Key của tài khoản trên máy chủ để ngăn chặn việc nhập nhầm file khóa của người khác.
   - Chỉ khi hợp lệ 100%, khóa mới được ghi đè an toàn vào IndexedDB.
4. **Đăng xuất:**
   - Xóa token xác thực và xóa Private Key CryptoKey khỏi bộ nhớ RAM phiên làm việc.
   - Không xóa file vault mã hóa trong IndexedDB để người dùng có thể mở khóa lại ở lần đăng nhập sau.

---

## 6. Hướng Dẫn Chạy Kiểm Thử (Tests)

### 6.1. Kiểm thử Backend
```bash
cd backend
npm test
```
*Kết quả:* 4 Test Suites passed, 20 tests passed.

### 6.2. Kiểm thử Frontend (Unit & Integration)
```bash
cd frontend
npm test
```
*Kết quả:* 7 Test Suites passed, 74 tests passed (Bao gồm unit tests mật mã, IndexedDB vault, auth flow và live E2E).

### 6.3. Kiểm thử Typecheck & Production Build
```bash
cd frontend
npm run typecheck    # Kiểm tra tính toàn vẹn kiểu dữ liệu TypeScript (Exit code 0)
npm run build        # Biên dịch tĩnh production Next.js App Router (Exit code 0)
```

---

## 7. Các Lỗi Cấu Hình Thường Gặp & Cách Khắc Phục

1. **Lỗi `Access denied for user 'root'@'localhost'`:**
   - *Nguyên nhân:* Mật khẩu MySQL trong `backend/.env` không khớp với mật khẩu máy chủ cơ sở dữ liệu cục bộ.
   - *Khắc phục:* Kiểm tra và cập nhật đúng `DB_PASSWORD` trong `backend/.env`.
2. **Lỗi `Socket connect error / connection refused`:**
   - *Nguyên nhân:* Backend NestJS chưa khởi động hoặc port 5001 bị tường lửa chặn.
   - *Khắc phục:* Chạy `npm run start:prod` trong `backend/` và kiểm tra `netstat -ano | findstr :5001`.
3. **Lỗi `🔒 (Tin nhắn mã hóa E2EE - Vui lòng mở khóa Private Key để xem)`:**
   - *Nguyên nhân:* Phiên làm việc hiện tại chưa nạp hoặc chưa mở khóa Private Key.
   - *Khắc phục:* Nhấn vào nút "Mở khóa E2EE" trên thanh tiêu đề và nhập mật khẩu bảo vệ hoặc tải file backup lên.

---

## 8. Các Giới Hạn Bảo Mật & Lưu Ý Vận Hành

- **Giới hạn Zero-Knowledge:** Hệ thống áp dụng mô hình mã hóa đầu-cuối chuẩn cho nội dung tin nhắn và khóa đối xứng. Tuy nhiên, máy chủ vẫn quản lý các siêu dữ liệu (Metadata) như thời điểm gửi, người gửi, người nhận và kích thước bản mã.
- **Bảo vệ thiết bị đầu cuối:** Private Key chỉ an toàn khi máy tính người dùng không bị mã độc hoặc keylogger tấn công. Luôn sao lưu file `.json` ở vị trí an toàn.
