/**
 * Component: AuditLogManagement
 * Purpose:
 *   - Main component for audit log management
 *   - Display audit logs list with filters
 *   - Handle pagination and search
 * 
 * Responsibilities:
 * - Load and display audit logs
 * - Handle pagination and filtering
 * - View audit log details
 * 
 * Important:
 * - Requires "audit:read" permission
 * - Supports multiple filters (user, module, action, date range)
 * - Toast notifications for errors
 */

"use client";

import React, { useState, useEffect } from "react";
import DataTable, { Column } from "@/components/data/DataTable";
import Pagination from "@/components/data/Pagination";
import FilterBar from "@/components/data/FilterBar";
import Button from "@/components/ui/Button";
import { auditAPI } from "@/lib/api";
import { useToastContext } from "@/context/ToastContext";
import { usePermissions } from "@/lib/rbac";

interface AuditLog {
  id: number;
  action: string;
  module: string;
  resource_type?: string;
  resource_id?: number;
  user_id?: number;
  user_email?: string;
  ip_address?: string;
  user_agent?: string;
  details?: any;
  created_at: string;
}

interface AuditLogListResponse {
  items: AuditLog[];
  total: number;
  skip: number;
  limit: number;
}

export default function AuditLogManagement() {
  const { hasPermission, loading } = usePermissions();
  
  // Hiển thị loading khi đang fetch permissions
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Đang tải quyền truy cập...</p>
        </div>
      </div>
    );
  }
  
  // Check permissions sau khi đã load xong
  if (!hasPermission("audit:read")) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          Bạn không có quyền truy cập trang này. Yêu cầu permission: audit:read
        </div>
      </div>
    );
  }

  return <AuditLogManagementContent />;
}

function AuditLogManagementContent() {
  const toast = useToastContext();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    skip: 0,
    limit: 10,
    total: 0,
  });

  // Filter states
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");

  // Reset pagination khi filter thay đổi
  useEffect(() => {
    setPagination((prev) => ({ ...prev, skip: 0 }));
  }, [moduleFilter, actionFilter, userFilter, search]);

  useEffect(() => {
    loadLogs();
  }, [pagination.skip, pagination.limit, moduleFilter, actionFilter, userFilter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        skip: pagination.skip,
        limit: pagination.limit,
      };

      if (moduleFilter) params.module = moduleFilter;
      if (actionFilter) params.action = actionFilter;
      if (userFilter) params.user_id = parseInt(userFilter);

      const response = await auditAPI.getLogs(params);
      const data: AuditLogListResponse = response.data;

      // Filter by search on client side
      let filteredData = data.items;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredData = data.items.filter(
          (log: AuditLog) =>
            log.action.toLowerCase().includes(searchLower) ||
            log.module.toLowerCase().includes(searchLower) ||
            log.user_email?.toLowerCase().includes(searchLower) ||
            log.resource_type?.toLowerCase().includes(searchLower)
        );
      }

      setLogs(filteredData);
      setPagination((prev) => ({ ...prev, total: data.total }));
    } catch (error: any) {
      console.error("Failed to load audit logs:", error);
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Không thể tải audit logs. Vui lòng thử lại.";
      setError(errorMessage);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.skip / pagination.limit) + 1;

  // Get unique modules and actions from logs
  const modules = Array.from(
    new Set(logs.map((log) => log.module).filter(Boolean))
  ).sort();
  const actions = Array.from(
    new Set(logs.map((log) => log.action).filter(Boolean))
  ).sort();

  const getActionBadgeColor = (action: string) => {
    if (action.includes("create")) return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
    if (action.includes("update")) return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
    if (action.includes("delete")) return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
    if (action.includes("login")) return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
    return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
  };

  const columns: Column<AuditLog>[] = [
    {
      key: "created_at",
      header: "Thời gian",
      sortable: true,
      render: (log: AuditLog) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {new Date(log.created_at).toLocaleString("vi-VN")}
        </span>
      ),
    },
    {
      key: "action",
      header: "Hành động",
      sortable: true,
      render: (log: AuditLog) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${getActionBadgeColor(log.action)}`}
        >
          {log.action}
        </span>
      ),
    },
    {
      key: "module",
      header: "Module",
      sortable: true,
      render: (log: AuditLog) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">{log.module}</span>
      ),
    },
    {
      key: "resource_type",
      header: "Resource",
      sortable: true,
      render: (log: AuditLog) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {log.resource_type || "-"}
        </span>
      ),
    },
    {
      key: "user_email",
      header: "Người dùng",
      sortable: true,
      render: (log: AuditLog) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {log.user_email || "System"}
        </span>
      ),
    },
    {
      key: "ip_address",
      header: "IP Address",
      sortable: false,
      render: (log: AuditLog) => (
        <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
          {log.ip_address || "-"}
        </span>
      ),
    },
  ];

  // API đã trả về đúng trang theo skip/limit, không slice lại trên client
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <Button onClick={loadLogs} variant="secondary">
          Làm mới
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        filters={
          <>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Tất cả Modules</option>
              {modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Tất cả Hành động</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </>
        }
      />

      <DataTable
        data={logs}
        columns={columns}
        isLoading={loading}
        emptyMessage="Không tìm thấy audit log nào."
      />

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) =>
            setPagination((prev) => ({
              ...prev,
              skip: (page - 1) * prev.limit,
            }))
          }
          pageSize={pagination.limit}
          totalItems={pagination.total}
        />
      )}
    </div>
  );
}

