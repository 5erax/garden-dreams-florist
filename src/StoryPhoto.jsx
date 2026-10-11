import { useEffect, useRef, useState } from 'react';

export default function StoryPhoto({ src, alt, caption, className }) {
  const ref = useRef(null);
  const [state, setState] = useState('loading');
  useEffect(() => {
    if (ref.current.complete) setState(ref.current.naturalWidth ? 'ready' : 'failed');
  }, [src]);
  return <figure className={`story-photo ${className}`} data-state={state}>
    <img ref={ref} src={src} alt={alt} width="720" height="900" loading="lazy"
      onLoad={() => setState('ready')} onError={() => setState('failed')} />
    {state !== 'ready' && <span className="story-photo-status" role="status">
      {state === 'failed' ? 'Chưa tải được ảnh. Bạn có thể tải lại trang để xem.' : 'Ảnh đang tải…'}
    </span>}
    <figcaption>{caption}</figcaption>
  </figure>;
}
