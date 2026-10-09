export function crc16(value) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
export function vietqrPayload({ bin, account }, amount, reference) {
  if (
    !/^\d{6}$/.test(bin) ||
    !/^[A-Za-z0-9]{4,32}$/.test(account) ||
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > 100000000000 ||
    !/^[A-Z0-9-]{1,25}$/.test(reference)
  )
    throw new Error("Thông tin VietQR chưa hợp lệ.");
  const field = (id, text) => id + String(text.length).padStart(2, "0") + text;
  const beneficiary = field("00", bin) + field("01", account);
  const merchant =
    field("00", "A000000727") +
    field("01", beneficiary) +
    field("02", "QRIBFTTA");
  const payload =
    field("00", "01") +
    field("01", "12") +
    field("38", merchant) +
    field("53", "704") +
    field("54", String(amount)) +
    field("58", "VN") +
    field("62", field("08", reference)) +
    "6304";
  return payload + crc16(payload);
}
