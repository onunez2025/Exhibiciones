import type { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth.js';

interface RequirePermissionProps {
    permission: string;
    fallback?: ReactNode;
    children: ReactNode;
}

export function RequirePermission({ permission, fallback = null, children }: RequirePermissionProps) {
    const { hasPermission } = useAuth();
    return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
}
