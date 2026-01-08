/**
 * Component: RoleForm
 * Purpose:
 *   - Form for creating/editing roles
 *   - Modal dialog for role form
 * 
 * Responsibilities:
 * - Display form fields (code, name, description, is_active)
 * - Validate form data
 * - Submit create/update requests
 * 
 * Important:
 * - Code is required and must be unique (UPPER_SNAKE_CASE)
 * - System roles cannot be edited
 * - Code cannot be changed after creation
 */

"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { roleAPI } from "@/lib/api";
import { useToastContext } from "@/context/ToastContext";

interface Role {
  id: number;
  code: string;
  name: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
}

interface RoleFormProps {
  role?: Role | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function RoleForm({ role, onSuccess, onCancel }: RoleFormProps) {
  const toast = useToastContext();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: role?.code || "",
    name: role?.name || "",
    description: role?.description || "",
    is_active: role?.is_active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    if (!formData.code) {
      setErrors({ code: "Mã vai trò là bắt buộc" });
      return;
    }

    if (!formData.name) {
      setErrors({ name: "Tên vai trò là bắt buộc" });
      return;
    }

    // Validate code format (UPPER_SNAKE_CASE)
    if (!/^[A-Z][A-Z0-9_]*$/.test(formData.code)) {
      setErrors({
        code: "Mã vai trò phải là UPPER_SNAKE_CASE (ví dụ: ADMIN, MANAGER)",
      });
      return;
    }

    try {
      setLoading(true);
      if (role) {
        // Update
        await roleAPI.updateRole(role.id, {
          name: formData.name,
          description: formData.description || undefined,
          is_active: formData.is_active,
        });
      } else {
        // Create
        await roleAPI.createRole({
          code: formData.code.toUpperCase(),
          name: formData.name,
          description: formData.description || undefined,
          is_active: formData.is_active,
        });
      }
      onSuccess();
    } catch (error: any) {
      console.error("Failed to save role:", error);
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Không thể lưu vai trò. Vui lòng thử lại.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-start justify-center z-[99999] pt-4 pb-4 px-4 overflow-y-auto" style={{ margin: 0 }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {role ? "Chỉnh sửa Vai trò" : "Thêm Vai trò"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Mã vai trò (UPPER_SNAKE_CASE)"
            type="text"
            value={formData.code}
            onChange={(e) =>
              setFormData({ ...formData, code: e.target.value.toUpperCase() })
            }
            error={errors.code}
            required
            disabled={!!role} // Code cannot be changed after creation
            placeholder="ADMIN, MANAGER, EMPLOYEE"
          />

          <Input
            label="Tên vai trò"
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            error={errors.name}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mô tả
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
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
              {role ? "Cập nhật" : "Tạo"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

