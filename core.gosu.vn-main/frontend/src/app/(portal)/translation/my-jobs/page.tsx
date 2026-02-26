'use client';

import React, { useState, useEffect } from 'react';
import { authStore } from '@/lib/auth';
import DataTable, { Column } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import FilterBar from '@/components/data/FilterBar';
import { jobAPI } from '@/lib/api';
import { useToastContext } from '@/context/ToastContext';

interface Job {
  id: number;
  job_code: string;
  job_type: string;
  status: string;
  priority: number;
  user_id: number;
  creator_name?: string | null;
  progress?: number;
  source_lang?: string;
  target_lang?: string;
  created_at?: string;
}

export default function MyJobsPage() {
  const toast = useToastContext();
  const [userId, setUserId] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 10, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [viewingJob, setViewingJob] = useState<Job | null>(null);

  useEffect(() => {
    let mounted = true;
    authStore.getCurrentUser().then((user) => {
      if (mounted && user?.id) setUserId(user.id);
    });
    return () => { mounted = false; };
  }, []);

  const loadJobs = async () => {
    if (userId == null) return;
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        skip: (pagination.page - 1) * pagination.per_page,
        limit: pagination.per_page,
        user_id: userId,
      };
      if (search) params.query = search;
      if (statusFilter) params.status = statusFilter;

      const response = await jobAPI.getList(params);
      const data = response.data;
      if (data && typeof data === 'object' && Array.isArray(data.items)) {
        setJobs(data.items);
        setPagination((prev) => ({
          ...prev,
          total: data.total ?? 0,
          pages: data.pages ?? Math.ceil((data.total ?? 0) / prev.per_page),
        }));
      } else {
        setJobs([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Không thể tải danh sách jobs');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId != null) loadJobs();
  }, [userId, pagination.page, pagination.per_page, search, statusFilter]);

  const columns: Column<Job>[] = [
    {
      key: 'job_code',
      header: 'Mã Job',
      sortable: false,
      render: (j) => <span className="font-medium text-gray-900 dark:text-gray-100">{j.job_code}</span>,
    },
    {
      key: 'job_type',
      header: 'Loại',
      sortable: false,
      render: (j) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
          {j.job_type}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      sortable: false,
      render: (j) => {
        const statusColors: Record<string, string> = {
          pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
          in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
          completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          failed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
          cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        };
        return (
          <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${statusColors[j.status] || statusColors.pending}`}>
            {j.status}
          </span>
        );
      },
    },
    {
      key: 'progress',
      header: 'Tiến độ',
      sortable: false,
      render: (j) => (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${j.progress || 0}%` }} />
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">{j.progress ?? 0}%</span>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Ngày tạo',
      sortable: false,
      render: (j) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {j.created_at ? new Date(j.created_at).toLocaleString() : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      sortable: false,
      render: (j) => (
        <button
          onClick={() => setViewingJob(j)}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          title="Xem chi tiết"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      ),
    },
  ];

  if (userId == null && !loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Jobs Của Tôi</h1>
        <p className="text-gray-600 dark:text-gray-400">Vui lòng đăng nhập để xem jobs do bạn tạo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Jobs Của Tôi</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Danh sách job dịch do bạn tạo (từ Dịch trực tiếp, Dịch file).
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo mã job..."
        filters={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        }
      />

      <DataTable
        data={jobs}
        columns={columns}
        isLoading={loading}
        emptyMessage="Bạn chưa có job nào. Job được tạo khi bạn dùng Dịch trực tiếp hoặc Dịch file."
      />

      {pagination.pages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
          pageSize={pagination.per_page}
          totalItems={pagination.total}
        />
      )}

      {viewingJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Chi tiết job: {viewingJob.job_code}
              </h3>
              <button onClick={() => setViewingJob(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500 dark:text-gray-400">Mã job:</span> <span className="font-medium">{viewingJob.job_code}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Loại:</span> <span className="font-medium">{viewingJob.job_type}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Trạng thái:</span> <span className="font-medium">{viewingJob.status}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Tiến độ:</span> <span className="font-medium">{viewingJob.progress ?? 0}%</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Ngôn ngữ:</span> <span className="font-medium">{viewingJob.source_lang ?? '-'} → {viewingJob.target_lang ?? '-'}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Ngày tạo:</span> <span className="font-medium">{viewingJob.created_at ? new Date(viewingJob.created_at).toLocaleString() : '-'}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
