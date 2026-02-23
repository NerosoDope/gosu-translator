import { useJobsList, useDeleteJob } from '@/hooks/useJobs';
import { useState } from 'react';

export default function JobsTable({ onEdit }: { onEdit: (job: any) => void }) {
  const { data, isLoading, error } = useJobsList();
  const deleteJob = useDeleteJob();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading jobs</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-md">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">ID</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Title</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Active</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {data?.items?.map((job: any) => (
            <tr key={job.id} className="border-b border-gray-200 dark:border-gray-700">
              <td className="px-4 py-3 text-sm">{job.id}</td>
              <td className="px-4 py-3 text-sm">{job.title}</td>
              <td className="px-4 py-3 text-sm">{job.is_active ? '✔️' : ''}</td>
              <td className="px-4 py-3 text-sm flex gap-2">
                <button onClick={() => onEdit(job)} className="text-blue-600">Edit</button>
                <button
                  disabled={deletingId === job.id}
                  onClick={async () => {
                    setDeletingId(job.id);
                    await deleteJob.mutateAsync(job.id);
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
