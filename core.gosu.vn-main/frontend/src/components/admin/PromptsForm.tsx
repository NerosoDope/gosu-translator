import { useState, useEffect } from 'react';
import { useCreatePrompt, useUpdatePrompt, usePromptsList } from '@/hooks/usePrompts';
import { useToastContext } from '@/context/ToastContext';

// Types
interface Prompt {
  id: number;
  name: string;
  content: string;
  description: string;
  is_active: boolean;
  is_default?: boolean;
}

interface PromptsFormProps {
  prompt?: Prompt;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PromptsForm({ prompt, onSuccess, onCancel }: PromptsFormProps) {
  // Form state
  const [name, setName] = useState(prompt?.name || '');
  const [content, setContent] = useState(prompt?.content || '');
  const [description, setDescription] = useState(prompt?.description || '');
  const [isActive, setIsActive] = useState(prompt?.is_active ?? true);
  const [isDefault, setIsDefault] = useState(prompt?.is_default ?? false);
  const [variables, setVariables] = useState<Record<string, string>>({});

  // Form validation
  const [nameError, setNameError] = useState('');
  const [contentError, setContentError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');

  // Hooks
  const createPrompt = useCreatePrompt();
  const updatePrompt = useUpdatePrompt();
  const { data: existingPrompts } = usePromptsList({ is_active: true });
  const toast = useToastContext();

  // Update form when prompt prop changes
  useEffect(() => {
    if (prompt) {
      setName(prompt.name || '');
      setContent(prompt.content || '');
      setDescription(prompt.description || '');
      setIsActive(prompt.is_active ?? true);
      setIsDefault(prompt.is_default ?? false);
    }
  }, [prompt]);

  // Extract variables from content for preview
  useEffect(() => {
    const regex = /\{\{(\\w+)\}\}/g;
    const matches = Array.from(content.matchAll(regex));
    const newVariables: Record<string, string> = {};
    matches.forEach(match => {
      if (match[1] && !newVariables[match[1]]) {
        newVariables[match[1]] = ''; // Initialize with empty string
      }
    });
    setVariables(newVariables);
  }, [content]);

  // Validation
  const validateName = (value: string) => {
    if (!value.trim()) {
      setNameError('Tên prompt là bắt buộc');
      return false;
    }
    if (value.length < 2) {
      setNameError('Tên prompt phải có ít nhất 2 ký tự');
      return false;
    }
    if (value.length > 100) {
      setNameError('Tên prompt không được vượt quá 100 ký tự');
      return false;
    }

    // Check for duplicates (excluding current prompt)
    const prompts = existingPrompts?.items || [];
    const duplicate = prompts.find(
      (p: Prompt) =>
        p.name.toLowerCase().trim() === value.toLowerCase().trim() &&
        p.id !== prompt?.id
    );
    if (duplicate) {
      setNameError('Tên prompt đã tồn tại');
      return false;
    }

    setNameError('');
    return true;
  };

  const validateContent = (value: string) => {
    if (!value.trim()) {
      setContentError('Nội dung prompt là bắt buộc');
      return false;
    }
    if (value.length < 10) {
      setContentError('Nội dung prompt phải có ít nhất 10 ký tự');
      return false;
    }
    if (value.length > 10000) {
      setContentError('Nội dung prompt không được vượt quá 10,000 ký tự');
      return false;
    }
    setContentError('');
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

  // Handle input changes with validation
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    validateName(value);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    validateContent(value);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDescription(value);
    validateDescription(value);
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isNameValid = validateName(name);
    const isContentValid = validateContent(content);
    const isDescriptionValid = validateDescription(description);

    if (!isNameValid || !isContentValid || !isDescriptionValid) {
      return;
    }

    try {
      const formData = {
        name: name.trim(),
        content: content.trim(),
        description: description.trim(),
        is_active: isActive,
        is_default: isDefault,
      };

      if (prompt?.id) {
        await updatePrompt.mutateAsync({ id: prompt.id, data: formData });
        toast.success('Cập nhật prompt thành công!');
      } else {
        await createPrompt.mutateAsync(formData);
        toast.success('Tạo prompt mới thành công!');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Error saving prompt:', error);

      // Handle network errors
      if (!error.response) {
        const networkError = error.message || 'Không thể kết nối đến server. Vui lòng kiểm tra backend server có đang chạy không.';
        toast.error(networkError);
        return;
      }

      // Extract error message from API response
      const responseData = error?.response?.data;
      let errorMessage = 'Không thể tạo/cập nhật prompt. Vui lòng thử lại.';

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

      if (!errorMessage || errorMessage === 'Không thể tạo/cập nhật prompt. Vui lòng thử lại.') {
        errorMessage = error?.message || errorMessage;
      }

      toast.error(errorMessage);

      // Show validation errors if available
      if (responseData?.error?.details) {
        const details = responseData.error.details;
        if (Array.isArray(details)) {
          details.forEach((err: any) => {
            if (err.loc && err.loc.includes('name')) {
              setNameError(err.msg || 'Tên prompt không hợp lệ');
            }
            if (err.loc && err.loc.includes('content')) {
              setContentError(err.msg || 'Nội dung prompt không hợp lệ');
            }
            if (err.loc && err.loc.includes('description')) {
              setDescriptionError(err.msg || 'Mô tả không hợp lệ');
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
        if (errors.content) {
          setContentError(Array.isArray(errors.content) ? errors.content[0] : errors.content);
        }
        if (errors.description) {
          setDescriptionError(Array.isArray(errors.description) ? errors.description[0] : errors.description);
        }
      }
    }
  };

  // Loading state
  const isLoading = createPrompt.isLoading || updatePrompt.isLoading;

  // Word count helpers
  const getContentWordCount = () => content.trim().split(/\s+/).filter(word => word.length > 0).length;
  const getDescriptionWordCount = () => description.trim().split(/\s+/).filter(word => word.length > 0).length;

  // Function to process prompt content with variables
  const processPromptContent = (text: string, vars: Record<string, string>) => {
    let processedText = text;
    for (const key in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, key)) {
        const value = vars[key];
        // Only replace if a value is provided, otherwise keep the original placeholder
        if (value) {
          processedText = processedText.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
        }
      }
    }
    return processedText;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Form Inputs */}
      <div className="space-y-4">
        {/* Prompt Name */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tên Prompt <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={handleNameChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors ${
              nameError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            } dark:bg-gray-700 dark:text-gray-100`}
            placeholder="Nhập tên cho prompt (vd: Dịch thuật cơ bản, Dịch thuật nâng cao)"
            maxLength={100}
            required
          />
          {nameError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {nameError}
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Tên prompt phải là duy nhất và mô tả rõ chức năng của prompt.
          </p>
        </div>

        {/* Prompt Content */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Nội dung Prompt <span className="text-red-500">*</span>
          </label>
          <textarea
            value={content}
            onChange={handleContentChange}
            rows={5}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors resize-vertical overflow-y-auto custom-scrollbar ${
              contentError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            } dark:bg-gray-700 dark:text-gray-100`}
            placeholder="Nhập nội dung prompt chi tiết..."
            maxLength={10000}
            required
          />
          {contentError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {contentError}
            </p>
          )}
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{content.length}/10,000 ký tự</span>
            <span>{getContentWordCount()} từ</span>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Mô tả
          </label>
          <textarea
            value={description}
            onChange={handleDescriptionChange}
            rows={2}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors resize-vertical overflow-y-auto custom-scrollbar ${
              descriptionError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            } dark:bg-gray-700 dark:text-gray-100`}
            placeholder="Mô tả ngắn gọn về prompt này (tùy chọn)"
            maxLength={500}
          />
          {descriptionError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {descriptionError}
            </p>
          )}
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{description.length}/500 ký tự</span>
            <span>{getDescriptionWordCount()} từ</span>
          </div>
        </div>

        {/* Active Status */}
        <div className="space-y-2">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Prompt hoạt động
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Prompt này có thể được sử dụng trong hệ thống dịch thuật
              </p>
            </div>
          </label>
        </div>

        {/* Default Prompt */}
        <div className="space-y-2">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Chọn làm prompt mặc định
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Prompt này sẽ được tự động chọn khi sử dụng chức năng có ô chọn prompt (dịch file, dịch văn bản, v.v.)
              </p>
            </div>
          </label>
        </div>

        {/* Dynamic Variables Input */}
        {Object.keys(variables).length > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Giá trị biến cho Preview
            </label>
            {Object.keys(variables).map((key) => (
              <div key={key} className="space-y-1">
                <label htmlFor={`var-${key}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {`{{${key}}}`}
                </label>
                <input
                  type="text"
                  id={`var-${key}`}
                  value={variables[key]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVariables({ ...variables, [key]: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                  placeholder={`Nhập giá trị cho biến ${key}`}
                />
              </div>
            ))}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Điền giá trị cho các biến để xem trước prompt hoạt động như thế nào.
            </p>
          </div>
        )}

        {/* Form Actions */}
        <div className="mt-6 pt-4 border-t flex items-center justify-end space-x-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={isLoading || !!nameError || !!contentError || !!descriptionError || !name.trim() || !content.trim()}
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Đang lưu...
              </>
            ) : (
              prompt?.id ? 'Cập nhật Prompt' : 'Tạo Prompt'
            )}
          </button>
        </div>
      </div>

      {/* Right Column - Preview */}
      <div className="lg:sticky lg:top-6">
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800 shadow-lg">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg mr-3">
              <span className="text-xl">👁️</span>
            </div>
            <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
              Xem trước Prompt
            </h4>
          </div>

          <div className="text-sm">
            <span className="font-medium text-blue-900 dark:text-blue-100">Tên Prompt: </span>
            <span className="text-gray-900 dark:text-white font-semibold">
              {name || 'Chưa có tên'}
            </span>
          </div>

          {Object.keys(variables).length > 0 && (
            <div className="space-y-2 mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
              <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Biến đã áp dụng:</h5>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                {Object.entries(variables).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="font-mono text-blue-600 dark:text-blue-400">{`{{${key}}}`}</span>
                    <span className="font-medium">{value || '[trống]'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 mt-4">
            <label className="block text-sm font-medium text-blue-900 dark:text-blue-50">
              Nội dung Prompt đã xử lý:
            </label>
            <div className="bg-white dark:bg-gray-900/70 rounded-lg p-4 border-l-4 border-blue-500 max-h-48 overflow-y-auto custom-scrollbar">
              <pre className="whitespace-pre-wrap text-gray-900 dark:text-white font-mono text-sm leading-relaxed">
                {processPromptContent(content, variables) || 'Nội dung prompt sau khi áp dụng biến sẽ hiển thị ở đây...'}
              </pre>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Đây là kết quả của prompt sau khi áp dụng các giá trị biến bạn đã nhập.
            </p>
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
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
                Độ dài nội dung:
              </span>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {content.length}/10,000 ký tự
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Số từ nội dung:
              </span>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {getContentWordCount()} từ
              </span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
            <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
              Prompt này sẽ được sử dụng để hướng dẫn AI trong quá trình dịch thuật
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}