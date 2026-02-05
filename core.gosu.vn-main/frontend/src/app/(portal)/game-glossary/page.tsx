'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useSearchParams } from 'next/navigation';

// Components
import FilterBar from '@/components/data/FilterBar';
import Button from '@/components/ui/Button';
import GameGlossaryForm from '@/components/admin/GameGlossaryForm';
import GameGlossaryTable from '@/components/admin/GameGlossaryTable';

// Hooks
import {
  useGameGlossaryList,
  useDeleteGameGlossary
} from '@/hooks/useGameGlossary';

// API
import { gameAPI } from '@/lib/api';

// Context
import { useToastContext } from '@/context/ToastContext';

// Types
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

interface Game {
  id: number;
  name: string;
}

function GameGlossaryContent() {
  const { success: showToast, error: showErrorToast } = useToastContext();
  const searchParams = useSearchParams();
  const urlGameId = searchParams.get('game_id');

  // State
  const [editingItem, setEditingItem] = useState<GameGlossaryItem | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GameGlossaryItem | null>(null);
  const [readingItem, setReadingItem] = useState<GameGlossaryItem | undefined>();
  const [showReadModal, setShowReadModal] = useState(false);

  const [items, setItems] = useState<GameGlossaryItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    pages: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [languagePairFilter, setLanguagePairFilter] = useState('');
  const [gameFilter, setGameFilter] = useState<string>(urlGameId || '');
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Games
  const [games, setGames] = useState<Game[]>([]);

  // Queries
  const { data: response, isLoading, error: queryError, refetch } = useGameGlossaryList({
    page: pagination.page,
    per_page: pagination.per_page,
    search: search || undefined,
    is_active:
      statusFilter === 'active'
        ? true
        : statusFilter === 'inactive'
        ? false
        : undefined,
    language_pair: languagePairFilter || undefined,
    game_id: gameFilter
      ? Number(gameFilter)
      : undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
  });

  const deleteMutation = useDeleteGameGlossary();

  // Sync data
  useEffect(() => {
    if (!response) return;
  
    console.log("Game glossary API response:", response);
  
    setItems(response.data || []);
  
    setPagination(prev => ({
      ...prev,
      page: response.page ?? prev.page,
      per_page: response.per_page ?? prev.per_page,
      total: response.total ?? 0,
      pages: response.pages ?? 0,
    }));
  }, [response]);
  

  // Load games
  useEffect(() => {
    const loadGames = async () => {
      try {
        const result = await gameAPI.getList({ per_page: 100, is_active: true });
        setGames(result.data || []);
      } catch (err) {
        console.error(err);
        showErrorToast('Failed to load games.');
      }
    };
  
    loadGames();
  }, []);

  // Handlers
  const handleCreate = () => {
    setEditingItem(undefined);
    setShowForm(true);
  };

  const handleRead = useCallback((item: GameGlossaryItem) => {
    setReadingItem(item);
    setShowReadModal(true);
  }, []);


  const handleEdit = useCallback((item: GameGlossaryItem) => {
    setEditingItem(item);
    setShowForm(true);
  }, []);

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

  const handleReadModalClose = () => {
    setShowReadModal(false);
    setReadingItem(undefined);
  };

  const handleDeleteClick = (item: GameGlossaryItem) => {
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

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Quản Lý Từ Điển Game
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Trung tâm quản lý các thuật ngữ dịch thuật trong game
            </p>
          </div>
          <Button onClick={handleCreate}>
            Thêm thuật ngữ
          </Button>
        </div>
          {/* Filter Bar */}
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            filters={
              <div className="flex items-center gap-4">
                <select
                  value={statusFilter}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Tạm dừng</option>
                </select>

                <select
                  value={gameFilter}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGameFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Tất cả game</option>
                  {games.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>

                <select
                  value={pagination.per_page}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPagination((prev) => ({ ...prev, per_page: Number(e.target.value), page: 1 }))}
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

          {/* Game Glossary Table Component */}
          <GameGlossaryTable
            items={items}
            loading={isLoading}
            error={queryError ? (queryError as any).response?.data?.detail || 'Failed to load data' : null}
            pagination={pagination}
            games={games}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onPageChange={(page: number) => setPagination((prev) => ({ ...prev, page }))}
            onSort={handleSort}
            onRead={handleRead}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
          />


          {showReadModal && readingItem && (
            <div
              key={`modal-${readingItem.id}`}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              onClick={handleReadModalClose}
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto p-6">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Game Glossary Details</h3>
                    <button
                      onClick={handleReadModalClose}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-2">
                    <p><strong>ID:</strong> {readingItem.id}</p>
                    <p><strong>Term:</strong> {readingItem.term}</p>
                    <p><strong>Translated Term:</strong> {readingItem.translated_term}</p>
                    <p><strong>Language Pair:</strong> {readingItem.language_pair}</p>
                    <p><strong>Game ID:</strong> {readingItem.game_id}</p>
                    <p><strong>Usage Count:</strong> {readingItem.usage_count}</p>
                    <p><strong>Active:</strong> {readingItem.is_active ? 'Yes' : 'No'}</p>
                    <p><strong>Created:</strong> {readingItem.created_at}</p>
                    {readingItem.updated_at && <p><strong>Updated:</strong> {readingItem.updated_at}</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

                  {/* Content */}
                  <div className="p-6">
                    {/* Main Term Display */}
                    <div className="mb-8">
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {/* Terms in same row */}
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 mb-4 items-start md:items-center min-h-[80px]">
                              {/* Original Term */}
                              <div>
                                <div className="flex items-center space-x-2 mb-2">
                                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-9 0V1m10 3V1m0 3l1 1v16a2 2 0 01-2 2H6a2 2 0 01-2-2V5l1-1z" />
                                  </svg>
                                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Thuật ngữ gốc</span>
                                </div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                  {readingItem.term}
                                </h1>
                              </div>

                              {/* Translation Arrow */}
                              <div className="hidden md:flex items-center justify-center px-2 py-4 self-center">
                                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center shadow-lg">
                                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                  </svg>
                                </div>
                              </div>

                              {/* Mobile Arrow (shown only on mobile) */}
                              <div className="flex md:hidden justify-center py-2">
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                    </svg>
                                  </div>
                                </div>
                              </div>

                              {/* Translated Term */}
                              <div>
                                <div className="flex items-center space-x-2 mb-2">
                                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                                  </svg>
                                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Thuật ngữ dịch</span>
                                </div>
                                <p className="text-xl font-bold text-gray-700 dark:text-gray-300">
                                  {readingItem.translated_term}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="ml-6">
                            <span
                              className={`inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full ${
                                readingItem.is_active
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              }`}
                            >
                              <div className={`w-2 h-2 rounded-full mr-2 ${
                                readingItem.is_active ? 'bg-green-500' : 'bg-red-500'
                              }`}></div>
                              {readingItem.is_active ? 'Hoạt động' : 'Tạm dừng'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                      {/* Language Pair */}
                      <div className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Cặp ngôn ngữ</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {readingItem.language_pair}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Game */}
                      <div className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976-2.888c-.783-.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Game</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {games.find(game => game.id === readingItem.game_id)?.name || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Usage Count */}
                      <div className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Số lần sử dụng</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{readingItem.usage_count}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Thông tin thời gian
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                          <div className="flex items-center space-x-2 mb-2">
                            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ngày tạo</span>
                          </div>
                          <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                            {new Date(readingItem.created_at).toLocaleString('vi-VN', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </p>
                        </div>

                        {readingItem.updated_at && (
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                            <div className="flex items-center space-x-2 mb-2">
                              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ngày cập nhật</span>
                            </div>
                            <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                              {new Date(readingItem.updated_at).toLocaleString('vi-VN', {
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
            </div>
          )}

          {/* Game Glossary Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {editingItem ? 'Chỉnh sửa thuật ngữ' : 'Thêm thuật ngữ mới'}
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
          <GameGlossaryForm
            item={editingItem}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
            gameId={urlGameId ? Number(urlGameId) : undefined}
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
                      {`thuật ngữ "${deleteTarget.term}"`}
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
  );
}

export default function GameGlossaryPage() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <GameGlossaryContent />
    </QueryClientProvider>
  );
}