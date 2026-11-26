// Hộp thoại "Giao diện" trên Dashboard: đổi ảnh nền, ảnh tiêu đề, nút mũi tên,
// vành vòng quay và màu vòng quay. Dữ liệu lưu qua theme.js (window.LuckyTheme).
$(document).ready(function () {
  const Theme = window.LuckyTheme;
  if (!Theme) return;

  const COLOR_FIELDS = [
    { key: "segment1", label: "Màu ô lẻ" },
    { key: "text1", label: "Chữ trên ô lẻ" },
    { key: "segment2", label: "Màu ô chẵn" },
    { key: "text2", label: "Chữ trên ô chẵn" },
    { key: "center", label: "Vòng tròn ở tâm" },
    { key: "centerText", label: "Chữ ở tâm" },
  ];

  const PRESETS = [
    { name: "Xanh lá (mặc định)", colors: Theme.DEFAULT_COLORS },
    {
      name: "Đỏ Tết",
      colors: { segment1: "#fff4d6", text1: "#b71c1c", segment2: "#c62828", text2: "#ffe082", center: "#b71c1c", centerText: "#ffe082" },
    },
    {
      name: "Xanh dương",
      colors: { segment1: "#e3f2fd", text1: "#0d47a1", segment2: "#1565c0", text2: "#ffffff", center: "#0d47a1", centerText: "#e3f2fd" },
    },
    {
      name: "Tím",
      colors: { segment1: "#f3e5f5", text1: "#4a148c", segment2: "#6a1b9a", text2: "#ffffff", center: "#4a148c", centerText: "#f3e5f5" },
    },
    {
      name: "Cam",
      colors: { segment1: "#fff3e0", text1: "#e65100", segment2: "#ef6c00", text2: "#ffffff", center: "#e65100", centerText: "#fff3e0" },
    },
    {
      name: "Vàng đen",
      colors: { segment1: "#ffd54f", text1: "#212121", segment2: "#212121", text2: "#ffd54f", center: "#212121", centerText: "#ffd54f" },
    },
  ];

  const IMAGE_HINTS = {
    background: "Khuyên dùng 1920×1080, JPG hoặc PNG.",
    title: "PNG nền trong suốt, khung ngang (vd 3000×1000).",
    arrow: "PNG vuông, nền trong suốt; mũi tên ở chính giữa cạnh trên. Nên cùng kích thước với ảnh vành.",
    frame: "PNG vuông, nền trong suốt, giữa trong suốt để thấy các ô.",
  };

  let colors = Theme.getColors();

  // ---------- Dựng giao diện ----------
  function buildImageCards() {
    const container = $("#theme-images").empty();
    Object.keys(Theme.IMAGES).forEach((key) => {
      const card = $(`
        <div class="col-6 col-lg-3">
          <div class="theme-image-card">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="small fw-semibold"></span>
              <span class="badge bg-success d-none">Đã đổi</span>
            </div>
            <div class="theme-image-preview"><img alt=""></div>
            <div class="small text-muted mb-2 flex-grow-1"></div>
            <input type="file" accept="image/*" class="d-none">
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-return flex-grow-1 theme-upload">
                <i class="bi bi-upload"></i> Chọn ảnh
              </button>
              <button type="button" class="btn btn-sm btn-outline-dark theme-reset-image" title="Dùng ảnh mặc định">
                <i class="bi bi-arrow-counterclockwise"></i>
              </button>
            </div>
          </div>
        </div>`);
      card.attr("data-key", key);
      card.find(".fw-semibold").text(Theme.IMAGES[key].label);
      card.find(".text-muted").text(IMAGE_HINTS[key] || "");
      container.append(card);
    });
  }

  function buildColorInputs() {
    const container = $("#theme-colors").empty();
    COLOR_FIELDS.forEach((f) => {
      const item = $(`
        <div class="col-sm-6">
          <label class="theme-color-item">
            <input type="color" class="form-control form-control-color">
            <span></span>
          </label>
        </div>`);
      item.find("input").attr("data-key", f.key);
      item.find("span").text(f.label);
      container.append(item);
    });

    const presets = $("#theme-presets").empty();
    PRESETS.forEach((preset, i) => {
      const btn = $(
        '<button type="button" class="btn btn-sm btn-outline-secondary theme-preset">' +
          '<span class="swatch"></span><span class="swatch"></span><span class="name"></span></button>'
      );
      btn.attr("data-index", i);
      btn.find(".swatch").eq(0).css("background", preset.colors.segment1);
      btn.find(".swatch").eq(1).css("background", preset.colors.segment2);
      btn.find(".name").text(preset.name);
      presets.append(btn);
    });
  }

  function renderColorInputs() {
    $("#theme-colors input[type=color]").each(function () {
      $(this).val(colors[$(this).data("key")]);
    });
    renderPreview();
  }

  function renderPreview() {
    const n = 8;
    const cx = 250;
    const cy = 250;
    const r = 240;
    const names = ["Minh Anh", "Bảo Châu", "Gia Huy", "Thu Hà", "Quốc Khánh", "Lan Anh", "Đức Long", "Ngọc Mai"];
    let svg = "";
    for (let i = 0; i < n; i++) {
      const a1 = ((i * 360) / n - 90) * (Math.PI / 180);
      const a2 = (((i + 1) * 360) / n - 90) * (Math.PI / 180);
      const fill = i % 2 === 0 ? colors.segment1 : colors.segment2;
      const textColor = i % 2 === 0 ? colors.text1 : colors.text2;
      svg += `<path d="M ${cx},${cy} L ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} A ${r},${r} 0 0 1 ${cx + r * Math.cos(a2)},${cy + r * Math.sin(a2)} Z" fill="${fill}" stroke="rgba(0,0,0,.08)"/>`;
      const ta = (i + 0.5) * (360 / n);
      const tr = (ta - 90) * (Math.PI / 180);
      const tx = cx + r * 0.65 * Math.cos(tr);
      const ty = cy + r * 0.65 * Math.sin(tr);
      svg += `<text x="${tx}" y="${ty}" fill="${textColor}" font-size="24" font-weight="600" text-anchor="middle" dominant-baseline="middle" transform="rotate(${ta + 90}, ${tx}, ${ty})">${names[i]}</text>`;
    }
    svg += `<circle cx="${cx}" cy="${cy}" r="40" fill="${colors.center}"/>`;
    svg += `<text x="${cx}" y="${cy}" fill="${colors.centerText}" font-size="24" font-weight="bold" text-anchor="middle" dominant-baseline="middle">EZ</text>`;
    $("#theme-preview").html(svg);
  }

  function renderImages() {
    return Theme.applyImages().then(({ urls, custom }) => {
      Object.keys(Theme.IMAGES).forEach((key) => {
        const card = $(`#theme-images [data-key="${key}"]`);
        card.find("img").attr("src", urls[key]);
        card.find(".badge").toggleClass("d-none", !custom[key]);
        card.find(".theme-reset-image").prop("disabled", !custom[key]);
      });
    });
  }

  function saveColors() {
    try {
      Theme.saveColors(colors);
    } catch (e) {
      showMessage("Không lưu được màu (trình duyệt chặn lưu dữ liệu?)", "danger");
    }
  }

  function showMessage(text, type) {
    if (typeof window.showDashboardToast === "function") {
      window.showDashboardToast(text, type);
    } else {
      alert(text);
    }
  }

  // ---------- Sự kiện ----------
  buildImageCards();
  buildColorInputs();
  Theme.applyImages(); // Dashboard cũng dùng ảnh nền tuỳ chỉnh

  $("#open-theme-settings").click(function () {
    colors = Theme.getColors();
    renderColorInputs();
    renderImages();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("themeModal")).show();
  });

  $("#theme-images")
    .on("click", ".theme-upload", function () {
      $(this).closest("[data-key]").find("input[type=file]").val("").trigger("click");
    })
    .on("change", "input[type=file]", function () {
      const file = this.files && this.files[0];
      if (!file) return;
      const key = $(this).closest("[data-key]").data("key");
      Theme.saveImage(key, file)
        .then(renderImages)
        .then(() => showMessage("Đã đổi " + Theme.IMAGES[key].label.toLowerCase(), "success"))
        .catch((err) => showMessage(err.message || "Không lưu được ảnh", "danger"));
    })
    .on("click", ".theme-reset-image", function () {
      const key = $(this).closest("[data-key]").data("key");
      Theme.resetImage(key)
        .then(renderImages)
        .then(() => showMessage("Đã dùng lại ảnh mặc định", "info"));
    });

  // Kéo màu: xem trước ngay; thả ra (change): lưu và cập nhật vòng quay
  $("#theme-colors")
    .on("input", "input[type=color]", function () {
      colors[$(this).data("key")] = $(this).val();
      renderPreview();
    })
    .on("change", "input[type=color]", function () {
      colors[$(this).data("key")] = $(this).val();
      saveColors();
    });

  $("#theme-presets").on("click", ".theme-preset", function () {
    colors = Object.assign({}, PRESETS[$(this).data("index")].colors);
    renderColorInputs();
    saveColors();
  });

  $("#reset-theme-colors").click(function () {
    Theme.resetColors();
    colors = Theme.getColors();
    renderColorInputs();
  });

  $("#reset-theme-all").click(function () {
    if (!confirm("Khôi phục toàn bộ ảnh và màu về mặc định?")) return;
    Theme.resetAll().then(() => {
      colors = Theme.getColors();
      renderColorInputs();
      renderImages();
      showMessage("Đã khôi phục giao diện mặc định", "info");
    });
  });

  // Tab Dashboard khác đổi giao diện -> cập nhật ảnh nền
  Theme.onChange(function () {
    Theme.applyImages();
  });
});
