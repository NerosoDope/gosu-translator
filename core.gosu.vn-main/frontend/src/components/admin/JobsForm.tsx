import { useCreateJob, useUpdateJob } from '@/hooks/useJobs';
import { useState } from 'react';

export default function JobsForm({ job, onSuccess, onCancel }: { job?: any, onSuccess: () => void, onCancel: () => void }) {
  const [title, setTitle] = useState(job?.title || '');
  const [description, setDescription] = useState(job?.description || '');
  const [isActive, setIsActive] = useState(job?.is_active ?? true);
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const data = { title, description, is_active: isActive };
    if (job && job.id) {
      await updateJob.mutateAsync({ id: job.id, data });
    } else {
      await createJob.mutateAsync(data);
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white dark:bg-gray-800 rounded-lg shadow-theme-md p-4">
      <div>
        <label>Title</label>
        <input className="input" value={title} onChange={e => setTitle(e.target.value)} required />
      </div>
      <div>
        <label>Description</label>
        <textarea className="input" value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Active
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary">{job ? 'Update' : 'Create'}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
