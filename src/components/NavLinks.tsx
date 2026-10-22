'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '../lib/site';

/** Home matches exactly; every other area also owns its child routes (e.g. /du-an/<slug>). */
export function isActivePath(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

type Props = {
  label: string;
  /** Closes the surrounding mobile disclosure after a link is followed. */
  closeMenuOnNavigate?: boolean;
};

export function NavLinks({ label, closeMenuOnNavigate = false }: Props) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="nav-list">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={
                  closeMenuOnNavigate
                    ? (event) => event.currentTarget.closest('details')?.removeAttribute('open')
                    : undefined
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
