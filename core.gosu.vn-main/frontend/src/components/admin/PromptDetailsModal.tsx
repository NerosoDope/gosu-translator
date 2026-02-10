// Prompt Details Modal Component
interface Prompt {
  id: number;
  name: string;
  content: string;
  description: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function PromptDetailsModal({ prompt, isOpen, onClose }: { prompt: Prompt | null; isOpen: boolean; onClose: () => void }) {
  if (!isOpen || !prompt) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Không có thông tin';
    return new Date(dateString).toLocaleString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[75vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Chi tiết Prompt
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Đóng"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-6">

          {/* Prompt Name in content area */}
          <div className="space-y-2 mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tên Prompt
            </label>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-gray-900 dark:text-gray-100 font-bold">
              {prompt.name}
            </div>
          </div>

          {/* Description */}
          {prompt.description && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Mô tả
              </label>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-gray-700 dark:text-gray-300">
                {prompt.description}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nội dung Prompt
            </label>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border-l-4 border-blue-500 max-h-48 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-gray-900 dark:text-gray-100 font-mono text-sm leading-relaxed">
                {prompt.content}
              </pre>
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{prompt.content.length} ký tự</span>
              <span>{prompt.content.split(/\s+/).filter(word => word.length > 0).length} từ</span>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Trạng thái:
              </span>
              <span
                className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                  prompt.is_active
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}
              >
                {prompt.is_active ? 'Hoạt động' : 'Tạm dừng'}
              </span>
            </div>
          </div>

        </div>
        <div className="flex items-center justify-end p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}