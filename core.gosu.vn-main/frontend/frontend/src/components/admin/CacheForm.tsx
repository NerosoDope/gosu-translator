import { useCreateCache, useUpdateCache } from '@/hooks/useCache';
import { useState } from 'react';

export default function CacheForm({ cache, onSuccess, onCancel }: { cache?: any, onSuccess: () => void, onCancel: () => void }) {
  const [key, setKey] = useState(cache?.key || '');
  const [value, setValue] = useState(cache?.value || '');
  const [ttl, setTtl] = useState(cache?.ttl || '');
  const createCache = useCreateCache();
  const updateCache = useUpdateCache();

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const data = { key, value, ttl: ttl ? parseInt(ttl) : null };
    if (cache && cache.id) {
      await updateCache.mutateAsync({ id: cache.id, data });
    } else {
      await createCache.mutateAsync(data);
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white dark:bg-gray-800 rounded-lg shadow-theme-md p-4">
      <div>
        <label>Key</label>
        <input className="input" value={key} onChange={e => setKey(e.target.value)} required />
      </div>
      <div>
        <label>Value</label>
        <textarea className="input" value={value} onChange={e => setValue(e.target.value)} required />
      </div>
      <div>
        <label>TTL (seconds)</label>
        <input className="input" type="number" value={ttl} onChange={e => setTtl(e.target.value)} placeholder="Optional" />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary">{cache ? 'Update' : 'Create'}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
