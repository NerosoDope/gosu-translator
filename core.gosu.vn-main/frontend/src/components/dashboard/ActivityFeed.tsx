/**
 * Component: ActivityFeed
 * Purpose:
 *   - Hiển thị recent activities (placeholder cho tương lai)
 *   - Có thể tích hợp với audit log sau này
 * 
 * Responsibilities:
 * - Display recent activities list
 * - Show activity type, user, timestamp
 * - Support pagination (future)
 */

"use client";

import React from "react";

export default function ActivityFeed() {
  // Placeholder - sẽ tích hợp với audit log sau
  const activities = [
    {
      id: 1,
      type: "user_created",
      message: "Người dùng mới đã được tạo",
      user: "System",
      timestamp: new Date().toLocaleString("vi-VN"),
    },
    {
      id: 2,
      type: "role_assigned",
      message: "Vai trò đã được gán cho người dùng",
      user: "Admin",
      timestamp: new Date().toLocaleString("vi-VN"),
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Hoạt động gần đây
      </h3>
      <div className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Chưa có hoạt động nào
          </p>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0"
            >
              <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900 dark:text-white">
                  {activity.message}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {activity.user} • {activity.timestamp}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

