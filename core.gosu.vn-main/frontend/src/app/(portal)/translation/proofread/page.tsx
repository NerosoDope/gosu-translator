'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { useToastContext } from '@/context/ToastContext';
import { proofreadAPI, translateAPI, languageAPI, jobAPI } from '@/lib/api';
import { authStore } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

type RowStatus = 'original' | 'edited' | 'ai-proofread' | 'loading';

interface ProofreadRow {
  id: number;
  original: string;
  translated: string;
  status: RowStatus;
  selected: boolean;
}

interface ColumnPair {
  originalCol: string;
  translatedCol: string;
}

interface LanguageItem {
  id: number;
  code: string;
  name: string;
}

type PageStep = 'upload' | 'mapping' | 'editing';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function autoDetectPairs(columns: string[]): ColumnPair[] {
  const pairs: ColumnPair[] = [];
  const set = new Set(columns);
  for (const col of columns) {
    if (set.has(`${col}_translated`)) {
      pairs.push({ originalCol: col, translatedCol: `${col}_translated` });
    }
  }
  return pairs;
}

const STATUS_BADGE: Record<RowStatus, { label: string; cls: string }> = {
  original:       { label: 'Gốc',          cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  edited:         { label: 'Đã sửa',       cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  'ai-proofread': { label: 'AI Hiệu Đính', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  loading:        { label: 'Đang xử lý…',  cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
};

const BATCH_SIZE = 10;

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProofreadFilePage() {
  const toast = useToastContext();

  const [step, setStep] = useState<PageStep>('upload');

  // Upload
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsed
  const [allColumns, setAllColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [parsing, setParsing] = useState(false);

  // Mapping
  const [detectedPairs, setDetectedPairs] = useState<ColumnPair[]>([]);
  const [selectedPairIdx, setSelectedPairIdx] = useState(0);
  const [manualOrigCol, setManualOrigCol] = useState('');
  const [manualTransCol, setManualTransCol] = useState('');
  const [useManual, setUseManual] = useState(false);

  // Language
  const [sourceLang, setSourceLang] = useState('');
  const [targetLang, setTargetLang] = useState('');
  const [langOptions, setLangOptions] = useState<LanguageItem[]>([]);
  const [langLocked, setLangLocked] = useState(false);

  // Editing
  const [rows, setRows] = useState<ProofreadRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectAll, setSelectAll] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [saveToJobLoading, setSaveToJobLoading] = useState(false);

  // Find & replace
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  // Computed
  const editedCount = rows.filter((r) => r.status === 'edited').length;
  const aiCount = rows.filter((r) => r.status === 'ai-proofread').length;
  const selectedCount = rows.filter((r) => r.selected).length;

  useEffect(() => {
    try {
      const stored = localStorage.getItem('gosu_last_file_lang_pair');
      if (stored) {
        const { source, target } = JSON.parse(stored);
        if (source && target) {
          setSourceLang(source);
          setTargetLang(target);
          setLangLocked(true);
        }
      }
    } catch { /* noop */ }
    languageAPI.getList({ limit: 100, is_active: true })
      .then((res: any) => setLangOptions(res?.data?.items ?? []))
      .catch(() => {});
  }, []);

  // ── File ──────────────────────────────────────────────────────────────────

  const pickFile = useCallback((f: File) => {
    const ext = f.name.toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.csv')) {
      toast.error('Chỉ chấp nhận file .xlsx, .xls hoặc .csv');
      return;
    }
    setFile(f);
  }, [toast]);

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  }, [pickFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
    e.target.value = '';
  };

  // ── Parse ─────────────────────────────────────────────────────────────────

  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    try {
      const res = await proofreadAPI.parseFileFull(file);
      const { columns, rows: parsedRows, total } = res.data;
      if (!columns.length) { toast.error('Không đọc được cột trong file.'); return; }
      setAllColumns(columns);
      setRawRows(parsedRows);
      const pairs = autoDetectPairs(columns);
      setDetectedPairs(pairs);
      setSelectedPairIdx(0);
      setUseManual(pairs.length === 0);
      if (pairs.length === 0) {
        setManualOrigCol(columns[0] ?? '');
        setManualTransCol(columns[1] ?? '');
      }
      toast.success(`Đã đọc ${total} dòng từ file.`);
      setStep('mapping');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Không thể đọc file. Vui lòng thử lại.');
    } finally {
      setParsing(false);
    }
  };

  // ── Build rows ────────────────────────────────────────────────────────────

  const handleBuildRows = () => {
    const pair: ColumnPair = useManual
      ? { originalCol: manualOrigCol, translatedCol: manualTransCol }
      : detectedPairs[selectedPairIdx];
    if (!pair?.originalCol || !pair?.translatedCol) { toast.error('Vui lòng chọn cột gốc và cột đã dịch.'); return; }
    const built: ProofreadRow[] = rawRows
      .map((r, i) => ({ id: i + 1, original: r[pair.originalCol] ?? '', translated: r[pair.translatedCol] ?? '', status: 'original' as RowStatus, selected: false }))
      .filter((r) => r.original.trim() !== '');
    setRows(built);
    setStep('editing');
  };

  // ── Inline edit ───────────────────────────────────────────────────────────

  const handleEdit = (id: number, value: string) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, translated: value, status: r.status === 'loading' ? 'loading' : 'edited' } : r));
  };

  // ── Find & Replace ────────────────────────────────────────────────────────

  const handleReplace = () => {
    if (!findText.trim()) { toast.error('Nhập nội dung cần tìm.'); return; }
    const hasSelection = rows.some((r) => r.selected);
    const scope = hasSelection ? rows.filter((r) => r.selected) : rows;
    const count = scope.filter((r) => r.translated.includes(findText)).length;
    if (count === 0) {
      toast.error(
        hasSelection
          ? `Không tìm thấy "${findText}" trong ${scope.length} dòng đã chọn.`
          : `Không tìm thấy "${findText}" trong cột bản dịch.`
      );
      return;
    }
    const scopeIds = new Set(scope.map((r) => r.id));
    setRows((prev) =>
      prev.map((r) =>
        scopeIds.has(r.id) && r.translated.includes(findText)
          ? { ...r, translated: r.translated.split(findText).join(replaceText), status: 'edited' }
          : r
      )
    );
    toast.success(
      hasSelection
        ? `Đã thay thế ${count} dòng trong ${scope.length} dòng đã chọn.`
        : `Đã thay thế ${count} dòng.`
    );
  };

  // ── Per-row AI proofread ───────────────────────────────────────────────────

  const handleProofreadRow = async (id: number) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (!sourceLang || !targetLang) {
      toast.error('Vui lòng chọn ngôn ngữ nguồn và ngôn ngữ đích trước khi hiệu đính.');
      return;
    }
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, status: 'loading' } : r));
    try {
      const res = await proofreadAPI.proofreadRow({ original: row.original, translated: row.translated, source_lang: sourceLang, target_lang: targetLang });
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, translated: res.data.proofread, status: 'ai-proofread' } : r));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Hiệu đính AI thất bại.');
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, status: 'original' } : r));
    }
  };

  // ── Batch AI proofread ────────────────────────────────────────────────────

  const handleProofreadBatch = async () => {
    const targets = rows.filter((r) => r.selected && r.status !== 'loading');
    if (!targets.length) { toast.error('Chọn ít nhất 1 dòng để hiệu đính batch.'); return; }
    if (!sourceLang || !targetLang) {
      toast.error('Vui lòng chọn ngôn ngữ nguồn và ngôn ngữ đích trước khi hiệu đính.');
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
  };

  // ── Select ────────────────────────────────────────────────────────────────

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  const handleSelectRow = (id: number, checked: boolean) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, selected: checked } : r));
    if (!checked) setSelectAll(false);
  };

  // ── Lưu vào Jobs ──────────────────────────────────────────────────────────

  const handleSaveToJob = async () => {
    if (!rows.length) {
      toast.error('Chưa có dữ liệu để lưu.');
      return;
    }
    let user;
    try {
      user = await authStore.getCurrentUser();
    } catch {
      toast.error('Vui lòng đăng nhập để lưu vào Jobs.');
      return;
    }
    if (!user?.id) {
      toast.error('Vui lòng đăng nhập để lưu vào Jobs.');
      return;
    }
    setSaveToJobLoading(true);
    try {
      const jobCode = `PROOFREAD-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const payload = {
        rows: rows.map((r) => ({ id: r.id, original: r.original, translated: r.translated, status: r.status })),
        source_lang: sourceLang || undefined,
        target_lang: targetLang || undefined,
        filename: file?.name ?? undefined,
        total_rows: rows.length,
      };
      await jobAPI.create({
        job_code: jobCode,
        job_type: 'proofread',
        status: 'completed',
        progress: 100,
        user_id: user.id,
        source_lang: sourceLang || null,
        target_lang: targetLang || null,
        payload,
        result: { total_rows: rows.length, saved_at: new Date().toISOString() },
      });
      toast.success('Đã lưu kết quả hiệu đính vào Jobs. Bạn có thể xem tại trang Công việc của tôi.');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Không thể lưu vào Jobs. Vui lòng thử lại.');
    } finally {
      setSaveToJobLoading(false);
    }
  };

  // ── Download ──────────────────────────────────────────────────────────────

  const handleDownload = async (format: 'xlsx' | 'csv') => {
    if (!rows.length) return;
    try {
      const res = await translateAPI.exportFile({
        columns: ['#', 'Văn bản gốc', 'Bản dịch hiệu đính'],
        rows: rows.map((r) => ({ '#': String(r.id), 'Văn bản gốc': r.original, 'Bản dịch hiệu đính': r.translated })),
        format,
        filename: file ? file.name.replace(/\.[^.]+$/, '') + '_proofread' : 'proofread',
      });
      const blob = new Blob([res.data as unknown as BlobPart], {
        type: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file?.name.replace(/\.[^.]+$/, '') ?? 'proofread'}_proofread.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Không thể xuất file. Vui lòng thử lại.');
    }
  };

  // ── Filtered rows ─────────────────────────────────────────────────────────

  const filteredRows = search.trim()
    ? rows.filter((r) => r.original.toLowerCase().includes(search.toLowerCase()) || r.translated.toLowerCase().includes(search.toLowerCase()))
    : rows;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Hiệu Đính</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tải lên file đã dịch để hiệu đính và cải thiện bản dịch bằng AI.
          </p>
        </div>
      </div>

      {/* ── STEP INDICATOR ─────────────────────────────────────────────────── */}
      {(() => {
        const PROOF_STEPS = [
          { id: 'upload'  as PageStep, label: 'Tải Lên'   },
          { id: 'mapping' as PageStep, label: 'Cấu Hình'  },
          { id: 'editing' as PageStep, label: 'Hiệu Đính' },
        ];
        const ORDER: Record<PageStep, number> = { upload: 1, mapping: 2, editing: 3 };
        return (
          <div className="flex items-center w-full">
            {PROOF_STEPS.map((s, i) => {
              const isCompleted = ORDER[step] > ORDER[s.id];
              const isActive    = step === s.id;
              return (
                <React.Fragment key={s.id}>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                      isCompleted ? 'bg-green-500 text-white dark:bg-green-600'
                      : isActive  ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                    }`}>
                      {i + 1}
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{s.label}</span>
                  </div>
                  {i < PROOF_STEPS.length - 1 && (
                    <div className={`flex-1 min-w-[8px] h-0.5 mx-1 rounded ${
                      isCompleted ? 'bg-green-400 dark:bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        );
      })()}

      {/* ── STEP 1: Upload ─────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tải Lên File Đã Dịch</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            File cần có ít nhất 2 cột: cột văn bản gốc và cột bản dịch. Hệ thống tự động phát hiện cặp cột theo chuẩn{' '}
            <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs font-mono">tên_cột</code> +{' '}
            <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs font-mono">tên_cột_translated</code>.
            Nếu không có sẽ phải chọn thủ công.
          </p>

          <div
            onDrop={handleFileDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors select-none ${
              isDragging ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/10' : 'border-gray-300 dark:border-gray-600 hover:border-brand-400 dark:hover:border-brand-500 bg-gray-50 dark:bg-gray-900/20'
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileInput} className="hidden" />
            <div className="flex flex-col items-center gap-3">
              <svg className="w-12 h-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {file ? (
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{file.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">Kéo thả file vào đây hoặc nhấn để chọn</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Hỗ trợ .xlsx, .xls, .csv — tối đa 500 dòng</p>
                </div>
              )}
            </div>
          </div>

          {file && (
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setFile(null)}>Đổi File</Button>
              <Button onClick={handleParse} isLoading={parsing} disabled={parsing}>Đọc File & Tiếp Tục</Button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Column Mapping ─────────────────────────────────────────── */}
      {step === 'mapping' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cấu Hình Cột Hiệu Đính</h2>
            <button onClick={() => setStep('upload')} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1">
              ← Đổi file
            </button>
          </div>

          {/* Column pair */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Chọn cặp cột Gốc / Đã dịch</h3>
            {detectedPairs.length > 0 && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                Phát hiện {detectedPairs.length} cặp cột tự động
              </p>
            )}
            {detectedPairs.map((pair, idx) => (
              <label key={idx} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${!useManual && selectedPairIdx === idx ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                <input type="radio" name="pair" checked={!useManual && selectedPairIdx === idx} onChange={() => { setSelectedPairIdx(idx); setUseManual(false); }} className="text-brand-600" />
                <span className="text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{pair.originalCol}</span>
                  <span className="mx-2 text-gray-400">→</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{pair.translatedCol}</span>
                </span>
              </label>
            ))}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${useManual ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
              <input type="radio" name="pair" checked={useManual} onChange={() => setUseManual(true)} className="text-brand-600 mt-0.5" />
              <div className="flex-1 space-y-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Chọn thủ công</span>
                {useManual && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Cột văn bản gốc *</label>
                      <select value={manualOrigCol} onChange={(e) => setManualOrigCol(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                        <option value="">Chọn cột…</option>
                        {allColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Cột bản dịch *</label>
                      <select value={manualTransCol} onChange={(e) => setManualTransCol(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                        <option value="">Chọn cột…</option>
                        {allColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </label>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">Tổng {rawRows.length} dòng sẽ được tải vào bảng hiệu đính.</p>

          <div className="flex justify-end">
            <Button onClick={handleBuildRows}>Bắt đầu Hiệu Đính →</Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Editing ────────────────────────────────────────────────── */}
      {step === 'editing' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">

          {/* ── Panel header ──────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Trình Hiệu Đính</h2>
              {file && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {file.name} &bull; {rows.length} dòng
                  {editedCount > 0 && <span className="ml-2 text-amber-600 dark:text-amber-400">{editedCount} đã sửa thủ công</span>}
                  {aiCount > 0 && <span className="ml-2 text-green-600 dark:text-green-400">{aiCount} AI hiệu đính</span>}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('mapping')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Đổi cột
              </button>
              <label className="px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                Tải Lên File Mới
                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) { pickFile(f); setStep('upload'); } e.target.value = ''; }} className="hidden" />
              </label>
              <Button
                variant="secondary"
                isLoading={saveToJobLoading}
                disabled={saveToJobLoading || rows.length === 0}
                onClick={handleSaveToJob}
                title="Lưu kết quả hiệu đính vào danh sách Công việc của tôi"
              >
                <svg className="w-4 h-4 mr-1.5 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Lưu vào Jobs
              </Button>
              <Button onClick={() => handleDownload('xlsx')}>
                <svg className="w-4 h-4 mr-1.5 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Tải Xuống File Đã Hiệu Đính
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleDownload('csv')}>CSV</Button>
            </div>
          </div>

          {/* ── Language row ──────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end gap-4 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ngôn Ngữ Nguồn *</label>
              {langLocked ? (
                <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                  <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  <span>{langOptions.find((l) => l.code === sourceLang)?.name ?? sourceLang} <span className="text-gray-400">({sourceLang})</span></span>
                </div>
              ) : (
                <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">Chọn ngôn ngữ nguồn</option>
                  {langOptions.map((l) => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
                </select>
              )}
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ngôn Ngữ Đích *</label>
              {langLocked ? (
                <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                  <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  <span>{langOptions.find((l) => l.code === targetLang)?.name ?? targetLang} <span className="text-gray-400">({targetLang})</span></span>
                </div>
              ) : (
                <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="">Chọn ngôn ngữ đích</option>
                  {langOptions.map((l) => <option key={l.code} value={l.code}>{l.name} ({l.code})</option>)}
                </select>
              )}
            </div>
            {langLocked && (
              <button
                type="button"
                onClick={() => { setLangLocked(false); try { localStorage.removeItem('gosu_last_file_lang_pair'); } catch { /* noop */ } }}
                className="mb-0.5 text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                Thay đổi ngôn ngữ
              </button>
            )}
          </div>

          {/* ── Toolbar row ───────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input type="text" placeholder="Tìm kiếm…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-64" />
            </div>
          </div>

          {/* ── Find & Replace row ────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Nội dung cần thay thế…"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleReplace()}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[160px] max-w-xs"
              />
              <input
                type="text"
                placeholder="Nội dung thay thế…"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleReplace()}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[160px] max-w-xs"
              />
              <Button size="sm" variant="secondary" onClick={handleReplace}>
                {selectedCount > 0 ? `Replace (${selectedCount} dòng đã chọn)` : 'Replace tất cả'}
              </Button>
              {(findText || replaceText) && (
                <button type="button" onClick={() => { setFindText(''); setReplaceText(''); }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Xóa</button>
              )}
            </div>
            {selectedCount > 0 && (
              <Button size="sm" isLoading={batchLoading} disabled={batchLoading} onClick={handleProofreadBatch}>
                AI Hiệu Đính {selectedCount} dòng đã chọn
              </Button>
            )}
          </div>

          {/* ── Table ─────────────────────────────────────────────────────── */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={selectAll} onChange={(e) => handleSelectAll(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-brand-600" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-12">DÒNG</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">GỐC</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">ĐÃ DỊCH</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-28">TRẠNG THÁI</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-28">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500 text-sm">
                      {search ? 'Không tìm thấy dòng nào phù hợp.' : 'Chưa có dữ liệu.'}
                    </td>
                  </tr>
                )}
                {filteredRows.map((row) => {
                  const badge = STATUS_BADGE[row.status];
                  const isLoading = row.status === 'loading';
                  return (
                    <tr key={row.id} className={`transition-colors ${row.selected ? 'bg-brand-50/40 dark:bg-brand-900/10' : 'bg-white dark:bg-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-700/20'}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={row.selected} onChange={(e) => handleSelectRow(row.id, e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-brand-600" />
                      </td>
                      <td className="px-4 py-3 text-gray-400 dark:text-gray-500 font-mono text-xs tabular-nums align-top pt-4">{row.id}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 align-top max-w-[260px]">
                        <div className="break-words leading-relaxed text-xs">{row.original}</div>
                      </td>
                      <td className="px-4 py-3 align-top max-w-[300px]">
                        {isLoading ? (
                          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 py-1">
                            <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span className="text-xs">Đang hiệu đính…</span>
                          </div>
                        ) : (
                          <textarea
                            value={row.translated}
                            onChange={(e) => handleEdit(row.id, e.target.value)}
                            rows={Math.max(2, Math.ceil(row.translated.length / 48))}
                            className={`w-full px-2 py-1.5 text-sm border rounded-lg resize-none transition-colors bg-transparent focus:outline-none text-gray-900 dark:text-gray-100 ${
                              row.status === 'ai-proofread'
                                ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10 focus:border-green-400 dark:focus:border-green-600'
                                : row.status === 'edited'
                                ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 focus:border-amber-400'
                                : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-brand-400 dark:focus:border-brand-500 focus:bg-white dark:focus:bg-gray-900'
                            }`}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 align-top pt-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top pt-3.5">
                        <button
                          type="button"
                          disabled={isLoading || batchLoading}
                          onClick={() => handleProofreadRow(row.id)}
                          className="text-xs text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
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

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {editedCount + aiCount > 0 ? (
                <>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{editedCount + aiCount}</span> dòng đã cải thiện
                  <span className="text-gray-400 mx-1">·</span>
                  <span className="text-amber-600 dark:text-amber-400">{editedCount} thủ công</span>
                  <span className="text-gray-400 mx-1">·</span>
                  <span className="text-green-600 dark:text-green-400">{aiCount} AI</span>
                </>
              ) : (
                'Chưa có dòng nào được chỉnh sửa.'
              )}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                isLoading={saveToJobLoading}
                disabled={saveToJobLoading || rows.length === 0}
                onClick={handleSaveToJob}
              >
                <svg className="w-4 h-4 mr-1.5 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Lưu vào Jobs
              </Button>
              <Button onClick={() => handleDownload('xlsx')}>
                <svg className="w-4 h-4 mr-1.5 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Tải Xuống .xlsx
              </Button>
              <Button variant="secondary" onClick={() => handleDownload('csv')}>Tải Xuống .csv</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
