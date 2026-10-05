import type { ReactNode } from 'react';

export const metadata = {
  title: 'BMSL',
  description: 'BMSL website foundation',
};

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
