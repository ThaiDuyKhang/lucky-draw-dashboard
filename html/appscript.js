// Hàm GET để trả về giao diện
function doGet() {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Vòng Quay May Mắn")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

// Tạo mã giảm giá unique
function generateDiscountCode(discountPercentage) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `EZVPS${discountPercentage}_${timestamp}${randomString}`;
}

// Gửi email người chơi
function sendDiscountEmail(email, fullname, discountCode, discountPercentage) {
  try {
    console.log("Gửi email đến:", email);

    // Validation cơ bản
    if (!email || !fullname || !discountCode || !discountPercentage) {
      return false;
    }

    // Tạo chủ đề email
    const subject = "🎁 Mã giảm giá từ Vòng quay may mắn EZtech ";

    // Tạo nội dung HTML cho email với thiết kế coupon
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background: #fff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #FF6B35; margin-bottom: 10px;">🎉 Chúc mừng <strong>${fullname}</strong><br/>đã trúng thưởng mã giảm giá</h1>
        </div>

        <div style="background:linear-gradient(135deg,#ff6b35 0%,#f7931e 50%,#ffd23f 100%);border-radius:15px;padding:25px;margin:25px 0;text-align:center;color:white">
          <div style="width:2px;height:100%;background:repeating-linear-gradient(to bottom,transparent 0px,transparent 8px,rgba(255,255,255,0.3) 8px,rgba(255,255,255,0.3) 12px)"></div>
          <div style="background:rgba(255,255,255,0.95);color:#ff5722;padding:15px;border-radius:8px;margin:15px 0;font-size:28px;font-weight:bold;letter-spacing:3px">${discountCode}</div>
          <p style="margin: 15px 0 0 0; font-size: 18px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); color:#ffffff;">Mã giảm ${discountPercentage}% cho tất cả dịch vụ VPS của EZtech</p>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #246d4b; margin-top: 0; margin-bottom: 7px; font-size: 18px;">Hướng dẫn sử dụng mã giảm giá:</h3>
          <ol style="color: #333; margin: 0; line-height: 1.6; padding: 0;">
            <li>Truy cập website: <a href="https://eztech.vn/" target="_blank" style="color: #FF6B35; font-weight: bold;">https://eztech.vn</a></li>
            <li>Chọn gói VPS phù hợp với nhu cầu</li>
            <li>Nhập mã <strong style="color: #FF5722;">${discountCode}</strong> khi thanh toán</li>
            <li>Nhận ngay ưu đãi ${discountPercentage}% và bắt đầu sử dụng</li>
            <li>Lưu ý: Mã giảm có thời hạn đến ngày 31/12/2026</li>
          </ol>

          <h3 style="color:#246d4b;margin-top: 10px;margin-bottom: 7px;font-size:18px">Hỗ trợ khách hàng 24/7:</h3>
            <ol style="color: #333; margin: 0; line-height: 1.6; padding: 0;">
                <li>Website: <a href="https://eztech.vn/" target="_blank" style="color: #FF6B35;">https://eztech.vn</a></li>
                <li>Hotline: <a href="tel:0877223579" style="color: #FF6B35;">0877.223.579</a></li>
                <li>Zalo: <a href="https://zalo.me/0877223579" target="_blank" style="color: #FF6B35;">0877.223.579</a></li>
                <li>Email: <a href="mailto:support@eztech.com.vn" style="color: #FF6B35;">support@eztech.com.vn</a></li>
                <li>Địa chỉ: <a href="https://maps.app.goo.gl/SGg4RYmnArjmwZy56" target="_blank" style="color: #FF6B35;">Số 72 đường số 6, KDC Cityland Park Hills, P.Gò Vấp, TP.HCM</a></li>
            </ol>
        </div>
        <div style="text-align: center; padding: 20px 0; border-top: 1px solid #eee; margin-top: 30px;">
          <p style="margin: 0; font-size: 12px; color: #888;">Email này được gửi tự động. Vui lòng khong trả lời thư này</p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #888;">&copy; ${new Date().getFullYear()} EZTECH. All rights reserved.</p>
        </div>
      </div>
    `;

    // Gửi email
    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      name: "Eztech.vn - VPS, Hosting, Cho thuê chỗ đặt & máy chủ vật lý, Server GPU",
    });

    console.log("Gửi email thành công!");
    return true;
  } catch (error) {
    console.error("Lỗi khi gửi email:", error.message);
    return false;
  }
}

// Hàm xử lý POST request - Đã tối ưu
function doPost(e) {
  try {
    console.log("=== XỬ LÝ REQUEST ===");

    let data;

    // Xử lý dữ liệu đầu vào
    if (e.postData && e.postData.contents) {
      console.log("Processing JSON data");
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      console.log("Processing Form data");
      data = {
        fullname: e.parameter.fullname,
        email: e.parameter.email,
        discountPercentage: parseInt(e.parameter.discountPercentage),
      };
    } else {
      throw new Error("Không nhận được dữ liệu");
    }

    console.log("Dữ liệu nhận được:", data);

    // Validation
    if (!data.fullname || !data.email || !data.discountPercentage) {
      throw new Error("Thiếu thông tin bắt buộc");
    }

    // Tạo mã giảm giá unique (không cần dò sheet DSM nữa)
    const discountCode = generateDiscountCode(data.discountPercentage);
    console.log("Mã giảm giá được tạo:", discountCode);

    // Lưu dữ liệu vào Google Sheets
    const ss = SpreadsheetApp.openById(
      "1lHI2kIc5l2-SECJws20RogL1Fv983CE6Fwy2Bn3GX58"
    );
    const dataSheet = ss.getSheetByName("DSTT");

    const timestamp = new Date();
    const newRow = [
      data.fullname,
      data.email,
      discountCode,
      data.discountPercentage,
      timestamp,
    ];

    dataSheet.appendRow(newRow);
    console.log("Đã lưu dữ liệu vào Google Sheets");

    // Gửi email
    const emailSent = sendDiscountEmail(
      data.email,
      data.fullname,
      discountCode,
      data.discountPercentage
    );

    // Tạo response
    const response = {
      success: true,
      discountCode: discountCode,
      emailSent: emailSent,
      message: "Xử lý thành công",
      timestamp: timestamp.toISOString(),
    };

    console.log("Response:", response);

    // Xử lý JSONP callback
    if (e.parameter && e.parameter.callback) {
      return ContentService.createTextOutput(
        e.parameter.callback + "(" + JSON.stringify(response) + ")"
      ).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    // Trả về JSON
    return ContentService.createTextOutput(
      JSON.stringify(response)
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error("Lỗi trong doPost:", error.message);

    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };

    // Xử lý JSONP callback cho lỗi
    if (e.parameter && e.parameter.callback) {
      return ContentService.createTextOutput(
        e.parameter.callback + "(" + JSON.stringify(errorResponse) + ")"
      ).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(
      JSON.stringify(errorResponse)
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
