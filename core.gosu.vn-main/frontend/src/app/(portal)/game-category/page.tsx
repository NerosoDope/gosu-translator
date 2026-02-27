'use client';
import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import GameCategoryTable from '@/components/admin/GameCategoryTable';
import GameCategoryForm from '@/components/admin/GameCategoryForm';
import FilterBar from '@/components/data/FilterBar';
import Button from '@/components/ui/Button';

import { gameCategoryAPI } from '@/lib/api';

interface GameCategory {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
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
  const [sortBy, setSortBy] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Load game categories
  const loadGameCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};

      const response = await gameCategoryAPI.getList(params);
      const { items, total, page, per_page, pages } = response.data; // Destructure response.data

      let processedData: GameCategory[] = items || [];

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
  }, [pagination.page, pagination.per_page, search, statusFilter, sortBy, sortOrder]);

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
    if (!columnKey || !direction) {
      // If columnKey or direction is null, reset to default sort
      setSortBy('id');
      setSortOrder('desc');
    } else {
      // Set new sort column and direction
      setSortBy(columnKey);
      setSortOrder(direction);
    }
    // Reset to first page when sorting changes
    setPagination(prev => ({ ...prev, page: 1 }));
  };

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

          {/* Game Category Table Component */}
          <GameCategoryTable
            items={gameCategories}
            loading={loading}
            error={error}
            pagination={pagination}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
            onSort={handleSort}
            onEdit={handleCategoryEdit}
            onDelete={handleDeleteCategory}
          />

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
