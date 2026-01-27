'use client';
import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

// Components
import FilterBar from '@/components/data/FilterBar';
import Button from '@/components/ui/Button';
import GameForm from '@/components/game/GameForm';
import GameTable from '@/components/game/GameTable';
import GameGlossaryForm from '@/components/admin/GameGlossaryForm';
import GameGlossaryTable from '@/components/admin/GameGlossaryTable';

// Hooks
import {
  useGameList,
  useDeleteGame
} from '@/hooks/useGame';
import {
  useGameGlossaryList,
  useDeleteGameGlossary
} from '@/hooks/useGameGlossary';

// API
import { gameCategoryAPI } from '@/lib/api';

// Context
import { useToastContext } from '@/context/ToastContext';

// Types
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

interface GameGlossaryItem {
  id: number;
  term: string;
  translated_term: string;
  language_pair: string;
  game_id: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

function GameContent() {
  const { success: showToast, error: showErrorToast } = useToastContext();

  // View mode state
  const [viewMode, setViewMode] = useState<'games' | 'glossary'>('games');
  const [selectedGameForGlossary, setSelectedGameForGlossary] = useState<GameItem | null>(null);

  // State
  const [editingItem, setEditingItem] = useState<GameItem | undefined>();
  const [editingGlossaryItem, setEditingGlossaryItem] = useState<GameGlossaryItem | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [showGlossaryForm, setShowGlossaryForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGlossaryDeleteConfirm, setShowGlossaryDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GameItem | null>(null);
  const [deleteGlossaryTarget, setDeleteGlossaryTarget] = useState<GameGlossaryItem | null>(null);

  const [items, setItems] = useState<GameItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    pages: 0,
  });

  // Glossary state
  const [glossaryItems, setGlossaryItems] = useState<GameGlossaryItem[]>([]);
  const [glossaryPagination, setGlossaryPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    pages: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [gameCategoryFilter, setGameCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Glossary filters
  const [glossarySearch, setGlossarySearch] = useState('');
  const [glossaryStatusFilter, setGlossaryStatusFilter] = useState('');
  const [glossarySortBy, setGlossarySortBy] = useState('id');
  const [glossarySortOrder, setGlossarySortOrder] = useState<'asc' | 'desc'>('desc');

  // Game categories
  const [gameCategories, setGameCategories] = useState<GameCategory[]>([]);

  // Queries
  const { data: response, isLoading, error: queryError, refetch } = useGameList({
    page: pagination.page,
    per_page: pagination.per_page,
    search: search || undefined,
    is_active:
      statusFilter === 'active'
        ? true
        : statusFilter === 'inactive'
        ? false
        : undefined,
    game_category_id: gameCategoryFilter
      ? Number(gameCategoryFilter)
      : undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
  });

  const deleteMutation = useDeleteGame();

  // Glossary queries
  const { data: glossaryResponse, isLoading: glossaryLoading, error: glossaryQueryError, refetch: refetchGlossary } = useGameGlossaryList({
    page: glossaryPagination.page,
    per_page: glossaryPagination.per_page,
    search: glossarySearch || undefined,
    is_active:
      glossaryStatusFilter === 'active'
        ? true
        : glossaryStatusFilter === 'inactive'
        ? false
        : undefined,
    game_id: selectedGameForGlossary?.id,
    sort_by: glossarySortBy,
    sort_order: glossarySortOrder,
  });

  const deleteGlossaryMutation = useDeleteGameGlossary();

  // Sync data
  useEffect(() => {
    if (response) {
      setItems(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.total || 0,
        pages: response.pages || 0,
      }));
    }
  }, [response]);

  // Sync glossary data
  useEffect(() => {
    if (!glossaryResponse) return;

    setGlossaryItems(glossaryResponse.data || []);
    setGlossaryPagination(prev => ({
      ...prev,
      page: glossaryResponse.page ?? prev.page,
      per_page: glossaryResponse.per_page ?? prev.per_page,
      total: glossaryResponse.total ?? 0,
      pages: glossaryResponse.pages ?? 0,
    }));
  }, [glossaryResponse]);

  // Load game categories
  useEffect(() => {
    const loadGameCategories = async () => {
      try {
        const result = await gameCategoryAPI.getList({ per_page: 100 });
        setGameCategories(result.data.items || []);
      } catch (err) {
        console.error(err);
        showErrorToast('Failed to load game categories.');
      }
    };
    loadGameCategories();
  }, []);

  // Handlers
  const handleCreate = () => {
    setEditingItem(undefined);
    setShowForm(true);
  };

  const handleEdit = (item: GameItem) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingItem(undefined);
    refetch();
    showToast('Thao tác thành công!');
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingItem(undefined);
  };

  const handleDeleteClick = (item: GameItem) => {
    setDeleteTarget(item);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      refetch();
      showToast('Xóa thành công!');
    } catch (err: any) {
      console.error('Error deleting item:', err);
      showErrorToast(err.message || 'Có lỗi xảy ra khi xóa!');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const handleSort = (
    columnKey: string | null,
    direction: 'asc' | 'desc' | null
  ) => {
    if (!columnKey || !direction) {
      setSortBy('id');
      setSortOrder('desc');
    } else {
      setSortBy(columnKey);
      setSortOrder(direction);
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Glossary handlers
  const handleViewGlossary = (game: GameItem) => {
    setSelectedGameForGlossary(game);
    setViewMode('glossary');
    setGlossaryPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleBackToGames = () => {
    setViewMode('games');
    setSelectedGameForGlossary(null);
  };

  const handleCreateGlossary = () => {
    setEditingGlossaryItem(undefined);
    setShowGlossaryForm(true);
  };

  const handleEditGlossary = (item: GameGlossaryItem) => {
    setEditingGlossaryItem(item);
    setShowGlossaryForm(true);
  };

  const handleGlossaryFormSuccess = () => {
    setShowGlossaryForm(false);
    setEditingGlossaryItem(undefined);
    refetchGlossary();
    showToast('Thao tác thành công!');
  };

  const handleGlossaryFormCancel = () => {
    setShowGlossaryForm(false);
    setEditingGlossaryItem(undefined);
  };

  const handleDeleteGlossaryClick = (item: GameGlossaryItem) => {
    setDeleteGlossaryTarget(item);
    setShowGlossaryDeleteConfirm(true);
  };

  const handleConfirmDeleteGlossary = async () => {
    if (!deleteGlossaryTarget) return;

    try {
      await deleteGlossaryMutation.mutateAsync(deleteGlossaryTarget.id);
      refetchGlossary();
      showToast('Xóa thành công!');
    } catch (err: any) {
      console.error('Error deleting glossary item:', err);
      showErrorToast(err.message || 'Có lỗi xảy ra khi xóa!');
    } finally {
      setShowGlossaryDeleteConfirm(false);
      setDeleteGlossaryTarget(null);
    }
  };

  const handleCancelDeleteGlossary = () => {
    setShowGlossaryDeleteConfirm(false);
    setDeleteGlossaryTarget(null);
  };

  const handleGlossarySort = (
    columnKey: string | null,
    direction: 'asc' | 'desc' | null
  ) => {
    if (!columnKey || !direction) {
      setGlossarySortBy('id');
      setGlossarySortOrder('desc');
    } else {
      setGlossarySortBy(columnKey);
      setGlossarySortOrder(direction);
    }
    setGlossaryPagination(prev => ({ ...prev, page: 1 }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {viewMode === 'games' ? 'Quản Lý Game' : 'Quản Lý Từ Điển Game'}
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {viewMode === 'games'
              ? 'Trung tâm quản lý các game trong hệ thống'
              : `Trung tâm quản lý các thuật ngữ dịch thuật cho game ${selectedGameForGlossary.name}`
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {viewMode === 'glossary' && (
            <Button variant="secondary" onClick={handleBackToGames}>
              ← Quay lại Game
            </Button>
          )}
          <Button onClick={viewMode === 'games' ? handleCreate : handleCreateGlossary}>
            {viewMode === 'games' ? 'Thêm game' : 'Thêm thuật ngữ'}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {queryError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          Failed to load data
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar
        searchValue={viewMode === 'games' ? search : glossarySearch}
        onSearchChange={viewMode === 'games' ? setSearch : setGlossarySearch}
        filters={
          <div className="flex items-center gap-4">
            <select
              value={viewMode === 'games' ? statusFilter : glossaryStatusFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                viewMode === 'games'
                  ? setStatusFilter(e.target.value)
                  : setGlossaryStatusFilter(e.target.value)
              }
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Hoạt động</option>
              <option value="inactive">Tạm dừng</option>
            </select>

            {viewMode === 'games' && (
              <select
                value={gameCategoryFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGameCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Tất cả thể loại</option>
                {gameCategories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={viewMode === 'games' ? pagination.per_page : glossaryPagination.per_page}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                viewMode === 'games'
                  ? setPagination((prev) => ({ ...prev, per_page: Number(e.target.value), page: 1 }))
                  : setGlossaryPagination((prev) => ({ ...prev, per_page: Number(e.target.value), page: 1 }))
              }
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

      {/* Table Components */}
      {viewMode === 'games' ? (
        <GameTable
          items={items}
          loading={isLoading}
          error={queryError ? (queryError as any).response?.data?.detail || 'Failed to load data' : null}
          pagination={pagination}
          gameCategories={gameCategories}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onPageChange={(page: number) => setPagination((prev) => ({ ...prev, page }))}
          onSort={handleSort}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          onViewGlossary={handleViewGlossary}
        />
      ) : (
        <GameGlossaryTable
          items={glossaryItems}
          loading={glossaryLoading}
          error={glossaryQueryError ? (glossaryQueryError as any).response?.data?.detail || 'Failed to load data' : null}
          pagination={glossaryPagination}
          games={selectedGameForGlossary ? [selectedGameForGlossary] : []}
          sortBy={glossarySortBy}
          sortOrder={glossarySortOrder}
          onPageChange={(page: number) => setGlossaryPagination((prev) => ({ ...prev, page }))}
          onSort={handleGlossarySort}
          onEdit={handleEditGlossary}
          onDelete={handleDeleteGlossaryClick}
        />
      )}

      {/* Game Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {editingItem ? 'Chỉnh sửa game' : 'Thêm game mới'}
              </h3>
              <button
                onClick={handleFormCancel}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Đóng"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <GameForm
                item={editingItem}
                onSuccess={handleFormSuccess}
                onCancel={handleFormCancel}
              />
            </div>
          </div>
        </div>
      )}

      {/* Game Glossary Form Modal */}
      {showGlossaryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {editingGlossaryItem ? 'Chỉnh sửa thuật ngữ' : 'Thêm thuật ngữ mới'}
              </h3>
              <button
                onClick={handleGlossaryFormCancel}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Đóng"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <GameGlossaryForm
                item={editingGlossaryItem}
                onSuccess={handleGlossaryFormSuccess}
                onCancel={handleGlossaryFormCancel}
                gameId={selectedGameForGlossary?.id}
              />
            </div>
          </div>
        </div>
      )}

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
                    {`game "${deleteTarget.name}"`}
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

      {/* Game Glossary Delete Confirmation Modal */}
      {showGlossaryDeleteConfirm && deleteGlossaryTarget && (
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
                    {`thuật ngữ "${deleteGlossaryTarget.term}"`}
                  </span>
                  ?
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  Hành động này không thể hoàn tác.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={handleCancelDeleteGlossary}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleConfirmDeleteGlossary}
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
  );
}

export default function GamePage() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <GameContent />
    </QueryClientProvider>
  );
}