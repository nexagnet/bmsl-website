import Image from 'next/image';
import logo from '../../assets/brand/bmsl-logo-transparent.png';

/**
 * Login-page logo in the Payload admin (`admin.components.graphics.Logo`): the BMSL logo with the white background
 * removed (docs/brand/logo.md). The artwork is dark navy/blue, so the dark admin theme puts it on a white plate.
 */
export function AdminLogo() {
  return (
    <>
      <style>{`html[data-theme='dark'] .bmsl-admin-logo{background:#fff;border-radius:12px;padding:12px}`}</style>
      <Image
        className="bmsl-admin-logo"
        src={logo}
        alt="BMSL — Bình Minh Sông Lô"
        priority
        style={{ width: 'auto', maxWidth: '100%', height: 'auto', maxHeight: 160 }}
      />
    </>
  );
}
