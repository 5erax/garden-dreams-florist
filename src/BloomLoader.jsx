import "./bloom-loader.css";

export default function BloomLoader({ label = "Bộ sưu tập hoa", compact = false }) {
  return <div className={`bloom-loader${compact ? " compact" : ""}`} role="status" aria-busy="true" aria-label={`Đang chuẩn bị ${label}`}>
    <span className="bloom-loader-flower" aria-hidden="true">{[0, 1, 2, 3, 4].map(petal => <i key={petal} style={{ "--petal": petal }} />)}</span>
    <span className="bloom-loader-copy"><strong>Garden Dreams</strong><span>{label}</span></span>
  </div>;
}
