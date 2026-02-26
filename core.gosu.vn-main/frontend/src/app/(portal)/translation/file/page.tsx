'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { useToastContext } from '@/context/ToastContext';
import { translateAPI, languageAPI } from '@/lib/api';
import { getLanguageNameVi } from '@/lib/languageNamesVi';

const STEPS = [
  { id: 1, label: 'Tải Lên' },
  { id: 2, label: 'Chọn Cột' },
  { id: 3, label: 'Cấu Hình' },
  { id: 4, label: 'Tiến Trình' },
  { id: 5, label: 'Xem Trước' },
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
  /** Ngôn ngữ nguồn từ Quản lý ngôn ngữ */
  const [sourceLanguageOptions, setSourceLanguageOptions] = useState<LanguageItem[]>([]);
  /** Map sourceCode -> danh sách ngôn ngữ đích (từ cặp ngôn ngữ) */
  const [targetOptionsBySource, setTargetOptionsBySource] = useState<Record<string, LanguageItem[]>>({});
  const [loadingLangAndPairs, setLoadingLangAndPairs] = useState(true);
  /** File JSON: đã dịch theo chế độ giữ cấu trúc (translate-json-file) → step 5 hiển thị thông báo tải về */
  const [jsonTranslatedDone, setJsonTranslatedDone] = useState(false);
  /** JSON: Smart Filter / dịch key / dịch toàn bộ file — giá trị mặc định, không hiển thị UI */
  const [jsonSmartFilter, setJsonSmartFilter] = useState(true);
  const [jsonTranslateKeys, setJsonTranslateKeys] = useState(false);
  const [jsonStructureMode, setJsonStructureMode] = useState(false);
  /** File XML: đã dịch giữ cấu trúc (translate-xml-file) → step 5 hiển thị thông báo tải về */
  const [xmlTranslatedDone, setXmlTranslatedDone] = useState(false);
  /** XML: placeholder / translatable / smart filter — giá trị mặc định, không hiển thị UI */
  const [xmlPreservePlaceholders, setXmlPreservePlaceholders] = useState(true);
  const [xmlRespectTranslatable, setXmlRespectTranslatable] = useState(true);
  const [xmlSmartFilter, setXmlSmartFilter] = useState(true);
  /** Khi dịch file JSON theo cột: cấu trúc gốc với chỉ cột đã dịch thay đổi (backend trả translated_json) */
  const [translatedJsonStructure, setTranslatedJsonStructure] = useState<Record<string, unknown> | null>(null);
  /** Nội dung XML đã dịch (bước 5 xem trước + nút Tải File) */
  const [translatedXmlContent, setTranslatedXmlContent] = useState<string | null>(null);

  const acceptTypes = '.xlsx,.csv,.json,.xml,.docx';
  const maxSizeMB = 50;
  const isJsonFile = (file?.name ?? '').toLowerCase().endsWith('.json');
  const isXmlFile = (file?.name ?? '').toLowerCase().endsWith('.xml');

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

  const goToStep2 = async () => {
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
    setLoading(true);
    try {
      const res = await translateAPI.parseFile(file);
      const data = (res as any)?.data?.data ?? (res as any)?.data ?? {};
      const cols = Array.isArray(data?.columns) ? data.columns : [];
      const rows = Array.isArray(data?.preview_rows) ? data.preview_rows : [];
      setColumns(cols);
      setPreviewRows(rows);
      const isJsonOrXml = name.endsWith('.json') || name.endsWith('.xml');
      setSelectedColumns(cols.reduce((acc: Record<string, boolean>, c: string) => ({ ...acc, [c]: isJsonOrXml }), {}));
      setStep(2);
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? err.message ?? 'Không thể đọc file.';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = Object.values(selectedColumns).filter(Boolean).length;
  const canGoStep3 = selectedCount > 0;

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
    [file?.name, toast, translatedJsonStructure]
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dịch File</h1>
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 text-sm cursor-help" title="Hướng dẫn">?</span>
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
            <Button onClick={goToStep2} disabled={!file || loading}>
              {loading ? 'Đang xử lý...' : 'Tiếp theo'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Chọn cột */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Chọn Cột</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Chọn các cột cần dịch</p>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
            <div className="flex justify-end mb-2">
              <button
                type="button"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                onClick={() => {
                  const all = columns.every((c) => selectedColumns[c]);
                  setSelectedColumns(columns.reduce((acc, c) => ({ ...acc, [c]: !all }), {}));
                }}
              >
                Chọn tất cả
              </button>
            </div>
            <div className="space-y-2">
              {columns.map((col) => (
                <label key={col} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedColumns[col] ?? false}
                    onChange={(e) => setSelectedColumns((prev) => ({ ...prev, [col]: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{col}</span>
                </label>
              ))}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Đã chọn {selectedCount} cột</p>
          </div>
          {/* Luôn hiển thị bảng xem trước khi đã có cột (kể cả 0 dòng) */}
          {columns.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400 px-4 pt-3 pb-1">
                Xem trước ({previewRows.length} dòng đầu tiên)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      {columns.map((col) => (
                        <th key={col} className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.length === 0 ? (
                      <tr className="border-t border-gray-200 dark:border-gray-700">
                        <td colSpan={columns.length} className="px-4 py-4 text-center text-gray-500 dark:text-gray-400 italic">
                          Không có dòng nào để xem trước
                        </td>
                      </tr>
                    ) : (
                      previewRows.map((row, i) => (
                        <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                          {columns.map((col) => (
                            <td key={col} className="px-4 py-2 text-gray-900 dark:text-gray-100 max-w-[200px] truncate" title={String(row[col] ?? '')}>
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
          )}
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>Quay lại</Button>
            <Button onClick={() => setStep(3)} disabled={!canGoStep3}>Tiếp theo</Button>
          </div>
        </div>
      )}

      {/* Step 3: Cấu hình */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cấu hình Dịch thuật</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ngôn ngữ nguồn <span className="text-red-500">*</span></label>
              <select
                value={sourceLang}
                onChange={(e) => handleSourceLangChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={loadingLangAndPairs}
              >
                <option value="">Chọn ngôn ngữ nguồn</option>
                {sourceLanguageOptions.map((l) => (
                  <option key={l.id} value={l.code}>{getLanguageNameVi(l.code, l.name)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ngôn ngữ đích <span className="text-red-500">*</span></label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={loadingLangAndPairs || !sourceLang}
              >
                <option value="">Chọn ngôn ngữ đích</option>
                {targetOptions.map((l) => (
                  <option key={l.id} value={l.code}>{getLanguageNameVi(l.code, l.name)}</option>
                ))}
              </select>
              {sourceLanguageOptions.length === 0 && !loadingLangAndPairs && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Chưa có ngôn ngữ nào. Vào Quản lý Ngôn ngữ để thêm ngôn ngữ.
                </p>
              )}
              {sourceLang !== '' && targetOptions.length === 0 && !loadingLangAndPairs && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Không có cặp dịch cho ngôn ngữ nguồn đã chọn. Vào Quản lý Ngôn ngữ → Cặp ngôn ngữ để tạo.
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(2)}>Quay lại</Button>
            <Button
              onClick={async () => {
                if (!file) return;
                if (!sourceLang || !targetLang) {
                  toast.error('Vui lòng chọn ngôn ngữ nguồn và ngôn ngữ đích.');
                  return;
                }
                if (sourceLang === targetLang) {
                  toast.error('Ngôn ngữ nguồn và ngôn ngữ đích phải khác nhau.');
                  return;
                }
                if (isJsonFile && jsonStructureMode) {
                  setStep(4);
                  setLoading(true);
                  setJsonTranslatedDone(false);
                  setXmlTranslatedDone(false);
                  try {
                    const res = await translateAPI.translateJsonFile({
                      file,
                      source_lang: sourceLang,
                      target_lang: targetLang,
                      smart_filter: jsonSmartFilter,
                      translate_keys: jsonTranslateKeys,
                    });
                    const blob = res.data as Blob;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = (file.name || 'translated').replace(/\.json$/i, '') + '_translated.json';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    setJsonTranslatedDone(true);
                    setStep(5);
                    toast.success('Dịch JSON xong. File đã tải về.');
                  } catch (err: any) {
                    const msg = err.response?.data?.detail ?? err.message ?? 'Dịch file thất bại.';
                    toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                  } finally {
                    setLoading(false);
                  }
                  return;
                }
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
                      preserve_placeholders: xmlPreservePlaceholders,
                      respect_translatable: xmlRespectTranslatable,
                      smart_filter: xmlSmartFilter,
                    });
                    const blob = res.data as Blob;
                    const xmlText = await blob.text();
                    setTranslatedXmlContent(xmlText);
                    setXmlTranslatedDone(true);
                    setStep(5);
                    toast.success('Dịch XML xong. Xem trước bên dưới và tải file nếu cần.');
                  } catch (err: any) {
                    const msg = err.response?.data?.detail ?? err.message ?? 'Dịch file thất bại.';
                    toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                  } finally {
                    setLoading(false);
                  }
                  return;
                }
                const colsToTranslate = columns.filter((c) => selectedColumns[c]);
                if (colsToTranslate.length === 0) {
                  toast.error('Vui lòng chọn ít nhất một cột cần dịch.');
                  return;
                }
                setStep(4);
                setLoading(true);
                setJsonTranslatedDone(false);
                setXmlTranslatedDone(false);
                try {
                  const res = await translateAPI.translateFile({
                    file,
                    selected_columns: colsToTranslate,
                    source_lang: sourceLang,
                    target_lang: targetLang,
                  });
                  setPreviewRows(res.data?.rows ?? []);
                  setTranslatedJsonStructure(res.data?.translated_json ?? null);
                  setStep(5);
                  toast.success('Dịch file hoàn tất.');
                } catch (err: any) {
                  const msg = err.response?.data?.detail ?? err.message ?? 'Dịch file thất bại.';
                  toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              Bắt đầu Dịch thuật
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Tiến trình (AI đang dịch từng ô) */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tiến Trình</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Đang dịch file bằng AI (Cache → Từ điển → Gemini)... Vui lòng chờ.
          </p>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-600 h-2 rounded-full w-1/3 animate-pulse" />
          </div>
          <div className="flex justify-start">
            <Button variant="secondary" onClick={() => setStep(3)} disabled={loading}>
              Quay lại
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Xem trước kết quả dịch - hoặc thông báo đã dịch JSON (giữ cấu trúc) */}
      {step === 5 && (() => {
        if (jsonTranslatedDone) {
          return (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dịch JSON hoàn tất</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Đã dịch file JSON giữ nguyên cấu trúc (chỉ value chuỗi). File đã tải về. Nếu cần tải lại, thực hiện dịch lại.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setStep(1); setFile(null); setPreviewRows([]); setJsonTranslatedDone(false); setXmlTranslatedDone(false); setTranslatedJsonStructure(null); setTranslatedXmlContent(null); }}>
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
                <Button>Hiệu Đính</Button>
                <Button
                  variant="secondary"
                  onClick={downloadXmlFile}
                  disabled={!translatedXmlContent}
                >
                  Tải File
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStep(1);
                    setFile(null);
                    setPreviewRows([]);
                    setJsonTranslatedDone(false);
                    setXmlTranslatedDone(false);
                    setTranslatedJsonStructure(null);
                    setTranslatedXmlContent(null);
                  }}
                >
                  Dịch thuật Mới
                </Button>
              </div>
            </div>
          );
        }
        const firstRow = previewRows[0] || {};
        const displayColumns: string[] = [];
        Object.keys(firstRow).forEach((k) => {
          if (k.endsWith('_translated')) {
            const orig = k.replace(/_translated$/, '');
            displayColumns.push(orig, k);
          }
        });
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
                    <th key={k} className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                    {displayColumns.map((k) => (
                      <td key={k} className="px-4 py-2 text-gray-900 dark:text-gray-100 max-w-[200px] truncate align-top" title={row[k] ?? ''}>
                        {row[k] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button>Hiệu Đính</Button>
            <Button
              variant="secondary"
              onClick={() => downloadTranslatedFile(previewRows, displayColumns)}
              disabled={displayColumns.length === 0 || previewRows.length === 0}
            >
              Tải File
            </Button>
            <Button variant="secondary" onClick={() => { setStep(1); setFile(null); setPreviewRows([]); setJsonTranslatedDone(false); setXmlTranslatedDone(false); setTranslatedJsonStructure(null); setTranslatedXmlContent(null); }}>
              Dịch thuật Mới
            </Button>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
