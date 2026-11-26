// Code Google Apps Script hiển thị trong hộp thoại "Cài đặt Google Sheet" của Dashboard.
// Người dùng sao chép và dán vào Tiện ích mở rộng > Apps Script của Google Sheet.
// (Bản đầy đủ có thêm luồng gửi email mã giảm giá: apps-script/Code.gs)
// Lưu ý: không dùng dấu ` hoặc ${ trong code bên dưới.
window.APPS_SCRIPT_CODE = String.raw`/**
 * Lucky Draw Dashboard - đồng bộ danh sách lên Google Sheets.
 * Dán toàn bộ file này vào Tiện ích mở rộng > Apps Script của Google Sheet,
 * sau đó Triển khai > Tùy chọn triển khai mới > Ứng dụng web
 * (Thực thi: Tôi, Quyền truy cập: Bất kỳ ai).
 */

// Để trống nếu script được tạo từ chính Google Sheet (khuyên dùng).
// Nếu tạo script độc lập ở script.google.com thì điền ID của Sheet
// (chuỗi nằm giữa /d/ và /edit trong URL của Sheet).
const SPREADSHEET_ID = "";
const SHEET_PARTICIPANTS = "Nguoi tham du";
const SHEET_WINNERS = "Trung thuong";

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

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// Mở URL /exec trên trình duyệt để kiểm tra script đang chạy
function doGet() {
  return jsonOutput({ success: true, message: "Lucky Draw API is running" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action !== "sync") throw new Error("Action không hợp lệ");

    const participants = Array.isArray(data.participants) ? data.participants : [];
    const winners = Array.isArray(data.winners) ? data.winners : [];
    const ss = getSpreadsheet();

    writeTable(
      getOrCreateSheet(ss, SHEET_PARTICIPANTS),
      ["STT", "ID", "Họ tên", "Trạng thái", "Ngày thêm"],
      participants.map(function (p, i) {
        return [
          i + 1,
          String(p.id),
          p.name,
          p.status === "active" ? "Đang tham dự" : "Đã trúng",
          p.createdDate ? new Date(p.createdDate) : "",
        ];
      })
    );

    writeTable(
      getOrCreateSheet(ss, SHEET_WINNERS),
      ["Lượt", "ID", "Họ tên", "Thời gian trúng"],
      winners.map(function (w, i) {
        return [i + 1, String(w.id), w.name, w.winTime ? new Date(w.winTime) : ""];
      })
    );

    return jsonOutput({
      success: true,
      message: "Đã đồng bộ",
      participants: participants.length,
      winners: winners.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return jsonOutput({ success: false, error: error.message });
  }
}
`;
