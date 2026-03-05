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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

// Components
import DataTable, { Column } from '@/components/data/DataTable';
import Pagination from '@/components/data/Pagination';
import FilterBar from '@/components/data/FilterBar';
import Button from '@/components/ui/Button';
import JobForm from '@/components/job/JobForm';
import ProofreadJobModal from '@/components/job/ProofreadJobModal';

// API
import { jobAPI, translateAPI } from '@/lib/api';
import { useToastContext } from '@/context/ToastContext';

// Types
interface Job {
  id: number;
  job_code: string;
  job_type: string;
  status: string;
  priority: number;
  user_id: number;
  creator_name?: string | null;
  team_id?: number | null;
  game_id?: number | null;
  game_genre?: string | null;
  source_lang?: string | null;
  target_lang?: string | null;
  progress?: number;
  retry_count?: number;
  max_retry?: number;
  payload?: Record<string, any> | null;
  result?: Record<string, any> | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  deleted_at?: string | null;
  is_deleted?: boolean;
}

interface JobListResponse {
  data: Job[];
  total?: number;
  page?: number;
  per_page?: number;
  pages?: number;
}

function getApiError(error: any, fallback: string): string {
  const detail = error?.response?.data?.detail;
  if (detail) return typeof detail === 'string' ? detail : JSON.stringify(detail);
  const msg = error?.response?.data?.message || error?.message;
  if (msg && typeof msg === 'string') return msg;
  return fallback;
}

/** Kiểm tra action có được phép theo state machine không */
function canDo(action: string, status: string, isDeleted: boolean): boolean {
  if (isDeleted) return action === 'restore' || action === 'hard_delete';
  const allowed: Record<string, string[]> = {
    pending:     ['cancel', 'edit', 'delete'],
    in_progress: ['cancel', 'edit', 'delete'],
    completed:   ['delete'],
    failed:      ['retry', 'delete'],
    cancelled:   ['retry', 'delete'],
  };
  return (allowed[status] ?? []).includes(action);
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  in_progress: 'Đang xử lý',
  completed: 'Hoàn thành',
  failed: 'Thất bại',
  cancelled: 'Đã hủy',
};

/** Job có phải dịch file không (để hiện nút Hiệu đính / Tải xuống). */
function isFileTranslationJob(job: Job): boolean {
  return job.payload?.source_type === 'file' || job.payload?.filename != null;
}

/** Job hoàn thành có dữ liệu file để tải xuống không. */
function hasDownloadableResult(job: Job): boolean {
  if (job.status !== 'completed' || !job.result) return false;
  const r = job.result as Record<string, unknown>;
  return !!(r.translated_docx_b64 || r.translated_json || (Array.isArray(r.rows) && r.rows.length > 0));
}

/** Nguồn tạo job: từ payload.source_type hoặc suy từ job_code/payload (job cũ). */
function getJobSourceLabel(job: Job): string {
  const st = job.payload?.source_type;
  if (st === 'file') return 'Dịch file';
  if (st === 'direct') return 'Dịch trực tiếp';
  if (st === 'proofread') return 'Hiệu đính';
  const code = (job.job_code || '').toUpperCase();
  if (code.startsWith('DIRECT-')) return 'Dịch trực tiếp';
  if (code.startsWith('TRANSLATION-FILE-')) return 'Dịch file';
  if (code.startsWith('PROOFREAD-')) return 'Hiệu đính';
  if (job.payload?.filename != null) return 'Dịch file';
  if (job.payload?.text != null) return 'Dịch trực tiếp';
  return '—';
}

function JobPageContent() {
  const toast = useToastContext();

  // State management
  const [editingJob, setEditingJob] = useState<Job | undefined>(undefined);
  const [downloadingJobId, setDownloadingJobId] = useState<number | null>(null);
  const [proofreadJob, setProofreadJob] = useState<Job | null>(null);
  const [showJobForm, setShowJobForm] = useState(false);

  // Confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);

  // Retry processing state
  const [retryingJobId, setRetryingJobId] = useState<number | null>(null);

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
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Show deleted toggle
  const [includeDeleted, setIncludeDeleted] = useState(false);

  // View detail modal
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const [exporting, setExporting] = useState(false);

  // Ref giữ params hiện tại để dùng trong polling (tránh stale closure)
  const pollParamsRef = useRef<any>({});

  const loadJobs = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      const params: any = {
        skip: (pagination.page - 1) * pagination.per_page,
        limit: pagination.per_page,
      };
      if (search) params.query = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.job_type = typeFilter;
      if (includeDeleted) params.include_deleted = true;
      if (sortBy) {
        params.sort_by = sortBy;
        params.sort_order = sortOrder;
      }
      pollParamsRef.current = params;

      const response = await jobAPI.getList(params);
      const data = response.data;

      if (data && typeof data === 'object' && Array.isArray(data.items)) {
        setJobs(data.items);
        setPagination((prev) => ({
          ...prev,
          total: data.total ?? 0,
          pages: data.pages ?? Math.ceil((data.total ?? 0) / prev.per_page),
        }));
      } else if (Array.isArray(data)) {
        setJobs(data);
        setPagination((prev) => ({
          ...prev,
          total: data.length,
          pages: Math.ceil(data.length / prev.per_page),
        }));
      } else {
        setJobs([]);
      }
    } catch (error: any) {
      console.error('Error loading jobs:', error);
      if (!silent) setError(error.response?.data?.detail || 'Không thể tải danh sách jobs');
      if (!silent) setJobs([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [pagination.page, pagination.per_page, search, statusFilter, typeFilter, sortBy, sortOrder, includeDeleted]);

  // Load khi filter/pagination thay đổi
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Smart polling — poll mỗi 3s khi có job pending/in_progress, dừng khi tất cả ổn định
  useEffect(() => {
    const hasActiveJobs = jobs.some(
      (j) => j.status === 'pending' || j.status === 'in_progress'
    );
    if (!hasActiveJobs) return;
    const timer = setInterval(() => loadJobs(true), 3000);
    return () => clearInterval(timer);
  }, [jobs, loadJobs]);

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const params: any = {};
      if (search) params.query = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.job_type = typeFilter;
      const res = await jobAPI.exportExcel(params);
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jobs_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Xuất Excel thành công!');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Không thể xuất file');
    } finally {
      setExporting(false);
    }
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
      toast.error(getApiError(error, 'Không thể xóa job'));
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  const handleCancelJob = async (job: Job) => {
    try {
      await jobAPI.cancel(job.id);
      toast.success(`Đã hủy job "${job.job_code}"`);
      loadJobs();
    } catch (error: any) {
      toast.error(getApiError(error, 'Không thể hủy job'));
    }
  };

  const handleRetryJob = async (job: Job) => {
    setRetryingJobId(job.id);
    try {
      await jobAPI.retry(job.id);
      toast.success(`Job "${job.job_code}" đã được đưa vào hàng chờ để thử lại.`);
      loadJobs();
    } catch (error: any) {
      toast.error(getApiError(error, 'Không thể thử lại job'));
    } finally {
      setRetryingJobId(null);
    }
  };

  const handleRestoreJob = async (job: Job) => {
    try {
      await jobAPI.restore(job.id);
      toast.success(`Đã khôi phục job "${job.job_code}"`);
      loadJobs();
    } catch (error: any) {
      toast.error(getApiError(error, 'Không thể khôi phục job'));
    }
  };

  const handleProofread = async (job: Job) => {
    try {
      const res = await jobAPI.get(job.id);
      const data = res.data as Job;
      const result = data?.result as Record<string, unknown> | undefined;
      const hasRows = Array.isArray(result?.rows) && result.rows.length > 0;
      if (!hasRows) {
        toast.warning('Job này chưa lưu dữ liệu để hiệu đính. Chỉ job dịch file đã hoàn thành (có lưu kết quả) mới mở được bảng hiệu đính.');
        return;
      }
      setProofreadJob(data);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Không thể tải chi tiết job.');
    }
  };

  const handleDownload = async (job: Job) => {
    setDownloadingJobId(job.id);
    try {
      const res = await jobAPI.get(job.id);
      const data = res.data;
      const result = (data?.result || {}) as Record<string, unknown>;
      const filename = (data?.payload?.filename as string) || job.job_code || 'translated';
      const baseName = filename.replace(/\.[^.]+$/, '') || 'translated';

      if (result.translated_docx_b64 && typeof result.translated_docx_b64 === 'string') {
        const bin = atob(result.translated_docx_b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_translated.docx`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Đã tải file DOCX.');
        return;
      }
      if (result.translated_json != null) {
        const blob = new Blob([JSON.stringify(result.translated_json, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_translated.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Đã tải file JSON.');
        return;
      }
      if (Array.isArray(result.rows) && result.rows.length > 0) {
        const columns = (result.output_columns as string[]) || Object.keys((result.rows[0] as Record<string, unknown>) || {});
        const ext = (filename || '').toLowerCase().match(/\.(xlsx|xls|csv)$/)?.[1] || 'xlsx';
        const format = ext === 'csv' ? 'csv' : 'xlsx';
        if (format === 'xlsx') {
          const rowsAsStrings = (result.rows as Record<string, unknown>[]).map((row) => {
            const out: Record<string, string> = {};
            for (const c of columns) {
              const v = row[c];
              out[c] = v == null ? '' : String(v);
            }
            return out;
          });
          const res = await translateAPI.exportFile({
            columns,
            rows: rowsAsStrings,
            format: 'xlsx',
            filename: baseName,
          });
          const blob = new Blob([res.data as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${baseName}_translated.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success('Đã tải file (định dạng gốc).');
          return;
        }
        const header = columns.join(',');
        const csvRows = (result.rows as Record<string, unknown>[]).map((row) =>
          columns.map((c) => {
            const v = row[c];
            const s = v == null ? '' : String(v);
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
          }).join(',')
        );
        const csv = [header, ...csvRows].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_translated.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Đã tải file CSV.');
        return;
      }
      toast.warning('Job này chưa lưu file đã dịch. Các job dịch file mới sẽ hỗ trợ tải xuống.');
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Không thể tải file.');
    } finally {
      setDownloadingJobId(null);
    }
  };

  const [hardDeleteTarget, setHardDeleteTarget] = useState<Job | null>(null);
  const handleHardDelete = (job: Job) => setHardDeleteTarget(job);
  const handleConfirmHardDelete = async () => {
    if (!hardDeleteTarget) return;
    try {
      await jobAPI.hardDelete(hardDeleteTarget.id);
      toast.success(`Đã xóa vĩnh viễn job "${hardDeleteTarget.job_code}"`);
      loadJobs();
    } catch (error: any) {
      toast.error(getApiError(error, 'Không thể xóa vĩnh viễn job'));
    } finally {
      setHardDeleteTarget(null);
    }
  };

  // Handle column sorting
  const handleSort = (columnKey: string | null, direction: 'asc' | 'desc' | null) => {
    if (columnKey === null) {
      setSortBy('id');
      setSortOrder('desc');
    } else if (sortBy === columnKey) {
      if (direction === 'asc') {
        setSortOrder('desc');
      } else if (direction === 'desc') {
        setSortBy('id');
        setSortOrder('desc');
      } else {
        setSortOrder('desc');
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
      render: (job: Job) => {
        const JOB_TYPE_META: Record<string, { label: string; cls: string }> = {
          translation:     { label: 'translation',     cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
          proofread:       { label: 'proofread',       cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
          glossary_update: { label: 'glossary_update', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
          other:           { label: 'other',           cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
        };
        const meta = JOB_TYPE_META[job.job_type] ?? { label: job.job_type, cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>
            {meta.label}
          </span>
        );
      },
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
            <div className="flex flex-col gap-1 w-fit">
            <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${statusColors[job.status] || statusColors.pending}`}>
              {STATUS_LABELS[job.status] ?? job.status}
            </span>
            {job.is_deleted && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                Đã xóa
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'progress',
      header: 'Tiến độ',
      sortable: true,
      render: (job: Job) => {
        const rawPct = job.progress || 0;
        const isActive = job.status === 'in_progress';
        const displayPct = isActive && rawPct === 0 ? 50 : rawPct;
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${displayPct}%`,
                  background: isActive
                    ? 'linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6)'
                    : '#2563eb',
                  ...(isActive ? { backgroundSize: '200% 100%', animation: 'shimmer 2s infinite linear' } : {}),
                }}
              />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {displayPct}%
            </span>
          </div>
        );
      },
    },
    {
      key: 'creator_name',
      header: 'Người tạo',
      sortable: false,
      render: (job: Job) => (
        <span className="text-gray-600 dark:text-gray-400">
          {job.creator_name ?? '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      sortable: false,
      className: 'text-left',
      render: (job: Job) => {
        const s = job.status;
        const del = !!job.is_deleted;
        return (
          <div className="flex items-center gap-2 justify-start">
            {/* Xem chi tiết — luôn hiển thị */}
            <button onClick={() => setViewingJob(job)} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100" title="Xem chi tiết">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            </button>

            {/* Hiệu đính — icon giống AppSidebar mục Quản Lý Prompts (tờ giấy có 2 dòng) */}
            {!del && isFileTranslationJob(job) && job.status === 'completed' && (
              <button
                onClick={() => handleProofread(job)}
                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                title="Hiệu đính"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            )}

            {/* Tải xuống — job dịch file đã lưu kết quả: tải lại file đã dịch */}
            {!del && isFileTranslationJob(job) && (hasDownloadableResult(job) || job.status === 'completed') && (
              <button
                onClick={() => handleDownload(job)}
                disabled={downloadingJobId === job.id}
                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
                title={downloadingJobId === job.id ? 'Đang tải...' : 'Tải xuống file đã dịch'}
              >
                <svg className={`w-5 h-5 ${downloadingJobId === job.id ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </button>
            )}

            {/* Chỉnh sửa */}
            {canDo('edit', s, del) && (
              <button onClick={() => handleJobEdit(job)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" title="Chỉnh sửa">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
            )}

            {/* Hủy */}
            {canDo('cancel', s, del) && (
              <button onClick={() => handleCancelJob(job)} className="text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300" title="Hủy job">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
              </button>
            )}

            {/* Thử lại */}
            {canDo('retry', s, del) && (
              <button
                onClick={() => handleRetryJob(job)}
                disabled={retryingJobId === job.id}
                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-40 disabled:cursor-not-allowed"
                title={retryingJobId === job.id ? 'Đang xử lý...' : 'Thử lại'}
              >
                <svg className={`w-5 h-5 ${retryingJobId === job.id ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            )}

            {/* Khôi phục */}
            {canDo('restore', s, del) && (
              <button onClick={() => handleRestoreJob(job)} className="text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300" title="Khôi phục">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              </button>
            )}

            {/* Soft delete */}
            {canDo('delete', s, del) && (
              <button onClick={() => handleDeleteJob(job)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Xóa">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            )}

            {/* Xóa vĩnh viễn */}
            {canDo('hard_delete', s, del) && (
              <button onClick={() => handleHardDelete(job)} className="text-red-700 hover:text-red-900 dark:text-red-500 dark:hover:text-red-300" title="Xóa vĩnh viễn">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" /></svg>
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Quản Lý Jobs
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Xem, theo dõi tiến độ và quản lý các job dịch
          </p>
        </div>
        <Button onClick={handleExportExcel} disabled={exporting}>
          {exporting ? 'Đang xuất...' : 'Xuất Excel'}
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
        searchPlaceholder="Tìm theo mã job..."
        filters={
          <div className="flex items-center gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ xử lý</option>
              <option value="in_progress">Đang xử lý</option>
              <option value="completed">Hoàn thành</option>
              <option value="failed">Thất bại</option>
              <option value="cancelled">Đã hủy</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Tất cả loại</option>
              <option value="translation">Translation</option>
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

            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => { setIncludeDeleted(e.target.checked); setPagination(p => ({ ...p, page: 1 })); }}
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              Hiển thị đã xóa
            </label>
          </div>
        }
      />

      {/* Data Table */}
      <DataTable
        data={jobs}
        columns={jobColumns}
        isLoading={loading}
        emptyMessage="Không tìm thấy jobs. Job được tạo tự động khi sử dụng chức năng dịch file."
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
                Chỉnh sửa job
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Job sẽ được chuyển vào thùng rác (có thể khôi phục). Bật "Hiển thị đã xóa" để xem và khôi phục.
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

      {/* Hard Delete Confirmation Modal */}
      {hardDeleteTarget && (
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
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Xóa vĩnh viễn</h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Bạn có chắc chắn muốn xóa <strong>vĩnh viễn</strong> job{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">"{hardDeleteTarget.job_code}"</span>?
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  Hành động này KHÔNG THỂ hoàn tác. Dữ liệu sẽ bị xóa hoàn toàn khỏi hệ thống.
                </p>
              </div>
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => setHardDeleteTarget(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleConfirmHardDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-700 border border-transparent rounded-md hover:bg-red-800 transition-colors"
                >
                  Xóa vĩnh viễn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Job Detail Modal */}
      {viewingJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Header — sticky để luôn thấy nút đóng khi cuộn */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 shrink-0 sticky top-0 z-10 bg-white dark:bg-gray-800 rounded-t-xl">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{viewingJob.job_code}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">ID: #{viewingJob.id}</p>
              </div>
              <button
                onClick={() => setViewingJob(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Đóng"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-5 text-sm overflow-y-auto min-h-0">
              {/* Trạng thái + Tiến độ */}
              <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                <div className="flex flex-col gap-1">
                  {(() => {
                    const statusColors: Record<string, string> = {
                      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
                      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                      failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                      cancelled: 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300',
                    };
                    return (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[viewingJob.status] || statusColors.pending}`}>
                        {STATUS_LABELS[viewingJob.status] ?? viewingJob.status}
                      </span>
                    );
                  })()}
                  {viewingJob.is_deleted && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                      Đã xóa
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  {(() => {
                    const rawPct = viewingJob.progress ?? 0;
                    const isActive = viewingJob.status === 'in_progress';
                    const displayPct = isActive && rawPct === 0 ? 50 : rawPct;
                    return (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-500 dark:text-gray-400">Tiến độ</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{displayPct}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${displayPct}%`,
                              background: isActive
                                ? 'linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6)'
                                : '#2563eb',
                              ...(isActive ? { backgroundSize: '200% 100%', animation: 'shimmer 2s infinite linear' } : {}),
                            }}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Thông tin cơ bản */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Thông tin cơ bản</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Loại job</span><span className="font-medium text-gray-900 dark:text-gray-100">{viewingJob.job_type}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Nguồn</span><span className="font-medium text-gray-900 dark:text-gray-100">{getJobSourceLabel(viewingJob)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Thử lại</span><span className="font-medium text-gray-900 dark:text-gray-100">{viewingJob.retry_count ?? 0} / {viewingJob.max_retry ?? 3}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Người tạo</span><span className="font-medium text-gray-900 dark:text-gray-100">{viewingJob.creator_name ?? '-'}</span></div>
                  {viewingJob.game_id && <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Game ID</span><span className="font-medium text-gray-900 dark:text-gray-100">{viewingJob.game_id}</span></div>}
                  {viewingJob.game_genre && <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Thể loại</span><span className="font-medium text-gray-900 dark:text-gray-100">{viewingJob.game_genre}</span></div>}
                </div>
              </div>

              {/* Ngôn ngữ */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Dịch thuật</h4>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded font-medium text-gray-900 dark:text-gray-100">{viewingJob.source_lang ?? '—'}</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  <span className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded font-medium text-blue-700 dark:text-blue-300">{viewingJob.target_lang ?? '—'}</span>
                </div>
              </div>

              {/* Thời gian */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Thời gian</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Tạo lúc</span><span className="font-medium text-gray-900 dark:text-gray-100">{viewingJob.created_at ? new Date(viewingJob.created_at).toLocaleString('vi-VN') : '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Bắt đầu</span><span className="font-medium text-gray-900 dark:text-gray-100">{viewingJob.started_at ? new Date(viewingJob.started_at).toLocaleString('vi-VN') : '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Hoàn thành</span><span className="font-medium text-gray-900 dark:text-gray-100">{viewingJob.finished_at ? new Date(viewingJob.finished_at).toLocaleString('vi-VN') : '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Cập nhật</span><span className="font-medium text-gray-900 dark:text-gray-100">{viewingJob.updated_at ? new Date(viewingJob.updated_at).toLocaleString('vi-VN') : '-'}</span></div>
                  {viewingJob.deleted_at && (
                    <div className="flex justify-between col-span-2"><span className="text-red-500 dark:text-red-400">Đã xóa lúc</span><span className="font-medium text-red-600 dark:text-red-400">{new Date(viewingJob.deleted_at).toLocaleString('vi-VN')}</span></div>
                  )}
                </div>
              </div>

              {/* Lỗi */}
              {viewingJob.error_message && (
                <div>
                  <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Thông báo lỗi</h4>
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-red-700 dark:text-red-300">
                    {viewingJob.error_message}
                  </div>
                </div>
              )}

              {/* Kết quả */}
              {viewingJob.result && Object.keys(viewingJob.result).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Kết quả</h4>
                  <pre className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs overflow-x-auto text-gray-800 dark:text-gray-200">{JSON.stringify(viewingJob.result, null, 2)}</pre>
                </div>
              )}

              {/* Payload */}
              {viewingJob.payload && Object.keys(viewingJob.payload).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Dữ liệu đầu vào (Payload)</h4>
                  <pre className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs overflow-x-auto text-gray-800 dark:text-gray-200">{JSON.stringify(viewingJob.payload, null, 2)}</pre>
                </div>
              )}

            </div>

            {/* Footer — Hiệu đính / Tải xuống (chỉ job dịch file hoàn thành), căn phải */}
            {isFileTranslationJob(viewingJob) && viewingJob.status === 'completed' && (
              <div className="shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setViewingJob(null); handleProofread(viewingJob); }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Hiệu đính
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(viewingJob)}
                  disabled={downloadingJobId === viewingJob.id}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className={`w-4 h-4 ${downloadingJobId === viewingJob.id ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Tải xuống file đã dịch
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ProofreadJobModal
        open={!!proofreadJob}
        onClose={() => setProofreadJob(null)}
        job={proofreadJob}
      />
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
