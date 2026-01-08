'use client';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import DictionaryTable from '@/components/admin/DictionaryTable';
import DictionaryForm from '@/components/admin/DictionaryForm';

export default function DictionaryPage() {
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [refresh, setRefresh] = useState(false);

  return (
    <QueryClientProvider client={new QueryClient()}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Từ Điển</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn btn-primary mb-4">Thêm mới</button>
        {showForm && (
          <DictionaryForm
            item={editing}
            onSuccess={() => { setShowForm(false); setEditing(null); setRefresh(x => !x); }}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        )}
        {!showForm && (
          <DictionaryTable
            key={refresh ? 1 : 0}
            onEdit={item => { setEditing(item); setShowForm(true); }}
          />
        )}
      </div>
    </QueryClientProvider>
  );
}
