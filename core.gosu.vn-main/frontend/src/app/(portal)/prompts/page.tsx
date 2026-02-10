/**
 * Component: PromptsPage
 * Purpose:
 *   - Main component for prompt management
 *   - Display prompts list with DataTable
 *   - Handle CRUD operations for prompts
 *
 * Responsibilities:
 * - Load and display prompts list
 * - Handle pagination and filtering
 * - Open/close prompt form modal
 * - Handle create/update/delete operations
 * - Manage prompt validation and error handling
 *
 * Important:
 * - Requires "prompts:read" permission
 * - Uses react-query for data fetching
 * - Toast notifications for success/error
 */

'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

// Components
import DataTable, { Column } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import FilterBar from '@/components/data/FilterBar';
import Button from '@/components/ui/Button';
import PromptsForm from '@/components/admin/PromptsForm';
import PromptDetailsModal from '@/components/admin/PromptDetailsModal';

// Hooks
import { usePromptsList, useDeletePrompt } from '@/hooks/usePrompts';

// Types
interface Prompt {
  id: number;
  name: string;
  content: string;
  description: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface PromptsListResponse {
  data: Prompt[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

function PromptsPageContent() {
  // State management
  const [editingPrompt, setEditingPrompt] = useState<Prompt | undefined>(undefined);
  const [viewingPrompt, setViewingPrompt] = useState<Prompt | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Prompt | null>(null);

  // Prompts state
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    pages: 0,
  });

  // Filter and sort states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // API hooks
  const { data: promptsData, isLoading, error: apiError } = usePromptsList({
    skip: (pagination.page - 1) * pagination.per_page,
    limit: pagination.per_page,
    query: search || undefined,
    is_active: statusFilter ? statusFilter === 'active' : undefined,
    sort_by: sortBy || undefined,
    sort_order: sortOrder || undefined,
  });

  const deletePrompt = useDeletePrompt();

  // Update local state when API data changes
  useEffect(() => {
    if (promptsData) {
      setPrompts(promptsData.data || []);
      setPagination({
        ...pagination,
        total: promptsData.total || 0,
        pages: promptsData.pages || 0,
      });
      setError(null);
    }
    if (apiError) {
      setError('Không thể tải danh sách prompts');
      setPrompts([]);
    }
    setLoading(isLoading);
  }, [promptsData, apiError, isLoading]);

  // Event handlers
  const handlePromptCreate = () => {
    setEditingPrompt(undefined);
    setShowForm(true);
  };

  const handlePromptEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setShowForm(true);
  };

  const handlePromptFormSuccess = () => {
    setShowForm(false);
    setEditingPrompt(undefined);
  };

  const handlePromptFormCancel = () => {
    setShowForm(false);
    setEditingPrompt(undefined);
  };

  const handleDeletePrompt = (prompt: Prompt) => {
    setDeleteTarget(prompt);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deletePrompt.mutateAsync(deleteTarget.id);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } catch (error: any) {
      console.error('Error deleting prompt:', error);
      // Error will be handled by the mutation
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const handlePromptView = (prompt: Prompt) => {
    setViewingPrompt(prompt);
    setShowDetailsModal(true);
  };

  const handleCloseDetails = () => {
    setShowDetailsModal(false);
    setViewingPrompt(null);
  };

  // Handle column sorting
  const handleSort = (columnKey: string | null, direction: 'asc' | 'desc' | null) => {
    if (columnKey === null) {
      // Clear sorting
      setSortBy('id');
      setSortOrder('asc');
    } else if (sortBy === columnKey) {
      // Toggle sort order
      if (direction === 'asc') {
        setSortOrder('desc');
      } else if (direction === 'desc') {
        setSortBy('id');
        setSortOrder('asc');
      } else {
        setSortOrder('asc');
      }
    } else {
      // Set new sort column with specified direction
      setSortBy(columnKey);
      setSortOrder(direction === 'desc' ? 'desc' : 'asc');
    }
    // Reset to first page when sorting changes
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // DataTable columns for prompts
  const promptColumns: Column<Prompt>[] = [
    {
      key: 'id',
      header: 'STT',
      sortable: false,
      render: (prompt: Prompt, index?: number) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {index !== undefined ? (pagination.page - 1) * pagination.per_page + index + 1 : '-'}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Tên Prompt',
      sortable: true,
      render: (prompt: Prompt) => (
        <div className="max-w-xs">
          <span className="text-gray-900 dark:text-gray-100 font-medium truncate block" title={prompt.name}>
            {prompt.name}
          </span>
        </div>
      ),
    },
    {
      key: 'content',
      header: 'Nội dung',
      sortable: false,
      render: (prompt: Prompt) => (
        <div className="max-w-md">
          <span className="text-gray-700 dark:text-gray-300 text-sm truncate block" title={prompt.content}>
            {prompt.content}
          </span>
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Trạng thái',
      sortable: true,
      render: (prompt: Prompt) => (
        <span
          className={`inline-flex w-fit items-center px-2 py-1 text-xs rounded-full ${
            prompt.is_active
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {prompt.is_active ? 'Hoạt động' : 'Tạm dừng'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      sortable: false,
      className: 'text-right',
      render: (prompt: Prompt) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePromptView(prompt)}
            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
            title="Xem chi tiết"
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
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </button>
          <button
            onClick={() => handlePromptEdit(prompt)}
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
          <button
            onClick={() => handleDeletePrompt(prompt)}
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
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Quản Lý Prompts
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Trung tâm quản lý prompts cho hệ thống dịch thuật
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Danh sách prompts
            </h2>
            <Button onClick={handlePromptCreate}>
              Thêm prompt
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Filter Bar */}
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            filters={
              <div className="flex items-center gap-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Tạm dừng</option>
                </select>

                <select
                  value={pagination.per_page}
                  onChange={(e) => setPagination((prev) => ({ ...prev, per_page: Number(e.target.value), page: 1 }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value={5}>5 / trang</option>
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                </select>
              </div>
            }
          />

          {/* Data Table */}
          <DataTable
            data={prompts}
            columns={promptColumns}
            isLoading={loading}
            emptyMessage="Không tìm thấy prompt. Nhấn 'Thêm prompt' để tạo prompt đầu tiên."
            onSort={handleSort}
            sortColumn={sortBy}
            sortDirection={sortOrder === 'asc' ? 'asc' : sortOrder === 'desc' ? 'desc' : null}
          />


          {/* Pagination */}
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

          {/* Prompt Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[75vh]">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {editingPrompt ? 'Chỉnh sửa prompt' : 'Thêm prompt mới'}
                  </h3>
                  <button
                    onClick={handlePromptFormCancel}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Đóng"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-4 overflow-y-auto max-h-[calc(75vh-80px)] custom-scrollbar">
                  <PromptsForm
                    prompt={editingPrompt}
                    onSuccess={handlePromptFormSuccess}
                    onCancel={handlePromptFormCancel}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Prompt Details Modal */}
        <PromptDetailsModal
          prompt={viewingPrompt}
          isOpen={showDetailsModal}
          onClose={handleCloseDetails}
        />

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && deleteTarget && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      Xác nhận xóa
                    </h3>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Bạn có chắc chắn muốn xóa{' '}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      prompt "{deleteTarget.name}"
                    </span>
                    ?
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Hành động này không thể hoàn tác.
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={handleCancelDelete}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={deletePrompt.isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
                  >
                    {deletePrompt.isLoading ? 'Đang xóa...' : 'Xóa'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

export default function PromptsPage() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <PromptsPageContent />
    </QueryClientProvider>
  );
}
