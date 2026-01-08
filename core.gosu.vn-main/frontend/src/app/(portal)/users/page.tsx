/**
 * Page: Users Management
 * Purpose:
 *   - Display and manage users in the system
 *   - CRUD operations for users
 *   - Filter and search users
 * 
 * Notes:
 *   - Requires "users:read" permission to access
 *   - Users are synced from apis.gosu.vn after login
 *   - Supports pagination and filtering
 * 
 * See also:
 *   - @/components/admin/users/UsersManagement.tsx for main component
 *   - docs/architecture.md for user sync flow
 */

"use client";

import React from "react";
import UsersManagement from "@/components/admin/users/UsersManagement";

export default function UsersPage() {
  return <UsersManagement />;
}

