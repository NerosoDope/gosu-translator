/**
 * Component: JobPage
 * Purpose:
 *   - Main component for job management
 *   - Display jobs list with DataTable
 *   - Handle CRUD operations for jobs
 *
 * Responsibilities:
 * - Load and display jobs list
 * - Handle pagination and filtering
 * - Open/close job form modal
 * - Handle create/update/delete operations
 *
 * Important:
 * - Uses react-query for data fetching
 * - Toast notifications for success/error
 */

'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

// Components
import DataTable, { Column } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import FilterBar from '@/components/data/FilterBar';
import Button from '@/components/ui/Button';
import JobForm from '@/components/job/JobForm';

// API
import { jobAPI } from '@/lib/api';
import { useToastContext } from '@/context/ToastContext';

// Types
interface Job {
  id: number;
  job_code: string;
  job_type: string;
  status: string;
  priority: number;
  user_id: number;
  team_id?: number;
  game_id?: number;
  game_genre?: string;
  source_lang?: string;
  target_lang?: string;
  progress?: number;
  retry_count?: number;
  max_retry?: number;
  payload?: Record<string, any>;
  result?: Record<string, any>;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
}

interface JobListResponse {
  data: Job[];
  total?: number;
  page?: number;
  per_page?: number;
  pages?: number;
}

function JobPageContent() {
  const toast = useToastContext();
  
  // State management
  const [editingJob, setEditingJob] = useState<Job | undefined>(undefined);
  const [showJobForm, setShowJobForm] = useState(false);

  // Confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);

  // Jobs state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    pages: 0,
  });

  // Filter and sort states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Load jobs
  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        skip: (pagination.page - 1) * pagination.per_page,
        limit: pagination.per_page,
      };

      if (search) params.query = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.job_type = typeFilter;
      if (sortBy) {
        params.sort_by = sortBy;
        params.sort_order = sortOrder;
      }

      const response = await jobAPI.getList(params);
      const data = response.data;
      
      // Handle different response formats
      if (Array.isArray(data)) {
        setJobs(data);
        setPagination({
          ...pagination,
          total: data.length,
          pages: Math.ceil(data.length / pagination.per_page),
        });
      } else if (data.items) {
        setJobs(data.items || []);
        setPagination({
          ...pagination,
          total: data.total || 0,
          pages: data.pages || 0,
        });
      } else {
        setJobs([]);
      }
    } catch (error: any) {
      console.error('Error loading jobs:', error);
      setError(error.response?.data?.detail || 'Không thể tải danh sách jobs');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  // Load jobs data
  useEffect(() => {
    loadJobs();
  }, [pagination.page, pagination.per_page, search, statusFilter, typeFilter, sortBy, sortOrder]);

  // Event handlers
  const handleJobCreate = () => {
    setEditingJob(undefined);
    setShowJobForm(true);
  };

  const handleJobEdit = (job: Job) => {
    setEditingJob(job);
    setShowJobForm(true);
  };

  const handleJobFormSuccess = () => {
    setShowJobForm(false);
    setEditingJob(undefined);
    loadJobs();
  };

  const handleJobFormCancel = () => {
    setShowJobForm(false);
    setEditingJob(undefined);
  };

  const handleDeleteJob = (job: Job) => {
    setDeleteTarget(job);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await jobAPI.delete(deleteTarget.id);
      toast.success('Xóa job thành công!');
      loadJobs();
    } catch (error: any) {
      console.error('Error deleting job:', error);
      toast.error(error.response?.data?.detail || 'Không thể xóa job');
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
      setSortBy('id');
      setSortOrder('asc');
    } else if (sortBy === columnKey) {
      if (direction === 'asc') {
        setSortOrder('desc');
      } else if (direction === 'desc') {
        setSortBy('id');
        setSortOrder('asc');
      } else {
        setSortOrder('asc');
      }
    } else {
      setSortBy(columnKey);
      setSortOrder(direction === 'desc' ? 'desc' : 'asc');
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // DataTable columns
  const jobColumns: Column<Job>[] = [
    {
      key: 'id',
      header: 'STT',
      sortable: false,
      render: (job: Job, index?: number) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {index !== undefined ? (pagination.page - 1) * pagination.per_page + index + 1 : '-'}
        </span>
      ),
    },
    {
      key: 'job_code',
      header: 'Mã Job',
      sortable: true,
      render: (job: Job) => (
        <span className="text-gray-900 dark:text-gray-100 font-medium">
          {job.job_code}
        </span>
      ),
    },
    {
      key: 'job_type',
      header: 'Loại',
      sortable: true,
      render: (job: Job) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
          {job.job_type}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      sortable: true,
      render: (job: Job) => {
        const statusColors: Record<string, string> = {
          pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
          in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
          completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          failed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
          cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        };
        return (
          <span
            className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
              statusColors[job.status] || statusColors.pending
            }`}
          >
            {job.status}
          </span>
        );
      },
    },
    {
      key: 'progress',
      header: 'Tiến độ',
      sortable: true,
      render: (job: Job) => (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${job.progress || 0}%` }}
            />
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {job.progress || 0}%
          </span>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Độ ưu tiên',
      sortable: true,
      render: (job: Job) => (
        <span className="text-gray-600 dark:text-gray-400">
          {job.priority}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      sortable: false,
      className: 'text-right',
      render: (job: Job) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => handleJobEdit(job)}
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
            onClick={() => handleDeleteJob(job)}
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Quản Lý Jobs
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Xem và quản lý danh sách jobs trong hệ thống
          </p>
        </div>
        <Button onClick={handleJobCreate}>
          Thêm Job
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
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Tất cả loại</option>
              <option value="translation">Translation</option>
              <option value="review">Review</option>
              <option value="proofread">Proofread</option>
              <option value="glossary_update">Glossary Update</option>
              <option value="other">Other</option>
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
        data={jobs}
        columns={jobColumns}
        isLoading={loading}
        emptyMessage="Không tìm thấy jobs. Nhấn 'Thêm Job' để tạo job đầu tiên."
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

      {/* Job Form Modal */}
      {showJobForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {editingJob ? 'Chỉnh sửa job' : 'Thêm job mới'}
              </h3>
              <button
                onClick={handleJobFormCancel}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Đóng"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <JobForm
                job={editingJob}
                onSuccess={handleJobFormSuccess}
                onCancel={handleJobFormCancel}
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
                  Bạn có chắc chắn muốn xóa job{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    "{deleteTarget.job_code}"
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

export default function JobPage() {
  // Create a stable QueryClient instance for this page
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <JobPageContent />
    </QueryClientProvider>
  );
}
