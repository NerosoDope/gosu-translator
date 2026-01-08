import { useCreateGameGlossary, useUpdateGameGlossary } from '@/hooks/useGameGlossary';
import { useGameCategoryList } from '@/hooks/useGameCategory';
import { useState } from 'react';

export default function GameGlossaryForm({ item, onSuccess, onCancel }: { item?: any, onSuccess: () => void, onCancel: () => void }) {
  const [term, setTerm] = useState(item?.term || '');
  const [definition, setDefinition] = useState(item?.definition || '');
  const [categoryId, setCategoryId] = useState(item?.category_id || '');
  const [isActive, setIsActive] = useState(item?.is_active ?? true);
  const createGameGlossary = useCreateGameGlossary();
  const updateGameGlossary = useUpdateGameGlossary();
  const { data: categories } = useGameCategoryList();

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const data = {
      term,
      definition,
      category_id: categoryId ? parseInt(categoryId) : null,
      is_active: isActive
    };
    if (item && item.id) {
      await updateGameGlossary.mutateAsync({ id: item.id, data });
    } else {
      await createGameGlossary.mutateAsync(data);
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white dark:bg-gray-800 rounded-lg shadow-theme-md p-4">
      <div>
        <label>Term</label>
        <input className="input" value={term} onChange={e => setTerm(e.target.value)} required />
      </div>
      <div>
        <label>Definition</label>
        <textarea className="input" rows={4} value={definition} onChange={e => setDefinition(e.target.value)} required />
      </div>
      <div>
        <label>Category</label>
        <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
          <option value="">Select Category (Optional)</option>
          {categories?.data?.map((cat: any) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Active
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary">{item ? 'Update' : 'Create'}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
