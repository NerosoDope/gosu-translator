/**
 * API Client Module - GOSU Core Frontend
 * 
 * Axios client được cấu hình sẵn để gọi API backend.
 * Khi NEXT_PUBLIC_USE_API_PROXY=true: dùng /api/v1 (proxy qua Next.js) - tránh CORS, login từ máy khác hoạt động.
 */
import axios from 'axios';

// ── SSE event types cho translate-file-stream ──
export interface TranslateStreamStartEvent {
  type: 'start';
  total: number;
  batch_total: number;
}
export interface TranslateStreamProgressEvent {
  type: 'progress';
  done: number;
  total: number;
  batch_done: number;
  batch_total: number;
  percent: number;
  batch_size: number;
  batch_tokens: number;
}
export interface TranslateStreamDoneEvent {
  type: 'done';
  columns: string[];
  rows: Record<string, string>[];
  translated_json?: Record<string, unknown> | null;
  translated_docx_b64?: string | null;
}
export interface TranslateStreamErrorEvent {
  type: 'error';
  message: string;
}
export type TranslateStreamEvent =
  | TranslateStreamStartEvent
  | TranslateStreamProgressEvent
  | TranslateStreamDoneEvent
  | TranslateStreamErrorEvent;

const useProxy = process.env.NEXT_PUBLIC_USE_API_PROXY !== 'false';
export const API_BASE = useProxy
  ? '/api/v1' // Proxy qua Next.js rewrites -> không CORS
  : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1`;

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor - Tự động thêm JWT Token; với FormData không set Content-Type để browser gửi đúng boundary
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
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
- Backend server đang chạy tại ${API_BASE}
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
    search?: string;
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
  exportExcel: (params?: { query?: string }) =>
    apiClient.get(`/cache/export/excel`, { params, responseType: 'blob' }),
};

// Prompts API
export const promptsAPI = {
  getList: (params?: any) => apiClient.get(`/prompts`, { params }).then((res) => res.data),
  get: (id: number) => apiClient.get(`/prompts/${id}`).then((res) => res.data),
  create: (data: any) => apiClient.post(`/prompts`, data).then((res) => res.data),
  update: (id: number, data: any) => apiClient.put(`/prompts/${id}`, data).then((res) => res.data),
  delete: (id: number) => apiClient.delete(`/prompts/${id}`).then((res) => res.data),
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
  deleteAll: (gameId?: number) =>
    apiClient.delete(`/game-glossary/all`, { params: gameId ? { game_id: gameId } : {} }),
  exportExcel: (gameId?: number) =>
    apiClient.get(`/game-glossary/export/excel`, {
      params: gameId ? { game_id: gameId } : {},
      responseType: 'blob',
    }),
  uploadExcel: (file: File, gameId?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    const params = gameId ? { game_id: gameId } : {};
    return apiClient.post(`/game-glossary/upload-excel`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      params,
    });
  },
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
  get: (id: number, params?: { include_deleted?: boolean }) => apiClient.get(`/job/${id}`, { params }),
  create: (data: any) => apiClient.post(`/job`, data),
  update: (id: number, data: any) => apiClient.put(`/job/${id}`, data),
  delete: (id: number) => apiClient.delete(`/job/${id}`),
  hardDelete: (id: number) => apiClient.delete(`/job/${id}/hard`),
  restore: (id: number) => apiClient.patch(`/job/${id}/restore`),
  cancel: (id: number) => apiClient.patch(`/job/${id}/cancel`),
  retry: (id: number) => apiClient.patch(`/job/${id}/retry`),
  exportExcel: (params?: { query?: string; status?: string; job_type?: string; include_deleted?: boolean }) =>
    apiClient.get(`/job/export/excel`, { params, responseType: 'blob' }),
};

// Translate API (AI)
export const translateAPI = {
  translate: (data: {
    text: string;
    source_lang: string;
    target_lang: string;
    prompt_id?: number | null;
    context?: string | null;
    style?: string | null;
  }) => apiClient.post<{ translated_text: string }>('/translate', data),
  /** Kiểm tra Gemini API key có hoạt động hay không (đọc từ Cài đặt) */
  verifyApiKey: () => apiClient.get<{ ok: boolean; message: string }>('/translate/verify'),
  /**
   * Parse file Excel (.xlsx) hoặc CSV, trả về columns + preview_rows cho bước Chọn cột (Dịch file).
   */
  parseFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<{ columns: string[]; preview_rows: Record<string, string>[] }>(
      '/translate/parse-file',
      formData
    );
  },
  /**
   * Dịch file: gửi file + cột chọn + ngôn ngữ, backend dịch từng ô (Cache -> Từ điển -> AI).
   * Trả về columns (gốc + _translated) và rows.
   */
  translateFile: (params: {
    file: File;
    selected_columns: string[];
    source_lang: string;
    target_lang: string;
    prompt_id?: number | null;
    context?: string | null;
    style?: string | null;
    game_id?: number | null;
    game_category_id?: number | null;
  }) => {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('selected_columns', JSON.stringify(params.selected_columns));
    formData.append('source_lang', params.source_lang);
    formData.append('target_lang', params.target_lang);
    if (params.prompt_id != null) formData.append('prompt_id', String(params.prompt_id));
    if (params.context != null && params.context !== '') formData.append('context', params.context);
    if (params.style != null && params.style !== '') formData.append('style', params.style);
    if (params.game_id != null) formData.append('game_id', String(params.game_id));
    if (params.game_category_id != null) formData.append('game_category_id', String(params.game_category_id));
    return apiClient.post<{ columns: string[]; rows: Record<string, string>[]; translated_json?: Record<string, unknown> | null; translated_docx_b64?: string | null }>(
      '/translate/translate-file',
      formData,
      { timeout: 300000 }
    );
  },
  /**
   * Dịch file JSON giữ nguyên cấu trúc: chỉ dịch value string (Cache → Từ điển → AI).
   * Trả về blob (application/json), tên file có _translated.
   */
  translateJsonFile: (params: {
    file: File;
    source_lang: string;
    target_lang: string;
    smart_filter?: boolean;
    translate_keys?: boolean;
    prompt_id?: number | null;
    context?: string | null;
    style?: string | null;
    game_id?: number | null;
    game_category_id?: number | null;
  }) => {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('source_lang', params.source_lang);
    formData.append('target_lang', params.target_lang);
    formData.append('smart_filter', params.smart_filter !== false ? 'true' : 'false');
    formData.append('translate_keys', params.translate_keys === true ? 'true' : 'false');
    if (params.prompt_id != null) formData.append('prompt_id', String(params.prompt_id));
    if (params.context != null && params.context !== '') formData.append('context', params.context);
    if (params.style != null && params.style !== '') formData.append('style', params.style);
    if (params.game_id != null) formData.append('game_id', String(params.game_id));
    if (params.game_category_id != null) formData.append('game_category_id', String(params.game_category_id));
    return apiClient.post('/translate/translate-json-file', formData, {
      responseType: 'blob',
      timeout: 300000,
    });
  },
  /**
   * Dịch file XML giữ cấu trúc: chỉ dịch text trong thẻ (string, text, description...), giữ placeholder.
   * Trả về blob (application/xml), tên file có _translated.
   */
  translateXmlFile: (params: {
    file: File;
    source_lang: string;
    target_lang: string;
    preserve_placeholders?: boolean;
    respect_translatable?: boolean;
    smart_filter?: boolean;
    prompt_id?: number | null;
    context?: string | null;
    style?: string | null;
    game_id?: number | null;
    game_category_id?: number | null;
  }) => {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('source_lang', params.source_lang);
    formData.append('target_lang', params.target_lang);
    formData.append('preserve_placeholders', params.preserve_placeholders !== false ? 'true' : 'false');
    formData.append('respect_translatable', params.respect_translatable !== false ? 'true' : 'false');
    formData.append('smart_filter', params.smart_filter !== false ? 'true' : 'false');
    if (params.prompt_id != null) formData.append('prompt_id', String(params.prompt_id));
    if (params.context != null && params.context !== '') formData.append('context', params.context);
    if (params.style != null && params.style !== '') formData.append('style', params.style);
    if (params.game_id != null) formData.append('game_id', String(params.game_id));
    if (params.game_category_id != null) formData.append('game_category_id', String(params.game_category_id));
    return apiClient.post('/translate/translate-xml-file', formData, {
      responseType: 'blob',
      timeout: 300000,
    });
  },
  /**
   * Dịch file với SSE streaming để hiển thị tiến trình real-time.
   * Dùng native fetch thay vì axios (EventSource chỉ hỗ trợ GET).
   * onEvent được gọi mỗi khi nhận SSE event từ server.
   * Trả về event "done" cuối cùng khi hoàn tất.
   */
  translateFileStream: async (
    params: {
      file: File;
      selected_columns: string[];
      source_lang: string;
      target_lang: string;
      prompt_id?: number | null;
      context?: string | null;
      style?: string | null;
      game_id?: number | null;
      game_category_id?: number | null;
    },
    onEvent: (event: TranslateStreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<TranslateStreamDoneEvent> => {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('selected_columns', JSON.stringify(params.selected_columns));
    formData.append('source_lang', params.source_lang);
    formData.append('target_lang', params.target_lang);
    if (params.prompt_id != null) formData.append('prompt_id', String(params.prompt_id));
    if (params.context) formData.append('context', params.context);
    if (params.style) formData.append('style', params.style);
    if (params.game_id != null) formData.append('game_id', String(params.game_id));
    if (params.game_category_id != null) formData.append('game_category_id', String(params.game_category_id));

    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}/translate/translate-file-stream`, {
      method: 'POST',
      headers,
      body: formData,
      signal,
    });

    if (!response.ok || !response.body) {
      let detail = `HTTP ${response.status}`;
      try { const j = await response.json(); detail = j?.detail || detail; } catch { /* noop */ }
      throw new Error(detail);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let doneEvent: TranslateStreamDoneEvent | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        for (const line of part.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(trimmed.slice(6)) as TranslateStreamEvent;
            onEvent(event);
            if (event.type === 'done') doneEvent = event as TranslateStreamDoneEvent;
            if (event.type === 'error') throw new Error((event as TranslateStreamErrorEvent).message);
          } catch (e: any) {
            if (e?.message && !e.message.startsWith('JSON')) throw e;
          }
        }
      }
    }

    if (!doneEvent) throw new Error('Stream kết thúc không có kết quả.');
    return doneEvent;
  },
  /**
   * Xuất kết quả dịch ra file theo đuôi (csv, xlsx, json, xml, docx).
   * Trả về blob, frontend tải về với đuôi trùng file đã upload.
   */
  exportFile: (params: {
    columns: string[];
    rows: Record<string, string>[];
    format: string;
    filename?: string;
  }) =>
    apiClient.post('/translate/export-file', params, { responseType: 'blob' }),
};

// Asset API
export const assetAPI = {
  getList: (params?: any) => apiClient.get(`/asset`, { params }),
  get: (id: number) => apiClient.get(`/asset/${id}`),
  create: (data: any) => apiClient.post(`/asset`, data),
  update: (id: number, data: any) => apiClient.put(`/asset/${id}`, data),
  delete: (id: number) => apiClient.delete(`/asset/${id}`),
};

// Global_glossary API
export const global_glossaryAPI = {
  getList: (params?: any) => apiClient.get(`/global-glossary`, { params }),
  get: (id: number) => apiClient.get(`/global-glossary/${id}`),
  create: (data: any) => apiClient.post(`/global-glossary`, data),
  update: (id: number, data: any) => apiClient.put(`/global-glossary/${id}`, data),
  delete: (id: number) => apiClient.delete(`/global-glossary/${id}`),
  deleteAll: () => apiClient.delete(`/global-glossary/all`),
  exportExcel: () =>
    apiClient.get(`/global-glossary/export/excel`, {
      responseType: 'blob',
    }),
  uploadExcel: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(`/global-glossary/upload-excel`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Import Batches API (lịch sử import, rollback)
export const importBatchesAPI = {
  getList: (params?: { skip?: number; limit?: number; source_type?: string; game_id?: number }) =>
    apiClient.get(`/import-batches`, { params }),
  get: (id: number) => apiClient.get(`/import-batches/${id}`),
  rollback: (batchId: number) =>
    apiClient.post(`/import-batches/${batchId}/rollback`),
};

// Files API (MinIO uploads)
export const filesAPI = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Proofread API (Hiệu Đính File)
export const proofreadAPI = {
  /**
   * Parse toàn bộ dòng từ file .xlsx/.csv để hiệu đính.
   * Trả về columns + tất cả rows (không giới hạn 5 dòng preview).
   */
  parseFileFull: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<{ columns: string[]; rows: Record<string, string>[]; total: number }>(
      '/translate/parse-file-full',
      formData
    );
  },
  /**
   * Hiệu đính 1 dòng bằng AI: gửi văn bản gốc + bản dịch hiện tại.
   */
  proofreadRow: (data: {
    original: string;
    translated: string;
    source_lang: string;
    target_lang: string;
    prompt_id?: number | null;
    context?: string | null;
    style?: string | null;
  }) =>
    apiClient.post<{ proofread: string }>('/translate/proofread-row', data),
  /**
   * Hiệu đính nhiều dòng cùng lúc (batch AI).
   */
  proofreadBatch: (data: {
    items: { index: number; original: string; translated: string }[];
    source_lang: string;
    target_lang: string;
    prompt_id?: number | null;
    context?: string | null;
    style?: string | null;
  }) =>
    apiClient.post<{ results: { index: number; proofread: string }[] }>(
      '/translate/proofread-batch',
      data
    ),
};

// Game API
export const gameAPI = {
  getList: (params?: any) => apiClient.get(`/game`, { params }),
  get: (id: number) => apiClient.get(`/game/${id}`),
  create: (data: any) => apiClient.post(`/game`, data),
  update: (id: number, data: any) => apiClient.put(`/game/${id}`, data),
  delete: (id: number) => apiClient.delete(`/game/${id}`),
};

// Quality Check API
export interface QualityIssueResult {
  category: string;
  severity: string;
  message: string;
  suggestion: string;
  deduction: number;
}
export interface QualityCheckResult {
  score: number;
  verdict: string;
  issues: QualityIssueResult[];
  suggestions: string[];
  should_retranslate: boolean;
}
export const qualityCheckAPI = {
  check: (data: {
    source: string;
    translated: string;
    source_lang?: string;
    target_lang?: string;
    glossary_terms?: string[][];
  }) => apiClient.post<QualityCheckResult>('/quality-check', data),
  checkBatch: (data: {
    items: { source: string; translated: string; source_lang?: string; target_lang?: string }[];
  }) =>
    apiClient.post<{ results: QualityCheckResult[]; avg_score: number; retranslate_count: number }>(
      '/quality-check/batch',
      data
    ),
};

// Game_glossary API
export const game_glossaryAPI = {
  getList: (params?: any) => apiClient.get(`/game_glossary`, { params }),
  get: (id: number) => apiClient.get(`/game_glossary/${id}`),
  create: (data: any) => apiClient.post(`/game_glossary`, data),
  update: (id: number, data: any) => apiClient.put(`/game_glossary/${id}`, data),
  delete: (id: number) => apiClient.delete(`/game_glossary/${id}`),
};
