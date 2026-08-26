const CRYPTO_BLUE_TOKENS = {
    RADIUS: {
        CHIP: "rounded-cb-chip",
        BUTTON: "rounded-cb-btn",
        INPUT: "rounded-cb-btn",
        CARD: "rounded-cb-card",
        MODAL: "rounded-cb-modal",
        FULL: "rounded-full",
    },
    TYPOGRAPHY: {
        H1: "font-sans font-bold tracking-[-0.02em] text-[18px] leading-[1.2] text-cb-text-primary",
        H2: "font-sans font-bold tracking-[-0.01em] text-[15px] leading-[1.3] text-cb-text-primary",
        BODY: "font-sans font-normal text-[16px] leading-[1.5] text-cb-text-primary",
        BODY_SMALL: "font-sans font-normal text-[14px] leading-[1.5] text-cb-text-secondary",
    },
};

export const SIATC_THEME = {
    TOKENS: {
        ...CRYPTO_BLUE_TOKENS,
        MODAL_OVERLAY: "bg-slate-900/60 backdrop-blur-md",
    },

    LAYOUT: {
        PAGE_WRAPPER: "flex flex-col h-full bg-cb-bg min-h-0 animate-in fade-in duration-500 p-4 space-y-4",
        HEADER_WRAPPER: "flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 px-1",
        CONTENT_CONTAINER: "flex-1 min-h-0 flex flex-col bg-card border border-cb-border rounded-cb-card shadow-cb-level-1 overflow-hidden",
        SIDEBAR_INNER: "flex flex-col h-full bg-transparent text-cb-text-primary transition-all duration-500",
        SIDEBAR_ITEM_ACTIVE: "group/item flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 relative overflow-hidden bg-primary text-primary-foreground shadow-lg shadow-primary/25 translate-x-1",
        SIDEBAR_ITEM_INACTIVE: "group/item flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 relative overflow-hidden text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-1",
    },

    TYPOGRAPHY: {
        PAGE_TITLE: CRYPTO_BLUE_TOKENS.TYPOGRAPHY.H1,
        PAGE_SUBTITLE: `${CRYPTO_BLUE_TOKENS.TYPOGRAPHY.BODY_SMALL} hidden sm:block`,
    },

    COMPONENTS: {
        BUTTON_PRIMARY: "h-[36px] px-4 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-cb-btn hover:bg-primary/90 transition-all active:scale-95 font-bold text-sm shadow-sm",
        BUTTON_SECONDARY: "h-[36px] px-4 inline-flex items-center justify-center gap-2 bg-card text-cb-text-primary border border-cb-border rounded-cb-btn hover:bg-cb-bg/50 transition-all active:scale-95 font-bold text-sm",
        BUTTON_DANGER: "h-[36px] px-4 inline-flex items-center justify-center gap-2 bg-[#DF2935] text-white rounded-cb-btn hover:bg-[#DF2935]/90 transition-all active:scale-95 font-bold text-sm shadow-sm",
        MODAL_CONTENT: "bg-card text-cb-text-primary rounded-cb-modal border border-cb-border shadow-cb-level-3 overflow-hidden",
    },

    FORM: {
        FOOTER: "flex items-center gap-3 pt-4 border-t border-cb-border mt-2",
    },

    LOGIN_LAYOUT: {
        LEFT_PANEL: "hidden md:flex flex-col justify-between w-1/2 bg-primary text-white p-12 relative overflow-hidden",
        RIGHT_PANEL: "flex-1 flex flex-col justify-center items-center p-8 bg-[#F7F8FA] dark:bg-[#050B14] relative",
    },
};
