# 🎡 Lucky Draw Dashboard – Vòng quay may mắn

Ứng dụng web **quay thưởng cho sự kiện** (year-end party, hội nghị khách hàng, livestream…): nhập danh sách người tham dự, tạo giải thưởng, quay trên màn hình lớn, công bố người trúng kèm hình giải, gửi email thông báo và đồng bộ kết quả lên Google Sheet.

Chạy trên **Cloudflare Workers** (miễn phí), dữ liệu lưu trên máy chủ nên **nhiều máy dùng cùng lúc**: admin chỉnh trên laptop, máy chiếu tự cập nhật.

---

## Mục lục

1. [Tính năng](#1-tính-năng)
2. [Các trang](#2-các-trang)
3. [Đưa lên Cloudflare (khuyên dùng)](#3-đưa-lên-cloudflare-khuyên-dùng)
4. [Mật khẩu quản trị](#4-mật-khẩu-quản-trị)
5. [Chạy trên máy / máy chủ riêng](#5-chạy-trên-máy--máy-chủ-riêng)
6. [Hướng dẫn sử dụng trong sự kiện](#6-hướng-dẫn-sử-dụng-trong-sự-kiện)
7. [Danh sách người tham dự (Excel / CSV)](#7-danh-sách-người-tham-dự-excel--csv)
8. [Giải thưởng](#8-giải-thưởng)
9. [Người trúng & email](#9-người-trúng--email)
10. [Kết nối Google: gửi email & Google Sheet](#10-kết-nối-google-gửi-email--google-sheet)
11. [Tuỳ chỉnh giao diện](#11-tuỳ-chỉnh-giao-diện)
12. [Dữ liệu & sao lưu](#12-dữ-liệu--sao-lưu)
13. [Checklist trước ngày sự kiện](#13-checklist-trước-ngày-sự-kiện)
14. [Xử lý sự cố](#14-xử-lý-sự-cố)
15. [Cấu trúc thư mục](#15-cấu-trúc-thư-mục)
16. [Ủng hộ tác giả](#16-ủng-hộ-tác-giả)

---

## 1. Tính năng

- **Vòng quay** vẽ theo số người tham dự, hiệu ứng âm thanh, sao, pháo giấy, chữ chúc mừng động.
- **Công bằng**: người trúng do **máy chủ chọn ngẫu nhiên** (mọi người có xác suất như nhau), người đã trúng tự bị loại ở lượt sau.
- **Nhiều giải, có số lượng** (Giải Ba ×5, Giải Nhì ×3…). Mỗi giải là **hiện vật** (tên + hình) hoặc **mã giảm giá** (mã riêng cho từng người theo tiền tố, hoặc 1 mã chung). Hình + tên giải hiện ngay khi công bố.
- **Bảng danh sách công khai** để chiếu / chia sẻ link: tự cập nhật, không lộ email, mã giảm giá; người trúng chỉ hiện **sau khi** vòng quay dừng.
- **Email** qua Gmail của bạn: thông báo trúng thưởng, thư huỷ & xin lỗi; mẫu email chỉnh được, xem trước, gửi thử; tuỳ chọn tự gửi khi xác nhận người trúng.
- **Import Excel (.xlsx) / CSV** có cột email, file mẫu tải ngay trong Dashboard.
- **Đồng bộ Google Sheet**, xuất danh sách trúng thưởng ra CSV.
- **Tuỳ chỉnh giao diện**: ảnh nền, ảnh tiêu đề, nút mũi tên, vành vòng quay, 6 màu + bảng màu có sẵn.

## 2. Các trang

| Đường dẫn | Ai dùng | Nội dung |
|---|---|---|
| `/bang-danh-sach/` | **Mọi người** (không cần đăng nhập) | Người tham dự + người trúng theo từng giải. Chiếu lên màn hình phụ hoặc gửi link cho khách xem trên điện thoại. |
| `/login` | Admin | Đăng nhập |
| `/` | Admin | **Vòng quay** – chiếu lên màn hình chính. Góc trái chọn giải đang quay, góc phải xem danh sách trúng thưởng. |
| `/dashboard` | Admin | Quản trị: người tham dự, giải thưởng, người trúng & email, kết nối Google, giao diện, dữ liệu, ủng hộ. |

---

## 3. Đưa lên Cloudflare (khuyên dùng)

Cần: tài khoản [GitHub](https://github.com) và [Cloudflare](https://dash.cloudflare.com/sign-up) (gói Free là đủ). Không cần tạo database – dữ liệu lưu trong Durable Object được tạo tự động.

1. **Fork** repo này về GitHub của bạn (nút *Fork* góc phải trên).
2. Vào Cloudflare → **Workers & Pages** → **Create** → **Import a repository** → kết nối GitHub và chọn repo vừa fork.
3. Điền:

   | Ô | Giá trị |
   |---|---|
   | Project name | `lucky-draw-dashboard` (phải trùng `"name"` trong `wrangler.jsonc`) |
   | Build command | *để trống* |
   | Deploy command | `npx wrangler deploy` |

4. Bấm **Deploy**. Sau 1–2 phút web chạy tại `https://lucky-draw-dashboard.<tài-khoản>.workers.dev`.
5. Mở `/login`, đăng nhập bằng mật khẩu mặc định **`12345678`**, rồi [đổi mật khẩu](#4-mật-khẩu-quản-trị).

**Tự cập nhật:** mỗi lần push lên nhánh `main`, Cloudflare tự build và deploy lại (xem tiến trình ở tab *Deployments* của Worker). Dữ liệu không bị mất khi deploy.

**Tên miền riêng** (không bắt buộc): Worker → *Settings → Domains & Routes → Add → Custom domain*.

## 4. Mật khẩu quản trị

- Chưa đặt mật khẩu → dùng mật khẩu mặc định **`12345678`** (trang đăng nhập có ghi). Ai có link cũng vào được Dashboard.
- **Đổi mật khẩu trên Cloudflare:** Worker `lucky-draw-dashboard` → **Settings → Variables and Secrets → Add** → Type: **Secret**, Name: `ADMIN_PASSWORD`, Value: mật khẩu mới → **Deploy**. Từ lúc này `12345678` không dùng được nữa và mọi phiên đăng nhập cũ bị đăng xuất.
- **Đổi mật khẩu khi chạy trên máy:** sửa file `.dev.vars` ở thư mục dự án thành `ADMIN_PASSWORD=mat-khau-moi` rồi chạy lại.
- Sai mật khẩu 10 lần liên tiếp → khoá đăng nhập từ IP đó 10 phút.

> ⚠️ Admin có thể quay thưởng, xoá dữ liệu và gửi email từ Gmail đã kết nối. Trước sự kiện thật nên đặt mật khẩu riêng.

## 5. Chạy trên máy / máy chủ riêng

Cần **Node.js 20 trở lên** ([tải bản LTS](https://nodejs.org)). Máy chạy giả lập Cloudflare bằng `wrangler dev`; dữ liệu lưu trong thư mục `.wrangler/` của dự án. Chỉ cần Internet ở lần cài đặt đầu (và khi gửi email / đồng bộ Google Sheet).

| Hệ điều hành | Cách chạy |
|---|---|
| **Windows** | Nhấp đúp `start-windows.bat` |
| **macOS / Linux** | `./start.sh` (lần đầu có thể cần `chmod +x start.sh`) |
| **Mọi HĐH** | `npm install` (lần đầu) rồi `npm start` |
| **Docker** | `docker compose up -d` |

- Lần đầu chạy `start-windows.bat` / `start.sh` sẽ hỏi mật khẩu admin và lưu vào file `.dev.vars`. Chạy bằng `npm start` / Docker mà không có `.dev.vars` thì dùng mật khẩu mặc định `12345678`.
- Mở `http://localhost:8080/dashboard`. Máy khác trong cùng mạng LAN (máy chiếu, điện thoại) mở `http://<IP-máy-chạy>:8080/bang-danh-sach/`.
- Tắt: đóng cửa sổ dòng lệnh (hoặc `Ctrl + C`; Docker: `docker compose down`).
- Docker: dữ liệu nằm trong `.wrangler/` của thư mục dự án – giữ thư mục này khi cập nhật.

---

## 6. Hướng dẫn sử dụng trong sự kiện

**Chuẩn bị (trước sự kiện)**

1. Đăng nhập `/dashboard`.
2. Tab **Người tham dự & trúng thưởng**: import danh sách (xem [mục 7](#7-danh-sách-người-tham-dự-excel--csv)).
3. Tab **Giải thưởng**: tạo các giải, sắp xếp thứ tự (nút ↑ ↓).
4. Tab **Email & Google Sheet**: nhập tên sự kiện, kết nối Google, gửi thử email (xem [mục 10](#10-kết-nối-google-gửi-email--google-sheet)).
5. Tab **Giao diện**: đổi ảnh / màu theo nhận diện sự kiện.

**Trong sự kiện**

1. Máy chiếu chính: đăng nhập rồi mở `/` (nút **Mở vòng quay** trên Dashboard), bấm **F11** để toàn màn hình.
2. (Tuỳ chọn) Màn hình phụ / điện thoại khách: mở `/bang-danh-sach/` (nút 🔗 cạnh *Bảng danh sách* trên Dashboard để sao chép link).
3. Mỗi lượt: chọn **giải đang quay** ở góc trái màn hình vòng quay → bấm nút giữa vòng quay → chờ ~20 giây → màn hình chúc mừng hiện tên người trúng + giải.
4. Bấm **Quay tiếp** cho lượt sau, hoặc **Xem danh sách trúng thưởng**.
5. Người trúng vào hàng **Chờ xác nhận** trên Dashboard. Người có mặt nhận giải → bấm **Xác nhận** (tự gửi email nếu đã bật). Người vắng mặt → **⋯ → Trả về danh sách tham dự** hoặc **Huỷ kết quả** rồi quay lại giải đó.

> Bấm vào trang vòng quay một lần trước khi bắt đầu để trình duyệt cho phép phát âm thanh.

## 7. Danh sách người tham dự (Excel / CSV)

- **Cột A: Họ tên** (bắt buộc), **cột B: Email** (để gửi thông báo, có thể để trống). Các cột sau bị bỏ qua. Dòng tiêu đề (`Họ và tên`, `Tên`, `Name`…) tự được bỏ qua.
- File mẫu: tab **Người tham dự** → *File mẫu: Excel · CSV* (hoặc `html/samples/` trong repo).
- Chấp nhận `.xlsx` và `.csv` (phân cách `,` `;` hoặc tab, UTF-8). File `.xls` cũ: mở bằng Excel và lưu lại dạng `.xlsx`.
- Excel lưu CSV: chọn **CSV UTF-8 (Comma delimited)** để không lỗi dấu tiếng Việt. Google Sheets: *Tệp → Tải xuống → Microsoft Excel (.xlsx)*.
- Chống trùng: người có email → trùng **email** bị bỏ qua; người không email → trùng **tên** bị bỏ qua. Import lại file có email cho những người đã có tên nhưng chưa có email → **tự bổ sung email**.
- Sửa / xoá từng người bằng biểu tượng ✏️ / 🗑; **Xóa tất cả** chỉ xoá người **chưa trúng**.

## 8. Giải thưởng

Tab **Giải thưởng → Thêm giải**:

| Trường | Ý nghĩa |
|---|---|
| Tên giải | Hiện trên màn hình công bố, bảng danh sách, email (`{giai}`) |
| Số lượng | Số người được trúng giải này; `0` = không giới hạn. Hết giải → không quay được giải đó nữa |
| Hình | Hiện khi công bố người trúng, trên bảng danh sách và trong email |
| Mô tả | Dùng trong email qua biến `{mo_ta}` |
| Loại: Hiện vật | Chỉ tên + hình |
| Loại: Mã giảm giá | **Mức ưu đãi** (`{uu_dai}`, vd `10%`), và cách tạo mã: **mã riêng** = tiền tố + N ký tự ngẫu nhiên (vd `EZVPS10-K7M2QX`), hoặc **mã chung** cho tất cả |

- **Quay giải này** để chọn giải đang quay (cũng chọn được ngay trên màn hình vòng quay).
- Mã giảm giá **không hiện trên màn hình chiếu** – chỉ có trong Dashboard, email và Google Sheet.
- Chưa tạo giải nào → vòng quay chỉ công bố tên người trúng.

## 9. Người trúng & email

Mỗi người trúng có trạng thái: **Chờ xác nhận** → **Đã xác nhận** hoặc **Đã huỷ**.

| Thao tác | Kết quả |
|---|---|
| **Xác nhận** (hoặc *Xác nhận tất cả* ở thanh vàng phía trên) | Chuyển *Đã xác nhận*; nếu bật **Tự động gửi email** thì gửi luôn thông báo trúng thưởng |
| **Gửi email ▾ → Thông báo trúng thưởng** | Gửi email chúc mừng (kèm hình giải, mã giảm giá nếu có) |
| **Gửi email ▾ → Thông báo huỷ và xin lỗi** | Gửi thư xin lỗi, kết quả chuyển *Đã huỷ*, giải được trả lại để quay tiếp |
| **Gửi email ▾ → Xem trước** | Xem nội dung email trước khi gửi |
| **⋯ → Huỷ kết quả** | Huỷ, không gửi mail; người này không tham gia lượt sau |
| **⋯ → Trả về danh sách tham dự** | Xoá kết quả, người này được quay lại ở các lượt sau |
| **⋯ → Xoá hẳn** | Xoá khỏi cả danh sách trúng và danh sách tham dự |
| Nút ⬇ (góc phải khung) | Tải danh sách trúng thưởng `.csv` |

Huy hiệu email cho biết đã gửi gì, lúc nào, hay bị lỗi (rê chuột vào để xem lỗi).

**Mẫu email** (tab *Email & Google Sheet → Mẫu email*): sửa tiêu đề / nội dung cho cả 2 loại thư. Biến dùng được:

| Biến | Giá trị |
|---|---|
| `{ten}` | Tên người trúng |
| `{giai}` | Tên giải |
| `{ma}` | Mã giảm giá |
| `{uu_dai}` | Mức ưu đãi |
| `{mo_ta}` | Mô tả giải |
| `{su_kien}` | Tên sự kiện |

Dòng nào chứa biến không có giá trị (vd `{ma}` với giải hiện vật) tự bị bỏ. Bấm **Xem trước** để kiểm tra, **Khôi phục mẫu mặc định** để quay lại nội dung gốc.

## 10. Kết nối Google: gửi email & Google Sheet

Email được gửi từ **Gmail của bạn** qua Google Apps Script (Gmail thường ~100 email/ngày, Google Workspace ~1.500/ngày). Làm **1 lần**, theo đúng hướng dẫn trong tab **Email & Google Sheet**:

1. Tạo Google Sheet mới ([sheets.new](https://sheets.new)) → menu **Tiện ích mở rộng → Apps Script**.
2. Trong Dashboard bấm **Sao chép code** (code đã có sẵn **mã bí mật** của bạn). Trong Apps Script, mở file có sẵn (`Code.gs` / `Mã.gs`), **xoá hết code cũ**, dán vào, bấm **Lưu**.
   ⚠️ **Không tạo thêm file mới** – 2 file cùng chứa code sẽ báo lỗi *"Identifier 'SECRET' has already been declared"*.
3. **Cấp quyền:** ở ô chọn hàm trên thanh công cụ (cạnh nút *Gỡ lỗi*) chọn **`capQuyen`** → **▷ Chạy** → **Xem xét quyền** → chọn tài khoản → nếu Google cảnh báo chọn *Advanced → Go to … (unsafe)* → **Cho phép**.
4. **Triển khai → Tùy chọn triển khai mới** → bánh răng → **Ứng dụng web**; *Thực thi dưới dạng*: **Tôi**; *Người có quyền truy cập*: **Bất kỳ ai** → **Triển khai** → sao chép **URL ứng dụng web** (kết thúc bằng `/exec`).
5. Dán URL vào Dashboard → **Lưu** → **Kiểm tra** → nhập email của bạn → **Gửi thử**.

**Khi sửa code Apps Script** (hoặc bấm *Đổi mã bí mật*): dán lại code → chạy lại `capQuyen` → **Triển khai → Quản lý các bản triển khai → ✏️ → Phiên bản: Phiên bản mới → Triển khai** (URL giữ nguyên).

**Đồng bộ Google Sheet:** bấm **Đồng bộ lên Google Sheet** → ghi đè 2 trang tính `Nguoi tham du` và `Trung thuong` (tự tạo nếu chưa có) bằng dữ liệu mới nhất.

Cài đặt chung cùng tab: **Tên sự kiện** (biến `{su_kien}`), **Tên người gửi email**, và **Tự động gửi email trúng thưởng khi bấm Xác nhận**.

## 11. Tuỳ chỉnh giao diện

Tab **Giao diện** – áp dụng ngay cho mọi màn hình đang mở:

| Ảnh | Gợi ý |
|---|---|
| Ảnh nền | 1920×1080, JPG/PNG |
| Ảnh tiêu đề | PNG nền trong suốt, khung ngang (vd 3000×1000) |
| Nút mũi tên (giữa vòng quay) | PNG vuông nền trong suốt, mũi tên ở chính giữa cạnh trên, cùng kích thước ảnh vành |
| Vành vòng quay | PNG vuông nền trong suốt, giữa trong suốt |

Ảnh được tự thu nhỏ trước khi tải lên. Nút ↺ cạnh mỗi ảnh để về ảnh mặc định.
**Màu vòng quay:** 6 bảng màu có sẵn hoặc chỉnh 6 màu (ô lẻ / chẵn, chữ, tâm) với hình xem trước.

Muốn đổi mặc định ngay trong code: ảnh ở `html/images/`, âm thanh ở `html/sound/`, thời gian quay ở `CONFIG.TIMING` đầu file `html/script.js` (`SPIN_DURATION` mặc định 20 giây).

## 12. Dữ liệu & sao lưu

- Toàn bộ dữ liệu (người tham dự, giải, người trúng, cài đặt, ảnh) lưu trên máy chủ Cloudflare (hoặc thư mục `.wrangler/` khi chạy trên máy). Đổi máy / trình duyệt không mất dữ liệu.
- Sao lưu: **Đồng bộ lên Google Sheet** hoặc tải **CSV người trúng**.
- Tab **Dữ liệu**:
  - **Nhập dữ liệu từ bản cũ** – hiện ra nếu trình duyệt còn danh sách của phiên bản cũ (lưu trong trình duyệt).
  - **Xoá toàn bộ người tham dự & trúng thưởng** (gõ `XOA` để xác nhận) – giữ lại giải thưởng, cài đặt email và giao diện, dùng khi bắt đầu sự kiện mới.

## 13. Checklist trước ngày sự kiện

- [ ] Đã đặt mật khẩu admin riêng.
- [ ] Import danh sách, kiểm tra số lượng và email.
- [ ] Tạo đủ giải, đúng số lượng, có hình.
- [ ] Kết nối Google, **Gửi thử** email tới chính mình, xem trước cả 2 mẫu email.
- [ ] Quay thử vài lượt → **Xóa tất cả → Trả tất cả về danh sách tham dự** để reset.
- [ ] Thử âm thanh qua loa hội trường, bật F11, tắt chế độ ngủ của máy chiếu.
- [ ] Kiểm tra Internet tại địa điểm (bản Cloudflare cần Internet).

## 14. Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Không đăng nhập được bằng `12345678` | Đã đặt `ADMIN_PASSWORD` (Cloudflare Secret hoặc `.dev.vars`) – dùng mật khẩu đó |
| "Sai mật khẩu quá nhiều lần" | Chờ 10 phút rồi thử lại |
| Gửi email lỗi *"…permission to call MailApp.sendEmail…"* / *"chưa được cấp quyền gửi email"* | Chạy hàm `capQuyen` trong Apps Script ([mục 10](#10-kết-nối-google-gửi-email--google-sheet), bước 3) rồi triển khai **phiên bản mới** |
| Apps Script báo *"Identifier 'SECRET' has already been declared"* | Có nhiều file chứa code – xoá file thừa, chỉ giữ 1 file |
| *"Sai mã bí mật"* | Code trong Apps Script cũ hoặc vừa đổi mã bí mật – sao chép lại code từ Dashboard, triển khai phiên bản mới |
| *"Apps Script trả về trang HTML"* | Web App chưa để quyền **Bất kỳ ai**, hoặc dán nhầm URL (phải kết thúc bằng `/exec`) |
| *"Đã hết hạn mức gửi email hôm nay"* | Gmail giới hạn ~100 email/ngày – chờ hôm sau hoặc dùng tài khoản Google Workspace |
| "Giải … đã hết" | Chọn giải khác, hoặc tăng số lượng trong tab Giải thưởng |
| Màn hình không tự cập nhật | Kiểm tra Internet; trang tự kết nối lại và tải dữ liệu mỗi 20 giây. Bấm `F5` nếu cần |
| Không có tiếng | Bấm vào trang một lần trước khi quay; kiểm tra tab không bị tắt tiếng |
| Import Excel ra chữ lỗi | Lưu lại dạng `.xlsx` hoặc **CSV UTF-8** |
| Sửa code / ảnh mà giao diện không đổi | Chờ Cloudflare deploy xong (tab *Deployments*), rồi `Ctrl + F5` |
| Cloudflare build lỗi "name mismatch" | Project name trên Cloudflare phải trùng `"name"` trong `wrangler.jsonc` |

## 15. Cấu trúc thư mục

```
lucky-draw-dashboard/
├── src/                      # Máy chủ (Cloudflare Worker)
│   ├── worker.js             # Định tuyến, đăng nhập, API
│   ├── store.js              # Durable Object: dữ liệu, quay thưởng, giải, người trúng
│   └── email.js              # Mẫu email + gọi Google Apps Script
├── html/                     # Giao diện (web tĩnh)
│   ├── index.html, script.js, style.css         # Vòng quay (/)
│   ├── dashboard.html, dashboard.js, dashboard.css  # Quản trị (/dashboard)
│   ├── login.html            # Đăng nhập (/login)
│   ├── bang-danh-sach/       # Bảng danh sách công khai
│   ├── js/api.js             # Gọi API, cập nhật trực tiếp, áp dụng giao diện
│   ├── apps-script/Code.gs   # Code Google Apps Script (Dashboard tự điền mã bí mật)
│   ├── samples/              # File mẫu danh sách (.xlsx, .csv)
│   ├── images/, sound/       # Ảnh, hiệu ứng Lottie, âm thanh mặc định
│   └── libs/                 # jQuery, Bootstrap, GSAP, Lottie, Lucide icons, read-excel-file
├── wrangler.jsonc            # Cấu hình Cloudflare Workers
├── package.json              # npm start = chạy trên máy (wrangler dev)
├── start-windows.bat, start.sh, docker-compose.yml
└── .dev.vars.example         # Mẫu file mật khẩu khi chạy trên máy
```

API chính (dùng nội bộ): `GET /api/state` (công khai), `GET /api/live` (WebSocket), `GET /api/image/:id`, `POST /api/login`, `GET /api/admin/state`, `POST /api/admin/<thao-tác>` (cần đăng nhập + header `X-LD-Admin: 1`).

Thư viện: [jQuery](https://jquery.com), [Bootstrap 5](https://getbootstrap.com), [GSAP](https://gsap.com), [Lottie-web](https://github.com/airbnb/lottie-web), [Lucide](https://lucide.dev) (ISC), [read-excel-file](https://gitlab.com/catamphetamine/read-excel-file) (MIT), [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

## 16. Ủng hộ tác giả

Ứng dụng miễn phí cho mọi người. Nếu app giúp sự kiện của bạn vui và công bằng hơn, bạn có thể ủng hộ để tác giả duy trì máy chủ và phát triển thêm tính năng – mở Dashboard → tab **Ủng hộ** để quét mã VietQR, hoặc chuyển khoản:

| | |
|---|---|
| Ngân hàng | MB |
| Số tài khoản | `6006101991` |
| Chủ tài khoản | THAI DUY KHANG |
| Nội dung | Ung ho tac gia |

Cảm ơn bạn! ☕
