// Dashboard quản trị: người tham dự, giải thưởng, người trúng + email, cài đặt, giao diện.
// Dữ liệu lưu trên máy chủ (Cloudflare); mọi màn hình đang mở tự cập nhật.
$(function () {
  const Api = window.LuckyApi;
  const esc = Api.escapeHtml;
  let state = null;

  // ==================== TIỆN ÍCH ====================
  function showToast(message, type = "info") {
    const colors = { success: "#198754", danger: "#dc3545", warning: "#ffc107", info: "#246d4b" };
    const toast = $('<div class="toast-notification"></div>')
      .css({ background: colors[type] || colors.info, color: type === "warning" ? "#212529" : "#fff" })
      .text(message);
    $(".toast-stack").length || $("body").append('<div class="toast-stack"></div>');
    $(".toast-stack").append(toast);
    setTimeout(() => toast.fadeOut(300, () => toast.remove()), type === "danger" ? 7000 : 3500);
  }

  function loading(on) {
    $("#loading").toggleClass("d-none", !on);
  }

  // Hộp thoại xác nhận: buttons = [{ value, label, cls }] -> Promise<value | null>
  function confirmDialog({ title, html, buttons }) {
    return new Promise((resolve) => {
      const el = document.getElementById("confirmModal");
      $("#confirm-title").text(title);
      $("#confirm-body").html(html);
      const footer = $("#confirm-footer").empty();
      let result = null;
      footer.append('<button type="button" class="btn btn-outline-dark" data-bs-dismiss="modal">Huỷ</button>');
      buttons.forEach((b) => {
        $('<button type="button" class="btn"></button>')
          .addClass(b.cls || "btn-return")
          .text(b.label)
          .on("click", () => {
            result = b.value;
            bootstrap.Modal.getInstance(el).hide();
          })
          .appendTo(footer);
      });
      $(el).one("hidden.bs.modal", () => resolve(result));
      bootstrap.Modal.getOrCreateInstance(el).show();
    });
  }

  // Gọi 1 thao tác admin, cập nhật dữ liệu và hiển thị
  async function run(action, body, successMessage, { quiet = false } = {}) {
    if (!quiet) loading(true);
    try {
      const res = await Api.action(action, body);
      setState(res.state);
      if (successMessage) showToast(typeof successMessage === "function" ? successMessage(res) : successMessage, "success");
      return res;
    } catch (e) {
      showToast(e.message, "danger");
      return null;
    } finally {
      if (!quiet) loading(false);
    }
  }

  function formatTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }

  // ==================== DỮ LIỆU ====================
  let formsFilled = false;

  async function refresh() {
    try {
      setState(await Api.adminState());
    } catch (e) {
      showToast(e.message, "danger");
    }
  }

  function setState(next) {
    state = next;
    render();
  }

  function render() {
    $("#nav-event-name").text(state.settings.eventName);
    renderParticipants();
    renderWinners();
    renderPrizes();
    renderScriptStatus();
    renderThemeImages();
    renderBranding();
    renderParty();
    if (!formsFilled) {
      fillSettingsForms();
      formsFilled = true;
    }
    renderAppsScriptCode();
  }

  // ==================== NGƯỜI THAM DỰ ====================
  function renderParticipants() {
    const q = $("#participant-search").val().trim().toLowerCase();
    const active = state.participants.filter((p) => p.status === "active");
    const list = q
      ? active.filter((p) => p.name.toLowerCase().includes(q) || (p.email || "").includes(q))
      : active;
    $("#participant-count").text(active.length);
    const tbody = $("#participants-list");
    if (list.length === 0) {
      tbody.html(`<tr><td class="text-center text-muted py-4">${q ? "Không tìm thấy" : "Chưa có người tham dự"}</td></tr>`);
      return;
    }
    tbody.html(
      list
        .map(
          (p, i) => `
        <tr data-id="${esc(p.id)}">
          <td class="text-muted" style="width:40px">${i + 1}</td>
          <td><div class="participant-name">${esc(p.name)}</div>
              ${p.email ? `<div class="small text-muted">${esc(p.email)}</div>` : `<div class="small text-warning-emphasis"><i class="li icon-mail-x"></i> chưa có email</div>`}</td>
          <td class="text-end text-nowrap" style="width:90px">
            <button class="btn btn-sm btn-link text-dark p-1 edit-participant" title="Sửa"><i class="li icon-pencil"></i></button>
            <button class="btn btn-sm btn-link text-danger p-1 delete-participant" title="Xoá"><i class="li icon-trash-2"></i></button>
          </td>
        </tr>`
        )
        .join("")
    );
  }

  $("#participant-search").on("input", () => state && renderParticipants());

  $("#add-participant-form").on("submit", async function (e) {
    e.preventDefault();
    const res = await run(
      "addParticipant",
      { name: $("#participant-name").val(), email: $("#participant-email").val() },
      "Đã thêm: " + $("#participant-name").val().trim(),
      { quiet: true }
    );
    if (res) {
      $("#participant-name").val("").trigger("focus");
      $("#participant-email").val("");
    }
  });

  $("#participants-list")
    .on("click", ".delete-participant", async function () {
      const id = $(this).closest("tr").data("id");
      const p = state.participants.find((x) => x.id === id);
      const ok = await confirmDialog({
        title: "Xoá người tham dự",
        html: `Xoá <strong>${esc(p.name)}</strong> khỏi danh sách?`,
        buttons: [{ value: true, label: "Xoá", cls: "btn-danger" }],
      });
      if (ok) run("deleteParticipant", { id }, "Đã xoá " + p.name);
    })
    .on("click", ".edit-participant", function () {
      const p = state.participants.find((x) => x.id === $(this).closest("tr").data("id"));
      $("#edit-participant-id").val(p.id);
      $("#edit-participant-name").val(p.name);
      $("#edit-participant-email").val(p.email);
      bootstrap.Modal.getOrCreateInstance(document.getElementById("editParticipantModal")).show();
    });

  $("#edit-participant-form").on("submit", async function (e) {
    e.preventDefault();
    const res = await run(
      "updateParticipant",
      { id: $("#edit-participant-id").val(), name: $("#edit-participant-name").val(), email: $("#edit-participant-email").val() },
      "Đã cập nhật"
    );
    if (res) bootstrap.Modal.getInstance(document.getElementById("editParticipantModal")).hide();
  });

  $("#clear-participants").on("click", async function () {
    const count = state.participants.filter((p) => p.status === "active").length;
    if (!count) return showToast("Danh sách đang trống", "info");
    const ok = await confirmDialog({
      title: "Xoá tất cả người tham dự",
      html: `Xoá <strong>${count}</strong> người chưa trúng thưởng? Người đã trúng vẫn được giữ lại.`,
      buttons: [{ value: true, label: "Xoá tất cả", cls: "btn-danger" }],
    });
    if (ok) run("clearActiveParticipants", {}, "Đã xoá danh sách tham dự");
  });

  // ----- Import Excel / CSV: cột A = họ tên, cột B = email -----
  const HEADER_NAMES = ["tên", "ten", "họ tên", "họ và tên", "name", "full name", "fullname", "stt"];

  $("#import-btn").on("click", () => $("#import-file-input").val("").trigger("click"));

  $("#import-file-input").on("change", async function () {
    const file = this.files && this.files[0];
    if (!file) return;
    try {
      const rows = await readRows(file);
      if (rows.length && HEADER_NAMES.includes(String(rows[0][0] || "").trim().toLowerCase())) rows.shift();
      const data = rows.map((r) => ({ name: String(r[0] ?? ""), email: String(r[1] ?? "") }));
      const total = { added: 0, duplicate: 0, invalidEmail: 0, empty: 0, updated: 0 };
      loading(true);
      for (let i = 0; i < data.length; i += 1000) {
        const res = await Api.action("importParticipants", { rows: data.slice(i, i + 1000) });
        for (const k in total) total[k] += res.summary[k] || 0;
        setState(res.state);
      }
      let msg = `Import xong: ${total.added} người được thêm`;
      if (total.updated) msg += `, ${total.updated} người được bổ sung email`;
      if (total.duplicate) msg += `, ${total.duplicate} trùng`;
      if (total.invalidEmail) msg += `, ${total.invalidEmail} email sai định dạng (đã bỏ email)`;
      if (total.empty) msg += `, ${total.empty} dòng thiếu tên`;
      showToast(msg, total.added || total.updated ? "success" : "warning");
    } catch (e) {
      showToast(e.message, "danger");
    } finally {
      loading(false);
    }
  });

  async function readRows(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx")) {
      if (typeof readXlsxFile !== "function") throw new Error("Không tải được thư viện đọc Excel");
      let rows = await readXlsxFile(file);
      if (rows.length && rows[0] && Array.isArray(rows[0].data)) rows = rows[0].data;
      return trimEmpty(rows.map((r) => [cell(r && r[0]), cell(r && r[1])]));
    }
    if (name.endsWith(".xls")) throw new Error("File .xls (Excel 97-2003) chưa hỗ trợ. Lưu lại dạng .xlsx");
    if (!name.endsWith(".csv")) throw new Error("Vui lòng chọn file Excel (.xlsx) hoặc CSV (.csv)");
    const text = (await file.text()).replace(/^﻿/, "");
    return trimEmpty(text.split(/\r?\n/).map(parseCsvLine));
  }

  function cell(v) {
    return v === null || v === undefined ? "" : String(v);
  }

  function trimEmpty(rows) {
    while (rows.length && !rows[rows.length - 1].join("").trim()) rows.pop();
    return rows;
  }

  // Tách 1 dòng CSV (hỗ trợ ngoặc kép, phân cách , ; hoặc tab)
  function parseCsvLine(line) {
    const sep = line.includes("\t") ? "\t" : (line.split(";").length > line.split(",").length ? ";" : ",");
    const out = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === sep) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }

  // ==================== NGƯỜI TRÚNG THƯỞNG ====================
  const STATUS = {
    pending: ['<span class="badge text-bg-warning">Chờ xác nhận</span>'],
    confirmed: ['<span class="badge text-bg-success">Đã xác nhận</span>'],
    cancelled: ['<span class="badge text-bg-secondary">Đã huỷ</span>'],
  };

  function emailBadge(w) {
    if (!w.email) return '<span class="badge text-bg-light border"><i class="li icon-mail-x"></i> Chưa có email</span>';
    const last = w.emails[w.emails.length - 1];
    if (!last) return '<span class="badge text-bg-light border"><i class="li icon-mail"></i> Chưa gửi</span>';
    const label = last.type === "cancel" ? "thư xin lỗi" : "thông báo trúng";
    if (last.ok) return `<span class="badge text-bg-info"><i class="li icon-mail-check"></i> Đã gửi ${label} ${formatTime(last.at)}</span>`;
    return `<span class="badge text-bg-danger" title="${esc(last.error)}"><i class="li icon-mail-warning"></i> Gửi ${label} lỗi</span>`;
  }

  function renderWinners() {
    const all = state.winners;
    const filter = $("#winner-filter").val();
    const now = state.serverTime || Date.now();
    $("#winner-count").text(all.filter((w) => w.status !== "cancelled").length);

    const pending = all.filter((w) => w.status === "pending");
    $("#pending-banner").toggleClass("d-none", pending.length === 0);
    $("#pending-count").text(pending.length);
    $("#pending-hint").text(state.settings.autoEmail ? "Bấm Xác nhận sẽ tự gửi email thông báo." : "");

    const list = all
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => !filter || w.status === filter)
      .reverse(); // mới nhất lên đầu
    if (list.length === 0) {
      $("#winners-list").html('<div class="text-center text-muted py-4">Chưa có người trúng thưởng</div>');
      return;
    }
    $("#winners-list").html(
      list
        .map(({ w, i }) => {
          const prize = w.prize;
          const hidden = (w.revealAt || 0) > now;
          return `
        <div class="winner-card ${w.status}" data-id="${esc(w.id)}">
          <div class="d-flex gap-3">
            <div class="winner-num">${i + 1}</div>
            <div class="flex-grow-1 min-w-0">
              <div class="d-flex flex-wrap align-items-center gap-2">
                <strong class="winner-name">${esc(w.name)}</strong>
                ${STATUS[w.status]}
                ${hidden ? '<span class="badge text-bg-dark"><i class="li icon-eye-off"></i> Đang quay</span>' : ""}
              </div>
              <div class="small text-muted">${w.email ? esc(w.email) : "—"} · ${formatTime(w.wonAt)}</div>
              <div class="small mt-1">
                ${prize ? `<i class="li icon-gift"></i> <strong>${esc(prize.name)}</strong>` : '<span class="text-muted">Không gắn giải</span>'}
                ${w.code ? ` · Mã: <code class="user-select-all">${esc(w.code)}</code>` : ""}
              </div>
              <div class="mt-1">${emailBadge(w)}</div>
            </div>
          </div>
          <div class="winner-actions">
            ${w.status === "pending" ? `<button class="btn btn-sm btn-success w-confirm"><i class="li icon-check"></i> Xác nhận${state.settings.autoEmail && w.email ? " &amp; gửi mail" : ""}</button>` : ""}
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary dropdown-toggle" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' ${w.email ? "" : "disabled"}>
                <i class="li icon-mail"></i> Gửi email
              </button>
              <ul class="dropdown-menu">
                <li><a class="dropdown-item w-send" data-type="win" href="#" ${w.status === "cancelled" ? 'aria-disabled="true"' : ""}>🎉 Thông báo trúng thưởng</a></li>
                <li><a class="dropdown-item w-send" data-type="cancel" href="#">🙏 Thông báo huỷ và xin lỗi</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item w-preview" data-type="win" href="#"><i class="li icon-eye"></i> Xem trước email trúng</a></li>
                <li><a class="dropdown-item w-preview" data-type="cancel" href="#"><i class="li icon-eye"></i> Xem trước email xin lỗi</a></li>
              </ul>
            </div>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-dark dropdown-toggle" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-label="Thao tác khác"><i class="li icon-ellipsis"></i></button>
              <ul class="dropdown-menu dropdown-menu-end">
                ${w.status !== "cancelled" ? '<li><a class="dropdown-item w-cancel" href="#"><i class="li icon-circle-x"></i> Huỷ kết quả (không gửi mail)</a></li>' : ""}
                <li><a class="dropdown-item w-restore" href="#"><i class="li icon-rotate-ccw"></i> Trả về danh sách tham dự</a></li>
                <li><a class="dropdown-item text-danger w-delete" href="#"><i class="li icon-trash-2"></i> Xoá hẳn</a></li>
              </ul>
            </div>
          </div>
        </div>`;
        })
        .join("")
    );
  }

  $("#winner-filter").on("change", () => state && renderWinners());

  const winnerById = (el) => state.winners.find((w) => w.id === $(el).closest(".winner-card").data("id"));

  $("#winners-list")
    .on("click", ".w-confirm", async function () {
      const w = winnerById(this);
      await run("confirmWinner", { id: w.id }, (res) =>
        res.email ? (res.email.ok ? `Đã xác nhận và gửi email cho ${w.name}` : `Đã xác nhận, nhưng gửi email lỗi: ${res.email.error}`) : `Đã xác nhận ${w.name}`
      );
    })
    .on("click", ".w-send", async function (e) {
      e.preventDefault();
      if ($(this).attr("aria-disabled")) return showToast("Kết quả đã huỷ, không gửi thông báo trúng thưởng", "warning");
      const w = winnerById(this);
      const type = $(this).data("type");
      const isCancel = type === "cancel";
      const prev = w.emails.filter((x) => x.ok && x.type === type).length;
      const ok = await confirmDialog({
        title: isCancel ? "Gửi thư huỷ và xin lỗi" : "Gửi thông báo trúng thưởng",
        html: `Gửi tới <strong>${esc(w.name)}</strong> &lt;${esc(w.email)}&gt;?` +
          (isCancel ? '<div class="alert alert-warning small mt-2 mb-0">Kết quả trúng của người này sẽ chuyển sang <strong>Đã huỷ</strong> và giải được trả lại.</div>' : "") +
          (prev ? `<div class="small text-danger mt-2">Lưu ý: đã gửi email loại này ${prev} lần trước đó.</div>` : ""),
        buttons: [{ value: true, label: "Gửi email", cls: isCancel ? "btn-warning" : "btn-return" }],
      });
      if (ok) run("sendWinnerEmail", { id: w.id, type }, `Đã gửi email tới ${w.email}`);
    })
    .on("click", ".w-preview", async function (e) {
      e.preventDefault();
      const w = winnerById(this);
      const res = await run("previewEmail", { type: $(this).data("type"), winnerId: w.id }, null, { quiet: true });
      if (res) showPreview(res.email);
    })
    .on("click", ".w-cancel", async function (e) {
      e.preventDefault();
      const w = winnerById(this);
      const ok = await confirmDialog({
        title: "Huỷ kết quả",
        html: `Huỷ kết quả của <strong>${esc(w.name)}</strong> mà không gửi email? Giải được trả lại để quay tiếp.`,
        buttons: [{ value: true, label: "Huỷ kết quả", cls: "btn-warning" }],
      });
      if (ok) run("cancelWinner", { id: w.id }, "Đã huỷ kết quả");
    })
    .on("click", ".w-restore", async function (e) {
      e.preventDefault();
      const w = winnerById(this);
      const ok = await confirmDialog({
        title: "Trả về danh sách tham dự",
        html: `Xoá kết quả của <strong>${esc(w.name)}</strong> và cho người này tham gia các lượt quay sau?`,
        buttons: [{ value: true, label: "Trả về", cls: "btn-return" }],
      });
      if (ok) run("restoreWinner", { id: w.id }, `${w.name} đã quay lại danh sách tham dự`);
    })
    .on("click", ".w-delete", async function (e) {
      e.preventDefault();
      const w = winnerById(this);
      const ok = await confirmDialog({
        title: "Xoá hẳn",
        html: `Xoá <strong>${esc(w.name)}</strong> khỏi cả danh sách trúng thưởng và danh sách tham dự?`,
        buttons: [{ value: true, label: "Xoá", cls: "btn-danger" }],
      });
      if (ok) run("deleteWinner", { id: w.id }, "Đã xoá");
    });

  $("#confirm-all").on("click", async function () {
    const pending = state.winners.filter((w) => w.status === "pending");
    const withMail = state.settings.autoEmail ? pending.filter((w) => w.email).length : 0;
    const ok = await confirmDialog({
      title: "Xác nhận tất cả",
      html: `Xác nhận <strong>${pending.length}</strong> người trúng?` + (withMail ? ` Sẽ gửi <strong>${withMail}</strong> email thông báo.` : ""),
      buttons: [{ value: true, label: "Xác nhận tất cả", cls: "btn-success" }],
    });
    if (!ok) return;
    loading(true);
    let sent = 0, failed = 0;
    for (const w of pending) {
      try {
        const res = await Api.action("confirmWinner", { id: w.id });
        if (res.email) res.email.ok ? sent++ : failed++;
        setState(res.state);
      } catch (e) {
        failed++;
      }
    }
    loading(false);
    showToast(`Đã xác nhận ${pending.length} người` + (sent || failed ? ` · gửi email: ${sent} thành công, ${failed} lỗi` : ""), failed ? "warning" : "success");
  });

  $("#clear-winners").on("click", async function () {
    if (!state.winners.length) return showToast("Chưa có người trúng thưởng", "info");
    const mode = await confirmDialog({
      title: "Xoá tất cả người trúng thưởng",
      html: `Có <strong>${state.winners.length}</strong> kết quả. Bạn muốn:`,
      buttons: [
        { value: "restore", label: "Trả tất cả về danh sách tham dự", cls: "btn-return" },
        { value: "delete", label: "Xoá hẳn", cls: "btn-danger" },
      ],
    });
    if (mode) run("clearWinners", { mode }, mode === "restore" ? "Đã trả tất cả về danh sách tham dự" : "Đã xoá tất cả người trúng");
  });

  $("#export-winners").on("click", function () {
    const status = { pending: "Chờ xác nhận", confirmed: "Đã xác nhận", cancelled: "Đã huỷ" };
    const rows = [["Lượt", "Họ tên", "Email", "Giải", "Mã giảm giá", "Trạng thái", "Thời gian trúng", "Email đã gửi"]];
    state.winners.forEach((w, i) =>
      rows.push([
        i + 1, w.name, w.email, w.prize ? w.prize.name : "", w.code, status[w.status],
        new Date(w.wonAt).toLocaleString("vi-VN"),
        w.emails.filter((e) => e.ok).map((e) => (e.type === "cancel" ? "Xin lỗi" : "Trúng thưởng")).join(", "),
      ])
    );
    const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "danh-sach-trung-thuong.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  function showPreview(email) {
    $("#preview-subject").text(email.subject);
    document.getElementById("preview-frame").srcdoc = email.html;
    bootstrap.Modal.getOrCreateInstance(document.getElementById("previewModal")).show();
  }

  // ==================== GIẢI THƯỞNG ====================
  function renderPrizes() {
    const list = $("#prizes-list");
    if (!state.prizes.length) {
      list.html('<div class="col-12 text-center text-muted py-4">Chưa có giải nào. Bấm <strong>Thêm giải</strong> để tạo.</div>');
      return;
    }
    list.html(
      state.prizes
        .map((p, i) => {
          const current = p.id === state.currentPrizeId;
          const left = p.remaining === null ? "Không giới hạn" : `Còn <strong>${p.remaining}</strong>/${p.quantity}`;
          const typeLabel = p.type === "code"
            ? `<span class="badge text-bg-info"><i class="li icon-ticket"></i> Mã giảm giá${p.discountText ? " " + esc(p.discountText) : ""}</span>`
            : '<span class="badge text-bg-light border"><i class="li icon-gift"></i> Hiện vật</span>';
          const codeInfo = p.type === "code"
            ? `<div class="small text-muted">${p.codeMode === "fixed" ? `Mã chung: <code>${esc(p.codeFixed)}</code>` : `Mã riêng: <code>${esc(p.codePrefix)}${"X".repeat(p.codeLength)}</code>`}</div>`
            : "";
          return `
          <div class="col-md-6 col-xl-4">
            <div class="prize-card-admin ${current ? "current" : ""}" data-id="${esc(p.id)}">
              <div class="d-flex gap-3">
                <div class="prize-thumb">${p.imageId ? `<img src="${Api.imageUrl(p.imageId)}" alt="">` : '<i class="li icon-gift"></i>'}</div>
                <div class="flex-grow-1 min-w-0">
                  <div class="fw-bold">${esc(p.name)}</div>
                  <div class="small">${left}</div>
                  <div class="mt-1">${typeLabel}</div>
                  ${codeInfo}
                </div>
              </div>
              <div class="d-flex gap-1 mt-3 flex-wrap">
                ${current ? '<span class="badge text-bg-success align-self-center me-auto"><i class="li icon-target"></i> Đang quay</span>' : '<button class="btn btn-sm btn-outline-success me-auto p-set-current">Quay giải này</button>'}
                <button class="btn btn-sm btn-light p-move" data-dir="up" ${i === 0 ? "disabled" : ""} title="Lên"><i class="li icon-arrow-up"></i></button>
                <button class="btn btn-sm btn-light p-move" data-dir="down" ${i === state.prizes.length - 1 ? "disabled" : ""} title="Xuống"><i class="li icon-arrow-down"></i></button>
                <button class="btn btn-sm btn-light p-edit" title="Sửa"><i class="li icon-pencil"></i></button>
                <button class="btn btn-sm btn-light text-danger p-delete" title="Xoá"><i class="li icon-trash-2"></i></button>
              </div>
            </div>
          </div>`;
        })
        .join("")
    );
  }

  const prizeOf = (el) => state.prizes.find((p) => p.id === $(el).closest(".prize-card-admin").data("id"));

  $("#prizes-list")
    .on("click", ".p-set-current", function () {
      const p = prizeOf(this);
      run("setCurrentPrize", { id: p.id }, `Đang quay: ${p.name}`);
    })
    .on("click", ".p-move", function () {
      run("movePrize", { id: prizeOf(this).id, direction: $(this).data("dir") }, null);
    })
    .on("click", ".p-edit", function () {
      openPrizeModal(prizeOf(this));
    })
    .on("click", ".p-delete", async function () {
      const p = prizeOf(this);
      const ok = await confirmDialog({
        title: "Xoá giải",
        html: `Xoá giải <strong>${esc(p.name)}</strong>? Người đã trúng giải này vẫn giữ nguyên kết quả.`,
        buttons: [{ value: true, label: "Xoá", cls: "btn-danger" }],
      });
      if (ok) run("deletePrize", { id: p.id }, "Đã xoá giải");
    });

  let prizeImageId = null;

  $("#add-prize").on("click", () => openPrizeModal(null));

  function openPrizeModal(p) {
    $("#prize-modal-title").text(p ? "Sửa giải" : "Thêm giải");
    $("#prize-id").val(p ? p.id : "");
    $("#prize-name").val(p ? p.name : "");
    $("#prize-quantity").val(p ? p.quantity : 1);
    $("#prize-description").val(p ? p.description : "");
    $(`input[name=prize-type][value=${p ? p.type : "gift"}]`).prop("checked", true);
    $("#prize-discount").val(p ? p.discountText : "");
    $(`input[name=code-mode][value=${p ? p.codeMode : "random"}]`).prop("checked", true);
    $("#prize-code-prefix").val(p ? p.codePrefix : "");
    $("#prize-code-length").val(p ? p.codeLength : 6);
    $("#prize-code-fixed").val(p ? p.codeFixed : "");
    prizeImageId = p ? p.imageId : null;
    updatePrizeForm();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("prizeModal")).show();
  }

  function updatePrizeForm() {
    const isCode = $("input[name=prize-type]:checked").val() === "code";
    const fixed = $("input[name=code-mode]:checked").val() === "fixed";
    $("#prize-code-fields").toggleClass("d-none", !isCode);
    $(".code-random").toggleClass("d-none", fixed);
    $(".code-fixed").toggleClass("d-none", !fixed);
    const len = Math.max(4, Math.min(12, parseInt($("#prize-code-length").val(), 10) || 6));
    $("#prize-code-example").text(($("#prize-code-prefix").val() || "").replace(/\s/g, "") + "K7M2QX9PWR4H".slice(0, len));
    $("#prize-image-preview").attr("src", prizeImageId ? Api.imageUrl(prizeImageId) : "").toggle(!!prizeImageId);
    $("#prize-no-image").toggle(!prizeImageId);
    $("#prize-image-remove").prop("disabled", !prizeImageId);
  }

  $("#prize-form").on("input change", "input", updatePrizeForm);
  $("#prize-image-btn").on("click", () => $("#prize-image-input").val("").trigger("click"));
  $("#prize-image-remove").on("click", () => {
    prizeImageId = null;
    updatePrizeForm();
  });

  $("#prize-image-input").on("change", async function () {
    const file = this.files && this.files[0];
    if (!file) return;
    loading(true);
    try {
      const blob = await Api.prepareImage(file, { maxWidth: 800, maxHeight: 800 });
      const res = await Api.uploadImage(blob);
      prizeImageId = res.id;
      updatePrizeForm();
    } catch (e) {
      showToast(e.message, "danger");
    } finally {
      loading(false);
    }
  });

  $("#prize-form").on("submit", async function (e) {
    e.preventDefault();
    const prize = {
      id: $("#prize-id").val() || undefined,
      name: $("#prize-name").val(),
      quantity: $("#prize-quantity").val(),
      description: $("#prize-description").val(),
      type: $("input[name=prize-type]:checked").val(),
      imageId: prizeImageId,
      discountText: $("#prize-discount").val(),
      codeMode: $("input[name=code-mode]:checked").val(),
      codePrefix: $("#prize-code-prefix").val(),
      codeLength: $("#prize-code-length").val(),
      codeFixed: $("#prize-code-fixed").val(),
    };
    const res = await run("savePrize", { prize }, prize.id ? "Đã cập nhật giải" : "Đã thêm giải");
    if (res) bootstrap.Modal.getInstance(document.getElementById("prizeModal")).hide();
  });

  // ==================== EMAIL & GOOGLE SHEET ====================
  function fillSettingsForms() {
    const s = state.settings;
    $("#set-event-name").val(s.eventName);
    $("#set-sender-name").val(s.senderName);
    $("#set-auto-email").prop("checked", s.autoEmail);
    $("#script-url").val(s.scriptUrl);
    for (const type of ["win", "cancel"]) {
      $(`#tpl-${type}-subject`).val(s.templates[type].subject);
      $(`#tpl-${type}-body`).val(s.templates[type].body);
    }
  }

  function renderScriptStatus() {
    const badge = $("#script-status");
    if (state.settings.scriptUrl) badge.attr("class", "badge text-bg-success").text("Đã có URL");
    else badge.attr("class", "badge text-bg-warning").text("Chưa kết nối");
  }

  let appsScriptTemplate = null;
  async function renderAppsScriptCode() {
    if (appsScriptTemplate === null) {
      appsScriptTemplate = "";
      try {
        const res = await fetch("/apps-script/Code.gs", { cache: "no-cache" });
        appsScriptTemplate = await res.text();
      } catch (e) {
        appsScriptTemplate = "// Không tải được code. Tải lại trang để thử lại.";
      }
    }
    if (appsScriptTemplate) $("#apps-script-code").text(appsScriptCode());
  }

  function appsScriptCode() {
    return (appsScriptTemplate || "").replace("{{SECRET}}", state.settings.secret);
  }

  $("#copy-apps-script").on("click", function () {
    copyText(appsScriptCode(), $(this), '<i class="li icon-clipboard"></i> Sao chép code');
  });

  function copyText(text, btn, originalHtml) {
    const done = () => {
      if (btn) {
        btn.html('<i class="li icon-check"></i> Đã sao chép');
        setTimeout(() => btn.html(originalHtml), 2000);
      } else showToast("Đã sao chép", "success");
    };
    const fallback = () => {
      const ta = $("<textarea>").val(text).css({ position: "fixed", opacity: 0 }).appendTo("body");
      ta[0].select();
      try {
        document.execCommand("copy");
        done();
      } catch (e) {
        showToast("Không sao chép được, hãy bôi đen và nhấn Ctrl+C", "warning");
      }
      ta.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  $("#settings-form").on("submit", function (e) {
    e.preventDefault();
    run(
      "saveSettings",
      { settings: { eventName: $("#set-event-name").val(), senderName: $("#set-sender-name").val(), autoEmail: $("#set-auto-email").prop("checked") } },
      "Đã lưu cài đặt"
    );
  });

  $("#save-script-url").on("click", () =>
    run("saveSettings", { settings: { scriptUrl: $("#script-url").val() } }, "Đã lưu URL Apps Script").then((res) => {
      if (res) $("#script-url").val(res.state.settings.scriptUrl);
    })
  );

  $("#test-script").on("click", async () => {
    // Lưu URL đang nhập (nếu khác) rồi kiểm tra
    if ($("#script-url").val().trim() !== state.settings.scriptUrl) {
      const saved = await run("saveSettings", { settings: { scriptUrl: $("#script-url").val() } }, null);
      if (!saved) return;
    }
    run("testAppsScript", {}, (res) => res.message);
  });

  $("#send-test-email").on("click", () => run("sendTestEmail", { to: $("#test-email-to").val() }, (res) => res.message));
  $("#sync-sheet").on("click", () => run("syncSheet", {}, (res) => res.message));

  $("#regen-secret").on("click", async () => {
    const ok = await confirmDialog({
      title: "Đổi mã bí mật",
      html: "Sau khi đổi, phải <strong>sao chép lại code</strong> vào Apps Script và <strong>triển khai phiên bản mới</strong>, nếu không sẽ không gửi được email.",
      buttons: [{ value: true, label: "Đổi mã", cls: "btn-danger" }],
    });
    if (ok) run("regenerateSecret", {}, "Đã đổi mã bí mật — nhớ cập nhật lại code Apps Script");
  });

  function templatesFromForm() {
    return {
      win: { subject: $("#tpl-win-subject").val(), body: $("#tpl-win-body").val() },
      cancel: { subject: $("#tpl-cancel-subject").val(), body: $("#tpl-cancel-body").val() },
    };
  }

  $("#save-templates").on("click", () => run("saveSettings", { settings: { templates: templatesFromForm() } }, "Đã lưu mẫu email"));

  $("#preview-template").on("click", async () => {
    const type = $("#tpl-cancel").hasClass("active") ? "cancel" : "win";
    const res = await run("previewEmail", { type, templates: templatesFromForm() }, null, { quiet: true });
    if (res) showPreview(res.email);
  });

  $("#reset-templates").on("click", async () => {
    const ok = await confirmDialog({
      title: "Khôi phục mẫu mặc định",
      html: "Thay cả 2 mẫu email bằng nội dung mặc định?",
      buttons: [{ value: true, label: "Khôi phục", cls: "btn-warning" }],
    });
    if (!ok) return;
    const res = await run("saveSettings", { settings: { resetTemplates: true } }, "Đã khôi phục mẫu mặc định");
    if (res) fillSettingsForms();
  });

  // ==================== GIAO DIỆN ====================
  const IMAGE_SLOTS = {
    background: { label: "Ảnh nền", hint: "Khuyên dùng 1920×1080, JPG hoặc PNG.", opts: { maxWidth: 1920, maxHeight: 1080, opaque: true } },
    title: { label: "Ảnh tiêu đề", hint: "PNG nền trong suốt, khung ngang (vd 3000×1000).", opts: { maxWidth: 2000, maxHeight: 800 } },
    arrow: { label: "Nút mũi tên (giữa vòng quay)", hint: "PNG vuông, nền trong suốt; mũi tên ở chính giữa cạnh trên. Nên cùng kích thước với ảnh vành.", opts: { maxWidth: 1400, maxHeight: 1400 } },
    frame: { label: "Vành vòng quay", hint: "PNG vuông, nền trong suốt, giữa trong suốt để thấy các ô.", opts: { maxWidth: 1400, maxHeight: 1400 } },
  };

  const COLOR_FIELDS = [
    { key: "segment1", label: "Màu ô lẻ" },
    { key: "text1", label: "Chữ trên ô lẻ" },
    { key: "segment2", label: "Màu ô chẵn" },
    { key: "text2", label: "Chữ trên ô chẵn" },
    { key: "center", label: "Vòng tròn ở tâm" },
    { key: "centerText", label: "Chữ ở tâm" },
  ];

  const PRESETS = [
    { name: "Xanh lá (mặc định)", colors: Api.DEFAULT_COLORS },
    { name: "Đỏ Tết", colors: { segment1: "#fff4d6", text1: "#b71c1c", segment2: "#c62828", text2: "#ffe082", center: "#b71c1c", centerText: "#ffe082" } },
    { name: "Xanh dương", colors: { segment1: "#e3f2fd", text1: "#0d47a1", segment2: "#1565c0", text2: "#ffffff", center: "#0d47a1", centerText: "#e3f2fd" } },
    { name: "Tím", colors: { segment1: "#f3e5f5", text1: "#4a148c", segment2: "#6a1b9a", text2: "#ffffff", center: "#4a148c", centerText: "#f3e5f5" } },
    { name: "Cam", colors: { segment1: "#fff3e0", text1: "#e65100", segment2: "#ef6c00", text2: "#ffffff", center: "#e65100", centerText: "#fff3e0" } },
    { name: "Vàng đen", colors: { segment1: "#ffd54f", text1: "#212121", segment2: "#212121", text2: "#ffd54f", center: "#212121", centerText: "#ffd54f" } },
  ];

  let previewColors = null;

  (function buildThemeUi() {
    const images = $("#theme-images");
    Object.keys(IMAGE_SLOTS).forEach((key) => {
      const card = $(`
        <div class="col-6 col-lg-3">
          <div class="theme-image-card" data-key="${key}">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="small fw-semibold"></span>
              <span class="badge bg-success d-none">Đã đổi</span>
            </div>
            <div class="theme-image-preview"><img alt=""></div>
            <div class="small text-muted mb-2 flex-grow-1"></div>
            <input type="file" accept="image/*" class="d-none">
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-return flex-grow-1 theme-upload"><i class="li icon-upload"></i> Chọn ảnh</button>
              <button type="button" class="btn btn-sm btn-outline-dark theme-reset-image" title="Dùng ảnh mặc định"><i class="li icon-rotate-ccw"></i></button>
            </div>
          </div>
        </div>`);
      card.find(".fw-semibold").text(IMAGE_SLOTS[key].label);
      card.find(".text-muted").text(IMAGE_SLOTS[key].hint);
      images.append(card);
    });

    COLOR_FIELDS.forEach((f) => {
      const item = $(`<div class="col-sm-6"><label class="theme-color-item"><input type="color" class="form-control form-control-color"><span></span></label></div>`);
      item.find("input").attr("data-key", f.key);
      item.find("span").text(f.label);
      $("#theme-colors").append(item);
    });

    PRESETS.forEach((preset, i) => {
      const btn = $('<button type="button" class="btn btn-sm btn-outline-secondary theme-preset"><span class="swatch"></span><span class="swatch"></span><span class="name"></span></button>');
      btn.attr("data-index", i);
      btn.find(".swatch").eq(0).css("background", preset.colors.segment1);
      btn.find(".swatch").eq(1).css("background", preset.colors.segment2);
      btn.find(".name").text(preset.name);
      $("#theme-presets").append(btn);
    });
  })();

  function renderThemeImages() {
    const images = state.theme.images;
    Object.keys(IMAGE_SLOTS).forEach((key) => {
      const card = $(`.theme-image-card[data-key="${key}"]`);
      const src = Api.imageUrl(images[key], key);
      if (card.find("img").attr("src") !== src) card.find("img").attr("src", src);
      card.find(".badge").toggleClass("d-none", !images[key]);
      card.find(".theme-reset-image").prop("disabled", !images[key]);
    });
    // Màu: chỉ cập nhật ô chọn màu khi người dùng không đang kéo
    previewColors = Api.colors(state.theme);
    $("#theme-colors input[type=color]").each(function () {
      if (document.activeElement !== this) $(this).val(previewColors[$(this).data("key")]);
    });
    renderColorPreview();
    Api.applyTheme(state.theme); // ảnh nền của chính Dashboard
  }

  $("#theme-images")
    .on("click", ".theme-upload", function () {
      $(this).closest(".theme-image-card").find("input[type=file]").val("").trigger("click");
    })
    .on("change", "input[type=file]", async function () {
      const file = this.files && this.files[0];
      if (!file) return;
      const key = $(this).closest(".theme-image-card").data("key");
      loading(true);
      try {
        const blob = await Api.prepareImage(file, IMAGE_SLOTS[key].opts);
        const up = await Api.uploadImage(blob);
        await run("saveTheme", { images: { [key]: up.id } }, "Đã đổi " + IMAGE_SLOTS[key].label.toLowerCase(), { quiet: true });
      } catch (e) {
        showToast(e.message, "danger");
      } finally {
        loading(false);
      }
    })
    .on("click", ".theme-reset-image", function () {
      const key = $(this).closest(".theme-image-card").data("key");
      run("saveTheme", { images: { [key]: null } }, "Đã dùng lại ảnh mặc định");
    });

  $("#theme-colors")
    .on("input", "input[type=color]", function () {
      previewColors[$(this).data("key")] = $(this).val();
      renderColorPreview();
    })
    .on("change", "input[type=color]", function () {
      run("saveTheme", { colors: { [$(this).data("key")]: $(this).val() } }, null, { quiet: true });
    });

  $("#theme-presets").on("click", ".theme-preset", function () {
    run("saveTheme", { colors: PRESETS[$(this).data("index")].colors }, "Đã áp dụng bảng màu", { quiet: true });
  });

  $("#reset-theme-colors").on("click", () => run("saveTheme", { colors: null }, "Đã dùng màu mặc định", { quiet: true }));

  function renderColorPreview() {
    const c = previewColors;
    const n = 8, cx = 250, cy = 250, r = 240;
    const names = ["Minh Anh", "Bảo Châu", "Gia Huy", "Thu Hà", "Quốc Khánh", "Lan Anh", "Đức Long", "Ngọc Mai"];
    let svg = "";
    for (let i = 0; i < n; i++) {
      const a1 = ((i * 360) / n - 90) * (Math.PI / 180);
      const a2 = (((i + 1) * 360) / n - 90) * (Math.PI / 180);
      svg += `<path d="M ${cx},${cy} L ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} A ${r},${r} 0 0 1 ${cx + r * Math.cos(a2)},${cy + r * Math.sin(a2)} Z" fill="${i % 2 ? c.segment2 : c.segment1}" stroke="rgba(0,0,0,.08)"/>`;
      const ta = (i + 0.5) * (360 / n);
      const tr = (ta - 90) * (Math.PI / 180);
      const tx = cx + r * 0.65 * Math.cos(tr), ty = cy + r * 0.65 * Math.sin(tr);
      svg += `<text x="${tx}" y="${ty}" fill="${i % 2 ? c.text2 : c.text1}" font-size="24" font-weight="600" text-anchor="middle" dominant-baseline="middle" transform="rotate(${ta + 90}, ${tx}, ${ty})">${names[i]}</text>`;
    }
    svg += `<circle cx="${cx}" cy="${cy}" r="40" fill="${c.center}"/><text x="${cx}" y="${cy}" fill="${c.centerText}" font-size="24" font-weight="bold" text-anchor="middle" dominant-baseline="middle">EZ</text>`;
    $("#theme-preview").html(svg);
  }

  // ==================== DỮ LIỆU ====================
  // Dữ liệu của bản cũ (lưu trong trình duyệt)
  let legacy = null;
  try {
    const p = JSON.parse(localStorage.getItem("luckydraw_participants") || "[]");
    const w = JSON.parse(localStorage.getItem("luckydraw_winners") || "[]");
    if (Array.isArray(p) && p.length) legacy = { participants: p, winners: Array.isArray(w) ? w : [] };
  } catch (e) {}
  if (legacy) {
    $("#legacy-card").removeClass("d-none");
    $("#legacy-count").text(legacy.participants.length);
  }

  $("#migrate-legacy").on("click", async function () {
    const res = await run("migrateLegacy", legacy, (r) => `Đã nhập ${r.summary.added} người từ bản cũ`);
    if (res) {
      try {
        localStorage.removeItem("luckydraw_participants");
        localStorage.removeItem("luckydraw_winners");
      } catch (e) {}
      $("#legacy-card").addClass("d-none");
    }
  });

  $("#reset-all-data").on("click", async function () {
    const ok = await confirmDialog({
      title: "Xoá toàn bộ dữ liệu",
      html: `Xoá <strong>tất cả</strong> người tham dự và người trúng thưởng? Không thể hoàn tác.
             <input type="text" class="form-control mt-3" id="reset-confirm-input" placeholder="Gõ XOA để xác nhận">`,
      buttons: [{ value: true, label: "Xoá toàn bộ", cls: "btn-danger" }],
    });
    if (!ok) return;
    const typed = ($("#reset-confirm-input").val() || "").trim().toUpperCase();
    if (typed !== "XOA") return showToast("Chưa gõ XOA, đã huỷ thao tác", "warning");
    run("resetAllData", { confirm: "XOA" }, "Đã xoá toàn bộ người tham dự và người trúng thưởng");
  });

  // ==================== THƯƠNG HIỆU ====================
  const BRAND_IMAGES = {
    faviconId: { label: "Favicon", hint: "Biểu tượng trên tab trình duyệt. Ảnh vuông, PNG, tối thiểu 64×64 (nên 256×256).", opts: { maxWidth: 256, maxHeight: 256, format: "image/png" }, fallback: "/images/favicon.ico" },
    logoId: { label: "Logo", hint: "Hiện ở trang đăng nhập, Dashboard, bảng danh sách và Party. PNG nền trong suốt, khung ngang.", opts: { maxWidth: 800, maxHeight: 400 } },
    shareImageId: { label: "Ảnh chia sẻ", hint: "Hiện khi gửi link qua Zalo / Facebook. Khuyên dùng 1200×630. Để trống sẽ dùng logo.", opts: { maxWidth: 1200, maxHeight: 1200, opaque: true } },
  };
  let brandingFilled = false;

  (function buildBrandImages() {
    Object.keys(BRAND_IMAGES).forEach((key) => {
      const cfg = BRAND_IMAGES[key];
      const card = $(`
        <div class="col-md-4">
          <div class="theme-image-card" data-brand="${key}">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="small fw-semibold"></span>
              <span class="badge bg-success d-none">Đã đổi</span>
            </div>
            <div class="theme-image-preview"><img alt=""><span class="small text-muted no-image">Chưa có</span></div>
            <div class="small text-muted mb-2 flex-grow-1 hint"></div>
            <input type="file" accept="image/*" class="d-none">
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-return flex-grow-1 brand-upload"><i class="li icon-upload"></i> Chọn ảnh</button>
              <button type="button" class="btn btn-sm btn-outline-dark brand-reset" title="Bỏ ảnh"><i class="li icon-rotate-ccw"></i></button>
            </div>
          </div>
        </div>`);
      card.find(".fw-semibold").text(cfg.label);
      card.find(".hint").text(cfg.hint);
      $("#brand-images").append(card);
    });
  })();

  function renderBranding() {
    const b = state.branding;
    if (!brandingFilled) {
      $("#brand-site-name").val(b.siteName);
      $("#brand-description").val(b.description);
      $("#brand-theme-color").val(b.themeColor);
      brandingFilled = true;
    }
    Object.keys(BRAND_IMAGES).forEach((key) => {
      const card = $(`.theme-image-card[data-brand="${key}"]`);
      const src = b[key] ? Api.imageUrl(b[key]) : BRAND_IMAGES[key].fallback || "";
      card.find("img").attr("src", src).toggle(!!src);
      card.find(".no-image").toggle(!src);
      card.find(".badge").toggleClass("d-none", !b[key]);
      card.find(".brand-reset").prop("disabled", !b[key]);
    });
    renderBrandPreview();
  }

  function renderBrandPreview() {
    const b = state.branding;
    const name = $("#brand-site-name").val().trim() || b.siteName;
    const desc = $("#brand-description").val().trim();
    $("#brand-title-sample").text(name);
    $("#brand-desc-count").text($("#brand-description").val().length);
    $("#serp-host").text(location.host);
    $("#serp-favicon").attr("src", b.faviconId ? Api.imageUrl(b.faviconId) : "/images/favicon.ico");
    $("#serp-title").text(name);
    $("#serp-desc").text(desc || "(chưa có mô tả)");
    $("#share-host").text(location.host);
    $("#share-title").text(name);
    $("#share-desc").text(desc);
    const shareId = b.shareImageId || b.logoId;
    const img = $("#share-image");
    if (shareId) img.css("background-image", `url('${Api.imageUrl(shareId)}')`).find("span").hide();
    else img.css("background-image", "").find("span").show();
  }

  $("#brand-site-name, #brand-description").on("input", renderBrandPreview);

  $("#branding-form").on("submit", function (e) {
    e.preventDefault();
    run(
      "saveBranding",
      { branding: { siteName: $("#brand-site-name").val(), description: $("#brand-description").val(), themeColor: $("#brand-theme-color").val() } },
      "Đã lưu thương hiệu — tải lại các trang để thấy thay đổi"
    );
  });

  $("#reset-branding").on("click", async function () {
    const ok = await confirmDialog({
      title: "Khôi phục thương hiệu mặc định",
      html: "Đặt lại tên website, mô tả, màu và bỏ favicon, logo, ảnh chia sẻ đã tải lên?",
      buttons: [{ value: true, label: "Khôi phục", cls: "btn-warning" }],
    });
    if (!ok) return;
    brandingFilled = false;
    run("resetBranding", {}, "Đã khôi phục thương hiệu mặc định");
  });

  $("#brand-images")
    .on("click", ".brand-upload", function () {
      $(this).closest(".theme-image-card").find("input[type=file]").val("").trigger("click");
    })
    .on("change", "input[type=file]", async function () {
      const file = this.files && this.files[0];
      if (!file) return;
      const key = $(this).closest(".theme-image-card").data("brand");
      loading(true);
      try {
        const blob = await Api.prepareImage(file, BRAND_IMAGES[key].opts);
        const up = await Api.uploadImage(blob);
        await run("saveBranding", { branding: { [key]: up.id } }, "Đã cập nhật " + BRAND_IMAGES[key].label.toLowerCase(), { quiet: true });
      } catch (err) {
        showToast(err.message, "danger");
      } finally {
        loading(false);
      }
    })
    .on("click", ".brand-reset", function () {
      const key = $(this).closest(".theme-image-card").data("brand");
      run("saveBranding", { branding: { [key]: null } }, "Đã bỏ " + BRAND_IMAGES[key].label.toLowerCase());
    });

  // ==================== CHẾ ĐỘ PARTY ====================
  let previewAudio = null;

  function renderParty() {
    const party = state.party;

    // Âm thanh: "Mặc định" có sẵn trong web + âm thanh admin tải lên
    const sounds = [{ id: "", name: "Mặc định (có sẵn)", builtin: true }, ...party.sounds];
    $("#party-sounds").html(
      sounds
        .map((s) => {
          const isDefault = (party.defaultSoundId || "") === s.id;
          return `
          <div class="party-sound-row" data-id="${esc(s.id)}">
            <button type="button" class="btn btn-sm btn-light ps-play" title="Nghe thử"><i class="li icon-volume-2"></i></button>
            <div class="name">${esc(s.name)}${s.winId ? ' <span class="badge text-bg-light border">+ âm thanh kết quả</span>' : ""}</div>
            ${isDefault ? '<span class="badge text-bg-success">Mặc định</span>' : '<button type="button" class="btn btn-sm btn-outline-success ps-default">Đặt mặc định</button>'}
            ${s.builtin ? "" : '<button type="button" class="btn btn-sm btn-link text-danger p-1 ps-delete" title="Xoá"><i class="li icon-trash-2"></i></button>'}
          </div>`;
        })
        .join("")
    );

    // Hình nền
    const bgs = [{ id: "", name: "Pastel (có sẵn)", builtin: true }, ...party.backgrounds];
    $("#party-backgrounds").html(
      bgs
        .map((b) => {
          const isDefault = (party.defaultBackgroundId || "") === b.id;
          const style = b.builtin
            ? "background-image:radial-gradient(circle at 20% 10%, #fff7e6 0%, #fdeff4 45%, #eaf4ff 100%)"
            : `background-image:url('${Api.imageUrl(b.imageId)}')`;
          return `
          <div class="col-6">
            <div class="party-tile ${isDefault ? "active" : ""}" data-id="${esc(b.id)}" data-kind="background">
              <div class="party-tile-preview" style="${style}"></div>
              <div class="name">${esc(b.name)}</div>
              <div class="d-flex gap-1">
                ${isDefault ? '<span class="badge text-bg-success align-self-center me-auto">Mặc định</span>' : '<button type="button" class="btn btn-sm btn-outline-success me-auto pt-default">Đặt mặc định</button>'}
                ${b.builtin ? "" : '<button type="button" class="btn btn-sm btn-link text-danger p-1 pt-delete" title="Xoá"><i class="li icon-trash-2"></i></button>'}
              </div>
            </div>
          </div>`;
        })
        .join("")
    );

    // Nút quay
    const defaultBtnSvg = `<svg class="party-default-btn" viewBox="0 0 200 250"><path d="M100 6 C108 30 122 52 140 72 A88 88 0 1 1 60 72 C78 52 92 30 100 6 Z"/><text x="100" y="150"><tspan x="100" dy="-12">Nhấn để</tspan><tspan x="100" dy="34">xoay</tspan></text></svg>`;
    const buttons = [{ id: "", name: "Nhấn để xoay (có sẵn)", builtin: true }, ...party.buttons];
    $("#party-buttons").html(
      buttons
        .map((b) => {
          const active = (party.activeButtonId || "") === b.id;
          return `
          <div class="col-6">
            <div class="party-tile ${active ? "active" : ""}" data-id="${esc(b.id)}" data-kind="button">
              <div class="party-tile-preview">${b.builtin ? defaultBtnSvg : `<img src="${Api.imageUrl(b.imageId)}" alt="">`}</div>
              <div class="name">${esc(b.name)}</div>
              <div class="d-flex gap-1">
                ${active ? '<span class="badge text-bg-success align-self-center me-auto">Đang dùng</span>' : '<button type="button" class="btn btn-sm btn-outline-success me-auto pt-use">Dùng nút này</button>'}
                ${b.builtin ? "" : '<button type="button" class="btn btn-sm btn-link text-danger p-1 pt-delete" title="Xoá"><i class="li icon-trash-2"></i></button>'}
              </div>
            </div>
          </div>`;
        })
        .join("")
    );
  }

  $("#party-sounds")
    .on("click", ".ps-play", function () {
      const id = $(this).closest(".party-sound-row").data("id");
      const s = state.party.sounds.find((x) => x.id === id);
      const url = s ? Api.audioUrl(s.spinId) : "/sound/am-thanh-vong-quay.mp3";
      const wasPlaying = previewAudio && previewAudio.dataset.src === url && !previewAudio.paused;
      if (previewAudio) previewAudio.pause();
      if (wasPlaying) return; // bấm lần 2 = dừng
      previewAudio = new Audio(url);
      previewAudio.dataset.src = url;
      previewAudio.play().catch((e) => showToast("Không phát được âm thanh: " + e.message, "danger"));
    })
    .on("click", ".ps-default", function () {
      run("setPartyDefaults", { defaultSoundId: $(this).closest(".party-sound-row").data("id") || null }, "Đã đặt âm thanh mặc định");
    })
    .on("click", ".ps-delete", async function () {
      const s = state.party.sounds.find((x) => x.id === $(this).closest(".party-sound-row").data("id"));
      const ok = await confirmDialog({
        title: "Xoá âm thanh",
        html: `Xoá âm thanh <strong>${esc(s.name)}</strong>?`,
        buttons: [{ value: true, label: "Xoá", cls: "btn-danger" }],
      });
      if (ok) run("deletePartySound", { id: s.id }, "Đã xoá âm thanh");
    });

  $("#party-sound-form").on("submit", async function (e) {
    e.preventDefault();
    const spinFile = $("#party-sound-spin")[0].files[0];
    const winFile = $("#party-sound-win")[0].files[0];
    if (!spinFile) return showToast("Vui lòng chọn âm thanh khi quay", "warning");
    loading(true);
    try {
      const spin = await Api.uploadAudio(spinFile);
      const win = winFile ? await Api.uploadAudio(winFile) : null;
      const res = await Api.action("savePartySound", {
        sound: { name: $("#party-sound-name").val(), spinId: spin.id, winId: win ? win.id : null },
      });
      setState(res.state);
      this.reset();
      showToast("Đã thêm âm thanh", "success");
    } catch (err) {
      showToast(err.message, "danger");
    } finally {
      loading(false);
    }
  });

  async function addPartyImage(form, kind, nameSel, fileSel, opts) {
    const file = $(fileSel)[0].files[0];
    if (!file) return showToast("Vui lòng chọn ảnh", "warning");
    loading(true);
    try {
      const blob = await Api.prepareImage(file, opts);
      const up = await Api.uploadImage(blob);
      const res = await Api.action("savePartyImage", { kind, item: { name: $(nameSel).val(), imageId: up.id } });
      setState(res.state);
      form.reset();
      showToast(kind === "button" ? "Đã thêm nút quay" : "Đã thêm hình nền", "success");
    } catch (err) {
      showToast(err.message, "danger");
    } finally {
      loading(false);
    }
  }

  $("#party-bg-form").on("submit", function (e) {
    e.preventDefault();
    addPartyImage(this, "background", "#party-bg-name", "#party-bg-file", { maxWidth: 1920, maxHeight: 1920, opaque: true });
  });

  $("#party-button-form").on("submit", function (e) {
    e.preventDefault();
    addPartyImage(this, "button", "#party-button-name", "#party-button-file", { maxWidth: 600, maxHeight: 600 });
  });

  $("#tab-party")
    .on("click", ".pt-default", function () {
      run("setPartyDefaults", { defaultBackgroundId: $(this).closest(".party-tile").data("id") || null }, "Đã đặt hình nền mặc định");
    })
    .on("click", ".pt-use", function () {
      run("setPartyDefaults", { activeButtonId: $(this).closest(".party-tile").data("id") || null }, "Đã đổi nút quay");
    })
    .on("click", ".pt-delete", async function () {
      const tile = $(this).closest(".party-tile");
      const kind = tile.data("kind");
      const list = kind === "button" ? state.party.buttons : state.party.backgrounds;
      const item = list.find((x) => x.id === tile.data("id"));
      const ok = await confirmDialog({
        title: kind === "button" ? "Xoá nút quay" : "Xoá hình nền",
        html: `Xoá <strong>${esc(item.name)}</strong>?`,
        buttons: [{ value: true, label: "Xoá", cls: "btn-danger" }],
      });
      if (ok) run("deletePartyImage", { kind, id: item.id }, "Đã xoá");
    });

  $("#copy-party-link").on("click", () => copyText(location.origin + "/party/", null));

  // ==================== ỦNG HỘ TÁC GIẢ ====================
  const SUPPORT = { bank: "MB", account: "6006101991", name: "THAI DUY KHANG", note: "Ung ho tac gia" };

  function renderSupportQr(amount) {
    const params = new URLSearchParams({ addInfo: SUPPORT.note, accountName: SUPPORT.name });
    if (amount > 0) params.set("amount", String(Math.round(amount)));
    $("#support-qr-error").addClass("d-none");
    $("#support-qr")
      .removeClass("d-none")
      .attr("src", `https://img.vietqr.io/image/${SUPPORT.bank}-${SUPPORT.account}-compact2.png?${params}`);
  }

  $("#support-qr").on("error", function () {
    $(this).addClass("d-none");
    $("#support-qr-error").removeClass("d-none");
  });

  $("#support-amounts").on("click", "button", function () {
    $("#support-amounts button").removeClass("active");
    $(this).addClass("active");
    const amount = $(this).data("amount");
    $("#support-custom").toggleClass("d-none", amount !== "");
    if (amount === "") {
      $("#support-custom-amount").trigger("focus");
      renderSupportQr(Number($("#support-custom-amount").val()) || 0);
    } else {
      renderSupportQr(Number(amount));
    }
  });

  let supportTimer = null;
  $("#support-custom-amount").on("input", function () {
    clearTimeout(supportTimer);
    supportTimer = setTimeout(() => renderSupportQr(Number($(this).val()) || 0), 400);
  });

  $(".support-copy").on("click", function () {
    const btn = $(this);
    copyText(String(btn.data("copy")), null);
    btn.text("Đã chép");
    setTimeout(() => btn.text("Sao chép"), 1500);
  });

  // Chỉ tải mã QR khi mở tab Ủng hộ
  $('[data-bs-target="#tab-support"]').on("shown.bs.tab", function () {
    if (!$("#support-qr").attr("src")) renderSupportQr(30000);
  });

  // ==================== THANH TRÊN ====================
  $("#copy-board-link").on("click", function () {
    copyText(location.origin + "/bang-danh-sach/", null);
  });

  $("#logout").on("click", async function () {
    try {
      await Api.logout();
    } catch (e) {}
    location.href = "/login";
  });

  // Mở đúng tab khi tải lại trang (#tab-prizes ...)
  if (/^#tab-[a-z]+$/.test(location.hash) && $(`[data-bs-target="${location.hash}"]`).length) {
    bootstrap.Tab.getOrCreateInstance($(`[data-bs-target="${location.hash}"]`)[0]).show();
  }
  $(".admin-tabs [data-bs-toggle=pill]").on("shown.bs.tab", function () {
    history.replaceState(null, "", $(this).data("bs-target"));
  });

  // ==================== KHỞI ĐỘNG ====================
  refresh();
  Api.live(refresh);
  // Cập nhật nhãn "Đang quay" khi tới giờ công bố
  setInterval(() => {
    if (state && state.winners.some((w) => (w.revealAt || 0) > Date.now() - 2000)) refresh();
  }, 5000);
});
