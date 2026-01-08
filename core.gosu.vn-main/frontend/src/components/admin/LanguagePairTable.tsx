import { useState } from 'react';
import { useLanguagePairs, useDeleteLanguagePair } from '@/hooks/useLanguage';

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

interface LanguagePairTableProps {
  onEdit: (pair: LanguagePair) => void;
  sourceLanguageId?: number;
  targetLanguageId?: number;
  isActive?: boolean;
}

export default function LanguagePairTable({
  onEdit,
  sourceLanguageId,
  targetLanguageId,
  isActive
}: LanguagePairTableProps) {
  // Build query params
  const params = {
    source_language_id: sourceLanguageId,
    target_language_id: targetLanguageId,
    is_active: isActive,
  };

  // Hooks
  const { data, isLoading, error } = useLanguagePairs(params);
  const deleteLanguagePair = useDeleteLanguagePair();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Đang tải</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center">
          <div>
            <h3 className="text-red-800 dark:text-red-200 font-medium">
              Lỗi tải dữ liệu
            </h3>
            <p className="text-red-600 dark:text-red-300 text-sm">
              Không thể tải danh sách cặp ngôn ngữ
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Handle delete
  const handleDelete = async (pairId: number) => {
    setDeletingId(pairId);
    try {
      await deleteLanguagePair.mutateAsync(pairId);
    } catch (error) {
      console.error('Error deleting language pair:', error);
    } finally {
      setDeletingId(null);
    }
  };

  // Empty state
  if (!data?.data?.length) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>Chưa có cặp ngôn ngữ nào</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Ngôn ngữ nguồn
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Ngôn ngữ đích
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Dịch hai chiều
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Trạng thái
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            {data.data.map((pair: LanguagePair, index: number) => (
              <tr
                key={pair.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {index + 1}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {pair.source_language?.name}
                    </span>
                    <span className="ml-2 text-gray-500 dark:text-gray-400">
                      ({pair.source_language?.code})
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {pair.target_language?.name}
                    </span>
                    <span className="ml-2 text-gray-500 dark:text-gray-400">
                      ({pair.target_language?.code})
                    </span>
                  </div>
                </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    {pair.is_bidirectional ? 'Hai chiều' : 'Một chiều'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    pair.is_active
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }`}>
                    {pair.is_active ? 'Hoạt động' : 'Tạm dừng'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => onEdit(pair)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      title="Chỉnh sửa"
                    >
                      Sửa
                    </button>
                    <button
                      disabled={deletingId === pair.id}
                      onClick={() => handleDelete(pair.id)}
                      className={`transition-colors ${
                        deletingId === pair.id
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300'
                      }`}
                      title="Xóa"
                    >
                      {deletingId === pair.id ? '...' : 'Xóa'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}