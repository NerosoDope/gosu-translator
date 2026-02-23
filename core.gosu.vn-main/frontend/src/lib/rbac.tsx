/**
 * Module: lib/rbac
 * Purpose:
 *   - Frontend utilities for RBAC permission checks
 *   - Provide hooks and components for permission-based UI rendering
 *
 * Responsibilities:
 * - Fetch user permissions from API
 * - Provide permission checking functions
 * - Render components conditionally based on permissions
 *
 * Context:
 * - Permissions are fetched from /api/v1/auth/me endpoint
 * - Cached in React Query for performance
 * - Used throughout app for conditional rendering
 *
 * See also:
 * - docs/rbac.md for permission format and usage
 * - backend/app/modules/rbac for backend RBAC logic
 */

import React, { useState, useEffect } from 'react';
import { authAPI } from './api';

export interface Permission {
  id: number;
  code: string;
  name: string;
  module?: string;
  resource?: string;
  action?: string;
  is_active?: boolean;
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description?: string;
}

/**
 * Hook: usePermissions
 * 
 * Fetch and provide permission checking utilities for current user.
 *
 * This hook:
 * - Calls /api/v1/auth/me to get user permissions
 * - Caches result in React Query
 * - Provides permission checking functions
 *
 * Usage:
 *   const { hasPermission } = usePermissions();
 *   if (hasPermission('erp_hr:users:read')) { ... }
 *
 * Performance:
 * - Permissions are cached and only refetched on window focus (if enabled)
 * - Consider adding manual refetch after role changes
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const PERMISSIONS_TIMEOUT_MS = 10000;

    const fetchUser = async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Permissions fetch timeout')), PERMISSIONS_TIMEOUT_MS)
        );
        const response = await Promise.race([
          authAPI.getMe(),
          timeoutPromise,
        ]);
        const userData = response.data;
        setPermissions(userData?.permissions || []);
        setRoles(userData?.roles || []);
      } catch (error) {
        console.error('Failed to fetch user permissions:', error);
        setPermissions([]);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // Check if user has specific permission code
  // Returns false if permissions not loaded yet (safe default)
  const hasPermission = (permissionCode: string): boolean => {
    if (!permissions.length) return false;
    return permissions.some(p => p.code === permissionCode);
  };

  // Check if user has ANY of the provided permissions
  // Useful for endpoints that accept multiple permission alternatives
  const hasAnyPermission = (permissionCodes: string[]): boolean => {
    if (!permissions.length) return false;
    return permissionCodes.some(code => hasPermission(code));
  };

  // Check if user has specific role
  // Role checks are less granular than permission checks
  const hasRole = (roleCode: string): boolean => {
    if (!roles.length) return false;
    return roles.some(r => r.code === roleCode);
  };

  // Check if user has access to entire module
  // Returns true if user has ANY permission in the module
  const hasModuleAccess = (module: string): boolean => {
    if (!permissions.length) return false;
    return permissions.some(p => p.module === module && p.is_active !== false);
  };

  return {
    permissions,
    roles,
    loading,
    hasPermission,
    hasAnyPermission,
    hasRole,
    hasModuleAccess,
  };
}

/**
 * Component: Can (Permission Guard)
 * 
 * Conditionally render children based on user permission.
 *
 * Usage:
 *   <Can permission="erp_hr:users:read">
 *     <UserList />
 *   </Can>
 *
 *   <Can permission="admin:system:manage" fallback={<div>No access</div>}>
 *     <AdminPanel />
 *   </Can>
 *
 * Why this component:
 * - Centralizes permission checking logic
 * - Provides consistent fallback rendering
 * - Makes permission-based UI explicit and readable
 */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasPermission, loading } = usePermissions();
  
  // Hiển thị loading khi đang fetch permissions
  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Đang tải...</p>
        </div>
      </div>
    );
  }
  
  if (hasPermission(permission)) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
}

