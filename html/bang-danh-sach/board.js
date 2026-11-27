// Bảng danh sách công khai: chỉ đọc, tự cập nhật khi có thay đổi.
(function () {
  const Api = window.LuckyApi;
  const esc = Api.escapeHtml;
  let state = null;
  let revealTimer = null;
  let knownWinnerIds = null;

  const $ = (id) => document.getElementById(id);

  async function refresh() {
    try {
      state = await Api.publicState();
      setStatus("");
      render();
      scheduleReveal();
    } catch (e) {
      setStatus("Đang kết nối lại…");
    }
  }

  // Người trúng được công bố khi vòng quay dừng -> tải lại đúng lúc đó
  function scheduleReveal() {
    clearTimeout(revealTimer);
    if (!state.nextRevealAt) return;
    const wait = Math.max(200, state.nextRevealAt - state.serverTime + 300);
    revealTimer = setTimeout(refresh, wait);
  }

  function setStatus(text) {
    $("status").textContent = text;
    $("status").style.display = text ? "block" : "none";
  }

  function render() {
    Api.applyTheme(state.theme);
    renderWinners();
    renderParticipants();
  }

  function renderWinners() {
    const winners = state.winners.slice().sort((a, b) => a.wonAt - b.wonAt);
    $("winner-count").textContent = winners.length;

    const isNew = (w) => knownWinnerIds && !knownWinnerIds.has(w.id);
    const winnerItem = (w, i) =>
      `<li class="${isNew(w) ? "new" : ""}"><span class="num">${i + 1}</span><span class="name">${esc(w.name)}</span></li>`;

    // Nhóm theo giải (theo thứ tự giải trong Dashboard), người không có giải ở cuối
    let html = "";
    for (const prize of state.prizes) {
      const list = winners.filter((w) => w.prizeId === prize.id);
      const left = prize.remaining === null ? "" : `<span class="left">${list.length}/${prize.quantity}</span>`;
      html += `
        <div class="prize-group">
          <div class="prize-group-header">
            ${prize.imageId ? `<img src="${Api.imageUrl(prize.imageId)}" alt="">` : `<i class="li icon-gift"></i>`}
            <div class="prize-group-name">${esc(prize.name)}</div>
            ${left}
          </div>
          ${list.length ? `<ol class="winner-list">${list.map(winnerItem).join("")}</ol>` : `<div class="empty small">Chưa có người trúng</div>`}
        </div>`;
    }
    const known = new Set(state.prizes.map((p) => p.id));
    const others = winners.filter((w) => !w.prizeId || !known.has(w.prizeId));
    if (others.length) {
      html += `
        <div class="prize-group">
          ${state.prizes.length ? `<div class="prize-group-header"><i class="li icon-star"></i><div class="prize-group-name">Giải khác</div></div>` : ""}
          <ol class="winner-list">${others.map(winnerItem).join("")}</ol>
        </div>`;
    }
    if (!html) html = `<div class="empty">Chưa có người trúng thưởng</div>`;
    const firstRender = knownWinnerIds === null;
    $("winners").innerHTML = html;
    knownWinnerIds = new Set(winners.map((w) => w.id));
    animateWinners(firstRender);
  }

  // GSAP: lần đầu các nhóm giải trượt vào; người trúng mới bật lên, sáng vàng rồi dịu lại
  function animateWinners(firstRender) {
    if (!window.gsap) return;
    if (firstRender) {
      gsap.from("#winners .prize-group", { y: 24, autoAlpha: 0, duration: 0.5, stagger: 0.08, ease: "power2.out", clearProps: "all" });
      return;
    }
    const fresh = document.querySelectorAll("#winners li.new");
    if (!fresh.length) return;
    const box = $("winners");
    const first = fresh[0];
    gsap.to(box, { scrollTop: Math.max(0, first.offsetTop - box.clientHeight / 3), duration: 0.8, ease: "power2.inOut" });
    gsap.timeline()
      .fromTo(fresh, { scale: 0.4, autoAlpha: 0 }, { scale: 1.12, autoAlpha: 1, duration: 0.45, ease: "back.out(2.6)", stagger: 0.12 })
      .to(fresh, { scale: 1, duration: 0.35, ease: "power2.out" })
      .fromTo(fresh, { backgroundColor: "#ffc107", boxShadow: "0 0 0 6px rgba(255,193,7,.45)" },
        { backgroundColor: "#f6fbf8", boxShadow: "0 0 0 0 rgba(255,193,7,0)", duration: 2.2, ease: "power1.out", clearProps: "backgroundColor,boxShadow,transform" }, "<");
    fresh.forEach((li) => gsap.fromTo(li.querySelector(".num"), { rotation: -360 }, { rotation: 0, duration: 0.8, ease: "back.out(1.6)" }));
  }

  function renderParticipants() {
    const q = $("search").value.trim().toLowerCase();
    const all = state.participants;
    const list = q ? all.filter((p) => p.name.toLowerCase().includes(q)) : all;
    $("participant-count").textContent = all.length;
    $("participants").innerHTML = list.length
      ? `<ol class="participant-grid">${list.map((p) => `<li>${esc(p.name)}</li>`).join("")}</ol>`
      : `<div class="empty">${q ? "Không tìm thấy" : "Chưa có người tham dự"}</div>`;
  }

  $("search").addEventListener("input", () => state && renderParticipants());

  // Tự cuộn chậm khi danh sách dài hơn màn hình: tới cuối dừng 3s rồi về đầu.
  // Tạm dừng khi rê chuột, chạm vào hoặc đang tìm kiếm.
  function autoScroll(el) {
    let pauseUntil = Date.now() + 3000;
    let hover = false;
    el.addEventListener("mouseenter", () => (hover = true));
    el.addEventListener("mouseleave", () => (hover = false));
    el.addEventListener("touchstart", () => (pauseUntil = Date.now() + 15000), { passive: true });
    setInterval(() => {
      if (hover || Date.now() < pauseUntil || $("search").value) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      if (el.scrollTop >= max - 1) {
        pauseUntil = Date.now() + 6000;
        setTimeout(() => {
          if (window.gsap) gsap.to(el, { scrollTop: 0, duration: 1.2, ease: "power2.inOut" });
          else el.scrollTop = 0;
        }, 3000);
        return;
      }
      el.scrollTop += 1;
    }, 40);
  }
  document.querySelectorAll(".auto-scroll").forEach(autoScroll);

  refresh();
  Api.live(refresh);
})();
