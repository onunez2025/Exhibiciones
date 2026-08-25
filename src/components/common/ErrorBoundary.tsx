import React from 'react';
import { SIATC_THEME } from '../../utils/siatc-theme.js';

interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-8 bg-[#F9FAFB] dark:bg-[#050F1A]">
                    <div className={SIATC_THEME.COMPONENTS.MODAL_CONTENT + ' max-w-md w-full p-8 text-center space-y-4'}>
                        <p className="text-4xl">⚠️</p>
                        <h2 className={SIATC_THEME.TOKENS.TYPOGRAPHY.H1}>Algo salió mal</h2>
                        <p className={SIATC_THEME.TOKENS.TYPOGRAPHY.BODY_SMALL}>
                            {this.state.error?.message || 'Error inesperado. Recarga la página.'}
                        </p>
                        <button
                            className={SIATC_THEME.COMPONENTS.BUTTON_PRIMARY}
                            onClick={() => window.location.reload()}
                        >
                            Recargar
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
