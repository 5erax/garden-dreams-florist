# BU-02 — Email xác thực và callback

Chuẩn bị ngày 09/10/2026. Chưa cấu hình SMTP hay gửi email nghiệm thu. Chủ shop chưa có domain; ưu tiên thử miễn phí và không tự bật gói trả phí.

## Phương án đề xuất

| Cách                                        | Phạm vi phù hợp                                 | Điều kiện/giới hạn                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SMTP mặc định Supabase                      | Thử một tài khoản thuộc team trong lúc chuẩn bị | Chỉ gửi tới địa chỉ thuộc team; không đủ nghiệm thu đăng ký cho khách rộng rãi. [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).                                                                                                                                                                                                                   |
| Gmail SMTP của một tài khoản riêng cho shop | Đề xuất thử staging trước khi có domain         | Cần bật 2-Step Verification và tạo App Password nếu tài khoản hỗ trợ; dùng SMTP/TLS, không dùng mật khẩu Gmail chính. Không coi đây là hạ tầng gửi số lượng lớn hoặc SLA. [Google App Passwords](https://support.google.com/accounts/answer/185833), [Gmail SMTP](https://support.google.com/mail/answer/7104828).                                                  |
| Domain do shop sở hữu + Resend Free         | Đề xuất khi chuẩn bị mở bán                     | Free 3.000 email/tháng, 100/ngày; cần verified domain, chi phí domain tách khỏi SMTP. `resend.dev` chỉ gửi thử tới email tài khoản Resend. [Pricing](https://resend.com/pricing), [Testing domain](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).                                                                                             |
| Domain do shop sở hữu + Brevo Free          | Phương án khi cần hạn mức theo ngày lớn hơn     | Free 300 email/ngày, có transactional email. Cần domain/người gửi xác thực để bảo đảm alignment; không đề xuất gửi bằng địa chỉ Gmail qua Brevo. [Free plan](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans), [Domain setup](https://help.brevo.com/hc/en-us/articles/35852083084178-Domain-setup-for-better-email-deliverability). |

Chưa chọn domain, mua domain hoặc tạo account dịch vụ thay chủ shop. Không cần backend Vercel để gửi email Auth; SMTP cấu hình trực tiếp trên Supabase. Email trạng thái đơn có outbox riêng ở BU-17.

## Cấu hình có thể điền trực tiếp

Trong Authentication → Email/SMTP Settings của **project staging**, bật Custom SMTP. Mật khẩu SMTP chỉ điền tại dashboard; không gửi qua chat hoặc thêm vào biến `VITE_`, repo, Vercel frontend hay log.

| Trường       | Gmail staging                    | Resend khi đã có domain               |
| ------------ | -------------------------------- | ------------------------------------- |
| Sender name  | Garden Dreams — Thử nghiệm       | Garden Dreams                         |
| Sender email | Địa chỉ Gmail của tài khoản shop | Địa chỉ thuộc domain đã xác thực      |
| Host         | `smtp.gmail.com`                 | `smtp.resend.com`                     |
| Port         | `587` với TLS/STARTTLS           | `465` với TLS                         |
| Username     | Địa chỉ Gmail đầy đủ             | `resend`                              |
| Password     | App Password riêng của shop      | API key gửi mail riêng cho môi trường |

Google không cho mọi tài khoản tạo App Password; nếu không thấy tùy chọn, không giảm bảo vệ tài khoản để vượt điều kiện. Chọn provider/domain phù hợp. SMTP Gmail có thể bị chặn hoặc giới hạn; cần thử gửi/nhận thật trước khi dùng. [Gmail SMTP](https://support.google.com/mail/answer/7104828), [Resend Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp).

Giữ email confirmation bật và mật khẩu tối thiểu 12 ký tự. Không bật auto-confirm cho production để thay thế SMTP. Đặt rate limit Auth theo quota thực tế của provider; tắt link/open tracking cho email Auth để không viết lại link hoặc thu thập dữ liệu không cần thiết.

## URL Configuration

- Staging Site URL: URL preview hiện đang dùng; cập nhật khi chọn một alias staging ổn định.
- Staging redirect cho preview hiện tại: `https://garden-dreams-florist-8k1qq8aha-dhas-projects-901181f4.vercel.app/#account`.
- Staging redirect local: `http://127.0.0.1:5175/#account`; chạy dev với `--port 5175 --strictPort --mode staging` nếu dùng URL này.
- Nếu cần hỗ trợ các preview mới, chỉ thêm pattern của project/team staging: `https://garden-dreams-florist-*-dhas-projects-901181f4.vercel.app/**`. Không thêm pattern rộng cho mọi `vercel.app`.
- Production giữ Site URL `https://garden-dreams-florist.vercel.app` và redirect chính xác `https://garden-dreams-florist.vercel.app/#account`. Project production không nhận callback staging/local.

AuthPanel lấy callback từ origin đang mở; signup và reset gửi về `/#account`. SDK nhận session từ URL, handler `PASSWORD_RECOVERY` mở form đổi mật khẩu. Phiên giữ trong bộ nhớ; reload phải đăng nhập lại. [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Template email

Trong Email Templates của đúng project, đặt subject/body:

- Confirm signup: subject `Xác nhận tài khoản Garden Dreams`, body [confirmation.html](supabase/templates/confirmation.html).
- Reset password: subject `Khôi phục tài khoản Garden Dreams`, body [recovery.html](supabase/templates/recovery.html).

Staging thêm `[THỬ NGHIỆM]` trước subject. Link dùng `{{ .ConfirmationURL }}` của Supabase, không tự ghép bearer token vào trang ngoài. Không đặt pixel tracking hay nội dung đơn/lời nhắn riêng vào email xác thực. [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

## Nghiệm thu trước khi tick BU-02

- [ ] Hai địa chỉ email thử do chủ shop kiểm soát nhận email thật; mở link tới đúng môi trường và xác nhận/đăng nhập được.
- [ ] Khôi phục trả về form mật khẩu mới; link hết hạn/đã dùng có lỗi rõ, không lộ email/token trong log hoặc analytics.
- [ ] Đăng xuất xong không đọc được đơn; lỗi đăng nhập/đăng ký/khôi phục không xác nhận tài khoản người khác tồn tại.
- [ ] SMTP secret chỉ nằm tại backend/dashboard, quota phù hợp và link tracking tắt.
- [ ] Ghi giờ thử, môi trường, kết quả inbox/spam, callback và lỗi vào progress.md; không lưu mật khẩu/link xác nhận.

Hiện chưa có Gmail App Password hoặc provider/domain được cấu hình. Vì vậy chỉ hoàn tất phần chuẩn bị; BU-02 chưa đạt nghiệm thu gửi/nhận thật.
