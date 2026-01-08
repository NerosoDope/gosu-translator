/**
 * Component: SettingsManagement
 * Purpose:
 *   - Main component for settings management
 *   - Display settings grouped by category
 *   - Handle bulk update operations
 * 
 * Responsibilities:
 * - Load and display settings by category
 * - Handle category switching
 * - Handle bulk save operations
 * - Display settings with appropriate input types
 * 
 * Important:
 * - Requires "settings:read" permission
 * - Supports multiple setting types (string, integer, boolean, json, text)
 * - Toast notifications for success/error
 */

"use client";

import React, { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import { settingsAPI } from "@/lib/api";
import { useToastContext } from "@/context/ToastContext";
import { usePermissions } from "@/lib/rbac";

interface Setting {
  id?: number;
  key: string;
  category: string;
  name: string;
  description?: string;
  value?: string;
  type: string;
  is_encrypted: boolean;
  is_public: boolean;
  is_active: boolean;
  order: number;
  meta?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

const CATEGORIES = [
  { value: "general", label: "Thông tin chung", icon: "⚙️" },
  { value: "email", label: "Cấu hình Email", icon: "📧" },
  { value: "security", label: "Bảo mật", icon: "🔒" },
  { value: "system", label: "Hệ thống", icon: "💻" },
  { value: "integration", label: "Tích hợp", icon: "🔗" },
  { value: "notification", label: "Thông báo", icon: "🔔" },
];

// Default settings cho mỗi category - hiển thị ngay cả khi chưa có trong database
const DEFAULT_SETTINGS: Record<string, Omit<Setting, "id" | "created_at" | "updated_at">[]> = {
  general: [
    {
      key: "app_name",
      category: "general",
      name: "Tên ứng dụng",
      description: "Tên hiển thị của ứng dụng",
      value: "",
      type: "string",
      is_encrypted: false,
      is_public: true,
      is_active: true,
      order: 1,
    },
    {
      key: "app_description",
      category: "general",
      name: "Mô tả ứng dụng",
      description: "Mô tả ngắn về ứng dụng",
      value: "",
      type: "text",
      is_encrypted: false,
      is_public: true,
      is_active: true,
      order: 2,
    },
    {
      key: "app_logo",
      category: "general",
      name: "Logo ứng dụng",
      description: "URL của logo ứng dụng",
      value: "",
      type: "string",
      is_encrypted: false,
      is_public: true,
      is_active: true,
      order: 3,
    },
  ],
  email: [
    {
      key: "smtp_host",
      category: "email",
      name: "SMTP Host",
      description: "Địa chỉ SMTP server",
      value: "",
      type: "string",
      is_encrypted: false,
      is_public: false,
      is_active: true,
      order: 1,
    },
    {
      key: "smtp_port",
      category: "email",
      name: "SMTP Port",
      description: "Cổng SMTP (thường là 587 hoặc 465)",
      value: "",
      type: "integer",
      is_encrypted: false,
      is_public: false,
      is_active: true,
      order: 2,
    },
    {
      key: "smtp_username",
      category: "email",
      name: "SMTP Username",
      description: "Tên đăng nhập SMTP",
      value: "",
      type: "string",
      is_encrypted: false,
      is_public: false,
      is_active: true,
      order: 3,
    },
    {
      key: "smtp_password",
      category: "email",
      name: "SMTP Password",
      description: "Mật khẩu SMTP",
      value: "",
      type: "string",
      is_encrypted: true,
      is_public: false,
      is_active: true,
      order: 4,
    },
    {
      key: "smtp_from_email",
      category: "email",
      name: "Email gửi đi",
      description: "Địa chỉ email mặc định để gửi email",
      value: "",
      type: "string",
      is_encrypted: false,
      is_public: false,
      is_active: true,
      order: 5,
    },
  ],
  security: [
    {
      key: "jwt_secret",
      category: "security",
      name: "JWT Secret",
      description: "Secret key cho JWT tokens",
      value: "",
      type: "string",
      is_encrypted: true,
      is_public: false,
      is_active: true,
      order: 1,
    },
    {
      key: "jwt_expiration_hours",
      category: "security",
      name: "JWT Expiration (giờ)",
      description: "Thời gian hết hạn của JWT token (tính bằng giờ)",
      value: "24",
      type: "integer",
      is_encrypted: false,
      is_public: false,
      is_active: true,
      order: 2,
    },
    {
      key: "password_min_length",
      category: "security",
      name: "Độ dài mật khẩu tối thiểu",
      description: "Số ký tự tối thiểu cho mật khẩu",
      value: "8",
      type: "integer",
      is_encrypted: false,
      is_public: false,
      is_active: true,
      order: 3,
    },
  ],
  system: [
    {
      key: "maintenance_mode",
      category: "system",
      name: "Chế độ bảo trì",
      description: "Bật/tắt chế độ bảo trì hệ thống",
      value: "false",
      type: "boolean",
      is_encrypted: false,
      is_public: true,
      is_active: true,
      order: 1,
    },
    {
      key: "max_upload_size_mb",
      category: "system",
      name: "Kích thước upload tối đa (MB)",
      description: "Kích thước file upload tối đa tính bằng MB",
      value: "10",
      type: "integer",
      is_encrypted: false,
      is_public: false,
      is_active: true,
      order: 2,
    },
  ],
  integration: [
    {
      key: "openai_api_key",
      category: "integration",
      name: "OpenAI API Key",
      description: "API key cho OpenAI (sk-...)",
      value: "",
      type: "string",
      is_encrypted: true,
      is_public: false,
      is_active: true,
      order: 1,
    },
    {
      key: "openai_model",
      category: "integration",
      name: "OpenAI Model",
      description: "Model OpenAI mặc định (ví dụ: gpt-4, gpt-3.5-turbo)",
      value: "gpt-3.5-turbo",
      type: "string",
      is_encrypted: false,
      is_public: false,
      is_active: true,
      order: 2,
    },
  ],
  notification: [
    {
      key: "enable_email_notifications",
      category: "notification",
      name: "Bật thông báo Email",
      description: "Bật/tắt gửi thông báo qua email",
      value: "true",
      type: "boolean",
      is_encrypted: false,
      is_public: false,
      is_active: true,
      order: 1,
    },
  ],
};

const SETTING_TYPES: Record<string, string> = {
  string: "Text",
  integer: "Số nguyên",
  boolean: "True/False",
  json: "JSON",
  text: "Văn bản dài",
};

export default function SettingsManagement() {
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
  if (!hasPermission("settings:read")) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          Bạn không có quyền truy cập trang này. Yêu cầu permission: settings:read
        </div>
      </div>
    );
  }

  return <SettingsManagementContent />;
}

function SettingsManagementContent() {
  const toast = useToastContext();
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("settings:write");

  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("general");
  const [editingSettings, setEditingSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [selectedCategory]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getSettings({
        category: selectedCategory,
        is_active: true,
      });
      const loadedSettings = response.data || [];
      
      // Merge với default settings - ưu tiên settings từ database
      const defaultSettings = DEFAULT_SETTINGS[selectedCategory] || [];
      const settingsMap = new Map<string, Setting>();
      
      // Thêm default settings trước
      defaultSettings.forEach((defaultSetting) => {
        settingsMap.set(defaultSetting.key, {
          ...defaultSetting,
          id: undefined,
        } as Setting);
      });
      
      // Override với settings từ database
      loadedSettings.forEach((setting: Setting) => {
        settingsMap.set(setting.key, setting);
      });
      
      const mergedSettings = Array.from(settingsMap.values()).sort(
        (a: Setting, b: Setting) => a.order - b.order
      );
      setSettings(mergedSettings);
      
      // Initialize editing state với cả default và loaded settings
      const initialEditing: Record<string, string> = {};
      mergedSettings.forEach((setting: Setting) => {
        initialEditing[setting.key] = setting.value || "";
      });
      setEditingSettings(initialEditing);
    } catch (error: any) {
      console.error('Failed to load settings:', error);
      // Nếu lỗi, vẫn hiển thị default settings
      const defaultSettings = DEFAULT_SETTINGS[selectedCategory] || [];
      setSettings(defaultSettings.map(s => ({ ...s, id: undefined } as Setting)));
      
      const initialEditing: Record<string, string> = {};
      defaultSettings.forEach((setting) => {
        initialEditing[setting.key] = setting.value || "";
      });
      setEditingSettings(initialEditing);
      
      toast.error(error.response?.data?.detail || 'Không thể tải cài đặt');
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (key: string, value: string) => {
    setEditingSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    if (!canWrite) {
      toast.error("Bạn không có quyền chỉnh sửa cài đặt");
      return;
    }

    try {
      setSaving(true);
      const updates: Record<string, string> = {};
      const creates: Array<Omit<Setting, "id" | "created_at" | "updated_at">> = [];
      
      settings.forEach(setting => {
        const originalValue = setting.value || "";
        const editedValue = editingSettings[setting.key] || "";
        
        // Nếu có thay đổi
        if (originalValue !== editedValue) {
          // Nếu setting đã tồn tại trong DB (có id), update
          if (setting.id) {
            updates[setting.key] = editedValue;
          } else {
            // Nếu setting chưa tồn tại (không có id), tạo mới
            creates.push({
              ...setting,
              value: editedValue,
            });
          }
        }
      });

      // Tạo các settings mới
      for (const newSetting of creates) {
        try {
          await settingsAPI.createSetting({
            key: newSetting.key,
            category: newSetting.category,
            name: newSetting.name,
            description: newSetting.description,
            value: newSetting.value,
            type: newSetting.type,
            is_encrypted: newSetting.is_encrypted,
            is_public: newSetting.is_public,
            is_active: newSetting.is_active,
            order: newSetting.order,
            meta: newSetting.meta,
          });
        } catch (error: any) {
          console.error(`Failed to create setting ${newSetting.key}:`, error);
          // Continue với các settings khác
        }
      }

      // Update các settings đã tồn tại
      if (Object.keys(updates).length > 0) {
        await settingsAPI.bulkUpdateSettings(updates);
      }

      if (creates.length === 0 && Object.keys(updates).length === 0) {
        toast.info('Không có thay đổi nào để lưu');
        return;
      }

      toast.success(`Đã lưu ${creates.length + Object.keys(updates).length} cài đặt thành công`);
      loadSettings(); // Reload để lấy giá trị mới
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      toast.error(error.response?.data?.detail || 'Không thể lưu cài đặt');
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (setting: Setting) => {
    const value = editingSettings[setting.key] || "";
    
    switch (setting.type) {
      case "boolean":
        return (
          <select
            value={value}
            onChange={(e) => handleValueChange(setting.key, e.target.value)}
            disabled={!canWrite}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      
      case "integer":
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleValueChange(setting.key, e.target.value)}
            disabled={!canWrite}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
          />
        );
      
      case "text":
        return (
          <textarea
            value={value}
            onChange={(e) => handleValueChange(setting.key, e.target.value)}
            rows={4}
            disabled={!canWrite}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
          />
        );
      
      case "json":
        return (
          <textarea
            value={value}
            onChange={(e) => handleValueChange(setting.key, e.target.value)}
            rows={4}
            disabled={!canWrite}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm dark:bg-gray-700 dark:text-white disabled:opacity-50"
            placeholder='{"key": "value"}'
          />
        );
      
      default: // string
        return (
          <input
            type={setting.is_encrypted ? "password" : "text"}
            value={value}
            onChange={(e) => handleValueChange(setting.key, e.target.value)}
            disabled={!canWrite}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
            placeholder={setting.description || ""}
          />
        );
    }
  };

  const categorySettings = settings.filter(s => s.category === selectedCategory);
  const categoryInfo = CATEGORIES.find(c => c.value === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cài đặt Hệ Thống</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Quản lý các cấu hình hệ thống
          </p>
        </div>
        {canWrite && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu tất cả"}
          </Button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <button
              key={category.value}
              onClick={() => setSelectedCategory(category.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === category.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              <span className="mr-2">{category.icon}</span>
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* Settings Form */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Đang tải...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">{categoryInfo?.icon}</span>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {categoryInfo?.label}
            </h2>
          </div>

          {categorySettings.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>Chưa có cài đặt nào trong danh mục này.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {categorySettings.map((setting) => (
                <div key={setting.key} className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                        {setting.name}
                      </label>
                      {setting.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          {setting.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded">
                          {SETTING_TYPES[setting.type] || setting.type}
                        </span>
                        {setting.is_encrypted && (
                          <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 rounded">
                            🔒 Mã hóa
                          </span>
                        )}
                        {setting.is_public && (
                          <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded">
                            🌐 Public
                          </span>
                        )}
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                          {setting.key}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    {renderInput(setting)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

