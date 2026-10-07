'use client';

import { useState } from 'react';

/**
 * Click-to-load OpenStreetMap embed. Nothing is requested from the third party until the visitor asks for the map,
 * so no consent banner is needed for this iframe. The src is built server-side from approved numeric coordinates.
 */
export function OfficeMap({ embedSrc, linkHref }: { embedSrc: string; linkHref: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="office-map">
      {loaded ? (
        <iframe
          title="Bản đồ vị trí trụ sở BMSL"
          src={embedSrc}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin"
          style={{ border: 0, width: '100%', height: '20rem' }}
        />
      ) : (
        <button type="button" className="btn" onClick={() => setLoaded(true)}>
          Hiển thị bản đồ (tải từ OpenStreetMap)
        </button>
      )}
      <p>
        <a href={linkHref} target="_blank" rel="noopener noreferrer">
          Mở bản đồ trên OpenStreetMap
        </a>
      </p>
    </div>
  );
}
