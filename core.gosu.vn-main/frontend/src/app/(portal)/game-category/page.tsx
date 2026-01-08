'use client';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import GameCategoryTable from '@/components/admin/GameCategoryTable';
import GameCategoryForm from '@/components/admin/GameCategoryForm';

export default function GameCategoryPage() {
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [refresh, setRefresh] = useState(false);

  return (
    <QueryClientProvider client={new QueryClient()}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Thể Loại Game</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn btn-primary mb-4">Thêm mới</button>
        {showForm && (
          <GameCategoryForm
            category={editing}
            onSuccess={() => { setShowForm(false); setEditing(null); setRefresh(x => !x); }}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        )}
        {!showForm && (
          <GameCategoryTable
            key={refresh ? 1 : 0}
            onEdit={category => { setEditing(category); setShowForm(true); }}
          />
        )}
      </div>
    </QueryClientProvider>
  );
}
