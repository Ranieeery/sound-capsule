import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware wrappers around the Next.js navigation APIs.
 * `usePathname()` returns the pathname without the locale prefix.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
