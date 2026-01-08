/**
 * Page: Audit Log Management
 * Purpose:
 *   - Display and manage audit logs
 *   - Filter and search audit logs
 * 
 * Notes:
 *   - Requires "audit:read" permission to access
 *   - Shows all system activities and changes
 *   - Supports pagination and filtering
 * 
 * See also:
 *   - @/components/admin/audit/AuditLogManagement.tsx for main component
 */

"use client";

import React from "react";
import AuditLogManagement from "@/components/admin/audit/AuditLogManagement";

export default function AuditPage() {
  return <AuditLogManagement />;
}

