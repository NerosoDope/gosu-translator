'use client';

import React, { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { jobAPI, translateAPI, promptsAPI, languageAPI, gameCategoryAPI } from '@/lib/api';
import { getLanguageNameVi } from '@/lib/languageNamesVi';
import { useToastContext } from '@/context/ToastContext';
import { authStore } from '@/lib/auth';

const MAX_CHARS = 5000;

interface GameCategoryItem {
  id: number;
  name: string;
  translation_style?: string | null;
  is_active?: boolean;
}

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

  const charCount = text.length;

  useEffect(() => {
    let mounted = true;
    promptsAPI
      .getList({ skip: 0, limit: 100, is_active: true })
      .then((res: any) => {
        if (mounted && res?.data && Array.isArray(res.data)) {
          setPrompts(res.data);
          if (res.data.length > 0 && !selectedPromptId) {
            setSelectedPromptId(res.data[0].id);
          }
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
    let mounted = true;
    gameCategoryAPI
      .getList({ limit: 100, is_active: true })
      .then((res: any) => {
        const items: GameCategoryItem[] = res?.data?.items ?? [];
        if (!mounted || !Array.isArray(items)) return;
        const set = new Set<string>();
        items.forEach((c) => {
          const s = c.translation_style?.trim();
          if (s) set.add(s);
        });
        setTranslationStyleOptions(Array.from(set));
      })
      .catch(() => {
        if (mounted) setTranslationStyleOptions([]);
      })
      .finally(() => {
        if (mounted) setLoadingGameCategories(false);
      });
    return () => {
      mounted = false;
    };
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
    if (!selectedPromptId) {
      toast.error('Vui lòng chọn một prompt dịch thuật.');
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
    try {
      const res = await translateAPI.translate({
        text: content,
        source_lang: String(sourceLang ?? ''),
        target_lang: String(targetLang ?? ''),
        prompt_id: selectedPromptId ? Number(selectedPromptId) : undefined,
        context: context?.trim() || undefined,
        style: translationStyle?.trim() || undefined,
      });
      const translated = res.data?.translated_text ?? '';

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

      const jobId = jobRes.data?.id;
      if (jobId) {
        await jobAPI.update(jobId, {
          status: 'completed',
          progress: 100,
          result: { translated },
        });
      }

      setTranslatedText(translated);
      toast.success('Dịch thành công!');
    } catch (err: any) {
      const data = err.response?.data;
      const detail = data?.detail;
      let msg: string;
      if (Array.isArray(detail)) {
        msg = detail.map((x: any) => x.msg || x).join(', ');
      } else if (typeof detail === 'string' && detail) {
        msg = detail;
      } else if (err.response?.status === 503) {
        msg = 'Dịch tạm thời không khả dụng. Vui lòng cấu hình Gemini API Key trong Cài đặt (Settings).';
      } else if (err.response?.status === 400) {
        msg = typeof detail === 'string' ? detail : (data?.message || err.message || 'Yêu cầu không hợp lệ. Vui lòng kiểm tra: đã nhập văn bản, đã chọn ngôn ngữ nguồn và đích khác nhau; nếu vẫn lỗi, cấu hình Gemini API Key trong Cài đặt.');
      } else {
        msg = (typeof data?.detail === 'string' ? data.detail : null) || data?.message || err.message || 'Có lỗi xảy ra.';
      }
      toast.error(msg || 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Dịch Trực Tiếp
        </h1>
        <span className="text-gray-400 cursor-help" title="Dịch văn bản bằng AI, prompt lấy từ Quản lý Prompts">?</span>
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
              {translationStyleOptions.length === 0 && !loadingGameCategories ? (
                <option value="">Chưa có phong cách</option>
              ) : null}
              {translationStyleOptions.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
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
              Prompt Dịch thuật <span className="text-red-500">*</span>
            </label>
            <select
              value={prompts.length > 0 ? selectedPromptId : ''}
              onChange={(e) => setSelectedPromptId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              disabled={loadingPrompts}
            >
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {prompts.length === 0 && !loadingPrompts && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Chưa có prompt nào. Vào Quản lý Prompts để tạo prompt dịch thuật.
              </p>
            )}
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
            </div>
            <div className="relative h-[280px]">
              <textarea
                readOnly
                value={translatedText}
                placeholder="Văn bản đã dịch sẽ hiển thị ở đây..."
                className="w-full h-full min-h-[280px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white placeholder-gray-500 resize-none"
              />
              <div className="absolute bottom-2 right-2 text-purple-400 dark:text-purple-500 opacity-70" title="AI hỗ trợ">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
