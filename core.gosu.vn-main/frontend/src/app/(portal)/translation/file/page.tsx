'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import { useToastContext } from '@/context/ToastContext';
import { translateAPI, languageAPI, gameAPI, gameCategoryAPI, promptsAPI, proofreadAPI } from '@/lib/api';
import type { TranslateStreamProgressEvent } from '@/lib/api';
import { getLanguageNameVi } from '@/lib/languageNamesVi';

// ── Step-5 Proofread types ────────────────────────────────────────────────────
type S5Status = 'original' | 'edited' | 'ai-proofread' | 'loading';
interface S5Row { id: number; original: string; translated: string; status: S5Status; selected: boolean; }
const S5_BADGE: Record<S5Status, { label: string; cls: string }> = {
  original:       { label: 'Gốc',          cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  edited:         { label: 'Đã sửa',       cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  'ai-proofread': { label: 'AI Hiệu Đính', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  loading:        { label: 'Đang xử lý…',  cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
};
const S5_BATCH = 10;

const STEPS = [
  { id: 1, label: 'Tải Lên' },
  { id: 2, label: 'Xem Trước' },
  { id: 3, label: 'Cấu Hình' },
  { id: 4, label: 'Tiến Trình' },
  { id: 5, label: 'Kết Quả' },
];

interface LanguageItem {
  id: number;
  code: string;
  name: string;
  is_active?: boolean;
}

interface LanguagePairItem {
  id: number;
  source_language: LanguageItem;
  target_language: LanguageItem;
  is_bidirectional?: boolean;
  is_active?: boolean;
}

export default function TranslationFilePage() {
  const toast = useToastContext();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>({});
  const [sourceLang, setSourceLang] = useState('');
  const [targetLang, setTargetLang] = useState('');
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<TranslateStreamProgressEvent | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Ngôn ngữ nguồn từ Quản lý ngôn ngữ */
  const [sourceLanguageOptions, setSourceLanguageOptions] = useState<LanguageItem[]>([]);
  /** Map sourceCode -> danh sách ngôn ngữ đích (từ cặp ngôn ngữ) */
  const [targetOptionsBySource, setTargetOptionsBySource] = useState<Record<string, LanguageItem[]>>({});
  const [loadingLangAndPairs, setLoadingLangAndPairs] = useState(true);
  /** File JSON: đã dịch → step 5 hiển thị thông báo */
  const [jsonTranslatedDone, setJsonTranslatedDone] = useState(false);
  /** Nội dung JSON đã dịch (string) để xem trước + tải về */
  const [translatedJsonContent, setTranslatedJsonContent] = useState<string | null>(null);
  /** File XML: đã dịch → step 5 hiển thị thông báo */
  const [xmlTranslatedDone, setXmlTranslatedDone] = useState(false);
  /** Khi dịch file JSON theo cột: cấu trúc gốc với chỉ cột đã dịch thay đổi (backend trả translated_json) */
  const [translatedJsonStructure, setTranslatedJsonStructure] = useState<Record<string, unknown> | null>(null);
  /** File DOCX đã dịch giữ cấu trúc (base64 từ backend) để tải về */
  const [translatedDocxB64, setTranslatedDocxB64] = useState<string | null>(null);
  /** Nội dung XML đã dịch (bước 5 xem trước + nút Tải File) */
  const [translatedXmlContent, setTranslatedXmlContent] = useState<string | null>(null);

  // ── Step-5 Proofread state ────────────────────────────────────────────────
  const [s5Rows, setS5Rows] = useState<S5Row[]>([]);
  const [s5OrigCol, setS5OrigCol] = useState('');
  const [s5TransCol, setS5TransCol] = useState('');
  const [s5Search, setS5Search] = useState('');
  const [s5SelectAll, setS5SelectAll] = useState(false);
  const [s5BatchLoading, setS5BatchLoading] = useState(false);
  const [s5FindText, setS5FindText] = useState('');
  const [s5ReplaceText, setS5ReplaceText] = useState('');
  const [s5ProofMode, setS5ProofMode] = useState(false);

  // ── Config Step 3 ────────────────────────────────────────────────────────
  const [translateStyle, setTranslateStyle] = useState('');
  const [translateContext, setTranslateContext] = useState('');
  const [promptId, setPromptId] = useState<number | null>(null);
  const [gameId, setGameId] = useState<number | null>(null);
  const [gameCategoryId, setGameCategoryId] = useState<number | null>(null);

  // Dropdown data
  const [gameOptions, setGameOptions] = useState<{ id: number; name: string }[]>([]);
  const STYLE_OPTIONS = ['Tự nhiên, mượt mà', 'Sát nghĩa, giữ cấu trúc', 'Đầy đủ, chi tiết', 'Ngắn gọn, súc tích', 'Văn phong trang trọng'];
  const [gameCategoryOptions, setGameCategoryOptions] = useState<{ id: number; name: string }[]>([]);
  const [promptOptions, setPromptOptions] = useState<{ id: number; name: string }[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);


  const acceptTypes = '.xlsx,.csv,.json,.xml,.docx';
  const maxSizeMB = 50;
  const isJsonFile = (file?.name ?? '').toLowerCase().endsWith('.json');
  const isXmlFile = (file?.name ?? '').toLowerCase().endsWith('.xml');
  // JSON và XML là tree structure → auto-detect, không cần chọn cột
  const isTreeFile = isJsonFile || isXmlFile;

  useEffect(() => {
    let mounted = true;
    Promise.all([
      languageAPI.getList({ limit: 100, is_active: true }),
      languageAPI.getPairs({ limit: 100, is_active: true }),
    ])
      .then(([langRes, pairsRes]: any[]) => {
        if (!mounted) return;
        const langItems: LanguageItem[] = langRes?.data?.items ?? [];
        const pairItems: LanguagePairItem[] = pairsRes?.data?.items ?? [];
        setSourceLanguageOptions(langItems.map((l) => ({ id: l.id, code: l.code, name: l.name })));
        const bySource: Record<string, LanguageItem[]> = {};
        for (const p of pairItems) {
          const src = p.source_language;
          const tgt = p.target_language;
          if (!src?.code || !tgt?.code) continue;
          if (!bySource[src.code]) bySource[src.code] = [];
          if (!bySource[src.code].some((l) => l.code === tgt.code)) {
            bySource[src.code].push({ id: tgt.id, code: tgt.code, name: tgt.name });
          }
          if (p.is_bidirectional) {
            if (!bySource[tgt.code]) bySource[tgt.code] = [];
            if (!bySource[tgt.code].some((l) => l.code === src.code)) {
              bySource[tgt.code].push({ id: src.id, code: src.code, name: src.name });
            }
          }
        }
        setTargetOptionsBySource(bySource);
      })
      .catch(() => {
        if (mounted) {
          setSourceLanguageOptions([]);
          setTargetOptionsBySource({});
        }
      })
      .finally(() => {
        if (mounted) setLoadingLangAndPairs(false);
      });

    // Fetch config dropdown data
    // gameAPI       → AxiosResponse: .data = { data: [...], total, ... }
    // gameCategoryAPI → AxiosResponse: .data = { items: [...] }
    // promptsAPI    → already unwrapped: returns { data: [...], total, ... }
    Promise.all([
      gameAPI.getList({ limit: 100, is_active: true }).catch(() => null),
      gameCategoryAPI.getList({ limit: 100 }).catch(() => null),
      promptsAPI.getList({ limit: 100, is_active: true }).catch(() => null),
    ]).then(([gRes, gcRes, pRes]: any[]) => {
      if (!mounted) return;
      setGameOptions((gRes?.data?.data ?? []).map((g: any) => ({ id: g.id, name: g.name })));
      setGameCategoryOptions((gcRes?.data?.items ?? []).map((c: any) => ({ id: c.id, name: c.name })));

      const prompts = (pRes?.data ?? []).map((p: any) => ({ id: p.id, name: p.name }));
      setPromptOptions(prompts);
      // Auto-select prompt "Dịch nội dung" làm mặc định
    }).finally(() => {
      if (mounted) setLoadingConfig(false);
    });

    return () => { mounted = false; };
  }, []);

  const targetOptions = targetOptionsBySource[sourceLang] ?? [];

  const handleSourceLangChange = (newSource: string) => {
    setSourceLang(newSource);
    const allowed = targetOptionsBySource[newSource] ?? [];
    setTargetLang((prev) => (allowed.some((l) => l.code === prev) ? prev : ''));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.size <= maxSizeMB * 1024 * 1024) {
      setFile(f);
      setStep(1);
    } else {
      toast.error(`File tối đa ${maxSizeMB} MB`);
    }
  }, [toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.size <= maxSizeMB * 1024 * 1024) {
      setFile(f);
    } else if (f) {
      toast.error(`File tối đa ${maxSizeMB} MB`);
    }
    e.target.value = '';
  };

  const goToNextStep = async () => {
    if (!file) {
      toast.error('Vui lòng chọn file trước.');
      return;
    }
    const name = file.name.toLowerCase();
    const allowed = ['.xlsx', '.csv', '.json', '.xml', '.docx'];
    if (!allowed.some((ext) => name.endsWith(ext))) {
      toast.error('Chỉ hỗ trợ file .xlsx, .csv, .json, .xml, .docx.');
      return;
    }
    // Tất cả định dạng: parse file → Step 2 (xem trước)
    setLoading(true);
    try {
      const res = await translateAPI.parseFile(file);
      const data = (res as any)?.data?.data ?? (res as any)?.data ?? {};
      const cols = Array.isArray(data?.columns) ? data.columns : [];
      const rows = Array.isArray(data?.preview_rows) ? data.preview_rows : [];
      setColumns(cols);
      setPreviewRows(rows);
      setPreviewHtml(typeof data?.preview_html === 'string' ? data.preview_html : null);
      setSelectedColumns(cols.reduce((acc: Record<string, boolean>, c: string) => ({ ...acc, [c]: false }), {}));
      setStep(2);
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? err.message ?? 'Không thể đọc file.';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = Object.values(selectedColumns).filter(Boolean).length;
  // JSON/XML: không cần chọn cột → luôn cho qua; CSV/XLSX/DOCX: cần chọn ít nhất 1
  const canGoStep3 = isTreeFile || selectedCount > 0;
  // Step 3: cần chọn đủ ngôn ngữ nguồn + đích và khác nhau
  const canStartTranslate = !!sourceLang && !!targetLang && sourceLang !== targetLang && !!promptId && !loading;

  /** Tải file kết quả dịch. Với JSON: nếu có translatedJsonStructure thì tải bản giữ cấu trúc gốc, chỉ cột đã dịch thay đổi. */
  const downloadTranslatedFile = useCallback(
    async (rows: Record<string, string>[], columns: string[]) => {
      const name = (file?.name || '').toLowerCase();
      const baseName = file?.name?.replace(/\.[^.]+$/, '') || 'dich';
      if (name.endsWith('.json') && translatedJsonStructure) {
        try {
          const jsonStr = JSON.stringify(translatedJsonStructure, null, 2);
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${baseName}_translated.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success('Đã tải file (giữ cấu trúc).');
        } catch (err: any) {
          toast.error('Tải file thất bại.');
        }
        return;
      }
      if (name.endsWith('.docx') && translatedDocxB64) {
        try {
          const binary = atob(translatedDocxB64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${baseName}_translated.docx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success('Đã tải file (giữ cấu trúc).');
        } catch (err: any) {
          toast.error('Tải file thất bại.');
        }
        return;
      }
      if (!columns.length || !rows.length) return;
      const allowedExt = ['.xlsx', '.csv', '.json', '.xml', '.docx'];
      const ext = allowedExt.find((e) => name.endsWith(e));
      const fmt = ext ? ext.slice(1) : 'csv';
      try {
        const res = await translateAPI.exportFile({
          columns,
          rows,
          format: fmt,
          filename: baseName,
        });
        const blob = res.data as Blob;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_translated.${fmt}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Đã tải file.');
      } catch (err: any) {
        const msg = err.response?.data ?? err.message ?? 'Tải file thất bại.';
        toast.error(typeof msg === 'string' ? msg : 'Tải file thất bại.');
      }
    },
    [file?.name, toast, translatedJsonStructure, translatedDocxB64]
  );

  // ── Step-5 helpers ────────────────────────────────────────────────────────

  /** Build S5Rows từ previewRows khi dịch file xong. */
  const buildS5Rows = useCallback((rows: Record<string, string>[]) => {
    const firstRow = rows[0] || {};
    let origCol = '', transCol = '';
    for (const k of Object.keys(firstRow)) {
      if (k.endsWith('_translated')) {
        const orig = k.replace(/_translated$/, '');
        if (firstRow[orig] !== undefined) { origCol = orig; transCol = k; break; }
      }
    }
    if (!origCol) return;
    setS5OrigCol(origCol);
    setS5TransCol(transCol);
    setS5Rows(
      rows
        .map((r, i) => ({ id: i + 1, original: r[origCol] ?? '', translated: r[transCol] ?? '', status: 'original' as S5Status, selected: false }))
        .filter((r) => r.original.trim() !== '')
    );
    setS5Search(''); setS5SelectAll(false); setS5FindText(''); setS5ReplaceText(''); setS5ProofMode(false);
  }, []);

  const s5Edit = (id: number, value: string) =>
    setS5Rows((prev) => prev.map((r) => r.id === id ? { ...r, translated: value, status: r.status === 'loading' ? 'loading' : 'edited' } : r));

  const s5ProofreadRow = async (id: number) => {
    const row = s5Rows.find((r) => r.id === id);
    if (!row || !sourceLang || !targetLang) { if (!sourceLang || !targetLang) toast.error('Vui lòng chọn ngôn ngữ để dùng AI hiệu đính.'); return; }
    setS5Rows((prev) => prev.map((r) => r.id === id ? { ...r, status: 'loading' } : r));
    try {
      const res = await proofreadAPI.proofreadRow({ original: row.original, translated: row.translated, source_lang: sourceLang, target_lang: targetLang });
      setS5Rows((prev) => prev.map((r) => r.id === id ? { ...r, translated: res.data.proofread, status: 'ai-proofread' } : r));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Hiệu đính AI thất bại.');
      setS5Rows((prev) => prev.map((r) => r.id === id ? { ...r, status: 'original' } : r));
    }
  };

  const s5ProofreadBatch = async () => {
    if (!sourceLang || !targetLang) { toast.error('Vui lòng chọn ngôn ngữ để dùng AI hiệu đính.'); return; }
    const targets = s5Rows.filter((r) => r.selected && r.status !== 'loading');
    if (!targets.length) { toast.error('Chọn ít nhất 1 dòng để hiệu đính batch.'); return; }
    setS5Rows((prev) => prev.map((r) => r.selected ? { ...r, status: 'loading' } : r));
    setS5BatchLoading(true);
    try {
      for (let i = 0; i < targets.length; i += S5_BATCH) {
        const chunk = targets.slice(i, i + S5_BATCH);
        const res = await proofreadAPI.proofreadBatch({ items: chunk.map((r) => ({ index: r.id, original: r.original, translated: r.translated })), source_lang: sourceLang, target_lang: targetLang });
        const map: Record<number, string> = {};
        for (const item of res.data.results) map[item.index] = item.proofread;
        setS5Rows((prev) => prev.map((r) => map[r.id] !== undefined ? { ...r, translated: map[r.id], status: 'ai-proofread', selected: false } : r));
      }
      toast.success(`Đã hiệu đính ${targets.length} dòng bằng AI.`);
      setS5SelectAll(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Hiệu đính batch thất bại.');
      setS5Rows((prev) => prev.map((r) => r.status === 'loading' ? { ...r, status: 'original' } : r));
    } finally { setS5BatchLoading(false); }
  };

  const s5Replace = () => {
    if (!s5FindText.trim()) { toast.error('Nhập nội dung cần tìm.'); return; }
    const hasSelection = s5Rows.some((r) => r.selected);
    const scope = hasSelection ? s5Rows.filter((r) => r.selected) : s5Rows;
    const count = scope.filter((r) => r.translated.includes(s5FindText)).length;
    if (count === 0) {
      toast.error(hasSelection ? `Không tìm thấy "${s5FindText}" trong ${scope.length} dòng đã chọn.` : `Không tìm thấy "${s5FindText}" trong cột bản dịch.`);
      return;
    }
    const scopeIds = new Set(scope.map((r) => r.id));
    setS5Rows((prev) => prev.map((r) => scopeIds.has(r.id) && r.translated.includes(s5FindText) ? { ...r, translated: r.translated.split(s5FindText).join(s5ReplaceText), status: 'edited' } : r));
    toast.success(hasSelection ? `Đã thay thế ${count} dòng trong ${scope.length} dòng đã chọn.` : `Đã thay thế ${count} dòng.`);
  };

  const s5SelectAllFn = (checked: boolean) => { setS5SelectAll(checked); setS5Rows((prev) => prev.map((r) => ({ ...r, selected: checked }))); };
  const s5SelectRow = (id: number, checked: boolean) => { setS5Rows((prev) => prev.map((r) => r.id === id ? { ...r, selected: checked } : r)); if (!checked) setS5SelectAll(false); };

  const s5Download = async (format: 'xlsx' | 'csv') => {
    if (!s5Rows.length) return;
    try {
      const baseName = file?.name?.replace(/\.[^.]+$/, '') ?? 'proofread';
      const res = await translateAPI.exportFile({
        columns: [s5OrigCol, s5TransCol],
        rows: s5Rows.map((r) => ({ [s5OrigCol]: r.original, [s5TransCol]: r.translated })),
        format,
        filename: baseName + '_proofread',
      });
      const blob = new Blob([res.data as unknown as BlobPart], { type: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${baseName}_proofread.${format}`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Không thể xuất file.'); }
  };

  const s5EditedCount = s5Rows.filter((r) => r.status === 'edited').length;
  const s5AiCount = s5Rows.filter((r) => r.status === 'ai-proofread').length;
  const s5SelectedCount = s5Rows.filter((r) => r.selected).length;
  const s5Filtered = s5Search.trim() ? s5Rows.filter((r) => r.original.toLowerCase().includes(s5Search.toLowerCase()) || r.translated.toLowerCase().includes(s5Search.toLowerCase())) : s5Rows;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dịch File</h1>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Tải lên và dịch file với nhiều định dạng (Excel, CSV, JSON, XML)
      </p>

      {/* Stepper: màu theo tiến trình - đã qua (xanh lá), hiện tại (xanh dương), chưa tới (xám) */}
      <div className="flex items-center w-full">
        {STEPS.map((s, i) => {
          const isCompleted = step > s.id;
          const isActive = step === s.id;
          return (
            <React.Fragment key={s.id}>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    isCompleted
                      ? 'bg-green-500 text-white dark:bg-green-600'
                      : isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {s.id}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 min-w-[8px] h-0.5 mx-1 rounded ${
                    isCompleted ? 'bg-green-400 dark:bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tải lên File</h2>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="relative border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center bg-gray-100 dark:bg-gray-800/50 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {/* Cloud upload icon - large, light grey */}
            <svg className="w-14 h-14 mx-auto text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-base font-semibold text-gray-700 dark:text-gray-300">Kéo thả file vào đây</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">hoặc click để chọn file</p>
            <input
              type="file"
              accept={acceptTypes}
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-xl"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
              Hỗ trợ: .xlsx, .csv, .json, .xml, .docx (Tối đa {maxSizeMB} MB)
            </p>
            {file && (
              <p className="mt-2 text-sm text-green-600 dark:text-green-400 font-medium">
                Đã chọn: {file.name}
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={goToNextStep} disabled={!file || loading}>
              {loading ? 'Đang xử lý...' : 'Tiếp theo'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Xem trước + (chỉ CSV/XLSX/DOCX) chọn cột */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isTreeFile ? 'Xem Trước Nội Dung' : 'Xem Trước & Chọn Cột'}
          </h2>

          {/* ── Chọn cột: chỉ hiện với CSV/XLSX/DOCX ── */}
          {!isTreeFile && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Chọn cột cần dịch</p>
                <button
                  type="button"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  onClick={() => {
                    const all = columns.every((c) => selectedColumns[c]);
                    setSelectedColumns(columns.reduce((acc, c) => ({ ...acc, [c]: !all }), {}));
                  }}
                >
                  {columns.every((c) => selectedColumns[c]) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {columns.map((col) => (
                  <label
                    key={col}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-colors ${
                      selectedColumns[col]
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns[col] ?? false}
                      onChange={(e) => setSelectedColumns((prev) => ({ ...prev, [col]: e.target.checked }))}
                      className="sr-only"
                    />
                    {col}
                  </label>
                ))}
              </div>
              {selectedCount > 0 && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">Đã chọn {selectedCount} cột để dịch</p>
              )}
            </div>
          )}

          {/* ── Badge thông tin cho JSON/XML ── */}
          {isTreeFile && (
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { label: 'Auto-detect strings', color: 'green' },
                { label: 'Giữ nguyên cấu trúc', color: 'blue' },
                { label: 'Bỏ qua values kỹ thuật', color: 'gray' },
                { label: 'Bảo toàn placeholder', color: 'purple' },
              ].map(({ label, color }) => (
                <span key={label} className={`px-2 py-1 rounded-full font-medium
                  ${color === 'green' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : ''}
                  ${color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : ''}
                  ${color === 'gray' ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' : ''}
                  ${color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : ''}
                `}>
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* ── Preview nội dung ── */}
          {columns.length > 0 && (
            previewHtml ? (
              /* DOCX paragraph mode: render HTML giữ nguyên formatting */
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
                <p className="text-sm text-gray-500 dark:text-gray-400 px-4 pt-3 pb-1">
                  Xem trước nội dung (giữ nguyên định dạng)
                </p>
                <div
                  className="px-5 py-3 max-h-80 overflow-y-auto text-sm text-gray-900 dark:text-gray-100
                    [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1
                    [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1
                    [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-0.5
                    [&_p]:my-1 [&_p]:leading-relaxed
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1
                    [&_li]:my-0.5 [&_strong]:font-semibold [&_em]:italic [&_u]:underline"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            ) : (
              /* Bảng dữ liệu (mọi định dạng) */
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400 px-4 pt-3 pb-1">
                  Xem trước ({previewRows.length} dòng đầu tiên)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50">
                        {columns.map((col) => (
                          <th key={col} className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap border-b border-gray-200 dark:border-gray-700">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500 italic text-xs">
                            Không có dữ liệu xem trước
                          </td>
                        </tr>
                      ) : (
                        previewRows.map((row, i) => (
                          <tr key={i} className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            {columns.map((col) => (
                              <td key={col} className="px-4 py-2 text-gray-800 dark:text-gray-200 max-w-[240px] truncate text-xs" title={String(row[col] ?? '')}>
                                {row[col] ?? ''}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>Quay lại</Button>
            <Button onClick={() => setStep(3)} disabled={!canGoStep3}>Tiếp theo</Button>
          </div>
        </div>
      )}

      {/* Step 3: Cấu hình */}
      {step === 3 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cấu hình Dịch thuật</h2>

          {/* Info banner cho JSON/XML */}
          {isTreeFile && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 flex gap-3 items-start">
              <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p className="font-medium">
                  {isJsonFile ? 'Chế độ dịch JSON tự động' : 'Chế độ dịch XML tự động'}
                </p>
                <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-0.5 list-disc pl-4">
                  <li>Tự động phát hiện và dịch tất cả chuỗi văn bản</li>
                  <li>Giữ nguyên cấu trúc, key, số, boolean, null</li>
                  <li>Bỏ qua URL, email, version, code (ALL_CAPS, camelCase)</li>
                  <li>Bảo toàn placeholder: {'{variable}'}, %s, %1$s</li>
                  {isXmlFile && <li>Tuân thủ thuộc tính translatable="false"</li>}
                </ul>
              </div>
            </div>
          )}

          {/* ── Ngôn ngữ ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ngôn ngữ nguồn <span className="text-red-500">*</span>
              </label>
              <select
                value={sourceLang}
                onChange={(e) => handleSourceLangChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                disabled={loadingLangAndPairs}
              >
                <option value="">Chọn ngôn ngữ nguồn</option>
                {sourceLanguageOptions.map((l) => (
                  <option key={l.id} value={l.code}>{getLanguageNameVi(l.code, l.name)}</option>
                ))}
              </select>
              {sourceLanguageOptions.length === 0 && !loadingLangAndPairs && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Chưa có ngôn ngữ nào. Vào Quản lý Ngôn ngữ để thêm.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ngôn ngữ đích <span className="text-red-500">*</span>
              </label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                disabled={loadingLangAndPairs || !sourceLang}
              >
                <option value="">Chọn ngôn ngữ đích</option>
                {targetOptions.map((l) => (
                  <option key={l.id} value={l.code}>{getLanguageNameVi(l.code, l.name)}</option>
                ))}
              </select>
              {sourceLang !== '' && targetOptions.length === 0 && !loadingLangAndPairs && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Không có cặp dịch cho ngôn ngữ này. Vào Quản lý Ngôn ngữ → Cặp ngôn ngữ để tạo.
                </p>
              )}
            </div>
          </div>

          {/* ── Phong cách dịch thuật ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phong cách dịch thuật <span className="text-xs text-gray-400 font-normal">(Tùy chọn)</span>
            </label>
            <select
              value={translateStyle}
              onChange={(e) => setTranslateStyle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              disabled={loadingConfig}
            >
              <option value="">-- Chọn phong cách dịch --</option>
              {STYLE_OPTIONS.map((style) => (
                <option key={style} value={style}>{style}</option>
              ))}
            </select>
          </div>

          {/* ── Ngữ cảnh ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ngữ cảnh <span className="text-xs text-gray-400 font-normal">(Tùy chọn)</span>
            </label>
            <textarea
              value={translateContext}
              onChange={(e) => setTranslateContext(e.target.value)}
              rows={3}
              placeholder='Thêm ngữ cảnh để cải thiện chất lượng dịch thuật...'
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Cung cấp ngữ cảnh về nội dung (ví dụ: "Văn bản Game UI", "Hội thoại nhân vật")</p>
          </div>

          {/* ── Từ Điển Game + Thể loại Game Từ điển Chung ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Từ Điển Game <span className="text-xs text-gray-400 font-normal">(Tùy chọn)</span>
              </label>
              <select
                value={gameId ?? ''}
                onChange={(e) => setGameId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                disabled={loadingConfig}
              >
                <option value="">Chọn game (tùy chọn)</option>
                {gameOptions.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              {!loadingConfig && gameOptions.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Chưa có game nào. Vui lòng tạo game trước khi sử dụng tính năng này.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Thể loại Game Từ điển Chung <span className="text-xs text-gray-400 font-normal">(Tùy chọn)</span>
              </label>
              <select
                value={gameCategoryId ?? ''}
                onChange={(e) => setGameCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                disabled={loadingConfig}
              >
                <option value="">Chọn thể loại game (tùy chọn)</option>
                {gameCategoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Prompt Dịch thuật ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Prompt Dịch thuật <span className="text-red-500 ml-0.5">*</span>
            </label>
            <select
              value={promptId ?? ''}
              onChange={(e) => setPromptId(e.target.value ? Number(e.target.value) : null)}
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm ${
                !promptId
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              disabled={loadingConfig}
            >
              <option value="">-- Chọn prompt --</option>
              {promptOptions.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
            {!promptId && !loadingConfig && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">Vui lòng chọn prompt dịch thuật.</p>
            )}
          </div>

          <div className="flex justify-between pt-1">
            {/* JSON/XML: back to Step 1; CSV/XLSX/DOCX: back to Step 2 */}
            <Button variant="secondary" onClick={() => setStep(isTreeFile ? 1 : 2)}>Quay lại</Button>
            <Button
              onClick={async () => {
                if (!file || !sourceLang || !targetLang || sourceLang === targetLang) return;
                // ── JSON: auto-detect, structure-preserving, smart filter ──────
                if (isJsonFile) {
                  setStep(4);
                  setLoading(true);
                  setJsonTranslatedDone(false);
                  setXmlTranslatedDone(false);
                  setTranslatedJsonContent(null);
                  try {
                    const res = await translateAPI.translateJsonFile({
                      file,
                      source_lang: sourceLang,
                      target_lang: targetLang,
                      smart_filter: true,
                      translate_keys: false,
                      prompt_id: promptId,
                      context: translateContext || null,
                      style: translateStyle || null,
                      game_id: gameId,
                      game_category_id: gameCategoryId,
                    });
                    const blob = res.data as Blob;
                    const rawText = await blob.text();
                    // Format JSON để hiển thị đẹp
                    let formatted = rawText;
                    try { formatted = JSON.stringify(JSON.parse(rawText), null, 2); } catch { /* noop */ }
                    setTranslatedJsonContent(formatted);
                    setJsonTranslatedDone(true);
                    try { localStorage.setItem('gosu_last_file_lang_pair', JSON.stringify({ source: sourceLang, target: targetLang })); } catch { /* noop */ }
                    setStep(5);
                    toast.success('Dịch JSON xong. Xem trước bên dưới.');
                  } catch (err: any) {
                    const msg = err.response?.data?.detail ?? err.message ?? 'Dịch file thất bại.';
                    toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                    setStep(3);
                  } finally {
                    setLoading(false);
                  }
                  return;
                }
                // ── XML: auto-detect, structure-preserving, smart filter ──────
                if (isXmlFile) {
                  setStep(4);
                  setLoading(true);
                  setJsonTranslatedDone(false);
                  setXmlTranslatedDone(false);
                  setTranslatedXmlContent(null);
                  try {
                    const res = await translateAPI.translateXmlFile({
                      file,
                      source_lang: sourceLang,
                      target_lang: targetLang,
                      preserve_placeholders: true,
                      respect_translatable: true,
                      smart_filter: true,
                      prompt_id: promptId,
                      context: translateContext || null,
                      style: translateStyle || null,
                      game_id: gameId,
                      game_category_id: gameCategoryId,
                    });
                    const blob = res.data as Blob;
                    const xmlText = await blob.text();
                    setTranslatedXmlContent(xmlText);
                    setXmlTranslatedDone(true);
                    try { localStorage.setItem('gosu_last_file_lang_pair', JSON.stringify({ source: sourceLang, target: targetLang })); } catch { /* noop */ }
                    setStep(5);
                    toast.success('Dịch XML xong. Xem trước bên dưới và tải file nếu cần.');
                  } catch (err: any) {
                    const msg = err.response?.data?.detail ?? err.message ?? 'Dịch file thất bại.';
                    toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                    setStep(3);
                  } finally {
                    setLoading(false);
                  }
                  return;
                }
                // ── CSV/XLSX/DOCX: column-based translation ──────────────────
                const colsToTranslate = columns.filter((c) => selectedColumns[c]);
                if (colsToTranslate.length === 0) {
                  toast.error('Vui lòng chọn ít nhất một cột cần dịch.');
                  return;
                }
                setStep(4);
                setLoading(true);
                setProgress(null);
                setJsonTranslatedDone(false);
                setXmlTranslatedDone(false);
                abortRef.current = new AbortController();
                try {
                  const done = await translateAPI.translateFileStream(
                    {
                      file,
                      selected_columns: colsToTranslate,
                      source_lang: sourceLang,
                      target_lang: targetLang,
                      prompt_id: promptId,
                      context: translateContext || null,
                      style: translateStyle || null,
                      game_id: gameId,
                      game_category_id: gameCategoryId,
                    },
                    (event) => {
                      if (event.type === 'progress') setProgress(event as TranslateStreamProgressEvent);
                    },
                    abortRef.current.signal,
                  );
                  const doneRows = done.rows ?? [];
                  setPreviewRows(doneRows);
                  setTranslatedJsonStructure(done.translated_json ?? null);
                  setTranslatedDocxB64(done.translated_docx_b64 ?? null);
                  setProgress(null);
                  buildS5Rows(doneRows);
                  try { localStorage.setItem('gosu_last_file_lang_pair', JSON.stringify({ source: sourceLang, target: targetLang })); } catch { /* noop */ }
                  setStep(5);
                  toast.success('Dịch file hoàn tất.');
                } catch (err: any) {
                  if (err?.name === 'AbortError') {
                    toast.error('Đã hủy dịch.');
                    setStep(3);
                  } else {
                    const msg = err?.message ?? 'Dịch file thất bại.';
                    toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                  }
                } finally {
                  setLoading(false);
                  abortRef.current = null;
                }
              }}
              disabled={!canStartTranslate}
            >
              Bắt đầu Dịch thuật
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Tiến trình */}
      {step === 4 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tiến Trình Dịch Thuật</h2>

          {/* JSON/XML: spinner đơn giản (không có batch progress) */}
          {isTreeFile ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <svg className="animate-spin w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Đang phân tích cấu trúc và dịch tất cả chuỗi văn bản...
                <br />
                <span className="text-xs text-gray-400 dark:text-gray-500">Smart Filter đang lọc và bảo toàn giá trị kỹ thuật</span>
              </p>
            </div>
          ) : (
            <>
          {/* Phase label */}
          {!progress ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span>Đang tra cứu Cache & Từ điển...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span>Đang gọi AI (Gemini)...</span>
            </div>
          )}

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>
                {progress
                  ? `Batch ${progress.batch_done}/${progress.batch_total} · ${progress.done}/${progress.total} segment`
                  : 'Khởi tạo...'}
              </span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {progress ? `${progress.percent}%` : '0%'}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progress ? progress.percent : 0}%`,
                  background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)',
                }}
              />
            </div>
          </div>

          {/* Batch detail cards */}
          {progress && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Segment đã dịch', value: `${progress.done} / ${progress.total}` },
                { label: 'Batch đã gửi', value: `${progress.batch_done} / ${progress.batch_total}` },
                { label: 'Segment/batch', value: String(progress.batch_size) },
                { label: 'Token ước tính', value: `~${progress.batch_tokens}` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Nhiều dòng được gộp thành 1 batch để giảm chi phí API. Vui lòng không đóng trang này.
          </p>

          <div className="flex justify-start">
            <Button
              variant="secondary"
              onClick={() => { abortRef.current?.abort(); }}
              disabled={!loading}
            >
              Hủy
            </Button>
          </div>
            </>
          )}
        </div>
      )}

      {/* Step 5: Xem trước kết quả dịch - hoặc thông báo đã dịch JSON (giữ cấu trúc) */}
      {step === 5 && (() => {
        const resetAll = () => {
          setStep(1); setFile(null); setPreviewRows([]); setPreviewHtml(null);
          setJsonTranslatedDone(false); setXmlTranslatedDone(false);
          setTranslatedJsonStructure(null); setTranslatedJsonContent(null);
          setTranslatedDocxB64(null); setTranslatedXmlContent(null);
        };

        if (jsonTranslatedDone) {
          const baseName = file?.name?.replace(/\.[^.]+$/, '') || 'translated';
          const downloadJsonFile = () => {
            if (!translatedJsonContent) return;
            const blob = new Blob([translatedJsonContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${baseName}_translated.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('Đã tải file JSON.');
          };
          const copyToClipboard = () => {
            if (!translatedJsonContent) return;
            navigator.clipboard.writeText(translatedJsonContent)
              .then(() => toast.success('Đã sao chép nội dung JSON.'))
              .catch(() => toast.error('Không thể sao chép.'));
          };
          // Đếm số key đã dịch (lines with ":")
          const lineCount = translatedJsonContent ? translatedJsonContent.split('\n').length : 0;
          return (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Kết Quả Dịch JSON</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Cấu trúc gốc được bảo toàn · Chỉ dịch value chuỗi · Smart Filter đã áp dụng
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full px-3 py-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Dịch hoàn tất
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'File gốc', value: file?.name ?? '—', sub: 'JSON' },
                  { label: 'Tổng dòng', value: String(lineCount), sub: 'dòng' },
                  { label: 'Ngôn ngữ', value: `${sourceLang} → ${targetLang}`, sub: 'Đích' },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-center">
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5 truncate" title={value}>{value}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</p>
                  </div>
                ))}
              </div>

              {/* JSON Preview */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-gray-600 dark:text-gray-300">{baseName}_translated.json</span>
                    <span className="text-[10px] text-gray-400 bg-gray-200 dark:bg-gray-700 rounded px-1.5 py-0.5">JSON</span>
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Sao chép
                  </button>
                </div>
                <div className="overflow-auto max-h-[420px] bg-gray-50 dark:bg-gray-900/60 p-4">
                  <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all font-mono leading-relaxed">
                    {translatedJsonContent ?? ''}
                  </pre>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={downloadJsonFile}
                  disabled={!translatedJsonContent}
                >
                  <svg className="w-4 h-4 mr-1.5 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Tải File
                </Button>
                <Button variant="secondary" onClick={copyToClipboard} disabled={!translatedJsonContent}>
                  <svg className="w-4 h-4 mr-1.5 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Sao chép JSON
                </Button>
                <Button variant="secondary" onClick={() => setStep(3)}>
                  <svg className="w-4 h-4 mr-1.5 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Dịch Lại
                </Button>
                <Button variant="secondary" onClick={resetAll}>
                  Dịch thuật Mới
                </Button>
              </div>
            </div>
          );
        }
        if (xmlTranslatedDone) {
          const baseName = file?.name?.replace(/\.[^.]+$/, '') || 'dich';
          const downloadXmlFile = () => {
            if (!translatedXmlContent) return;
            const blob = new Blob([translatedXmlContent], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${baseName}_translated.xml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('Đã tải file XML.');
          };
          return (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Xem trước Dịch thuật (XML)</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Đã dịch file XML giữ cấu trúc (chỉ text trong thẻ, giữ placeholder). Xem nội dung bên dưới và tải file nếu cần.
              </p>
              {translatedXmlContent && (
                <div className="overflow-auto max-h-[400px] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
                  <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all font-mono">
                    {translatedXmlContent}
                  </pre>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="secondary"
                  onClick={downloadXmlFile}
                  disabled={!translatedXmlContent}
                >
                  Tải File
                </Button>
                <Button variant="secondary" onClick={() => setStep(3)}>Dịch Lại</Button>
                <Button variant="secondary" onClick={resetAll}>
                  Dịch thuật Mới
                </Button>
              </div>
            </div>
          );
        }
        const firstRow = previewRows[0] || {};
        const displayColumns: string[] = [];
        Object.keys(firstRow).forEach((k) => {
          if (k.endsWith('_translated')) { const orig = k.replace(/_translated$/, ''); displayColumns.push(orig, k); }
        });

        // ── Chế độ preview (mặc định) ──────────────────────────────────────
        if (!s5ProofMode) {
          return (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Xem trước Dịch thuật</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Đã dịch {previewRows.length} dòng. Cột gốc và cột _translated (bản dịch).
              </p>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      {displayColumns.map((k) => (
                        <th key={k} className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                        {displayColumns.map((k) => (
                          <td key={k} className="px-4 py-2 text-gray-900 dark:text-gray-100 max-w-[200px] truncate align-top" title={row[k] ?? ''}>{row[k] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setS5ProofMode(true)}>Hiệu Đính</Button>
                <Button variant="secondary" onClick={() => downloadTranslatedFile(previewRows, displayColumns)} disabled={displayColumns.length === 0 || previewRows.length === 0}>
                  Tải File
                </Button>
                <Button variant="secondary" onClick={resetAll}>Dịch thuật Mới</Button>
              </div>
            </div>
          );
        }

        // ── Chế độ hiệu đính ───────────────────────────────────────────────
        return (
        <div className="space-y-4">
          {/* ── Header ── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Hiệu Đính Kết Quả</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {s5Rows.length} dòng
                {s5EditedCount > 0 && <span className="ml-2 text-amber-600 dark:text-amber-400">&bull; {s5EditedCount} đã sửa</span>}
                {s5AiCount > 0 && <span className="ml-2 text-green-600 dark:text-green-400">&bull; {s5AiCount} AI hiệu đính</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setS5ProofMode(false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                Xem trước
              </button>
              <Button variant="secondary" onClick={resetAll}>Dịch Mới</Button>
            </div>
          </div>

          {/* ── Language (for AI proofread) ── */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ngôn Ngữ Nguồn (AI hiệu đính)</label>
              <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">Chọn ngôn ngữ…</option>
                {sourceLanguageOptions.map((l) => <option key={l.id} value={l.code}>{getLanguageNameVi(l.code, l.name)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ngôn Ngữ Đích (AI hiệu đính)</label>
              <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">Chọn ngôn ngữ…</option>
                {(targetOptionsBySource[sourceLang] ?? sourceLanguageOptions).map((l) => <option key={l.id} value={l.code}>{getLanguageNameVi(l.code, l.name)}</option>)}
              </select>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input type="text" placeholder="Tìm kiếm…" value={s5Search} onChange={(e) => setS5Search(e.target.value)} className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-64" />
            </div>
          </div>

          {/* ── Find & Replace ── */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex flex-wrap items-center gap-2">
              <input type="text" placeholder="Nội dung cần thay thế…" value={s5FindText} onChange={(e) => setS5FindText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && s5Replace()} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[140px] max-w-xs" />
              <input type="text" placeholder="Nội dung thay thế…" value={s5ReplaceText} onChange={(e) => setS5ReplaceText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && s5Replace()} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[140px] max-w-xs" />
              <Button size="sm" variant="secondary" onClick={s5Replace}>
                {s5SelectedCount > 0 ? `Replace (${s5SelectedCount} dòng đã chọn)` : 'Replace tất cả'}
              </Button>
              {(s5FindText || s5ReplaceText) && <button type="button" onClick={() => { setS5FindText(''); setS5ReplaceText(''); }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Xóa</button>}
            </div>
            {s5SelectedCount > 0 && (
              <Button size="sm" isLoading={s5BatchLoading} disabled={s5BatchLoading} onClick={s5ProofreadBatch}>
                AI Hiệu Đính {s5SelectedCount} dòng đã chọn
              </Button>
            )}
          </div>

          {/* ── Table ── */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={s5SelectAll} onChange={(e) => s5SelectAllFn(e.target.checked)} className="rounded border-gray-300 text-brand-600" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-10">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">GỐC</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">ĐÃ DỊCH</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-28">TRẠNG THÁI</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-24">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {s5Filtered.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">{s5Search ? 'Không tìm thấy kết quả.' : 'Chưa có dữ liệu.'}</td></tr>
                  )}
                  {s5Filtered.map((row) => {
                    const badge = S5_BADGE[row.status];
                    const isLoading = row.status === 'loading';
                    return (
                      <tr key={row.id} className={`transition-colors ${row.selected ? 'bg-brand-50/40 dark:bg-brand-900/10' : 'bg-white dark:bg-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-700/20'}`}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={row.selected} onChange={(e) => s5SelectRow(row.id, e.target.checked)} className="rounded border-gray-300 text-brand-600" />
                        </td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs align-top pt-4">{row.id}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 align-top max-w-[220px]">
                          <div className="break-words leading-relaxed text-xs">{row.original}</div>
                        </td>
                        <td className="px-4 py-3 align-top max-w-[280px]">
                          {isLoading ? (
                            <div className="flex items-center gap-2 text-gray-400 py-1 text-xs">
                              <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                              Đang hiệu đính…
                            </div>
                          ) : (
                            <textarea
                              value={row.translated}
                              onChange={(e) => s5Edit(row.id, e.target.value)}
                              rows={Math.max(2, Math.ceil(row.translated.length / 48))}
                              className={`w-full px-2 py-1.5 text-sm border rounded-lg resize-none transition-colors bg-transparent focus:outline-none text-gray-900 dark:text-gray-100 ${
                                row.status === 'ai-proofread' ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10'
                                : row.status === 'edited' ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10'
                                : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-brand-400 focus:bg-white dark:focus:bg-gray-900'
                              }`}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 align-top pt-4">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td className="px-4 py-3 align-top pt-3.5">
                          <button type="button" disabled={isLoading || s5BatchLoading} onClick={() => s5ProofreadRow(row.id)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                            AI Hiệu Đính
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Footer download ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {s5EditedCount + s5AiCount > 0 ? (
                <><span className="font-medium text-gray-900 dark:text-gray-100">{s5EditedCount + s5AiCount}</span> dòng đã cải thiện &bull; <span className="text-amber-600 dark:text-amber-400">{s5EditedCount} thủ công</span> &bull; <span className="text-green-600 dark:text-green-400">{s5AiCount} AI</span></>
              ) : 'Tải xuống hoặc chỉnh sửa trước khi tải.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => s5Download('xlsx')}>
                <svg className="w-4 h-4 mr-1.5 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Tải File .xlsx
              </Button>
              <Button variant="secondary" onClick={() => s5Download('csv')}>Tải File .csv</Button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
