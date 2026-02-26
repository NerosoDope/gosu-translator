'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DataTable, { Column } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';

interface GameItem {
  id: number;
  name: string;
  description?: string;
  game_category_id: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

interface GameCategory {
  id: number;
  name: string;
}

interface GameTableProps {
  items: GameItem[];
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
  onEdit: (item: GameItem) => void;
  onDelete: (item: GameItem) => void;
  onViewGlossary?: (item: GameItem) => void;
}

export default function GameTable({ items, loading, error, pagination, gameCategories, sortBy, sortOrder, onPageChange, onSort, onEdit, onDelete, onViewGlossary }: GameTableProps) {
  const router = useRouter();

  const handleViewGlossary = (item: GameItem) => {
    if (onViewGlossary) {
      onViewGlossary(item);
    } else {
      router.push(`/game-glossary?game_id=${item.id}`);
    }
  };

  const columns: Column<GameItem>[] = useMemo(() => [
    {
      key: 'id',
      header: 'STT',
      sortable: false,
      render: (_, index) => (
        <span className="text-sm">
          {index !== undefined
            ? (pagination.page - 1) * pagination.per_page + index + 1
            : '-'}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Tên game',
      sortable: true,
      render: (item: GameItem) => (
        <span className="text-gray-900 dark:text-gray-100 font-medium">
          {item.name}
        </span>
      ),
    },
    {
      key: 'game_category_id',
      header: 'Thể loại',
      sortable: true,
      render: (item: GameItem) => {
        const category = gameCategories.find(cat => cat.id === item.game_category_id);
        return (
          <span className="text-gray-900 dark:text-gray-100">
            {category?.name || `ID: ${item.game_category_id}`}
          </span>
        );
      },
    },
    {
      key: 'is_active',
      header: 'Trạng thái',
      sortable: true,
      render: (item: GameItem) => (
        <div className="flex flex-col gap-1">
          <span
            className={`inline-flex w-fit items-center px-2 py-1 text-xs rounded-full ${item.is_active
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
      header: 'Hành động',
      sortable: false,
      className: 'text-right',
      render: (item: GameItem) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewGlossary(item)}
            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors duration-200"
            title="Xem thuật ngữ"
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
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253M12 6.253C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18s-3.332.477-4.5 1.253"
              />
            </svg>
          </button>
          <button
            onClick={() => onEdit(item)}
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
            onClick={() => onDelete(item)}
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
    [pagination.page, pagination.per_page, gameCategories, onEdit, onDelete, onViewGlossary]
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
        emptyMessage="Không tìm thấy game nào. Nhấn 'Thêm game' để tạo game đầu tiên."
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
