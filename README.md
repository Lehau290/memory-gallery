# MEMORY GALLERY – DIGITAL MEMORY DIARY (NODE.JS & EXPRESS)

> **Website Lưu Trữ & Quản Lý Kỷ Niệm Kỹ Thuật Số (Full-stack Node.js)**  
> Slogan: *"Your memories, forever in one place."*  
> Thiết kế theo phong cách Apple, Pinterest, Google Photos và Notion. Tối giản, hiện đại, sang trọng và đầy cảm xúc hoài niệm.

---

## 🌟 1. Giới thiệu dự án

**Memory Gallery** được xây dựng toàn diện trên nền tảng **Node.js** và **Express**, sử dụng JavaScript đồng bộ từ Frontend đến Backend. Dự án chuyên dùng để tải lên, lưu trữ, phân loại và sống lại những khoảnh khắc quý báu qua từng bức ảnh và thước phim kỷ niệm.

### ✨ Điểm nhấn thiết kế (UI/UX)
- **Phong cách**: Apple, Pinterest, Google Photos, Notion.
- **Tone màu**: Trắng kem (`#FAF8F5`), be ấm (`#F5F0EB`), đen than sang trọng (`#18181C`), điểm xuyết tím pastel (`#8B5CF6`, `#A78BFA`).
- **Masonry Grid**: Lưới ảnh so le tự nhiên, mượt mà chuẩn Pinterest.
- **Glassmorphism**: Hiệu ứng kính mờ có chiều sâu ánh sáng.
- **Dark Mode & Light Mode**: Chuyển đổi giao diện sáng/tối tức thì.
- **Responsive 100%**: Máy tính, máy tính bảng và điện thoại di động (có Mobile Drawer).

---

## 🚀 2. Các chức năng chính (Full Features)

1. **Đăng nhập & Đăng ký (JWT + BCRYPT)**:
   - Xác thực tài khoản với token JSON Web Token (JWT) an toàn.
   - Mỗi tài khoản có không gian lưu trữ riêng biệt, không xem chéo dữ liệu của nhau.
   - Nút bấm 1-click tự động điền tài khoản **Demo** và **Admin**.
2. **Dashboard (Trang chủ thông minh)**:
   - Lời chào theo buổi trong ngày (*Chào buổi sáng / chiều / tối*).
   - Thống kê thời gian thực: Tổng số ảnh, video, album, dung lượng đã dùng / Quota 20GB.
   - Kỷ niệm ngày này năm trước (On This Day) và album gần đây.
3. **Upload Center (Tải ảnh & video - Tính năng cốt lõi)**:
   - Kéo và thả file trực tiếp vào vùng Upload.
   - Hỗ trợ chọn nhiều ảnh và video cùng lúc (JPG, PNG, WEBP, GIF, MP4, MOV, WEBM).
   - **Lưu trữ file thật** trên ổ đĩa máy chủ (`uploads/photos/`, `uploads/videos/`, `uploads/avatars/`).
   - Xem trước thumbnail và tên file trước khi nhấn lưu.
   - Thanh tiến trình tải lên kèm phần trăm (0% - 100%) và trạng thái chi tiết.
   - Nhập metadata: Tên kỷ niệm, câu chuyện/mô tả, ngày kỷ niệm, địa điểm, thẻ tag, album đích, chế độ riêng tư.
4. **Thư viện tất cả kỷ niệm & Thư viện ảnh / video**:
   - Lưới ảnh Masonry Grid linh hoạt.
   - Phân biệt ảnh và video bằng biểu tượng play và badge thời lượng.
   - Chế độ thao tác hàng loạt (**Batch Mode**): Chọn nhiều mục để xóa hoặc nén tải về file Zip một lần.
   - Bộ lọc theo định dạng, theo album, theo yêu thích và sắp xếp theo ngày/tên.
5. **Trình xem toàn màn hình (Lightbox & Video Player)**:
   - Phóng to / thu nhỏ ảnh (Zoom In / Zoom Out).
   - Phím điều hướng Previous / Next (hỗ trợ phím mũi tên bàn phím và phím Esc).
   - Trình phát video chuẩn **HTTP 206 Partial Content (Byte Range)** tua video cực êm.
   - Ngăn bên hiển thị đầy đủ câu chuyện, ngày chụp, địa điểm, album, dung lượng và các thẻ tag.
   - Nút đánh dấu yêu thích, nút chỉnh sửa thông tin và tải file về máy.
6. **Quản lý Album (My Albums)**:
   - Tạo album mới với ảnh bìa, phân loại theo chủ đề: *Gia đình, Bạn bè, Du lịch, Sinh nhật, Thanh xuân, Những chuyến đi đáng nhớ*.
   - Trang chi tiết album với banner hero ảnh bìa và lưới kỷ niệm bên trong.
   - Xóa album không xóa mất file gốc trong thư viện.
7. **Dòng thời gian kỷ niệm (Timeline)**:
   - Phân chia các mốc thời gian theo **Năm ➔ Tháng ➔ Ngày**.
   - Thanh chọn nhanh các năm (2026, 2025, 2024, 2023...).
8. **Kỷ niệm hôm nay (On This Day / "Bạn còn nhớ ngày này không?")**:
   - Hệ thống tự động so sánh ngày và tháng của kỷ niệm với ngày hiện tại trong các năm trước.
   - Nhóm kỷ niệm theo: *1 năm trước, 2 năm trước, 3 năm trước...*
9. **Kỷ niệm yêu thích (Favorites)**:
   - Trang riêng tập hợp tất cả hình ảnh và video đã thả tim.
10. **Tìm kiếm nâng cao (Deep Search)**:
    - Tìm kiếm tức thì theo: Tên kỷ niệm, câu chuyện/mô tả, địa điểm (VD: *Đà Lạt*, *Đà Nẵng*, *Hà Nội*), tên album và thẻ tag.
11. **Hồ sơ cá nhân & Cài đặt (Profile & Settings)**:
    - Cập nhật ảnh đại diện (upload avatar thật), tên hiển thị, tiểu sử bio.
    - Đổi mật khẩu tài khoản.
    - Quản lý và theo dõi dung lượng lưu trữ đã dùng.
12. **Bảng điều khiển Quản trị viên (Admin Dashboard)**:
    - Dành riêng cho tài khoản có vai trò `admin`.
    - Thống kê tổng quan hệ thống: Tổng tài khoản, ảnh, video, tổng dung lượng.
    - Quản lý danh sách người dùng: Xem dung lượng từng user, chức năng **Khóa / Mở khóa tài khoản**.
    - Nhật ký hoạt động hệ thống (Activity Audit Logs).

---

## 💻 3. Công nghệ sử dụng (Tech Stack)

- **Backend**:
  - **Node.js** & **Express.js** (RESTful API Server).
  - **Multer**: Xử lý upload đa file ảnh/video an toàn vào thư mục máy chủ.
  - **Bcryptjs**: Mã hóa mật khẩu bảo mật cao.
  - **JSON Web Token (JWT)**: Quản lý phiên đăng nhập xác thực.
  - **Archiver**: Nén file Zip tải về hàng loạt.
  - **SQLite3**: Cơ sở dữ liệu nhúng sẵn có, tự động tạo bảng và nạp dữ liệu mẫu.
- **Frontend**:
  - HTML5 & CSS3 Glassmorphism.
  - Tailwind CSS (Utility classes).
  - Modern ES6 Modules & State Management.
  - Lucide Icons (Biểu tượng hiện đại, đồng bộ).
  - Google Fonts (`Plus Jakarta Sans` & `Playfair Display`).

---

## 🛠️ 4. Hướng dẫn cài đặt & Chạy trên Localhost

### Bước 1: Cài đặt Node.js (nếu máy bạn chưa có)
- Tải bản **Node.js LTS** từ trang chính thức: [https://nodejs.org/](https://nodejs.org/) hoặc mở PowerShell gõ:
  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```

### Bước 2: Cài đặt thư viện dự án
Mở terminal/PowerShell tại thư mục `d:\Web MEMORY GALLERY`:
```powershell
npm install
```

### Bước 3: Khởi động Server
```powershell
npm start
```
*(Hoặc dùng lệnh `node server.js`)*

### Bước 4: Mở trình duyệt web
Truy cập địa chỉ:
```
http://localhost:5000
```
Server Node.js sẽ tự động kết nối cơ sở dữ liệu SQLite (`database/memory_gallery.sqlite`), khởi tạo bảng và sẵn sàng toàn bộ dữ liệu mẫu!

---

## 🔑 5. Tài khoản đăng nhập sẵn có trong Database

| Vai trò | Họ và tên | Email / Tên đăng nhập | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- | :--- | :--- |
| **Người dùng (User)** | **Nguyễn Thị Bảo Ngọc** | `baongoc@memorygallery.com` (hoặc `baongoc`) | `123456` | Người dùng tiêu chuẩn (Có sẵn 10 kỷ niệm, 5 album) |
| **Quản trị viên (Admin)** | **Lê Trung Hậu** | `letrunghau@memorygallery.com` (hoặc `letrunghau`) | `123456` | Toàn quyền quản trị hệ thống (Có tab Bảng điều khiển Quản trị) |

*(Trên form đăng nhập của website đã tích hợp sẵn 2 nút chọn nhanh: **"👤 Nguyễn Thị Bảo Ngọc"** và **"🛡️ Lê Trung Hậu (Admin)"** giúp bạn đăng nhập chỉ với một click mà không cần gõ phím).*

---

## 📁 6. Cấu trúc thư mục dự án Node.js

```text
Web MEMORY GALLERY/
├── routes/                     # Các Router REST API của Express
│   ├── auth.js                 # API Đăng nhập, Đăng ký, Profile, Mật khẩu
│   ├── memories.js             # API Quản lý kỷ niệm, Upload đa file, Thả tim, Xóa, Batch
│   ├── albums.js               # API Quản lý Album (List, Create, Update, Delete)
│   ├── timeline.js             # API Dòng thời gian phân theo Năm / Tháng
│   ├── onThisDay.js            # API Kỷ niệm hôm nay (Các năm trước)
│   ├── stats.js                # API Thống kê Dashboard & Dung lượng
│   ├── download.js             # Bộ xử lý tải file & nén Zip hàng loạt
│   ├── stream.js               # Stream video HTTP 206 Range
│   └── admin.js                # API Quản trị hệ thống, khóa/mở khóa tài khoản
├── middleware/
│   └── auth.js                 # Middleware xác thực JWT & kiểm tra quyền Admin
├── config/
│   └── db.js                   # Kết nối SQLite với async/await & auto-seed
├── database/
│   ├── memory_gallery.sqlite   # File database SQLite
│   ├── seed.js                 # Script nạp dữ liệu mẫu Node.js
│   └── database.sql            # File SQL tạo bảng & dữ liệu cho MySQL (nếu cần)
├── uploads/                    # Nơi lưu trữ file thật trên máy chủ
│   ├── photos/                 # Ảnh kỷ niệm người dùng tải lên
│   ├── videos/                 # Video người dùng tải lên
│   └── avatars/                # Ảnh đại diện người dùng
├── assets/
│   ├── css/style.css           # CSS Masonry Grid & Glassmorphism
│   └── js/app.js               # Toàn bộ logic SPA, Routing, Lightbox, Upload
├── index.html                  # Giao diện chính của ứng dụng web
├── server.js                   # File máy chủ chính của Node.js Express
├── package.json                # Quản lý dependencies của dự án Node.js
└── README.md                   # Tài liệu hướng dẫn chi tiết
```

---

*Memory Gallery – "Your memories, forever in one place."*
