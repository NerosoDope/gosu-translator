/**
 * Page: Dashboard
 * Purpose:
 *   - Main dashboard page với metrics và overview
 *   - Display stats cards và activity feed
 * 
 * Notes:
 *   - Requires authentication
 *   - Shows system overview metrics
 * 
 * See also:
 *   - @/components/dashboard/DashboardMetrics.tsx for metrics
 *   - @/components/dashboard/ActivityFeed.tsx for activities
 */

"use client";

import React from "react";
import DashboardMetrics from "@/components/dashboard/DashboardMetrics";
import ActivityFeed from "@/components/dashboard/ActivityFeed";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Tổng quan hệ thống GOSU Core Platform
        </p>
      </div>

      {/* Metrics Cards */}
      <DashboardMetrics />

      {/* Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}

