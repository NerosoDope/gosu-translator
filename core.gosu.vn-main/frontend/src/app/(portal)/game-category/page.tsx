'use client';
import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import GameCategoryTable from '@/components/admin/GameCategoryTable';
import GameCategoryForm from '@/components/admin/GameCategoryForm';
import DataTable, { Column } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import FilterBar from '@/components/data/FilterBar';
import Button from '@/components/ui/Button';

import { gameCategoryAPI } from '@/lib/api';

interface GameCategory {
  id: number;
  name: string;
  is_active: boolean;
  is_deleted?: boolean;
  deleted_at?: string;
  translation_style: string;
}

interface GameCategoryListResponse {
  items: GameCategory[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export default function GameCategoryPage() {
  const [editingCategory, setEditingCategory] = useState<GameCategory | undefined>(undefined);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GameCategory | null>(null);

  const [gameCategories, setGameCategories] = useState<GameCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    pages: 0,
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [sortBy, setSortBy] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Load game categories
  const loadGameCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};

      const response = await gameCategoryAPI.getList(params);
      let processedData: GameCategory[] = response.data || [];

      // Client-side Filtering
      if (search) {
        processedData = processedData.filter(category =>
          category.name.toLowerCase().includes(search.toLowerCase())
        );
      }
      if (statusFilter) {
        const isActive = statusFilter === 'active';
        processedData = processedData.filter(category => category.is_active === isActive);
      }
      if (!showDeleted) {
        processedData = processedData.filter(category => !category.is_deleted);
      }

      // Client-side Sorting
      if (sortBy) {
        processedData.sort((a, b) => {
          const aValue = (a as any)[sortBy];
          const bValue = (b as any)[sortBy];

          if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      }

      const totalItems = processedData.length;
      const totalPages = Math.ceil(totalItems / pagination.per_page);

      // Client-side Pagination
      const startIndex = (pagination.page - 1) * pagination.per_page;
      const endIndex = startIndex + pagination.per_page;
      const paginatedData = processedData.slice(startIndex, endIndex);
      
      console.log('Game Category API response data:', response.data);
      setGameCategories(paginatedData);
      setPagination({
        ...pagination,
        total: totalItems,
        pages: totalPages,
      });
    } catch (error: any) {
      console.error('Error loading game categories:', error);
      setError(error.response?.data?.detail || 'Không thể tải danh sách thể loại game');
      setGameCategories([]);
    } finally {
      setLoading(false);
    }
  };


  // Load game categories data when relevant state changes
  useEffect(() => {
    loadGameCategories();
  }, [pagination.page, pagination.per_page, search, statusFilter, showDeleted, sortBy, sortOrder]);

  // Event handlers
  const handleCategoryCreate = () => {
    setEditingCategory(undefined);
    setShowCategoryForm(true);
  };

  const handleCategoryEdit = (category: GameCategory) => {
    setEditingCategory(category);
    setShowCategoryForm(true);
  };

  const handleCategoryFormSuccess = () => {
    setShowCategoryForm(false);
    setEditingCategory(undefined);
    loadGameCategories();
  };

  const handleCategoryFormCancel = () => {
    setShowCategoryForm(false);
    setEditingCategory(undefined);
  };

  const handleDeleteCategory = (category: GameCategory) => {
    setDeleteTarget(category);
    setShowDeleteConfirm(true);
  };

  const handleRestoreCategory = async (category: GameCategory) => {
    try {
      await gameCategoryAPI.restore(category.id);
      loadGameCategories();
    } catch (error: any) {
      console.error('Error restoring game category:', error);
      // Could show error toast here
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await gameCategoryAPI.delete(deleteTarget.id);
      loadGameCategories();
    } catch (error: any) {
      console.error('Error deleting game category:', error);
      // Could show error toast here
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
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

  // DataTable columns for game categories
  const gameCategoryColumns: Column<GameCategory>[] = [
    {
      key: 'id',
      header: 'STT',
      sortable: false,
      render: (category: GameCategory, index?: number) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {index !== undefined ? (pagination.page - 1) * pagination.per_page + index + 1 : '-'}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Tên thể loại',
      sortable: true,
      render: (category: GameCategory) => (
        <span className="text-gray-900 dark:text-gray-100 font-medium">
          {category.name}
        </span>
      ),
    },
    {
      key: 'translation_style',
      header: 'Phong cách dịch',
      sortable: true,
      render: (category: GameCategory) => (
        <span className="text-gray-600 dark:text-gray-400">
          {category.translation_style}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Trạng thái',
      sortable: true,
      render: (category: GameCategory) => (
        <div className="flex flex-col gap-1">
          <span
            className={`inline-flex w-fit items-center px-2 py-1 text-xs rounded-full ${
              category.is_active
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}
          >
            {category.is_active ? 'Hoạt động' : 'Tạm dừng'}
          </span>
          {category.is_deleted && (
            <span className="inline-flex w-fit items-center px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
              Đã xóa
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      sortable: false,
      className: 'text-right',
      render: (category: GameCategory) => (
        <div className="flex items-center gap-2">
          {!category.is_deleted ? (
            <>
              <button
                onClick={() => handleCategoryEdit(category)}
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
                onClick={() => handleDeleteCategory(category)}
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
            </>
          ) : (
            <button
              onClick={() => handleRestoreCategory(category)}
              className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
              title="Khôi phục"
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <QueryClientProvider client={new QueryClient()}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Quản Lý Thể Loại Game
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Trung tâm quản lý các thể loại game được hỗ trợ trong hệ thống
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Danh sách thể loại game
            </h2>
            <Button onClick={handleCategoryCreate}>
              Thêm thể loại game
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

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showDeleted}
                    onChange={(e) => setShowDeleted(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Hiển thị đã xóa
                  </span>
                </label>

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
            data={gameCategories}
            columns={gameCategoryColumns}
            isLoading={loading}
            emptyMessage="Không tìm thấy thể loại game. Nhấn 'Thêm thể loại game' để tạo thể loại game đầu tiên."
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

          {/* Game Category Form Modal */}
          {showCategoryForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {editingCategory ? 'Chỉnh sửa thể loại game' : 'Thêm thể loại game mới'}
                  </h3>
                  <button
                    onClick={handleCategoryFormCancel}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Đóng"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-6">
                  <GameCategoryForm
                    category={editingCategory}
                    onSuccess={handleCategoryFormSuccess}
                    onCancel={handleCategoryFormCancel}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

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
                      {`thể loại game "${deleteTarget.name}"`}
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
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </QueryClientProvider>
  );

}