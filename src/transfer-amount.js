export async function transferAmount(order, readBalance) {
  const value = (await readBalance(order.id)).receivable;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('INVALID_PAYMENT_BALANCE');
  return value;
}
