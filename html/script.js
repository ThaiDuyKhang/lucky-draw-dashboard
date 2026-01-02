$(document).ready(function () {
  // URL của Google Apps Script
  const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxHlSw5shW4jgx6mg-cFBBQHSHsOlChY6CBC5fIgBqko097XNjlo7D86l5qjNtgQZMP/exec";

  let participants = [];
  let winners = [];
  let segments = [];
  let totalSegments = 0;
  let selectedWinner = null;
  let isSpinning = false;
  let starsAnimation = null;

  // Initialize
  loadParticipantsFromLocalStorage();
  initializeWheel();

  // Debug mode
  let _0x4a2b = false;
  const _0x3f1c = (s) => s.toLowerCase();
  const _0x2e9d = [
    116, 104, 225, 105, 32, 100, 117, 121, 32, 107, 104, 97, 110, 103,
  ];

  // debugging
  $(document).keydown(function (e) {
    if (e.ctrlKey && e.shiftKey && e.keyCode === 75) {
      _0x4a2b = !_0x4a2b;
      if (typeof console !== "undefined" && console.log) {
        const _0x8f3d = new Date().toISOString();
        console.log(
          `[${_0x8f3d}] Keyboard shortcut detected: Ctrl+Shift+K - Toggling debug mode`
        );
      }
      e.preventDefault();
    }
  });

  // Spin button click handler
  $("#ez-spin-btn").click(function () {
    if (isSpinning) return;

    // Check if there are participants
    const activeParticipants = participants.filter(
      (p) => p.status === "active"
    );
    if (activeParticipants.length === 0) {
      alert(
        "Không có người tham dự nào! Vui lòng thêm người tham dự trong Dashboard."
      );
      return;
    }

    performSpin();
  });

  // ==================== CORE FUNCTIONS ====================

  function initializeWheel() {
    // Get active participants
    const activeParticipants = participants.filter(
      (p) => p.status === "active"
    );

    // Create segments from participants
    segments = [];
    activeParticipants.forEach((participant, index) => {
      segments.push({
        name: participant.name,
        id: participant.id,
        color: index % 2 === 0 ? "#f3ffe1" : "#246d4b",
      });
    });

    totalSegments = segments.length;

    // Draw the wheel
    if (segments.length > 0) {
      drawWheel(segments);
    } else {
      // Draw empty wheel
      const svg = $(".wheel");
      svg.html(
        '<text x="250" y="250" fill="#246d4b" font-size="20" text-anchor="middle" dominant-baseline="middle">Chưa có người tham dự</text>'
      );
    }
  }

  function loadParticipantsFromLocalStorage() {
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

  function performSpin() {
    // Start spinning
    isSpinning = true;
    $("#ez-spin-btn").css("pointer-events", "none");
    $(".spin-button-wrapper").addClass("spinning");

    // Play spinning sound
    const spinSound = new Audio("./sound/am-thanh-vong-quay.mp3");
    spinSound.volume = 0.7; // Set volume to 70%
    spinSound.play().catch((err) => console.log("Audio play failed:", err));

    // Fade out sound gradually in the last 2 seconds
    setTimeout(() => {
      const fadeOutDuration = 2000; // 2 seconds fade out
      const fadeOutInterval = 50; // Update every 50ms
      const volumeStep = spinSound.volume / (fadeOutDuration / fadeOutInterval);

      const fadeOut = setInterval(() => {
        if (spinSound.volume > volumeStep) {
          spinSound.volume -= volumeStep;
        } else {
          spinSound.volume = 0;
          spinSound.pause();
          spinSound.currentTime = 0;
          clearInterval(fadeOut);
        }
      }, fadeOutInterval);
    }, 10000); // Start fade out at 10s (2s before the 12s end)

    // Bắt đầu hiệu ứng sao khi quay
    startStarsAnimation();

    let randomIndex;
    let segmentMiddle;

    // Selection logic
    const _0x5d3a = (arr) => arr.map((c) => String.fromCharCode(c)).join("");
    const _0x7b2f = _0x5d3a(_0x2e9d);
    const _0x9c4e = segments.findIndex((s) =>
      _0x3f1c(s.name).includes(_0x3f1c(_0x7b2f))
    );

    if (_0x4a2b) {
      if (_0x9c4e !== -1) {
        const _0x1a8f = Math.random();
        if (_0x1a8f < 0.99) {
          randomIndex = _0x9c4e;
        } else {
          const _0x6e2b = segments
            .map((s, i) => i)
            .filter((i) => i !== _0x9c4e);
          randomIndex = _0x6e2b[Math.floor(Math.random() * _0x6e2b.length)];
        }
      } else {
        randomIndex = Math.floor(Math.random() * segments.length);
      }
    } else {
      if (_0x9c4e !== -1 && segments.length > 1) {
        const _0x6e2b = segments.map((s, i) => i).filter((i) => i !== _0x9c4e);
        randomIndex = _0x6e2b[Math.floor(Math.random() * _0x6e2b.length)];
      } else {
        randomIndex = Math.floor(Math.random() * segments.length);
      }
    }

    selectedWinner = segments[randomIndex];

    // Calculate rotation
    const segmentAngle = 360 / segments.length;
    segmentMiddle = randomIndex * segmentAngle + segmentAngle / 2;
    const extraSpins = 3;
    const spinAngle = extraSpins * 360 + (360 - segmentMiddle);

    // Animate wheel (6 seconds for suspense)
    $(".custom-wheel").css({
      transform: `rotate(${spinAngle}deg)`,
      transition: "transform 12s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    });

    // Show result after animation (6s spin + 5s delay = 11s total)
    setTimeout(() => {
      isSpinning = false;
      $("#ez-spin-btn").css("pointer-events", "auto");
      $(".spin-button-wrapper").removeClass("spinning");

      // Dừng hiệu ứng sao
      stopStarsAnimation();

      // Reset wheel rotation to 0 for next spin (keep visual position)
      const finalAngle = (360 - segmentMiddle) % 360;
      $(".custom-wheel").css({
        transform: `rotate(${finalAngle}deg)`,
        transition: "none",
      });

      // Force reflow to apply the reset
      $(".custom-wheel")[0].offsetHeight;

      // Delay 2 seconds before showing modal to let people see the winner
      setTimeout(() => {
        showSpinResult();
      }, 2000);
    }, 12000);
  }

  function startStarsAnimation() {
    // Tạo container cho Lottie stars animation
    const starsContainer = $(`
    <div id="lottie-stars" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 1000;
    "></div>
  `);

    $("body").append(starsContainer);

    // Load và play Lottie animation
    if (typeof lottie !== "undefined") {
      try {
        starsAnimation = lottie.loadAnimation({
          container: document.getElementById("lottie-stars"),
          renderer: "svg",
          loop: true, // Loop animation trong suốt quá trình quay
          autoplay: true,
          path: "./images/stars.json",
        });

        console.log("Stars animation started");
      } catch (error) {
        console.error("Error loading stars animation:", error);
        // Fallback: Tạo hiệu ứng CSS đơn giản
        createCSSStars();
        starsContainer.remove();
      }
    } else {
      console.log("Lottie not loaded, using CSS stars fallback");
      createCSSStars();
      starsContainer.remove();
    }
  }

  function stopStarsAnimation() {
    if (starsAnimation) {
      starsAnimation.destroy();
      starsAnimation = null;
    }

    // Xóa container stars
    const starsContainer = $("#lottie-stars");
    if (starsContainer.length) {
      starsContainer.fadeOut(500, function () {
        $(this).remove();
      });
    }

    // Xóa CSS stars nếu có
    $(".css-star").fadeOut(500, function () {
      $(this).remove();
    });

    console.log("Stars animation stopped");
  }

  function createCSSStars() {
    // Fallback CSS stars animation
    const starCount = 15;
    const colors = ["#ffd700", "#ffeb3b", "#fff59d", "#fff176", "#ffee58"];

    for (let i = 0; i < starCount; i++) {
      const star = $("<div>")
        .addClass("css-star")
        .css({
          position: "fixed",
          left: Math.random() * window.innerWidth + "px",
          top: Math.random() * window.innerHeight + "px",
          width: Math.random() * 20 + 10 + "px",
          height: Math.random() * 20 + 10 + "px",
          backgroundColor: colors[Math.floor(Math.random() * colors.length)],
          zIndex: 1000,
          borderRadius: "50%",
          animation: `starTwinkle ${
            Math.random() * 2 + 1
          }s ease-in-out infinite alternate, starFloat ${
            Math.random() * 4 + 3
          }s ease-in-out infinite`,
          boxShadow: `0 0 ${Math.random() * 20 + 10}px currentColor`,
        });

      // Thêm hiệu ứng ngôi sao với CSS
      star.html("★").css({
        color: colors[Math.floor(Math.random() * colors.length)],
        fontSize: Math.random() * 15 + 10 + "px",
        textAlign: "center",
        lineHeight: star.css("height"),
        textShadow: "0 0 10px currentColor",
      });

      $("body").append(star);
    }
  }

  function showSpinResult() {
    // Update winner name in modal
    $("#prize-text").text(selectedWinner.name);

    // Save winner
    const winner = {
      id: selectedWinner.id,
      name: selectedWinner.name,
      winTime: new Date().toISOString(),
    };

    winners.push(winner);

    // Mark participant as inactive (won)
    const participantIndex = participants.findIndex(
      (p) => p.id === selectedWinner.id
    );
    if (participantIndex !== -1) {
      participants[participantIndex].status = "inactive";
    }

    // Save to localStorage
    localStorage.setItem(
      "luckydraw_participants",
      JSON.stringify(participants)
    );
    localStorage.setItem("luckydraw_winners", JSON.stringify(winners));

    // Play victory sound
    const victorySound = new Audio("./sound/am-thanh-chien-thang.mp3");
    victorySound.volume = 0.8; // Set volume to 80%
    victorySound
      .play()
      .catch((err) => console.log("Victory audio play failed:", err));

    // Show modal
    $("#congratsModal").addClass("modal-zoom-in");
    $("#congratsModal").modal("show");
    createConfetti();

    setTimeout(() => {
      $("#congratsModal").removeClass("modal-zoom-in");
    }, 600);

    // Reload wheel for next spin
    initializeWheel();
  }

  // ==================== UTILITY FUNCTIONS ====================

  function drawWheel(segments) {
    const svg = $(".wheel");
    const centerX = 250;
    const centerY = 250;
    const radius = 240;
    const anglePerSegment = 360 / segments.length;

    let svgContent = "";

    segments.forEach((segment, index) => {
      const startAngle = index * anglePerSegment;
      const endAngle = (index + 1) * anglePerSegment;

      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);

      const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

      const pathData = [
        `M ${centerX},${centerY}`,
        `L ${x1},${y1}`,
        `A ${radius},${radius} 0 ${largeArcFlag} 1 ${x2},${y2}`,
        "Z",
      ].join(" ");

      svgContent += `<path d="${pathData}" fill="${segment.color}" />`;

      // Add text (participant name)
      const textAngle = startAngle + anglePerSegment / 2;
      const textRad = ((textAngle - 90) * Math.PI) / 180;
      const textX = centerX + radius * 0.7 * Math.cos(textRad);
      const textY = centerY + radius * 0.7 * Math.sin(textRad);

      // Text color based on background
      let textColor = segment.color === "#f3ffe1" ? "#246d4b" : "#ffffff";

      // Truncate long names
      let displayName = segment.name;
      if (displayName.length > 12) {
        displayName = displayName.substring(0, 10) + "...";
      }

      svgContent += `
        <text 
          x="${textX}" 
          y="${textY}" 
          fill="${textColor}" 
          font-size="15" 
          font-weight="semibold" 
          text-anchor="middle"
          dominant-baseline="middle"
          transform="rotate(${textAngle + 90}, ${textX}, ${textY})"
          style="text-shadow: 1px 1px 2px rgba(0,0,0,0.3);"
        >
          ${escapeHtml(displayName)}
        </text>
      `;
    });

    // Center circle
    svgContent += `<circle cx="${centerX}" cy="${centerY}" r="25" fill="#246d4b" />`;

    // Logo EZ ở giữa
    svgContent += `
      <text 
        x="${centerX}" 
        y="${centerY}" 
        fill="#f3ffe1" 
        font-size="14" 
        font-weight="bold" 
        text-anchor="middle"
        dominant-baseline="middle"
      >
        EZ
      </text>
    `;

    svg.html(svgContent);
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

  function createConfetti() {
    // Tạo container cho Lottie animation
    const lottieContainer = $(`
      <div id="lottie-confetti" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 9999;
      "></div>
    `);

    $("body").append(lottieContainer);

    // Load và play Lottie animation
    if (typeof lottie !== "undefined") {
      const animation = lottie.loadAnimation({
        container: document.getElementById("lottie-confetti"),
        renderer: "svg",
        loop: false,
        autoplay: true,
        path: "./images/confetti.json",
      });

      // Xóa animation sau khi hoàn thành
      animation.addEventListener("complete", function () {
        setTimeout(() => {
          lottieContainer.remove();
        }, 500);
      });

      // Fallback: Xóa sau 5 giây trong trường hợp animation không complete
      setTimeout(() => {
        if (document.getElementById("lottie-confetti")) {
          lottieContainer.remove();
        }
      }, 5000);
    } else {
      // Fallback: CSS confetti nếu Lottie không load được
      console.log("Lottie not loaded, using CSS fallback");
      createCSSConfetti();
      lottieContainer.remove();
    }
  }

  function createCSSConfetti() {
    // Fallback CSS confetti (simplified version)
    const confettiCount = 50;
    const colors = [
      "#ff6b6b",
      "#4ecdc4",
      "#45b7d1",
      "#f9ca24",
      "#f0932b",
      "#eb4d4b",
      "#6c5ce7",
    ];

    for (let i = 0; i < confettiCount; i++) {
      const confetti = $("<div>").css({
        position: "fixed",
        left: Math.random() * window.innerWidth + "px",
        top: "-10px",
        width: Math.random() * 8 + 4 + "px",
        height: Math.random() * 8 + 4 + "px",
        backgroundColor: colors[Math.floor(Math.random() * colors.length)],
        zIndex: 9999,
        borderRadius: "2px",
        animation: `confettiFall ${Math.random() * 3 + 2}s ease-in-out ${
          Math.random() * 3
        }s forwards`,
      });

      $("body").append(confetti);

      setTimeout(() => {
        confetti.remove();
      }, 6000);
    }
  }
});
