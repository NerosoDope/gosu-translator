/**
 * Component: LanguagesPage
 * Purpose:
 *   - Main component for language management
 *   - Display languages list with DataTable
 *   - Handle CRUD operations for languages and language pairs
 *
 * Responsibilities:
 * - Load and display languages list
 * - Handle pagination and filtering
 * - Open/close language form modal
 * - Handle create/update/delete operations
 * - Manage language pairs
 *
 * Important:
 * - Requires "languages:read" permission
 * - Uses react-query for data fetching
 * - Toast notifications for success/error
 */

'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

// Components
import DataTable, { Column } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import FilterBar from '@/components/data/FilterBar';
import Button from '@/components/ui/Button';
import LanguageForm from '@/components/admin/LanguageForm';
import LanguagePairForm from '@/components/admin/LanguagePairForm';

// API
import { languageAPI } from '@/lib/api';

// Types
type TabType = 'languages' | 'pairs';

interface Language {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  is_deleted?: boolean;
  deleted_at?: string;
  source_pairs_count?: number;
  target_pairs_count?: number;
}

interface LanguagePair {
  id: number;
  source_language: Language;
  target_language: Language;
  is_bidirectional: boolean;
  is_active: boolean;
}

interface Tab {
  id: TabType;
  label: string;
  description: string;
}

interface LanguageListResponse {
  data: Language[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface LanguagePair {
  id: number;
  source_language: Language;
  target_language: Language;
  is_bidirectional: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface LanguagePairListResponse {
  items: LanguagePair[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export default function LanguagesPage() {
  // State management
  const [activeTab, setActiveTab] = useState<TabType>('languages');

  // Reset filters when switching tabs
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // Reset pagination for the new tab
    if (tab === 'languages') {
      setPagination(prev => ({ ...prev, page: 1 }));
    } else if (tab === 'pairs') {
      setPairsPagination(prev => ({ ...prev, page: 1 }));
    }
  };
  const [editingLanguage, setEditingLanguage] = useState<Language | undefined>(undefined);
  const [editingPair, setEditingPair] = useState<LanguagePair | undefined>(undefined);
  const [showLanguageForm, setShowLanguageForm] = useState(false);
  const [showPairForm, setShowPairForm] = useState(false);

  // Confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{type: 'language' | 'pair', item: any} | null>(null);

  // Languages state
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    pages: 0,
  });

  // Filter and sort states for languages
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [sortBy, setSortBy] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Language pairs state
  const [languagePairs, setLanguagePairs] = useState<LanguagePair[]>([]);
  const [pairsLoading, setPairsLoading] = useState(false);
  const [pairsError, setPairsError] = useState<string | null>(null);
  const [pairsPagination, setPairsPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    pages: 0,
  });

  // Filter states for pairs
  const [pairsSearch, setPairsSearch] = useState('');
  const [pairsStatusFilter, setPairsStatusFilter] = useState<string>('');
  const [sourceLanguageFilter, setSourceLanguageFilter] = useState<string>('');
  const [targetLanguageFilter, setTargetLanguageFilter] = useState<string>('');

  // Tab configuration
  const tabs: Tab[] = [
    {
      id: 'languages',
      label: 'Ngôn ngữ',
      description: 'Quản lý danh sách ngôn ngữ được hỗ trợ trong hệ thống'
    },
    {
      id: 'pairs',
      label: 'Cặp ngôn ngữ',
      description: 'Cấu hình các cặp ngôn ngữ được phép dịch thuật'
    }
  ];

  // Load languages
  const loadLanguages = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        skip: (pagination.page - 1) * pagination.per_page,
        limit: pagination.per_page,
      };

      if (search) params.query = search;
      if (statusFilter) params.is_active = statusFilter === 'active';
      if (showDeleted) params.include_deleted = showDeleted;
      if (sortBy) {
        params.sort_by = sortBy;
        params.sort_order = sortOrder;
      }

      const response = await languageAPI.getList(params);
      const data = response.data;
      setLanguages(data.items || []);
      setPagination({
        ...pagination,
        total: data.total || 0,
        pages: data.pages || 0,
      });
    } catch (error: any) {
      console.error('Error loading languages:', error);
      setError(error.response?.data?.detail || 'Không thể tải danh sách ngôn ngữ');
      setLanguages([]);
    } finally {
      setLoading(false);
    }
  };

  // Load languages
  const loadLanguagePairs = async () => {
    try {
      setPairsLoading(true);
      setPairsError(null);

      const params: any = {
        skip: (pairsPagination.page - 1) * pairsPagination.per_page,
        limit: pairsPagination.per_page,
      };

      if (pairsSearch) params.query = pairsSearch;
      if (pairsStatusFilter) params.is_active = pairsStatusFilter === 'active';
      if (sourceLanguageFilter) params.source_language_id = parseInt(sourceLanguageFilter);
      if (targetLanguageFilter) params.target_language_id = parseInt(targetLanguageFilter);

      const response = await languageAPI.getPairs(params);
      const data = response.data;
      setLanguagePairs(data.items || []);
      setPairsPagination({
        ...pairsPagination,
        total: data.total || 0,
        pages: data.pages || 0,
      });
    } catch (error: any) {
      console.error('Error loading language pairs:', error);
      setPairsError(error.response?.data?.detail || 'Không thể tải danh sách cặp ngôn ngữ');
      setLanguagePairs([]);
    } finally {
      setPairsLoading(false);
    }
  };

  // Load languages data (needed for filters in pairs tab)
  useEffect(() => {
    if (languages.length === 0) {
      loadLanguages();
    }
  }, []);

  // Load languages data when tab changes to languages
  useEffect(() => {
    if (activeTab === 'languages') {
      loadLanguages();
    }
  }, [pagination.page, pagination.per_page, search, statusFilter, showDeleted, sortBy, sortOrder]);

  // Load pairs data when tab changes to pairs (only after languages are loaded)
  useEffect(() => {
    if (activeTab === 'pairs' && languages.length > 0) {
      loadLanguagePairs();
    }
  }, [activeTab, languages.length, pairsPagination.page, pairsPagination.per_page, pairsSearch, pairsStatusFilter, sourceLanguageFilter, targetLanguageFilter]);

  // Event handlers
  const handleLanguageCreate = () => {
    setEditingLanguage(undefined);
    setShowLanguageForm(true);
  };

  const handleLanguageEdit = (language: Language) => {
    setEditingLanguage(language);
    setShowLanguageForm(true);
  };

  const handleLanguageFormSuccess = () => {
    setShowLanguageForm(false);
    setEditingLanguage(undefined);
    if (activeTab === 'languages') {
      loadLanguages();
    }
  };

  const handleLanguageFormCancel = () => {
    setShowLanguageForm(false);
    setEditingLanguage(undefined);
  };

  const handlePairCreate = () => {
    setEditingPair(undefined);
    setShowPairForm(true);
  };

  const handlePairEdit = (pair: LanguagePair) => {
    setEditingPair(pair);
    setShowPairForm(true);
  };

  const handlePairFormSuccess = () => {
    setShowPairForm(false);
    setEditingPair(undefined);
    if (activeTab === 'pairs') {
      loadLanguagePairs();
    }
  };

  const handlePairFormCancel = () => {
    setShowPairForm(false);
    setEditingPair(undefined);
  };

  const handleDeleteLanguage = (language: Language) => {
    setDeleteTarget({ type: 'language', item: language });
    setShowDeleteConfirm(true);
  };

  const handleDeletePair = (pair: LanguagePair) => {
    setDeleteTarget({ type: 'pair', item: pair });
    setShowDeleteConfirm(true);
  };

  // Handle confirmation modal
  const handleRestoreLanguage = async (language: Language) => {
    try {
      await languageAPI.restore(language.id);
      if (activeTab === 'languages') {
        loadLanguages();
      }
    } catch (error: any) {
      console.error('Error restoring language:', error);
      // Could show error toast here
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'language') {
        await languageAPI.delete(deleteTarget.item.id);
        if (activeTab === 'languages') {
          loadLanguages();
        }
      } else if (deleteTarget.type === 'pair') {
        await languageAPI.deletePair(deleteTarget.item.id);
        if (activeTab === 'pairs') {
          loadLanguagePairs();
        }
      }
    } catch (error: any) {
      console.error('Error deleting:', error);
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

  // DataTable columns for languages
  const languageColumns: Column<Language>[] = [
    {
      key: 'id',
      header: 'STT',
      sortable: false,
      render: (language: Language, index?: number) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {index !== undefined ? (pagination.page - 1) * pagination.per_page + index + 1 : '-'}
        </span>
      ),
    },
    {
      key: 'code',
      header: 'Mã ngôn ngữ',
      sortable: true,
      render: (language: Language) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
          {language.code.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Tên ngôn ngữ',
      sortable: true,
      render: (language: Language) => (
        <span className="text-gray-900 dark:text-gray-100 font-medium">
          {language.name}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Trạng thái',
      sortable: true,
      render: (language: Language) => (
        <div className="flex flex-col gap-1">
          <span
            className={`inline-flex w-fit items-center px-2 py-1 text-xs rounded-full ${
              language.is_active
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}
          >
            {language.is_active ? 'Hoạt động' : 'Tạm dừng'}
          </span>
          {language.is_deleted && (
            <span className="inline-flex w-fit items-center px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
              Đã xóa
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'source_pairs_count',
      header: 'Cặp nguồn',
      sortable: true,
      render: (language: Language) => (
        <span className="text-gray-600 dark:text-gray-400">
          {language.source_pairs_count || 0}
        </span>
      ),
    },
    {
      key: 'target_pairs_count',
      header: 'Cặp đích',
      sortable: true,
      render: (language: Language) => (
        <span className="text-gray-600 dark:text-gray-400">
          {language.target_pairs_count || 0}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      sortable: false,
      className: 'text-right',
      render: (language: Language) => (
        <div className="flex items-center gap-2">
          {!language.is_deleted ? (
            <>
              <button
                onClick={() => handleLanguageEdit(language)}
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
                onClick={() => handleDeleteLanguage(language)}
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
              onClick={() => handleRestoreLanguage(language)}
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

  // DataTable columns for language pairs
  const pairColumns: Column<LanguagePair>[] = [
    {
      key: 'id',
      header: 'STT',
      sortable: false,
      render: (pair: LanguagePair, index?: number) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {index !== undefined ? (pairsPagination.page - 1) * pairsPagination.per_page + index + 1 : '-'}
        </span>
      ),
    },
    {
      key: 'source_language',
      header: 'Ngôn ngữ nguồn',
      sortable: true,
      render: (pair: LanguagePair) => (
        <div className="flex items-center gap-2">
          <span className="text-gray-900 dark:text-gray-100">
            {pair.source_language.name}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            {pair.source_language.code.toUpperCase()}
          </span>
        </div>
      ),
    },
    {
      key: 'target_language',
      header: 'Ngôn ngữ đích',
      sortable: true,
      render: (pair: LanguagePair) => (
        <div className="flex items-center gap-2">
          <span className="text-gray-900 dark:text-gray-100">
            {pair.target_language.name}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
            {pair.target_language.code.toUpperCase()}
          </span>
        </div>
      ),
    },
    {
      key: 'is_bidirectional',
      header: 'Dịch hai chiều',
      sortable: true,
      render: (pair: LanguagePair) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            pair.is_bidirectional
              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          {pair.is_bidirectional ? 'Có' : 'Không'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Trạng thái',
      sortable: true,
      render: (pair: LanguagePair) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            pair.is_active
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {pair.is_active ? 'Hoạt động' : 'Tạm dừng'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      sortable: false,
      className: 'text-right',
      render: (pair: LanguagePair) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePairEdit(pair)}
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
            onClick={() => handleDeletePair(pair)}
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
  ];

  return (
    <QueryClientProvider client={new QueryClient()}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Quản Lý Ngôn Ngữ
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Trung tâm quản lý ngôn ngữ và cặp ngôn ngữ cho hệ thống dịch thuật
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'languages' && (
          <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Danh sách ngôn ngữ
              </h2>
              <Button onClick={handleLanguageCreate}>
                Thêm ngôn ngữ
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

            {/* Data Table */}
            <DataTable
              data={languages}
              columns={languageColumns}
              isLoading={loading}
              emptyMessage="Không tìm thấy ngôn ngữ. Nhấn 'Thêm ngôn ngữ' để tạo ngôn ngữ đầu tiên."
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

            {/* Language Form Modal */}
            {showLanguageForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {editingLanguage ? 'Chỉnh sửa ngôn ngữ' : 'Thêm ngôn ngữ mới'}
                    </h3>
                    <button
                      onClick={handleLanguageFormCancel}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Đóng"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-6">
                    <LanguageForm
                      language={editingLanguage}
                      onSuccess={handleLanguageFormSuccess}
                      onCancel={handleLanguageFormCancel}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Language Pairs Tab */}
        {activeTab === 'pairs' && (
          <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Danh sách cặp ngôn ngữ
              </h2>
              <Button onClick={handlePairCreate}>
                Thêm cặp ngôn ngữ
              </Button>
            </div>

            {/* Error Message */}
            {pairsError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
                {pairsError}
              </div>
            )}

            {/* Filter Bar */}
            <FilterBar
              searchValue={pairsSearch}
              onSearchChange={setPairsSearch}
              filters={
                <div className="flex items-center gap-4">
                  <select
                    value={pairsStatusFilter}
                    onChange={(e) => setPairsStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Tạm dừng</option>
                  </select>

                  <select
                    value={sourceLanguageFilter}
                    onChange={(e) => setSourceLanguageFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={languages.length === 0}
                  >
                    <option value="">
                      {languages.length === 0 ? 'Đang tải...' : 'Tất cả nguồn'}
                    </option>
                    {languages.map((lang: Language) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.name} ({lang.code.toUpperCase()})
                      </option>
                    ))}
                  </select>

                  <select
                    value={targetLanguageFilter}
                    onChange={(e) => setTargetLanguageFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={languages.length === 0}
                  >
                    <option value="">
                      {languages.length === 0 ? 'Đang tải...' : 'Tất cả đích'}
                    </option>
                    {languages.map((lang: Language) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.name} ({lang.code.toUpperCase()})
                      </option>
                    ))}
                  </select>

                  <select
                    value={pairsPagination.per_page}
                    onChange={(e) => setPairsPagination((prev) => ({ ...prev, per_page: Number(e.target.value), page: 1 }))}
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
              data={languagePairs}
              columns={pairColumns}
              isLoading={pairsLoading}
              emptyMessage="Không tìm thấy cặp ngôn ngữ. Nhấn 'Thêm cặp ngôn ngữ' để tạo cặp ngôn ngữ đầu tiên."
            />

            {/* Pagination */}
            {pairsPagination.pages > 1 && (
              <Pagination
                currentPage={pairsPagination.page}
                totalPages={pairsPagination.pages}
                onPageChange={(page) =>
                  setPairsPagination((prev) => ({ ...prev, page }))
                }
                pageSize={pairsPagination.per_page}
                totalItems={pairsPagination.total}
              />
            )}

            {/* Language Pair Form Modal */}
            {showPairForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {editingPair ? 'Chỉnh sửa cặp ngôn ngữ' : 'Thêm cặp ngôn ngữ mới'}
                    </h3>
                    <button
                      onClick={handlePairFormCancel}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Đóng"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-6">
                    <LanguagePairForm
                      pair={editingPair}
                      onSuccess={handlePairFormSuccess}
                      onCancel={handlePairFormCancel}
                    />
                  </div>
                </div>
              </div>
            )}
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
                      {deleteTarget.type === 'language'
                        ? `ngôn ngữ "${deleteTarget.item.name}" (${deleteTarget.item.code.toUpperCase()})`
                        : `cặp ngôn ngữ "${deleteTarget.item.source_language.name} → ${deleteTarget.item.target_language.name}"`
                      }
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