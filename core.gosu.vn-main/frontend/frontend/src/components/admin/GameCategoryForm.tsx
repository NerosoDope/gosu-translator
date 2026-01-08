import { useCreateGameCategory, useUpdateGameCategory } from '@/hooks/useGameCategory';
import { useState } from 'react';

export default function GameCategoryForm({ category, onSuccess, onCancel }: { category?: any, onSuccess: () => void, onCancel: () => void }) {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const createGameCategory = useCreateGameCategory();
  const updateGameCategory = useUpdateGameCategory();

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const data = { name, description, is_active: isActive };
    if (category && category.id) {
      await updateGameCategory.mutateAsync({ id: category.id, data });
    } else {
      await createGameCategory.mutateAsync(data);
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
        <label>Description</label>
        <textarea className="input" value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Active
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary">{category ? 'Update' : 'Create'}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
