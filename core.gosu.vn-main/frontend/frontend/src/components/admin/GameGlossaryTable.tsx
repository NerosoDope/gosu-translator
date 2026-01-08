import { useGameGlossaryList, useDeleteGameGlossary } from '@/hooks/useGameGlossary';
import { useState } from 'react';

export default function GameGlossaryTable({ onEdit }: { onEdit: (item: any) => void }) {
  const { data, isLoading, error } = useGameGlossaryList();
  const deleteGameGlossary = useDeleteGameGlossary();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading game glossary</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-md">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">ID</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Term</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Definition</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Active</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.map((item: any) => (
            <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700">
              <td className="px-4 py-3 text-sm">{item.id}</td>
              <td className="px-4 py-3 text-sm">{item.term}</td>
              <td className="px-4 py-3 text-sm max-w-xs truncate">{item.definition}</td>
              <td className="px-4 py-3 text-sm">{item.is_active ? '✔️' : ''}</td>
              <td className="px-4 py-3 text-sm flex gap-2">
                <button onClick={() => onEdit(item)} className="text-blue-600">Edit</button>
                <button
                  disabled={deletingId === item.id}
                  onClick={async () => {
                    setDeletingId(item.id);
                    await deleteGameGlossary.mutateAsync(item.id);
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
