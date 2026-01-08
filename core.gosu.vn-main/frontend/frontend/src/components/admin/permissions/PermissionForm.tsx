/**
 * Component: PermissionForm
 * Purpose:
 *   - Form for creating/editing permissions
 *   - Modal dialog for permission form
 * 
 * Responsibilities:
 * - Display form fields (code, name, description, module, resource, action, is_active)
 * - Auto-generate code from module:resource:action
 * - Validate form data
 * - Submit create/update requests
 * 
 * Important:
 * - Code format: {module}:{resource}:{action}
 * - Code cannot be changed after creation
 * - Module, resource, action are required
 */

"use client";

import React, { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { permissionAPI } from "@/lib/api";
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

interface PermissionFormProps {
  permission?: Permission | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PermissionForm({ permission, onSuccess, onCancel }: PermissionFormProps) {
  const toast = useToastContext();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: permission?.code || "",
    name: permission?.name || "",
    description: permission?.description || "",
    module: permission?.module || "",
    resource: permission?.resource || "",
    action: permission?.action || "",
    is_active: permission?.is_active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-generate code from module:resource:action
  useEffect(() => {
    if (!permission && formData.module && formData.resource && formData.action) {
      const code = `${formData.module}:${formData.resource}:${formData.action}`;
      setFormData((prev) => ({ ...prev, code }));
    }
  }, [formData.module, formData.resource, formData.action, permission]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    if (!formData.code) {
      setErrors({ code: "Mã quyền là bắt buộc" });
      return;
    }

    if (!formData.name) {
      setErrors({ name: "Tên quyền là bắt buộc" });
      return;
    }

    // Validate code format
    if (!/^[a-z_]+:[a-z_]+:[a-z_]+$/.test(formData.code)) {
      setErrors({
        code: "Mã quyền phải theo format: module:resource:action (ví dụ: users:read:write)",
      });
      return;
    }

    try {
      setLoading(true);
      if (permission) {
        // Update
        await permissionAPI.updatePermission(permission.id, {
          name: formData.name,
          description: formData.description || undefined,
          module: formData.module || undefined,
          resource: formData.resource || undefined,
          action: formData.action || undefined,
          is_active: formData.is_active,
        });
      } else {
        // Create
        await permissionAPI.createPermission({
          code: formData.code,
          name: formData.name,
          description: formData.description || undefined,
          module: formData.module || undefined,
          resource: formData.resource || undefined,
          action: formData.action || undefined,
          is_active: formData.is_active,
        });
      }
      onSuccess();
    } catch (error: any) {
      console.error("Failed to save permission:", error);
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Không thể lưu quyền. Vui lòng thử lại.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-start justify-center z-[99999] pt-4 pb-4 px-4 overflow-y-auto" style={{ margin: 0 }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {permission ? "Chỉnh sửa Quyền" : "Thêm Quyền"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Mã quyền (module:resource:action)"
            type="text"
            value={formData.code}
            onChange={(e) => handleChange("code", e.target.value)}
            error={errors.code}
            required
            disabled={!!permission} // Code cannot be changed after creation
            placeholder="users:read:write"
          />

          <Input
            label="Tên quyền"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            error={errors.name}
            required
            placeholder="Đọc và ghi người dùng"
          />

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Module *
              </label>
              <input
                type="text"
                value={formData.module}
                onChange={(e) => handleChange("module", e.target.value)}
                disabled={!!permission || loading}
                required
                placeholder="users"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resource *
              </label>
              <input
                type="text"
                value={formData.resource}
                onChange={(e) => handleChange("resource", e.target.value)}
                disabled={!!permission || loading}
                required
                placeholder="read"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Action *
              </label>
              <select
                value={formData.action}
                onChange={(e) => handleChange("action", e.target.value)}
                disabled={!!permission || loading}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Chọn hành động</option>
                <option value="read">read</option>
                <option value="write">write</option>
                <option value="delete">delete</option>
                <option value="approve">approve</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mô tả
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => handleChange("is_active", e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Hoạt động
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Hủy
            </Button>
            <Button type="submit" isLoading={loading}>
              {permission ? "Cập nhật" : "Tạo"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

