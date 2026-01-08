/**
 * Page: Permissions Management
 * Purpose:
 *   - Display and manage permissions in the system
 *   - CRUD operations for permissions
 *   - Filter and search permissions
 * 
 * Notes:
 *   - Requires "rbac:permissions:read" permission to access
 *   - Permissions follow format: module:resource:action
 *   - Supports pagination and filtering
 * 
 * See also:
 *   - @/components/admin/permissions/PermissionsManagement.tsx for main component
 *   - docs/rbac.md for RBAC architecture
 */

"use client";

import React from "react";
import PermissionsManagement from "@/components/admin/permissions/PermissionsManagement";

export default function PermissionsPage() {
  return <PermissionsManagement />;
}

