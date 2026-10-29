# TÀI LIỆU TÍCH HỢP BACKEND NESTJS VÀ BÀN GIAO CHO NEXT.JS FRONTEND

## 1. Giới thiệu tổng quan
Backend của hệ thống Secure Chat đã được chuyển đổi hoàn chỉnh từ Python/Flask sang **NestJS + TypeScript** với kiến trúc phân lớp chuẩn mực, sử dụng **TypeORM** kết nối trực tiếp cơ sở dữ liệu MySQL hiện hữu với tùy chọn `synchronize: false`.

Hệ thống bảo toàn 100% cơ chế mã hóa đầu-cuối (E2EE), dữ liệu tin nhắn cũ và khả năng đăng nhập của các tài khoản đã tạo trước đó bằng thuật toán băm mật khẩu Scrypt tương thích với Werkzeug.

---

## 2. Hướng dẫn chạy Backend

### 2.1. Cấu hình môi trường (`.env`)
Sao chép `.env.example` thành `.env` trong thư mục `backend/`:
```env
PORT=5000
SOCKET_PORT=5001

DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=123456
DB_DATABASE=secure_chat

JWT_SECRET=jwt_secret_key
JWT_EXPIRES_IN=1d

CORS_ORIGIN=*
```

### 2.2. Lệnh khởi chạy
```bash
cd backend
npm install
npm run build
npm run start        # Chạy production
npm run start:dev    # Chạy development (auto reload)
```

### 2.3. Lệnh chạy kiểm thử
```bash
npm test             # Chạy toàn bộ Unit Tests (20 tests passed)
npm run test:e2e     # Chạy toàn bộ Integration/E2E Tests (16 tests passed)
```

---

## 3. Đặc tả Hợp đồng REST API (API Contracts)

Mọi request yêu cầu xác thực cần kèm header:
`Authorization: Bearer <jwt_token>`

### 3.1. Authentication
* **Đăng ký tài khoản mới kèm Public Key:**
  - `POST /auth/register` (HTTP 201)
  - Request:
    ```json
    {
      "username": "alice",
      "password": "Password123",
      "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
      "full_name": "Alice Wonderland",
      "gender": "female",
      "date_of_birth": "2000-01-01",
      "avatar_url": null,
      "bio": "Hello there"
    }
    ```
  - Response: `{ "msg": "User created", "user_id": 17 }`
* **Đăng nhập:**
  - `POST /auth/login` (HTTP 200)
  - Request: `{ "username": "admin", "password": "123456" }`
  - Response: `{ "token": "<JWT_STRING>", "user_id": 14 }`
* **Đăng xuất:**
  - `POST /auth/logout` (HTTP 200)
  - Response: `{ "msg": "Logged out" }`

### 3.2. Users
* **Lấy thông tin và Public Key:**
  - `GET /users/:id` (HTTP 200)
  - Response:
    ```json
    {
      "user_id": 14,
      "username": "admin",
      "full_name": "Nguyen Quang Thinh",
      "gender": "other",
      "date_of_birth": "2008-01-17",
      "avatar_url": null,
      "bio": "Senior Security Engineer",
      "status": "online",
      "last_seen": "2026-10-29T14:00:00.000Z",
      "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
    }
    ```
* **Cập nhật hồ sơ bản thân:**
  - `PUT /users/me` (HTTP 200)
  - Request: `{ "full_name": "...", "bio": "...", "avatar_url": "..." }`
  - Response: `{ "msg": "Profile updated" }`

### 3.3. Chats
* **Tạo hoặc lấy hội thoại 1-1 / nhóm:**
  - `POST /chats` (HTTP 200 nếu 1-1 đã tồn tại, HTTP 201 nếu tạo mới)
  - Request: `{ "is_group": false, "members": [15] }`
  - Response:
    ```json
    {
      "chat_id": 9,
      "name": "Nguyen Viet Hoang",
      "is_group": false,
      "members": [15, 14],
      "created_at": "2026-01-17T16:10:54.000Z",
      "unread_count": 0
    }
    ```
* **Danh sách hội thoại của tôi:**
  - `GET /chats` (HTTP 200)
  - Response: Mảng các đối tượng hội thoại như trên, kèm `unread_count`.
* **Chi tiết hội thoại:**
  - `GET /chats/:id` (HTTP 200) - Kiểm tra thành viên server-side (403 nếu không thuộc nhóm).
* **Đánh dấu đã đọc:**
  - `POST /chats/:id/mark_read` (HTTP 200)
  - Response: `{ "msg": "Marked X messages as read" }`

### 3.4. Messages (E2EE REST Fallback)
* **Gửi tin nhắn mã hóa:**
  - `POST /chats/:id/messages` (HTTP 201)
  - Request:
    ```json
    {
      "content": "Base64(AES_GCM_Ciphertext)",
      "aes_key_encrypted": {
        "14": "Base64(RSA_OAEP_Wrapped_AES_Key_For_14)",
        "15": "Base64(RSA_OAEP_Wrapped_AES_Key_For_15)"
      },
      "iv": "Base64(16_bytes_IV)",
      "tag": "Base64(16_bytes_Auth_Tag)"
    }
    ```
  - Response: `{ "msg": "Sent", "message_id": 65 }`
* **Lấy lịch sử tin nhắn:**
  - `GET /chats/:id/messages` (HTTP 200)
  - Response: Mảng các tin nhắn theo thứ tự thời gian tăng dần (`timestamp ASC`).

### 3.5. Status
* `POST /status` & `POST /status/status`: `{ "status": "online" | "offline" }`
* `GET /status/:id` & `GET /status/status/:id`: `{ "status": "online", "last_seen": "..." }`

---

## 4. Đặc tả Realtime Socket.IO

* **Địa chỉ kết nối:** `ws://127.0.0.1:5001` (hoặc cấu hình qua `SOCKET_PORT`).
* **Handshake Authentication:**
  ```javascript
  const socket = io("http://127.0.0.1:5001", {
    auth: { token: "<JWT_TOKEN>" },
    transports: ["websocket"]
  });
  ```
* **Event nhận: `online_users`**
  - Payload: Danh sách các ID người dùng đang online, ví dụ: `[14, 15]`.
* **Event gửi: `join_chat`**
  - Payload: `{ "chat_id": 9 }`.
  - Server xác thực quyền thành viên trước khi đưa socket vào room `chat_9`.
* **Event gửi: `send_message`**
  - Payload:
    ```json
    {
      "chat_id": 9,
      "sender_id": 14,
      "content": "MvU=",
      "aes_key_encrypted": {
        "14": "No4JZOdy...",
        "15": "aKCnhVAH..."
      },
      "iv": "U7sPwduAf5nNWIq8EIVP2w==",
      "tag": "g8207BYufIz+yLEAXR4y2A=="
    }
    ```
* **Event nhận: `receive_message`**
  - Được broadcast tới toàn bộ thành viên trong phòng `chat_9` (bao gồm cả người gửi):
    ```json
    {
      "id": 65,
      "chat_id": 9,
      "sender_id": 14,
      "content": "MvU=",
      "aes_key_encrypted": { "14": "...", "15": "..." },
      "iv": "...",
      "tag": "...",
      "timestamp": "2026-10-29T14:00:00.000Z"
    }
    ```

---

## 5. Chuẩn Mật Mã E2EE cho Frontend Next.js

1. **Sinh cặp khóa RSA:**
   - Thuật toán: RSA-OAEP, 2048-bit, băm SHA-256.
   - Public Key xuất sang định dạng SPKI PEM gửi lên server khi đăng ký.
   - Private Key được mã hóa bằng PBKDF2 (SHA-256, 100.000 iterations) + AES-256-GCM với passphrase của người dùng và lưu trữ an toàn ở client (ví dụ Web IndexedDB).
2. **Gửi tin nhắn:**
   - Sinh khóa đối xứng AES 256-bit ngẫu nhiên (`crypto.getRandomValues(new Uint8Array(32))`).
   - Mã hóa tin nhắn dạng rõ bằng AES-GCM (IV 16 bytes) -> sinh `ciphertext`, `iv`, `tag`.
   - Lấy Public Key của từng thành viên trong hội thoại qua `GET /users/:id`.
   - Dùng RSA-OAEP (SHA-256) mã hóa khóa AES cho từng thành viên -> tạo từ điển `aes_key_encrypted`.
   - Gửi payload tới Socket.IO qua sự kiện `send_message`.
3. **Giải mã tin nhắn:**
   - Tìm khóa bọc của mình trong `aes_key_encrypted[myUserId]`.
   - Giải mã bằng Private Key (RSA-OAEP SHA-256) -> thu được khóa AES gốc.
   - Giải mã `content` bằng AES-GCM với `iv` và `tag` -> thu được tin nhắn plaintext ban đầu.
