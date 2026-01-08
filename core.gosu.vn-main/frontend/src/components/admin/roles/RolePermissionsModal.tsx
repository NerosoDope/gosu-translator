/**
 * Component: RolePermissionsModal
 * Purpose:
 *   - Modal to assign permissions to a role
 *   - Display available permissions grouped by module
 *   - Allow selecting/deselecting permissions
 * 
 * Responsibilities:
 * - Load available permissions
 * - Load current role permissions
 * - Display permissions grouped by module
 * - Handle permission assignment
 * 
 * Important:
 * - System roles cannot have permissions modified
 * - Permissions are grouped by module for better UX
 */

"use client";

import React, { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import { roleAPI, permissionAPI } from "@/lib/api";
import { useToastContext } from "@/context/ToastContext";

interface Permission {
  id: number;
  code: string;
  name: string;
  description?: string;
  module?: string;
  resource?: string;
  action?: string;
  is_active: boolean;
}

interface Role {
  id: number;
  code: string;
  name: string;
  is_system: boolean;
}

interface RolePermissionsModalProps {
  role: Role;
  onSuccess: () => void;
  onClose: () => void;
}

export default function RolePermissionsModal({
  role,
  onSuccess,
  onClose,
}: RolePermissionsModalProps) {
  const toast = useToastContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<number[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);

  useEffect(() => {
    loadData();
  }, [role.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load all permissions (backend limit is 100, so we may need multiple calls)
      let allPermissions: Permission[] = [];
      let skip = 0;
      const limit = 100; // Backend max limit
      let hasMore = true;
      
      while (hasMore) {
        const permsResponse = await permissionAPI.getPermissions({
          skip,
          limit,
          is_active: true,
        });
        const perms = Array.isArray(permsResponse.data) ? permsResponse.data : [];
        allPermissions = [...allPermissions, ...perms];
        
        // Nếu số permissions trả về < limit, đã load hết
        if (perms.length < limit) {
          hasMore = false;
        } else {
          skip += limit;
        }
      }
      
      setPermissions(allPermissions);

      // Load role permissions
      const rolePermsResponse = await roleAPI.getRolePermissions(role.id);
      const rolePerms = Array.isArray(rolePermsResponse.data)
        ? rolePermsResponse.data
        : [];
      const rolePermIds = rolePerms.map((p: Permission) => p.id);
      setRolePermissions(rolePermIds);
      setSelectedPermissions(rolePermIds);
    } catch (error: any) {
      console.error("Failed to load permissions:", error);
      toast.error(
        error.response?.data?.detail ||
          "Không thể tải danh sách quyền. Vui lòng thử lại."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (permissionId: number) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await roleAPI.assignPermissionsToRole(role.id, selectedPermissions);
      toast.success("Quyền đã được cập nhật thành công");
      onSuccess();
    } catch (error: any) {
      console.error("Failed to save permissions:", error);
      toast.error(
        error.response?.data?.detail ||
          "Không thể lưu quyền. Vui lòng thử lại."
      );
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by module
  const permissionsByModule = permissions.reduce((acc, perm) => {
    const module = perm.module || "other";
    if (!acc[module]) {
      acc[module] = [];
    }
    acc[module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading) {
    return (
      <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-start justify-center z-[99999] pt-4 pb-4 px-4 overflow-y-auto" style={{ margin: 0 }}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
          <div className="text-center">Đang tải...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-start justify-center z-[99999] pt-4 pb-4 px-4 overflow-y-auto" style={{ margin: 0 }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold">
            Quản lý Quyền - {role.name}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Chọn các quyền để gán cho vai trò này
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {Object.entries(permissionsByModule).map(([module, perms]) => (
            <div key={module} className="mb-6">
              <h3 className="text-lg font-semibold mb-3 capitalize">
                {module.replace(/_/g, " ")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {perms.map((perm) => (
                  <label
                    key={perm.id}
                    className="flex items-start gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(perm.id)}
                      onChange={() => handleTogglePermission(perm.id)}
                      className="mt-1 rounded"
                      disabled={role.is_system}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{perm.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {perm.code}
                      </div>
                      {perm.description && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {perm.description}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSave} isLoading={saving} disabled={role.is_system}>
            Lưu
          </Button>
        </div>
      </div>
    </div>
  );
}

