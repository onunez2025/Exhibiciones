import React, { createContext, useContext, useState, useCallback } from 'react';
import { cn } from '../utils/cn.js';
import { SIATC_THEME } from '../utils/siatc-theme.js';

interface DialogOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary';
}

interface DialogContextType {
    confirm: (options: DialogOptions) => Promise<boolean>;
    alert: (title: string, message: string) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
    const [dialog, setDialog] = useState<(DialogOptions & { resolve: (v: boolean) => void }) | null>(null);

    const confirm = useCallback((options: DialogOptions): Promise<boolean> => {
        return new Promise(resolve => {
            setDialog({ ...options, resolve });
        });
    }, []);

    const alert = useCallback((title: string, message: string): Promise<void> => {
        return confirm({ title, message, confirmLabel: 'Aceptar', cancelLabel: '' }).then(() => undefined);
    }, [confirm]);

    const handleClose = (value: boolean) => {
        dialog?.resolve(value);
        setDialog(null);
    };

    return (
        <DialogContext.Provider value={{ confirm, alert }}>
            {children}
            {dialog && (
                <div className={cn('fixed inset-0 z-[150] flex items-center justify-center p-4', SIATC_THEME.TOKENS.MODAL_OVERLAY)}>
                    <div className={SIATC_THEME.COMPONENTS.MODAL_CONTENT + ' w-full max-w-sm'}>
                        <div className="px-6 py-5 border-b border-cb-border">
                            <h3 className="text-sm font-black uppercase tracking-wider">{dialog.title}</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className={SIATC_THEME.TOKENS.TYPOGRAPHY.BODY_SMALL}>{dialog.message}</p>
                            <div className={cn(SIATC_THEME.FORM.FOOTER, 'mt-0')}>
                                {dialog.cancelLabel !== '' && (
                                    <button
                                        className={cn(SIATC_THEME.COMPONENTS.BUTTON_SECONDARY, 'flex-1 h-11 cursor-pointer')}
                                        onClick={() => handleClose(false)}
                                    >
                                        {dialog.cancelLabel || 'Cancelar'}
                                    </button>
                                )}
                                <button
                                    className={cn(
                                        dialog.variant === 'danger'
                                            ? SIATC_THEME.COMPONENTS.BUTTON_DANGER
                                            : SIATC_THEME.COMPONENTS.BUTTON_PRIMARY,
                                        'flex-1 h-11 cursor-pointer'
                                    )}
                                    onClick={() => handleClose(true)}
                                >
                                    {dialog.confirmLabel || 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    );
}

export function useDialog(): DialogContextType {
    const ctx = useContext(DialogContext);
    if (!ctx) throw new Error('useDialog must be used inside DialogProvider');
    return ctx;
}
