// Durable Object lưu toàn bộ dữ liệu của vòng quay (1 instance duy nhất).
// Mọi thay đổi đi qua đây nên luôn nhất quán; các màn hình đang mở nhận
// thông báo "changed" qua WebSocket để tải lại dữ liệu.
import { DurableObject } from "cloudflare:workers";
import { renderEmail, callAppsScript } from "./email.js";

const STATE_KEY = "state";
const MAX_PARTICIPANTS = 5000;
const MAX_IMAGE_BYTES = 1900 * 1024; // giới hạn 1 giá trị trong storage ~2MB
const MAX_REVEAL_DELAY = 60000;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // âm thanh chế độ Party: tối đa 8MB
const AUDIO_CHUNK = 1024 * 1024; // lưu chia khối 1MB (mỗi giá trị storage tối đa ~2MB)
const ID_RE = /^[a-z0-9]{6,32}$/;

export const DEFAULT_COLORS = {
  segment1: "#f3ffe1",
  text1: "#246d4b",
  segment2: "#246d4b",
  text2: "#ffffff",
  center: "#246d4b",
  centerText: "#f3ffe1",
};

export const DEFAULT_BRANDING = {
  siteName: "Vòng Quay May Mắn",
  description: "Vòng quay may mắn cho sự kiện: quay thưởng công bằng, công bố người trúng và gửi email thông báo.",
  themeColor: "#246d4b",
  faviconId: null,
  logoId: null,
  shareImageId: null,
};

export const DEFAULT_TEMPLATES = {
  win: {
    subject: "🎉 Chúc mừng {ten} đã trúng {giai} - {su_kien}",
    body:
      "Xin chào {ten},\n\n" +
      "Chúc mừng bạn đã trúng {giai} trong chương trình {su_kien}!\n\n" +
      "Mã giảm giá của bạn: {ma}\n" +
      "Ưu đãi: {uu_dai}\n\n" +
      "Chúng tôi sẽ sớm liên hệ để trao thưởng. Cảm ơn bạn đã tham gia!",
  },
  cancel: {
    subject: "Thông báo điều chỉnh kết quả quay thưởng - {su_kien}",
    body:
      "Xin chào {ten},\n\n" +
      "Chúng tôi thành thật xin lỗi: kết quả trúng {giai} trong chương trình {su_kien} " +
      "đã được thông báo đến bạn do nhầm lẫn và nay đã bị huỷ.\n\n" +
      "Rất mong bạn thông cảm cho sự bất tiện này. Cảm ơn bạn đã quan tâm và tham gia chương trình!",
  },
};

function defaultState() {
  return {
    version: 1,
    participants: [],
    winners: [],
    prizes: [],
    currentPrizeId: null,
    theme: {
      colors: { ...DEFAULT_COLORS },
      images: { background: null, title: null, arrow: null, frame: null },
    },
    // Thương hiệu: tên website, mô tả, favicon, logo, ảnh chia sẻ (chèn vào HTML ở worker.js)
    branding: { ...DEFAULT_BRANDING },
    // Chế độ Party: âm thanh / hình nền / nút quay do admin tải lên để người chơi chọn
    party: {
      sounds: [], // { id, name, spinId, winId }
      backgrounds: [], // { id, name, imageId }
      buttons: [], // { id, name, imageId }
      defaultSoundId: null,
      defaultBackgroundId: null,
      activeButtonId: null, // null = nút mặc định "Nhấn để xoay"
    },
    settings: {
      eventName: "Vòng quay may mắn",
      senderName: "",
      scriptUrl: "",
      secret: randomId(24),
      autoEmail: false,
      templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
    },
  };
}

function randomId(len = 10) {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// Số nguyên ngẫu nhiên đều trong [0, max)
function randomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

function randomCode(len) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ ký tự dễ nhầm 0/O, 1/I
  return Array.from(crypto.getRandomValues(new Uint8Array(len)), (b) => alphabet[b % alphabet.length]).join("");
}

function cleanText(value, max = 200) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanMultiline(value, max = 5000) {
  return String(value ?? "").replace(/\r\n/g, "\n").slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function cleanEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  return EMAIL_RE.test(email) ? email : "";
}

function isHexColor(v) {
  return /^#[0-9a-f]{6}$/i.test(v || "");
}

class UserError extends Error {}
function fail(message) {
  throw new UserError(message);
}

export class LuckyDrawStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.state = null;
    this.loginFailures = new Map();
  }

  // ---------- Nạp / lưu ----------
  async load() {
    if (!this.state) {
      const saved = await this.ctx.storage.get(STATE_KEY);
      const base = defaultState();
      this.state = saved
        ? {
            ...base,
            ...saved,
            theme: {
              colors: { ...base.theme.colors, ...(saved.theme?.colors || {}) },
              images: { ...base.theme.images, ...(saved.theme?.images || {}) },
            },
            party: { ...base.party, ...(saved.party || {}) },
            branding: { ...base.branding, ...(saved.branding || {}) },
            settings: {
              ...base.settings,
              ...(saved.settings || {}),
              templates: {
                win: { ...base.settings.templates.win, ...(saved.settings?.templates?.win || {}) },
                cancel: { ...base.settings.templates.cancel, ...(saved.settings?.templates?.cancel || {}) },
              },
            },
          }
        : base;
      if (!saved) await this.ctx.storage.put(STATE_KEY, this.state);
    }
    return this.state;
  }

  async save() {
    this.state.version = (this.state.version || 0) + 1;
    await this.ctx.storage.put(STATE_KEY, this.state);
    this.broadcast();
  }

  broadcast() {
    const msg = JSON.stringify({ type: "changed", version: this.state?.version || 0 });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch (e) {}
    }
  }

  // Người trúng được "công bố" khi vòng quay dừng -> báo các màn hình tải lại đúng lúc
  async alarm() {
    this.broadcast();
    await this.scheduleRevealAlarm();
  }

  async scheduleRevealAlarm() {
    const now = Date.now();
    const next = (this.state?.winners || [])
      .map((w) => w.revealAt || 0)
      .filter((t) => t > now)
      .sort((a, b) => a - b)[0];
    if (next) await this.ctx.storage.setAlarm(next + 50);
  }

  // ---------- WebSocket cập nhật trực tiếp ----------
  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  webSocketMessage(ws, message) {
    if (message === "ping") ws.send("pong");
  }

  webSocketClose(ws, code) {
    try {
      ws.close(code, "bye");
    } catch (e) {}
  }

  // ---------- Đăng nhập: chống dò mật khẩu ----------
  loginAllowed(ip) {
    const rec = this.loginFailures.get(ip);
    if (!rec) return true;
    if (Date.now() > rec.resetAt) {
      this.loginFailures.delete(ip);
      return true;
    }
    return rec.count < 10;
  }

  loginFailed(ip) {
    const now = Date.now();
    const rec = this.loginFailures.get(ip);
    if (!rec || now > rec.resetAt) this.loginFailures.set(ip, { count: 1, resetAt: now + 10 * 60000 });
    else rec.count++;
  }

  // ---------- Dữ liệu cho từng loại màn hình ----------
  prizeRemaining(prize) {
    if (!prize.quantity) return null; // không giới hạn
    const used = this.state.winners.filter((w) => w.prizeId === prize.id && w.status !== "cancelled").length;
    return Math.max(0, prize.quantity - used);
  }

  prizesWithRemaining() {
    return this.state.prizes.map((p) => ({ ...p, remaining: this.prizeRemaining(p) }));
  }

  // Trang công khai: không có email, mã giảm giá, cài đặt; người trúng chỉ hiện sau khi công bố
  async getPublicState() {
    const s = await this.load();
    const now = Date.now();
    const hiddenIds = new Set(
      s.winners.filter((w) => (w.revealAt || 0) > now && w.status !== "cancelled").map((w) => w.participantId)
    );
    const nextRevealAt = s.winners
      .map((w) => w.revealAt || 0)
      .filter((t) => t > now)
      .sort((a, b) => a - b)[0] || null;
    return {
      version: s.version,
      serverTime: now,
      eventName: s.settings.eventName,
      participants: s.participants
        .filter((p) => p.status === "active" || hiddenIds.has(p.id))
        .map((p) => ({ id: p.id, name: p.name })),
      winners: s.winners
        .filter((w) => w.status !== "cancelled" && (w.revealAt || 0) <= now)
        .map((w) => ({
          id: w.id,
          name: w.name,
          prizeId: w.prizeId,
          prizeName: w.prize?.name || "",
          prizeImageId: w.prize?.imageId || null,
          wonAt: w.wonAt,
        })),
      prizes: this.prizesWithRemaining().map((p) => ({
        id: p.id,
        name: p.name,
        imageId: p.imageId,
        quantity: p.quantity,
        remaining: p.remaining,
      })),
      currentPrizeId: s.currentPrizeId,
      theme: s.theme,
      nextRevealAt,
    };
  }

  async getAdminState() {
    const s = await this.load();
    return { ...s, prizes: this.prizesWithRemaining(), serverTime: Date.now() };
  }

  async getBranding() {
    return { ...(await this.load()).branding };
  }

  // Cấu hình công khai cho trang /party/
  async getPartyConfig() {
    const p = (await this.load()).party;
    return {
      sounds: p.sounds.map((x) => ({ id: x.id, name: x.name, spinId: x.spinId, winId: x.winId || null })),
      backgrounds: p.backgrounds.map((x) => ({ id: x.id, name: x.name, imageId: x.imageId })),
      button: p.buttons.find((b) => b.id === p.activeButtonId) || null,
      defaultSoundId: p.defaultSoundId,
      defaultBackgroundId: p.defaultBackgroundId,
    };
  }

  // ---------- Âm thanh (lưu chia khối) ----------
  async uploadAudio(bytes, contentType) {
    if (!/^audio\/(mpeg|mp3|mp4|x-m4a|aac|ogg|wav|x-wav|wave|webm)$/.test(contentType || "")) {
      return { ok: false, error: "Định dạng âm thanh không hỗ trợ (dùng MP3, M4A, OGG, WAV)" };
    }
    if (!bytes || bytes.byteLength === 0) return { ok: false, error: "File âm thanh rỗng" };
    if (bytes.byteLength > MAX_AUDIO_BYTES) return { ok: false, error: "File âm thanh quá lớn (tối đa 8MB)" };
    const id = randomId(16);
    const chunks = Math.ceil(bytes.byteLength / AUDIO_CHUNK);
    const entries = { ["aud:" + id]: { type: contentType, size: bytes.byteLength, chunks } };
    for (let i = 0; i < chunks; i++) {
      entries[`aud:${id}:${i}`] = bytes.slice(i * AUDIO_CHUNK, (i + 1) * AUDIO_CHUNK);
    }
    await this.ctx.storage.put(entries);
    return { ok: true, id };
  }

  async getAudio(id) {
    if (!ID_RE.test(id || "")) return null;
    const meta = await this.ctx.storage.get("aud:" + id);
    if (!meta) return null;
    const keys = Array.from({ length: meta.chunks }, (_, i) => `aud:${id}:${i}`);
    const parts = await this.ctx.storage.get(keys);
    const out = new Uint8Array(meta.size);
    let offset = 0;
    for (const key of keys) {
      const part = new Uint8Array(parts.get(key));
      out.set(part, offset);
      offset += part.byteLength;
    }
    return { type: meta.type, data: out.buffer };
  }

  async deleteAudioIfUnused(id) {
    if (!id) return;
    const used = this.state.party.sounds.some((s) => s.spinId === id || s.winId === id);
    if (used) return;
    const meta = await this.ctx.storage.get("aud:" + id);
    if (!meta) return;
    const keys = ["aud:" + id, ...Array.from({ length: meta.chunks }, (_, i) => `aud:${id}:${i}`)];
    await this.ctx.storage.delete(keys);
  }

  async getImage(id) {
    if (!/^[a-z0-9]{6,32}$/.test(id || "")) return null;
    return (await this.ctx.storage.get("img:" + id)) || null;
  }

  // ---------- Thao tác của admin ----------
  // Trả về { ok, state } hoặc { ok:false, error }
  async admin(action, body = {}, meta = {}) {
    await this.load();
    try {
      const handler = this.actions[action];
      if (!handler) fail("Thao tác không hợp lệ: " + action);
      const result = await handler.call(this, body || {}, meta);
      return { ok: true, ...(result || {}), state: await this.getAdminState() };
    } catch (error) {
      if (error instanceof UserError) return { ok: false, error: error.message };
      console.error(action, error);
      return { ok: false, error: "Lỗi máy chủ: " + (error.message || error) };
    }
  }

  async uploadImage(bytes, contentType) {
    if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(contentType || "")) {
      return { ok: false, error: "Định dạng ảnh không hỗ trợ" };
    }
    if (!bytes || bytes.byteLength === 0) return { ok: false, error: "File ảnh rỗng" };
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return { ok: false, error: "Ảnh quá lớn sau khi nén (tối đa ~1.9MB)" };
    }
    const id = randomId(16);
    await this.ctx.storage.put("img:" + id, { type: contentType, data: bytes });
    return { ok: true, id };
  }

  async deleteImageIfUnused(id) {
    if (!id) return;
    const s = this.state;
    const used =
      Object.values(s.theme.images).includes(id) ||
      s.prizes.some((p) => p.imageId === id) ||
      s.party.backgrounds.some((b) => b.imageId === id) ||
      ["faviconId", "logoId", "shareImageId"].some((k) => s.branding[k] === id) ||
      s.party.buttons.some((b) => b.imageId === id) ||
      s.winners.some((w) => w.prize?.imageId === id);
    if (!used) await this.ctx.storage.delete("img:" + id);
  }

  findParticipantDuplicate(name, email) {
    const lower = name.toLowerCase();
    return this.state.participants.find((p) =>
      email ? p.email === email : !p.email && p.name.toLowerCase() === lower
    );
  }

  get actions() {
    return {
      // ----- Người tham dự -----
      async addParticipant({ name, email }) {
        name = cleanText(name, 100);
        const rawEmail = cleanText(email, 254);
        email = cleanEmail(rawEmail);
        if (!name) fail("Vui lòng nhập tên");
        if (rawEmail && !email) fail("Email không hợp lệ");
        if (this.state.participants.length >= MAX_PARTICIPANTS) fail("Đã đạt giới hạn 5000 người");
        if (this.findParticipantDuplicate(name, email)) fail(email ? "Email này đã có trong danh sách" : "Tên này đã có trong danh sách");
        this.state.participants.push({ id: randomId(), name, email, status: "active", createdAt: Date.now() });
        await this.save();
      },

      async importParticipants({ rows }) {
        if (!Array.isArray(rows)) fail("Dữ liệu import không hợp lệ");
        let added = 0, duplicate = 0, invalidEmail = 0, empty = 0, updated = 0;
        for (const row of rows.slice(0, MAX_PARTICIPANTS)) {
          const name = cleanText(row?.name, 100);
          const rawEmail = cleanText(row?.email, 254);
          const email = cleanEmail(rawEmail);
          if (!name) { empty++; continue; }
          if (rawEmail && !email) invalidEmail++;
          if (this.findParticipantDuplicate(name, email)) { duplicate++; continue; }
          // Đã có người cùng tên nhưng chưa có email -> bổ sung email thay vì thêm trùng
          if (email) {
            const lower = name.toLowerCase();
            const noEmail = this.state.participants.find((p) => !p.email && p.name.toLowerCase() === lower);
            if (noEmail) {
              noEmail.email = email;
              for (const w of this.state.winners) if (w.participantId === noEmail.id) w.email = email;
              updated++;
              continue;
            }
          }
          if (this.state.participants.length >= MAX_PARTICIPANTS) break;
          this.state.participants.push({ id: randomId(), name, email, status: "active", createdAt: Date.now() });
          added++;
        }
        if (added || updated) await this.save();
        return { summary: { added, duplicate, invalidEmail, empty, updated } };
      },

      async updateParticipant({ id, name, email }) {
        const p = this.state.participants.find((x) => x.id === id);
        if (!p) fail("Không tìm thấy người tham dự");
        name = cleanText(name, 100);
        const rawEmail = cleanText(email, 254);
        const cleaned = cleanEmail(rawEmail);
        if (!name) fail("Vui lòng nhập tên");
        if (rawEmail && !cleaned) fail("Email không hợp lệ");
        p.name = name;
        p.email = cleaned;
        for (const w of this.state.winners) {
          if (w.participantId === id) {
            w.name = name;
            w.email = cleaned;
          }
        }
        await this.save();
      },

      async deleteParticipant({ id }) {
        const before = this.state.participants.length;
        this.state.participants = this.state.participants.filter((p) => p.id !== id);
        if (this.state.participants.length === before) fail("Không tìm thấy người tham dự");
        await this.save();
      },

      // Chỉ xoá người chưa trúng (giữ người đã trúng để còn tra cứu / trả về)
      async clearActiveParticipants() {
        this.state.participants = this.state.participants.filter((p) => p.status !== "active");
        await this.save();
      },

      // Nhập dữ liệu từ bản cũ (lưu trong trình duyệt)
      async migrateLegacy({ participants = [], winners = [] }) {
        let added = 0;
        const winnerIds = new Set(winners.map((w) => String(w.id)));
        for (const lp of participants) {
          const name = cleanText(lp?.name, 100);
          if (!name || this.findParticipantDuplicate(name, "")) continue;
          const won = winnerIds.has(String(lp.id)) || lp.status === "inactive";
          const id = randomId();
          this.state.participants.push({ id, name, email: "", status: won ? "won" : "active", createdAt: Date.parse(lp.createdDate) || Date.now() });
          if (won) {
            const lw = winners.find((w) => String(w.id) === String(lp.id)) || {};
            this.state.winners.push({
              id: randomId(), participantId: id, name, email: "", prizeId: null, prize: null, code: "",
              status: "confirmed", wonAt: Date.parse(lw.winTime) || Date.now(), revealAt: 0, emails: [],
            });
          }
          added++;
        }
        if (added) await this.save();
        return { summary: { added } };
      },

      // ----- Quay thưởng: người trúng được chọn ở đây (phía máy chủ) -----
      async spin({ prizeId, revealDelayMs }) {
        const s = this.state;
        const pool = s.participants.filter((p) => p.status === "active");
        if (pool.length === 0) fail("Chưa có người tham dự");
        let prize = null;
        if (prizeId) {
          prize = s.prizes.find((p) => p.id === prizeId);
          if (!prize) fail("Không tìm thấy giải thưởng");
          if (this.prizeRemaining(prize) === 0) fail(`Giải "${prize.name}" đã hết`);
        }

        const chosen = pool[randomInt(pool.length)];
        chosen.status = "won";

        let code = "";
        if (prize?.type === "code") {
          if (prize.codeMode === "fixed") code = prize.codeFixed || "";
          else {
            const existing = new Set(s.winners.map((w) => w.code));
            do {
              code = (prize.codePrefix || "") + randomCode(Math.min(12, Math.max(4, prize.codeLength || 6)));
            } while (existing.has(code));
          }
        }

        const now = Date.now();
        const delay = Math.min(MAX_REVEAL_DELAY, Math.max(0, Number(revealDelayMs) || 0));
        const winner = {
          id: randomId(),
          participantId: chosen.id,
          name: chosen.name,
          email: chosen.email || "",
          prizeId: prize?.id || null,
          prize: prize
            ? { name: prize.name, type: prize.type, imageId: prize.imageId || null, description: prize.description || "", discountText: prize.discountText || "" }
            : null,
          code,
          status: "pending",
          wonAt: now,
          revealAt: now + delay,
          emails: [],
        };
        s.winners.push(winner);
        await this.save();
        await this.scheduleRevealAlarm();
        return { winner };
      },

      // ----- Người trúng -----
      async confirmWinner({ id }, meta) {
        const w = this.findWinner(id);
        if (w.status === "cancelled") fail("Kết quả này đã bị huỷ");
        w.status = "confirmed";
        let email = null;
        if (this.state.settings.autoEmail && w.email) {
          email = await this.sendEmailFor(w, "win", meta.origin);
        }
        await this.save();
        return { email };
      },

      async sendWinnerEmail({ id, type }, meta) {
        if (type !== "win" && type !== "cancel") fail("Loại email không hợp lệ");
        const w = this.findWinner(id);
        if (!w.email) fail("Người này chưa có email");
        if (type === "win" && w.status === "cancelled") fail("Kết quả đã huỷ, không gửi thông báo trúng thưởng");
        const email = await this.sendEmailFor(w, type, meta.origin);
        if (email.ok) {
          if (type === "cancel") w.status = "cancelled";
          else if (w.status === "pending") w.status = "confirmed";
        }
        await this.save();
        if (!email.ok) fail("Gửi email thất bại: " + email.error);
        return { email };
      },

      async cancelWinner({ id }) {
        const w = this.findWinner(id);
        w.status = "cancelled";
        await this.save();
      },

      // Huỷ kết quả và cho người này quay lại các lượt sau
      async restoreWinner({ id }) {
        const w = this.findWinner(id);
        this.state.winners = this.state.winners.filter((x) => x !== w);
        const p = this.state.participants.find((x) => x.id === w.participantId);
        if (p) p.status = "active";
        await this.save();
      },

      async deleteWinner({ id }) {
        const w = this.findWinner(id);
        this.state.winners = this.state.winners.filter((x) => x !== w);
        this.state.participants = this.state.participants.filter((x) => x.id !== w.participantId);
        await this.save();
      },

      async clearWinners({ mode }) {
        const ids = new Set(this.state.winners.map((w) => w.participantId));
        if (mode === "restore") {
          for (const p of this.state.participants) if (ids.has(p.id)) p.status = "active";
        } else {
          this.state.participants = this.state.participants.filter((p) => !ids.has(p.id));
        }
        this.state.winners = [];
        await this.save();
      },

      // ----- Giải thưởng -----
      async savePrize({ prize }) {
        if (!prize) fail("Thiếu dữ liệu giải");
        const name = cleanText(prize.name, 100);
        if (!name) fail("Vui lòng nhập tên giải");
        const type = prize.type === "code" ? "code" : "gift";
        const data = {
          name,
          type,
          quantity: Math.max(0, Math.min(10000, parseInt(prize.quantity, 10) || 0)),
          description: cleanText(prize.description, 300),
          imageId: /^[a-z0-9]{6,32}$/.test(prize.imageId || "") ? prize.imageId : null,
          discountText: cleanText(prize.discountText, 60),
          codeMode: prize.codeMode === "fixed" ? "fixed" : "random",
          codePrefix: cleanText(prize.codePrefix, 20).replace(/\s/g, ""),
          codeLength: Math.max(4, Math.min(12, parseInt(prize.codeLength, 10) || 6)),
          codeFixed: cleanText(prize.codeFixed, 40).replace(/\s/g, ""),
        };
        if (type === "code" && data.codeMode === "fixed" && !data.codeFixed) fail("Vui lòng nhập mã giảm giá cố định");
        let oldImage = null;
        if (prize.id) {
          const existing = this.state.prizes.find((p) => p.id === prize.id);
          if (!existing) fail("Không tìm thấy giải");
          oldImage = existing.imageId !== data.imageId ? existing.imageId : null;
          Object.assign(existing, data);
        } else {
          const created = { id: randomId(), ...data };
          this.state.prizes.push(created);
          if (!this.state.currentPrizeId) this.state.currentPrizeId = created.id;
        }
        await this.deleteImageIfUnused(oldImage);
        await this.save();
      },

      async deletePrize({ id }) {
        const prize = this.state.prizes.find((p) => p.id === id);
        if (!prize) fail("Không tìm thấy giải");
        this.state.prizes = this.state.prizes.filter((p) => p.id !== id);
        if (this.state.currentPrizeId === id) this.state.currentPrizeId = this.state.prizes[0]?.id || null;
        await this.deleteImageIfUnused(prize.imageId);
        await this.save();
      },

      async movePrize({ id, direction }) {
        const list = this.state.prizes;
        const i = list.findIndex((p) => p.id === id);
        const j = direction === "up" ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        await this.save();
      },

      async setCurrentPrize({ id }) {
        if (id && !this.state.prizes.some((p) => p.id === id)) fail("Không tìm thấy giải");
        this.state.currentPrizeId = id || null;
        await this.save();
      },

      // ----- Cài đặt -----
      async saveSettings({ settings = {} }) {
        const cur = this.state.settings;
        if ("eventName" in settings) cur.eventName = cleanText(settings.eventName, 120) || "Vòng quay may mắn";
        if ("senderName" in settings) cur.senderName = cleanText(settings.senderName, 80);
        if ("autoEmail" in settings) cur.autoEmail = !!settings.autoEmail;
        if ("scriptUrl" in settings) {
          const url = cleanText(settings.scriptUrl, 300);
          const match = url.match(/https:\/\/script\.google\.com\/(?:a\/macros\/[^/\s]+|macros)\/s\/[\w-]+\/exec/);
          if (url && !match) fail("URL Apps Script không hợp lệ (dạng https://script.google.com/macros/s/.../exec)");
          cur.scriptUrl = match ? match[0] : "";
        }
        if (settings.templates) {
          for (const type of ["win", "cancel"]) {
            const t = settings.templates[type];
            if (!t) continue;
            cur.templates[type] = {
              subject: cleanText(t.subject, 200) || DEFAULT_TEMPLATES[type].subject,
              body: cleanMultiline(t.body) || DEFAULT_TEMPLATES[type].body,
            };
          }
        }
        if (settings.resetTemplates) cur.templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
        await this.save();
      },

      async regenerateSecret() {
        this.state.settings.secret = randomId(24);
        await this.save();
      },

      async testAppsScript() {
        const res = await this.callScript({ action: "ping" });
        if (!res.ok) fail(res.error);
        return { message: "Kết nối Apps Script thành công" };
      },

      async sendTestEmail({ to, type }, meta) {
        const email = cleanEmail(to);
        if (!email) fail("Email nhận thử không hợp lệ");
        const fake = {
          name: "Nguyễn Văn Mẫu",
          email,
          code: "EZ-DEMO123",
          prize: this.state.prizes[0] || { name: "Giải thưởng mẫu", discountText: "10%", description: "" },
        };
        const res = await this.sendRaw(fake, type === "cancel" ? "cancel" : "win", meta.origin);
        if (!res.ok) fail("Gửi email thử thất bại: " + res.error);
        return { message: "Đã gửi email thử tới " + email };
      },

      async previewEmail({ type, winnerId, templates }, meta) {
        const w = winnerId
          ? this.findWinner(winnerId)
          : { name: "Nguyễn Văn Mẫu", code: "EZ-DEMO123", prize: this.state.prizes[0] || { name: "Giải thưởng mẫu", discountText: "10%" } };
        const settings = templates ? { ...this.state.settings, templates: { ...this.state.settings.templates, ...templates } } : this.state.settings;
        return { email: renderEmail(type === "cancel" ? "cancel" : "win", w, settings, meta.origin) };
      },

      async syncSheet() {
        const s = this.state;
        const prizeName = (w) => w.prize?.name || "";
        const res = await this.callScript({
          action: "sync",
          participants: s.participants.map((p) => ({ id: p.id, name: p.name, email: p.email, status: p.status, createdAt: p.createdAt })),
          winners: s.winners.map((w) => ({
            id: w.id, name: w.name, email: w.email, prize: prizeName(w), code: w.code, status: w.status, wonAt: w.wonAt,
            emailed: w.emails.filter((e) => e.ok).map((e) => (e.type === "cancel" ? "Huỷ" : "Trúng thưởng")).join(", "),
          })),
        });
        if (!res.ok) fail(res.error);
        return { message: `Đã đồng bộ: ${s.participants.length} người tham dự, ${s.winners.length} người trúng` };
      },

      // ----- Thương hiệu -----
      async saveBranding({ branding = {} }) {
        const cur = this.state.branding;
        if ("siteName" in branding) cur.siteName = cleanText(branding.siteName, 80) || DEFAULT_BRANDING.siteName;
        if ("description" in branding) cur.description = cleanText(branding.description, 300);
        if ("themeColor" in branding) cur.themeColor = isHexColor(branding.themeColor) ? branding.themeColor : DEFAULT_BRANDING.themeColor;
        const removed = [];
        for (const key of ["faviconId", "logoId", "shareImageId"]) {
          if (!(key in branding)) continue;
          const next = ID_RE.test(branding[key] || "") ? branding[key] : null;
          if (cur[key] !== next) removed.push(cur[key]);
          cur[key] = next;
        }
        for (const id of removed) await this.deleteImageIfUnused(id);
        await this.save();
      },

      async resetBranding() {
        const old = this.state.branding;
        this.state.branding = { ...DEFAULT_BRANDING };
        for (const id of [old.faviconId, old.logoId, old.shareImageId]) await this.deleteImageIfUnused(id);
        await this.save();
      },

      // ----- Chế độ Party -----
      async savePartySound({ sound }) {
        const party = this.state.party;
        const name = cleanText(sound?.name, 60);
        if (!name) fail("Vui lòng nhập tên âm thanh");
        const spinId = ID_RE.test(sound?.spinId || "") ? sound.spinId : null;
        const winId = ID_RE.test(sound?.winId || "") ? sound.winId : null;
        if (!spinId) fail("Vui lòng tải lên âm thanh khi quay");
        const removed = [];
        if (sound.id) {
          const cur = party.sounds.find((x) => x.id === sound.id);
          if (!cur) fail("Không tìm thấy âm thanh");
          if (cur.spinId !== spinId) removed.push(cur.spinId);
          if (cur.winId && cur.winId !== winId) removed.push(cur.winId);
          Object.assign(cur, { name, spinId, winId });
        } else {
          const created = { id: randomId(), name, spinId, winId };
          party.sounds.push(created);
          if (!party.defaultSoundId) party.defaultSoundId = created.id;
        }
        for (const id of removed) await this.deleteAudioIfUnused(id);
        await this.save();
      },

      async deletePartySound({ id }) {
        const party = this.state.party;
        const cur = party.sounds.find((x) => x.id === id);
        if (!cur) fail("Không tìm thấy âm thanh");
        party.sounds = party.sounds.filter((x) => x !== cur);
        if (party.defaultSoundId === id) party.defaultSoundId = party.sounds[0]?.id || null;
        await this.deleteAudioIfUnused(cur.spinId);
        await this.deleteAudioIfUnused(cur.winId);
        await this.save();
      },

      async savePartyImage({ kind, item }) {
        const party = this.state.party;
        const list = kind === "button" ? party.buttons : kind === "background" ? party.backgrounds : null;
        if (!list) fail("Loại không hợp lệ");
        const name = cleanText(item?.name, 60);
        if (!name) fail("Vui lòng nhập tên");
        const imageId = ID_RE.test(item?.imageId || "") ? item.imageId : null;
        if (!imageId) fail("Vui lòng chọn ảnh");
        let oldImage = null;
        if (item.id) {
          const cur = list.find((x) => x.id === item.id);
          if (!cur) fail("Không tìm thấy");
          if (cur.imageId !== imageId) oldImage = cur.imageId;
          Object.assign(cur, { name, imageId });
        } else {
          const created = { id: randomId(), name, imageId };
          list.push(created);
          if (kind === "background" && !party.defaultBackgroundId) party.defaultBackgroundId = created.id;
        }
        await this.deleteImageIfUnused(oldImage);
        await this.save();
      },

      async deletePartyImage({ kind, id }) {
        const party = this.state.party;
        const key = kind === "button" ? "buttons" : kind === "background" ? "backgrounds" : null;
        if (!key) fail("Loại không hợp lệ");
        const cur = party[key].find((x) => x.id === id);
        if (!cur) fail("Không tìm thấy");
        party[key] = party[key].filter((x) => x !== cur);
        if (party.defaultBackgroundId === id) party.defaultBackgroundId = party.backgrounds[0]?.id || null;
        if (party.activeButtonId === id) party.activeButtonId = null;
        await this.deleteImageIfUnused(cur.imageId);
        await this.save();
      },

      async setPartyDefaults(body) {
        const party = this.state.party;
        if ("defaultSoundId" in body) {
          if (body.defaultSoundId && !party.sounds.some((x) => x.id === body.defaultSoundId)) fail("Không tìm thấy âm thanh");
          party.defaultSoundId = body.defaultSoundId || null;
        }
        if ("defaultBackgroundId" in body) {
          if (body.defaultBackgroundId && !party.backgrounds.some((x) => x.id === body.defaultBackgroundId)) fail("Không tìm thấy hình nền");
          party.defaultBackgroundId = body.defaultBackgroundId || null;
        }
        if ("activeButtonId" in body) {
          if (body.activeButtonId && !party.buttons.some((x) => x.id === body.activeButtonId)) fail("Không tìm thấy nút quay");
          party.activeButtonId = body.activeButtonId || null;
        }
        await this.save();
      },

      // ----- Giao diện -----
      async saveTheme({ colors, images }) {
        const theme = this.state.theme;
        if (colors) {
          for (const key of Object.keys(DEFAULT_COLORS)) {
            if (isHexColor(colors[key])) theme.colors[key] = colors[key];
          }
        }
        if (colors === null) theme.colors = { ...DEFAULT_COLORS };
        const removed = [];
        if (images) {
          for (const key of Object.keys(theme.images)) {
            if (!(key in images)) continue;
            const v = images[key];
            const next = v && /^[a-z0-9]{6,32}$/.test(v) ? v : null;
            if (theme.images[key] !== next) removed.push(theme.images[key]);
            theme.images[key] = next;
          }
        }
        for (const id of removed) await this.deleteImageIfUnused(id);
        await this.save();
      },

      async resetAllData({ confirm }) {
        if (confirm !== "XOA") fail("Thiếu xác nhận");
        const keep = { settings: this.state.settings, theme: this.state.theme, prizes: this.state.prizes, currentPrizeId: this.state.currentPrizeId };
        this.state = { ...defaultState(), ...keep, version: this.state.version };
        await this.save();
      },
    };
  }

  findWinner(id) {
    const w = this.state.winners.find((x) => x.id === id);
    if (!w) fail("Không tìm thấy người trúng");
    return w;
  }

  async callScript(payload) {
    const { secret } = this.state.settings;
    // DEV_APPS_SCRIPT_URL: chỉ dùng khi chạy thử local với Apps Script giả lập
    const scriptUrl = this.env.DEV_APPS_SCRIPT_URL || this.state.settings.scriptUrl;
    if (!scriptUrl) return { ok: false, error: "Chưa cấu hình URL Apps Script (Dashboard > Email & Google Sheet)" };
    return callAppsScript(scriptUrl, { ...payload, secret });
  }

  async sendRaw(winnerLike, type, origin) {
    const mail = renderEmail(type, winnerLike, this.state.settings, origin);
    return this.callScript({
      action: "sendEmail",
      to: winnerLike.email,
      subject: mail.subject,
      htmlBody: mail.html,
      textBody: mail.text,
      name: this.state.settings.senderName || this.state.settings.eventName,
    });
  }

  // Gửi email cho 1 người trúng và ghi lịch sử (không throw)
  async sendEmailFor(winner, type, origin) {
    const res = await this.sendRaw(winner, type, origin);
    const log = { type, at: Date.now(), ok: !!res.ok, error: res.ok ? "" : res.error };
    winner.emails.push(log);
    return log;
  }
}
