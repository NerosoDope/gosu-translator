/**
 * Component: PermissionsManagement
 * Purpose:
 *   - Main component for permission management
 *   - Display permissions list with DataTable
 *   - Handle CRUD operations
 * 
 * Responsibilities:
 * - Load and display permissions list
 * - Handle pagination and filtering
 * - Open/close permission form modal
 * - Handle create/update/delete operations
 * 
 * Important:
 * - Requires "rbac:permissions:read" permission
 * - Toast notifications for success/error
 */

"use client";

import React, { useState, useEffect } from "react";
import DataTable, { Column } from "@/components/data/DataTable";
import Pagination from "@/components/data/Pagination";
import FilterBar from "@/components/data/FilterBar";
import Button from "@/components/ui/Button";
import { permissionAPI } from "@/lib/api";
import { useToastContext } from "@/context/ToastContext";
import { usePermissions } from "@/lib/rbac";
import PermissionForm from "./PermissionForm";

interface Permission {
  id: number;
  code: string;
  name: string;
  description?: string;
  module?: string;
  resource?: string;
  action?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export default function PermissionsManagement() {
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
  if (!hasPermission("rbac:permissions:read")) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          Bạn không có quyền truy cập trang này. Yêu cầu permission: rbac:permissions:read
        </div>
      </div>
    );
  }

  return <PermissionsManagementContent />;
}

function PermissionsManagementContent() {
  const toast = useToastContext();
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("rbac:permissions:write");
  const canDelete = hasPermission("rbac:permissions:delete");

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [deletingPermissionId, setDeletingPermissionId] = useState<number | null>(null);
  const [pagination, setPagination] = useState({
    skip: 0,
    limit: 10,
    total: 0,
  });

  // Filter states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [moduleFilter, setModuleFilter] = useState<string>("");

  // Reset pagination khi search hoặc filter thay đổi
  useEffect(() => {
    setPagination((prev) => ({ ...prev, skip: 0 }));
  }, [search, statusFilter, moduleFilter]);

  useEffect(() => {
    loadPermissions();
  }, [pagination.skip, pagination.limit, statusFilter, moduleFilter, search]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load tất cả permissions (vì API có limit 100, cần load nhiều lần)
      let allPermissions: Permission[] = [];
      let skip = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const params: any = {
          skip,
          limit,
        };

        if (statusFilter !== "") params.is_active = statusFilter === "true";
        if (moduleFilter) params.module = moduleFilter;

        const response = await permissionAPI.getPermissions(params);
        const data = Array.isArray(response.data) ? response.data : [];
        allPermissions = [...allPermissions, ...data];
        
        // Nếu số permissions trả về < limit, đã load hết
        if (data.length < limit) {
          hasMore = false;
        } else {
          skip += limit;
        }
      }

      // Filter by search on client side
      let filteredData = allPermissions;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredData = allPermissions.filter(
          (perm: Permission) =>
            perm.code.toLowerCase().includes(searchLower) ||
            perm.name.toLowerCase().includes(searchLower) ||
            perm.module?.toLowerCase().includes(searchLower)
        );
      }

      setPermissions(filteredData);
      setPagination((prev) => ({ ...prev, total: filteredData.length }));
    } catch (error: any) {
      console.error("Failed to load permissions:", error);
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Không thể tải danh sách quyền. Vui lòng thử lại.";
      setError(errorMessage);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPermission = () => {
    setEditingPermission(null);
    setShowForm(true);
  };

  const handleEditPermission = (permission: Permission) => {
    setEditingPermission(permission);
    setShowForm(true);
  };

  const handleDeletePermission = async (permission: Permission) => {
    // Confirmation với thông tin chi tiết hơn
    const confirmMessage = `Bạn có chắc chắn muốn xóa quyền này?\n\n` +
      `Mã: ${permission.code}\n` +
      `Tên: ${permission.name}\n\n` +
      `Lưu ý: Quyền sẽ bị xóa khỏi tất cả các vai trò đã được gán.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setDeletingPermissionId(permission.id);
      await permissionAPI.deletePermission(permission.id);
      toast.success(`Quyền "${permission.name}" (${permission.code}) đã được xóa thành công`);
      loadPermissions();
    } catch (error: any) {
      console.error("Failed to delete permission:", error);
      const errorMessage = error.response?.data?.detail || 
        error.response?.data?.message ||
        "Không thể xóa quyền. Vui lòng thử lại.";
      toast.error(errorMessage);
    } finally {
      setDeletingPermissionId(null);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingPermission(null);
    toast.success(
      editingPermission
        ? "Quyền đã được cập nhật thành công"
        : "Quyền đã được tạo thành công"
    );
    loadPermissions();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingPermission(null);
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.skip / pagination.limit) + 1;

  // Get unique modules from permissions
  const modules = Array.from(
    new Set(permissions.map((p) => p.module).filter(Boolean))
  ).sort();

  const columns: Column<Permission>[] = [
    {
      key: "code",
      header: "Mã",
      sortable: true,
      render: (perm: Permission) => (
        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{perm.code}</span>
      ),
    },
    {
      key: "name",
      header: "Tên",
      sortable: true,
      render: (perm: Permission) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{perm.name}</span>
      ),
    },
    {
      key: "module",
      header: "Module",
      sortable: true,
      render: (perm: Permission) => (
        <span className="text-gray-600 dark:text-gray-400">{perm.module || "-"}</span>
      ),
    },
    {
      key: "resource",
      header: "Resource",
      sortable: true,
      render: (perm: Permission) => (
        <span className="text-gray-600 dark:text-gray-400">{perm.resource || "-"}</span>
      ),
    },
    {
      key: "action",
      header: "Action",
      sortable: true,
      render: (perm: Permission) => (
        <span className="text-gray-600 dark:text-gray-400">{perm.action || "-"}</span>
      ),
    },
    {
      key: "is_active",
      header: "Trạng thái",
      sortable: true,
      render: (perm: Permission) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            perm.is_active
              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          {perm.is_active ? "Hoạt động" : "Không hoạt động"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      sortable: false,
      className: "text-right",
      render: (perm: Permission) => (
        <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
          {canWrite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditPermission(perm);
              }}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              title="Chỉnh sửa"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeletePermission(perm);
              }}
              disabled={deletingPermissionId === perm.id}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Xóa quyền"
            >
              {deletingPermissionId === perm.id ? (
                <svg
                  className="w-5 h-5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              )}
            </button>
          )}
        </div>
      ),
    },
  ];

  // Paginate permissions
  const paginatedPermissions = permissions.slice(
    pagination.skip,
    pagination.skip + pagination.limit
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quản lý Quyền</h1>
        {canWrite && <Button onClick={handleAddPermission}>Thêm Quyền</Button>}
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="true">Hoạt động</option>
              <option value="false">Không hoạt động</option>
            </select>
          </>
        }
      />

      <DataTable
        data={paginatedPermissions}
        columns={columns}
        isLoading={loading}
        emptyMessage="Không tìm thấy quyền. Nhấn 'Thêm Quyền' để tạo quyền đầu tiên."
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

      {showForm && (
        <PermissionForm
          permission={editingPermission}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
}

