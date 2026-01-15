'use client';

import { useState, useEffect } from 'react';
import { useCreateJob, useUpdateJob } from '@/hooks/useJob';
import { useLanguageList } from '@/hooks/useLanguage';
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
}

interface JobFormProps {
  job?: Job;
  onSuccess: () => void;
  onCancel: () => void;
}

const JOB_TYPES = [
  'translation',
  'review',
  'proofread',
  'glossary_update',
  'other'
];

const JOB_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled'
];

export default function JobForm({ job, onSuccess, onCancel }: JobFormProps) {
  // Form state
  const [jobCode, setJobCode] = useState(job?.job_code || '');
  const [jobType, setJobType] = useState(job?.job_type || 'translation');
  const [status, setStatus] = useState(job?.status || 'pending');
  const [priority, setPriority] = useState(job?.priority?.toString() || '5');
  const [userId, setUserId] = useState(job?.user_id?.toString() || '');
  const [teamId, setTeamId] = useState(job?.team_id?.toString() || '');
  const [gameId, setGameId] = useState(job?.game_id?.toString() || '');
  const [gameGenre, setGameGenre] = useState(job?.game_genre || '');
  const [sourceLang, setSourceLang] = useState(job?.source_lang || '');
  const [targetLang, setTargetLang] = useState(job?.target_lang || '');
  const [progress, setProgress] = useState(job?.progress?.toString() || '0');
  const [retryCount, setRetryCount] = useState(job?.retry_count?.toString() || '0');
  const [maxRetry, setMaxRetry] = useState(job?.max_retry?.toString() || '3');
  const [errorMessage, setErrorMessage] = useState(job?.error_message || '');

  // Form validation
  const [jobCodeError, setJobCodeError] = useState('');
  const [userIdError, setUserIdError] = useState('');

  // Hooks
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const toast = useToastContext();
  const { data: languagesResponse, isLoading: languagesLoading } = useLanguageList({ is_active: true });
  
  // Extract languages from response
  const languages = languagesResponse?.data?.items || languagesResponse?.data || [];

  // Validation
  const validateJobCode = (value: string): boolean => {
    if (!value.trim()) {
      setJobCodeError('Mã job là bắt buộc');
      return false;
    }
    setJobCodeError('');
    return true;
  };

  const validateUserId = (value: string): boolean => {
    if (!value.trim()) {
      setUserIdError('User ID là bắt buộc');
      return false;
    }
    const num = parseInt(value);
    if (isNaN(num) || num <= 0) {
      setUserIdError('User ID phải là số nguyên dương');
      return false;
    }
    setUserIdError('');
    return true;
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isJobCodeValid = validateJobCode(jobCode);
    const isUserIdValid = validateUserId(userId);

    if (!isJobCodeValid || !isUserIdValid) {
      return;
    }

    try {
      const formData: any = {
        job_code: jobCode.trim(),
        job_type: jobType,
        status: status,
        priority: parseInt(priority) || 5,
        user_id: parseInt(userId),
      };

      // Optional fields
      if (teamId.trim()) formData.team_id = parseInt(teamId);
      if (gameId.trim()) formData.game_id = parseInt(gameId);
      if (gameGenre.trim()) formData.game_genre = gameGenre.trim();
      if (sourceLang.trim()) formData.source_lang = sourceLang.trim();
      if (targetLang.trim()) formData.target_lang = targetLang.trim();
      if (progress.trim()) formData.progress = parseInt(progress) || 0;
      if (retryCount.trim()) formData.retry_count = parseInt(retryCount) || 0;
      if (maxRetry.trim()) formData.max_retry = parseInt(maxRetry) || 3;
      if (errorMessage.trim()) formData.error_message = errorMessage.trim();

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
      {/* Job Code */}
      <div>
        <label htmlFor="job_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Mã Job <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="job_code"
          value={jobCode}
          onChange={(e) => {
            setJobCode(e.target.value);
            if (jobCodeError) validateJobCode(e.target.value);
          }}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
            jobCodeError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
          }`}
          placeholder="Nhập mã job"
        />
        {jobCodeError && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{jobCodeError}</p>
        )}
      </div>

      {/* Job Type */}
      <div>
        <label htmlFor="job_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Loại Job <span className="text-red-500">*</span>
        </label>
        <select
          id="job_type"
          value={jobType}
          onChange={(e) => setJobType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {JOB_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Trạng thái <span className="text-red-500">*</span>
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Two columns for Priority and User ID */}
      <div className="grid grid-cols-2 gap-4">
        {/* Priority */}
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Độ ưu tiên
          </label>
          <input
            type="number"
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            min="1"
            max="10"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* User ID */}
        <div>
          <label htmlFor="user_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            User ID <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="user_id"
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              if (userIdError) validateUserId(e.target.value);
            }}
            className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
              userIdError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="Nhập User ID"
          />
          {userIdError && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{userIdError}</p>
          )}
        </div>
      </div>

      {/* Two columns for Team ID and Game ID */}
      <div className="grid grid-cols-2 gap-4">
        {/* Team ID */}
        <div>
          <label htmlFor="team_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Team ID
          </label>
          <input
            type="number"
            id="team_id"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Nhập Team ID (tùy chọn)"
          />
        </div>

        {/* Game ID */}
        <div>
          <label htmlFor="game_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Game ID
          </label>
          <input
            type="number"
            id="game_id"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Nhập Game ID (tùy chọn)"
          />
        </div>
      </div>

      {/* Game Genre */}
      <div>
        <label htmlFor="game_genre" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Thể loại Game
        </label>
        <input
          type="text"
          id="game_genre"
          value={gameGenre}
          onChange={(e) => setGameGenre(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Nhập thể loại game (tùy chọn)"
        />
      </div>

      {/* Two columns for Source Lang and Target Lang */}
      <div className="grid grid-cols-2 gap-4">
        {/* Source Language */}
        <div>
          <label htmlFor="source_lang" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Ngôn ngữ nguồn
          </label>
          <select
            id="source_lang"
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            disabled={languagesLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Chọn ngôn ngữ nguồn (tùy chọn)</option>
            {languages.map((lang: any) => (
              <option key={lang.id} value={lang.code}>
                {lang.name} ({lang.code.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Target Language */}
        <div>
          <label htmlFor="target_lang" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Ngôn ngữ đích
          </label>
          <select
            id="target_lang"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            disabled={languagesLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Chọn ngôn ngữ đích (tùy chọn)</option>
            {languages.map((lang: any) => (
              <option key={lang.id} value={lang.code}>
                {lang.name} ({lang.code.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Three columns for Progress, Retry Count, Max Retry */}
      <div className="grid grid-cols-3 gap-4">
        {/* Progress */}
        <div>
          <label htmlFor="progress" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tiến độ (%)
          </label>
          <input
            type="number"
            id="progress"
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
            min="0"
            max="100"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Retry Count */}
        <div>
          <label htmlFor="retry_count" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Số lần thử lại
          </label>
          <input
            type="number"
            id="retry_count"
            value={retryCount}
            onChange={(e) => setRetryCount(e.target.value)}
            min="0"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Max Retry */}
        <div>
          <label htmlFor="max_retry" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Số lần thử tối đa
          </label>
          <input
            type="number"
            id="max_retry"
            value={maxRetry}
            onChange={(e) => setMaxRetry(e.target.value)}
            min="1"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Error Message */}
      <div>
        <label htmlFor="error_message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Thông báo lỗi
        </label>
        <textarea
          id="error_message"
          value={errorMessage}
          onChange={(e) => setErrorMessage(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Nhập thông báo lỗi (nếu có)"
        />
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
