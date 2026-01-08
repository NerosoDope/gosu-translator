/**
 * Component: UsersManagement
 * Purpose:
 *   - Main component for user management
 *   - Display users list with DataTable
 *   - Handle CRUD operations
 * 
 * Responsibilities:
 * - Load and display users list
 * - Handle pagination and filtering
 * - Open/close user form modal
 * - Handle create/update/delete operations
 * 
 * Important:
 * - Requires "users:read" permission
 * - Uses react-query for data fetching (can be added later)
 * - Toast notifications for success/error
 */

"use client";

import React, { useState, useEffect } from "react";
import DataTable, { Column } from "@/components/data/DataTable";
import Pagination from "@/components/data/Pagination";
import FilterBar from "@/components/data/FilterBar";
import Button from "@/components/ui/Button";
import { userAPI } from "@/lib/api";
import { useToastContext } from "@/context/ToastContext";
import { usePermissions } from "@/lib/rbac";
import UserForm from "./UserForm";

interface User {
  id: number;
  email: string;
  full_name?: string;
  avatar?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UserListResponse {
  items: User[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export default function UsersManagement() {
  const { hasPermission, loading } = usePermissions();
  const toast = useToastContext();
  
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
  if (!hasPermission("users:read")) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          Bạn không có quyền truy cập trang này. Yêu cầu permission: users:read
        </div>
      </div>
    );
  }

  return <UsersManagementContent />;
}

function UsersManagementContent() {
  const toast = useToastContext();
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("users:write");
  const canDelete = hasPermission("users:delete");

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    pages: 0,
  });

  // Filter states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    loadUsers();
  }, [pagination.page, pagination.per_page, search, statusFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: pagination.page,
        per_page: pagination.per_page,
      };

      if (search) params.search = search;
      if (statusFilter !== "") params.is_active = statusFilter === "true";

      const response = await userAPI.getUsers(params);
      const data: UserListResponse = response.data;

      setUsers(data.items || []);
      setPagination({
        page: data.page,
        per_page: data.per_page,
        total: data.total,
        pages: data.pages,
      });
    } catch (error: any) {
      console.error("Failed to load users:", error);
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Không thể tải danh sách người dùng. Vui lòng thử lại.";
      setError(errorMessage);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa người dùng "${user.email}"? (Soft delete - set is_active=false)`
      )
    ) {
      return;
    }

    try {
      await userAPI.deleteUser(user.id);
      toast.success(`Người dùng "${user.email}" đã được xóa thành công`);
      loadUsers();
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      toast.error(
        error.response?.data?.detail ||
          "Không thể xóa người dùng. Vui lòng thử lại."
      );
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingUser(null);
    toast.success(
      editingUser
        ? "Người dùng đã được cập nhật thành công"
        : "Người dùng đã được tạo thành công"
    );
    loadUsers();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingUser(null);
  };

  const columns = [
    {
      key: "id",
      header: "ID",
      sortable: true,
      render: (user: User) => (
        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{user.id}</span>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      render: (user: User) => (
        <div className="flex items-center gap-2">
          {user.avatar && (
            <img
              src={user.avatar}
              alt={user.email}
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-gray-900 dark:text-gray-100">{user.email}</span>
        </div>
      ),
    },
    {
      key: "full_name",
      header: "Tên đầy đủ",
      sortable: true,
      render: (user: User) => (
        <span className="text-gray-600 dark:text-gray-400">{user.full_name || "-"}</span>
      ),
    },
    {
      key: "is_active",
      header: "Trạng thái",
      sortable: true,
      render: (user: User) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            user.is_active
              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          {user.is_active ? "Hoạt động" : "Không hoạt động"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      sortable: false,
      className: "text-right",
      render: (user: User) => (
        <div className="flex items-center gap-2">
          {canWrite && (
            <button
              onClick={() => handleEditUser(user)}
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
              onClick={() => handleDeleteUser(user)}
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
        <h1 className="text-2xl font-bold">Quản lý Người dùng</h1>
        {canWrite && (
          <Button onClick={handleAddUser}>Thêm Người dùng</Button>
        )}
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
        data={users}
        columns={columns}
        isLoading={loading}
        emptyMessage="Không tìm thấy người dùng. Nhấn 'Thêm Người dùng' để tạo người dùng đầu tiên."
      />

      {pagination.pages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          onPageChange={(page) =>
            setPagination((prev) => ({ ...prev, page }))
          }
          pageSize={pagination.per_page}
          totalItems={pagination.total}
        />
      )}

      {showForm && (
        <UserForm
          user={editingUser}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
}

