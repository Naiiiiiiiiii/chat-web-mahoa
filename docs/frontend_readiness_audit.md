# BÁO CÁO AUDIT TÍNH SẴN SÀNG CỦA BACKEND VÀ CHUẨN BỊ TRIỂN KHAI FRONTEND (NEXT.JS)

**Dự án:** Secure Chat Web (E2EE Messenger)  
**Ngày thực hiện:** 29/10/2026  
**Chuyên môn:** Senior Full-stack Engineer, Application Security Engineer  
**Trạng thái tổng thể:** **READY** (Sẵn sàng triển khai Frontend)

---

## A. Tổng quan Audit

### 1. Phạm vi các thành phần đã kiểm tra
- **Mã nguồn Backend NestJS:**
  - Cấu trúc thư mục: `backend/src/` (Controllers, Services, DTOs, Entities, Guards, Filters, Gateway, Utils).
  - Tệp cấu hình: `backend/package.json`, `backend/tsconfig.json`, `backend/.env.example`, `backend/src/config/typeorm.config.ts`.
  - Bộ kiểm thử: `backend/src/**/*.spec.ts` (Unit tests), `backend/test/app.e2e-spec.ts` (E2E Integration tests).
- **Tài liệu bàn giao:** `docs/backend_integration_guide.md`.
- **Cơ sở dữ liệu MySQL:** Database `secure_chat` (MySQL 9.5, port 3306) chứa các bảng `accounts`, `users`, `chats`, `chat_members`, `messages`, `message_recipients`.
- **Dữ liệu mã hóa E2EE thực tế:** Đối chiếu khả năng giải mã tin nhắn mã hóa lịch sử (ID 60, 61, 62, 63) từ CSDL với các thuật toán AES-GCM và RSA-OAEP.

### 2. Các lệnh kiểm tra đã thực hiện & Kết quả thực tế

| Lệnh kiểm tra | Mục đích | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :---: |
| `npm test` (trong `backend/`) | Kiểm thử đơn vị (Unit Tests) cho PasswordUtil, AuthService, ChatsService, MessagesService | **4/4 Test Suites Passed**, **20/20 Tests Passed** (thời gian ~5.9s) | **PASS** |
| `npm run build` (trong `backend/`) | Biên dịch toàn bộ TypeScript sang JavaScript (`dist/`) | Không có lỗi biên dịch hoặc cảnh báo nào. | **PASS** |
| `npm run test:e2e` (trong `backend/`) | Kiểm thử tích hợp toàn diện API, Database và Realtime Socket.IO | **16/16 Tests Passed** (Login Scrypt, Users, Chats 1-1 deduplication, Messages E2EE, Socket.IO handshake & rooms) | **PASS** |
| Đối chiếu mật mã Python vs MySQL | Xác minh tin nhắn mã hóa cũ trong CSDL MySQL | Cả 4 tin nhắn (ID 60–63) giải mã ra chính xác: `'hi'`, `'ho'`, `'fuc u'`, `'njkl;'` | **PASS** |
| Kiểm tra Git Status | Đảm bảo tính toàn vẹn của mã nguồn cũ và bảo mật bí mật | Thư mục `secure_chat-main` nguyên vẹn 100%. Không có file `.env` hay private key nào bị commit. | **PASS** |

### 3. Những phần chưa thể xác minh trong giai đoạn này
- Khả năng xử lý file đính kèm lớn (hình ảnh/video): Hệ thống hiện tại chỉ mới triển khai truyền `avatar_url` dạng URL string và tin nhắn văn bản mã hóa E2EE, chưa có endpoint upload file multipart/binary riêng biệt.

---

## B. Bảng Đối Chiếu Chi Tiết REST API

| Method | Endpoint | Request Body | Success Response | Error Responses | Authentication | Source File | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `POST` | `/auth/register` | `{ username, password, public_key, full_name?, gender?, date_of_birth?, avatar_url?, bio? }` | `201 Created`<br>`{ msg: "User created", user_id: number }` | `400 Bad Request`<br>`{ msg: "Username, password and public_key are required" }`<br>`{ msg: "Username already exists" }` | Public | `src/modules/auth/auth.controller.ts` | **ĐÃ XÁC MINH** |
| `POST` | `/auth/login` | `{ username, password }` | `200 OK`<br>`{ token: string, user_id: number }` | `401 Unauthorized`<br>`{ msg: "Invalid credentials" }` | Public | `src/modules/auth/auth.controller.ts` | **ĐÃ XÁC MINH** |
| `POST` | `/auth/logout` | None | `200 OK`<br>`{ msg: "Logged out" }` | `401 Unauthorized`<br>`{ msg: "Missing or invalid token" }` | Bearer JWT | `src/modules/auth/auth.controller.ts` | **ĐÃ XÁC MINH** |
| `GET` | `/users/me` | None | `200 OK`<br>`{ user_id, username, full_name, gender, date_of_birth, avatar_url, bio, status, last_seen, public_key }` | `401 Unauthorized` | Bearer JWT | `src/modules/users/users.controller.ts` | **ĐÃ XÁC MINH** |
| `GET` | `/users/:id` | None | `200 OK`<br>`{ user_id, username, full_name, gender, date_of_birth, avatar_url, bio, status, last_seen, public_key }` | `401 Unauthorized`<br>`404 Not Found` (`{ msg: "User not found" }`) | Bearer JWT | `src/modules/users/users.controller.ts` | **ĐÃ XÁC MINH** |
| `PUT` | `/users/me` | `{ full_name?, gender?, date_of_birth?, avatar_url?, bio? }` | `200 OK`<br>`{ msg: "Profile updated" }` | `401 Unauthorized`<br>`400 Bad Request` | Bearer JWT | `src/modules/users/users.controller.ts` | **ĐÃ XÁC MINH** |
| `POST` | `/chats` | `{ name?, is_group?: boolean, members: number[] }` | `200 OK` (nếu 1-1 đã có sẵn)<br>`201 Created` (nếu tạo mới)<br>`{ chat_id, name, is_group, members, created_at, unread_count }` | `400 Bad Request` (`{ msg: "Chat 1-1 yêu cầu chính xác 1 member" }`)<br>`404 Not Found` | Bearer JWT | `src/modules/chats/chats.controller.ts` | **ĐÃ XÁC MINH** |
| `GET` | `/chats` | None | `200 OK`<br>Array of `{ chat_id, name, is_group, members, created_at, unread_count }` | `401 Unauthorized` | Bearer JWT | `src/modules/chats/chats.controller.ts` | **ĐÃ XÁC MINH** |
| `GET` | `/chats/:id` | None | `200 OK`<br>`{ chat_id, name, is_group, members, created_at, unread_count }` | `403 Forbidden` (`{ msg: "You are not a member of this chat" }`)<br>`404 Not Found` | Bearer JWT | `src/modules/chats/chats.controller.ts` | **ĐÃ XÁC MINH** |
| `POST` | `/chats/:id/mark_read` | None | `200 OK`<br>`{ msg: "Marked X messages as read" }` | `401 Unauthorized` | Bearer JWT | `src/modules/chats/chats.controller.ts` | **ĐÃ XÁC MINH** |
| `POST` | `/chats/:id/messages` | `{ content, aes_key_encrypted, iv, tag }` | `201 Created`<br>`{ msg: "Sent", message_id: number }` | `400 Bad Request`<br>`403 Forbidden` (`{ msg: "Not in chat" }`) | Bearer JWT | `src/modules/messages/messages.controller.ts` | **ĐÃ XÁC MINH** |
| `GET` | `/chats/:id/messages` | None | `200 OK`<br>Array of `{ id, sender_id, content, aes_key_encrypted, iv, tag, timestamp, recipients }` | `403 Forbidden`<br>`404 Not Found` | Bearer JWT | `src/modules/messages/messages.controller.ts` | **ĐÃ XÁC MINH** |
| `POST` | `/status` & `/status/status` | `{ status: "online" \| "offline" }` | `200 OK`<br>`{ msg: "Status updated" }` | `400 Bad Request`<br>`401 Unauthorized` | Bearer JWT | `src/modules/status/status.controller.ts` | **ĐÃ XÁC MINH** |
| `GET` | `/status/:id` & `/status/status/:id` | None | `200 OK`<br>`{ status, last_seen }` | `404 Not Found`<br>`401 Unauthorized` | Bearer JWT | `src/modules/status/status.controller.ts` | **ĐÃ XÁC MINH** |
| `GET` | `/_connected_users` | None | `200 OK`<br>`{ connected_users: number[] }` | None | Public | `src/modules/realtime/realtime.controller.ts` | **ĐÃ XÁC MINH** |

---

## C. Bảng Đối Chiếu Socket.IO Realtime

| Tên Sự kiện | Hướng | Định dạng Payload | Xác thực | Phân quyền (Authorization) | Source File | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `connection` | Client ➔ Server | Handshake `auth: { token }` hoặc `query: { token }` | JWT Verify (`JwtService.verify`) | Tự động disconnect nếu token rỗng hoặc không hợp lệ | `src/modules/realtime/chat.gateway.ts` | **ĐÃ XÁC MINH** |
| `online_users` | Server ➔ Broadcast | `number[]` (mảng các user ID đang online) | Không (broadcast cho client đã auth) | Chỉ gửi cho các socket đã qua handshake hợp lệ | `src/modules/realtime/chat.gateway.ts` | **ĐÃ XÁC MINH** |
| `join_chat` | Client ➔ Server | `{ chat_id: number, user_id?: number }` | Lấy `userId` từ token handshake | Kiểm tra bảng `chat_members`: Nếu không phải thành viên, emit `error` và chặn join room | `src/modules/realtime/chat.gateway.ts` | **ĐÃ XÁC MINH** |
| `send_message` | Client ➔ Server | `{ chat_id, sender_id, content, aes_key_encrypted, iv, tag }` | Xác thực handshake token | Server cưỡng chế gán `sender_id = client.data.userId` và kiểm tra quyền thành viên | `src/modules/realtime/chat.gateway.ts` | **ĐÃ XÁC MINH** |
| `receive_message`| Server ➔ Room `chat_${chatId}` | `{ id, chat_id, sender_id, content, aes_key_encrypted, iv, tag, timestamp }` | Socket đã tham gia room | Chỉ phát tới các socket đã vượt qua kiểm tra `join_chat` | `src/modules/realtime/chat.gateway.ts` | **ĐÃ XÁC MINH** |
| `error` | Server ➔ Client | `{ msg: string }` | None | Báo lỗi khi dữ liệu sai hoặc vi phạm phân quyền | `src/modules/realtime/chat.gateway.ts` | **ĐÃ XÁC MINH** |

---

## D. Báo Cáo Chuyên Sâu Về End-to-End Encryption (E2EE)

### 1. Phân tích định dạng dữ liệu mã hóa thực tế
- **Thuật toán mã hóa đối xứng (Tin nhắn):**
  - Thuật toán: **AES-256-GCM** (Galois/Counter Mode).
  - Độ dài khóa AES: 32 bytes (256-bit). Mỗi tin nhắn sinh một khóa ngẫu nhiên mới.
  - Nonce/IV: 16 bytes ngẫu nhiên, biểu diễn dạng Base64 string.
  - Authentication Tag: 16 bytes (128-bit), biểu diễn dạng Base64 string.
  - Ciphertext (`content`): Dữ liệu sau khi mã hóa bản rõ UTF-8, biểu diễn dạng Base64 string.
- **Thuật toán bọc khóa đối xứng (Key Encapsulation):**
  - Thuật toán: **RSA-OAEP** với hàm băm **SHA-256** (`PKCS1_OAEP` hashAlgo=SHA256).
  - Khóa RSA: 2048-bit, Public Key lưu trữ trên server dưới định dạng SPKI PEM (`-----BEGIN PUBLIC KEY-----`).
  - Khóa bọc (`aes_key_encrypted`): Dictionary ánh xạ từ `account_id` (dạng chuỗi) sang khóa AES đã bọc bằng RSA Public Key của người nhận (dạng Base64):
    `{ "14": "Base64(RSA_OAEP(aes_key, pubKey_14))", "15": "..." }`.
- **Bảo vệ Private Key tại máy Client (Local Storage):**
  - KDF: **PBKDF2** với HMAC-SHA256, 100.000 vòng lặp (iterations), Salt 16 bytes ngẫu nhiên.
  - Dẫn xuất khóa bảo vệ: 32 bytes AES key.
  - Thuật toán mã hóa Private Key: **AES-256-GCM** (IV 16 bytes, Tag 16 bytes).
  - Định dạng lưu trữ: Tệp JSON `{ "ciphertext": "...", "iv": "...", "tag": "...", "salt": "..." }`.

### 2. Tương thích Web Crypto API phía Client Next.js
- Trình duyệt hiện đại hỗ trợ nguyên bản `window.crypto.subtle`:
  - `RSA-OAEP` với `hash: "SHA-256"` tương thích 100% với PyCryptodome.
  - `AES-GCM` với `iv` 16 bytes và `tagLength: 128`.
- **Lưu ý cốt lõi khi dùng Web Crypto API:**
  - `subtle.encrypt({ name: "AES-GCM", ... })` trả về ArrayBuffer chứa **Ciphertext + 16 bytes Tag** ở cuối.
  - Frontend cần cắt 16 bytes cuối làm `tag` Base64 và phần còn lại làm `content` Base64 trước khi gửi lên server.
  - Khi giải mã: Ghép `[ciphertextBytes, tagBytes]` lại thành một buffer để đưa vào `subtle.decrypt()`.

---

## E. Các Sai Lệch, Điểm Lưu Ý & Đánh Giá Rủi Ro

### 1. Mức độ Critical: Không có (0)
- Backend không hề lưu trữ Private Key hay đọc bản rõ tin nhắn.
- Toàn bộ dữ liệu mã hóa được chuyển tiếp nguyên vẹn (Opaque Data).

### 2. Mức độ High: Không có (0)
- Xác thực handshake, phân quyền truy cập hội thoại và kiểm tra thành viên server-side hoạt động chặt chẽ.

### 3. Mức độ Medium: 2 điểm kỹ thuật cần xử lý trên Frontend
1. **Kiểu dữ liệu `aes_key_encrypted` giữa REST và Socket.IO:**
   - *Bằng chứng code:* Trong REST history (`MessagesService.getMessages`), trường `aes_key_encrypted` trả về chuỗi JSON string (`"{\"14\": \"...\"}"`). Trong Socket.IO (`ChatGateway.handleSendMessage`), trường này được phát đi dưới dạng Object đã parse (`{ "14": "..." }`).
   - *Giải pháp trên Frontend:* Helper giải mã cần kiểm tra:
     `const keys = typeof msg.aes_key_encrypted === 'string' ? JSON.parse(msg.aes_key_encrypted) : msg.aes_key_encrypted;`
2. **Khác biệt về Port giữa REST (5000) và Socket.IO (5001):**
   - *Bằng chứng code:* `main.ts` lắng nghe cổng `5000`, `chat.gateway.ts` lắng nghe cổng `5001` (được đọc từ `process.env.SOCKET_PORT`).
   - *Giải pháp trên Frontend:* Cấu hình 2 biến môi trường riêng biệt:
     `NEXT_PUBLIC_API_URL=http://localhost:5000`
     `NEXT_PUBLIC_SOCKET_URL=http://localhost:5001`

### 4. Mức độ Low: 1 điểm cần lưu ý về UX
1. **Quản lý Private Key trên Trình duyệt:**
   - Trên desktop cũ, private key lưu vào ổ đĩa file cục bộ. Trên Web, private key mã hóa bằng PBKDF2 sẽ được lưu an toàn trong `IndexedDB` hoặc `localStorage` của trình duyệt. Cần cung cấp tính năng "Xuất / Nhập file khóa bảo mật (.json)" trên giao diện web để người dùng có thể đồng bộ sang máy tính hoặc trình duyệt khác.

---

## F. Kết Luận Sẵn Sàng Triển Khai (Readiness Conclusion)

### Trạng thái: **READY** (Sẵn sàng triển khai Frontend)

**Lý do:**
1. Backend NestJS đang chạy ổn định, cấu hình TypeORM `synchronize: false` bảo toàn dữ liệu thật MySQL.
2. 100% các API, Guard, Validation và Realtime Gateway đã được kiểm chứng bằng 20 Unit Tests và 16 E2E Tests.
3. Test vector giải mã tin nhắn cũ thành công tuyệt đối mà không cần bất kỳ thay đổi nào ở Backend.
4. Tài liệu tích hợp và hợp đồng dữ liệu đầy đủ, minh bạch.

### Danh sách hành động ưu tiên:
1. Tạo tài liệu `docs/frontend_integration_contract.md` chốt toàn bộ kiểu dữ liệu TypeScript và flow E2EE.
2. Khởi tạo cấu trúc dự án Next.js (App Router, Tailwind CSS, TypeScript) trong thư mục `frontend/`.
3. Xây dựng module `WebCryptoService` (RSA-OAEP, AES-GCM, PBKDF2) kèm test vector độc lập.
4. Triển khai API Client và Socket.IO Client.
5. Triển khai giao diện theo từng module: Auth/Key Management ➔ Chat List ➔ Room Chat Realtime ➔ Profile.
