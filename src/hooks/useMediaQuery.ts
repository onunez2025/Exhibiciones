import { useState, useEffect } from 'react';

// Puente entre un breakpoint CSS y una decisión de JS (qué modo de
// navegación usar en la lista de exhibiciones). Tailwind's `lg:` ya
// decide esto para el layout del sidebar en CSS puro; acá necesitamos
// saberlo en JS porque paginación clásica vs. scroll infinito son
// comportamientos de datos distintos, no solo estilos distintos.
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

    useEffect(() => {
        const mql = window.matchMedia(query);
        const handler = () => setMatches(mql.matches);
        handler();
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [query]);

    return matches;
}
