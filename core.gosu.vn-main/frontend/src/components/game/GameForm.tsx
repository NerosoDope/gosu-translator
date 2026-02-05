import React, { useState, useEffect } from 'react';
import { useCreateGame, useUpdateGame } from '@/hooks/useGame';
import { gameCategoryAPI } from '@/lib/api';
import { useToastContext } from '@/context/ToastContext';

// Types
interface GameItem {
  id: number;
  name: string;
  game_category_id: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

interface GameCategory {
  id: number;
  name: string;
}

interface GameFormProps {
  item?: GameItem;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function GameForm({ item, onSuccess, onCancel }: GameFormProps) {
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [gameCategoryId, setGameCategoryId] = useState(item?.game_category_id?.toString() || '');
  const [isActive, setIsActive] = useState(item?.is_active ?? true);

  // Form validation
  const [nameError, setNameError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [gameCategoryError, setGameCategoryError] = useState('');

  // Dropdown data
  const [gameCategories, setGameCategories] = useState<GameCategory[]>([]);

  // Hooks
  const createGame = useCreateGame();
  const updateGame = useUpdateGame();
  const toast = useToastContext();

  // Load game categories
  useEffect(() => {
    const loadGameCategories = async () => {
      try {
        const result = await gameCategoryAPI.getList({ per_page: 100, is_active: true });
        setGameCategories(result.data.items || []);
      } catch (error) {
        console.error('Failed to load game categories in GameForm:', error);
      }
    };
    loadGameCategories();
  }, []);

  // Validation
  const validateName = (value: string) => {
    if (!value.trim()) {
      setNameError('Tên game là bắt buộc');
      return false;
    }
    if (value.length < 2) {
      setNameError('Tên game phải có ít nhất 2 ký tự');
      return false;
    }
    setNameError('');
    return true;
  };

  const validateDescription = (value: string) => {
    if (value.length > 500) {
      setDescriptionError('Mô tả không được vượt quá 500 ký tự');
      return false;
    }
    setDescriptionError('');
    return true;
  };

  const validateGameCategory = (value: string) => {
    if (!value) {
      setGameCategoryError('Thể loại game là bắt buộc');
      return false;
    }
    setGameCategoryError('');
    return true;
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isNameValid = validateName(name);
    const isDescriptionValid = validateDescription(description);
    const isGameCategoryValid = validateGameCategory(gameCategoryId);

    if (!isNameValid || !isDescriptionValid || !isGameCategoryValid) {
      return;
    }

    try {
      const formData = {
        name: name.trim(),
        description: description.trim() || undefined,
        game_category_id: parseInt(gameCategoryId),
        is_active: isActive,
      };

      if (item?.id) {
        await updateGame.mutateAsync({ id: item.id, data: formData });
        toast.success('Cập nhật game thành công!');
      } else {
        await createGame.mutateAsync(formData);
        toast.success('Tạo game mới thành công!');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Error saving game:', error);

      if (!error.response) {
        const networkError = error.message || 'Không thể kết nối đến server. Vui lòng kiểm tra backend server có đang chạy không.';
        toast.error(networkError);
        return;
      }

      const responseData = error?.response?.data;
      let errorMessage = 'Không thể tạo/cập nhật game. Vui lòng thử lại.';

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
      }

      if (!errorMessage || errorMessage === 'Không thể tạo/cập nhật game. Vui lòng thử lại.') {
        errorMessage = error?.message || errorMessage;
      }

      toast.error(errorMessage);

      if (responseData?.error?.details) {
        const details = responseData.error.details;
        if (Array.isArray(details)) {
          details.forEach((err: any) => {
            if (err.loc && err.loc.includes('name')) {
              setNameError(err.msg || 'Tên game không hợp lệ');
            }
            if (err.loc && err.loc.includes('description')) {
              setDescriptionError(err.msg || 'Mô tả không hợp lệ');
            }
            if (err.loc && err.loc.includes('game_category_id')) {
              setGameCategoryError(err.msg || 'Thể loại game không hợp lệ');
            }
          });
        }
      } else if (error?.response?.data?.errors) {
        const errors = error.response.data.errors;
        if (errors.name) {
          setNameError(Array.isArray(errors.name) ? errors.name[0] : errors.name);
        }
        if (errors.game_category_id) {
          setGameCategoryError(Array.isArray(errors.game_category_id) ? errors.game_category_id[0] : errors.game_category_id);
        }
      }
    }
  };

  const isLoading = createGame.isLoading || updateGame.isLoading;

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Column - Form Inputs */}
      <div className="space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tên game <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setName(e.target.value);
              validateName(e.target.value);
            }}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors ${
              nameError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            } dark:bg-gray-700 dark:text-gray-100`}
            placeholder="Nhập tên game"
            maxLength={255}
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
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              setDescription(e.target.value);
              validateDescription(e.target.value);
            }}
            rows={3}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors ${
              descriptionError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            } dark:bg-gray-700 dark:text-gray-100`}
            placeholder="Nhập mô tả cho game (không bắt buộc)"
            maxLength={500}
          />
          {descriptionError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {descriptionError}
            </p>
          )}
        </div>

        {/* Game Category */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Thể loại game <span className="text-red-500">*</span>
          </label>
          <select
            value={gameCategoryId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setGameCategoryId(e.target.value);
              validateGameCategory(e.target.value);
            }}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors ${
              gameCategoryError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            } dark:bg-gray-700 dark:text-gray-100`}
            required
          >
            <option value="">Chọn thể loại game</option>
            {gameCategories.map((category: GameCategory) => (
              <option key={category.id} value={category.id.toString()}>
                {category.name}
              </option>
            ))}
          </select>
          {gameCategoryError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {gameCategoryError}
            </p>
          )}
        </div>

        {/* Active Status */}
        <div className="space-y-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsActive(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Game hoạt động
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Game này có thể được sử dụng trong hệ thống.
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
            disabled={isLoading || !!nameError || !!gameCategoryError || !name.trim() || !gameCategoryId}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Đang lưu...
              </>
            ) : (
              item ? 'Cập nhật game' : 'Tạo game mới'
            )}
          </button>
        </div>
      </div>

      {/* Right Column - Preview */}
      <div className="lg:sticky lg:top-6">
        {(name && gameCategoryId && !nameError && !descriptionError && !gameCategoryError) ? (
          <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-teal-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800 shadow-lg">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg mr-3">
                <span className="text-xl">🎮</span>
              </div>
              <h4 className="text-lg font-semibold text-green-900 dark:text-green-100">
                Xem trước game
              </h4>
            </div>

            <div className="space-y-4 mb-4">
              <div>
                <div className="font-bold text-green-900 dark:text-green-100 text-lg mb-1">
                  {name || 'TÊN GAME'}
                </div>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {description || 'Chưa có mô tả'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-900 dark:text-green-100">
                  Thể loại game:
                </span>
                <span className="text-sm text-green-700 dark:text-green-300">
                  {gameCategories.find((cat: GameCategory) => cat.id.toString() === gameCategoryId)?.name || 'Chưa chọn'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-900 dark:text-green-100">
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
            </div>

            <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-700">
              <p className="text-xs text-green-700 dark:text-green-300 text-center">
                Game này sẽ được thêm vào hệ thống
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 text-center">
            <div className="text-4xl mb-3">🎮</div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Xem trước game
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Nhập đầy đủ thông tin để xem preview
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
