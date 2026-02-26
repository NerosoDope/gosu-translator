'use client';

import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import { useToastContext } from '@/context/ToastContext';
import { getLanguageNameVi } from '@/lib/languageNamesVi';

interface RowData {
  id: number;
  original: string;
  translated: string;
  score: number | null;
}

export default function ProofreadPage() {
  const toast = useToastContext();
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<RowData[]>([
    { id: 1, original: 'Mẫu văn bản gốc', translated: 'Mẫu bản dịch', score: null },
  ]);
  const [sourceLang, setSourceLang] = useState('');
  const [targetLang, setTargetLang] = useState('');
  const [search, setSearch] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setFileName(f.name);
      toast.success('Đã chọn file. (Tích hợp đọc nội dung file sẽ bổ sung sau.)');
    }
    e.target.value = '';
  };

  const handleScore = (id: number) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const s = row.score ?? 0;
    const newScore = s >= 100 ? 0 : s + 10;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, score: newScore } : r)));
    toast.success(`Điểm dòng ${id}: ${newScore}/100`);
  };

  const filteredRows = search.trim()
    ? rows.filter(
        (r) =>
          r.original.toLowerCase().includes(search.toLowerCase()) ||
          r.translated.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Hiệu Đính</h1>
        <span className="text-gray-400 cursor-help" title="Hướng dẫn">?</span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Tải lên file đã dịch để hiệu đính và cải thiện bản dịch bằng AI. Chấm điểm chất lượng bảng dịch.
      </p>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Trình Hiệu Đính</h2>
        {fileName && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {fileName} - {rows.length} dòng
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300">
            Tải Lên File Mới
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
          </label>
          <Button variant="secondary">Lưu vào Jobs</Button>
          <Button>Tải Xuống File Đã Chỉnh Sửa</Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ngôn Ngữ Nguồn *</label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Chọn ngôn ngữ nguồn</option>
              <option value="en">{getLanguageNameVi('en')}</option>
              <option value="vi">{getLanguageNameVi('vi')}</option>
              <option value="ja">{getLanguageNameVi('ja')}</option>
              <option value="zh">{getLanguageNameVi('zh')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ngôn Ngữ Đích *</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Chọn ngôn ngữ đích</option>
              <option value="en">{getLanguageNameVi('en')}</option>
              <option value="vi">{getLanguageNameVi('vi')}</option>
              <option value="ja">{getLanguageNameVi('ja')}</option>
              <option value="zh">{getLanguageNameVi('zh')}</option>
            </select>
          </div>
        </div>

        <input
          type="text"
          placeholder="Tìm kiếm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />

        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 w-12"></th>
                <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 w-16">DÒNG</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">GỐC</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">ĐÃ DỊCH</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 w-24">ĐIỂM</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2">
                    <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" />
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{row.id}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100 max-w-xs truncate">{row.original}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100 max-w-xs">
                    <span className="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 px-1 rounded">
                      {row.translated}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`font-medium ${row.score != null ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
                      {row.score != null ? `${row.score}/100` : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => handleScore(row.id)}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                    >
                      Check Điểm
                    </button>
                    <span className="mx-1 text-gray-300 dark:text-gray-600">|</span>
                    <button type="button" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
                      Hiệu Đính
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
