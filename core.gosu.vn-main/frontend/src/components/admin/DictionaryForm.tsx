import { useCreateDictionary, useUpdateDictionary } from '@/hooks/useDictionary';
import { useState } from 'react';

export default function DictionaryForm({ item, onSuccess, onCancel }: { item?: any, onSuccess: () => void, onCancel: () => void }) {
  const [code, setCode] = useState(item?.code || '');
  const [value, setValue] = useState(item?.value || '');
  const [description, setDescription] = useState(item?.description || '');
  const [isActive, setIsActive] = useState(item?.is_active ?? true);
  const createDictionary = useCreateDictionary();
  const updateDictionary = useUpdateDictionary();

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const data = { code, value, description, is_active: isActive };
    if (item && item.id) {
      await updateDictionary.mutateAsync({ id: item.id, data });
    } else {
      await createDictionary.mutateAsync(data);
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white dark:bg-gray-800 rounded-lg shadow-theme-md p-4">
      <div>
        <label>Code</label>
        <input className="input" value={code} onChange={e => setCode(e.target.value)} required />
      </div>
      <div>
        <label>Value</label>
        <textarea className="input" value={value} onChange={e => setValue(e.target.value)} required />
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
        <button type="submit" className="btn btn-primary">{item ? 'Update' : 'Create'}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
