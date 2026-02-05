/**
 * Component: GameCategoriesPage
 * Purpose:
 *   - Main component for game category management
 *   - Display game categories list with DataTable
 *   - Handle CRUD operations for game categories
 *
 * Responsibilities:
 * - Load and display game categories list
 * - Handle pagination, filtering, and sorting
 * - Open/close category form modal
 * - Handle create/update/delete/restore operations
 *
 * Important:
 * - Uses react-query QueryClientProvider (UI consistency)
 */

'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

// Components
import DataTable, { Column } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import FilterBar from '@/components/data/FilterBar';
import Button from '@/components/ui/Button';
import GameCategoryForm from '@/components/admin/GameCategoryForm';

// API
import { gameCategoryAPI } from '@/lib/api';

// Types
interface GameCategory {
  id: number;
  name: string;
  description: string;
  translation_style: string;
  is_active: boolean;
  is_deleted?: boolean;
  deleted_at?: string;
}

export default function GameCategoriesPage() {
  /* =====================
   * State management
   ===================== */
  const [editingCategory, setEditingCategory] = useState<GameCategory | undefined>();
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GameCategory | null>(null);

  // Data state
  const [categories, setCategories] = useState<GameCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    pages: 0,
  });

  // Filters & sorting
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [sortBy, setSortBy] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  /* =====================
   * Data loading
   ===================== */
  const loadGameCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        skip: (pagination.page - 1) * pagination.per_page,
        limit: pagination.per_page,
      };

      if (search) params.query = search;
      if (statusFilter) params.is_active = statusFilter === 'active';
      if (showDeleted) params.include_deleted = true;
      if (sortBy) {
        params.sort_by = sortBy;
        params.sort_order = sortOrder;
      }

      const response = await gameCategoryAPI.getList(params);
      const data = response.data;

      setCategories(data.items || []);
      setPagination(prev => ({
        ...prev,
        total: data.total || 0,
        pages: data.pages || 0,
      }));
    } catch (err: any) {
      console.error('Error loading game categories:', err);
      setError(err.response?.data?.detail || 'Không thể tải danh sách thể loại game');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGameCategories();
  }, [
    pagination.page,
    pagination.per_page,
    search,
    statusFilter,
    showDeleted,
    sortBy,
    sortOrder,
  ]);

  /* =====================
   * Event handlers
   ===================== */
  const handleCreate = () => {
    setEditingCategory(undefined);
    setShowCategoryForm(true);
  };

  const handleEdit = (category: GameCategory) => {
    setEditingCategory(category);
    setShowCategoryForm(true);
  };

  const handleFormSuccess = () => {
    setShowCategoryForm(false);
    setEditingCategory(undefined);
    loadGameCategories();
  };

  const handleFormCancel = () => {
    setShowCategoryForm(false);
    setEditingCategory(undefined);
  };

  const handleDelete = (category: GameCategory) => {
    setDeleteTarget(category);
    setShowDeleteConfirm(true);
  };

  const handleRestore = async (category: GameCategory) => {
    try {
      await gameCategoryAPI.restore(category.id);
      loadGameCategories();
    } catch (err) {
      console.error('Error restoring category:', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await gameCategoryAPI.delete(deleteTarget.id);
      loadGameCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  /* =====================
   * Sorting
   ===================== */
  const handleSort = (columnKey: string | null, direction: 'asc' | 'desc' | null) => {
    if (columnKey === null) {
      setSortBy('id');
      setSortOrder('asc');
    } else if (sortBy === columnKey) {
      if (direction === 'asc') {
        setSortOrder('desc');
      } else if (direction === 'desc') {
        setSortBy('id');
        setSortOrder('asc');
      }
    } else {
      setSortBy(columnKey);
      setSortOrder(direction === 'desc' ? 'desc' : 'asc');
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  /* =====================
   * Table columns
   ===================== */
  const columns: Column<GameCategory>[] = [
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
      header: 'Tên thể loại',
      sortable: true,
      render: c => <span className="font-medium">{c.name}</span>,
    },
    {
      key: 'translation_style',
      header: 'Phong cách dịch',
      sortable: true,
      render: c => <span className="text-gray-600">{c.translation_style || 'N/A'}</span>,
    },
    {
      key: 'is_active',
      header: 'Trạng thái',
      sortable: true,
      render: c => (
        <div className="flex flex-col gap-1">
          <span
            className={`px-2 py-1 text-xs rounded-full w-fit ${
              c.is_active
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {c.is_active ? 'Hoạt động' : 'Tạm dừng'}
          </span>
          {c.is_deleted && (
            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 w-fit">
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
      render: c => (
        <div className="flex gap-2">
          {!c.is_deleted ? (
            <>
              <button onClick={() => handleEdit(c)} className="text-blue-600">Sửa</button>
              <button onClick={() => handleDelete(c)} className="text-red-600">Xóa</button>
            </>
          ) : (
            <button onClick={() => handleRestore(c)} className="text-green-600">
              Khôi phục
            </button>
          )}
        </div>
      ),
    },
  ];

  /* =====================
   * Render
   ===================== */
  return (
    <QueryClientProvider client={new QueryClient()}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Quản Lý Thể Loại Game</h1>
          <p className="text-sm text-gray-600">
            Trung tâm quản lý các thể loại game cho hệ thống dịch thuật
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Danh sách thể loại game</h2>
          <Button onClick={handleCreate}>Thêm thể loại game</Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Filters */}
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          filters={
            <div className="flex gap-4">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Tạm dừng</option>
              </select>

              <select
                value={pagination.per_page}
                onChange={e =>
                  setPagination(prev => ({
                    ...prev,
                    per_page: Number(e.target.value),
                    page: 1,
                  }))
                }
              >
                <option value={5}>5 / trang</option>
                <option value={10}>10 / trang</option>
                <option value={20}>20 / trang</option>
                <option value={50}>50 / trang</option>
              </select>
            </div>
          }
        />

        {/* Table */}
        <DataTable
          data={categories}
          columns={columns}
          isLoading={loading}
          emptyMessage="Không tìm thấy thể loại game."
          onSort={handleSort}
          sortColumn={sortBy}
          sortDirection={sortOrder}
        />

        {/* Pagination */}
        {pagination.pages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            onPageChange={page => setPagination(prev => ({ ...prev, page }))}
            pageSize={pagination.per_page}
            totalItems={pagination.total}
          />
        )}

        {/* Category Form Modal */}
        {showCategoryForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full p-6">
              <GameCategoryForm
                category={editingCategory}
                onSuccess={handleFormSuccess}
                onCancel={handleFormCancel}
              />
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && deleteTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <p>
                Bạn có chắc chắn muốn xóa{' '}
                <strong>{deleteTarget.name}</strong>?
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={handleCancelDelete}>Hủy</button>
                <button onClick={handleConfirmDelete} className="text-red-600">
                  Xóa
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </QueryClientProvider>
  );
}
