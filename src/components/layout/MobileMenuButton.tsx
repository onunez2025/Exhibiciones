import { useOutletContext } from 'react-router-dom';
import { Menu } from 'lucide-react';

export interface LayoutOutletContext {
    openMobileMenu: () => void;
}

// Cada página lo pone junto a su propio título (dentro de HEADER_WRAPPER)
// en vez de que viva solo en una barra fija separada — así el botón de
// menú y el título quedan en la misma fila en mobile, no uno encima del
// otro. openMobileMenu llega vía el contexto de <Outlet> que expone
// MainLayout, sin necesidad de un context provider aparte.
export function MobileMenuButton() {
    const { openMobileMenu } = useOutletContext<LayoutOutletContext>();
    return (
        <button
            type="button"
            onClick={openMobileMenu}
            className="p-2 -ml-2 text-muted-foreground hover:bg-white hover:text-primary rounded-xl lg:hidden shrink-0 transition-colors duration-150 active:scale-90 cursor-pointer"
        >
            <Menu className="w-6 h-6" />
        </button>
    );
}

export default MobileMenuButton;
