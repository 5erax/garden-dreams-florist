// shortcut: pending contact details stay only in this tab; check history after a reload.
export async function sendCheckout(pending, ownerId, request, send) {
  if (pending.current?.ownerId !== ownerId) pending.current = null;
  const attempt = pending.current || { ownerId, request };
  pending.current = attempt;
  try {
    const order = await send(attempt.request);
    if (pending.current !== attempt)
      throw new Error("Phiên đăng nhập đã đổi. Kiểm tra đơn trong lịch sử của tài khoản đã đặt.");
    pending.current = null;
    return { order, request: attempt.request };
  } catch (error) {
    const rejected = error.cause;
    // A SQL rejection rolls back the transaction; a connection error can hide a saved order.
    if (pending.current === attempt &&
        (rejected?.code === "P0001" && !rejected.message?.includes("IDEMPOTENCY_CONFLICT") ||
         ["23514", "22P02", "22008", "42501"].includes(rejected?.code)))
      pending.current = null;
    throw error;
  }
}
