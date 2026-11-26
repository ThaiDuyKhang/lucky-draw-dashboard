// Dựng nội dung email từ mẫu (template) và gọi Google Apps Script để gửi.
//
// Biến dùng trong mẫu:
//   {ten} tên người trúng   {giai} tên giải        {ma} mã giảm giá
//   {uu_dai} mức ưu đãi     {mo_ta} mô tả giải     {su_kien} tên sự kiện
// Dòng nào chứa biến không có giá trị (vd {ma} khi giải không có mã) sẽ tự bị bỏ.

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fillTemplate(template, vars) {
  return String(template || "")
    .split("\n")
    .filter((line) => {
      const used = line.match(/\{(\w+)\}/g) || [];
      return used.every((token) => {
        const key = token.slice(1, -1);
        return !(key in vars) || String(vars[key]).trim() !== "";
      });
    })
    .join("\n")
    .replace(/\{(\w+)\}/g, (m, key) => (key in vars ? String(vars[key]) : m))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function renderEmail(type, winner, settings, origin) {
  const prize = winner.prize || {};
  const vars = {
    ten: winner.name || "",
    giai: prize.name || "giải thưởng",
    ma: winner.code || "",
    uu_dai: prize.discountText || "",
    mo_ta: prize.description || "",
    su_kien: settings.eventName || "",
  };
  const tpl = settings.templates[type] || settings.templates.win;
  const subject = fillTemplate(tpl.subject, vars).replace(/\n/g, " ");
  const text = fillTemplate(tpl.body, vars);

  const isWin = type === "win";
  const accent = isWin ? "#246d4b" : "#8a5a00";
  const imageUrl = isWin && prize.imageId && origin ? `${origin}/api/image/${prize.imageId}` : "";

  const bodyHtml = escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  const prizeBlock = isWin
    ? `
      ${imageUrl ? `<div style="text-align:center;margin:8px 0 16px"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(prize.name || "")}" style="max-width:260px;max-height:220px;border-radius:10px"></div>` : ""}
      ${prize.name ? `<div style="text-align:center;font-size:20px;font-weight:bold;color:${accent};margin-bottom:10px">${escapeHtml(prize.name)}</div>` : ""}
      ${winner.code ? `<div style="text-align:center;margin:12px 0 18px"><div style="display:inline-block;border:2px dashed ${accent};border-radius:10px;padding:12px 22px;font-size:24px;font-weight:bold;letter-spacing:3px;color:${accent};font-family:Consolas,monospace">${escapeHtml(winner.code)}</div></div>` : ""}`
    : "";

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f4f6f5;font-family:Segoe UI,Arial,sans-serif;color:#222">
  <div style="max-width:560px;margin:0 auto;padding:24px 12px">
    <div style="background:${accent};color:#fff;border-radius:12px 12px 0 0;padding:18px 24px;font-size:18px;font-weight:bold">
      ${escapeHtml(settings.eventName || "Vòng quay may mắn")}
    </div>
    <div style="background:#fff;border-radius:0 0 12px 12px;padding:24px">
      ${prizeBlock}
      ${bodyHtml}
    </div>
    <div style="text-align:center;font-size:12px;color:#888;margin-top:14px">Email được gửi tự động, vui lòng không trả lời.</div>
  </div></body></html>`;

  return { subject, text, html };
}

// Đổi lỗi thường gặp của Google sang hướng dẫn tiếng Việt
function friendlyError(message) {
  if (/permission/i.test(message) && /send_mail|MailApp|gmail/i.test(message)) {
    return "Apps Script chưa được cấp quyền gửi email. Mở Apps Script, chọn hàm capQuyen ở thanh công cụ → bấm Chạy → cho phép quyền; rồi Triển khai → Quản lý các bản triển khai → Chỉnh sửa → Phiên bản mới → Triển khai.";
  }
  if (/permission/i.test(message) && /spreadsheets/i.test(message)) {
    return "Apps Script chưa được cấp quyền Google Sheet. Chạy hàm capQuyen trong Apps Script để cấp quyền, rồi triển khai phiên bản mới.";
  }
  if (/too many times|quota|Service invoked/i.test(message)) {
    return "Đã hết hạn mức gửi email hôm nay của tài khoản Google (Gmail thường ~100 email/ngày). Thử lại vào ngày mai.";
  }
  return message;
}

// Gọi Web App của Apps Script (Apps Script trả về qua chuyển hướng 302)
export async function callAppsScript(url, payload) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
  } catch (error) {
    return { ok: false, error: "Không gọi được Apps Script (" + (error.message || error) + ")" };
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    if (/<html/i.test(text)) {
      return { ok: false, error: "Apps Script trả về trang HTML — kiểm tra đã triển khai Web App với quyền 'Bất kỳ ai' và dán đúng code mới" };
    }
    return { ok: false, error: "Phản hồi không hợp lệ từ Apps Script (HTTP " + res.status + ")" };
  }
  if (!data.success) return { ok: false, error: friendlyError(data.error || "Apps Script báo lỗi") };
  return { ok: true, data };
}
