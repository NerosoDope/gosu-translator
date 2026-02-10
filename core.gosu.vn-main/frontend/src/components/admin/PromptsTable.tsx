import { usePromptsList, useDeletePrompt } from '@/hooks/usePrompts';
import { useState } from 'react';


export default function PromptsTable({ onEdit }: { onEdit: (prompt: any) => void }) {
  const { data, isLoading, error } = usePromptsList();
  const deletePrompt = useDeletePrompt();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading prompts</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-md">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">ID</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Tên Prompt</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Nội dung</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Trạng thái</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {data?.items?.map((prompt: any) => (
            <tr key={prompt.id} className="border-b border-gray-200 dark:border-gray-700">
              <td className="px-4 py-3 text-sm">{prompt.id}</td>
              <td className="px-4 py-3 text-sm font-medium">{prompt.name}</td>
              <td className="px-4 py-3 text-sm max-w-md">
                <div className="truncate" title={prompt.content}>
                  {prompt.content}
                </div>
              </td>
              <td className="px-4 py-3 text-sm">{prompt.is_active ? '✔️' : ''}</td>
              <td className="px-4 py-3 text-sm flex gap-2">
                <button
                  onClick={() => onView(prompt)}
                  className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                  title="Xem chi tiết"
                >
                  👁️
                </button>
                <button onClick={() => onEdit(prompt)} className="text-blue-600">Edit</button>
                <button
                  disabled={deletingId === prompt.id}
                  onClick={async () => {
                    setDeletingId(prompt.id);
                    await deletePrompt.mutateAsync(prompt.id);
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
