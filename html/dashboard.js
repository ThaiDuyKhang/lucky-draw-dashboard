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

  $("#clear-all-participants").click(function () {
    if (confirm("Bạn có chắc muốn xóa tất cả người tham dự?")) {
      clearAllParticipants();
    }
  });

  $("#clear-all-winners").click(function () {
    if (confirm("Bạn có chắc muốn xóa tất cả người trúng thưởng?")) {
      clearAllWinners();
    }
  });

  $("#sync-data").click(function () {
    syncDataToServer();
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
    if (confirm("Bạn có chắc muốn xóa người này?")) {
      const participant = participants.find((p) => p.id === id);
      participants = participants.filter((p) => p.id !== id);
      saveDataToLocalStorage();
      renderParticipants();
      showToast("Đã xóa: " + participant.name, "info");
    }
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
    const container = $("#participants-list");
    const activeParticipants = participants.filter(
      (p) => p.status === "active"
    );

    $("#participant-count").text(activeParticipants.length);

    if (activeParticipants.length === 0) {
      container.html(`
        <div class="text-center text-muted py-4">
          <p>Chưa có người tham dú nào</p>
          <small>Thêm người tham dú để bắt đầu</small>
        </div>
      `);
      return;
    }

    let html = "";
    activeParticipants.forEach((participant, index) => {
      html += `
        <div class="participant-item">
          <span class="participant-id">#${index + 1}</span>
          <span class="participant-name">${escapeHtml(participant.name)}</span>
          <button type="button" class="btn btn-sm btn-outline-danger btn-delete" data-id="${
            participant.id
          }">
            <i class="bi bi-trash"></i>
          </button>
        </div>
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
          <small>Quay vòng quay để chọn người trúng</small>
        </div>
      `);
      return;
    }

    let html = "";
    winners.forEach((winner, index) => {
      const winTime = new Date(winner.winTime);
      const timeStr = formatDateTime(winTime);

      html += `
        <div class="winner-item">
          <span class="winner-badge">#${index + 1}</span>
          <span class="winner-name">${escapeHtml(winner.name)}</span>
          <span class="winner-time">${timeStr}</span>
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
});
