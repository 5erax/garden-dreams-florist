export function authErrorMessage(error) {
  if (error?.code === "unexpected_failure" && error?.message === "Error sending confirmation email")
    return "Chưa gửi được email xác nhận. Vui lòng thử lại sau hoặc liên hệ cửa hàng.";
  if (error?.status >= 500)
    return "Dịch vụ tài khoản đang gặp lỗi. Vui lòng thử lại sau hoặc liên hệ cửa hàng.";
  if (error?.status === 429 || ["over_email_send_rate_limit", "over_request_rate_limit"].includes(error?.code))
    return "Bạn vừa gửi quá nhiều yêu cầu. Chờ vài phút rồi thử lại.";
  switch (error?.code) {
    case "invalid_credentials":
      return "Email hoặc mật khẩu chưa đúng. Kiểm tra thông tin hoặc dùng chức năng khôi phục mật khẩu.";
    case "email_not_confirmed":
      return "Email chưa được xác nhận. Kiểm tra hộp thư và mục Spam trước khi đăng nhập.";
    case "weak_password":
      return "Mật khẩu chưa đáp ứng yêu cầu. Dùng mật khẩu từ 12 ký tự và thử lại.";
    case "same_password":
      return "Mật khẩu mới cần khác mật khẩu hiện tại.";
    case "session_not_found":
    case "session_expired":
    case "otp_expired":
      return "Phiên hoặc liên kết đã hết hạn. Đăng nhập lại hoặc yêu cầu email khôi phục mới.";
    case "email_address_not_authorized":
    case "email_provider_disabled":
    case "signup_disabled":
      return "Chưa thể đăng ký hoặc gửi email xác thực. Vui lòng liên hệ cửa hàng.";
  }
  if (error?.name === "AuthRetryableFetchError" || error instanceof TypeError)
    return "Chưa kết nối được dịch vụ tài khoản. Kiểm tra Internet rồi thử lại.";
  return "Chưa thực hiện được. Kiểm tra thông tin và kết nối rồi thử lại.";
}
