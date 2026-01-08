/**
 * Component: StatsCard
 * Purpose:
 *   - Hiển thị một metric card với icon, title, value
 *   - Support dark mode và responsive
 * 
 * Responsibilities:
 * - Display metric value với formatting
 * - Show icon với color coding
 * - Support hover effects
 */

"use client";

import React from "react";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  iconColor: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export default function StatsCard({
  title,
  value,
  icon,
  iconColor,
  trend,
}: StatsCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {trend && (
            <p
              className={`text-sm mt-2 ${
                trend.isPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className={`${iconColor} p-3 rounded-full flex-shrink-0 ml-4`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

