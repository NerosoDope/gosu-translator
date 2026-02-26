import React, { useState, useEffect } from 'react';
import { useCreateGameGlossary, useUpdateGameGlossary } from '@/hooks/useGameGlossary';
import { gameAPI, languageAPI } from '@/lib/api';
import { getLanguageNameVi } from '@/lib/languageNamesVi';
import { useToastContext } from '@/context/ToastContext';

// Types
interface GameGlossaryItem {
  id: number;
  term: string;
  translated_term: string;
  language_pair: string;
  game_id: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

interface Game {
  id: number;
  name: string;
}

interface Language {
  id: number;
  name: string;
  code: string;
}

interface LanguagePairItem {
  id: number;
  source_language: Language;
  target_language: Language;
  is_bidirectional?: boolean;
}

interface GameGlossaryFormProps {
  item?: GameGlossaryItem;
  onSuccess: () => void;
  onCancel: () => void;
  gameId?: number; // Add gameId prop
}

export default function GameGlossaryForm({ item, onSuccess, onCancel, gameId: propGameId }: GameGlossaryFormProps) {
  const [term, setTerm] = useState(item?.term || '');
  const [translatedTerm, setTranslatedTerm] = useState(item?.translated_term || '');
  const [sourceLanguage, setSourceLanguage] = useState(item?.language_pair.split('-')[0] || '');
  const [targetLanguage, setTargetLanguage] = useState(item?.language_pair.split('-')[1] || '');
  const [gameId, setGameId] = useState(propGameId?.toString() || item?.game_id?.toString() || '');
  const [usageCount, setUsageCount] = useState(item?.usage_count || 0);
  const [isActive, setIsActive] = useState(item?.is_active ?? true);

  // Form validation
  const [termError, setTermError] = useState('');
  const [translatedTermError, setTranslatedTermError] = useState('');
  const [languagePairError, setLanguagePairError] = useState('');
  const [gameIdError, setGameIdError] = useState('');

  // Dropdown data
  const [games, setGames] = useState<Game[]>([]);
  const [sourceLanguageOptions, setSourceLanguageOptions] = useState<Language[]>([]);
  const [targetOptionsBySource, setTargetOptionsBySource] = useState<Record<string, Language[]>>({});
  const [loadingLangAndPairs, setLoadingLangAndPairs] = useState(true);

  // Hooks
  const createGameGlossary = useCreateGameGlossary();
  const updateGameGlossary = useUpdateGameGlossary();
  const toast = useToastContext();

  // Load games (backend trả về { data: items, total, ... } hoặc mảng)
  useEffect(() => {
    const loadGames = async () => {
      try {
        const result = await gameAPI.getList({ per_page: 100, is_active: true });
        const body = result.data;
        const list = Array.isArray(body) ? body : (body?.data ?? []);
        setGames(list);
      } catch (error) {
        console.error('Failed to load games in GameGlossaryForm:', error);
      }
    };
    loadGames();
  }, []);

  // Set gameId if provided as prop
  useEffect(() => {
    if (propGameId !== undefined) {
      setGameId(propGameId.toString());
    }
  }, [propGameId]);

  // Load languages (nguồn = tất cả) + cặp ngôn ngữ (đích theo nguồn đã chọn)
  useEffect(() => {
    let mounted = true;
    Promise.all([
      languageAPI.getList({ limit: 100, is_active: true }),
      languageAPI.getPairs({ limit: 100, is_active: true }),
    ])
      .then(([langRes, pairsRes]: any[]) => {
        if (!mounted) return;
        const langItems: Language[] = langRes?.data?.items ?? [];
        const pairItems: LanguagePairItem[] = pairsRes?.data?.items ?? [];
        setSourceLanguageOptions(langItems);
        const bySource: Record<string, Language[]> = {};
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

  // Validation
  const validateTerm = (value: string) => {
    if (!value.trim()) {
      setTermError('Thuật ngữ gốc là bắt buộc');
      return false;
    }
    if (value.length < 2) {
      setTermError('Thuật ngữ gốc phải có ít nhất 2 ký tự');
      return false;
    }
    setTermError('');
    return true;
  };

  const validateTranslatedTerm = (value: string) => {
    if (!value.trim()) {
      setTranslatedTermError('Thuật ngữ dịch là bắt buộc');
      return false;
    }
    if (value.length < 2) {
      setTranslatedTermError('Thuật ngữ dịch phải có ít nhất 2 ký tự');
      return false;
    }
    setTranslatedTermError('');
    return true;
  };

  const targetOptions = targetOptionsBySource[sourceLanguage] ?? [];
  const handleSourceLangChange = (newSource: string) => {
    setSourceLanguage(newSource);
    const allowed = targetOptionsBySource[newSource] ?? [];
    const effectiveTarget = allowed.some((l) => l.code === targetLanguage) ? targetLanguage : (allowed[0]?.code ?? '');
    setTargetLanguage(effectiveTarget);
    validateLanguagePair(newSource, effectiveTarget);
  };

  const validateLanguagePair = (source: string, target: string) => {
    if (!source || !target) {
      setLanguagePairError('');
      return false;
    }
    if (source === target) {
      setLanguagePairError('Ngôn ngữ nguồn và ngôn ngữ đích không được giống nhau');
      return false;
    }
    setLanguagePairError('');
    return true;
  };

  const validateGameId = (value: string) => {
    if (!value) {
      setGameIdError('Game là bắt buộc');
      return false;
    }
    setGameIdError('');
    return true;
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isTermValid = validateTerm(term);
    const isTranslatedTermValid = validateTranslatedTerm(translatedTerm);
    const isLanguagePairValid = validateLanguagePair(sourceLanguage, targetLanguage);
    const isGameIdValid = validateGameId(gameId);

    if (!isTermValid || !isTranslatedTermValid || !isLanguagePairValid || !isGameIdValid) {
      return;
    }

    try {
      const formData = {
        term: term.trim(),
        translated_term: translatedTerm.trim(),
        language_pair: `${sourceLanguage}-${targetLanguage}`,
        game_id: parseInt(gameId),
        usage_count: usageCount,
        is_active: isActive,
      };

      if (item?.id) {
        await updateGameGlossary.mutateAsync({ id: item.id, data: formData });
        toast.success('Cập nhật thuật ngữ game thành công!');
      } else {
        await createGameGlossary.mutateAsync(formData);
        toast.success('Tạo thuật ngữ game mới thành công!');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Error saving game glossary:', error);

      if (!error.response) {
        const networkError = error.message || 'Không thể kết nối đến server. Vui lòng kiểm tra backend server có đang chạy không.';
        toast.error(networkError);
        return;
      }

      const responseData = error?.response?.data;
      let errorMessage = 'Không thể tạo/cập nhật thuật ngữ game. Vui lòng thử lại.';

      if (responseData) {
        if (responseData.error?.message) {
          errorMessage = responseData.error.message;
        } else if (responseData.detail) {
          errorMessage = typeof responseData.detail === 'string'
            ? responseData.detail
            : JSON.stringify(responseData.detail);
        } else if (responseData.message) {
          errorMessage = responseData.message;
        }
      }

      if (!errorMessage || errorMessage === 'Không thể tạo/cập nhật thuật ngữ game. Vui lòng thử lại.') {
        errorMessage = error?.message || errorMessage;
      }

      toast.error(errorMessage);

      if (responseData?.error?.details) {
        const details = responseData.error.details;
        if (Array.isArray(details)) {
          details.forEach((err: any) => {
            if (err.loc && err.loc.includes('term')) {
              setTermError(err.msg || 'Thuật ngữ gốc không hợp lệ');
            }
            if (err.loc && err.loc.includes('translated_term')) {
              setTranslatedTermError(err.msg || 'Thuật ngữ dịch không hợp lệ');
            }
            if (err.loc && err.loc.includes('language_pair')) {
              setLanguagePairError(err.msg || 'Cặp ngôn ngữ không hợp lệ');
            }
            if (err.loc && err.loc.includes('game_id')) {
              setGameIdError(err.msg || 'Game không hợp lệ');
            }
          });
        }
      } else if (error?.response?.data?.errors) {
        const errors = error.response.data.errors;
        if (errors.term) {
          setTermError(Array.isArray(errors.term) ? errors.term[0] : errors.term);
        }
        if (errors.translated_term) {
          setTranslatedTermError(Array.isArray(errors.translated_term) ? errors.translated_term[0] : errors.translated_term);
        }
        if (errors.language_pair) {
          setLanguagePairError(Array.isArray(errors.language_pair) ? errors.language_pair[0] : errors.language_pair);
        }
        if (errors.game_id) {
          setGameIdError(Array.isArray(errors.game_id) ? errors.game_id[0] : errors.game_id);
        }
      }
    }
  };

  const isLoading = createGameGlossary.isLoading || updateGameGlossary.isLoading;

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Column - Form Inputs */}
      <div className="space-y-6">
        {/* Term */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Thuật ngữ gốc <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={term}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setTerm(e.target.value);
              validateTerm(e.target.value);
            }}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors ${
              termError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            } dark:bg-gray-700 dark:text-gray-100`}
            placeholder="Nhập thuật ngữ gốc (vd: Hello, Save Game, Level Up)"
            maxLength={255}
            required
          />
          {termError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {termError}
            </p>
          )}
        </div>

        {/* Translated Term */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Thuật ngữ dịch <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={translatedTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setTranslatedTerm(e.target.value);
              validateTranslatedTerm(e.target.value);
            }}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors ${
              translatedTermError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            } dark:bg-gray-700 dark:text-gray-100`}
            placeholder="Nhập thuật ngữ dịch (vd: Xin chào, Lưu Game, Lên cấp)"
            maxLength={255}
            required
          />
          {translatedTermError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {translatedTermError}
            </p>
          )}
        </div>

        {/* Source Language */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Ngôn ngữ nguồn <span className="text-red-500">*</span>
          </label>
          <select
            value={sourceLanguageOptions.length > 0 ? sourceLanguage : ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSourceLangChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors ${
              languagePairError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            } dark:bg-gray-700 dark:text-gray-100`}
            required
            disabled={loadingLangAndPairs}
          >
            <option value="">Chọn ngôn ngữ nguồn</option>
            {sourceLanguageOptions.map((lang) => (
              <option key={lang.id} value={lang.code}>
                {getLanguageNameVi(lang.code, lang.name)}
              </option>
            ))}
          </select>
          {languagePairError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {languagePairError}
            </p>
          )}
        </div>

        {/* Target Language */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Ngôn ngữ đích <span className="text-red-500">*</span>
          </label>
          <select
            value={targetOptions.length > 0 ? targetLanguage : ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setTargetLanguage(e.target.value);
              validateLanguagePair(sourceLanguage, e.target.value);
            }}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors ${
              languagePairError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            } dark:bg-gray-700 dark:text-gray-100`}
            required
            disabled={loadingLangAndPairs}
          >
            <option value="">Chọn ngôn ngữ đích</option>
            {targetOptions.map((lang) => (
              <option key={lang.id} value={lang.code}>
                {getLanguageNameVi(lang.code, lang.name)}
              </option>
            ))}
          </select>
          {sourceLanguageOptions.length > 0 && sourceLanguage !== '' && targetOptions.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Không có cặp dịch cho ngôn ngữ nguồn đã chọn. Vào Quản lý Ngôn ngữ → Cặp ngôn ngữ để tạo.
            </p>
          )}
          {languagePairError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {languagePairError}
            </p>
          )}
        </div>

        {/* Game */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Game <span className="text-red-500">*</span>
          </label>
          <select
            value={gameId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setGameId(e.target.value);
              validateGameId(e.target.value);
            }}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors ${
              gameIdError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            } dark:bg-gray-700 dark:text-gray-100`}
            required
            disabled={!!propGameId} // Disable if propGameId is provided
          >
            <option value="">Chọn game</option>
            {games.map((game: Game) => (
              <option key={game.id} value={game.id.toString()}>
                {game.name}
              </option>
            ))}
          </select>
          {gameIdError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {gameIdError}
            </p>
          )}
        </div>

        {/* Usage Count */}
        <div className="space-y-2">
          <input
            hidden
            type="number"
            value={usageCount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsageCount(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
            min="0"
            placeholder="0"
          />
        </div>

        {/* Active Status */}
        <div className="space-y-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsActive(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Thuật ngữ hoạt động
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Thuật ngữ này có thể được sử dụng trong quá trình dịch thuật.
              </p>
            </div>
          </label>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isLoading || !!termError || !!translatedTermError || !!languagePairError || !!gameIdError || !term.trim() || !translatedTerm.trim() || !sourceLanguage || !targetLanguage || !gameId}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Đang lưu...
              </>
            ) : (
              item ? 'Cập nhật thuật ngữ' : 'Tạo thuật ngữ mới'
            )}
          </button>
        </div>
      </div>

      {/* Right Column - Preview */}
      <div className="lg:sticky lg:top-6">
        {(term && translatedTerm && sourceLanguage && targetLanguage && gameId && !termError && !translatedTermError && !languagePairError && !gameIdError) ? (
          <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-teal-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800 shadow-lg">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg mr-3">
                <span className="text-xl">📚</span>
              </div>
              <h4 className="text-lg font-semibold text-green-900 dark:text-green-100">
                Xem trước thuật ngữ
              </h4>
            </div>

            <div className="space-y-4 mb-4">
              <div>
                <div className="font-bold text-green-900 dark:text-green-100 text-lg mb-1">
                  {term || 'THUẬT NGỮ GỐC'}
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  ↓ dịch sang ↓
                </div>
                <div className="font-bold text-green-900 dark:text-green-100 text-lg mt-1">
                  {translatedTerm || 'THUẬT NGỮ DỊCH'}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-900 dark:text-green-100">
                  Cặp ngôn ngữ:
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                  {`${sourceLanguage} → ${targetLanguage}`}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-900 dark:text-green-100">
                  Game:
                </span>
                <span className="text-sm text-green-700 dark:text-green-300">
                  {games.find((g: Game) => g.id.toString() === gameId)?.name || 'Chưa chọn'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-900 dark:text-green-100">
                  Trạng thái:
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                  isActive
                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                    : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                }`}>
                  {isActive ? 'Hoạt động' : 'Tạm dừng'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-900 dark:text-green-100">
                  Số lần sử dụng:
                </span>
                <span className="text-sm text-green-700 dark:text-green-300">
                  {usageCount}
                </span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-700">
              <p className="text-xs text-green-700 dark:text-green-300 text-center">
                Thuật ngữ này sẽ được sử dụng trong từ điển game của hệ thống dịch thuật
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 text-center">
            <div className="text-4xl mb-3">📝</div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Xem trước thuật ngữ
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Nhập đầy đủ thông tin để xem preview
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
