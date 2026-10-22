'use client';

import type { KeyboardEvent, ReactNode } from 'react';

/**
 * Native disclosure (works without JavaScript); the script only adds Escape-to-close and returns focus to the
 * toggle so keyboard users are not left inside a hidden menu.
 */
export function MobileMenu({ children }: { children: ReactNode }) {
  function onKeyDown(event: KeyboardEvent<HTMLDetailsElement>) {
    const menu = event.currentTarget;
    if (event.key === 'Escape' && menu.open) {
      menu.removeAttribute('open');
      menu.querySelector('summary')?.focus();
    }
  }
  return (
    <details className="mobile-menu" onKeyDown={onKeyDown}>
      <summary>Menu</summary>
      {children}
    </details>
  );
}
