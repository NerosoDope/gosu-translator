'use client';

import React, { useMemo } from 'react';
import DataTable, { Column } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';

interface GlobalGlossaryItem {
  id: number;
  term: string;
  translated_term: string;
  language_pair: string;
  game_category_id: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

interface GameCategory {
  id: number;
  name: string;
}

interface GlobalGlossaryTableProps {
  items: GlobalGlossaryItem[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
  gameCategories: GameCategory[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onPageChange: (page: number) => void;
  onSort: (columnKey: string | null, direction: 'asc' | 'desc' | null) => void;
  onRead: (item: GlobalGlossaryItem) => void;
  onEdit: (item: GlobalGlossaryItem) => void;
  onDelete: (item: GlobalGlossaryItem) => void;
}

export default function GlobalGlossaryTable({
  items,
  loading,
  error,
  pagination,
  gameCategories,
  sortBy,
  sortOrder,
  onPageChange,
  onSort,
  onRead,
  onEdit,
  onDelete,
}: GlobalGlossaryTableProps) {
  // DataTable columns for global glossary
  const columns: Column<GlobalGlossaryItem>[] = useMemo(() => [
    {
      key: 'id',
      header: 'STT',
      sortable: false,
      render: (item: GlobalGlossaryItem, index?: number) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {index !== undefined ? (pagination.page - 1) * pagination.per_page + index + 1 : '-'}
        </span>
      ),
    },
    {
      key: 'term',
      header: 'Thuật ngữ gốc',
      sortable: true,
      render: (item: GlobalGlossaryItem) => (
        <span className="text-gray-900 dark:text-gray-100 font-medium">
          {item.term}
        </span>
      ),
    },
    {
      key: 'translated_term',
      header: 'Thuật ngữ dịch',
      sortable: true,
      render: (item: GlobalGlossaryItem) => (
        <span className="text-gray-600 dark:text-gray-400">
          {item.translated_term}
        </span>
      ),
    },
    {
      key: 'language_pair',
      header: 'Cặp ngôn ngữ',
      sortable: true,
      render: (item: GlobalGlossaryItem) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
          {item.language_pair}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Trạng thái',
      sortable: true,
      render: (item: GlobalGlossaryItem) => (
        <div className="flex flex-col gap-1">
          <span
            className={`inline-flex w-fit items-center px-2 py-1 text-xs rounded-full ${
              item.is_active
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}
          >
            {item.is_active ? 'Hoạt động' : 'Tạm dừng'}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      sortable: false,
      className: 'text-right',
      render: (item: GlobalGlossaryItem) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRead(item)}
            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors duration-200"
            title="Xem trước thuật ngữ"
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
            onClick={() => onEdit(item)}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200"
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
            onClick={() => onDelete(item)}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
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
    [pagination.page, pagination.per_page, gameCategories, onRead, onEdit, onDelete]
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
        emptyMessage="Không tìm thấy thuật ngữ nào. Nhấn 'Thêm thuật ngữ' để tạo thuật ngữ đầu tiên."
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
