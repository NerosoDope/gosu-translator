'use client';

import { useState } from 'react';
import { useCreateJob, useUpdateJob } from '@/hooks/useJob';
import { useToastContext } from '@/context/ToastContext';

// Types
interface Job {
  id: number;
  title: string;
  description?: string | null;
  is_active: boolean;
}

interface JobFormProps {
  job?: Job;
  onSuccess: () => void;
  onCancel: () => void;
}

const JOB_TYPES = [
  // Kept for backward compatibility if needed in future
];

const JOB_STATUSES = [
  // Kept for backward compatibility if needed in future
];

export default function JobForm({ job, onSuccess, onCancel }: JobFormProps) {
  // Form state
  const [title, setTitle] = useState(job?.title || '');
  const [description, setDescription] = useState(job?.description || '');
  const [isActive, setIsActive] = useState(job?.is_active ?? true);

  // Form validation
  const [titleError, setTitleError] = useState('');

  // Hooks
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const toast = useToastContext();

  // Validation
  const validateTitle = (value: string): boolean => {
    if (!value.trim()) {
      setTitleError('Tiêu đề là bắt buộc');
      return false;
    }
    setTitleError('');
    return true;
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isTitleValid = validateTitle(title);
    if (!isTitleValid) {
      return;
    }

    try {
      const formData: any = {
        title: title.trim(),
        description: description?.trim() || undefined,
        is_active: isActive,
      };

      if (job?.id) {
        await updateJob.mutateAsync({ id: job.id, data: formData });
        toast.success('Cập nhật job thành công!');
      } else {
        await createJob.mutateAsync(formData);
        toast.success('Tạo job mới thành công!');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Error saving job:', error);
      
      if (!error.response) {
        const networkError = error.message || 'Không thể kết nối đến server. Vui lòng kiểm tra backend server có đang chạy không.';
        toast.error(networkError);
        return;
      }
      
      const responseData = error?.response?.data;
      let errorMessage = 'Không thể tạo/cập nhật job. Vui lòng thử lại.';
      
      if (responseData) {
        if (responseData.message) {
          errorMessage = responseData.message;
        } else if (responseData.detail) {
          errorMessage = typeof responseData.detail === 'string' 
            ? responseData.detail 
            : JSON.stringify(responseData.detail);
        }
      }
      
      toast.error(errorMessage);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tiêu đề <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (titleError) validateTitle(e.target.value);
          }}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
            titleError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
          }`}
          placeholder="Nhập tiêu đề job"
        />
        {titleError && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{titleError}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Mô tả
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Nhập mô tả job (tùy chọn)"
        />
      </div>

      {/* Active flag */}
      <div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          Active
        </label>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          disabled={createJob.isLoading || updateJob.isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createJob.isLoading || updateJob.isLoading
            ? 'Đang lưu...'
            : job?.id
            ? 'Cập nhật'
            : 'Tạo mới'}
        </button>
      </div>
    </form>
  );
}
