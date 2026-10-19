import { useEffect, useState } from 'react';

// Largeur smartphone (< 640 px, breakpoint `sm` de Tailwind) : les graphiques adaptent
// leurs axes et étiquettes (recharts ne lit pas les classes CSS responsives).
const QUERY = '(max-width: 639px)';

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

// Axe des mois sur smartphone : initiale seule (« janv. » → « J »), le nom complet reste
// dans l'info-bulle et le tableau pour lecteurs d'écran.
export const monthInitial = (mois: string) => mois.charAt(0).toUpperCase();
