import { notFound } from 'next/navigation';

/**
 * Any unknown route inside a known locale (e.g. /pt/qualquer-coisa) renders the
 * localized not-found page instead of falling through to Next's default 404.
 */
export default function CatchAllPage() {
  notFound();
}
