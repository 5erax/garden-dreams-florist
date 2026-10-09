export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST")
    return res
      .status(405)
      .setHeader("Allow", "POST")
      .json({ error: "Chỉ hỗ trợ gửi yêu cầu đặt hoa." });
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) throw new Error();
    } catch {
      return res.status(403).json({ error: "Yêu cầu không hợp lệ." });
    }
  }
  if (!req.headers["content-type"]?.startsWith("application/json"))
    return res.status(415).json({ error: "Định dạng yêu cầu chưa hợp lệ." });
  if (Number(req.headers["content-length"] || 0) > 16000)
    return res.status(413).json({ error: "Thông tin đặt hoa quá dài." });
  // Orders now go directly to Supabase RPC with the customer's authenticated session.
  return res.status(503).json({
    error:
      "Cửa hàng đang ở chế độ xem thử. Đơn hoa chưa được gửi; giỏ hàng của bạn vẫn được giữ.",
  });
}
