import { useLanguageList, useDeleteLanguage } from '@/hooks/useLanguage';
import { Language } from '@/types/api';
import { getLanguageNameVi } from '@/lib/languageNamesVi';
import { useState } from 'react';

export default function LanguageTable({ onEdit }: { onEdit: (language: Language) => void }) {
  const { data, isLoading, error } = useLanguageList();
  const deleteLanguage = useDeleteLanguage();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading languages</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-md">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">ID</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Mã ngôn ngữ</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Tên ngôn ngữ</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Trạng thái</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Cặp nguồn</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Cặp đích</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {data?.items?.map((language: Language) => (
            <tr key={language.id} className="border-b border-gray-200 dark:border-gray-700">
              <td className="px-4 py-3 text-sm">{language.id}</td>
              <td className="px-4 py-3 text-sm">{language.code}</td>
              <td className="px-4 py-3 text-sm">{getLanguageNameVi(language.code, language.name)}</td>
              <td className="px-4 py-3 text-sm">{language.is_active ? '✔️' : ''}</td>
              <td className="px-4 py-3 text-sm">{language.source_pairs_count || 0}</td>
              <td className="px-4 py-3 text-sm">{language.target_pairs_count || 0}</td>
              <td className="px-4 py-3 text-sm flex gap-2">
                <button onClick={() => onEdit(language)} className="text-blue-600">Edit</button>
                <button
                  disabled={deletingId === language.id}
                  onClick={async () => {
                    setDeletingId(language.id);
                    await deleteLanguage.mutateAsync(language.id);
                    setDeletingId(null);
                  }}
                  className="text-red-600"
                >Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
