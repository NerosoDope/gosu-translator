'use client';
import { useState } from 'react';
import JobsTable from '@/components/admin/JobsTable';
import JobsForm from '@/components/admin/JobsForm';
import { QueryClient, QueryClientProvider } from 'react-query';

export default function JobsPage() {
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [refresh, setRefresh] = useState(false);

  return (
    <QueryClientProvider client={new QueryClient()}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Quản Lý Jobs</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn btn-primary mb-4">Thêm mới</button>
        {showForm && (
          <JobsForm
            job={editing}
            onSuccess={() => { setShowForm(false); setEditing(null); setRefresh(x => !x); }}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        )}
        {!showForm && (
          <JobsTable
            key={refresh ? 1 : 0}
            onEdit={job => { setEditing(job); setShowForm(true); }}
          />
        )}
      </div>
    </QueryClientProvider>
  );
}
