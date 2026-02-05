'use client';

import { useGlobal_glossaryList } from '@/hooks/useGlobal_glossary';

export default function Global_glossaryTable() {
  const { data, isLoading, error } = useGlobal_glossaryList();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-md">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
              ID
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
              Name
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.map((item: any) => (
            <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700">
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                {item.id}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                {item.name}
              </td>
              <td className="px-4 py-3 text-sm">
                <button className="text-blue-600 hover:text-blue-800">
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
