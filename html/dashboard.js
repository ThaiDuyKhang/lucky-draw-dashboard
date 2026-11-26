$(document).ready(function () {
  // URL Web App mặc định của Google Apps Script. Có thể để trống "".
  // URL dán trong hộp thoại "Cài đặt Google Sheet" (lưu ở trình duyệt) được ưu tiên hơn.
  const DEFAULT_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxHlSw5shW4jgx6mg-cFBBQHSHsOlChY6CBC5fIgBqko097XNjlo7D86l5qjNtgQZMP/exec";
  const SCRIPT_URL_KEY = "luckydraw_script_url";
  const SCRIPT_URL_PATTERN =
    /https:\/\/script\.google\.com\/(?:a\/macros\/[^/\s]+|macros)\/s\/[\w-]+\/exec/;

  function getSavedScriptUrl() {
    try {
      return localStorage.getItem(SCRIPT_URL_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function getScriptUrl() {
    return getSavedScriptUrl() || DEFAULT_SCRIPT_URL;
  }

  let participants = [];
  let winners = [];

  // Initialize
  loadDataFromLocalStorage();
  renderParticipants();
  renderWinners();

  // Vòng quay (tab khác) vừa có người trúng -> nạp lại để không ghi đè dữ liệu cũ
  window.addEventListener("storage", function (e) {
    if (e.key !== "luckydraw_participants" && e.key !== "luckydraw_winners") {
      return;
    }
    loadDataFromLocalStorage();
    renderParticipants();
    renderWinners();
  });

  // Event Handlers
  $("#add-participant-form").submit(function (e) {
    e.preventDefault();
    addParticipant();
  });

  // Event delegation for delete buttons
  $("#participants-list").on("click", ".btn-delete", function () {
    const participantId = parseInt($(this).data("id"));
    showDeleteParticipantModal(participantId);
  });

  // Event delegation for delete winner buttons
  $("#winners-list").on("click", ".btn-delete-winner", function () {
    const winnerIndex = parseInt($(this).data("index"));
    deleteWinner(winnerIndex);
  });

  $("#clear-all-participants").click(function () {
    if (participants.filter((p) => p.status === "active").length === 0) {
      showToast("Không có người tham dự nào để xóa", "warning");
      return;
    }

    // Update modal content
    $("#all-participants-count").text(
      participants.filter((p) => p.status === "active").length
    );

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("clearAllParticipantsModal")
    );
    modal.show();
  });

  $("#clear-all-winners").click(function () {
    if (winners.length === 0) {
      showToast("Không có người trúng thưởng nào để xóa", "warning");
      return;
    }

    // Update modal content
    $("#all-winners-count").text(winners.length);

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("clearAllWinnersModal")
    );
    modal.show();
  });

  $("#sync-data").click(function () {
    syncDataToServer();
  });

  // CSV Import handlers
  $("#import-csv-btn").click(function () {
    $("#csv-file-input").click();
  });

  $("#csv-file-input").change(function (e) {
    const file = e.target.files[0];
    if (file) {
      importCSV(file);
    }
    // Reset input so same file can be selected again
    $(this).val("");
  });

  // ==================== CORE FUNCTIONS ====================

  function addParticipant() {
    const name = $("#participant-name").val().trim();
    $("#add-error").text("");

    if (name === "") {
      $("#add-error").text("Vui lòng nhập tên người tham dự");
      return;
    }

    // Check duplicate
    if (participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      $("#add-error").text("Tên này đã tồn tại trong danh sách");
      return;
    }

    const participant = {
      id: generateId(),
      name: name,
      createdDate: new Date().toISOString(),
      status: "active",
    };

    participants.push(participant);
    saveDataToLocalStorage();
    renderParticipants();

    // Reset form
    $("#participant-name").val("");

    // Show success feedback
    showToast("Đã thêm: " + name, "success");
  }

  function showDeleteParticipantModal(id) {
    const participant = participants.find((p) => p.id === id);
    if (!participant) return;

    // Store current participant id for modal actions
    window.currentParticipantId = id;

    // Update modal content
    $("#participant-name-modal").text(participant.name);

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("deleteParticipantModal")
    );
    modal.show();
  }

  function deleteParticipant(id) {
    const participant = participants.find((p) => p.id === id);
    if (!participant) return;
    participants = participants.filter((p) => p.id !== id);
    saveDataToLocalStorage();
    renderParticipants();
    showToast("Đã xóa: " + participant.name, "info");
  }

  function deleteWinner(index) {
    const winner = winners[index];
    if (!winner) return;

    // Store current winner index for modal actions
    window.currentWinnerIndex = index;

    // Update modal content
    $("#winner-name-modal").text(winner.name);

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("deleteWinnerModal")
    );
    modal.show();
  }

  // Modal button handlers
  $("#restore-winner-btn").click(function () {
    const index = window.currentWinnerIndex;
    const winner = winners[index];
    if (!winner) return;

    // Remove from winners list
    winners.splice(index, 1);

    // Find and restore participant to active status
    const participant = participants.find((p) => p.id === winner.id);
    if (participant) {
      participant.status = "active";
    }

    // Save and render
    saveDataToLocalStorage();
    renderWinners();
    renderParticipants();
    showToast("Đã chuyển về danh sách tham dự: " + winner.name, "success");

    // Close modal
    bootstrap.Modal.getInstance(
      document.getElementById("deleteWinnerModal")
    ).hide();
  });

  $("#delete-winner-btn").click(function () {
    const index = window.currentWinnerIndex;
    const winner = winners[index];
    if (!winner) return;

    // Remove from winners list
    winners.splice(index, 1);

    // Also remove from participants completely
    participants = participants.filter((p) => p.id !== winner.id);

    // Save and render
    saveDataToLocalStorage();
    renderWinners();
    renderParticipants();
    showToast("Đã xóa hoàn toàn: " + winner.name, "info");

    // Close modal
    bootstrap.Modal.getInstance(
      document.getElementById("deleteWinnerModal")
    ).hide();
  });

  // Clear all winners modal button handlers
  $("#restore-all-winners-btn").click(function () {
    // Restore all winners to participants
    winners.forEach((winner) => {
      const participant = participants.find((p) => p.id === winner.id);
      if (participant) {
        participant.status = "active";
      }
    });

    // Clear winners list
    winners = [];

    // Save and render
    saveDataToLocalStorage();
    renderWinners();
    renderParticipants();
    showToast("Đã chuyển tất cả về danh sách tham dự", "success");

    // Close modal
    bootstrap.Modal.getInstance(
      document.getElementById("clearAllWinnersModal")
    ).hide();
  });

  $("#delete-all-winners-btn").click(function () {
    // Remove all winners from participants completely
    const winnerIds = winners.map((w) => w.id);
    participants = participants.filter((p) => !winnerIds.includes(p.id));

    // Clear winners list
    winners = [];

    // Save and render
    saveDataToLocalStorage();
    renderWinners();
    renderParticipants();
    showToast("Đã xóa hoàn toàn tất cả người trúng thưởng", "info");

    // Close modal
    bootstrap.Modal.getInstance(
      document.getElementById("clearAllWinnersModal")
    ).hide();
  });

  // Delete participant modal button handlers
  $("#confirm-delete-participant-btn").click(function () {
    const id = window.currentParticipantId;
    deleteParticipant(id);

    // Close modal
    bootstrap.Modal.getInstance(
      document.getElementById("deleteParticipantModal")
    ).hide();
  });

  // Clear all participants modal button handler
  $("#confirm-clear-all-participants-btn").click(function () {
    clearAllParticipants();

    // Close modal
    bootstrap.Modal.getInstance(
      document.getElementById("clearAllParticipantsModal")
    ).hide();
  });

  function importCSV(file) {
    // Check file type
    if (!file.name.toLowerCase().endsWith(".csv")) {
      showToast("Vui lòng chọn file CSV", "danger");
      return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
      const content = e.target.result;
      const lines = content.split(/\r?\n/);

      let addedCount = 0;
      let duplicateCount = 0;
      let emptyCount = 0;

      lines.forEach((line, lineIndex) => {
        // Lấy cột đầu tiên (hỗ trợ file có nhiều cột, phân cách , hoặc ;)
        let name = getFirstCsvColumn(line.replace(/^\uFEFF/, "")).trim();

        // Skip empty lines
        if (name === "") {
          emptyCount++;
          return;
        }

        // Bỏ qua dòng tiêu đề (Tên, Họ tên, Họ và tên, Name...)
        if (lineIndex === 0 && HEADER_NAMES.includes(name.toLowerCase())) {
          return;
        }

        // Check for duplicates (case-insensitive)
        if (
          participants.some((p) => p.name.toLowerCase() === name.toLowerCase())
        ) {
          duplicateCount++;
          return;
        }

        // Add participant
        const participant = {
          id: generateId(),
          name: name,
          createdDate: new Date().toISOString(),
          status: "active",
        };

        participants.push(participant);
        addedCount++;
      });

      // Save and render
      if (addedCount > 0) {
        saveDataToLocalStorage();
        renderParticipants();
      }

      // Show summary
      let message = `Import hoàn tất: ${addedCount} người được thêm`;
      if (duplicateCount > 0) {
        message += `, ${duplicateCount} trùng lặp`;
      }
      const trailingEmpty = lines[lines.length - 1].trim() === "" ? 1 : 0;
      if (emptyCount - trailingEmpty > 0) {
        message += `, ${emptyCount - trailingEmpty} dòng trống`;
      }

      const toastType = addedCount > 0 ? "success" : "warning";
      showToast(message, toastType);
    };

    reader.onerror = function () {
      showToast("Lỗi khi đọc file CSV", "danger");
    };

    reader.readAsText(file, "UTF-8");
  }

  const HEADER_NAMES = ["tên", "ten", "họ tên", "họ và tên", "name", "full name", "fullname"];

  // Lấy giá trị cột đầu tiên của 1 dòng CSV (có xử lý dấu ngoặc kép)
  function getFirstCsvColumn(line) {
    const trimmed = line.trim();
    if (trimmed.startsWith('"')) {
      let value = "";
      for (let i = 1; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (ch === '"') {
          if (trimmed[i + 1] === '"') {
            value += '"';
            i++;
          } else {
            return value;
          }
        } else {
          value += ch;
        }
      }
      return value;
    }
    let value = trimmed.split(/[,;\t]/)[0];
    if (value.startsWith("'") && value.endsWith("'") && value.length > 1) {
      value = value.slice(1, -1);
    }
    return value;
  }

  // ID duy nhất, tăng dần (tránh trùng khi thêm/import nhiều người cùng lúc)
  function generateId() {
    const maxId = participants.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0);
    return Math.max(Date.now(), maxId + 1);
  }

  function clearAllParticipants() {
    // Chỉ xoá những người đang hiển thị (chưa trúng); người đã trúng được giữ
    // lại để còn "Chuyển về danh sách tham dự" từ danh sách trúng thưởng
    participants = participants.filter((p) => p.status !== "active");
    saveDataToLocalStorage();
    renderParticipants();
    showToast("Đã xóa tất cả người tham dự", "info");
  }

  function renderParticipants() {
    const container = $("#participants-list tbody");
    const activeParticipants = participants.filter(
      (p) => p.status === "active"
    );

    $("#participant-count").text(activeParticipants.length);

    if (activeParticipants.length === 0) {
      container.html(`
        <tr>
          <td colspan="3" class="text-center text-muted py-4">
            <p>Chưa có người tham dự</p>
          </td>
        </tr>
      `);
      return;
    }

    let html = "";
    activeParticipants.forEach((participant, index) => {
      html += `
        <tr class="participant-item">
          <td class="participant-id" style="width: 50px;">${index + 1}</td>
          <td class="participant-name">${escapeHtml(participant.name)}</td>
          <td style="width: 80px; text-align: right;">
            <button type="button" class="btn btn-sm btn-outline-danger btn-delete" data-id="${
              participant.id
            }">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
    });

    container.html(html);
  }

  function renderWinners() {
    const container = $("#winners-list");

    $("#winner-count").text(winners.length);

    if (winners.length === 0) {
      container.html(`
        <div class="text-center text-muted py-4">
          <p>Chưa có người trúng thưởng</p>
        </div>
      `);
      return;
    }

    let html = "";
    winners.forEach((winner, index) => {
      html += `
        <div class="winner-item">
          <span class="winner-badge"><i class="bi bi-trophy-fill"></i> #${
            index + 1
          }</span>
          <span class="winner-name">${escapeHtml(winner.name)}</span>
          <button type="button" class="btn btn-sm btn-outline-danger btn-delete-winner" data-index="${index}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      `;
    });

    container.html(html);
  }

  // ==================== DATA PERSISTENCE ====================

  function saveDataToLocalStorage() {
    localStorage.setItem(
      "luckydraw_participants",
      JSON.stringify(participants)
    );
    localStorage.setItem("luckydraw_winners", JSON.stringify(winners));
  }

  function loadDataFromLocalStorage() {
    const savedParticipants = localStorage.getItem("luckydraw_participants");
    const savedWinners = localStorage.getItem("luckydraw_winners");

    if (savedParticipants) {
      try {
        participants = JSON.parse(savedParticipants);
      } catch (e) {
        console.error("Error loading participants:", e);
        participants = [];
      }
    }

    if (savedWinners) {
      try {
        winners = JSON.parse(savedWinners);
      } catch (e) {
        console.error("Error loading winners:", e);
        winners = [];
      }
    }
  }

  function syncDataToServer() {
    const SCRIPT_URL = getScriptUrl();
    if (!SCRIPT_URL) {
      showToast("Chưa cấu hình Google Sheet. Làm theo hướng dẫn để kết nối.", "warning");
      openGsheetSetup();
      return;
    }

    showLoading(true);

    const data = {
      action: "sync",
      participants: participants,
      winners: winners,
    };

    // Gửi dạng text/plain để không phát sinh CORS preflight với Apps Script,
    // nhờ vậy đọc được phản hồi và biết đồng bộ thành công hay thất bại.
    fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
    })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then((result) => {
        showLoading(false);
        if (result && result.success && result.message === "Đã đồng bộ") {
          showToast(
            `Đã đồng bộ lên Google Sheets: ${result.participants} người tham dự, ${result.winners} người trúng`,
            "success"
          );
        } else {
          const reason = (result && result.error) || "Apps Script chưa hỗ trợ action sync";
          showToast("Đồng bộ thất bại: " + reason + ". Xem lại mục Cài đặt Google Sheet.", "danger");
        }
      })
      .catch((error) => {
        showLoading(false);
        console.error("Sync error:", error);
        showToast("Không thể đồng bộ. Dữ liệu vẫn được lưu cục bộ.", "warning");
      });
  }

  // Cho các script khác (theme-settings.js) dùng chung kiểu thông báo
  window.showDashboardToast = showToast;

  // ==================== GOOGLE SHEET SETUP ====================

  $("#apps-script-code").text(window.APPS_SCRIPT_CODE || "// Không tải được gsheet-setup.js");
  renderGsheetStatus();

  $("#open-gsheet-setup").click(openGsheetSetup);

  function openGsheetSetup() {
    $("#gsheet-url-input").val(getSavedScriptUrl());
    setGsheetMessage("");
    renderGsheetStatus();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("gsheetSetupModal")).show();
  }

  function renderGsheetStatus() {
    const saved = getSavedScriptUrl();
    const url = getScriptUrl();
    $("#gsheet-current-url").text(
      url ? url + (saved ? "" : " (mặc định trong code)") : "(chưa cấu hình)"
    );
    $("#clear-gsheet-url").toggleClass("d-none", !saved);
  }

  function setGsheetMessage(text, type) {
    const cls = type === "success" ? "text-success" : type === "danger" ? "text-danger" : "text-muted";
    $("#gsheet-url-message").attr("class", "small mb-2 " + cls).text(text);
  }

  // Chấp nhận dán cả dòng: const SCRIPT_URL = "https://.../exec";
  function readUrlInput() {
    const raw = $("#gsheet-url-input").val().trim();
    const match = raw.match(SCRIPT_URL_PATTERN);
    return match ? match[0] : null;
  }

  $("#save-gsheet-url").click(function () {
    const url = readUrlInput();
    if (!url) {
      setGsheetMessage(
        "URL không hợp lệ. URL đúng có dạng https://script.google.com/macros/s/.../exec",
        "danger"
      );
      return;
    }
    try {
      localStorage.setItem(SCRIPT_URL_KEY, url);
    } catch (e) {
      setGsheetMessage("Trình duyệt không cho lưu dữ liệu (đang ở chế độ ẩn danh?)", "danger");
      return;
    }
    $("#gsheet-url-input").val(url);
    renderGsheetStatus();
    setGsheetMessage("Đã lưu. Bấm Kiểm tra để thử kết nối.", "success");
    showToast("Đã lưu URL Google Sheet", "success");
  });

  $("#test-gsheet-url").click(function () {
    const url = readUrlInput() || getScriptUrl();
    if (!url) {
      setGsheetMessage("Chưa có URL để kiểm tra", "danger");
      return;
    }
    const btn = $(this).prop("disabled", true);
    setGsheetMessage("Đang kiểm tra...");
    fetch(url)
      .then((res) => res.json())
      .then((result) => {
        if (result && result.success && result.message === "Lucky Draw API is running") {
          setGsheetMessage("✔ Kết nối thành công. Có thể bấm Đồng bộ Google Sheet.", "success");
        } else {
          throw new Error("unexpected");
        }
      })
      .catch(() => {
        setGsheetMessage(
          "✘ Không kết nối được. Kiểm tra: đã dán đúng code mới, triển khai dạng Ứng dụng web, quyền truy cập 'Bất kỳ ai'.",
          "danger"
        );
      })
      .finally(() => btn.prop("disabled", false));
  });

  $("#clear-gsheet-url").click(function () {
    try {
      localStorage.removeItem(SCRIPT_URL_KEY);
    } catch (e) {}
    $("#gsheet-url-input").val("");
    renderGsheetStatus();
    setGsheetMessage("Đã xoá URL đã lưu.");
  });

  $("#copy-apps-script").click(function () {
    const code = window.APPS_SCRIPT_CODE || "";
    const btn = $(this);
    const done = () => {
      btn.html('<i class="bi bi-check2"></i> Đã sao chép');
      setTimeout(() => btn.html('<i class="bi bi-clipboard"></i> Sao chép code'), 2000);
    };
    const fallback = () => {
      const ta = $("<textarea>").val(code).css({ position: "fixed", opacity: 0 }).appendTo("body");
      ta[0].select();
      try {
        document.execCommand("copy");
        done();
      } catch (e) {
        showToast("Không sao chép được, hãy bôi đen code và nhấn Ctrl+C", "warning");
      }
      ta.remove();
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code).then(done, fallback);
    } else {
      fallback();
    }
  });

  // ==================== UTILITY FUNCTIONS ====================

  function showLoading(show) {
    if (show) {
      $("#loading-overlay").removeClass("d-none");
    } else {
      $("#loading-overlay").addClass("d-none");
    }
  }

  function showToast(message, type = "info") {
    // Simple toast notification
    const bgColor =
      type === "success"
        ? "#246d4b"
        : type === "warning"
        ? "#ffc107"
        : type === "danger"
        ? "#dc3545"
        : "#246d4b";

    const toast = $(`
      <div class="toast-notification" style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 25px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
      "></div>
    `).text(message); // .text() để tên người dùng không bị hiểu là HTML

    $("body").append(toast);

    setTimeout(() => {
      toast.fadeOut(300, function () {
        $(this).remove();
      });
    }, 3000);
  }

  function escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // Add CSS animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  //Enable Tooltip Bootstrap
  const tooltipTriggerList = document.querySelectorAll(
    '[data-bs-toggle="tooltip"]'
  );
  const tooltipList = [...tooltipTriggerList].map(
    (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
  );
});
