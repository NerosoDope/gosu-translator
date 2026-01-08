/**
 * Page: Roles Management
 * Purpose:
 *   - Display and manage roles in the system
 *   - CRUD operations for roles
 *   - Assign permissions to roles
 *   - Assign roles to users
 * 
 * Notes:
 *   - Requires "rbac:roles:read" permission to access
 *   - System roles (is_system=true) cannot be deleted/modified
 *   - Supports pagination and filtering
 * 
 * See also:
 *   - @/components/admin/roles/RolesManagement.tsx for main component
 *   - docs/rbac.md for RBAC architecture
 */

"use client";

import React from "react";
import RolesManagement from "@/components/admin/roles/RolesManagement";

export default function RolesPage() {
  return <RolesManagement />;
}

