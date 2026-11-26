/**
 * Lucky Draw Dashboard - Google Apps Script
 * - Gửi email cho người trúng thưởng (thông báo trúng / huỷ và xin lỗi)
 * - Đồng bộ danh sách lên Google Sheets
 *
 * Cách dùng: Dashboard > tab "Email & Google Sheet" > làm theo hướng dẫn.
 * Dashboard tự điền SECRET khi bạn bấm "Sao chép code" — không chia sẻ code này công khai.
 */

// Mã bí mật: phải trùng với mã trong Dashboard, chặn người lạ dùng script để gửi mail
const SECRET = "{{SECRET}}";

// Để trống nếu script được tạo từ chính Google Sheet (khuyên dùng)
const SPREADSHEET_ID = "";
const SHEET_PARTICIPANTS = "Nguoi tham du";
const SHEET_WINNERS = "Trung thuong";

/**
 * CHẠY HÀM NÀY 1 LẦN TRONG TRÌNH SOẠN THẢO để cấp quyền gửi email + Google Sheet:
 * chọn "capQuyen" ở thanh công cụ -> bấm "Chạy" (Run) -> Xem xét quyền -> Cho phép.
 * Sau đó: Triển khai -> Quản lý các bản triển khai -> Chỉnh sửa -> Phiên bản mới -> Triển khai.
 */
function capQuyen() {
  const quota = MailApp.getRemainingDailyQuota();
  getSpreadsheet();
  Logger.log("Đã cấp quyền. Số email còn gửi được hôm nay: " + quota);
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doGet() {
  return jsonOutput({ success: true, message: "Lucky Draw API is running" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (!SECRET || SECRET.indexOf("{{") === 0 || data.secret !== SECRET) {
      throw new Error("Sai mã bí mật — hãy sao chép lại code từ Dashboard và triển khai phiên bản mới");
    }

    if (data.action === "ping") {
      return jsonOutput({ success: true, quota: MailApp.getRemainingDailyQuota() });
    }

    if (data.action === "sendEmail") {
      if (!data.to) throw new Error("Thiếu địa chỉ email");
      MailApp.sendEmail({
        to: data.to,
        subject: data.subject || "(không có tiêu đề)",
        htmlBody: data.htmlBody || "",
        body: data.textBody || "",
        name: data.name || "Vòng quay may mắn",
      });
      return jsonOutput({ success: true, quota: MailApp.getRemainingDailyQuota() });
    }

    if (data.action === "sync") {
      syncSheets(data);
      return jsonOutput({ success: true });
    }

    throw new Error("Action không hợp lệ: " + data.action);
  } catch (error) {
    return jsonOutput({ success: false, error: error.message });
  }
}

function getSpreadsheet() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function writeTable(sheet, header, rows) {
  sheet.clearContents();
  const values = [header].concat(rows);
  sheet.getRange(1, 1, values.length, header.length).setValues(values);
  sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function syncSheets(data) {
  const ss = getSpreadsheet();
  const participants = data.participants || [];
  const winners = data.winners || [];
  const status = { active: "Đang tham dự", won: "Đã trúng" };
  const winnerStatus = { pending: "Chờ xác nhận", confirmed: "Đã xác nhận", cancelled: "Đã huỷ" };

  writeTable(
    getOrCreateSheet(ss, SHEET_PARTICIPANTS),
    ["STT", "Họ tên", "Email", "Trạng thái", "Ngày thêm"],
    participants.map(function (p, i) {
      return [i + 1, p.name, p.email || "", status[p.status] || p.status, p.createdAt ? new Date(p.createdAt) : ""];
    })
  );

  writeTable(
    getOrCreateSheet(ss, SHEET_WINNERS),
    ["Lượt", "Họ tên", "Email", "Giải", "Mã giảm giá", "Trạng thái", "Thời gian trúng", "Email đã gửi"],
    winners.map(function (w, i) {
      return [
        i + 1, w.name, w.email || "", w.prize || "", w.code || "",
        winnerStatus[w.status] || w.status, w.wonAt ? new Date(w.wonAt) : "", w.emailed || "",
      ];
    })
  );
}
