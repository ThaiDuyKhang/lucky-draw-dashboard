$(document).ready(function () {
  // URL của Google Apps Script
  const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxHlSw5shW4jgx6mg-cFBBQHSHsOlChY6CBC5fIgBqko097XNjlo7D86l5qjNtgQZMP/exec";

  let participants = [];
  let winners = [];

  // Initialize
  loadDataFromLocalStorage();
  renderParticipants();
  renderWinners();

  // Event Handlers
  $("#add-participant-form").submit(function (e) {
    e.preventDefault();
    addParticipant();
  });

  // Event delegation for delete buttons
  $("#participants-list").on("click", ".btn-delete", function () {
    const participantId = parseInt($(this).data("id"));
    deleteParticipant(participantId);
  });

  // Event delegation for delete winner buttons
  $("#winners-list").on("click", ".btn-delete-winner", function () {
    const winnerIndex = parseInt($(this).data("index"));
    deleteWinner(winnerIndex);
  });

  $("#clear-all-participants").click(function () {
    if (confirm("Bạn có chắc muốn xóa tất cả người tham dự ?")) {
      clearAllParticipants();
    }
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
      id: Date.now(),
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

  function deleteParticipant(id) {
    if (confirm("Bạn có chắc muốn xóa người này ?")) {
      const participant = participants.find((p) => p.id === id);
      participants = participants.filter((p) => p.id !== id);
      saveDataToLocalStorage();
      renderParticipants();
      showToast("Đã xóa: " + participant.name, "info");
    }
  }

  function deleteWinner(index) {
    const winner = winners[index];

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

  function importCSV(file) {
    // Check file type
    if (!file.name.endsWith(".csv")) {
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

      lines.forEach((line) => {
        let name = line.trim();

        // Remove surrounding quotes if present
        if (
          (name.startsWith('"') && name.endsWith('"')) ||
          (name.startsWith("'") && name.endsWith("'"))
        ) {
          name = name.slice(1, -1);
        }

        // Skip empty lines
        if (name === "") {
          emptyCount++;
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
          id: Date.now() + addedCount, // Ensure unique IDs
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
      if (emptyCount > 0 && emptyCount > 1) {
        // Don't count single trailing newline
        message += `, ${emptyCount - 1} dòng trống`;
      }

      const toastType = addedCount > 0 ? "success" : "warning";
      showToast(message, toastType);
    };

    reader.onerror = function () {
      showToast("Lỗi khi đọc file CSV", "danger");
    };

    reader.readAsText(file, "UTF-8");
  }

  function clearAllParticipants() {
    participants = [];
    saveDataToLocalStorage();
    renderParticipants();
    showToast("Đã xóa tất cả người tham dự", "info");
  }

  function clearAllWinners() {
    winners = [];
    saveDataToLocalStorage();
    renderWinners();
    showToast("Đã xóa tất cả người trúng thưởng", "info");
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
      // const winTime = new Date(winner.winTime);
      // const timeStr = formatDateTime(winTime);

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
    showLoading(true);

    const data = {
      action: "sync",
      participants: participants,
      winners: winners,
    };

    fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(data),
      mode: "no-cors",
    })
      .then(() => {
        showLoading(false);
        showToast("Đã đồng bộ dữ liệu lên Google Sheets", "success");
      })
      .catch((error) => {
        showLoading(false);
        console.error("Sync error:", error);
        showToast("Không thể đồng bộ. Dữ liệu vẫn được lưu cục bộ.", "warning");
      });
  }

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
        ? "#28a745"
        : type === "warning"
        ? "#ffc107"
        : type === "danger"
        ? "#dc3545"
        : "#17a2b8";

    const toast = $(`
      <div class="toast-notification" style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
      ">
        ${message}
      </div>
    `);

    $("body").append(toast);

    setTimeout(() => {
      toast.fadeOut(300, function () {
        $(this).remove();
      });
    }, 3000);
  }

  function formatDateTime(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day}/${month}/${year} ${hours}:${minutes}`;
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
