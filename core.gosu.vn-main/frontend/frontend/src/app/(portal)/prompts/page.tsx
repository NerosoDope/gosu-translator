'use client';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import PromptsTable from '@/components/admin/PromptsTable';
import PromptsForm from '@/components/admin/PromptsForm';

export default function PromptsPage() {
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [refresh, setRefresh] = useState(false);

  return (
    <QueryClientProvider client={new QueryClient()}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Quản Lý Prompts</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn btn-primary mb-4">Thêm mới</button>
        {showForm && (
          <PromptsForm
            prompt={editing}
            onSuccess={() => { setShowForm(false); setEditing(null); setRefresh(x => !x); }}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        )}
        {!showForm && (
          <PromptsTable
            key={refresh ? 1 : 0}
            onEdit={prompt => { setEditing(prompt); setShowForm(true); }}
          />
        )}
      </div>
    </QueryClientProvider>
  );
}
