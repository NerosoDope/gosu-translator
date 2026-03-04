'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import { proofreadAPI, translateAPI } from '@/lib/api';
import { useToastContext } from '@/context/ToastContext';

type S5Status = 'original' | 'edited' | 'ai-proofread' | 'loading';
interface S5Row {
  id: number;
  original: string;
  translated: string;
  status: S5Status;
  selected: boolean;
}

const S5_BADGE: Record<S5Status, { label: string; cls: string }> = {
  original:       { label: 'Gốc',          cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  edited:         { label: 'Đã sửa',       cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  'ai-proofread': { label: 'AI Hiệu Đính', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  loading:        { label: 'Đang xử lý…',  cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
};
const BATCH_SIZE = 10;

export interface JobForProofread {
  id: number;
  job_code?: string;
  source_lang?: string | null;
  target_lang?: string | null;
  payload?: { filename?: string } | null;
  result?: {
    rows?: Record<string, string>[];
    output_columns?: string[];
  } | null;
}

function buildProofreadRows(rows: Record<string, string>[], outputColumns?: string[]): { rows: S5Row[]; origCol: string; transCol: string } | null {
  if (!rows?.length) return null;
  const first = rows[0];
  let origCol = '';
  let transCol = '';
  const cols = outputColumns && outputColumns.length > 0
    ? outputColumns
    : Object.keys(first);
  for (const col of cols) {
    if (col.endsWith('_translated')) continue;
    const trans = col + '_translated';
    if (first[col] !== undefined && first[trans] !== undefined) {
      origCol = col;
      transCol = trans;
      break;
    }
  }
  if (!origCol) {
    for (const k of Object.keys(first)) {
      if (k.endsWith('_translated')) {
        const orig = k.replace(/_translated$/, '');
        if (first[orig] !== undefined) {
          origCol = orig;
          transCol = k;
          break;
        }
      }
    }
  }
  if (!origCol) return null;
  const s5Rows: S5Row[] = rows
    .map((r, i) => ({
      id: i + 1,
      original: r[origCol] ?? '',
      translated: r[transCol] ?? '',
      status: 'original' as S5Status,
      selected: false,
    }))
    .filter((r) => r.original.trim() !== '');
  return { rows: s5Rows, origCol, transCol };
}

interface ProofreadJobModalProps {
  open: boolean;
  onClose: () => void;
  job: JobForProofread | null;
}

export default function ProofreadJobModal({ open, onClose, job }: ProofreadJobModalProps) {
  const toast = useToastContext();
  const [rows, setRows] = useState<S5Row[]>([]);
  const [origCol, setOrigCol] = useState('');
  const [transCol, setTransCol] = useState('');
  const [search, setSearch] = useState('');
  const [selectAll, setSelectAll] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);

  const sourceLang = (job?.source_lang ?? '').trim();
  const targetLang = (job?.target_lang ?? '').trim();
  const baseName = (job?.payload?.filename ?? job?.job_code ?? 'proofread').replace(/\.[^.]+$/, '') || 'proofread';

  useEffect(() => {
    if (!open || !job?.result?.rows?.length) {
      setRows([]);
      setOrigCol('');
      setTransCol('');
      setSearch('');
      setSelectAll(false);
      return;
    }
    const built = buildProofreadRows(job.result.rows, job.result.output_columns ?? undefined);
    if (built) {
      setRows(built.rows);
      setOrigCol(built.origCol);
      setTransCol(built.transCol);
    } else {
      setRows([]);
      setOrigCol('');
      setTransCol('');
    }
    setSearch('');
    setSelectAll(false);
  }, [open, job]);

  const editRow = useCallback((id: number, value: string) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, translated: value, status: r.status === 'loading' ? 'loading' : 'edited' } : r));
  }, []);

  const proofreadRow = useCallback(async (id: number) => {
    const row = rows.find((r) => r.id === id);
    if (!row || !sourceLang || !targetLang) {
      if (!sourceLang || !targetLang) toast.error('Job chưa có ngôn ngữ nguồn/đích.');
      return;
    }
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, status: 'loading' } : r));
    try {
      const res = await proofreadAPI.proofreadRow({
        original: row.original,
        translated: row.translated,
        source_lang: sourceLang,
        target_lang: targetLang,
      });
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, translated: res.data.proofread, status: 'ai-proofread' } : r));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Hiệu đính AI thất bại.');
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, status: 'original' } : r));
    }
  }, [rows, sourceLang, targetLang, toast]);

  const proofreadBatch = useCallback(async () => {
    if (!sourceLang || !targetLang) {
      toast.error('Job chưa có ngôn ngữ nguồn/đích.');
      return;
    }
    const targets = rows.filter((r) => r.selected && r.status !== 'loading');
    if (!targets.length) {
      toast.error('Chọn ít nhất 1 dòng để hiệu đính batch.');
      return;
    }
    setRows((prev) => prev.map((r) => r.selected ? { ...r, status: 'loading' } : r));
    setBatchLoading(true);
    try {
      for (let i = 0; i < targets.length; i += BATCH_SIZE) {
        const chunk = targets.slice(i, i + BATCH_SIZE);
        const res = await proofreadAPI.proofreadBatch({
          items: chunk.map((r) => ({ index: r.id, original: r.original, translated: r.translated })),
          source_lang: sourceLang,
          target_lang: targetLang,
        });
        const map: Record<number, string> = {};
        for (const item of res.data.results) map[item.index] = item.proofread;
        setRows((prev) => prev.map((r) => map[r.id] !== undefined ? { ...r, translated: map[r.id], status: 'ai-proofread', selected: false } : r));
      }
      toast.success(`Đã hiệu đính ${targets.length} dòng bằng AI.`);
      setSelectAll(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Hiệu đính batch thất bại.');
      setRows((prev) => prev.map((r) => r.status === 'loading' ? { ...r, status: 'original' } : r));
    } finally {
      setBatchLoading(false);
    }
  }, [rows, sourceLang, targetLang, toast]);

  const doReplace = useCallback(() => {
    if (!findText.trim()) {
      toast.error('Nhập nội dung cần tìm.');
      return;
    }
    const hasSelection = rows.some((r) => r.selected);
    const scope = hasSelection ? rows.filter((r) => r.selected) : rows;
    const count = scope.filter((r) => r.translated.includes(findText)).length;
    if (count === 0) {
      toast.error(hasSelection ? `Không tìm thấy "${findText}" trong ${scope.length} dòng đã chọn.` : `Không tìm thấy "${findText}" trong cột bản dịch.`);
      return;
    }
    const scopeIds = new Set(scope.map((r) => r.id));
    setRows((prev) => prev.map((r) => scopeIds.has(r.id) && r.translated.includes(findText) ? { ...r, translated: r.translated.split(findText).join(replaceText), status: 'edited' } : r));
    toast.success(hasSelection ? `Đã thay thế ${count} dòng trong ${scope.length} dòng đã chọn.` : `Đã thay thế ${count} dòng.`);
  }, [rows, findText, replaceText, toast]);

  const selectAllFn = (checked: boolean) => {
    setSelectAll(checked);
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };
  const selectRow = (id: number, checked: boolean) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, selected: checked } : r));
    if (!checked) setSelectAll(false);
  };

  const download = async (format: 'xlsx' | 'csv') => {
    if (!rows.length) return;
    try {
      const res = await translateAPI.exportFile({
        columns: [origCol, transCol],
        rows: rows.map((r) => ({ [origCol]: r.original, [transCol]: r.translated })),
        format,
        filename: baseName + '_proofread',
      });
      const blob = new Blob([res.data as unknown as BlobPart], {
        type: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_proofread.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Đã tải file.');
    } catch {
      toast.error('Không thể xuất file.');
    }
  };

  const selectedCount = rows.filter((r) => r.selected).length;
  const filtered = search.trim()
    ? rows.filter((r) => r.original.toLowerCase().includes(search.toLowerCase()) || r.translated.toLowerCase().includes(search.toLowerCase()))
    : rows;
  const editedCount = rows.filter((r) => r.status === 'edited').length;
  const aiCount = rows.filter((r) => r.status === 'ai-proofread').length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Hiệu Đính — {job?.job_code ?? 'Job'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {!job?.result?.rows?.length ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            Job này chưa lưu dữ liệu để hiệu đính. Chỉ job dịch file đã hoàn thành (và có lưu kết quả) mới mở được bảng hiệu đính.
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3 shrink-0">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {rows.length} dòng
                {editedCount > 0 && <span className="ml-2 text-amber-600 dark:text-amber-400">&bull; {editedCount} đã sửa</span>}
                {aiCount > 0 && <span className="ml-2 text-green-600 dark:text-green-400">&bull; {aiCount} AI hiệu đính</span>}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Ngôn ngữ: {sourceLang || '—'} → {targetLang || '—'}</span>
              </div>
              {/* Hàng 1: Tìm kiếm (trái), Tải File .xlsx / .csv (phải, giống bước 5 dịch file) */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <input
                  type="text"
                  placeholder="Tìm kiếm…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-56"
                />
                <div className="flex flex-wrap gap-2 ml-auto">
                  <Button onClick={() => download('xlsx')}>
                    <svg className="w-4 h-4 mr-1.5 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    Tải File .xlsx
                  </Button>
                  <Button variant="secondary" onClick={() => download('csv')}>Tải File .csv</Button>
                </div>
              </div>
              {/* Hàng 2: Find/Replace + AI Hiệu Đính (bên phải) */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Nội dung cần thay thế…"
                    value={findText}
                    onChange={(e) => setFindText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && doReplace()}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[140px]"
                  />
                  <input
                    type="text"
                    placeholder="Nội dung thay thế…"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && doReplace()}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[140px]"
                  />
                  <Button size="sm" variant="secondary" onClick={doReplace}>
                    {selectedCount > 0 ? `Replace (${selectedCount} dòng)` : 'Replace tất cả'}
                  </Button>
                </div>
                {selectedCount > 0 && (
                  <Button size="sm" isLoading={batchLoading} disabled={batchLoading} onClick={proofreadBatch}>
                    AI Hiệu Đính {selectedCount} dòng
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto min-h-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/40 sticky top-0">
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={selectAll} onChange={(e) => selectAllFn(e.target.checked)} className="rounded border-gray-300 text-brand-600" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-10">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">GỐC</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">ĐÃ DỊCH</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-28">TRẠNG THÁI</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-24">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                        {search ? 'Không tìm thấy kết quả.' : 'Chưa có dữ liệu.'}
                      </td>
                    </tr>
                  )}
                  {filtered.map((row) => {
                    const badge = S5_BADGE[row.status];
                    const isLoading = row.status === 'loading';
                    return (
                      <tr
                        key={row.id}
                        className={row.selected ? 'bg-brand-50/40 dark:bg-brand-900/10' : 'bg-white dark:bg-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-700/20'}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) => selectRow(row.id, e.target.checked)}
                            className="rounded border-gray-300 text-brand-600"
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs align-top pt-4">{row.id}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 align-top max-w-[220px]">
                          <div className="break-words leading-relaxed text-xs">{row.original}</div>
                        </td>
                        <td className="px-4 py-3 align-top max-w-[280px]">
                          {isLoading ? (
                            <div className="flex items-center gap-2 text-gray-400 py-1 text-xs">
                              <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                              Đang hiệu đính…
                            </div>
                          ) : (
                            <textarea
                              value={row.translated}
                              onChange={(e) => editRow(row.id, e.target.value)}
                              rows={Math.max(2, Math.ceil(row.translated.length / 48))}
                              className={`w-full px-2 py-1.5 text-sm border rounded-lg resize-none bg-transparent focus:outline-none text-gray-900 dark:text-gray-100 ${
                                row.status === 'ai-proofread' ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10'
                                : row.status === 'edited' ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10'
                                : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-brand-400'
                              }`}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 align-top pt-4">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td className="px-4 py-3 align-top pt-3.5">
                          <button
                            type="button"
                            disabled={isLoading || batchLoading}
                            onClick={() => proofreadRow(row.id)}
                            className="text-xs text-green-600 dark:text-green-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            AI Hiệu Đính
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
