/**
 * API Client Module - GOSU Core Frontend
 * 
 * Axios client được cấu hình sẵn để gọi API backend.
 */

import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor - Tự động thêm JWT Token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor - Xử lý Token Expiration
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

// Authentication API
export const authAPI = {
  login: (username: string, password: string) =>
    apiClient.post('/auth/login', { username, password }),
  
  refresh: (refresh_token: string) =>
    apiClient.post('/auth/refresh', { refresh_token }),
  
  logout: () => apiClient.post('/auth/logout'),
  
  getMe: () => apiClient.get('/auth/me'),
};

// User Management APIs
export const userAPI = {
  /**
   * Get Users List - Lấy danh sách users với pagination và filter
   */
  getUsers: (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    is_active?: boolean;
  }) => apiClient.get('/users', { params }),

  /**
   * Get User by ID - Lấy thông tin user theo ID
   */
  getUser: (userId: number) => apiClient.get(`/users/${userId}`),

  /**
   * Create User - Tạo user mới
   */
  createUser: (userData: {
    id?: number;
    email: string;
    full_name?: string;
    avatar?: string;
  }) => apiClient.post('/users', userData),

  /**
   * Update User - Cập nhật user
   */
  updateUser: (userId: number, userData: {
    full_name?: string;
    avatar?: string;
    is_active?: boolean;
  }) => apiClient.put(`/users/${userId}`, userData),

  /**
   * Delete User - Xóa user (soft delete)
   */
  deleteUser: (userId: number) => apiClient.delete(`/users/${userId}`),
};

// Role Management APIs
export const roleAPI = {
  /**
   * Get Roles List - Lấy danh sách roles
   */
  getRoles: (params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
  }) => apiClient.get('/rbac/roles', { params }),

  /**
   * Get Role by ID - Lấy thông tin role theo ID
   */
  getRole: (roleId: number) => apiClient.get(`/rbac/roles/${roleId}`),

  /**
   * Create Role - Tạo role mới
   */
  createRole: (roleData: {
    code: string;
    name: string;
    description?: string;
    is_system?: boolean;
    is_active?: boolean;
  }) => apiClient.post('/rbac/roles', roleData),

  /**
   * Update Role - Cập nhật role
   */
  updateRole: (roleId: number, roleData: {
    name?: string;
    description?: string;
    is_active?: boolean;
  }) => apiClient.put(`/rbac/roles/${roleId}`, roleData),

  /**
   * Delete Role - Xóa role
   */
  deleteRole: (roleId: number) => apiClient.delete(`/rbac/roles/${roleId}`),

  /**
   * Get Role Permissions - Lấy danh sách permissions của role
   */
  getRolePermissions: (roleId: number) => apiClient.get(`/rbac/roles/${roleId}/permissions`),

  /**
   * Assign Permissions to Role - Gán permissions cho role
   */
  assignPermissionsToRole: (roleId: number, permissionIds: number[]) =>
    apiClient.post(`/rbac/roles/${roleId}/permissions`, permissionIds),
};

// Permission Management APIs
export const permissionAPI = {
  /**
   * Get Permissions List - Lấy danh sách permissions
   */
  getPermissions: (params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
    module?: string;
    resource?: string;
  }) => apiClient.get('/rbac/permissions', { params }),

  /**
   * Get Permission by ID - Lấy thông tin permission theo ID
   */
  getPermission: (permissionId: number) => apiClient.get(`/rbac/permissions/${permissionId}`),

  /**
   * Create Permission - Tạo permission mới
   */
  createPermission: (permissionData: {
    code: string;
    name: string;
    description?: string;
    module?: string;
    resource?: string;
    action?: string;
    is_active?: boolean;
  }) => apiClient.post('/rbac/permissions', permissionData),

  /**
   * Update Permission - Cập nhật permission
   */
  updatePermission: (permissionId: number, permissionData: {
    name?: string;
    description?: string;
    module?: string;
    resource?: string;
    action?: string;
    is_active?: boolean;
  }) => apiClient.put(`/rbac/permissions/${permissionId}`, permissionData),

  /**
   * Delete Permission - Xóa permission
   */
  deletePermission: (permissionId: number) => apiClient.delete(`/rbac/permissions/${permissionId}`),
};

// User Role Assignment APIs
export const userRoleAPI = {
  /**
   * Assign Role to User - Gán role cho user
   */
  assignRoleToUser: (data: {
    user_id: number;
    role_id: number;
    organization_id?: number;
  }) => apiClient.post('/rbac/user-roles/assign', data),

  /**
   * Revoke Role from User - Thu hồi role của user
   */
  revokeRoleFromUser: (userId: number, roleId: number, organizationId?: number) =>
    apiClient.delete('/rbac/user-roles/revoke', {
      params: { user_id: userId, role_id: roleId, organization_id: organizationId }
    }),

  /**
   * Get User Roles - Lấy danh sách roles của user
   */
  getUserRoles: (userId: number, organizationId?: number) =>
    apiClient.get(`/rbac/user-roles/user/${userId}`, {
      params: organizationId ? { organization_id: organizationId } : {}
    }),
};

// Dashboard APIs
export const dashboardAPI = {
  /**
   * Get Dashboard Metrics - Lấy metrics cho dashboard
   */
  getMetrics: () => apiClient.get('/dashboard/metrics'),
};

// Audit Log APIs
export const auditAPI = {
  /**
   * Get Audit Logs - Lấy danh sách audit logs
   */
  getLogs: (params?: {
    skip?: number;
    limit?: number;
    user_id?: number;
    module?: string;
    action?: string;
    resource_type?: string;
    start_date?: string;
    end_date?: string;
  }) => apiClient.get('/audit/logs', { params }),

  /**
   * Get Audit Log by ID - Lấy chi tiết audit log
   */
  getLog: (logId: number) => apiClient.get(`/audit/logs/${logId}`),
};

// Settings APIs
export const settingsAPI = {
  /**
   * Get Settings - Lấy danh sách settings
   */
  getSettings: (params?: {
    category?: string;
    is_active?: boolean;
  }) => apiClient.get('/settings', { params }),

  /**
   * Get Public Settings - Lấy settings public (không cần auth)
   */
  getPublicSettings: () => apiClient.get('/settings/public'),

  /**
   * Get Setting by ID - Lấy thông tin setting theo ID
   */
  getSetting: (settingId: number) => apiClient.get(`/settings/${settingId}`),

  /**
   * Get Setting by Key - Lấy setting theo key
   */
  getSettingByKey: (key: string) => apiClient.get(`/settings/key/${key}`),

  /**
   * Create Setting - Tạo setting mới
   */
  createSetting: (settingData: {
    key: string;
    category: string;
    name: string;
    description?: string;
    value?: string;
    type?: string;
    is_encrypted?: boolean;
    is_public?: boolean;
    is_active?: boolean;
    order?: number;
    meta?: Record<string, any>;
  }) => apiClient.post('/settings', settingData),

  /**
   * Update Setting - Cập nhật setting
   */
  updateSetting: (settingId: number, settingData: {
    name?: string;
    description?: string;
    value?: string;
    type?: string;
    is_encrypted?: boolean;
    is_public?: boolean;
    is_active?: boolean;
    order?: number;
    meta?: Record<string, any>;
  }) => apiClient.put(`/settings/${settingId}`, settingData),

  /**
   * Update Setting Value - Cập nhật chỉ value
   */
  updateSettingValue: (settingId: number, value: string) =>
    apiClient.patch(`/settings/${settingId}/value`, { value }),

  /**
   * Bulk Update Settings - Cập nhật nhiều settings cùng lúc
   */
  bulkUpdateSettings: (settings: Record<string, string>) =>
    apiClient.post('/settings/bulk-update', { settings }),

  /**
   * Delete Setting - Xóa setting
   */
  deleteSetting: (settingId: number) => apiClient.delete(`/settings/${settingId}`),
};

