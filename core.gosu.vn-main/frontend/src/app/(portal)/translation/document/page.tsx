'use client';

import React, { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { jobAPI, promptsAPI, languageAPI, proofreadAPI, qualityCheckAPI } from '@/lib/api';
import type { QualityCheckResult } from '@/lib/api';
import { getLanguageNameVi } from '@/lib/languageNamesVi';
import { useToastContext } from '@/context/ToastContext';
import { authStore } from '@/lib/auth';

const MAX_CHARS = 5000;

interface PromptItem {
  id: number;
  name: string;
  content: string;
  is_active: boolean;
}

interface LanguageItem {
  id: number;
  code: string;
  name: string;
  is_active?: boolean;
}

/** Cặp ngôn ngữ từ API (mỗi item có source_language, target_language) */
interface LanguagePairItem {
  id: number;
  source_language: LanguageItem;
  target_language: LanguageItem;
  is_bidirectional?: boolean;
  is_active?: boolean;
}

export default function TranslateDemoPage() {
  const toast = useToastContext();
  const [text, setText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('');
  const [targetLang, setTargetLang] = useState('');
  const [translationStyle, setTranslationStyle] = useState('');
  const [context, setContext] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState<number | ''>('');
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  /** Tất cả ngôn ngữ từ Quản lý ngôn ngữ (cho dropdown nguồn) */
  const [sourceLanguageOptions, setSourceLanguageOptions] = useState<LanguageItem[]>([]);
  /** Map sourceCode -> danh sách ngôn ngữ đích được hỗ trợ (từ cặp ngôn ngữ) */
  const [targetOptionsBySource, setTargetOptionsBySource] = useState<Record<string, LanguageItem[]>>({});
  /** Các phong cách dịch (unique từ trường translation_style trong thể loại game) */
  const [translationStyleOptions, setTranslationStyleOptions] = useState<string[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [loadingLangAndPairs, setLoadingLangAndPairs] = useState(true);
  const [loadingGameCategories, setLoadingGameCategories] = useState(true);
  const [loading, setLoading] = useState(false);
  const [proofreadLoading, setProofreadLoading] = useState(false);
  const [qualityResult, setQualityResult] = useState<QualityCheckResult | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityExpanded, setQualityExpanded] = useState(false);

  const charCount = text.length;


  useEffect(() => {
    let mounted = true;
    promptsAPI
      .getList({ skip: 0, limit: 100, is_active: true })
      .then((res: any) => {
        if (mounted && res?.data && Array.isArray(res.data)) {
          setPrompts(res.data);
          const defaultP = res.data.find((p: any) => p.is_default);
          if (defaultP) setSelectedPromptId(defaultP.id);
        }
      })
      .catch(() => {
        if (mounted) setPrompts([]);
      })
      .finally(() => {
        if (mounted) setLoadingPrompts(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setTranslationStyleOptions(['Tự nhiên, mượt mà', 'Sát nghĩa, giữ cấu trúc', 'Đầy đủ, chi tiết', 'Ngắn gọn, súc tích', 'Văn phong trang trọng']);
    setLoadingGameCategories(false);
  }, []);

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
        // Không gán mặc định: mỗi lần vào trang luôn hiển thị "Chọn ngôn ngữ nguồn" và "Chọn ngôn ngữ đích"
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
    return () => {
      mounted = false;
    };
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    if (v.length <= MAX_CHARS) setText(v);
  };

  const targetOptions = targetOptionsBySource[sourceLang] ?? [];

  const handleSourceLangChange = (newSource: string) => {
    setSourceLang(newSource);
    const allowed = targetOptionsBySource[newSource] ?? [];
    // Không autofill ngôn ngữ đích: chỉ giữ nếu vẫn hợp lệ, không thì xóa để user chọn thủ công
    setTargetLang((prev) => (allowed.some((l) => l.code === prev) ? prev : ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content) {
      toast.error('Vui lòng nhập nội dung cần dịch.');
      return;
    }
    if (!sourceLang || !targetLang) {
      toast.error('Vui lòng chọn ngôn ngữ nguồn và ngôn ngữ đích.');
      return;
    }
    if (sourceLang === targetLang) {
      toast.error('Ngôn ngữ nguồn và đích phải khác nhau.');
      return;
    }
    let userId = 1;
    try {
      const user = await authStore.getCurrentUser();
      if (user?.id) userId = user.id;
    } catch {
      // fallback
    }

    setLoading(true);
    setTranslatedText('');
    setQualityResult(null);
    setQualityExpanded(false);

    const jobCode = `DIRECT-${Date.now()}`;
    const payload = {
      text: content,
      source_lang: sourceLang,
      target_lang: targetLang,
      style: translationStyle,
      context: context || undefined,
      use_default_prompt: !selectedPromptId,
      prompt_id: selectedPromptId || undefined,
    };

    try {
      // Tạo job pending — worker sẽ xử lý theo priority
      const jobRes = await jobAPI.create({
        job_code: jobCode,
        job_type: 'translation',
        status: 'pending',
        user_id: userId,
        source_lang: sourceLang,
        target_lang: targetLang,
        payload,
        progress: 0,
      });
      const jobId: number | null = jobRes.data?.id ?? null;

      if (!jobId) {
        toast.error('Không thể tạo job dịch thuật.');
        return;
      }

      // Poll kết quả từ worker (mỗi 2 giây, tối đa 10 phút)
      const MAX_WAIT_MS = 10 * 60 * 1000;
      const startTime = Date.now();

      while (Date.now() - startTime < MAX_WAIT_MS) {
        await new Promise<void>((r) => setTimeout(r, 2000));
        const jobStatusRes = await jobAPI.get(jobId);
        const job = jobStatusRes.data;

        if (job.status === 'completed') {
          const translated = job.result?.translated ?? '';
          setTranslatedText(translated);
          toast.success('Dịch thành công!');
          // Tự động chấm điểm chất lượng
          if (translated && content) {
            setQualityLoading(true);
            qualityCheckAPI.check({
              source: content,
              translated,
              source_lang: sourceLang,
              target_lang: targetLang,
            }).then((res) => {
              setQualityResult(res.data);
            }).catch(() => {}).finally(() => setQualityLoading(false));
          }
          return;
        }
        if (job.status === 'failed') {
          toast.error(job.error_message || 'Dịch thất bại. Vui lòng thử lại.');
          return;
        }
        if (job.status === 'cancelled') {
          toast.error('Job đã bị hủy.');
          return;
        }
      }

      toast.error('Hết thời gian chờ. Vui lòng kiểm tra lại trong Quản lý Jobs.');
    } catch (err: any) {
      const data = err.response?.data;
      const detail = data?.detail;
      let msg: string;
      if (Array.isArray(detail)) {
        msg = detail.map((x: any) => x.msg || x).join(', ');
      } else if (typeof detail === 'string' && detail) {
        msg = detail;
      } else {
        msg = data?.message || err.message || 'Có lỗi xảy ra.';
      }
      toast.error(msg || 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Dịch Trực Tiếp
        </h1>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Dịch văn bản trực tiếp bằng AI.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Cài đặt Dịch thuật
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ngôn ngữ nguồn <span className="text-red-500">*</span>
              </label>
              <select
                value={sourceLang}
                onChange={(e) => handleSourceLangChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                disabled={loadingLangAndPairs}
              >
                <option value="">Chọn ngôn ngữ nguồn</option>
                {sourceLanguageOptions.map((l) => (
                  <option key={l.id} value={l.code}>{getLanguageNameVi(l.code, l.name)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ngôn ngữ đích <span className="text-red-500">*</span>
              </label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                disabled={loadingLangAndPairs}
              >
                <option value="">Chọn ngôn ngữ đích</option>
                {targetOptions.map((l) => (
                  <option key={l.id} value={l.code}>{getLanguageNameVi(l.code, l.name)}</option>
                ))}
              </select>
            </div>
          </div>
          {sourceLanguageOptions.length === 0 && !loadingLangAndPairs && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Chưa có ngôn ngữ nào. Vào Quản lý Ngôn ngữ để thêm ngôn ngữ.
            </p>
          )}
          {sourceLang !== '' && targetOptions.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Không có cặp dịch cho ngôn ngữ nguồn đã chọn. Vào Quản lý Ngôn ngữ → Cặp ngôn ngữ để tạo.
            </p>
          )}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phong cách dịch <span className="text-gray-400 font-normal">(Tùy chọn)</span>
            </label>
            <select
              value={translationStyle}
              onChange={(e) => setTranslationStyle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              disabled={loadingGameCategories}
            >
              <option value="">-- Chọn phong cách dịch --</option>
              {translationStyleOptions.map((style) => (
                <option key={style} value={style}>{style}</option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ngữ cảnh <span className="text-gray-400 font-normal">(Tùy chọn)</span>
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Thêm ngữ cảnh để cải thiện chất lượng dịch thuật..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Prompt Dịch thuật
            </label>
            <select
              value={selectedPromptId}
              onChange={(e) => setSelectedPromptId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              disabled={loadingPrompts}
            >
              <option value="">Prompt mặc định</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Văn bản gốc</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{charCount}/{MAX_CHARS}</span>
            </div>
            <div className="relative h-[280px]">
              <textarea
                value={text}
                onChange={handleTextChange}
                placeholder="Nhập văn bản cần dịch..."
                className="w-full h-full min-h-[280px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <div className="absolute bottom-2 right-2 text-purple-400 dark:text-purple-500 opacity-70" title="AI hỗ trợ">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading ? 'Đang dịch...' : 'Dịch'}
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Văn bản đã dịch</span>
              {translatedText && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(translatedText)
                      .then(() => toast.success('Đã sao chép.'))
                      .catch(() => toast.error('Không thể sao chép.'));
                  }}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Sao chép
                </button>
              )}
            </div>
            <div className="relative h-[280px]">
              <textarea
                value={translatedText}
                onChange={(e) => setTranslatedText(e.target.value)}
                placeholder="Văn bản đã dịch sẽ hiển thị ở đây..."
                className="w-full h-full min-h-[280px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white placeholder-gray-500 resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {proofreadLoading && (
                <div className="absolute inset-0 bg-white/60 dark:bg-gray-800/60 rounded-lg flex items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Đang hiệu đính…
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 right-2 text-purple-400 dark:text-purple-500 opacity-70" title="AI hỗ trợ">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            </div>
            {/* Footer: điểm bên trái, nút bên phải */}
            <div className="mt-3 flex items-start justify-between gap-3 min-h-[32px]">

              {/* ── Điểm chất lượng (trái) ── */}
              <div className="flex-1 min-w-0">
                {qualityLoading && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 pt-1">
                    <svg className="animate-spin w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Đang chấm điểm…
                  </div>
                )}
                {qualityResult && !qualityLoading && (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setQualityExpanded((v) => !v)}
                      className="flex items-center gap-2 group"
                    >
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        qualityResult.score >= 85
                          ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
                          : qualityResult.score >= 70
                          ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'
                          : qualityResult.score >= 60
                          ? 'bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'
                          : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                      }`}>
                        {qualityResult.score}/100
                        <svg className={`w-3 h-3 transition-transform ${qualityExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                        </svg>
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                        {qualityResult.verdict}
                      </span>
                    </button>
                    {qualityExpanded && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 space-y-1.5">
                        {qualityResult.issues.length === 0 ? (
                          <p className="text-xs text-green-600 dark:text-green-400">Không phát hiện vấn đề nào.</p>
                        ) : (
                          qualityResult.issues.map((issue, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-xs">
                              <span className={`shrink-0 font-semibold ${
                                issue.severity === 'critical' ? 'text-red-600 dark:text-red-400'
                                : issue.severity === 'major' ? 'text-orange-500 dark:text-orange-400'
                                : 'text-yellow-600 dark:text-yellow-400'
                              }`}>
                                {issue.severity === 'critical' ? '[Nghiêm trọng]' : issue.severity === 'major' ? '[Quan trọng]' : '[Nhỏ]'}
                              </span>
                              <span className="text-gray-700 dark:text-gray-300">{issue.message}</span>
                            </div>
                          ))
                        )}
                        {qualityResult.suggestions.length > 0 && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 pt-0.5 border-t border-gray-200 dark:border-gray-700 mt-1">
                            <span className="font-medium">Gợi ý: </span>{qualityResult.suggestions[0]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Nút AI Hiệu Đính (phải) ── */}
              <Button
                type="button"
                variant="secondary"
                isLoading={proofreadLoading}
                disabled={proofreadLoading || loading || !translatedText.trim() || !text.trim() || !sourceLang || !targetLang}
                onClick={async () => {
                  if (!sourceLang || !targetLang) { toast.error('Vui lòng chọn ngôn ngữ để hiệu đính.'); return; }
                  setProofreadLoading(true);
                  try {
                    const res = await proofreadAPI.proofreadRow({
                      original: text.trim(),
                      translated: translatedText.trim(),
                      source_lang: sourceLang,
                      target_lang: targetLang,
                    });
                    const proofread = res.data.proofread;
                    setTranslatedText(proofread);
                    toast.success('Hiệu đính AI hoàn tất.');
                    if (proofread && text.trim()) {
                      setQualityLoading(true);
                      setQualityResult(null);
                      qualityCheckAPI.check({
                        source: text.trim(),
                        translated: proofread,
                        source_lang: sourceLang,
                        target_lang: targetLang,
                      }).then((res2) => setQualityResult(res2.data))
                        .catch(() => {}).finally(() => setQualityLoading(false));
                    }
                  } catch (err: any) {
                    toast.error(err?.response?.data?.detail ?? 'Hiệu đính AI thất bại.');
                  } finally {
                    setProofreadLoading(false);
                  }
                }}
              >
                <svg className="w-4 h-4 mr-1.5 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                AI Hiệu Đính
              </Button>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
