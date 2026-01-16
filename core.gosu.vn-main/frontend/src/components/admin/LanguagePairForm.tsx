import { useState, useEffect } from 'react';
import {
  useCreateLanguagePair,
  useUpdateLanguagePair,
  useLanguageList,
  useAvailableTargetLanguages
} from '@/hooks/useLanguage';
import { useToastContext } from '@/context/ToastContext';

// Types
interface Language {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
}

interface LanguagePair {
  id: number;
  source_language: Language;
  target_language: Language;
  is_bidirectional: boolean;
  is_active: boolean;
}

interface LanguagePairFormProps {
  pair?: LanguagePair;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function LanguagePairForm({
  pair,
  onSuccess,
  onCancel
}: LanguagePairFormProps) {
  // Form state
  const [sourceLanguageId, setSourceLanguageId] = useState(
    pair?.source_language?.id?.toString() || ''
  );
  const [targetLanguageId, setTargetLanguageId] = useState(
    pair?.target_language?.id?.toString() || ''
  );
  const [isBidirectional, setIsBidirectional] = useState(
    pair?.is_bidirectional ?? false
  );
  const [isActive, setIsActive] = useState(pair?.is_active ?? true);

  // API hooks
  const { data: languages, isLoading: languagesLoading, error: languagesError } = useLanguageList();
  const { data: availableTargets, isLoading: targetsLoading, error: targetsError } = useAvailableTargetLanguages(
    sourceLanguageId ? parseInt(sourceLanguageId) : 0,
    undefined
  );

  // Mutation hooks
  const createLanguagePair = useCreateLanguagePair();
  const updateLanguagePair = useUpdateLanguagePair();
  const toast = useToastContext();

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (pair?.id) {
        const updateData = {
          is_bidirectional: isBidirectional,
          is_active: isActive,
        };
        const result = await updateLanguagePair.mutateAsync({ id: pair.id, data: updateData });
        console.log('Update result:', result);
        toast.success('Cập nhật cặp ngôn ngữ thành công!');
        onSuccess();
      } else {
        if (!sourceLanguageId || !targetLanguageId) {
          toast.error('Vui lòng chọn cả ngôn ngữ nguồn và ngôn ngữ đích');
          return;
        }

        if (sourceLanguageId === targetLanguageId) {
          toast.error('Ngôn ngữ nguồn và ngôn ngữ đích không thể giống nhau');
          return;
        }

        const formData = {
          source_language_id: parseInt(sourceLanguageId),
          target_language_id: parseInt(targetLanguageId),
          is_bidirectional: isBidirectional,
          is_active: isActive,
        };
        console.log('Creating language pair with data:', formData);
        try {
          const result = await createLanguagePair.mutateAsync(formData);
          console.log('Create result:', result);
          console.log('Mutation successful, closing form');
          toast.success('Tạo cặp ngôn ngữ mới thành công!');
          onSuccess();
        } catch (mutationError: any) {
          console.error('Mutation error caught:', mutationError);
          // Re-throw to be caught by outer catch block
          throw mutationError;
        }
      }
    } catch (error: any) {
      console.error('Error saving language pair:', error);
      console.error('Error details:', {
        message: error?.message,
        response: error?.response,
        code: error?.code,
        request: error?.request,
        stack: error?.stack,
      });
      
      // Check if it's a real network error (no response AND network error code/message)
      const isNetworkError = !error.response && (
        error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' ||
        error.message === 'Network Error' ||
        (error.message && error.message.includes('kết nối đến server'))
      );
      
      if (isNetworkError) {
        const networkError = error.message || 'Không thể kết nối đến server. Vui lòng kiểm tra backend server có đang chạy không.';
        toast.error(networkError);
        return;
      }
      
      // Handle API response errors
      const responseData = error?.response?.data;
      let errorMessage = 'Không thể tạo/cập nhật cặp ngôn ngữ. Vui lòng thử lại.';
      
      if (responseData) {
        if (responseData.error?.message) {
          errorMessage = responseData.error.message;
        } else if (responseData.detail) {
          errorMessage = typeof responseData.detail === 'string' 
            ? responseData.detail 
            : JSON.stringify(responseData.detail);
        } else if (responseData.message) {
          errorMessage = responseData.message;
        }
      } else if (error?.message && !isNetworkError) {
        // If there's a message but it's not a network error, use it
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  };

  // Reset target language when source changes
  useEffect(() => {
    if (!pair && sourceLanguageId && targetLanguageId) {
      const targets = Array.isArray(availableTargets?.data) ? availableTargets.data : [];
      const isAvailable = targets.some(
        (lang: Language) => lang.id === parseInt(targetLanguageId)
      );
      if (!isAvailable) {
        setTargetLanguageId('');
      }
    }
  }, [sourceLanguageId, availableTargets, targetLanguageId, pair]);

  // Loading state
  if (languagesLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Đang tải danh sách ngôn ngữ...</span>
      </div>
    );
  }

  // Error state
  if (languagesError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center">
          <div>
            <h3 className="text-red-800 dark:text-red-200 font-medium">
              Lỗi tải dữ liệu
            </h3>
            <p className="text-red-600 dark:text-red-300 text-sm">
              Không thể tải danh sách ngôn ngữ. Vui lòng thử lại sau.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Prepare languages list
  let languagesList: Language[] = [];
  if (languages?.data) {
    const rawLanguages = Array.isArray(languages.data.items)
      ? languages.data.items
      : Array.isArray(languages.data)
      ? languages.data
      : [];
  
    languagesList = rawLanguages.filter(
      (lang: Language) => lang.is_active === true
    );
  }
  

  // Prepare target options
  let targetOptions: Language[] = [];
  if (sourceLanguageId && !targetsError && availableTargets?.data) {
    if (Array.isArray(availableTargets.data)) {
      targetOptions = availableTargets.data;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {pair?.id 
          ? 'Chỉnh sửa cấu hình cặp ngôn ngữ (chỉ có thể thay đổi trạng thái hoạt động và dịch hai chiều)'
          : 'Cấu hình cặp ngôn ngữ để cho phép dịch thuật'}
      </p>

      {/* Source Language */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Ngôn ngữ nguồn <span className="text-red-500">*</span>
        </label>
        {pair?.id ? (
          <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {pair.source_language.name}
              </span>
              <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                {pair.source_language.code.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Không thể thay đổi ngôn ngữ nguồn khi chỉnh sửa
            </p>
          </div>
        ) : (
          <>
            <select
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
              value={sourceLanguageId}
              onChange={(e) => setSourceLanguageId(e.target.value)}
              required
            >
              <option value="">Chọn ngôn ngữ nguồn</option>
              {languagesList.map((lang: Language) => (
                <option key={lang.id} value={lang.id.toString()}>
                  {lang.name} ({lang.code.toUpperCase()})
                </option>
              ))}
            </select>
            {languagesList.length === 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Chưa có ngôn ngữ nào. Vui lòng tạo ngôn ngữ trước.
              </p>
            )}
          </>
        )}
      </div>

      {/* Target Language */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Ngôn ngữ đích <span className="text-red-500">*</span>
        </label>
        {pair?.id ? (
          <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {pair.target_language.name}
              </span>
              <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                {pair.target_language.code.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Không thể thay đổi ngôn ngữ đích khi chỉnh sửa
            </p>
          </div>
        ) : (
          <>
            <select
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              value={targetLanguageId}
              onChange={(e) => setTargetLanguageId(e.target.value)}
              required
              disabled={!sourceLanguageId || targetsLoading}
            >
              <option value="">
                {targetsLoading ? 'Đang tải...' : 'Chọn ngôn ngữ đích'}
              </option>
              {targetOptions.map((lang: Language) => (
                <option key={lang.id} value={lang.id.toString()}>
                  {lang.name} ({lang.code.toUpperCase()})
                </option>
              ))}
            </select>
            {!sourceLanguageId && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Vui lòng chọn ngôn ngữ nguồn trước
              </p>
            )}
          </>
        )}
      </div>

      {/* Bidirectional Option */}
      <div className="space-y-3">
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
            checked={isBidirectional}
            onChange={(e) => setIsBidirectional(e.target.checked)}
          />
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Dịch hai chiều
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Cho phép dịch cả hai hướng giữa hai ngôn ngữ này
            </p>
          </div>
        </label>
      </div>

      {/* Active Status */}
      <div className="space-y-3">
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Hoạt động
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Cặp ngôn ngữ này có thể được sử dụng để dịch
            </p>
          </div>
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
          disabled={createLanguagePair.isLoading || updateLanguagePair.isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createLanguagePair.isLoading || updateLanguagePair.isLoading ? (
            <span className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Đang lưu...
            </span>
          ) : (
            pair?.id ? 'Cập nhật' : 'Tạo mới'
          )}
        </button>
      </div>
    </form>
  );
}
