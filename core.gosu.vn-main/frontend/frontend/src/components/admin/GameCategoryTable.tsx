import { useGameCategoryList, useDeleteGameCategory } from '@/hooks/useGameCategory';
import { useState } from 'react';

export default function GameCategoryTable({ onEdit }: { onEdit: (category: any) => void }) {
  const { data, isLoading, error } = useGameCategoryList();
  const deleteGameCategory = useDeleteGameCategory();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading game categories</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-md">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">ID</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Name</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Description</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Active</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.map((category: any) => (
            <tr key={category.id} className="border-b border-gray-200 dark:border-gray-700">
              <td className="px-4 py-3 text-sm">{category.id}</td>
              <td className="px-4 py-3 text-sm">{category.name}</td>
              <td className="px-4 py-3 text-sm max-w-xs truncate">{category.description}</td>
              <td className="px-4 py-3 text-sm">{category.is_active ? '✔️' : ''}</td>
              <td className="px-4 py-3 text-sm flex gap-2">
                <button onClick={() => onEdit(category)} className="text-blue-600">Edit</button>
                <button
                  disabled={deletingId === category.id}
                  onClick={async () => {
                    setDeletingId(category.id);
                    await deleteGameCategory.mutateAsync(category.id);
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
