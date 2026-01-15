'use client';

import { useState } from 'react';
import DataTable, { Column } from '@/components/data/DataTable';
import { useGameCategoryList, useDeleteGameCategory } from '@/hooks/useGameCategory';

interface GameCategory {
  id: number;
  name: string;
  description?: string;
  translation_style?: string;
  is_active: boolean;
}

interface Props {
  onEdit: (category: GameCategory) => void;
}

export default function GameCategoryTable({ onEdit }: Props) {
  const { data, isLoading, error, refetch } = useGameCategoryList();
  const deleteGameCategory = useDeleteGameCategory();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GameCategory | null>(null);

  const categories: GameCategory[] = data?.data || [];

  /* =======================
   * Delete handlers
   * ======================= */
  const handleDeleteClick = (category: GameCategory) => {
    setDeleteTarget(category);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteGameCategory.mutateAsync(deleteTarget.id);
      refetch();
    } catch (err) {
      console.error('Delete category failed:', err);
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  /* =======================
   * Table columns
   * ======================= */
  const columns: Column<GameCategory>[] = [
    {
      key: 'id',
      header: 'STT',
      sortable: false,
      render: (_, index) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {index !== undefined ? index + 1 : '-'}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Tên danh mục',
      sortable: true,
      render: (category) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {category.name}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Mô tả',
      sortable: false,
      render: (category) => (
        <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {category.description || '—'}
        </span>
      ),
    },
    {
      key: 'translation_style',
      header: 'Kiểu dịch',
      sortable: false,
      render: (category) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {category.translation_style || 'N/A'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Trạng thái',
      sortable: true,
      render: (category) => (
        <span
          className={`inline-flex px-2 py-1 text-xs rounded-full ${
            category.is_active
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {category.is_active ? 'Hoạt động' : 'Tạm dừng'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      sortable: false,
      className: 'text-right',
      render: (category) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => onEdit(category)}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            title="Chỉnh sửa"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>

          <button
            onClick={() => handleDeleteClick(category)}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            title="Xóa"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  /* =======================
   * Render
   * ======================= */
  return (
    <>
      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          Không thể tải danh mục game
        </div>
      )}

      <DataTable
        data={categories}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="Chưa có danh mục game nào."
      />

      {/* Delete confirmation modal */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Xác nhận xóa
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Bạn có chắc chắn muốn xóa danh mục{' '}
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  "{deleteTarget.name}"
                </span>
                ?
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCancelDelete}
                  className="px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
