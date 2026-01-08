/**
 * Component: UserForm
 * Purpose:
 *   - Form for creating/editing users
 *   - Modal dialog for user form
 * 
 * Responsibilities:
 * - Display form fields (email, full_name, avatar, is_active)
 * - Validate form data
 * - Submit create/update requests
 * 
 * Important:
 * - Email is required and must be unique
 * - ID is required for create (from apis.gosu.vn)
 * - Users are typically synced from apis.gosu.vn, manual creation is rare
 */

"use client";

import React, { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { userAPI } from "@/lib/api";
import { useToastContext } from "@/context/ToastContext";

interface User {
  id: number;
  email: string;
  full_name?: string;
  avatar?: string;
  is_active: boolean;
}

interface UserFormProps {
  user?: User | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
  const toast = useToastContext();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: user?.id || 0,
    email: user?.email || "",
    full_name: user?.full_name || "",
    avatar: user?.avatar || "",
    is_active: user?.is_active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    if (!formData.email) {
      setErrors({ email: "Email là bắt buộc" });
      return;
    }

    if (!user && !formData.id) {
      setErrors({ id: "ID là bắt buộc (lấy từ apis.gosu.vn)" });
      return;
    }

    try {
      setLoading(true);
      if (user) {
        // Update
        await userAPI.updateUser(user.id, {
          full_name: formData.full_name || undefined,
          avatar: formData.avatar || undefined,
          is_active: formData.is_active,
        });
      } else {
        // Create
        await userAPI.createUser({
          id: formData.id,
          email: formData.email,
          full_name: formData.full_name || undefined,
          avatar: formData.avatar || undefined,
        });
      }
      onSuccess();
    } catch (error: any) {
      console.error("Failed to save user:", error);
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Không thể lưu người dùng. Vui lòng thử lại.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-start justify-center z-[99999] pt-4 pb-4 px-4 overflow-y-auto" style={{ margin: 0 }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {user ? "Chỉnh sửa Người dùng" : "Thêm Người dùng"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!user && (
            <Input
              label="ID (từ apis.gosu.vn)"
              type="number"
              value={formData.id || ""}
              onChange={(e) =>
                setFormData({ ...formData, id: parseInt(e.target.value) || 0 })
              }
              error={errors.id}
              required
            />
          )}

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            error={errors.email}
            required
            disabled={!!user} // Email cannot be changed after creation
          />

          <Input
            label="Tên đầy đủ"
            type="text"
            value={formData.full_name}
            onChange={(e) =>
              setFormData({ ...formData, full_name: e.target.value })
            }
          />

          <Input
            label="Avatar URL"
            type="url"
            value={formData.avatar}
            onChange={(e) =>
              setFormData({ ...formData, avatar: e.target.value })
            }
          />

          {user && (
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
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Hủy
            </Button>
            <Button type="submit" isLoading={loading}>
              {user ? "Cập nhật" : "Tạo"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

