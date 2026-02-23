'use client';

import { useJobList } from '@/hooks/useJob';

export default function JobTable() {
  const { data, isLoading, error } = useJobList();

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
              Tiêu đề
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
              Mô tả
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
              Trạng thái
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {data?.items?.map((item: Job) => (
            <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700">
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                {item.id}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                {item.title}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                {item.description || '-'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                {item.is_active ? 'Active' : 'Inactive'}
              </td>
              <td className="px-4 py-3 text-sm text-left">
                <div className="flex items-center justify-start gap-2">
                  <button
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    title="Chỉnh sửa"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    title="Xóa"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
