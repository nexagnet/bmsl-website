import Image from 'next/image';
import icon from '../../assets/brand/bmsl-icon-transparent.png';

/** Navigation-bar icon in the Payload admin (`admin.components.graphics.Icon`): the BMSL favicon artwork on a white tile. */
export function AdminIcon() {
  return (
    <Image
      src={icon}
      alt="BMSL"
      width={28}
      height={28}
      style={{ background: '#fff', borderRadius: 6, padding: 2, objectFit: 'contain' }}
    />
  );
}
