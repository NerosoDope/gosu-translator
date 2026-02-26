'use client';

import { useState, useEffect } from 'react';
import { useUpdateJob } from '@/hooks/useJob';
import { useToastContext } from '@/context/ToastContext';

export interface JobFormJob {
  id: number;
  job_code: string;
  job_type: string;
  status: string;
  priority: number;
  progress?: number;
  user_id?: number;
  team_id?: number;
  game_id?: number;
  source_lang?: string;
  target_lang?: string;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
}

interface JobFormProps {
  job?: JobFormJob | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const JOB_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function JobForm({ job, onSuccess, onCancel }: JobFormProps) {
  const [status, setStatus] = useState(job?.status ?? 'pending');
  const [priority, setPriority] = useState(job?.priority ?? 5);
  const [progress, setProgress] = useState(job?.progress ?? 0);
  const [progressError, setProgressError] = useState('');

  const updateJob = useUpdateJob();
  const toast = useToastContext();

  useEffect(() => {
    if (job) {
      setStatus(job.status);
      setPriority(job.priority);
      setProgress(job.progress ?? 0);
    }
  }, [job]);

  const validateProgress = (v: number): boolean => {
    if (v < 0 || v > 100) {
      setProgressError('Tiến độ phải từ 0 đến 100');
      return false;
    }
    setProgressError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job?.id) {
      toast.error('Chỉ có thể chỉnh sửa job đã tồn tại.');
      return;
    }
    if (!validateProgress(progress)) return;

    try {
      await updateJob.mutateAsync({
        id: job.id,
        data: { status, priority, progress },
      });
      toast.success('Cập nhật job thành công!');
      onSuccess();
    } catch (error: any) {
      console.error('Error updating job:', error);
      if (!error.response) {
        toast.error(error.message || 'Không thể kết nối đến server.');
        return;
      }
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Không thể cập nhật job.');
    }
  };

  if (!job) {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Job được tạo tự động khi sử dụng chức năng dịch file, không thể tạo thủ công.
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Mã job: <span className="font-medium text-gray-900 dark:text-gray-100">{job.job_code}</span>
        {' · '}
        Loại: <span className="font-medium text-gray-900 dark:text-gray-100">{job.job_type}</span>
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Trạng thái
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {JOB_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Độ ưu tiên
        </label>
        <input
          type="number"
          id="priority"
          min={0}
          max={10}
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label htmlFor="progress" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tiến độ (%)
        </label>
        <input
          type="number"
          id="progress"
          min={0}
          max={100}
          value={progress}
          onChange={(e) => {
            const v = Number(e.target.value);
            setProgress(v);
            validateProgress(v);
          }}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
            progressError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {progressError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{progressError}</p>}
      </div>

      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          disabled={updateJob.isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateJob.isLoading ? 'Đang lưu...' : 'Cập nhật'}
        </button>
      </div>
    </form>
  );
}
