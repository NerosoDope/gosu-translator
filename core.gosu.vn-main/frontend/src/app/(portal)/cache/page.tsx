'use client';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import CacheTable from '@/components/admin/CacheTable';
import CacheForm from '@/components/admin/CacheForm';

export default function CachePage() {
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [refresh, setRefresh] = useState(false);

  return (
    <QueryClientProvider client={new QueryClient()}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Quản Lý Cache</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn btn-primary mb-4">Thêm mới</button>
        {showForm && (
          <CacheForm
            cache={editing}
            onSuccess={() => { setShowForm(false); setEditing(null); setRefresh(x => !x); }}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        )}
        {!showForm && (
          <CacheTable
            key={refresh ? 1 : 0}
            onEdit={cache => { setEditing(cache); setShowForm(true); }}
          />
        )}
      </div>
    </QueryClientProvider>
  );
}
