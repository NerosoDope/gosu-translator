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
              Mã Job
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
              Loại
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
              Trạng thái
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
              Tiến độ
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
                {item.job_code}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                {item.job_type}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                {item.status}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                {item.progress}%
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
