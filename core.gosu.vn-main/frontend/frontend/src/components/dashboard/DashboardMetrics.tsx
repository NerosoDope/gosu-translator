/**
 * Component: DashboardMetrics
 * Purpose:
 *   - Main component hiển thị dashboard metrics
 *   - Load và display stats cards
 *   - Show loading và error states
 * 
 * Responsibilities:
 * - Fetch metrics từ API
 * - Display stats cards grid
 * - Handle loading và error states
 */

"use client";

import React, { useState, useEffect } from "react";
import StatsCard from "./StatsCard";
import { dashboardAPI } from "@/lib/api";
import { useToastContext } from "@/context/ToastContext";

interface Metrics {
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  roles: {
    total: number;
    system: number;
    custom: number;
    active: number;
  };
  permissions: {
    total: number;
    active: number;
  };
  user_roles: {
    total: number;
  };
}

export default function DashboardMetrics() {
  const toast = useToastContext();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await dashboardAPI.getMetrics();
      setMetrics(response.data);
    } catch (error: any) {
      console.error("Failed to load metrics:", error);
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Không thể tải metrics. Vui lòng thử lại.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard
        title="Tổng số Người dùng"
        value={metrics.users.total}
        icon={
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        }
        iconColor="bg-blue-500"
      />

      <StatsCard
        title="Người dùng Hoạt động"
        value={metrics.users.active}
        icon={
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        iconColor="bg-green-500"
      />

      <StatsCard
        title="Tổng số Vai trò"
        value={metrics.roles.total}
        icon={
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        }
        iconColor="bg-purple-500"
      />

      <StatsCard
        title="Tổng số Quyền"
        value={metrics.permissions.total}
        icon={
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        }
        iconColor="bg-orange-500"
      />
    </div>
  );
}

