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
import ExcelUploadModal from '@/components/admin/ExcelUploadModal';

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
import { gameCategoryAPI, gameGlossaryAPI } from '@/lib/api';

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
  import_id?: number | null;
  imported_at?: string | null;
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
  const [readingGlossaryItem, setReadingGlossaryItem] = useState<GameGlossaryItem | undefined>();
  const [showReadGlossaryModal, setShowReadGlossaryModal] = useState(false);

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

  // Upload Excel modal
  const [showUploadModal, setShowUploadModal] = useState(false);

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

  // Sync data: useQuery.data = axios response; API body = axiosResponse.data (có thể là array hoặc { data, total, page, per_page, pages })
  useEffect(() => {
    const axiosResponse = response?.data;
    if (axiosResponse === undefined) return;
    const apiBody = axiosResponse?.data !== undefined ? axiosResponse.data : axiosResponse;
    const body = Array.isArray(apiBody) ? { data: apiBody, total: apiBody.length, pages: 1 } : apiBody;
    const list = body?.data ?? [];
    setItems(list);
    setPagination(prev => ({
      ...prev,
      total: body?.total ?? 0,
      pages: body?.pages ?? 0,
      ...(body?.page != null && { page: body.page }),
      ...(body?.per_page != null && { per_page: body.per_page }),
    }));
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

  const handleReadGlossary = (item: GameGlossaryItem) => {
    setReadingGlossaryItem(item);
    setShowReadGlossaryModal(true);
  };

  const handleReadGlossaryModalClose = () => {
    setShowReadGlossaryModal(false);
    setReadingGlossaryItem(undefined);
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

  const handleExportGlossaryExcel = async () => {
    if (!selectedGameForGlossary) return;
    try {
      const response = await gameGlossaryAPI.exportExcel(selectedGameForGlossary.id);
      const blob = new Blob(
        [response.data],
        {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `game_glossary_game_${selectedGameForGlossary.id}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('Đã xuất Excel từ điển game thành công.');
    } catch (error: any) {
      console.error('Export Excel error:', error);
      const message =
        error.response?.data?.detail ||
        error.message ||
        'Có lỗi xảy ra khi xuất Excel từ điển game.';
      showErrorToast(message);
    }
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
              : `Trung tâm quản lý các thuật ngữ dịch thuật cho game ${selectedGameForGlossary?.name ?? ''}`
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {viewMode === 'glossary' && (
            <>
              <Button variant="secondary" onClick={handleBackToGames}>
                ← Quay lại Game
              </Button>
              <Button
                variant="secondary"
                onClick={handleExportGlossaryExcel}
              >
                <svg
                  className="w-5 h-5 mr-2 inline"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v12a2 2 0 002 2h12"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 12l-4 4m0 0l-4-4m4 4V2"
                  />
                </svg>
                Export Excel
              </Button>
              <Button
                onClick={() => setShowUploadModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <svg
                  className="w-5 h-5 mr-2 inline"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Upload Excel
              </Button>
            </>
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
          onRead={handleReadGlossary}
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

      {/* Chi tiết thuật ngữ game (Read Modal) */}
      {showReadGlossaryModal && readingGlossaryItem && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]"
          onClick={handleReadGlossaryModalClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="read-glossary-modal-title"
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 id="read-glossary-modal-title" className="text-xl font-semibold text-gray-900 dark:text-gray-100">Chi tiết thuật ngữ game</h3>
              <button
                onClick={handleReadGlossaryModalClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Đóng"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-8">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 mb-4 items-start md:items-center min-h-[80px]">
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-9 0V1m10 3V1m0 3l1 1v16a2 2 0 01-2 2H6a2 2 0 01-2-2V5l1-1z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Thuật ngữ gốc</span>
                          </div>
                          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{readingGlossaryItem.term}</h1>
                        </div>
                        <div className="hidden md:flex items-center justify-center px-2 py-4 self-center">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex md:hidden justify-center py-2">
                          <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                            </svg>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Thuật ngữ dịch</span>
                          </div>
                          <p className="text-xl font-bold text-gray-700 dark:text-gray-300">{readingGlossaryItem.translated_term}</p>
                        </div>
                      </div>
                    </div>
                    <div className="ml-6">
                      <span
                        className={`inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full ${
                          readingGlossaryItem.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full mr-2 ${readingGlossaryItem.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                        {readingGlossaryItem.is_active ? 'Hoạt động' : 'Tạm dừng'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Cặp ngôn ngữ</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{readingGlossaryItem.language_pair}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976-2.888c-.783-.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Game</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {selectedGameForGlossary?.id === readingGlossaryItem.game_id ? selectedGameForGlossary.name : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Số lần sử dụng</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{readingGlossaryItem.usage_count}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Thông tin
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center space-x-2 mb-2">
                      <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7a2 2 0 010-2.828l7-7A1.994 1.994 0 0112 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7a2 2 0 010-2.828l7-7A1.994 1.994 0 0112 3z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Import ID</span>
                    </div>
                    <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                      {readingGlossaryItem.import_id != null ? readingGlossaryItem.import_id : '—'}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center space-x-2 mb-2">
                      <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {readingGlossaryItem.import_id != null ? 'Thời gian import' : 'Ngày tạo'}
                      </span>
                    </div>
                    <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                      {new Date(
                        (readingGlossaryItem.import_id != null && readingGlossaryItem.imported_at)
                          ? readingGlossaryItem.imported_at
                          : readingGlossaryItem.created_at
                      ).toLocaleString('vi-VN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </p>
                  </div>
                  {readingGlossaryItem.updated_at && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600 md:col-span-2">
                      <div className="flex items-center space-x-2 mb-2">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ngày cập nhật</span>
                      </div>
                      <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                        {new Date(readingGlossaryItem.updated_at).toLocaleString('vi-VN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
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

      {/* Game Glossary Excel Upload Modal */}
      {viewMode === 'glossary' && selectedGameForGlossary && (
        <ExcelUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            refetchGlossary();
          }}
          uploadFunction={(file) =>
            gameGlossaryAPI.uploadExcel(file, selectedGameForGlossary.id)
          }
          title={`Upload Excel - Từ Điển Game (${selectedGameForGlossary.name})`}
          gameId={selectedGameForGlossary.id}
          glossaryType="game_glossary"
        />
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