import { useEffect, useRef, useState } from 'react';

export default function ShopPolicy({ value }) {
  const ref = useRef(null);
  const [length, setLength] = useState(value.length);
  function fit() {
    const field = ref.current;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight + 2}px`;
  }
  useEffect(() => {
    fit();
    let width = ref.current.clientWidth;
    const observer = new ResizeObserver(() => {
      if (ref.current.clientWidth !== width) { width = ref.current.clientWidth; fit(); }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <label>Chính sách đổi trả
    <textarea ref={ref} name="returns_policy" defaultValue={value} maxLength={4000}
      onInput={event => { setLength(event.target.value.length); fit(); }} />
    <small className="policy-counter">{length}/4.000 ký tự</small>
  </label>;
}
