import { useState } from 'react';
import { useCreateGameCategory, useUpdateGameCategory } from '@/hooks/useGameCategory';
import { useToastContext } from '@/context/ToastContext';

// Types
interface GameCategory {
  id: number;
  name: string;
  description: string;
  translation_style: string;
  is_active: boolean;
}

interface GameCategoryFormProps {
  category?: GameCategory;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function GameCategoryForm({ category, onSuccess, onCancel }: GameCategoryFormProps) {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [translationStyle, setTranslationStyle] = useState(category?.translation_style || '');
  const [isActive, setIsActive] = useState(category?.is_active ?? true);

  // Form validation
  const [nameError, setNameError] = useState('');

  // Hooks
  const createGameCategory = useCreateGameCategory();
  const updateGameCategory = useUpdateGameCategory();
  const toast = useToastContext();

  // Validation
  const validateName = (value: string) => {
    if (!value.trim()) {
      setNameError('Tên danh mục là bắt buộc');
      return false;
    }
    if (value.length < 2) {
      setNameError('Tên danh mục phải có ít nhất 2 ký tự');
      return false;
    }
    setNameError('');
    return true;
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isNameValid = validateName(name);

    if (!isNameValid) {
      return;
    }

    try {
      const formData = {
        name: name.trim(),
        description: description.trim(),
        translation_style: translationStyle.trim(),
        is_active: isActive,
      };

      if (category?.id) {
        await updateGameCategory.mutateAsync({ id: category.id, data: formData });
        toast.success('Cập nhật danh mục game thành công!');
      } else {
        await createGameCategory.mutateAsync(formData);
        toast.success('Tạo danh mục game mới thành công!');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Error saving game category:', error);

      // Handle network errors
      if (!error.response) {
        const networkError = error.message || 'Không thể kết nối đến server. Vui lòng kiểm tra backend server có đang chạy không.';
        toast.error(networkError);
        return;
      }

      // Extract error message from API response
      const responseData = error?.response?.data;
      let errorMessage = 'Không thể tạo/cập nhật danh mục game. Vui lòng thử lại.';

      if (responseData) {
        // Try custom exception handler format first
        if (responseData.error?.message) {
          errorMessage = responseData.error.message;
        }
        // Fallback to FastAPI default format
        else if (responseData.detail) {
          errorMessage = typeof responseData.detail === 'string'
            ? responseData.detail
            : JSON.stringify(responseData.detail);
        }
        // Fallback to message field
        else if (responseData.message) {
          errorMessage = responseData.message;
        }
      }

      // Fallback to error.message
      if (!errorMessage || errorMessage === 'Không thể tạo/cập nhật danh mục game. Vui lòng thử lại.') {
        errorMessage = error?.message || errorMessage;
      }

      toast.error(errorMessage);

      // Show validation errors if available
      if (responseData?.error?.details) {
        const details = responseData.error.details;
        // Handle array of validation errors
        if (Array.isArray(details)) {
          details.forEach((err: any) => {
            if (err.loc && err.loc.includes('name')) {
              setNameError(err.msg || 'Tên danh mục không hợp lệ');
            }
          });
        }
      }
      // Handle old format
      else if (error?.response?.data?.errors) {
        const errors = error.response.data.errors;
        if (errors.name) {
          setNameError(Array.isArray(errors.name) ? errors.name[0] : errors.name);
        }
      }
    }
  };

  // Loading state
  const isLoading = createGameCategory.isLoading || updateGameCategory.isLoading;

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Column - Form Inputs */}
      <div className="space-y-6">
        {/* Category Name */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tên danh mục <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => {
              setName(e.target.value);
              validateName(e.target.value);
            }}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors ${
              nameError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            } dark:bg-gray-700 dark:text-gray-100`}
            placeholder="Nhập tên danh mục game (vd: Action, RPG, Strategy)"
            maxLength={100}
            required
          />
          {nameError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {nameError}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Mô tả
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            rows={3}
            placeholder="Mô tả ngắn gọn về danh mục game"
            maxLength={500}
          />
        </div>

        {/* Translation Style */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Phong cách dịch
          </label>
          <select
            value={translationStyle}
            onChange={e => setTranslationStyle(e.target.value)}
            className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="Đầy đủ, chi tiết">Đầy đủ, chi tiết</option>
            <option value="Tự nhiên, mượt mà">Tự nhiên, mượt mà</option>
            <option value="Sát nghĩa, giữ cấu trúc">Sát nghĩa, giữ cấu trúc</option>
            <option value="Văn phong trang trọng">Văn phong trang trọng</option>
            <option value="Văn phong thân mật">Văn phong thân mật</option>
            <option value="Ngắn gọn, súc tích">Ngắn gọn, súc tích</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            (Tùy chọn) Chọn phong cách dịch ưu tiên cho các nội dung thuộc danh mục này.
          </p>
        </div>

        {/* Active Status */}
        <div className="space-y-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Danh mục hoạt động
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Danh mục này có thể được sử dụng để phân loại các game trong hệ thống.
              </p>
            </div>
          </label>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isLoading || !!nameError || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Đang lưu...
              </>
            ) : (
              category ? 'Cập nhật danh mục' : 'Tạo danh mục mới'
            )}
          </button>
        </div>
      </div>

      {/* Right Column - Preview */}
      <div className="lg:sticky lg:top-6">
        {(name) && !nameError ? (
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800 shadow-lg">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg mr-3">
                <span className="text-xl">👁️</span>
              </div>
              <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                Xem trước danh mục game
              </h4>
            </div>

            <div className="flex items-center space-x-4 mb-4">
              <div className="flex-1">
                <div className="font-bold text-blue-900 dark:text-blue-100 text-xl mb-1">
                  {name || 'Tên danh mục'}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300 uppercase tracking-wider font-medium">
                  {translationStyle || 'PHONG CÁCH DỊCH'}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Trạng thái:
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                  isActive
                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                    : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                }`}>
                  {isActive ? 'Hoạt động' : 'Tạm dừng'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Độ dài tên:
                </span>
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  {name.length}/100 ký tự
                </span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
              <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
                Danh mục này sẽ xuất hiện trong danh sách các danh mục game của hệ thống
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 text-center">
            <div className="text-4xl mb-3">🎨</div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Xem trước danh mục game
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Nhập tên danh mục để xem preview
            </p>
          </div>
        )}
      </div>
    </form>
  );
}