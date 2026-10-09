import { put, head, BlobNotFoundError } from "@vercel/blob";
import { validateOrder } from "../src/order.js";

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
  // shortcut: real sales stay disabled until shop details and the commercial hosting plan are configured.
  if (process.env.SHOP_ORDERS_ENABLED !== "true")
    return res
      .status(503)
      .json({
        error:
          "Cửa hàng đang ở chế độ xem thử. Đơn hoa chưa được gửi; giỏ hàng của bạn vẫn được giữ.",
      });
  let order;
  try {
    if (req.body?.website)
      return res.status(400).json({ error: "Yêu cầu không hợp lệ." });
    order = validateOrder(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const reference = `GD-${order.requestId.toUpperCase()}`;
  const pathname = `orders/${order.requestId}.json`;
  try {
    try {
      await head(pathname);
      return res.status(200).json({ reference, received: true });
    } catch (error) {
      if (!(error instanceof BlobNotFoundError)) throw error;
    }
    await put(
      pathname,
      JSON.stringify({
        ...order,
        reference,
        receivedAt: new Date().toISOString(),
      }),
      {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: false,
      },
    );
    return res.status(201).json({ reference, received: true });
  } catch {
    // Do not log customer contact details or discard the cart on a storage failure.
    return res
      .status(503)
      .json({
        error:
          "Chưa lưu được yêu cầu. Vui lòng thử lại; giỏ hoa của bạn vẫn được giữ.",
      });
  }
}
