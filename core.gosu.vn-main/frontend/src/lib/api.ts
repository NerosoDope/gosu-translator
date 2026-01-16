/**
 * API Client Module - GOSU Core Frontend
 * 
 * Axios client được cấu hình sẵn để gọi API backend.
 */
//192.168.90.175
import axios from 'axios';

// Default to localhost; adjust to your backend host as needed.
const API_URL = 'http://localhost:8000';

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

// Response Interceptor - Xử lý Token Expiration và Network Errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    // Handle Network Errors
    if (!error.response) {
      // Network error - không có response từ server
      if (error.code === 'ECONNREFUSED' || error.message === 'Network Error') {
        error.message = `Không thể kết nối đến server. Vui lòng kiểm tra:
- Backend server đang chạy tại ${API_URL}
- CORS được cấu hình đúng
- Network connection hoạt động bình thường`;
      } else if (error.code === 'ETIMEDOUT') {
        error.message = 'Request timeout. Server không phản hồi kịp thời.';
      } else {
        error.message = error.message || 'Lỗi kết nối mạng. Vui lòng thử lại.';
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

// Cache API
export const cacheAPI = {
  getList: (params?: any) => apiClient.get(`/cache/`, { params }),
  get: (id: number) => apiClient.get(`/cache/${id}/`),
  create: (data: any) => apiClient.post(`/cache/`, data),
  update: (id: number, data: any) => apiClient.put(`/cache/${id}/`, data),
  delete: (id: number) => apiClient.delete(`/cache/${id}/`),
};

// Dictionary API
export const dictionaryAPI = {
  getList: (params?: any) => apiClient.get(`/dictionary`, { params }),
  get: (id: number) => apiClient.get(`/dictionary/${id}`),
  create: (data: any) => apiClient.post(`/dictionary`, data),
  update: (id: number, data: any) => apiClient.put(`/dictionary/${id}`, data),
  delete: (id: number) => apiClient.delete(`/dictionary/${id}`),
};

// Prompts API
export const promptsAPI = {
  getList: (params?: any) => apiClient.get(`/prompts`, { params }),
  get: (id: number) => apiClient.get(`/prompts/${id}`),
  create: (data: any) => apiClient.post(`/prompts`, data),
  update: (id: number, data: any) => apiClient.put(`/prompts/${id}`, data),
  delete: (id: number) => apiClient.delete(`/prompts/${id}`),
};

// Game Category API
export const gameCategoryAPI = {
  getList: (params?: any) => apiClient.get(`/game-category`, { params }),
  get: (id: number) => apiClient.get(`/game-category/${id}`),
  create: (data: any) => apiClient.post(`/game-category`, data),
  update: (id: number, data: any) => apiClient.put(`/game-category/${id}`, data),
  delete: (id: number) => apiClient.delete(`/game-category/${id}`),
  restore: (id: number) => apiClient.post(`/game-category/${id}/restore`),
};

// Game Glossary API
export const gameGlossaryAPI = {
  getList: (params?: any) => apiClient.get(`/game-glossary`, { params }),
  get: (id: number) => apiClient.get(`/game-glossary/${id}`),
  create: (data: any) => apiClient.post(`/game-glossary`, data),
  update: (id: number, data: any) => apiClient.put(`/game-glossary/${id}`, data),
  delete: (id: number) => apiClient.delete(`/game-glossary/${id}`),
};

// Language API
export const languageAPI = {
  // Languages
  getList: (params?: any) => apiClient.get(`/languages/`, { params }),
  get: (id: number) => apiClient.get(`/languages/${id}/`),
  create: (data: any) => apiClient.post(`/languages/`, data),
  update: (id: number, data: any) => apiClient.put(`/languages/${id}/`, data),
  delete: (id: number) => apiClient.delete(`/languages/${id}/`),
  restore: (id: number) => apiClient.post(`/languages/${id}/restore`),

  // Language Pairs
  getPairs: (params?: any) => apiClient.get(`/languages/pairs/`, { params }),
  getPair: (id: number) => apiClient.get(`/languages/pairs/${id}/`),
  createPair: (data: any) => apiClient.post(`/languages/pairs/`, data),
  updatePair: (id: number, data: any) => apiClient.put(`/languages/pairs/${id}/`, data),
  deletePair: (id: number) => apiClient.delete(`/languages/pairs/${id}/`),

  // Additional endpoints
  getAvailableTargets: (sourceLanguageId: number, organizationId?: number) =>
    apiClient.get(`/languages/${sourceLanguageId}/available-targets/`, {
      params: organizationId ? { organization_id: organizationId } : {}
    }),
};

// Job API
export const jobAPI = {
  getList: (params?: any) => apiClient.get(`/job`, { params }),
  get: (id: number) => apiClient.get(`/job/${id}`),
  create: (data: any) => apiClient.post(`/job`, data),
  update: (id: number, data: any) => apiClient.put(`/job/${id}`, data),
  delete: (id: number) => apiClient.delete(`/job/${id}`),
};

// Asset API
export const assetAPI = {
  getList: (params?: any) => apiClient.get(`/asset`, { params }),
  get: (id: number) => apiClient.get(`/asset/${id}`),
  create: (data: any) => apiClient.post(`/asset`, data),
  update: (id: number, data: any) => apiClient.put(`/asset/${id}`, data),
  delete: (id: number) => apiClient.delete(`/asset/${id}`),
};
