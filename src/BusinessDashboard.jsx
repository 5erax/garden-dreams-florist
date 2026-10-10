import BloomDate from "./BloomDate.jsx";
import { useEffect, useState } from 'react';
import { call } from './backend.js';
import { money } from './catalog.js';
import { vietnamDate } from './order.js';
import BloomLoader from './BloomLoader.jsx';
import './business-dashboard.css';

export default function BusinessDashboard() {
  const today = vietnamDate();
  const [period, setPeriod] = useState({ from: `${today.slice(0, 7)}-01`, to: today });
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setReport(null); setError('');
    call('gd_business_dashboard', { p_from: period.from, p_to: period.to })
      .then(data => { if (current) setReport(data); })
      .catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [period, revision]);
  function exportDaily() {
    const text = '\uFEFFNgày,Đơn tạo,Giá trị đơn chưa hủy,Tiền thu trừ hoàn\r\n' + report.daily.map(d =>
      `${d.day},${d.orders},${d.bookedValue},${d.netCash}`).join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `garden-dreams-${report.from}-${report.to}.csv`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="business-dashboard" aria-label="Thống kê cửa hàng">
    <div className="portal-section-heading"><div><span className="eyebrow">CỬA HÀNG TRONG NHỮNG CON SỐ</span><h2>Tổng quan kinh doanh</h2></div></div>
    <form className="dashboard-period" onSubmit={e => {
      e.preventDefault(); const data = new FormData(e.currentTarget);
      setPeriod({ from: data.get('from'), to: data.get('to') }); setRevision(n => n + 1);
    }}>
      <label>Từ ngày<BloomDate  name="from" required defaultValue={period.from} /></label>
      <label>Đến ngày<BloomDate  name="to" required defaultValue={period.to} /></label>
      <button className="button primary">Xem báo cáo</button>
      {report && <button type="button" className="button outline" onClick={exportDaily}>Xuất CSV theo ngày</button>}
    </form>
    <p className="dashboard-note">Tối đa 92 ngày, theo giờ Việt Nam. Đơn theo ngày tạo; tiền theo ngày ghi nhận thu/hoàn. Báo cáo không chứa thông tin giao hàng.</p>
    {error ? <p role="alert" className="form-error">{error} <button className="text-button" onClick={() => setRevision(n => n + 1)}>Thử lại</button></p> : !report ? <BloomLoader label="Báo cáo cửa hàng" /> : <>
      {report.staging && <p className="portal-notice">Môi trường thử nghiệm — bao gồm đơn thử, không dùng làm báo cáo kinh doanh thật.</p>}
      <p className="dashboard-note">Kỳ {report.from} → {report.to} · Cập nhật {new Date(report.generatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
      <div className="dashboard-metrics">
        {[
          ['Giá trị đơn chưa hủy', money(report.orders.bookedValue), `${report.orders.count} đơn tạo, ${report.orders.cancelled} đơn hủy`],
          ['Tiền đã thu trong kỳ', money(report.cash.received), 'Khoản thu đã được admin đối soát'],
          ['Tiền đã hoàn trong kỳ', money(report.cash.refunded), 'Khoản hoàn thực tế đã ghi nhận'],
          ['Thu trừ hoàn trong kỳ', money(report.cash.netCollected), 'Dòng tiền, chưa phải lợi nhuận'],
          ['Còn phải thu hiện tại', money(report.receivableNow), 'Mọi đơn chưa hủy, chưa nhận tiền; không giới hạn kỳ'],
          ['Khách đặt trong kỳ', report.orders.buyers, 'Phiên/tài khoản có đơn chưa hủy'],
        ].map(([label, value, note]) => <article className="dashboard-metric" key={label}><h3>{label}</h3><strong>{value}</strong><p>{note}</p></article>)}
      </div>
      <div className="dashboard-columns">
        <article className="dashboard-card"><h3>Đơn hoa theo ngày</h3><p>{report.orders.pending} chờ xác nhận · {report.orders.delivered} đã giao</p>
          <div className="dashboard-bars" aria-hidden="true">{report.daily.map(d => <i key={d.day} title={`${d.day}: ${d.orders} đơn`} style={{ height: `${Math.max(2, d.orders / Math.max(1, ...report.daily.map(x => x.orders)) * 100)}%` }} />)}</div>
          <details><summary>Xem số liệu biểu đồ</summary><div className="admin-table-wrap"><table><thead><tr><th>Ngày</th><th>Đơn</th><th>Giá trị đơn</th><th>Thu trừ hoàn</th></tr></thead><tbody>{report.daily.map(d => <tr key={d.day}><td>{d.day}</td><td>{d.orders}</td><td>{money(d.bookedValue)}</td><td>{money(d.netCash)}</td></tr>)}</tbody></table></div></details>
        </article>
        <article className="dashboard-card"><h3>Khách & tương tác mua</h3><p><strong>{report.buyersAllTime}</strong> phiên/tài khoản đã đặt đơn chưa hủy từ trước đến nay.</p><p><strong>{report.repeatBuyersAllTime}</strong> phiên/tài khoản có từ hai đơn chưa hủy.</p><p><strong>{report.publicMemories}</strong> lời nhắn tự nguyện xuất hiện trong vườn kỉ niệm.</p><p className="dashboard-note">Một người có thể dùng nhiều phiên khách. Đây là người đặt đơn, không phải lượt truy cập hay số người duy nhất.</p></article>
        <article className="dashboard-card"><h3>Phương thức thanh toán đã chọn</h3>{report.methods.length ? report.methods.map(m => <p key={m.method}><strong>{m.method === 'COD' ? 'COD' : 'Chuyển khoản'}</strong> · {m.orders} đơn · {money(m.value)}</p>) : <p>Chưa có đơn chưa hủy trong kỳ.</p>}<p className="dashboard-note">Lựa chọn khi đặt đơn chưa chứng minh đã nhận tiền. Đối soát tại mục Đối soát tiền.</p></article>
        <article className="dashboard-card"><h3>Hoa được đặt nhiều</h3>{report.flowers.length ? <ol>{report.flowers.map((f, i) => <li key={i}>{f.name} · {f.quantity} bó · {money(f.value)}</li>)}</ol> : <p>Chưa có dữ liệu đặt hoa trong kỳ.</p>}<p className="dashboard-note">Đơn chưa hủy theo ngày tạo. Giá trị hoa chưa gồm phí giao, chưa phải doanh thu đã thu.</p></article>
        <article className="dashboard-card"><h3>SEO & chất lượng danh mục</h3><p>{report.catalog.sale} mẫu bán · {report.catalog.reference} mẫu tham khảo.</p><ul><li>{report.catalog.missingSlug} mẫu thiếu đường dẫn riêng.</li><li>{report.catalog.shortDescription} mẫu có mô tả dưới 120 ký tự.</li><li>{report.catalog.pendingImages} mẫu bán còn ảnh SVG/thiếu ảnh.</li></ul><a href="https://search.google.com/search-console" target="_blank" rel="noreferrer">Mở Google Search Console ↗</a><p className="dashboard-note">Chưa kết nối Search Console: chưa có lượt hiển thị, nhấp hoặc thứ hạng Google. Các số ở đây đo chất lượng dữ liệu, không chứng nhận hiệu quả SEO.</p></article>
        <article className="dashboard-card"><h3>Cần chú ý khi vận hành</h3><p>Kiểm soát tồn: <strong>{report.inventoryEnabled ? 'Đã bật' : 'Chưa bật'}</strong>.</p><p>Giá trị đơn đã giao và hiện đã thu: {money(report.orders.deliveredPaidValue)} (theo ngày tạo đơn).</p><p>Số dư thu cũ: {money(report.cash.legacyReceiptBalance)} · Hoàn cũ: {money(report.cash.legacyRefundBalance)}. Tách khỏi dòng tiền trong kỳ.</p><p className="dashboard-note">Chưa tính lợi nhuận: cần giá vốn và chi phí vận hành đầy đủ. Mở báo cáo lại sau khi xử lý đơn để nhận số liệu mới.</p></article>
      </div>
    </>}
  </section>;
}
