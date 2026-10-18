import { useEffect, useState } from 'react';
import BloomLoader from './BloomLoader.jsx';
import { call } from './backend.js';
import { money } from './catalog.js';
import { vietqrPayload } from './vietqr.js';
import { transferAmount } from './transfer-amount.js';

export function BankPayment({ order }) {
  const [qr, setQr] = useState(""),
    [error, setError] = useState("");
  const [amount,setAmount]=useState(null);
  const [retry, setRetry] = useState(0);
  const [copyNotice, setCopyNotice] = useState("");
  useEffect(() => {
    let active = true;
    setQr("");
    setAmount(null);setError("");
    if (
      order.payment_method !== "VIETQR" ||
      !["UNPAID","PARTIAL"].includes(order.payment_status) ||
      order.status === "CANCELLED"
    )
      return;
    transferAmount(order, (id) => call('gd_payment_balance', {p_order:id})).then(async value => {
      if (!active) return;
      setAmount(value);
      if (!value) return;
      const {default:QRCode} = await import('qrcode');
      const src = await QRCode.toDataURL(vietqrPayload(order.bank,value,order.reference),{width:240,margin:2,errorCorrectionLevel:'M'});
      if(active) setQr(src);
    }).catch(() => {
      if(active) setError('Chưa tải được số tiền hoặc mã QR. Thử lại trước khi chuyển khoản; không chuyển theo tổng đơn cũ.');
    });
    return () => {
      active = false;
    };
  }, [order, retry]);
  if (
    order.payment_method !== "VIETQR" ||
    !["UNPAID","PARTIAL"].includes(order.payment_status) ||
    order.status === "CANCELLED"
  )
    return null;
  if (amount === 0) return <p role="status">Đơn này không còn số tiền phải chuyển thêm.</p>;
  return (
    <aside className="bank-payment">
      <div>
        {qr && (
          <img
            src={qr}
            alt={`VietQR cho đơn ${order.reference}`}
            width="240"
            height="240"
          />
        )}
        {error && <p role="alert">{error} <button className="text-button" onClick={() => setRetry(value => value + 1)}>Thử lại thông tin thanh toán</button></p>}
      </div>
      <div>
        <span className="eyebrow">CHUYỂN KHOẢN VIETQR</span>
        <h3>{amount===null?(error?"Chưa xác nhận số phải thu":<BloomLoader compact label="Thông tin chuyển khoản"/>):money(amount)}</h3>
        <p>
          {order.bank.bankName}
          <br />
          <strong>{order.bank.accountName}</strong>
          <br />
          {order.bank.account}
        </p>
        <p>
          Nội dung: <strong>{order.reference}</strong>
        </p>
        <div className="payment-tools">
          {[['Sao chép số tài khoản', order.bank.account], ['Sao chép nội dung', order.reference]].map(([label, value]) => <button type="button" className="button outline" key={label} onClick={async () => {
            try { await navigator.clipboard.writeText(value); setCopyNotice(`${label}: đã chép.`); }
            catch { setCopyNotice("Chưa sao chép được. Bạn có thể chọn thông tin ở trên để chép thủ công."); }
          }}>{label}</button>)}
          {qr && <a className="text-link" href={qr} download={`${order.reference}-vietqr.png`}>Tải mã QR</a>}
        </div>
        {copyNotice && <p role="status">{copyNotice}</p>}
        <small>
          Kiểm tra đúng tên người nhận và số tiền trong ứng dụng ngân hàng.
          Trạng thái chỉ đổi khi admin kiểm tra đã nhận tiền.
        </small>
      </div>
    </aside>
  );
}
