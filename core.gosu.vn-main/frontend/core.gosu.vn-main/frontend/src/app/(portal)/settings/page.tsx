/**
 * Page: Settings Management
 * Purpose:
 *   - Display and manage system settings
 *   - Group settings by category
 * 
 * Notes:
 *   - Requires "settings:read" permission to access
 *   - Supports bulk update operations
 *   - Settings are grouped by category (general, email, security, etc.)
 * 
 * See also:
 *   - @/components/admin/settings/SettingsManagement.tsx for main component
 */

"use client";

import React from "react";
import SettingsManagement from "@/components/admin/settings/SettingsManagement";

export default function SettingsPage() {
  return <SettingsManagement />;
}

