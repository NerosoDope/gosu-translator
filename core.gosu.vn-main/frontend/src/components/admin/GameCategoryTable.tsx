'use client';

import React, { useMemo } from 'react';
import DataTable, { Column } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';

interface GameCategory {
  id: number;
  name: string;
  description: string;
  translation_style: string;
  is_active: boolean;
}

interface GameCategoryTableProps {
  items: GameCategory[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onPageChange: (page: number) => void;
  onSort: (columnKey: string | null, direction: 'asc' | 'desc' | null) => void;
  onEdit: (category: GameCategory) => void;
  onDelete: (category: GameCategory) => void;
}

export default function GameCategoryTable({
  items,
  loading,
  error,
  pagination,
  sortBy,
  sortOrder,
  onPageChange,
  onSort,
  onEdit,
  onDelete,
}: GameCategoryTableProps) {
  const columns: Column<GameCategory>[] = useMemo(
    () => [
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
            <button
              onClick={() => onEdit(category)}
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
              onClick={() => onDelete(category)}
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
    ],
    [pagination.page, pagination.per_page, onEdit, onDelete]
  );

  return (
    <>
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <DataTable
        data={items}
        columns={columns}
        isLoading={loading}
        emptyMessage="Không tìm thấy thể loại game. Nhấn 'Thêm thể loại game' để tạo thể loại game đầu tiên."
        onSort={onSort}
        sortColumn={sortBy}
        sortDirection={sortOrder === 'asc' ? 'asc' : sortOrder === 'desc' ? 'desc' : null}
      />

      {pagination.pages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          onPageChange={onPageChange}
          pageSize={pagination.per_page}
          totalItems={pagination.total}
        />
      )}
    </>
  );
}
