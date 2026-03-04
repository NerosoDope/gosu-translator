'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import DataTable, { Column } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import FilterBar from '@/components/data/FilterBar';
import Button from '@/components/ui/Button';
import { cacheAPI } from '@/lib/api';
import { useToastContext } from '@/context/ToastContext';

const ORIGIN_LABELS: Record<string, string> = {
  direct: 'Dịch trực tiếp',
  file: 'Dịch file',
  proofread: 'Hiệu đính',
};

interface CacheItem {
  id: number;
  key: string;
  value: string;
  source_text?: string | null;
  ttl?: number | null;
  origin?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function formatDateTime(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

/** Parse cặp ngôn ngữ từ cache key (format: translate:source_lang:target_lang:hash). */
function getLanguagePairFromKey(key: string | null | undefined): { source: string; target: string } | null {
  if (!key || typeof key !== 'string') return null;
  const parts = key.split(':');
  if (parts[0] !== 'translate' || parts.length < 4) return null;
  return { source: parts[1], target: parts[2] };
}

function CachePageContent() {
  const toast = useToastContext();
  const [items, setItems] = useState<CacheItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    pages: 0,
  });
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [exporting, setExporting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CacheItem | null>(null);
  const [detailItem, setDetailItem] = useState<CacheItem | null>(null);

  const loadCache = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = {
        skip: (pagination.page - 1) * pagination.per_page,
        limit: pagination.per_page,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (search.trim()) params.query = search.trim();
      if (originFilter) params.origin = originFilter;
      const res = await cacheAPI.getList(params);
      const data = res.data;
      if (data && typeof data === 'object' && Array.isArray(data.items)) {
        setItems(data.items);
        setPagination(prev => ({
          ...prev,
          total: data.total ?? 0,
          pages: data.pages ?? Math.ceil((data.total ?? 0) / prev.per_page),
        }));
      } else if (Array.isArray(data)) {
        setItems(data);
        setPagination(prev => ({
          ...prev,
          total: data.length,
          pages: Math.ceil(data.length / prev.per_page),
        }));
      } else {
        setItems([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Không thể tải danh sách cache');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCache();
  }, [pagination.page, pagination.per_page, search, originFilter, sortBy, sortOrder]);

  const handleSort = (columnKey: string | null, direction: 'asc' | 'desc' | null) => {
    if (columnKey == null) {
      setSortBy('id');
      setSortOrder('desc');
    } else if (sortBy === columnKey) {
      if (direction === 'asc') setSortOrder('desc');
      else if (direction === 'desc') {
        setSortBy('id');
        setSortOrder('desc');
      } else setSortOrder('desc');
    } else {
      setSortBy(columnKey);
      setSortOrder(direction === 'desc' ? 'desc' : 'asc');
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const params: Record<string, string> = {};
      if (search.trim()) params.query = search.trim();
      if (originFilter) params.origin = originFilter;
      const res = await cacheAPI.exportExcel(params);
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cache_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Xuất Excel thành công!');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Không thể xuất file');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (row: CacheItem) => {
    setDeleteConfirm(row);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setDeletingId(deleteConfirm.id);
      await cacheAPI.delete(deleteConfirm.id);
      toast.success('Xóa cache thành công!');
      loadCache();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Không thể xóa cache');
    } finally {
      setDeletingId(null);
      setDeleteConfirm(null);
    }
  };

  const columns: Column<CacheItem>[] = [
    {
      key: 'id',
      header: 'STT',
      sortable: false,
      render: (row: CacheItem, index?: number) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {index !== undefined ? (pagination.page - 1) * pagination.per_page + index + 1 : '-'}
        </span>
      ),
    },
    {
      key: 'key',
      header: 'Key',
      sortable: true,
      render: (row: CacheItem) => (
        <span className="font-medium text-gray-900 dark:text-gray-100 break-all">{row.key}</span>
      ),
    },
    {
      key: 'value',
      header: 'Nội dung',
      sortable: false,
      render: (row: CacheItem) => (
        <span className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate block" title={row.value}>
          {row.value && row.value.length > 80 ? row.value.slice(0, 80) + '...' : row.value}
        </span>
      ),
    },
    {
      key: 'origin',
      header: 'Nguồn',
      sortable: false,
      render: (row: CacheItem) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {row.origin ? (ORIGIN_LABELS[row.origin] ?? row.origin) : '—'}
        </span>
      ),
    },
    {
      key: 'ttl',
      header: 'TTL',
      sortable: true,
      render: (row: CacheItem) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{row.ttl ?? 'N/A'}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      sortable: false,
      className: 'text-left',
      render: (row: CacheItem) => (
        <div className="flex items-center justify-start gap-2">
          <button
            onClick={() => setDetailItem(row)}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            title="Xem chi tiết"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            onClick={() => handleDelete(row)}
            disabled={deletingId === row.id}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
            title="Xóa cache"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Quản Lý Cache</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Lưu trữ kết quả thuật ngữ đã dịch, tối ưu hiệu năng. Cache được tạo tự động khi dịch.
          </p>
        </div>
        <Button onClick={handleExportExcel} disabled={exporting}>
          {exporting ? 'Đang xuất...' : 'Xuất Excel'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo key..."
        filters={
          <>
            <select
              value={originFilter}
              onChange={(e) => {
                setOriginFilter(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              title="Lọc theo nguồn"
            >
              <option value="">Tất cả nguồn</option>
              <option value="direct">Dịch trực tiếp</option>
              <option value="file">Dịch file</option>
              <option value="proofread">Hiệu đính</option>
            </select>
            <select
              value={pagination.per_page}
              onChange={(e) => setPagination(prev => ({ ...prev, per_page: Number(e.target.value), page: 1 }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={5}>5 / trang</option>
              <option value={10}>10 / trang</option>
              <option value={20}>20 / trang</option>
              <option value={50}>50 / trang</option>
            </select>
          </>
        }
      />

      <DataTable
        data={items}
        columns={columns}
        isLoading={loading}
        emptyMessage="Không tìm thấy cache. Cache được tạo tự động trong quá trình dịch."
        onSort={handleSort}
        sortColumn={sortBy}
        sortDirection={sortOrder === 'asc' ? 'asc' : 'desc'}
      />

      {pagination.pages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
          pageSize={pagination.per_page}
          totalItems={pagination.total}
        />
      )}

      {detailItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setDetailItem(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Chi tiết cache</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all">{detailItem.key}</p>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nội dung gốc</label>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 p-3 text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                  {detailItem.source_text ?? '—'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nội dung đã dịch</label>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 p-3 text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                  {detailItem.value ?? '—'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {(() => {
                  const pair = getLanguagePairFromKey(detailItem.key);
                  return pair ? (
                    <div className="col-span-2">
                      <span className="text-gray-500 dark:text-gray-400">Cặp ngôn ngữ</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {pair.source} → {pair.target}
                      </p>
                    </div>
                  ) : null;
                })()}
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Nguồn</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {detailItem.origin ? (ORIGIN_LABELS[detailItem.origin] ?? detailItem.origin) : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">TTL</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{detailItem.ttl ?? '—'}s</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Thời gian tạo</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{formatDateTime(detailItem.created_at)}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Cập nhật</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{formatDateTime(detailItem.updated_at)}</p>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Bạn có chắc muốn xóa cache key &quot;{deleteConfirm.key}&quot;? Việc xóa có thể làm tăng số lần gọi AI trong các lần dịch tiếp theo.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingId === deleteConfirm.id}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CachePage() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <CachePageContent />
    </QueryClientProvider>
  );
}
