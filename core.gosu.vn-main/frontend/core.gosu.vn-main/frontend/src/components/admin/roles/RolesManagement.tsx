/**
 * Component: RolesManagement
 * Purpose:
 *   - Main component for role management
 *   - Display roles list with DataTable
 *   - Handle CRUD operations
 *   - Assign permissions to roles
 * 
 * Responsibilities:
 * - Load and display roles list
 * - Handle pagination and filtering
 * - Open/close role form modal
 * - Handle create/update/delete operations
 * - Manage role permissions
 * 
 * Important:
 * - Requires "rbac:roles:read" permission
 * - System roles (is_system=true) cannot be deleted/modified
 * - Toast notifications for success/error
 */

"use client";

import React, { useState, useEffect } from "react";
import DataTable, { Column } from "@/components/data/DataTable";
import Pagination from "@/components/data/Pagination";
import FilterBar from "@/components/data/FilterBar";
import Button from "@/components/ui/Button";
import { roleAPI } from "@/lib/api";
import { useToastContext } from "@/context/ToastContext";
import { usePermissions } from "@/lib/rbac";
import RoleForm from "./RoleForm";
import RolePermissionsModal from "./RolePermissionsModal";

interface Role {
  id: number;
  code: string;
  name: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  permissions_count?: number;
}

export default function RolesManagement() {
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
  if (!hasPermission("rbac:roles:read")) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          Bạn không có quyền truy cập trang này. Yêu cầu permission: rbac:roles:read
        </div>
      </div>
    );
  }

  return <RolesManagementContent />;
}

function RolesManagementContent() {
  const toast = useToastContext();
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("rbac:roles:write");
  const canDelete = hasPermission("rbac:roles:delete");
  
  // Debug: Log permissions để kiểm tra
  React.useEffect(() => {
    console.log("Permissions check - canWrite:", canWrite, "canDelete:", canDelete);
  }, [canWrite, canDelete]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [pagination, setPagination] = useState({
    skip: 0,
    limit: 10,
    total: 0,
  });

  // Filter states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Reset pagination khi search hoặc filter thay đổi
  useEffect(() => {
    setPagination((prev) => ({ ...prev, skip: 0 }));
  }, [search, statusFilter]);

  useEffect(() => {
    loadRoles();
  }, [pagination.skip, pagination.limit, statusFilter, search]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        skip: pagination.skip,
        limit: pagination.limit,
      };

      if (statusFilter !== "") params.is_active = statusFilter === "true";

      const response = await roleAPI.getRoles(params);
      const data = Array.isArray(response.data) ? response.data : [];

      // Filter by search on client side (since API doesn't support search)
      let filteredData = data;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredData = data.filter(
          (role: Role) =>
            role.code.toLowerCase().includes(searchLower) ||
            role.name.toLowerCase().includes(searchLower)
        );
      }

      setRoles(filteredData);
      setPagination((prev) => ({ ...prev, total: filteredData.length }));
    } catch (error: any) {
      console.error("Failed to load roles:", error);
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Không thể tải danh sách vai trò. Vui lòng thử lại.";
      setError(errorMessage);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = () => {
    setEditingRole(null);
    setShowForm(true);
  };

  const handleEditRole = (role: Role) => {
    console.log("Edit role clicked:", role);
    if (role.is_system) {
      toast.error("Không thể chỉnh sửa vai trò hệ thống");
      return;
    }
    setEditingRole(role);
    setShowForm(true);
  };

  const handleDeleteRole = async (role: Role) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa vai trò "${role.name}"?`
      )
    ) {
      return;
    }

    try {
      await roleAPI.deleteRole(role.id);
      toast.success(`Vai trò "${role.name}" đã được xóa thành công`);
      loadRoles();
    } catch (error: any) {
      console.error("Failed to delete role:", error);
      toast.error(
        error.response?.data?.detail ||
          "Không thể xóa vai trò. Vui lòng thử lại."
      );
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingRole(null);
    toast.success(
      editingRole
        ? "Vai trò đã được cập nhật thành công"
        : "Vai trò đã được tạo thành công"
    );
    loadRoles();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingRole(null);
  };

  const handleManagePermissions = (role: Role) => {
    console.log("Manage permissions clicked:", role);
    if (role.is_system) {
      toast.error("Không thể chỉnh sửa quyền của vai trò hệ thống");
      return;
    }
    setSelectedRole(role);
    setShowPermissionsModal(true);
  };

  const handlePermissionsSuccess = () => {
    toast.success("Quyền đã được cập nhật thành công");
    loadRoles();
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({
      ...prev,
      skip: (newPage - 1) * prev.limit,
    }));
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.skip / pagination.limit) + 1;

  const columns = [
    {
      key: "code",
      header: "Mã",
      sortable: true,
      render: (role: Role) => (
        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{role.code}</span>
      ),
    },
    {
      key: "name",
      header: "Tên",
      sortable: true,
      render: (role: Role) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{role.name}</span>
      ),
    },
    {
      key: "description",
      header: "Mô tả",
      sortable: false,
      render: (role: Role) => (
        <span className="text-gray-600 dark:text-gray-400">{role.description || "-"}</span>
      ),
    },
    {
      key: "is_system",
      header: "Loại",
      sortable: true,
      render: (role: Role) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            role.is_system
              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
              : "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
          }`}
        >
          {role.is_system ? "Hệ thống" : "Tùy chỉnh"}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Trạng thái",
      sortable: true,
      render: (role: Role) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            role.is_active
              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          {role.is_active ? "Hoạt động" : "Không hoạt động"}
        </span>
      ),
    },
    {
      key: "permissions_count",
      header: "Số quyền",
      sortable: true,
      render: (role: Role) => (
        <div className="flex items-center gap-1">
          <svg
            className="w-4 h-4 text-gray-500 dark:text-gray-400"
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
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {role.permissions_count || 0}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      sortable: false,
      className: "text-right",
      render: (role: Role) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {canWrite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditRole(role);
              }}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Chỉnh sửa"
              disabled={role.is_system}
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
          {canWrite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleManagePermissions(role);
              }}
              className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Quản lý quyền"
              disabled={role.is_system}
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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </button>
          )}
          {canDelete && !role.is_system && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteRole(role);
              }}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              title="Xóa"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quản lý Vai trò</h1>
        {canWrite && <Button onClick={handleAddRole}>Thêm Vai trò</Button>}
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
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="true">Hoạt động</option>
            <option value="false">Không hoạt động</option>
          </select>
        }
      />

      <DataTable
        data={roles}
        columns={columns}
        isLoading={loading}
        emptyMessage="Không tìm thấy vai trò. Nhấn 'Thêm Vai trò' để tạo vai trò đầu tiên."
      />

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          pageSize={pagination.limit}
          totalItems={pagination.total}
        />
      )}

      {showForm && (
        <RoleForm
          role={editingRole}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}

      {showPermissionsModal && selectedRole && (
        <RolePermissionsModal
          role={selectedRole}
          onSuccess={handlePermissionsSuccess}
          onClose={() => {
            setShowPermissionsModal(false);
            setSelectedRole(null);
          }}
        />
      )}
    </div>
  );
}

