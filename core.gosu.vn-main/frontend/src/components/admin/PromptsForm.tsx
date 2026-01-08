import { useCreatePrompt, useUpdatePrompt } from '@/hooks/usePrompts';
import { useState } from 'react';

export default function PromptsForm({ prompt, onSuccess, onCancel }: { prompt?: any, onSuccess: () => void, onCancel: () => void }) {
  const [name, setName] = useState(prompt?.name || '');
  const [content, setContent] = useState(prompt?.content || '');
  const [description, setDescription] = useState(prompt?.description || '');
  const [isActive, setIsActive] = useState(prompt?.is_active ?? true);
  const createPrompt = useCreatePrompt();
  const updatePrompt = useUpdatePrompt();

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const data = { name, content, description, is_active: isActive };
    if (prompt && prompt.id) {
      await updatePrompt.mutateAsync({ id: prompt.id, data });
    } else {
      await createPrompt.mutateAsync(data);
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white dark:bg-gray-800 rounded-lg shadow-theme-md p-4">
      <div>
        <label>Name</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div>
        <label>Content</label>
        <textarea className="input" rows={6} value={content} onChange={e => setContent(e.target.value)} required />
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
        <button type="submit" className="btn btn-primary">{prompt ? 'Update' : 'Create'}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
