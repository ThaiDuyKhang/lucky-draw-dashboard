# 🎡 Lucky Draw Dashboard – Vòng quay may mắn

Ứng dụng web **vòng quay may mắn** dùng để bốc thăm trúng thưởng trong sự kiện (year-end party, hội nghị khách hàng, livestream…). Gồm 2 trang:

| Trang | File | Dùng để |
|---|---|---|
| **Vòng quay** | `html/index.html` | Chiếu lên màn hình lớn, bấm nút để quay và công bố người trúng |
| **Dashboard** | `html/dashboard.html` | Thêm / import / xoá người tham dự, xem và quản lý danh sách trúng thưởng, đồng bộ lên Google Sheets |

Ứng dụng là **web tĩnh thuần HTML/CSS/JS** (jQuery + Bootstrap 5 + GSAP + Lottie), không cần database, không cần build. Mọi thư viện đã nằm sẵn trong `html/libs/` nên **chạy được cả khi không có Internet** (trừ tính năng đồng bộ Google Sheets).

---

## Mục lục

1. [Tính năng](#1-tính-năng)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [Chạy thử trên máy (local)](#3-chạy-thử-trên-máy-local)
4. [Triển khai lên server](#4-triển-khai-lên-server)
5. [Hướng dẫn sử dụng](#5-hướng-dẫn-sử-dụng)
6. [Import danh sách từ file CSV / Excel](#6-import-danh-sách-từ-file-csv--excel)
7. [Đồng bộ Google Sheets (tuỳ chọn)](#7-đồng-bộ-google-sheets-tuỳ-chọn)
8. [Tuỳ biến giao diện & thông số](#8-tuỳ-biến-giao-diện--thông-số)
9. [Dữ liệu được lưu ở đâu?](#9-dữ-liệu-được-lưu-ở-đâu)
10. [Checklist trước ngày sự kiện](#10-checklist-trước-ngày-sự-kiện)
11. [Xử lý sự cố thường gặp](#11-xử-lý-sự-cố-thường-gặp)

---

## 1. Tính năng

**Vòng quay (`index.html`)**
- Vòng quay vẽ bằng SVG, tự chia ô theo số người tham dự (1 người cũng quay được).
- Thứ tự các ô được **xáo trộn ngẫu nhiên** mỗi lần tải trang / sau mỗi lượt.
- Người trúng được chọn ngẫu nhiên với **xác suất bằng nhau** cho mọi người (dùng `crypto.getRandomValues` của trình duyệt).
- Hiệu ứng: âm thanh quay (tự giảm dần âm lượng), sao lấp lánh, pháo giấy (Lottie), chữ “Chúc mừng” động (GSAP SplitText), âm thanh chiến thắng.
- Người đã trúng **tự động bị loại** khỏi vòng quay ở các lượt sau.

**Dashboard (`dashboard.html`)**
- Thêm người tham dự thủ công (chống trùng tên, không phân biệt hoa/thường).
- Import hàng loạt từ file `.csv`.
- Xoá từng người / xoá tất cả (có hộp thoại xác nhận).
- Danh sách trúng thưởng theo thứ tự lượt quay. Với mỗi người trúng có thể:
  - **Chuyển về danh sách tham dự** (cho quay lại – ví dụ người trúng vắng mặt), hoặc
  - **Xoá hẳn**.
- Đồng bộ danh sách lên Google Sheets (tuỳ chọn).

**Hai trang tự cập nhật cho nhau**: mở Vòng quay ở một tab và Dashboard ở tab khác (cùng trình duyệt) — khi quay xong, Dashboard tự hiện người trúng; khi sửa danh sách ở Dashboard, vòng quay tự vẽ lại.

---

## 2. Cấu trúc thư mục

```
lucky-draw-dashboard/
├── html/                      # Toàn bộ website (đây là thư mục public)
│   ├── index.html             # Trang vòng quay
│   ├── script.js              # Logic vòng quay (CONFIG ở đầu file)
│   ├── style.css              # Giao diện vòng quay
│   ├── dashboard.html         # Trang quản lý
│   ├── dashboard.js           # Logic quản lý (SCRIPT_URL ở đầu file)
│   ├── dashboard.css          # Giao diện quản lý
│   ├── images/                # Ảnh nền, vòng quay, nút, con trỏ, file Lottie (.json)
│   ├── sound/                 # Âm thanh quay & chiến thắng
│   └── libs/                  # jQuery, Bootstrap, Bootstrap Icons, GSAP, SplitText, Lottie, font
├── apps-script/
│   └── Code.gs                # Code Google Apps Script cho tính năng đồng bộ Google Sheets
├── sample_participants.csv    # File mẫu 70 người để thử import
├── docker-compose.yml         # Chạy bằng Docker (nginx:alpine)
├── nginx.conf                 # Cấu hình nginx cho Docker
└── README.md
```

---

## 3. Chạy thử trên máy (local)

> ⚠️ **Không nên mở file `index.html` bằng cách nhấp đúp** (đường dẫn `file:///...`). Trình duyệt sẽ chặn việc tải các file hiệu ứng `.json`, nên pháo giấy/sao sẽ không chạy đúng. Hãy chạy qua một web server nhỏ như các cách dưới đây.

### Cách 1 – Python (có sẵn trên macOS/Linux, Windows cài thêm Python)

```bash
cd lucky-draw-dashboard/html
python -m http.server 8080
```

### Cách 2 – Node.js

```bash
npx serve lucky-draw-dashboard/html -l 8080
```

### Cách 3 – Docker

```bash
cd lucky-draw-dashboard
docker compose up -d
```

### Cách 4 – VS Code

Cài extension **Live Server**, mở thư mục `html`, chuột phải `index.html` → **Open with Live Server**.

Sau đó mở trình duyệt:
- Vòng quay: <http://localhost:8080/index.html>
- Dashboard: <http://localhost:8080/dashboard.html>

---

## 4. Triển khai lên server

Chỉ cần đưa **nội dung thư mục `html/`** lên bất kỳ hosting tĩnh nào.

### 4.1. VPS có Docker

```bash
git clone https://github.com/ThaiDuyKhang/lucky-draw-dashboard.git
cd lucky-draw-dashboard
docker compose up -d          # web chạy ở cổng 8080
```

Cập nhật phiên bản mới:

```bash
git pull
docker compose restart
```

Muốn đổi cổng: sửa dòng `"8080:80"` trong `docker-compose.yml` (ví dụ `"80:80"`).

### 4.2. aaPanel / nginx có sẵn

1. **Website → Add site**, nhập tên miền, chọn PHP = *Static*.
2. Clone repo vào máy chủ, rồi trỏ **Site directory (root)** của website tới thư mục `.../lucky-draw-dashboard/html`.
   (Hoặc upload nội dung thư mục `html/` vào thư mục gốc của website.)
3. Bật **SSL** (Let's Encrypt) cho tên miền.
4. Truy cập `https://ten-mien-cua-ban/` (vòng quay) và `https://ten-mien-cua-ban/dashboard.html`.

### 4.3. Hosting tĩnh miễn phí (GitHub Pages, Netlify, Vercel, Cloudflare Pages)

Chọn thư mục publish là `html`. Không cần lệnh build.

> 💡 Với GitHub Pages: vào **Settings → Pages**, chọn nhánh `main`. Vì website nằm trong thư mục con `html/`, cách đơn giản nhất là dùng Netlify/Cloudflare Pages và đặt *publish directory* = `html`.

---

## 5. Hướng dẫn sử dụng

### Bước 1 – Chuẩn bị danh sách

1. Mở **Dashboard** (`/dashboard.html`).
2. Thêm người tham dự:
   - Gõ tên vào ô **“Nhập tên người tham dự…”** → bấm **Thêm** (hoặc Enter), hoặc
   - Bấm nút biểu tượng file bên cạnh → chọn file `.csv` (xem [mục 6](#6-import-danh-sách-từ-file-csv--excel)).
3. Kiểm tra số lượng ở dòng **“Danh sách tham dự (N)”**.

### Bước 2 – Quay thưởng

1. Bấm **Đến vòng quay** (hoặc mở `/index.html`) — nên bật chế độ toàn màn hình bằng phím **F11**.
2. Bấm nút ở giữa vòng quay. Vòng quay chạy khoảng **20 giây**, sau đó hiện màn hình chúc mừng với tên người trúng.
3. Bấm:
   - **Quay tiếp** để quay lượt sau (người vừa trúng đã bị loại khỏi vòng quay), hoặc
   - **Xem danh sách trúng thưởng** để mở Dashboard.

> 🔊 Trình duyệt chỉ cho phát âm thanh sau khi người dùng đã tương tác với trang. Hãy bấm vào trang một lần trước khi bắt đầu (lần bấm nút quay đầu tiên cũng tính).

### Bước 3 – Quản lý kết quả

Trong khung **Danh sách trúng thưởng** của Dashboard:

| Thao tác | Kết quả |
|---|---|
| Biểu tượng thùng rác cạnh 1 người → **Chuyển về danh sách tham dự** | Huỷ kết quả của người đó, họ được quay lại ở lượt sau (dùng khi người trúng vắng mặt) |
| Biểu tượng thùng rác cạnh 1 người → **Xóa** | Xoá hẳn người đó khỏi cả danh sách trúng và danh sách tham dự |
| **Xóa tất cả** → **Chuyển tất cả về danh sách tham dự** | Reset toàn bộ kết quả, mọi người được quay lại từ đầu |
| **Xóa tất cả** → **Xóa tất cả** | Xoá hẳn tất cả người đã trúng |

Nút **Xóa tất cả** ở khung *Danh sách tham dự* chỉ xoá **những người chưa trúng** (đúng những người đang hiển thị); danh sách trúng thưởng giữ nguyên.

### Bước 4 – Lưu kết quả

- Bấm **Đồng bộ Google Sheet** (nếu đã cấu hình — xem [mục 7](#7-đồng-bộ-google-sheets-tuỳ-chọn)), hoặc
- Chụp màn hình danh sách trúng thưởng.

---

## 6. Import danh sách từ file CSV / Excel

### Định dạng file

- Mỗi dòng **một người**, lấy **cột đầu tiên** làm tên. Các cột sau (email, số điện thoại…) được bỏ qua.
- Chấp nhận phân cách bằng dấu phẩy `,`, chấm phẩy `;` hoặc tab.
- Tên có dấu phẩy thì đặt trong ngoặc kép: `"Nguyễn Văn A, Phòng Kế toán"`.
- Dòng tiêu đề đầu tiên (`Tên`, `Họ tên`, `Họ và tên`, `Name`, `Full name`) sẽ tự động được bỏ qua.
- Dòng trống và tên trùng (không phân biệt hoa/thường) được bỏ qua; số lượng được báo lại sau khi import.

Ví dụ hợp lệ:

```csv
Họ và tên,Phòng ban
Dương Thanh Bình,Kinh doanh
"Nguyễn Thành Thảo",Kỹ thuật
Hoàng Long,Kế toán
```

Xem thêm file mẫu `sample_participants.csv`.

### Xuất từ Excel / Google Sheets

- **Excel**: *File → Save As* → chọn **CSV UTF-8 (Comma delimited) (\*.csv)**.
  ⚠️ Đừng chọn loại “CSV (Comma delimited)” thường — tiếng Việt có dấu sẽ bị lỗi font.
- **Google Sheets**: *Tệp → Tải xuống → Giá trị được phân tách bằng dấu phẩy (.csv)*.

---

## 7. Đồng bộ Google Sheets (tuỳ chọn)

Tính năng này ghi danh sách hiện tại lên Google Sheets để lưu trữ/chia sẻ. Mỗi lần bấm **Đồng bộ Google Sheet**, dữ liệu trên Sheet được **ghi đè** bằng dữ liệu mới nhất trong Dashboard, vào 2 trang tính:

| Sheet | Cột |
|---|---|
| `Nguoi tham du` | STT, ID, Họ tên, Trạng thái (*Đang tham dự* / *Đã trúng*), Ngày thêm |
| `Trung thuong` | Lượt, ID, Họ tên, Thời gian trúng |

Hai sheet này được tạo tự động nếu chưa có.

### Cài đặt từng bước

1. **Tạo Google Sheet** mới (hoặc dùng Sheet có sẵn).
2. Trong Sheet: **Tiện ích mở rộng → Apps Script**.
3. Xoá code mặc định, dán toàn bộ nội dung file `apps-script/Code.gs` vào, rồi sửa dòng đầu:
   ```js
   const SPREADSHEET_ID = "";   // để trống vì script đang gắn với chính Sheet này
   ```
   (Nếu tạo script độc lập ở script.google.com thì điền ID của Sheet — chuỗi nằm giữa `/d/` và `/edit` trong URL của Sheet.)
4. Bấm **Lưu** (biểu tượng đĩa mềm).
5. Bấm **Triển khai (Deploy) → Tùy chọn triển khai mới (New deployment)**:
   - Biểu tượng bánh răng → chọn loại **Ứng dụng web (Web app)**.
   - *Thực thi dưới dạng (Execute as)*: **Tôi (Me)**.
   - *Người có quyền truy cập (Who has access)*: **Bất kỳ ai (Anyone)**.
   - Bấm **Triển khai**, cấp quyền truy cập cho tài khoản Google khi được hỏi (chọn *Advanced → Go to … (unsafe)* nếu Google cảnh báo — đây là script của chính bạn).
6. Sao chép **URL ứng dụng web** (dạng `https://script.google.com/macros/s/.../exec`).
7. Mở `html/dashboard.js`, dán URL vào:
   ```js
   const SCRIPT_URL = "https://script.google.com/macros/s/XXXXXXXX/exec";
   ```
8. Tải lại Dashboard, bấm **Đồng bộ Google Sheet**. Thông báo xanh *“Đã đồng bộ lên Google Sheets: … người tham dự, … người trúng”* là thành công.

> 🔁 **Mỗi khi sửa `Code.gs`** phải vào **Triển khai → Quản lý các bản triển khai → ✏️ Chỉnh sửa → Phiên bản: Phiên bản mới → Triển khai** thì thay đổi mới có hiệu lực (URL giữ nguyên).
>
> ✅ Kiểm tra nhanh: mở URL `/exec` trên trình duyệt, thấy `{"success":true,"message":"Lucky Draw API is running"}` là script đang chạy.

Không dùng tính năng này? Để `SCRIPT_URL = ""` — nút đồng bộ sẽ báo *“Chưa cấu hình”*, mọi chức năng khác vẫn chạy bình thường.

> 📨 `Code.gs` vẫn giữ luồng cũ **gửi email mã giảm giá** (khi gửi lên `fullname`, `email`, `discountPercentage` mà không có `action`), ghi vào sheet `DSTT`. Nếu không dùng có thể bỏ qua.

---

## 8. Tuỳ biến giao diện & thông số

### Thông số vòng quay – `html/script.js`, đối tượng `CONFIG` ở đầu file

| Thông số | Mặc định | Ý nghĩa |
|---|---|---|
| `TIMING.SPIN_DURATION` | `20000` | Thời gian quay (ms) |
| `TIMING.FADE_OUT_START` | `18000` | Thời điểm bắt đầu giảm âm lượng tiếng quay — nên = `SPIN_DURATION − FADE_OUT_DURATION` |
| `TIMING.FADE_OUT_DURATION` | `2000` | Thời gian giảm âm lượng (ms) |
| `TIMING.MODAL_DELAY` | `2000` | Chờ bao lâu sau khi dừng mới hiện màn hình chúc mừng (ms) |
| `TIMING.EXTRA_SPINS` | `3` | Số vòng quay tối thiểu |
| `TIMING.EASING` | `cubic-bezier(...)` | Kiểu chuyển động (nhanh dần rồi chậm dần) |
| `WHEEL.COLORS.LIGHT` / `DARK` | `#f3ffe1` / `#246d4b` | Hai màu xen kẽ của các ô |
| `WHEEL.TEXT.SIZE` | `15` | Cỡ chữ tên trên vòng quay |
| `WHEEL.TEXT.MAX_LENGTH` / `TRUNCATE_LENGTH` | `12` / `10` | Tên dài hơn `MAX_LENGTH` ký tự sẽ bị cắt còn `TRUNCATE_LENGTH` ký tự + `...` |
| `AUDIO.SPIN_VOLUME` / `VICTORY_VOLUME` | `0.7` / `0.8` | Âm lượng (0 → 1) |

Ví dụ muốn quay nhanh hơn (10 giây):

```js
SPIN_DURATION: 10000,
FADE_OUT_START: 8000,
```

> 💡 Danh sách đông (trên ~80 người) thì chữ sẽ chồng nhau — giảm `WHEEL.TEXT.SIZE` hoặc `TRUNCATE_LENGTH`.

### Hình ảnh, âm thanh, chữ

Thay file nhưng **giữ nguyên tên file** là xong:

| Muốn đổi | File |
|---|---|
| Khung/viền vòng quay | `html/images/wheel.png` |
| Nút quay ở giữa | `html/images/button-wheel.png` |
| Ảnh nền | `html/images/bg-2.png` (khai báo trong `style.css` và `dashboard.css`) |
| Ảnh tiêu đề | `html/images/main-text.png` (khai báo trong `style.css`) |
| Con trỏ chuột | `html/images/cursor35.png`, `pointer50.png` |
| Hiệu ứng sao / pháo giấy | `html/images/stars.json`, `confetti.json` (file Lottie, tải tại [lottiefiles.com](https://lottiefiles.com)) |
| Âm thanh quay / chiến thắng | `html/sound/am-thanh-vong-quay.mp3`, `am-thanh-chien-thang.mp3` |
| Tiêu đề tab trình duyệt | thẻ `<title>` trong `index.html`, `dashboard.html` |
| Câu “Chúc mừng bạn đã trúng thưởng” | trong `index.html` **và** trong `script.js` (đoạn reset modal, tìm chuỗi `Chúc mừng`) |
| Chữ “EZ” ở tâm vòng quay | hàm `drawWheel()` trong `script.js` |

Sau khi thay file, bấm **Ctrl + F5** để trình duyệt tải lại bản mới.

---

## 9. Dữ liệu được lưu ở đâu?

Danh sách được lưu trong **`localStorage` của trình duyệt** với 2 khoá:

- `luckydraw_participants` – danh sách người tham dự (`id`, `name`, `createdDate`, `status`: `active` / `inactive`)
- `luckydraw_winners` – danh sách người trúng (`id`, `name`, `winTime`)

Điều này có nghĩa là:

- ✅ Tắt trình duyệt / khởi động lại máy **không mất** dữ liệu.
- ⚠️ Dữ liệu **chỉ nằm trên đúng máy + đúng trình duyệt + đúng tên miền** đã nhập. Nhập trên laptop thì phải quay trên laptop đó; đổi từ `localhost` sang tên miền thật là danh sách trống.
- ⚠️ Chế độ ẩn danh, hoặc xoá dữ liệu duyệt web (*Cookies and site data*) sẽ **mất** danh sách.
- Muốn sao lưu: dùng [đồng bộ Google Sheets](#7-đồng-bộ-google-sheets-tuỳ-chọn), hoặc giữ lại file CSV gốc để import lại.

Reset toàn bộ dữ liệu: trong Dashboard bấm **Xóa tất cả** ở cả 2 khung; hoặc mở DevTools (F12) → tab *Console* và chạy:

```js
localStorage.removeItem("luckydraw_participants");
localStorage.removeItem("luckydraw_winners");
```

---

## 10. Checklist trước ngày sự kiện

- [ ] Dùng **đúng máy và đúng trình duyệt** sẽ chiếu trong sự kiện để nhập danh sách.
- [ ] Import danh sách, kiểm tra số lượng và tên có dấu hiển thị đúng.
- [ ] Quay thử vài lượt → vào Dashboard **Xóa tất cả → Chuyển tất cả về danh sách tham dự** để reset.
- [ ] Thử âm thanh qua loa hội trường.
- [ ] Bật **F11** (toàn màn hình), tắt thông báo hệ điều hành, tắt chế độ ngủ của máy.
- [ ] (Tuỳ chọn) Thử nút **Đồng bộ Google Sheet**.

---

## 11. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân & cách xử lý |
|---|---|
| Vòng quay hiện “Chưa có người tham dự” dù đã nhập | Nhập ở trình duyệt/tên miền khác (xem [mục 9](#9-dữ-liệu-được-lưu-ở-đâu)). Nhập lại trên đúng trình duyệt đang chiếu. |
| Không có pháo giấy/sao, Console báo lỗi CORS | Đang mở bằng `file:///`. Chạy qua web server ([mục 3](#3-chạy-thử-trên-máy-local)). |
| Không có tiếng | Trình duyệt chặn tự phát âm thanh — bấm vào trang một lần trước khi quay; kiểm tra tab có bị tắt tiếng không. |
| Import CSV ra chữ lỗi (`Nguy?n`, `Nguyá»…n`) | File không phải UTF-8. Lưu lại bằng **CSV UTF-8** ([mục 6](#6-import-danh-sách-từ-file-csv--excel)). |
| Import CSV báo “0 người được thêm, N trùng lặp” | Các tên đã có sẵn trong danh sách (kể cả người đã trúng). |
| Đồng bộ báo “Đồng bộ thất bại: Thiếu thông tin bắt buộc” / “Apps Script chưa hỗ trợ action sync” | Web App đang chạy code cũ. Dán `Code.gs` mới và **triển khai phiên bản mới** ([mục 7](#7-đồng-bộ-google-sheets-tuỳ-chọn)). |
| Đồng bộ báo “Không thể đồng bộ…” | Sai `SCRIPT_URL`, Web App chưa để quyền **Anyone**, hoặc máy không có Internet. |
| Sửa file rồi mà giao diện không đổi | Trình duyệt đang dùng bản cache — bấm **Ctrl + F5**. |
| Tên dài bị cắt `...` trên vòng quay | Bình thường; tên đầy đủ vẫn hiện ở màn hình chúc mừng. Có thể tăng `WHEEL.TEXT.MAX_LENGTH` ([mục 8](#8-tuỳ-biến-giao-diện--thông-số)). |

---

## Thư viện sử dụng

- [jQuery 3.6](https://jquery.com/) · [Bootstrap 5](https://getbootstrap.com/) · [Bootstrap Icons](https://icons.getbootstrap.com/)
- [GSAP 3.14 + SplitText](https://gsap.com/) (miễn phí theo [GSAP Standard License](https://gsap.com/standard-license))
- [Lottie-web](https://github.com/airbnb/lottie-web)
- Font: Oswald, Anton (Google Fonts, SIL Open Font License)
