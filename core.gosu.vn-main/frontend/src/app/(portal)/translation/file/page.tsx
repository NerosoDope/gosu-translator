'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import { useToastContext } from '@/context/ToastContext';
import { translateAPI, languageAPI, gameAPI, gameCategoryAPI, promptsAPI, proofreadAPI, jobAPI, qualityCheckAPI } from '@/lib/api';
import type { QualityCheckResult } from '@/lib/api';
import { authStore } from '@/lib/auth';
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
  /** Job id khi dịch file (bước 4): tạo lúc bắt đầu, cập nhật completed/cancelled/review/failed khi xong hoặc hủy */
  const translateJobIdRef = useRef<number | null>(null);
  /** Đặt true khi user bấm Hủy (để không chuyển step 5 khi request JSON/XML vẫn hoàn thành sau đó) */
  const translateCancelledByUserRef = useRef(false);
  /** True nếu đã nhận được ít nhất một phần kết quả dịch (vd progress.done > 0) — dùng để phân biệt failed vs review khi lỗi */
  const hasPartialTranslatedContentRef = useRef(false);
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
  /** Nội dung gốc JSON/XML (lưu khi bắt đầu dịch) để bước 5 xem trước cũ vs mới */
  const [originalJsonContent, setOriginalJsonContent] = useState<string | null>(null);
  const [originalXmlContent, setOriginalXmlContent] = useState<string | null>(null);
  /** Chế độ hiệu đính XML: bảng rows theo cột, có thể sửa rồi lưu lại thành XML */
  const [xmlProofreadMode, setXmlProofreadMode] = useState(false);
  const [xmlProofreadRows, setXmlProofreadRows] = useState<Record<string, string>[]>([]);
  const [xmlProofreadColumns, setXmlProofreadColumns] = useState<string[]>([]);
  /** Toàn bộ cột từ XML (để gửi rebuild); hiển thị chỉ dùng xmlProofreadColumns = cột được chọn dịch */
  const [xmlProofreadAllColumns, setXmlProofreadAllColumns] = useState<string[]>([]);
  const [xmlProofreadMeta, setXmlProofreadMeta] = useState<{ root_tag: string; row_tag: string; root_attribs: Record<string, string>; declaration: string } | null>(null);
  const [xmlProofreadLoading, setXmlProofreadLoading] = useState(false);
  const [xmlProofreadSearch, setXmlProofreadSearch] = useState('');
  const [xmlProofreadFind, setXmlProofreadFind] = useState('');
  const [xmlProofreadReplace, setXmlProofreadReplace] = useState('');
  const [xmlProofreadSelectAll, setXmlProofreadSelectAll] = useState(false);
  const [xmlProofreadSelected, setXmlProofreadSelected] = useState<Set<number>>(new Set());
  const [xmlProofreadAiLoadingFlatIndex, setXmlProofreadAiLoadingFlatIndex] = useState<number | null>(null);
  /** Trạng thái từng ô hiệu đính XML (giống Excel): key = `${rowIndex}-${col}` */
  const [xmlProofreadStatus, setXmlProofreadStatus] = useState<Record<string, S5Status>>({});
  const [xmlProofreadBatchLoading, setXmlProofreadBatchLoading] = useState(false);
  /** Xem trước kết quả XML dạng bảng (cột + dòng như Excel), load khi có translatedXmlContent */
  const [xmlPreviewColumns, setXmlPreviewColumns] = useState<string[]>([]);
  const [xmlPreviewRows, setXmlPreviewRows] = useState<Record<string, string>[]>([]);
  const [xmlPreviewLoading, setXmlPreviewLoading] = useState(false);
  /** Hàng gốc XML (parse từ originalXmlContent) để bước 5 so sánh cũ vs mới */
  const [xmlOriginalRows, setXmlOriginalRows] = useState<Record<string, string>[]>([]);
  const [xmlOriginalLoading, setXmlOriginalLoading] = useState(false);
  /** Xem trước JSON bước 5: bảng nội dung cũ vs mới (columns + rows từ parse) */
  const [jsonPreviewColumns, setJsonPreviewColumns] = useState<string[]>([]);
  const [jsonPreviewOrigRows, setJsonPreviewOrigRows] = useState<Record<string, string>[]>([]);
  const [jsonPreviewTransRows, setJsonPreviewTransRows] = useState<Record<string, string>[]>([]);
  const [jsonPreviewLoading, setJsonPreviewLoading] = useState(false);
  /** Chế độ hiệu đính JSON: bảng rows có thể sửa, lưu thay thế translatedJsonContent */
  const [jsonProofreadMode, setJsonProofreadMode] = useState(false);
  const [jsonProofreadRows, setJsonProofreadRows] = useState<Record<string, string>[]>([]);
  const [jsonProofreadColumns, setJsonProofreadColumns] = useState<string[]>([]);
  const [jsonProofreadLoading, setJsonProofreadLoading] = useState(false);
  const [jsonProofreadSearch, setJsonProofreadSearch] = useState('');
  const [jsonProofreadFind, setJsonProofreadFind] = useState('');
  const [jsonProofreadReplace, setJsonProofreadReplace] = useState('');
  const [jsonProofreadSelectAll, setJsonProofreadSelectAll] = useState(false);
  const [jsonProofreadSelected, setJsonProofreadSelected] = useState<Set<number>>(new Set());
  const [jsonProofreadAiLoadingFlatIndex, setJsonProofreadAiLoadingFlatIndex] = useState<number | null>(null);
  /** Trạng thái từng ô hiệu đính JSON (giống Excel): key = `${rowIndex}-${col}` */
  const [jsonProofreadStatus, setJsonProofreadStatus] = useState<Record<string, S5Status>>({});
  const [jsonProofreadBatchLoading, setJsonProofreadBatchLoading] = useState(false);

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
  const [s5SaveJobLoading, setS5SaveJobLoading] = useState(false);

  // ── Step-5 Quality Check state ────────────────────────────────────────────
  const [s5QualityScores, setS5QualityScores] = useState<Record<number, QualityCheckResult>>({});
  const [s5QualityLoading, setS5QualityLoading] = useState(false);
  const [s5QualityExpanded, setS5QualityExpanded] = useState<number | null>(null);
  /** Quality check cho bước 5 JSON — giống Excel: 1 điểm/dòng, key = row id (1-based) */
  const [jsonQualityScores, setJsonQualityScores] = useState<Record<number, QualityCheckResult>>({});
  const [jsonQualityLoading, setJsonQualityLoading] = useState(false);
  const [jsonQualityExpandedRowId, setJsonQualityExpandedRowId] = useState<number | null>(null);
  /** Quality check cho bước 5 XML — giống Excel: 1 điểm/dòng, key = row id (1-based) */
  const [xmlQualityScores, setXmlQualityScores] = useState<Record<number, QualityCheckResult>>({});
  const [xmlQualityLoading, setXmlQualityLoading] = useState(false);
  const [xmlQualityExpandedRowId, setXmlQualityExpandedRowId] = useState<number | null>(null);

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

      const prompts = (pRes?.data ?? []).map((p: any) => ({ id: p.id, name: p.name, is_default: p.is_default }));
      setPromptOptions(prompts);
      const defaultPrompt = prompts.find((p: any) => p.is_default);
      if (defaultPrompt) setPromptId(defaultPrompt.id);
    }).finally(() => {
      if (mounted) setLoadingConfig(false);
    });

    return () => { mounted = false; };
  }, []);

  // Parse XML đã dịch thành bảng (cột + dòng) để xem trước dạng Excel
  useEffect(() => {
    if (!translatedXmlContent?.trim()) {
      setXmlPreviewColumns([]);
      setXmlPreviewRows([]);
      return;
    }
    let cancelled = false;
    setXmlPreviewLoading(true);
    translateAPI
      .parseXmlContent(translatedXmlContent)
      .then((res) => {
        if (cancelled) return;
        const data = res.data as { columns?: string[]; rows?: Record<string, string>[] };
        setXmlPreviewColumns(data.columns ?? []);
        setXmlPreviewRows(data.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setXmlPreviewColumns([]);
          setXmlPreviewRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setXmlPreviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [translatedXmlContent]);

  // Parse XML gốc thành bảng khi có originalXmlContent (bước 5 so sánh cũ / mới)
  useEffect(() => {
    if (!originalXmlContent?.trim()) {
      setXmlOriginalRows([]);
      return;
    }
    let cancelled = false;
    setXmlOriginalLoading(true);
    translateAPI
      .parseXmlContent(originalXmlContent)
      .then((res) => {
        if (cancelled) return;
        const data = res.data as { rows?: Record<string, string>[] };
        setXmlOriginalRows(data.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setXmlOriginalRows([]);
      })
      .finally(() => {
        if (!cancelled) setXmlOriginalLoading(false);
      });
    return () => { cancelled = true; };
  }, [originalXmlContent]);

  // Parse JSON gốc + đã dịch thành bảng khi có translatedJsonContent (bước 5 xem trước cũ vs mới)
  useEffect(() => {
    if (!translatedJsonContent?.trim()) {
      setJsonPreviewColumns([]);
      setJsonPreviewOrigRows([]);
      setJsonPreviewTransRows([]);
      return;
    }
    let cancelled = false;
    setJsonPreviewLoading(true);
    const load = async () => {
      try {
        const [transRes, origRes] = await Promise.all([
          translateAPI.parseJsonContent(translatedJsonContent),
          originalJsonContent?.trim()
            ? translateAPI.parseJsonContent(originalJsonContent)
            : Promise.resolve({ data: { columns: [] as string[], rows: [] as Record<string, string>[] } }),
        ]);
        if (cancelled) return;
        const transData = transRes.data as { columns: string[]; rows: Record<string, string>[] };
        const origData = origRes.data as { columns: string[]; rows: Record<string, string>[] };
        setJsonPreviewColumns(transData.columns ?? []);
        setJsonPreviewTransRows(transData.rows ?? []);
        setJsonPreviewOrigRows(origData.rows ?? []);
      } catch {
        if (!cancelled) {
          setJsonPreviewColumns([]);
          setJsonPreviewOrigRows([]);
          setJsonPreviewTransRows([]);
        }
      } finally {
        if (!cancelled) setJsonPreviewLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [translatedJsonContent, originalJsonContent]);

  // Chạy quality check cho JSON — logic giống Excel: 1 điểm/dòng, dùng cột đầu tiên đã chọn
  useEffect(() => {
    if (
      jsonPreviewOrigRows.length === 0 ||
      jsonPreviewTransRows.length === 0 ||
      jsonPreviewColumns.length === 0 ||
      !sourceLang ||
      !targetLang
    ) {
      setJsonQualityScores({});
      return;
    }
    const colsToScore = columns.filter((c) => selectedColumns[c]).filter((c) => jsonPreviewColumns.includes(c));
    const col = (colsToScore.length > 0 ? colsToScore : jsonPreviewColumns)[0];
    const items: { id: number; original: string; translated: string }[] = [];
    const n = Math.min(jsonPreviewOrigRows.length, jsonPreviewTransRows.length);
    for (let rowIndex = 0; rowIndex < n; rowIndex++) {
      const orig = (jsonPreviewOrigRows[rowIndex] ?? {})[col] ?? '';
      const trans = (jsonPreviewTransRows[rowIndex] ?? {})[col] ?? '';
      if (orig.trim() !== '') {
        items.push({ id: rowIndex + 1, original: orig, translated: trans });
      }
    }
    if (items.length === 0) {
      setJsonQualityScores({});
      return;
    }
    let cancelled = false;
    setJsonQualityLoading(true);
    qualityCheckAPI
      .checkBatch({
        items: items.map((r) => ({
          source: r.original,
          translated: r.translated,
          source_lang: sourceLang,
          target_lang: targetLang,
        })),
      })
      .then((res) => {
        if (cancelled) return;
        const map: Record<number, QualityCheckResult> = {};
        res.data.results.forEach((result, idx) => {
          if (items[idx]) map[items[idx].id] = result;
        });
        setJsonQualityScores(map);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setJsonQualityLoading(false);
      });
    return () => { cancelled = true; };
  }, [jsonPreviewOrigRows, jsonPreviewTransRows, jsonPreviewColumns, columns, selectedColumns, sourceLang, targetLang]);

  // Chạy quality check cho XML — logic giống Excel: 1 điểm/dòng, dùng cột đầu tiên đã chọn
  useEffect(() => {
    if (
      xmlOriginalRows.length === 0 ||
      xmlPreviewRows.length === 0 ||
      xmlPreviewColumns.length === 0 ||
      !sourceLang ||
      !targetLang
    ) {
      setXmlQualityScores({});
      return;
    }
    const colsToScore = columns.filter((c) => selectedColumns[c]).filter((c) => xmlPreviewColumns.includes(c));
    const col = (colsToScore.length > 0 ? colsToScore : xmlPreviewColumns)[0];
    const items: { id: number; original: string; translated: string }[] = [];
    const n = Math.min(xmlOriginalRows.length, xmlPreviewRows.length);
    for (let rowIndex = 0; rowIndex < n; rowIndex++) {
      const orig = (xmlOriginalRows[rowIndex] ?? {})[col] ?? '';
      const trans = (xmlPreviewRows[rowIndex] ?? {})[col] ?? '';
      if (orig.trim() !== '') {
        items.push({ id: rowIndex + 1, original: orig, translated: trans });
      }
    }
    if (items.length === 0) {
      setXmlQualityScores({});
      return;
    }
    let cancelled = false;
    setXmlQualityLoading(true);
    qualityCheckAPI
      .checkBatch({
        items: items.map((r) => ({
          source: r.original,
          translated: r.translated,
          source_lang: sourceLang,
          target_lang: targetLang,
        })),
      })
      .then((res) => {
        if (cancelled) return;
        const map: Record<number, QualityCheckResult> = {};
        res.data.results.forEach((result, idx) => {
          if (items[idx]) map[items[idx].id] = result;
        });
        setXmlQualityScores(map);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setXmlQualityLoading(false);
      });
    return () => { cancelled = true; };
  }, [xmlOriginalRows, xmlPreviewRows, xmlPreviewColumns, columns, selectedColumns, sourceLang, targetLang]);

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

      // Chỉ chọn cột thủ công: mặc định không chọn cột nào
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
  // Mọi định dạng (CSV, XLSX, JSON, XML, DOCX): cần chọn ít nhất 1 cột để dịch
  const canGoStep3 = selectedCount > 0;
  // Step 3: cần chọn đủ ngôn ngữ nguồn + đích và khác nhau
  const canStartTranslate = !!sourceLang && !!targetLang && sourceLang !== targetLang && !loading;

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

  // ── Save to Jobs ──────────────────────────────────────────────────────────

  const s5SaveToJob = useCallback(async (jobType: 'translation') => {
    setS5SaveJobLoading(true);
    try {
      const user = await authStore.getCurrentUser();
      if (!user?.id) { toast.error('Vui lòng đăng nhập để lưu vào Jobs.'); return; }
      const jobCode = `${jobType.toUpperCase()}-FILE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await jobAPI.create({
        job_code: jobCode,
        job_type: jobType,
        status: 'completed',
        progress: 100,
        user_id: user.id,
        source_lang: sourceLang || null,
        target_lang: targetLang || null,
        payload: {
          source_type: 'file',
          filename: file?.name ?? null,
          total_rows: previewRows.length,
          source_lang: sourceLang,
          target_lang: targetLang,
        },
        result: { total_rows: previewRows.length, saved_at: new Date().toISOString() },
      });
      toast.success('Đã lưu vào Jobs. Bạn có thể xem tại trang Công việc của tôi.');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Không thể lưu vào Jobs.');
    } finally {
      setS5SaveJobLoading(false);
    }
  }, [file?.name, sourceLang, targetLang, previewRows.length, toast]);

  // ── Step-5 helpers ────────────────────────────────────────────────────────

  /** Chạy kiểm tra chất lượng hàng loạt cho toàn bộ s5Rows. */
  const s5RunQualityCheck = useCallback(async (rows?: typeof s5Rows) => {
    const targets = rows ?? s5Rows;
    if (!targets.length) { toast.error('Chưa có dòng nào để kiểm tra.'); return; }
    setS5QualityLoading(true);
    try {
      const res = await qualityCheckAPI.checkBatch({
        items: targets.map((r) => ({
          source: r.original,
          translated: r.translated,
          source_lang: sourceLang,
          target_lang: targetLang,
        })),
      });
      const map: Record<number, QualityCheckResult> = {};
      res.data.results.forEach((result, idx) => { map[targets[idx].id] = result; });
      setS5QualityScores((prev) => ({ ...prev, ...map }));
      const { avg_score, retranslate_count } = res.data;
      toast.success(`Kiểm tra xong. Điểm TB: ${avg_score}/100 · ${retranslate_count} dòng cần dịch lại.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Kiểm tra chất lượng thất bại.');
    } finally {
      setS5QualityLoading(false);
    }
  }, [s5Rows, sourceLang, targetLang, toast]);

  /** Build S5Rows từ previewRows khi dịch file xong. */
  const buildS5Rows = useCallback((rows: Record<string, string>[], srcLang?: string, tgtLang?: string, colsSelected?: string[]) => {
    const firstRow = rows[0] || {};
    let origCol = '', transCol = '';

    // Ưu tiên dùng cột được chọn để dịch (tránh nhầm cột _translated có sẵn trong file gốc)
    if (colsSelected && colsSelected.length > 0) {
      for (const col of colsSelected) {
        const trans = col + '_translated';
        if (firstRow[col] !== undefined && firstRow[trans] !== undefined) {
          origCol = col; transCol = trans; break;
        }
      }
    }
    // Fallback: quét các cột kết thúc _translated mà KHÔNG phải cột gốc từ file
    if (!origCol) {
      const selectedSet = new Set(colsSelected ?? []);
      for (const k of Object.keys(firstRow)) {
        if (k.endsWith('_translated')) {
          const orig = k.replace(/_translated$/, '');
          // Chỉ chọn nếu cột gốc tồn tại VÀ không phải cột đã có trong file (hoặc không có danh sách selected)
          if (firstRow[orig] !== undefined && (selectedSet.size === 0 || selectedSet.has(orig))) {
            origCol = orig; transCol = k; break;
          }
        }
      }
    }
    if (!origCol) return;
    setS5OrigCol(origCol);
    setS5TransCol(transCol);
    const newRows = rows
      .map((r, i) => ({ id: i + 1, original: r[origCol] ?? '', translated: r[transCol] ?? '', status: 'original' as S5Status, selected: false }))
      .filter((r) => r.original.trim() !== '');
    setS5Rows(newRows);
    setS5Search(''); setS5SelectAll(false); setS5FindText(''); setS5ReplaceText(''); setS5ProofMode(false);
    setS5QualityScores({}); setS5QualityExpanded(null);

    // Tự động kiểm tra chất lượng ngay sau khi build rows (không qua state để tránh closure stale)
    if (newRows.length > 0) {
      setS5QualityLoading(true);
      qualityCheckAPI.checkBatch({
        items: newRows.map((r) => ({
          source: r.original,
          translated: r.translated,
          source_lang: srcLang ?? '',
          target_lang: tgtLang ?? '',
        })),
      }).then((res) => {
        const map: Record<number, QualityCheckResult> = {};
        res.data.results.forEach((result, idx) => { map[newRows[idx].id] = result; });
        setS5QualityScores(map);
      }).catch(() => {
        // Không làm gián đoạn luồng chính nếu quality check thất bại
      }).finally(() => setS5QualityLoading(false));
    }
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
  const s5QualityCheckedCount = Object.keys(s5QualityScores).length;
  const s5QualityAvg = s5QualityCheckedCount > 0
    ? Math.round(Object.values(s5QualityScores).reduce((a, b) => a + b.score, 0) / s5QualityCheckedCount)
    : null;

  const getScoreBadgeCls = (score: number) => {
    if (score >= 85) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800';
    if (score >= 70) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800';
    if (score >= 60) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800';
  };
  const getSeverityCls = (severity: string) => {
    if (severity === 'critical') return 'text-red-600 dark:text-red-400';
    if (severity === 'major') return 'text-orange-600 dark:text-orange-400';
    return 'text-yellow-600 dark:text-yellow-500';
  };
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

      {/* Step 2: Xem trước + chọn cột (mọi định dạng: CSV, XLSX, JSON, XML, DOCX) */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Xem Trước & Chọn Cột
          </h2>

          {/* ── Chọn cột cần dịch: hiện với mọi định dạng khi có columns ── */}
          {columns.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Chọn cột cần dịch</p>
                <button
                  type="button"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
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
              /* DOCX: render HTML giữ nguyên định dạng */
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
              /* JSON/XML/CSV/XLSX: bảng theo cột (giống nhau) */
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
              Prompt Dịch thuật
            </label>
            <select
              value={promptId ?? ''}
              onChange={(e) => setPromptId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              disabled={loadingConfig}
            >
              <option value="">Prompt mặc định</option>
              {promptOptions.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-between pt-1">
            {/* JSON/XML: back to Step 1; CSV/XLSX/DOCX: back to Step 2 */}
            <Button variant="secondary" onClick={() => setStep(isTreeFile ? 1 : 2)}>Quay lại</Button>
            <Button
              onClick={async () => {
                if (!file || !sourceLang || !targetLang || sourceLang === targetLang) return;
                // ── JSON: dùng translate-file-stream như xlsx/csv, bắt buộc chọn cột ──────
                if (isJsonFile) {
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
                  setTranslatedJsonContent(null);
                  translateJobIdRef.current = null;
                  translateCancelledByUserRef.current = false;
                  hasPartialTranslatedContentRef.current = false;
                  try {
                    const origText = await file.text();
                    setOriginalJsonContent(origText);
                  } catch { /* noop */ }
                  try {
                    const user = await authStore.getCurrentUser();
                    if (user?.id) {
                      const jobRes = await jobAPI.create({
                        job_code: `TRANSLATE-FILE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        job_type: 'translation',
                        status: 'in_progress',
                        progress: 0,
                        user_id: user.id,
                        source_lang: sourceLang,
                        target_lang: targetLang,
                        payload: { source_type: 'file', filename: file?.name ?? null, source_lang: sourceLang, target_lang: targetLang, selected_columns: colsToTranslate },
                      });
                      translateJobIdRef.current = jobRes.data?.id ?? null;
                    }
                  } catch (_) { /* tạo job thất bại vẫn dịch bình thường */ }
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
                        if (event.type === 'progress') {
                          const ev = event as TranslateStreamProgressEvent;
                          setProgress(ev);
                          if (ev.done > 0) hasPartialTranslatedContentRef.current = true;
                        }
                      },
                      abortRef.current.signal,
                    );
                    if (translateCancelledByUserRef.current) return;
                    const translatedJson = done.translated_json ?? null;
                    const formatted = translatedJson != null ? JSON.stringify(translatedJson, null, 2) : '';
                    setTranslatedJsonContent(formatted || null);
                    setJsonTranslatedDone(true);
                    setProgress(null);
                    setPreviewRows(done.rows ?? []);
                    setTranslatedJsonStructure(translatedJson);
                    try { localStorage.setItem('gosu_last_file_lang_pair', JSON.stringify({ source: sourceLang, target: targetLang })); } catch { /* noop */ }
                    setStep(5);
                    toast.success('Dịch file hoàn tất.');
                    if (translateJobIdRef.current != null) {
                      const rows = done.rows ?? [];
                      let totalTranslatable = 0;
                      let sameAsOriginalCount = 0;
                      for (const row of rows) {
                        for (const c of colsToTranslate) {
                          const orig = (row[c] ?? '').trim();
                          const trans = (row[c + '_translated'] ?? '').trim();
                          if (orig !== '') {
                            totalTranslatable++;
                            if (orig === trans) sameAsOriginalCount++;
                          }
                        }
                      }
                      const allReturnedAsOriginal = totalTranslatable > 0 && sameAsOriginalCount === totalTranslatable;
                      const someReturnedAsOriginal = sameAsOriginalCount > 0 && !allReturnedAsOriginal;
                      const finalStatus = allReturnedAsOriginal ? 'failed' : someReturnedAsOriginal ? 'review' : 'completed';
                      const finalResult = { total_rows: rows.length, saved_at: new Date().toISOString() };
                      const errorMsg = allReturnedAsOriginal ? 'Tất cả nội dung dịch đều trả về bản gốc.' : someReturnedAsOriginal ? 'Một số đoạn trả về text gốc, cần xem lại.' : undefined;
                      try {
                        await jobAPI.update(translateJobIdRef.current, {
                          status: finalStatus,
                          progress: 100,
                          result: finalResult,
                          ...(errorMsg ? { error_message: errorMsg } : {}),
                        });
                      } catch { /* noop */ }
                      translateJobIdRef.current = null;
                    }
                  } catch (err: any) {
                    if (err?.name === 'AbortError') {
                      toast.error('Đã hủy dịch.');
                      setStep(3);
                      if (translateJobIdRef.current != null) {
                        try { await jobAPI.cancel(translateJobIdRef.current); } catch { /* noop */ }
                        translateJobIdRef.current = null;
                      }
                    } else {
                      const msg = err?.response?.data?.detail ?? err?.message ?? 'Dịch file thất bại.';
                      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                      setStep(3);
                      if (translateJobIdRef.current != null) {
                        const jobStatus = hasPartialTranslatedContentRef.current ? 'review' : 'failed';
                        try { await jobAPI.update(translateJobIdRef.current, { status: jobStatus, error_message: Array.isArray(msg) ? msg.join(', ') : msg }); } catch { /* noop */ }
                        translateJobIdRef.current = null;
                      }
                    }
                  } finally {
                    setLoading(false);
                    abortRef.current = null;
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
                  translateJobIdRef.current = null;
                  translateCancelledByUserRef.current = false;
                  hasPartialTranslatedContentRef.current = false;
                  try {
                    const user = await authStore.getCurrentUser();
                    if (user?.id) {
                      const jobRes = await jobAPI.create({
                        job_code: `TRANSLATE-FILE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        job_type: 'translation',
                        status: 'in_progress',
                        progress: 0,
                        user_id: user.id,
                        source_lang: sourceLang,
                        target_lang: targetLang,
                        payload: { source_type: 'file', filename: file?.name ?? null, source_lang: sourceLang, target_lang: targetLang },
                      });
                      translateJobIdRef.current = jobRes.data?.id ?? null;
                    }
                  } catch (_) { /* tạo job thất bại vẫn dịch bình thường */ }
                  try {
                    const origXmlText = await file.text();
                    setOriginalXmlContent(origXmlText);
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
                    const data = res.data;
                    let xmlText = '';
                    if (data instanceof ArrayBuffer) {
                      xmlText = new TextDecoder('utf-8').decode(data);
                    } else if (typeof data === 'string') {
                      xmlText = data;
                    } else if (data instanceof Blob) {
                      xmlText = await data.text();
                    } else if (data && typeof (data as Blob).arrayBuffer === 'function') {
                      const ab = await (data as Blob).arrayBuffer();
                      xmlText = new TextDecoder('utf-8').decode(ab);
                    }
                    if (translateCancelledByUserRef.current) return;
                    setTranslatedXmlContent(xmlText);
                    setXmlTranslatedDone(true);
                    try { localStorage.setItem('gosu_last_file_lang_pair', JSON.stringify({ source: sourceLang, target: targetLang })); } catch { /* noop */ }
                    setStep(5);
                    toast.success('Dịch XML xong. Xem trước bên dưới và tải file nếu cần.');
                    if (translateJobIdRef.current != null) {
                      try { await jobAPI.update(translateJobIdRef.current, { status: 'completed', progress: 100, result: { total_rows: 0, saved_at: new Date().toISOString() } }); } catch { /* noop */ }
                      translateJobIdRef.current = null;
                    }
                  } catch (err: any) {
                    const msg = err.response?.data?.detail ?? err.message ?? 'Dịch file thất bại.';
                    toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                    setStep(3);
                    if (translateJobIdRef.current != null) {
                      try { await jobAPI.update(translateJobIdRef.current, { status: 'failed', error_message: Array.isArray(msg) ? msg.join(', ') : msg }); } catch { /* noop */ }
                      translateJobIdRef.current = null;
                    }
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
                translateJobIdRef.current = null;
                translateCancelledByUserRef.current = false;
                hasPartialTranslatedContentRef.current = false;
                try {
                  const user = await authStore.getCurrentUser();
                  if (user?.id) {
                    const jobRes = await jobAPI.create({
                      job_code: `TRANSLATE-FILE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                      job_type: 'translation',
                      status: 'in_progress',
                      progress: 0,
                      user_id: user.id,
                      source_lang: sourceLang,
                      target_lang: targetLang,
                      payload: { source_type: 'file', filename: file?.name ?? null, source_lang: sourceLang, target_lang: targetLang, selected_columns: colsToTranslate },
                    });
                    translateJobIdRef.current = jobRes.data?.id ?? null;
                  }
                } catch (_) { /* tạo job thất bại vẫn dịch bình thường */ }
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
                      if (event.type === 'progress') {
                        const ev = event as TranslateStreamProgressEvent;
                        setProgress(ev);
                        if (ev.done > 0) hasPartialTranslatedContentRef.current = true;
                      }
                    },
                    abortRef.current.signal,
                  );
                  const doneRows = done.rows ?? [];
                  setPreviewRows(doneRows);
                  setTranslatedJsonStructure(done.translated_json ?? null);
                  setTranslatedDocxB64(done.translated_docx_b64 ?? null);
                  setProgress(null);
                  buildS5Rows(doneRows, sourceLang, targetLang, colsToTranslate);
                  try { localStorage.setItem('gosu_last_file_lang_pair', JSON.stringify({ source: sourceLang, target: targetLang })); } catch { /* noop */ }
                  setStep(5);
                  toast.success('Dịch file hoàn tất.');
                  if (translateJobIdRef.current != null) {
                    let totalTranslatable = 0;
                    let sameAsOriginalCount = 0;
                    for (const row of doneRows) {
                      for (const c of colsToTranslate) {
                        const orig = (row[c] ?? '').trim();
                        const trans = (row[c + '_translated'] ?? '').trim();
                        if (orig !== '') {
                          totalTranslatable++;
                          if (orig === trans) sameAsOriginalCount++;
                        }
                      }
                    }
                    const allReturnedAsOriginal = totalTranslatable > 0 && sameAsOriginalCount === totalTranslatable;
                    const someReturnedAsOriginal = sameAsOriginalCount > 0 && !allReturnedAsOriginal;
                    const finalStatus = allReturnedAsOriginal ? 'failed' : someReturnedAsOriginal ? 'review' : 'completed';
                    const errorMsg = allReturnedAsOriginal ? 'Tất cả nội dung dịch đều trả về bản gốc.' : someReturnedAsOriginal ? 'Một số đoạn trả về text gốc, cần xem lại.' : undefined;
                    try {
                      await jobAPI.update(translateJobIdRef.current, {
                        status: finalStatus,
                        progress: 100,
                        result: { total_rows: doneRows.length, saved_at: new Date().toISOString() },
                        ...(errorMsg ? { error_message: errorMsg } : {}),
                      });
                    } catch { /* noop */ }
                    translateJobIdRef.current = null;
                  }
                } catch (err: any) {
                  if (err?.name === 'AbortError') {
                    toast.error('Đã hủy dịch.');
                    setStep(3);
                    if (translateJobIdRef.current != null) {
                      try { await jobAPI.cancel(translateJobIdRef.current); } catch { /* noop */ }
                      translateJobIdRef.current = null;
                    }
                  } else {
                    const msg = err?.message ?? 'Dịch file thất bại.';
                    toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
                    if (translateJobIdRef.current != null) {
                      const jobStatus = hasPartialTranslatedContentRef.current ? 'review' : 'failed';
                      try { await jobAPI.update(translateJobIdRef.current, { status: jobStatus, error_message: Array.isArray(msg) ? msg.join(', ') : msg }); } catch { /* noop */ }
                      translateJobIdRef.current = null;
                    }
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

      {/* Step 4: Tiến trình — thống nhất hiển thị cho mọi loại file (JSON/XML/CSV/XLSX/DOCX) */}
      {step === 4 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tiến Trình Dịch Thuật</h2>

          {/* Phase label — chung cho mọi file */}
          {isTreeFile ? (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span>
                {isJsonFile ? 'Đang phân tích và dịch file JSON...' : 'Đang phân tích và dịch file XML...'}
                <span className="text-gray-500 dark:text-gray-400 font-normal"> Smart Filter đang lọc và bảo toàn giá trị kỹ thuật.</span>
              </span>
            </div>
          ) : !progress ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <svg className="animate-spin w-4 h-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span>Đang tra cứu Cache & Từ điển...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span>Đang gọi AI (Gemini)...</span>
            </div>
          )}

          {/* Progress bar — chung: tree = indeterminate, bảng = % thực */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>
                {isTreeFile
                  ? (isJsonFile ? 'Đang xử lý JSON' : 'Đang xử lý XML')
                  : progress
                    ? `Batch ${progress.batch_done}/${progress.batch_total} · ${progress.done}/${progress.total} segment`
                    : 'Khởi tạo...'}
              </span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {isTreeFile ? '…' : (progress ? `${progress.percent}%` : '0%')}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              {isTreeFile ? (
                <div
                  className="h-3 w-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse"
                  style={{ background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)' }}
                />
              ) : (
                <div
                  className="h-3 rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${progress ? progress.percent : 0}%`,
                    background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)',
                  }}
                />
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            {isTreeFile
              ? 'Đang phân tích cấu trúc và dịch toàn bộ nội dung. Vui lòng không đóng trang này.'
              : 'Nhiều dòng được gộp thành 1 batch để giảm chi phí API. Vui lòng không đóng trang này.'}
          </p>

          <div className="flex justify-start">
            <Button
              variant="secondary"
              onClick={() => {
                translateCancelledByUserRef.current = true;
                if (translateJobIdRef.current != null) {
                  jobAPI.cancel(translateJobIdRef.current).catch(() => {});
                  translateJobIdRef.current = null;
                }
                abortRef.current?.abort();
              }}
              disabled={!loading}
            >
              Hủy
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Xem trước kết quả dịch - hoặc thông báo đã dịch JSON (giữ cấu trúc) */}
      {step === 5 && (() => {
        const resetAll = () => {
          setStep(1); setFile(null); setPreviewRows([]); setPreviewHtml(null);
          setJsonTranslatedDone(false); setXmlTranslatedDone(false);
          setTranslatedJsonStructure(null); setTranslatedJsonContent(null);
          setTranslatedDocxB64(null); setTranslatedXmlContent(null);
          setOriginalJsonContent(null); setOriginalXmlContent(null);
          setXmlProofreadMode(false); setXmlProofreadRows([]); setXmlProofreadColumns([]); setXmlProofreadAllColumns([]); setXmlProofreadMeta(null);
          setXmlPreviewColumns([]); setXmlPreviewRows([]); setXmlOriginalRows([]);
          setJsonPreviewColumns([]); setJsonPreviewOrigRows([]); setJsonPreviewTransRows([]);
          setJsonProofreadMode(false); setJsonProofreadRows([]); setJsonProofreadColumns([]);
          setJsonQualityScores({}); setXmlQualityScores({});
          setJsonQualityExpandedRowId(null); setXmlQualityExpandedRowId(null);
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
          const jsonColsToShow = (() => {
            const selected = columns.filter((c) => selectedColumns[c]).filter((c) => jsonPreviewColumns.includes(c));
            return selected.length > 0 ? selected : [...jsonPreviewColumns];
          })();

          const enterJsonProofread = () => {
            const displayCols = jsonColsToShow.flatMap((c) => [`${c} (gốc)`, `${c} (đã dịch)`]);
            setJsonProofreadColumns(displayCols);
            setJsonProofreadRows(
              jsonPreviewTransRows.map((transRow, i) => {
                const origRow = jsonPreviewOrigRows[i] ?? {};
                const row: Record<string, string> = {};
                jsonColsToShow.forEach((c) => {
                  row[`${c} (gốc)`] = origRow[c] ?? '';
                  row[`${c} (đã dịch)`] = transRow[c] ?? '';
                });
                return row;
              })
            );
            setJsonProofreadStatus({});
            setJsonProofreadMode(true);
          };
          const jsonProofreadBaseName = file?.name?.replace(/\.[^.]+$/, '') ?? 'proofread';
          const downloadJsonProofreadJson = () => {
            try {
              const colsTrans = jsonProofreadColumns.filter((c) => c.endsWith(' (đã dịch)')).map((c) => c.replace(/ \(đã dịch\)$/, ''));
              const newTransRows = jsonPreviewTransRows.map((r, i) => ({
                ...r,
                ...Object.fromEntries(colsTrans.map((c) => [c, jsonProofreadRows[i]?.[`${c} (đã dịch)`] ?? r[c]])),
              }));
              const content = JSON.stringify(newTransRows, null, 2);
              const blob = new Blob([content], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${jsonProofreadBaseName}_proofread.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              toast.success('Đã tải file JSON.');
            } catch (err: any) {
              toast.error('Không thể xuất JSON.');
            }
          };
          const updateJsonProofreadCell = (rowIndex: number, col: string, value: string) => {
            setJsonProofreadRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [col]: value } : r)));
            const key = `${rowIndex}-${col.replace(/ \(đã dịch\)$/, '')}`;
            setJsonProofreadStatus((prev) => ({ ...prev, [key]: 'edited' }));
          };
          const jsonTransColsBase = jsonProofreadColumns.filter((c) => c.endsWith(' (đã dịch)')).map((c) => c.replace(/ \(đã dịch\)$/, ''));
          const jsonProofreadFlatRows: { flatIndex: number; rowIndex: number; col: string; original: string; translated: string }[] = [];
          let jsonFlatIdx = 0;
          jsonProofreadRows.forEach((row, rowIndex) => {
            jsonTransColsBase.forEach((col) => {
              jsonProofreadFlatRows.push({
                flatIndex: jsonFlatIdx++,
                rowIndex,
                col,
                original: row[`${col} (gốc)`] ?? '',
                translated: row[`${col} (đã dịch)`] ?? '',
              });
            });
          });
          const jsonProofreadReplaceAll = () => {
            if (!jsonProofreadFind.trim()) { toast.error('Nhập nội dung cần tìm.'); return; }
            const hasSelection = jsonProofreadSelected.size > 0;
            const scopeFlat = hasSelection ? jsonProofreadSelected : new Set(jsonProofreadFlatRows.map((r) => r.flatIndex));
            let count = 0;
            const affectedStatusKeys: Record<string, S5Status> = {};
            jsonProofreadFlatRows.forEach(({ flatIndex, rowIndex, col }) => {
              if (!scopeFlat.has(flatIndex)) return;
              const val = jsonProofreadRows[rowIndex]?.[`${col} (đã dịch)`] ?? '';
              if (val.includes(jsonProofreadFind)) {
                count += 1;
                affectedStatusKeys[`${rowIndex}-${col}`] = 'edited';
              }
            });
            if (count === 0) {
              toast.error(hasSelection ? `Không tìm thấy "${jsonProofreadFind}" trong ${scopeFlat.size} dòng đã chọn.` : `Không tìm thấy "${jsonProofreadFind}" trong cột bản dịch.`);
              return;
            }
            setJsonProofreadRows((prev) => {
              const next = prev.map((r) => ({ ...r }));
              jsonProofreadFlatRows.forEach(({ flatIndex, rowIndex, col }) => {
                if (!scopeFlat.has(flatIndex)) return;
                const key = `${col} (đã dịch)`;
                const val = next[rowIndex][key] ?? '';
                if (val.includes(jsonProofreadFind)) (next[rowIndex] as Record<string, string>)[key] = val.split(jsonProofreadFind).join(jsonProofreadReplace);
              });
              return next;
            });
            setJsonProofreadStatus((prev) => ({ ...prev, ...affectedStatusKeys }));
            toast.success(hasSelection ? `Đã thay thế ${count} dòng trong ${scopeFlat.size} dòng đã chọn.` : `Đã thay thế ${count} dòng.`);
          };
          const jsonProofreadFlatFiltered = jsonProofreadSearch.trim()
            ? jsonProofreadFlatRows.filter(
                (r) =>
                  r.original.toLowerCase().includes(jsonProofreadSearch.toLowerCase()) ||
                  r.translated.toLowerCase().includes(jsonProofreadSearch.toLowerCase())
              )
            : jsonProofreadFlatRows;
          const jsonProofreadFlatSelectAllFn = (checked: boolean) => {
            setJsonProofreadSelectAll(checked);
            setJsonProofreadSelected(checked ? new Set(jsonProofreadFlatFiltered.map((r) => r.flatIndex)) : new Set());
          };
          const jsonProofreadFlatSelect = (flatIndex: number, checked: boolean) => {
            setJsonProofreadSelected((prev) => {
              const next = new Set(prev);
              if (checked) next.add(flatIndex);
              else next.delete(flatIndex);
              return next;
            });
          };
          const jsonProofreadRowAi = async (flatIndex: number) => {
            const item = jsonProofreadFlatRows.find((r) => r.flatIndex === flatIndex);
            if (!item || !sourceLang || !targetLang) {
              if (!sourceLang || !targetLang) toast.error('Vui lòng chọn ngôn ngữ để dùng AI hiệu đính.');
              return;
            }
            const key = `${item.rowIndex}-${item.col}`;
            setJsonProofreadStatus((prev) => ({ ...prev, [key]: 'loading' }));
            setJsonProofreadAiLoadingFlatIndex(flatIndex);
            try {
              const res = await proofreadAPI.proofreadRow({
                original: item.original,
                translated: jsonProofreadRows[item.rowIndex]?.[`${item.col} (đã dịch)`] ?? item.translated,
                source_lang: sourceLang,
                target_lang: targetLang,
              });
              setJsonProofreadRows((prev) => prev.map((r, i) => (i === item.rowIndex ? { ...r, [`${item.col} (đã dịch)`]: res.data.proofread } : r)));
              setJsonProofreadStatus((prev) => ({ ...prev, [key]: 'ai-proofread' }));
            } catch (err: any) {
              toast.error(err?.response?.data?.detail ?? 'Hiệu đính AI thất bại.');
              setJsonProofreadStatus((prev) => ({ ...prev, [key]: 'original' }));
            } finally {
              setJsonProofreadAiLoadingFlatIndex(null);
            }
          };
          const jsonProofreadBatchAi = async () => {
            if (!sourceLang || !targetLang) { toast.error('Vui lòng chọn ngôn ngữ để dùng AI hiệu đính.'); return; }
            const targets = jsonProofreadFlatFiltered.filter((r) => jsonProofreadSelected.has(r.flatIndex));
            if (targets.length === 0) { toast.error('Chọn ít nhất 1 dòng để hiệu đính batch.'); return; }
            setJsonProofreadStatus((prev) => {
              const next = { ...prev };
              targets.forEach((t) => { next[`${t.rowIndex}-${t.col}`] = 'loading'; });
              return next;
            });
            setJsonProofreadBatchLoading(true);
            try {
              for (let i = 0; i < targets.length; i += S5_BATCH) {
                const chunk = targets.slice(i, i + S5_BATCH);
                const items = chunk.map((item) => ({
                  index: item.flatIndex,
                  original: item.original,
                  translated: jsonProofreadRows[item.rowIndex]?.[`${item.col} (đã dịch)`] ?? item.translated,
                }));
                const res = await proofreadAPI.proofreadBatch({ items, source_lang: sourceLang, target_lang: targetLang });
                const resultMap = Object.fromEntries((res.data.results ?? []).map((r) => [r.index, r.proofread]));
                const rowsPatch: Record<number, Record<string, string>> = {};
                const statusPatch: Record<string, S5Status> = {};
                for (const item of chunk) {
                  const proofread = resultMap[item.flatIndex];
                  if (proofread === undefined) continue;
                  if (!rowsPatch[item.rowIndex]) rowsPatch[item.rowIndex] = {};
                  rowsPatch[item.rowIndex][`${item.col} (đã dịch)`] = proofread;
                  statusPatch[`${item.rowIndex}-${item.col}`] = 'ai-proofread';
                }
                setJsonProofreadRows((prev) => prev.map((r, ri) => (rowsPatch[ri] ? { ...r, ...rowsPatch[ri] } : r)));
                setJsonProofreadStatus((prev) => ({ ...prev, ...statusPatch }));
              }
              toast.success(`Đã hiệu đính ${targets.length} dòng bằng AI.`);
              setJsonProofreadSelected(new Set());
              setJsonProofreadSelectAll(false);
            } catch (err: any) {
              toast.error(err?.response?.data?.detail ?? 'Hiệu đính batch thất bại.');
              setJsonProofreadStatus((prev) => {
                const next: Record<string, S5Status> = { ...prev };
                Object.keys(prev).forEach((k) => { if (prev[k] === 'loading') next[k] = 'original'; });
                return next;
              });
            } finally {
              setJsonProofreadBatchLoading(false);
            }
          };

          if (jsonProofreadMode) {
            return (
              <div className="space-y-4">
                {/* Header: Xem trước + Dịch Mới */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Hiệu Đính Kết Quả</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {jsonProofreadFlatRows.length} dòng
                      {(() => {
                        const scores = Object.values(jsonQualityScores);
                        const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length) : null;
                        return avg !== null ? (
                          <span className={`ml-2 font-medium ${avg >= 85 ? 'text-green-600 dark:text-green-400' : avg >= 70 ? 'text-yellow-600 dark:text-yellow-400' : avg >= 60 ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
                            &bull; Chất lượng TB: {avg}/100
                          </span>
                        ) : null;
                      })()}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" onClick={() => setJsonProofreadMode(false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                      Xem trước
                    </button>
                    <Button variant="secondary" onClick={resetAll}>Dịch Mới</Button>
                  </div>
                </div>

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
                    <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} disabled={!sourceLang} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60">
                      <option value="">Chọn ngôn ngữ…</option>
                      {(targetOptionsBySource[sourceLang] ?? sourceLanguageOptions).map((l) => <option key={l.id} value={l.code}>{getLanguageNameVi(l.code, l.name)}</option>)}
                    </select>
                  </div>
                </div>

                {/* Toolbar tìm kiếm — 100% giống Excel */}
                <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <div className="relative">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                    </svg>
                    <input type="text" placeholder="Tìm kiếm…" value={jsonProofreadSearch} onChange={(e) => setJsonProofreadSearch(e.target.value)} className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-64" />
                  </div>
                </div>

                {/* Find & Replace — 100% giống Excel */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="text" placeholder="Nội dung cần thay thế…" value={jsonProofreadFind} onChange={(e) => setJsonProofreadFind(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && jsonProofreadReplaceAll()} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[140px] max-w-xs" />
                    <input type="text" placeholder="Nội dung thay thế…" value={jsonProofreadReplace} onChange={(e) => setJsonProofreadReplace(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && jsonProofreadReplaceAll()} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[140px] max-w-xs" />
                    <Button size="sm" variant="secondary" onClick={jsonProofreadReplaceAll}>
                      {jsonProofreadSelected.size > 0 ? `Replace (${jsonProofreadSelected.size} dòng đã chọn)` : 'Replace tất cả'}
                    </Button>
                    {(jsonProofreadFind || jsonProofreadReplace) && <button type="button" onClick={() => { setJsonProofreadFind(''); setJsonProofreadReplace(''); }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Xóa</button>}
                  </div>
                  {jsonProofreadSelected.size > 0 && (
                    <Button size="sm" isLoading={jsonProofreadBatchLoading} disabled={jsonProofreadBatchLoading || !sourceLang || !targetLang} onClick={jsonProofreadBatchAi}>
                      AI Hiệu Đính {jsonProofreadSelected.size} dòng đã chọn
                    </Button>
                  )}
                </div>

                {/* Bảng 100% giống Excel: wrapper overflow-hidden + overflow-x-auto */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                          <th className="px-4 py-3 w-10">
                            <input type="checkbox" checked={jsonProofreadFlatFiltered.length > 0 && jsonProofreadFlatFiltered.every((r) => jsonProofreadSelected.has(r.flatIndex))} onChange={(e) => jsonProofreadFlatSelectAllFn(e.target.checked)} className="rounded border-gray-300 text-brand-600" />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-10">#</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">GỐC</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">ĐÃ DỊCH</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-28">TRẠNG THÁI</th>
                          {Object.keys(jsonQualityScores).length > 0 && (
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-20">ĐIỂM</th>
                          )}
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-24">THAO TÁC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                        {jsonProofreadFlatFiltered.length === 0 ? (
                          <tr><td colSpan={Object.keys(jsonQualityScores).length > 0 ? 7 : 6} className="px-4 py-8 text-center text-gray-400 text-sm">{jsonProofreadSearch ? 'Không tìm thấy kết quả.' : 'Chưa có dữ liệu.'}</td></tr>
                        ) : (
                          jsonProofreadFlatFiltered.map((item, flatIdx) => {
                            const isSelected = jsonProofreadSelected.has(item.flatIndex);
                            const statusKey = `${item.rowIndex}-${item.col}`;
                            const status: S5Status = jsonProofreadAiLoadingFlatIndex === item.flatIndex ? 'loading' : (jsonProofreadStatus[statusKey] ?? 'original');
                            const badge = S5_BADGE[status];
                            const isLoading = status === 'loading';
                            const currentTranslated = jsonProofreadRows[item.rowIndex]?.[`${item.col} (đã dịch)`] ?? item.translated;
                            const rowId = item.rowIndex + 1;
                            const jsonQr = jsonQualityScores[rowId];
                            const jsonColSpan = 6 + (Object.keys(jsonQualityScores).length > 0 ? 1 : 0);
                            const isJsonExpanded = jsonQualityExpandedRowId === rowId;
                            const isFirstFlatRowForDataRow = jsonProofreadFlatFiltered.findIndex((r) => r.rowIndex === item.rowIndex) === flatIdx;
                            return (
                              <React.Fragment key={item.flatIndex}>
                                <tr className={`transition-colors ${isSelected ? 'bg-brand-50/40 dark:bg-brand-900/10' : 'bg-white dark:bg-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-700/20'}`}>
                                  <td className="px-4 py-3">
                                    <input type="checkbox" checked={isSelected} onChange={(e) => jsonProofreadFlatSelect(item.flatIndex, e.target.checked)} className="rounded border-gray-300 text-brand-600" />
                                  </td>
                                  <td className="px-4 py-3 text-gray-400 font-mono text-xs align-top pt-4">{item.flatIndex + 1}</td>
                                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 align-top max-w-[220px]">
                                    <div className="break-words leading-relaxed text-xs">{item.original}</div>
                                  </td>
                                  <td className="px-4 py-3 align-top max-w-[280px]">
                                    {isLoading ? (
                                      <div className="flex items-center gap-2 text-gray-400 py-1 text-xs">
                                        <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                        Đang hiệu đính…
                                      </div>
                                    ) : (
                                      <textarea
                                        value={currentTranslated}
                                        onChange={(e) => updateJsonProofreadCell(item.rowIndex, `${item.col} (đã dịch)`, e.target.value)}
                                        rows={Math.max(2, Math.ceil(currentTranslated.length / 48))}
                                        className={`w-full px-2 py-1.5 text-sm border rounded-lg resize-none transition-colors bg-transparent focus:outline-none text-gray-900 dark:text-gray-100 ${
                                          status === 'ai-proofread' ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10'
                                          : status === 'edited' ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10'
                                          : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-brand-400 focus:bg-white dark:focus:bg-gray-900'
                                        }`}
                                      />
                                    )}
                                  </td>
                                  <td className="px-4 py-3 align-top pt-4">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
                                  </td>
                                  {Object.keys(jsonQualityScores).length > 0 && (
                                    <td className="px-4 py-3 align-top pt-3">
                                      {jsonQr ? (
                                        <button
                                          type="button"
                                          title={`${jsonQr.verdict} · Click để xem chi tiết`}
                                          onClick={() => setJsonQualityExpandedRowId(isJsonExpanded ? null : rowId)}
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80 ${getScoreBadgeCls(jsonQr.score)}`}
                                        >
                                          {jsonQr.score}
                                          <svg className={`w-3 h-3 transition-transform ${isJsonExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>
                                      ) : (
                                        <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                                      )}
                                    </td>
                                  )}
                                  <td className="px-4 py-3 align-top pt-3.5">
                                    <button type="button" disabled={isLoading || jsonProofreadBatchLoading} onClick={() => jsonProofreadRowAi(item.flatIndex)} className="text-xs text-green-600 dark:text-green-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                                      AI Hiệu Đính
                                    </button>
                                  </td>
                                </tr>
                                {isJsonExpanded && jsonQr && isFirstFlatRowForDataRow && (
                                  <tr className="bg-gray-50 dark:bg-gray-900/40">
                                    <td colSpan={jsonColSpan} className="px-6 py-3 border-t border-gray-100 dark:border-gray-700/50">
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                          <span className={`text-sm font-semibold ${getScoreBadgeCls(jsonQr.score)} px-2.5 py-0.5 rounded-full`}>
                                            {jsonQr.score}/100 — {jsonQr.verdict}
                                          </span>
                                          {jsonQr.issues.length === 0 && (
                                            <span className="text-xs text-green-600 dark:text-green-400">Không phát hiện vấn đề nào.</span>
                                          )}
                                        </div>
                                        {jsonQr.issues.length > 0 && (
                                          <ul className="space-y-1">
                                            {jsonQr.issues.map((issue, i) => (
                                              <li key={i} className="flex items-start gap-2 text-xs">
                                                <span className={`shrink-0 font-semibold uppercase ${getSeverityCls(issue.severity)}`}>
                                                  [{issue.severity === 'critical' ? 'Nghiêm trọng' : issue.severity === 'major' ? 'Quan trọng' : 'Nhỏ'}]
                                                </span>
                                                <span className="text-gray-700 dark:text-gray-300">{issue.message}</span>
                                                {issue.suggestion && (
                                                  <span className="text-gray-400 dark:text-gray-500 italic">→ {issue.suggestion}</span>
                                                )}
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                        {jsonQr.suggestions.length > 0 && (
                                          <div className="text-xs text-blue-600 dark:text-blue-400 pt-1">
                                            <span className="font-medium">Gợi ý: </span>
                                            {jsonQr.suggestions[0]}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer 100% giống Excel: text + hai nút Tải File (.json / .csv) */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tải xuống hoặc chỉnh sửa trước khi tải.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={downloadJsonProofreadJson}>
                      <svg className="w-4 h-4 mr-1.5 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      Tải File .json
                    </Button>
                  </div>
                </div>
              </div>
            );
          }

          const jsonDisplayColumns = jsonColsToShow.flatMap((c) => [`${c} (gốc)`, `${c} (đã dịch)`]);
          const jsonMergedRows = jsonPreviewTransRows.map((transRow, i) => {
            const origRow = jsonPreviewOrigRows[i] ?? {};
            const merged: Record<string, string> = {};
            jsonColsToShow.forEach((c) => {
              merged[`${c} (gốc)`] = origRow[c] ?? '';
              merged[`${c} (đã dịch)`] = transRow[c] ?? '';
            });
            return merged;
          });

          /* Bước 5 xem trước JSON — cấu trúc giống Excel (header + bảng chất lượng + nút) */
          const jsonQScores = Object.values(jsonQualityScores);
          const jsonQGood = jsonQScores.filter((q) => q.score >= 85).length;
          const jsonQOk = jsonQScores.filter((q) => q.score >= 70 && q.score < 85).length;
          const jsonQWarn = jsonQScores.filter((q) => q.score >= 60 && q.score < 70).length;
          const jsonQBad = jsonQScores.filter((q) => q.score < 60).length;
          const jsonQTotal = jsonQScores.length;
          const jsonQualityAvg = jsonQTotal > 0
            ? Math.round(jsonQScores.reduce((a, b) => a + b.score, 0) / jsonQTotal)
            : null;

          return (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Kết quả Dịch thuật</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Đã dịch {jsonMergedRows.length} dòng
                  {jsonQTotal > 0 && <> · {jsonQTotal} dòng đã kiểm tra chất lượng</>}
                  {' · '}{sourceLang} → {targetLang}
                </p>
              </div>

              {/* Quality summary panel (giống Excel) */}
              {jsonQualityLoading && jsonQTotal === 0 && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 flex items-center gap-3">
                  <svg className="animate-spin w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  <p className="text-sm text-blue-700 dark:text-blue-300">Đang kiểm tra chất lượng…</p>
                </div>
              )}
              {jsonQTotal > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="text-center min-w-[72px]">
                      <div className={`text-4xl font-bold tabular-nums ${jsonQualityAvg !== null && jsonQualityAvg >= 85 ? 'text-green-600 dark:text-green-400' : jsonQualityAvg !== null && jsonQualityAvg >= 70 ? 'text-yellow-600 dark:text-yellow-400' : jsonQualityAvg !== null && jsonQualityAvg >= 60 ? 'text-orange-500 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
                        {jsonQualityAvg}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Điểm TB / 100</div>
                    </div>
                    <div className="flex-1 min-w-[200px] space-y-1.5">
                      {[
                        { label: 'Tốt (≥85)', count: jsonQGood, color: 'bg-green-500', textCls: 'text-green-600 dark:text-green-400' },
                        { label: 'Chấp nhận (70–84)', count: jsonQOk, color: 'bg-yellow-400', textCls: 'text-yellow-600 dark:text-yellow-400' },
                        { label: 'Cần cải thiện (60–69)', count: jsonQWarn, color: 'bg-orange-400', textCls: 'text-orange-500 dark:text-orange-400' },
                        { label: 'Cần dịch lại (<60)', count: jsonQBad, color: 'bg-red-500', textCls: 'text-red-600 dark:text-red-400' },
                      ].map(({ label, count, color, textCls }) => (
                        <div key={label} className="flex items-center gap-2 text-xs">
                          <span className="w-36 text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div className={`h-2 rounded-full transition-all duration-500 ${color}`} style={{ width: jsonQTotal > 0 ? `${(count / jsonQTotal) * 100}%` : '0%' }} />
                          </div>
                          <span className={`w-8 text-right font-medium tabular-nums ${textCls}`}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {jsonPreviewLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-gray-500 dark:text-gray-400 text-sm">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Đang tải xem trước…
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800">
                        {jsonDisplayColumns.map((k) => (
                          <th key={k} className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{k}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                      {jsonDisplayColumns.length > 0 && jsonMergedRows.length > 0 ? (
                        jsonMergedRows.map((row, i) => (
                          <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                            {jsonDisplayColumns.map((k) => (
                              <td key={k} className="px-4 py-2 text-gray-900 dark:text-gray-100 max-w-[200px] truncate align-top" title={String(row[k] ?? '')}>{row[k] ?? ''}</td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={jsonDisplayColumns.length || 1} className="px-4 py-8 text-center text-gray-400 text-sm">Chưa có dữ liệu xem trước.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <Button onClick={enterJsonProofread} disabled={jsonPreviewLoading || jsonPreviewTransRows.length === 0}>Hiệu Đính</Button>
                <Button variant="secondary" onClick={downloadJsonFile} disabled={!translatedJsonContent}>
                  Tải File
                </Button>
                <Button variant="secondary" onClick={resetAll}>Dịch thuật Mới</Button>
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
          const xmlColsToShow = (() => {
            const selected = columns.filter((c) => selectedColumns[c]).filter((c) => xmlPreviewColumns.includes(c));
            return selected.length > 0 ? selected : [...xmlPreviewColumns];
          })();

          const enterXmlProofread = async () => {
            if (!translatedXmlContent) return;
            setXmlProofreadLoading(true);
            try {
              const res = await translateAPI.parseXmlContent(translatedXmlContent);
              const data = res.data as { columns: string[]; rows: Record<string, string>[]; root_tag: string; row_tag: string; root_attribs: Record<string, string>; declaration: string };
              const allCols = data.columns ?? [];
              setXmlProofreadAllColumns(allCols);
              setXmlProofreadColumns(xmlColsToShow);
              setXmlProofreadRows(data.rows ?? []);
              setXmlProofreadMeta({ root_tag: data.root_tag ?? 'root', row_tag: data.row_tag ?? 'row', root_attribs: data.root_attribs ?? {}, declaration: data.declaration ?? '' });
              setXmlProofreadStatus({});
              setXmlProofreadMode(true);
            } catch (err: any) {
              toast.error(err?.response?.data?.detail ?? 'Không thể phân tích XML để hiệu đính.');
            } finally {
              setXmlProofreadLoading(false);
            }
          };
          const xmlProofreadBaseName = file?.name?.replace(/\.[^.]+$/, '') ?? 'proofread';
          const downloadXmlProofreadXml = async () => {
            if (!xmlProofreadMeta) return;
            try {
              const res = await translateAPI.rebuildXmlFromRows({
                root_tag: xmlProofreadMeta.root_tag,
                row_tag: xmlProofreadMeta.row_tag,
                root_attribs: xmlProofreadMeta.root_attribs,
                columns: xmlProofreadAllColumns.length > 0 ? xmlProofreadAllColumns : xmlProofreadColumns,
                rows: xmlProofreadRows,
                declaration: xmlProofreadMeta.declaration,
              });
              const content = (res.data as { content: string })?.content ?? '';
              const blob = new Blob([content], { type: 'application/xml' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${xmlProofreadBaseName}_proofread.xml`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              toast.success('Đã tải file XML.');
            } catch (err: any) {
              toast.error(err?.response?.data?.detail ?? 'Không thể xuất XML.');
            }
          };
          const updateXmlProofreadCell = (rowIndex: number, col: string, value: string) => {
            setXmlProofreadRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, [col]: value } : r)));
            const key = `${rowIndex}-${col}`;
            setXmlProofreadStatus((prev) => ({ ...prev, [key]: 'edited' }));
          };
          const xmlProofreadFlatRows: { flatIndex: number; rowIndex: number; col: string; original: string; translated: string }[] = [];
          let xmlFlatIdx = 0;
          xmlProofreadRows.forEach((row, rowIndex) => {
            xmlColsToShow.forEach((col) => {
              xmlProofreadFlatRows.push({
                flatIndex: xmlFlatIdx++,
                rowIndex,
                col,
                original: xmlOriginalRows[rowIndex]?.[col] ?? '',
                translated: row[col] ?? '',
              });
            });
          });
          const xmlProofreadReplaceAll = () => {
            if (!xmlProofreadFind.trim()) { toast.error('Nhập nội dung cần tìm.'); return; }
            const hasSelection = xmlProofreadSelected.size > 0;
            const scopeFlat = hasSelection ? xmlProofreadSelected : new Set(xmlProofreadFlatRows.map((r) => r.flatIndex));
            let count = 0;
            const affectedStatusKeys: Record<string, S5Status> = {};
            xmlProofreadFlatRows.forEach(({ flatIndex, rowIndex, col }) => {
              if (!scopeFlat.has(flatIndex)) return;
              const val = xmlProofreadRows[rowIndex]?.[col] ?? '';
              if (val.includes(xmlProofreadFind)) {
                count += 1;
                affectedStatusKeys[`${rowIndex}-${col}`] = 'edited';
              }
            });
            if (count === 0) {
              toast.error(hasSelection ? `Không tìm thấy "${xmlProofreadFind}" trong ${scopeFlat.size} dòng đã chọn.` : `Không tìm thấy "${xmlProofreadFind}" trong cột bản dịch.`);
              return;
            }
            setXmlProofreadRows((prev) => {
              const next = prev.map((r) => ({ ...r }));
              xmlProofreadFlatRows.forEach(({ flatIndex, rowIndex, col }) => {
                if (!scopeFlat.has(flatIndex)) return;
                const val = next[rowIndex][col] ?? '';
                if (val.includes(xmlProofreadFind)) next[rowIndex] = { ...next[rowIndex], [col]: val.split(xmlProofreadFind).join(xmlProofreadReplace) };
              });
              return next;
            });
            setXmlProofreadStatus((prev) => ({ ...prev, ...affectedStatusKeys }));
            toast.success(hasSelection ? `Đã thay thế ${count} dòng trong ${scopeFlat.size} dòng đã chọn.` : `Đã thay thế ${count} dòng.`);
          };
          const xmlProofreadFlatFiltered = xmlProofreadSearch.trim()
            ? xmlProofreadFlatRows.filter(
                (r) =>
                  r.original.toLowerCase().includes(xmlProofreadSearch.toLowerCase()) ||
                  r.translated.toLowerCase().includes(xmlProofreadSearch.toLowerCase())
              )
            : xmlProofreadFlatRows;
          const xmlProofreadFlatSelectAllFn = (checked: boolean) => {
            setXmlProofreadSelectAll(checked);
            setXmlProofreadSelected(checked ? new Set(xmlProofreadFlatFiltered.map((r) => r.flatIndex)) : new Set());
          };
          const xmlProofreadFlatSelect = (flatIndex: number, checked: boolean) => {
            setXmlProofreadSelected((prev) => {
              const next = new Set(prev);
              if (checked) next.add(flatIndex);
              else next.delete(flatIndex);
              return next;
            });
          };
          const xmlProofreadRowAi = async (flatIndex: number) => {
            const item = xmlProofreadFlatRows.find((r) => r.flatIndex === flatIndex);
            if (!item || !sourceLang || !targetLang) {
              if (!sourceLang || !targetLang) toast.error('Vui lòng chọn ngôn ngữ để dùng AI hiệu đính.');
              return;
            }
            const key = `${item.rowIndex}-${item.col}`;
            setXmlProofreadStatus((prev) => ({ ...prev, [key]: 'loading' }));
            setXmlProofreadAiLoadingFlatIndex(flatIndex);
            try {
              const currentTrans = xmlProofreadRows[item.rowIndex]?.[item.col] ?? item.translated;
              const res = await proofreadAPI.proofreadRow({
                original: item.original,
                translated: currentTrans,
                source_lang: sourceLang,
                target_lang: targetLang,
              });
              setXmlProofreadRows((prev) => prev.map((r, i) => (i === item.rowIndex ? { ...r, [item.col]: res.data.proofread } : r)));
              setXmlProofreadStatus((prev) => ({ ...prev, [key]: 'ai-proofread' }));
            } catch (err: any) {
              toast.error(err?.response?.data?.detail ?? 'Hiệu đính AI thất bại.');
              setXmlProofreadStatus((prev) => ({ ...prev, [key]: 'original' }));
            } finally {
              setXmlProofreadAiLoadingFlatIndex(null);
            }
          };
          const xmlProofreadBatchAi = async () => {
            if (!sourceLang || !targetLang) { toast.error('Vui lòng chọn ngôn ngữ để dùng AI hiệu đính.'); return; }
            const targets = xmlProofreadFlatFiltered.filter((r) => xmlProofreadSelected.has(r.flatIndex));
            if (targets.length === 0) { toast.error('Chọn ít nhất 1 dòng để hiệu đính batch.'); return; }
            setXmlProofreadStatus((prev) => {
              const next = { ...prev };
              targets.forEach((t) => { next[`${t.rowIndex}-${t.col}`] = 'loading'; });
              return next;
            });
            setXmlProofreadBatchLoading(true);
            try {
              for (let i = 0; i < targets.length; i += S5_BATCH) {
                const chunk = targets.slice(i, i + S5_BATCH);
                const items = chunk.map((item) => ({
                  index: item.flatIndex,
                  original: item.original,
                  translated: xmlProofreadRows[item.rowIndex]?.[item.col] ?? item.translated,
                }));
                const res = await proofreadAPI.proofreadBatch({ items, source_lang: sourceLang, target_lang: targetLang });
                const resultMap = Object.fromEntries((res.data.results ?? []).map((r) => [r.index, r.proofread]));
                const rowsPatch: Record<number, Record<string, string>> = {};
                const statusPatch: Record<string, S5Status> = {};
                for (const item of chunk) {
                  const proofread = resultMap[item.flatIndex];
                  if (proofread === undefined) continue;
                  if (!rowsPatch[item.rowIndex]) rowsPatch[item.rowIndex] = {};
                  rowsPatch[item.rowIndex][item.col] = proofread;
                  statusPatch[`${item.rowIndex}-${item.col}`] = 'ai-proofread';
                }
                setXmlProofreadRows((prev) => prev.map((r, ri) => (rowsPatch[ri] ? { ...r, ...rowsPatch[ri] } : r)));
                setXmlProofreadStatus((prev) => ({ ...prev, ...statusPatch }));
              }
              toast.success(`Đã hiệu đính ${targets.length} dòng bằng AI.`);
              setXmlProofreadSelected(new Set());
              setXmlProofreadSelectAll(false);
            } catch (err: any) {
              toast.error(err?.response?.data?.detail ?? 'Hiệu đính batch thất bại.');
              setXmlProofreadStatus((prev) => {
                const next: Record<string, S5Status> = { ...prev };
                Object.keys(prev).forEach((k) => { if (prev[k] === 'loading') next[k] = 'original'; });
                return next;
              });
            } finally {
              setXmlProofreadBatchLoading(false);
            }
          };

          if (xmlProofreadMode && xmlProofreadMeta) {
            return (
              <div className="space-y-4">
                {/* Header: Xem trước + Dịch Mới */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Hiệu Đính Kết Quả</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {xmlProofreadFlatRows.length} dòng
                      {(() => {
                        const scores = Object.values(xmlQualityScores);
                        const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length) : null;
                        return avg !== null ? (
                          <span className={`ml-2 font-medium ${avg >= 85 ? 'text-green-600 dark:text-green-400' : avg >= 70 ? 'text-yellow-600 dark:text-yellow-400' : avg >= 60 ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
                            &bull; Chất lượng TB: {avg}/100
                          </span>
                        ) : null;
                      })()}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" onClick={() => setXmlProofreadMode(false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                      Xem trước
                    </button>
                    <Button variant="secondary" onClick={resetAll}>Dịch Mới</Button>
                  </div>
                </div>

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
                    <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} disabled={!sourceLang} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60">
                      <option value="">Chọn ngôn ngữ…</option>
                      {(targetOptionsBySource[sourceLang] ?? sourceLanguageOptions).map((l) => <option key={l.id} value={l.code}>{getLanguageNameVi(l.code, l.name)}</option>)}
                    </select>
                  </div>
                </div>

                {/* Toolbar tìm kiếm — 100% giống Excel */}
                <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <div className="relative">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                    </svg>
                    <input type="text" placeholder="Tìm kiếm…" value={xmlProofreadSearch} onChange={(e) => setXmlProofreadSearch(e.target.value)} className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-64" />
                  </div>
                </div>

                {/* Find & Replace — 100% giống Excel */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="text" placeholder="Nội dung cần thay thế…" value={xmlProofreadFind} onChange={(e) => setXmlProofreadFind(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && xmlProofreadReplaceAll()} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[140px] max-w-xs" />
                    <input type="text" placeholder="Nội dung thay thế…" value={xmlProofreadReplace} onChange={(e) => setXmlProofreadReplace(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && xmlProofreadReplaceAll()} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[140px] max-w-xs" />
                    <Button size="sm" variant="secondary" onClick={xmlProofreadReplaceAll}>
                      {xmlProofreadSelected.size > 0 ? `Replace (${xmlProofreadSelected.size} dòng đã chọn)` : 'Replace tất cả'}
                    </Button>
                    {(xmlProofreadFind || xmlProofreadReplace) && <button type="button" onClick={() => { setXmlProofreadFind(''); setXmlProofreadReplace(''); }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Xóa</button>}
                  </div>
                  {xmlProofreadSelected.size > 0 && (
                    <Button size="sm" isLoading={xmlProofreadBatchLoading} disabled={xmlProofreadBatchLoading || !sourceLang || !targetLang} onClick={xmlProofreadBatchAi}>
                      AI Hiệu Đính {xmlProofreadSelected.size} dòng đã chọn
                    </Button>
                  )}
                </div>

                {/* Bảng 100% giống Excel: wrapper overflow-hidden + overflow-x-auto */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                          <th className="px-4 py-3 w-10">
                            <input type="checkbox" checked={xmlProofreadFlatFiltered.length > 0 && xmlProofreadFlatFiltered.every((r) => xmlProofreadSelected.has(r.flatIndex))} onChange={(e) => xmlProofreadFlatSelectAllFn(e.target.checked)} className="rounded border-gray-300 text-brand-600" />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-10">#</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">GỐC</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">ĐÃ DỊCH</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-28">TRẠNG THÁI</th>
                          {Object.keys(xmlQualityScores).length > 0 && (
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-20">ĐIỂM</th>
                          )}
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-24">THAO TÁC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                        {xmlProofreadFlatFiltered.length === 0 ? (
                          <tr><td colSpan={Object.keys(xmlQualityScores).length > 0 ? 7 : 6} className="px-4 py-8 text-center text-gray-400 text-sm">{xmlProofreadSearch ? 'Không tìm thấy kết quả.' : 'Chưa có dữ liệu.'}</td></tr>
                        ) : (
                          xmlProofreadFlatFiltered.map((item, flatIdx) => {
                            const isSelected = xmlProofreadSelected.has(item.flatIndex);
                            const statusKey = `${item.rowIndex}-${item.col}`;
                            const status: S5Status = xmlProofreadAiLoadingFlatIndex === item.flatIndex ? 'loading' : (xmlProofreadStatus[statusKey] ?? 'original');
                            const badge = S5_BADGE[status];
                            const isLoading = status === 'loading';
                            const currentTranslated = xmlProofreadRows[item.rowIndex]?.[item.col] ?? item.translated;
                            const rowId = item.rowIndex + 1;
                            const xmlQr = xmlQualityScores[rowId];
                            const xmlColSpan = 6 + (Object.keys(xmlQualityScores).length > 0 ? 1 : 0);
                            const isXmlExpanded = xmlQualityExpandedRowId === rowId;
                            const isFirstFlatRowForDataRow = xmlProofreadFlatFiltered.findIndex((r) => r.rowIndex === item.rowIndex) === flatIdx;
                            return (
                              <React.Fragment key={item.flatIndex}>
                                <tr className={`transition-colors ${isSelected ? 'bg-brand-50/40 dark:bg-brand-900/10' : 'bg-white dark:bg-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-700/20'}`}>
                                  <td className="px-4 py-3">
                                    <input type="checkbox" checked={isSelected} onChange={(e) => xmlProofreadFlatSelect(item.flatIndex, e.target.checked)} className="rounded border-gray-300 text-brand-600" />
                                  </td>
                                  <td className="px-4 py-3 text-gray-400 font-mono text-xs align-top pt-4">{item.flatIndex + 1}</td>
                                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 align-top max-w-[220px]">
                                    <div className="break-words leading-relaxed text-xs">{item.original}</div>
                                  </td>
                                  <td className="px-4 py-3 align-top max-w-[280px]">
                                    {isLoading ? (
                                      <div className="flex items-center gap-2 text-gray-400 py-1 text-xs">
                                        <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                        Đang hiệu đính…
                                      </div>
                                    ) : (
                                      <textarea
                                        value={currentTranslated}
                                        onChange={(e) => updateXmlProofreadCell(item.rowIndex, item.col, e.target.value)}
                                        rows={Math.max(2, Math.ceil(currentTranslated.length / 48))}
                                        className={`w-full px-2 py-1.5 text-sm border rounded-lg resize-none transition-colors bg-transparent focus:outline-none text-gray-900 dark:text-gray-100 ${
                                          status === 'ai-proofread' ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10'
                                          : status === 'edited' ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10'
                                          : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-brand-400 focus:bg-white dark:focus:bg-gray-900'
                                        }`}
                                      />
                                    )}
                                  </td>
                                  <td className="px-4 py-3 align-top pt-4">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
                                  </td>
                                  {Object.keys(xmlQualityScores).length > 0 && (
                                    <td className="px-4 py-3 align-top pt-3">
                                      {xmlQr ? (
                                        <button
                                          type="button"
                                          title={`${xmlQr.verdict} · Click để xem chi tiết`}
                                          onClick={() => setXmlQualityExpandedRowId(isXmlExpanded ? null : rowId)}
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80 ${getScoreBadgeCls(xmlQr.score)}`}
                                        >
                                          {xmlQr.score}
                                          <svg className={`w-3 h-3 transition-transform ${isXmlExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>
                                      ) : (
                                        <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                                      )}
                                    </td>
                                  )}
                                  <td className="px-4 py-3 align-top pt-3.5">
                                    <button type="button" disabled={isLoading || xmlProofreadBatchLoading} onClick={() => xmlProofreadRowAi(item.flatIndex)} className="text-xs text-green-600 dark:text-green-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                                      AI Hiệu Đính
                                    </button>
                                  </td>
                                </tr>
                                {isXmlExpanded && xmlQr && isFirstFlatRowForDataRow && (
                                  <tr className="bg-gray-50 dark:bg-gray-900/40">
                                    <td colSpan={xmlColSpan} className="px-6 py-3 border-t border-gray-100 dark:border-gray-700/50">
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                          <span className={`text-sm font-semibold ${getScoreBadgeCls(xmlQr.score)} px-2.5 py-0.5 rounded-full`}>
                                            {xmlQr.score}/100 — {xmlQr.verdict}
                                          </span>
                                          {xmlQr.issues.length === 0 && (
                                            <span className="text-xs text-green-600 dark:text-green-400">Không phát hiện vấn đề nào.</span>
                                          )}
                                        </div>
                                        {xmlQr.issues.length > 0 && (
                                          <ul className="space-y-1">
                                            {xmlQr.issues.map((issue, i) => (
                                              <li key={i} className="flex items-start gap-2 text-xs">
                                                <span className={`shrink-0 font-semibold uppercase ${getSeverityCls(issue.severity)}`}>
                                                  [{issue.severity === 'critical' ? 'Nghiêm trọng' : issue.severity === 'major' ? 'Quan trọng' : 'Nhỏ'}]
                                                </span>
                                                <span className="text-gray-700 dark:text-gray-300">{issue.message}</span>
                                                {issue.suggestion && (
                                                  <span className="text-gray-400 dark:text-gray-500 italic">→ {issue.suggestion}</span>
                                                )}
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                        {xmlQr.suggestions.length > 0 && (
                                          <div className="text-xs text-blue-600 dark:text-blue-400 pt-1">
                                            <span className="font-medium">Gợi ý: </span>
                                            {xmlQr.suggestions[0]}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer 100% giống Excel: text + hai nút Tải File (.xml / .csv) */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tải xuống hoặc chỉnh sửa trước khi tải.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={downloadXmlProofreadXml}>
                      <svg className="w-4 h-4 mr-1.5 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      Tải File .xml
                    </Button>
                  </div>
                </div>
              </div>
            );
          }
          const xmlDisplayColumns = xmlOriginalRows.length > 0
            ? xmlColsToShow.flatMap((k) => [`${k} (gốc)`, `${k} (đã dịch)`])
            : xmlColsToShow;
          const xmlMergedRows = xmlOriginalRows.length > 0
            ? xmlPreviewRows.map((transRow, i) => {
                const origRow = xmlOriginalRows[i] ?? {};
                const merged: Record<string, string> = {};
                xmlColsToShow.forEach((k) => {
                  merged[`${k} (gốc)`] = origRow[k] ?? '';
                  merged[`${k} (đã dịch)`] = transRow[k] ?? '';
                });
                return merged;
              })
            : xmlPreviewRows.map((row) => Object.fromEntries(xmlColsToShow.map((k) => [k, row[k] ?? ''])));

          /* Bước 5 xem trước XML — cấu trúc giống Excel (header + bảng chất lượng + nút) */
          const xmlQScores = Object.values(xmlQualityScores);
          const xmlQGood = xmlQScores.filter((q) => q.score >= 85).length;
          const xmlQOk = xmlQScores.filter((q) => q.score >= 70 && q.score < 85).length;
          const xmlQWarn = xmlQScores.filter((q) => q.score >= 60 && q.score < 70).length;
          const xmlQBad = xmlQScores.filter((q) => q.score < 60).length;
          const xmlQTotal = xmlQScores.length;
          const xmlQualityAvg = xmlQTotal > 0 ? Math.round(xmlQScores.reduce((a, b) => a + b.score, 0) / xmlQTotal) : null;

          return (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Kết quả Dịch thuật</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Đã dịch {xmlMergedRows.length} dòng
                  {xmlQTotal > 0 && <> · {xmlQTotal} dòng đã kiểm tra chất lượng</>}
                  {' · '}{sourceLang} → {targetLang}
                </p>
              </div>

              {/* Quality summary panel (giống Excel) */}
              {xmlQualityLoading && xmlQTotal === 0 && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 flex items-center gap-3">
                  <svg className="animate-spin w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  <p className="text-sm text-blue-700 dark:text-blue-300">Đang kiểm tra chất lượng…</p>
                </div>
              )}
              {xmlQTotal > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="text-center min-w-[72px]">
                      <div className={`text-4xl font-bold tabular-nums ${xmlQualityAvg !== null && xmlQualityAvg >= 85 ? 'text-green-600 dark:text-green-400' : xmlQualityAvg !== null && xmlQualityAvg >= 70 ? 'text-yellow-600 dark:text-yellow-400' : xmlQualityAvg !== null && xmlQualityAvg >= 60 ? 'text-orange-500 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
                        {xmlQualityAvg}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Điểm TB / 100</div>
                    </div>
                    <div className="flex-1 min-w-[200px] space-y-1.5">
                      {[
                        { label: 'Tốt (≥85)', count: xmlQGood, color: 'bg-green-500', textCls: 'text-green-600 dark:text-green-400' },
                        { label: 'Chấp nhận (70–84)', count: xmlQOk, color: 'bg-yellow-400', textCls: 'text-yellow-600 dark:text-yellow-400' },
                        { label: 'Cần cải thiện (60–69)', count: xmlQWarn, color: 'bg-orange-400', textCls: 'text-orange-500 dark:text-orange-400' },
                        { label: 'Cần dịch lại (<60)', count: xmlQBad, color: 'bg-red-500', textCls: 'text-red-600 dark:text-red-400' },
                      ].map(({ label, count, color, textCls }) => (
                        <div key={label} className="flex items-center gap-2 text-xs">
                          <span className="w-36 text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div className={`h-2 rounded-full transition-all duration-500 ${color}`} style={{ width: xmlQTotal > 0 ? `${(count / xmlQTotal) * 100}%` : '0%' }} />
                          </div>
                          <span className={`w-8 text-right font-medium tabular-nums ${textCls}`}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {(xmlPreviewLoading || (xmlOriginalRows.length > 0 && xmlOriginalLoading)) ? (
                <div className="flex items-center justify-center gap-2 py-12 text-gray-500 dark:text-gray-400 text-sm">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Đang tải xem trước…
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800">
                        {xmlDisplayColumns.map((k) => (
                          <th key={k} className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {xmlDisplayColumns.length > 0 && xmlMergedRows.length > 0 ? (
                        xmlMergedRows.map((row, i) => (
                          <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                            {xmlDisplayColumns.map((k) => (
                              <td key={k} className="px-4 py-2 text-gray-900 dark:text-gray-100 max-w-[200px] truncate align-top" title={String(row[k] ?? '')}>{row[k] ?? ''}</td>
                            ))}
                          </tr>
                        ))
                      ) : translatedXmlContent ? (
                        <tr><td colSpan={xmlDisplayColumns.length || 1} className="px-4 py-8 text-center text-gray-400 text-sm italic">Không thể hiển thị dạng bảng. Bạn có thể tải file hoặc dùng Hiệu đính.</td></tr>
                      ) : (
                        <tr><td colSpan={xmlDisplayColumns.length || 1} className="px-4 py-8 text-center text-gray-400 text-sm italic">Nội dung trống hoặc đang tải…</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <Button onClick={enterXmlProofread} disabled={!translatedXmlContent || xmlProofreadLoading}>Hiệu Đính</Button>
                <Button variant="secondary" onClick={downloadXmlFile} disabled={!translatedXmlContent}>
                  Tải File
                </Button>
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
          const qScores = Object.values(s5QualityScores);
          const qGood  = qScores.filter((q) => q.score >= 85).length;
          const qOk    = qScores.filter((q) => q.score >= 70 && q.score < 85).length;
          const qWarn  = qScores.filter((q) => q.score >= 60 && q.score < 70).length;
          const qBad   = qScores.filter((q) => q.score < 60).length;
          const qTotal = qScores.length;

          return (
            <div className="space-y-4">
              {/* Header */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Kết quả Dịch thuật</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Đã dịch {previewRows.length} dòng · {sourceLang} → {targetLang}
                </p>
              </div>

              {/* Quality summary panel */}
              {s5QualityLoading && qTotal === 0 && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 flex items-center gap-3">
                  <svg className="animate-spin w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  <p className="text-sm text-blue-700 dark:text-blue-300">Đang kiểm tra chất lượng {s5Rows.length} dòng…</p>
                </div>
              )}

              {qTotal > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
                  <div className="flex items-center gap-6 flex-wrap">
                    {/* Điểm trung bình */}
                    <div className="text-center min-w-[72px]">
                      <div className={`text-4xl font-bold tabular-nums ${s5QualityAvg !== null && s5QualityAvg >= 85 ? 'text-green-600 dark:text-green-400' : s5QualityAvg !== null && s5QualityAvg >= 70 ? 'text-yellow-600 dark:text-yellow-400' : s5QualityAvg !== null && s5QualityAvg >= 60 ? 'text-orange-500 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
                        {s5QualityAvg}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Điểm TB / 100</div>
                    </div>

                    {/* Phân bố */}
                    <div className="flex-1 min-w-[200px] space-y-1.5">
                      {[
                        { label: 'Tốt (≥85)',           count: qGood,  color: 'bg-green-500',  textCls: 'text-green-600 dark:text-green-400' },
                        { label: 'Chấp nhận (70–84)',   count: qOk,    color: 'bg-yellow-400', textCls: 'text-yellow-600 dark:text-yellow-400' },
                        { label: 'Cần cải thiện (60–69)', count: qWarn, color: 'bg-orange-400', textCls: 'text-orange-500 dark:text-orange-400' },
                        { label: 'Cần dịch lại (<60)',  count: qBad,   color: 'bg-red-500',    textCls: 'text-red-600 dark:text-red-400' },
                      ].map(({ label, count, color, textCls }) => (
                        <div key={label} className="flex items-center gap-2 text-xs">
                          <span className="w-36 text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${color}`}
                              style={{ width: qTotal > 0 ? `${(count / qTotal) * 100}%` : '0%' }}
                            />
                          </div>
                          <span className={`w-8 text-right font-medium tabular-nums ${textCls}`}>{count}</span>
                        </div>
                      ))}
                    </div>

                    {/* Nút hành động */}
                    {(qBad > 0 || qWarn > 0) && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button size="sm" onClick={() => setS5ProofMode(true)}>
                          Hiệu đính {qBad + qWarn} dòng lỗi
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bảng dữ liệu */}
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

              <div className="flex gap-2 flex-wrap">
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
                {s5QualityAvg !== null && (
                  <span className={`ml-2 font-medium ${s5QualityAvg >= 85 ? 'text-green-600 dark:text-green-400' : s5QualityAvg >= 70 ? 'text-yellow-600 dark:text-yellow-400' : s5QualityAvg >= 60 ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
                    &bull; Chất lượng TB: {s5QualityAvg}/100
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
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
              <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} disabled={!sourceLang} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60">
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
                    {s5QualityCheckedCount > 0 && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-20">ĐIỂM</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-24">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {s5Filtered.length === 0 && (
                    <tr><td colSpan={s5QualityCheckedCount > 0 ? 7 : 6} className="px-4 py-8 text-center text-gray-400 text-sm">{s5Search ? 'Không tìm thấy kết quả.' : 'Chưa có dữ liệu.'}</td></tr>
                  )}
                  {s5Filtered.map((row) => {
                    const badge = S5_BADGE[row.status];
                    const isLoading = row.status === 'loading';
                    const qr = s5QualityScores[row.id];
                    const isExpanded = s5QualityExpanded === row.id;
                    const colSpan = s5QualityCheckedCount > 0 ? 7 : 6;
                    return (
                      <React.Fragment key={row.id}>
                        <tr className={`transition-colors ${row.selected ? 'bg-brand-50/40 dark:bg-brand-900/10' : 'bg-white dark:bg-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-700/20'}`}>
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
                          {/* ── Cột ĐIỂM (chỉ hiện sau khi đã chạy quality check) ── */}
                          {s5QualityCheckedCount > 0 && (
                            <td className="px-4 py-3 align-top pt-3">
                              {qr ? (
                                <button
                                  type="button"
                                  title={`${qr.verdict} · Click để xem chi tiết`}
                                  onClick={() => setS5QualityExpanded(isExpanded ? null : row.id)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80 ${getScoreBadgeCls(qr.score)}`}
                                >
                                  {qr.score}
                                  <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              ) : (
                                <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3 align-top pt-3.5">
                            <div className="flex flex-col gap-1">
                              <button type="button" disabled={isLoading || s5BatchLoading} onClick={() => s5ProofreadRow(row.id)} className="text-xs text-green-600 dark:text-green-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                                AI Hiệu Đính
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* ── Expanded quality details row ── */}
                        {isExpanded && qr && (
                          <tr className="bg-gray-50 dark:bg-gray-900/40">
                            <td colSpan={colSpan} className="px-6 py-3 border-t border-gray-100 dark:border-gray-700/50">
                              <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                  <span className={`text-sm font-semibold ${getScoreBadgeCls(qr.score)} px-2.5 py-0.5 rounded-full`}>
                                    {qr.score}/100 — {qr.verdict}
                                  </span>
                                  {qr.issues.length === 0 && (
                                    <span className="text-xs text-green-600 dark:text-green-400">Không phát hiện vấn đề nào.</span>
                                  )}
                                </div>
                                {qr.issues.length > 0 && (
                                  <ul className="space-y-1">
                                    {qr.issues.map((issue, i) => (
                                      <li key={i} className="flex items-start gap-2 text-xs">
                                        <span className={`shrink-0 font-semibold uppercase ${getSeverityCls(issue.severity)}`}>
                                          [{issue.severity === 'critical' ? 'Nghiêm trọng' : issue.severity === 'major' ? 'Quan trọng' : 'Nhỏ'}]
                                        </span>
                                        <span className="text-gray-700 dark:text-gray-300">{issue.message}</span>
                                        {issue.suggestion && (
                                          <span className="text-gray-400 dark:text-gray-500 italic">→ {issue.suggestion}</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {qr.suggestions.length > 0 && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 pt-1">
                                    <span className="font-medium">Gợi ý: </span>
                                    {qr.suggestions[0]}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
