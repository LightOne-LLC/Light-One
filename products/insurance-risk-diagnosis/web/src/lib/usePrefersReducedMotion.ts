import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

// CSS側の @media (prefers-reduced-motion: reduce) はtransition/animationを
// 一律で即時化できるが、Rechartsのようにアニメーションの有無をJSのpropとして
// 渡す必要があるライブラリではCSSだけでは対応できない。そのためのフック。
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = () => setReduced(mql.matches);
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}
