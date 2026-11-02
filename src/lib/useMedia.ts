import { useEffect, useState } from 'react';

/** Subscribes to a media query. Used to pick the mobile shell over the desktop one. */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** True on phones and narrow tablets — the breakpoint where the shell changes. */
export const useIsMobile = () => useMedia('(max-width: 860px)');
