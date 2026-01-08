import { useCacheList, useDeleteCache } from '@/hooks/useCache';
import { useState } from 'react';

export default function CacheTable({ onEdit }: { onEdit: (cache: any) => void }) {
  const { data, isLoading, error } = useCacheList();
  const deleteCache = useDeleteCache();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading cache</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-md">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">ID</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Key</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">TTL</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.map((cache: any) => (
            <tr key={cache.id} className="border-b border-gray-200 dark:border-gray-700">
              <td className="px-4 py-3 text-sm">{cache.id}</td>
              <td className="px-4 py-3 text-sm">{cache.key}</td>
              <td className="px-4 py-3 text-sm">{cache.ttl || 'N/A'}</td>
              <td className="px-4 py-3 text-sm flex gap-2">
                <button onClick={() => onEdit(cache)} className="text-blue-600">Edit</button>
                <button
                  disabled={deletingId === cache.id}
                  onClick={async () => {
                    setDeletingId(cache.id);
                    await deleteCache.mutateAsync(cache.id);
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
