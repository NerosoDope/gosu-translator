import { useState, useEffect } from 'react';
import { useCreateLanguage, useUpdateLanguage, useLanguageList } from '@/hooks/useLanguage';
import { useToastContext } from '@/context/ToastContext';

// Types
interface Language {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
}

interface LanguageFormProps {
  language?: Language;
  onSuccess: () => void;
  onCancel: () => void;
}

// Complete list of ISO 639-1 languages
const ISO_LANGUAGES = [
  { code: 'aa', name: 'Afar', nativeName: 'Afaraf' },
  { code: 'ab', name: 'Abkhazian', nativeName: 'аҧсуа бызшәа' },
  { code: 'ae', name: 'Avestan', nativeName: 'avesta' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
  { code: 'ak', name: 'Akan', nativeName: 'Akan' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ' },
  { code: 'an', name: 'Aragonese', nativeName: 'aragonés' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া' },
  { code: 'av', name: 'Avaric', nativeName: 'авар мацӀ' },
  { code: 'ay', name: 'Aymara', nativeName: 'aymar aru' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'azərbaycan dili' },
  { code: 'ba', name: 'Bashkir', nativeName: 'башҡорт теле' },
  { code: 'be', name: 'Belarusian', nativeName: 'беларуская мова' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'български език' },
  { code: 'bh', name: 'Bihari', nativeName: 'भोजपुरी' },
  { code: 'bi', name: 'Bislama', nativeName: 'Bislama' },
  { code: 'bm', name: 'Bambara', nativeName: 'bamanankan' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'bo', name: 'Tibetan', nativeName: 'བོད་ཡིག' },
  { code: 'br', name: 'Breton', nativeName: 'brezhoneg' },
  { code: 'bs', name: 'Bosnian', nativeName: 'bosanski jezik' },
  { code: 'ca', name: 'Catalan', nativeName: 'català' },
  { code: 'ce', name: 'Chechen', nativeName: 'нохчийн мотт' },
  { code: 'ch', name: 'Chamorro', nativeName: 'Chamoru' },
  { code: 'co', name: 'Corsican', nativeName: 'corsu' },
  { code: 'cr', name: 'Cree', nativeName: 'ᓀᐦᐃᔭᐍᐏᐣ' },
  { code: 'cs', name: 'Czech', nativeName: 'čeština' },
  { code: 'cu', name: 'Church Slavic', nativeName: 'ѩзыкъ словѣньскъ' },
  { code: 'cv', name: 'Chuvash', nativeName: 'чӑваш чӗлхи' },
  { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg' },
  { code: 'da', name: 'Danish', nativeName: 'dansk' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'dv', name: 'Divehi', nativeName: 'ދިވެހި' },
  { code: 'dz', name: 'Dzongkha', nativeName: 'རྫོང་ཁ' },
  { code: 'ee', name: 'Ewe', nativeName: 'Eʋegbe' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'eo', name: 'Esperanto', nativeName: 'Esperanto' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'et', name: 'Estonian', nativeName: 'eesti' },
  { code: 'eu', name: 'Basque', nativeName: 'euskara' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
  { code: 'ff', name: 'Fulah', nativeName: 'Fulfulde' },
  { code: 'fi', name: 'Finnish', nativeName: 'suomi' },
  { code: 'fj', name: 'Fijian', nativeName: 'vosa Vakaviti' },
  { code: 'fo', name: 'Faroese', nativeName: 'føroyskt' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'fy', name: 'Western Frisian', nativeName: 'Frysk' },
  { code: 'ga', name: 'Irish', nativeName: 'Gaeilge' },
  { code: 'gd', name: 'Scottish Gaelic', nativeName: 'Gàidhlig' },
  { code: 'gl', name: 'Galician', nativeName: 'galego' },
  { code: 'gn', name: 'Guarani', nativeName: "Avañe'ẽ" },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'gv', name: 'Manx', nativeName: 'Gaelg' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ho', name: 'Hiri Motu', nativeName: 'Hiri Motu' },
  { code: 'hr', name: 'Croatian', nativeName: 'hrvatski jezik' },
  { code: 'ht', name: 'Haitian Creole', nativeName: 'Kreyòl ayisyen' },
  { code: 'hu', name: 'Hungarian', nativeName: 'magyar' },
  { code: 'hy', name: 'Armenian', nativeName: 'Հայերեն' },
  { code: 'hz', name: 'Herero', nativeName: 'Otjiherero' },
  { code: 'ia', name: 'Interlingua', nativeName: 'Interlingua' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'ie', name: 'Interlingue', nativeName: 'Interlingue' },
  { code: 'ig', name: 'Igbo', nativeName: 'Asụsụ Igbo' },
  { code: 'ii', name: 'Sichuan Yi', nativeName: 'ꆈꌠ꒿ Nuosuhxop' },
  { code: 'ik', name: 'Inupiaq', nativeName: 'Iñupiaq' },
  { code: 'io', name: 'Ido', nativeName: 'Ido' },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'iu', name: 'Inuktitut', nativeName: 'ᐃᓄᒃᑎᑐᑦ' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'jv', name: 'Javanese', nativeName: 'basa Jawa' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული' },
  { code: 'kg', name: 'Kongo', nativeName: 'Kikongo' },
  { code: 'ki', name: 'Kikuyu', nativeName: 'Gĩkũyũ' },
  { code: 'kj', name: 'Kwanyama', nativeName: 'Kuanyama' },
  { code: 'kk', name: 'Kazakh', nativeName: 'қазақ тілі' },
  { code: 'kl', name: 'Kalaallisut', nativeName: 'kalaallisut' },
  { code: 'km', name: 'Khmer', nativeName: 'ខេមរភាសា' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'kr', name: 'Kanuri', nativeName: 'Kanuri' },
  { code: 'ks', name: 'Kashmiri', nativeName: 'कश्मीरी' },
  { code: 'ku', name: 'Kurdish', nativeName: 'Kurdî' },
  { code: 'kv', name: 'Komi', nativeName: 'коми кыв' },
  { code: 'kw', name: 'Cornish', nativeName: 'Kernewek' },
  { code: 'ky', name: 'Kyrgyz', nativeName: 'Кыргызча' },
  { code: 'la', name: 'Latin', nativeName: 'latine' },
  { code: 'lb', name: 'Luxembourgish', nativeName: 'Lëtzebuergesch' },
  { code: 'lg', name: 'Ganda', nativeName: 'Luganda' },
  { code: 'li', name: 'Limburgish', nativeName: 'Limburgs' },
  { code: 'ln', name: 'Lingala', nativeName: 'Lingála' },
  { code: 'lo', name: 'Lao', nativeName: 'ພາສາລາວ' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'lietuvių kalba' },
  { code: 'lu', name: 'Luba-Katanga', nativeName: 'Kiluba' },
  { code: 'lv', name: 'Latvian', nativeName: 'latviešu valoda' },
  { code: 'mg', name: 'Malagasy', nativeName: 'fiteny malagasy' },
  { code: 'mh', name: 'Marshallese', nativeName: 'Kajin M̧ajeļ' },
  { code: 'mi', name: 'Māori', nativeName: 'te reo Māori' },
  { code: 'mk', name: 'Macedonian', nativeName: 'македонски јазик' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол хэл' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'mt', name: 'Maltese', nativeName: 'Malti' },
  { code: 'my', name: 'Burmese', nativeName: 'ဗမာစာ' },
  { code: 'na', name: 'Nauru', nativeName: 'Dorerin Naoero' },
  { code: 'nb', name: 'Norwegian Bokmål', nativeName: 'Norsk bokmål' },
  { code: 'nd', name: 'Northern Ndebele', nativeName: 'isiNdebele' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली' },
  { code: 'ng', name: 'Ndonga', nativeName: 'Owambo' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'nn', name: 'Norwegian Nynorsk', nativeName: 'Norsk nynorsk' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'nr', name: 'Southern Ndebele', nativeName: 'isiNdebele' },
  { code: 'nv', name: 'Navajo', nativeName: 'Diné bizaad' },
  { code: 'ny', name: 'Chichewa', nativeName: 'chiCheŵa' },
  { code: 'oc', name: 'Occitan', nativeName: 'occitan' },
  { code: 'oj', name: 'Ojibwa', nativeName: 'ᐊᓂᔑᓈᐯᒧᐎᓐ' },
  { code: 'om', name: 'Oromo', nativeName: 'Afaan Oromoo' },
  { code: 'or', name: 'Oriya', nativeName: 'ଓଡ଼ିଆ' },
  { code: 'os', name: 'Ossetian', nativeName: 'ирон æвзаг' },
  { code: 'pa', name: 'Panjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'pi', name: 'Pali', nativeName: 'पालि' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'ps', name: 'Pashto', nativeName: 'پښتو' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'qu', name: 'Quechua', nativeName: 'Runa Simi' },
  { code: 'rm', name: 'Romansh', nativeName: 'rumantsch grischun' },
  { code: 'rn', name: 'Kirundi', nativeName: 'Ikirundi' },
  { code: 'ro', name: 'Romanian', nativeName: 'română' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'rw', name: 'Kinyarwanda', nativeName: 'Ikinyarwanda' },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्' },
  { code: 'sc', name: 'Sardinian', nativeName: 'sardu' },
  { code: 'sd', name: 'Sindhi', nativeName: 'सिन्धी' },
  { code: 'se', name: 'Northern Sami', nativeName: 'Davvisámegiella' },
  { code: 'sg', name: 'Sango', nativeName: 'yângâ tî sängö' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල' },
  { code: 'sk', name: 'Slovak', nativeName: 'slovenčina' },
  { code: 'sl', name: 'Slovenian', nativeName: 'slovenščina' },
  { code: 'sm', name: 'Samoan', nativeName: "gagana fa'a Samoa" },
  { code: 'sn', name: 'Shona', nativeName: 'chiShona' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaaliga' },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip' },
  { code: 'sr', name: 'Serbian', nativeName: 'српски језик' },
  { code: 'ss', name: 'Swati', nativeName: 'SiSwati' },
  { code: 'st', name: 'Southern Sotho', nativeName: 'Sesotho' },
  { code: 'su', name: 'Sundanese', nativeName: 'Basa Sunda' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'tg', name: 'Tajik', nativeName: 'тоҷикӣ' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'ti', name: 'Tigrinya', nativeName: 'ትግርኛ' },
  { code: 'tk', name: 'Turkmen', nativeName: 'Türkmen' },
  { code: 'tl', name: 'Tagalog', nativeName: 'Wikang Tagalog' },
  { code: 'tn', name: 'Tswana', nativeName: 'Setswana' },
  { code: 'to', name: 'Tongan', nativeName: 'faka Tonga' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'ts', name: 'Tsonga', nativeName: 'Xitsonga' },
  { code: 'tt', name: 'Tatar', nativeName: 'татар теле' },
  { code: 'tw', name: 'Twi', nativeName: 'Twi' },
  { code: 'ty', name: 'Tahitian', nativeName: 'Reo Tahiti' },
  { code: 'ug', name: 'Uyghur', nativeName: 'ئۇyغۇرچە' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'українська мова' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbek' },
  { code: 've', name: 'Venda', nativeName: 'Tshivenḓa' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'vo', name: 'Volapük', nativeName: 'Volapük' },
  { code: 'wa', name: 'Walloon', nativeName: 'walon' },
  { code: 'wo', name: 'Wolof', nativeName: 'Wollof' },
  { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa' },
  { code: 'yi', name: 'Yiddish', nativeName: 'ייִדיש' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
  { code: 'za', name: 'Zhuang', nativeName: 'Saɯ cueŋƅ' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu' },
].sort((a, b) => a.name.localeCompare(b.name));

export default function LanguageForm({ language, onSuccess, onCancel }: LanguageFormProps) {
  // Form state
  const [code, setCode] = useState(language?.code || '');
  const [name, setName] = useState(language?.name || '');
  const [isActive, setIsActive] = useState(language?.is_active ?? true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form validation
  const [codeError, setCodeError] = useState('');
  const [nameError, setNameError] = useState('');

  // Hooks
  const createLanguage = useCreateLanguage();
  const updateLanguage = useUpdateLanguage();
  const { data: existingLanguages } = useLanguageList({ is_active: true });
  const toast = useToastContext();

  // Vietnamese display names (properly capitalized) for common languages
  const VI_DISPLAY_NAMES: Record<string, string> = {
    en: 'Tiếng Anh',
    vi: 'Tiếng Việt',
    ja: 'Tiếng Nhật',
    ko: 'Tiếng Hàn',
    zh: 'Tiếng Trung',
    fr: 'Tiếng Pháp',
    de: 'Tiếng Đức',
    es: 'Tiếng Tây Ban Nha',
    pt: 'Tiếng Bồ Đào Nha',
    ru: 'Tiếng Nga',
    th: 'Tiếng Thái',
    id: 'Tiếng Indonesia',
    hi: 'Tiếng Hindi',
    ar: 'Tiếng Ả Rập',
    it: 'Tiếng Ý',
    nl: 'Tiếng Hà Lan',
    pl: 'Tiếng Ba Lan',
    tr: 'Tiếng Thổ Nhĩ Kỳ',
    sv: 'Tiếng Thụy Điển',
    cs: 'Tiếng Séc',
    ro: 'Tiếng Romania',
    hu: 'Tiếng Hungary',
    fi: 'Tiếng Phần Lan',
    da: 'Tiếng Đan Mạch',
    no: 'Tiếng Na Uy',
    el: 'Tiếng Hy Lạp',
    he: 'Tiếng Do Thái',
    uk: 'Tiếng Ukraina',
    ca: 'Tiếng Catalan',
    sk: 'Tiếng Slovakia',
    bg: 'Tiếng Bulgaria',
    hr: 'Tiếng Croatia',
    sr: 'Tiếng Serbia',
    sl: 'Tiếng Slovenia',
    et: 'Tiếng Estonia',
    lv: 'Tiếng Latvia',
    lt: 'Tiếng Lithuania',
    mt: 'Tiếng Malta',
    ga: 'Tiếng Ireland',
    cy: 'Tiếng Wales',
    is: 'Tiếng Iceland',
    mk: 'Tiếng Macedonia',
    sq: 'Tiếng Albania',
    bs: 'Tiếng Bosnia',
    ms: 'Tiếng Mã Lai',
    sw: 'Tiếng Swahili',
    af: 'Tiếng Afrikaans',
    zu: 'Tiếng Zulu',
    xh: 'Tiếng Xhosa',
    yo: 'Tiếng Yoruba',
    ig: 'Tiếng Igbo',
    ha: 'Tiếng Hausa',
    am: 'Tiếng Amharic',
    bn: 'Tiếng Bengal',
    gu: 'Tiếng Gujarat',
    kn: 'Tiếng Kannada',
    ml: 'Tiếng Malayalam',
    mr: 'Tiếng Marathi',
    ne: 'Tiếng Nepal',
    pa: 'Tiếng Punjab',
    si: 'Tiếng Sinhala',
    ta: 'Tiếng Tamil',
    te: 'Tiếng Telugu',
    ur: 'Tiếng Urdu',
    my: 'Tiếng Myanmar',
    km: 'Tiếng Khmer',
    lo: 'Tiếng Lào',
    ka: 'Tiếng Gruzia',
    hy: 'Tiếng Armenia',
    az: 'Tiếng Azerbaijan',
    kk: 'Tiếng Kazakhstan',
    ky: 'Tiếng Kyrgyz',
    uz: 'Tiếng Uzbek',
    mn: 'Tiếng Mông Cổ',
    bo: 'Tiếng Tây Tạng',
    jv: 'Tiếng Java',
    su: 'Tiếng Sunda',
    ceb: 'Tiếng Cebuano',
    tl: 'Tiếng Tagalog',
    haw: 'Tiếng Hawaii',
    mg: 'Tiếng Malagasy',
    ny: 'Tiếng Chichewa',
    st: 'Tiếng Sotho',
    sn: 'Tiếng Shona',
  };

  // Vietnamese aliases for searching (lowercase for matching)
  const VI_ALIASES: Record<string, string[]> = {
    en: ['tiếng anh', 'anh'],
    vi: ['tiếng việt', 'việt'],
    ja: ['tiếng nhật', 'nhật'],
    ko: ['tiếng hàn', 'hàn', 'hàn quốc'],
    zh: ['tiếng trung', 'trung', 'trung quốc', 'tiếng hoa', 'hán'],
    fr: ['tiếng pháp', 'pháp'],
    de: ['tiếng đức', 'đức'],
    es: ['tiếng tây ban nha', 'tây ban nha', 'tbn'],
    pt: ['tiếng bồ đào nha', 'bồ đào nha', 'bồ'],
    ru: ['tiếng nga', 'nga'],
    th: ['tiếng thái', 'thái'],
    id: ['tiếng indonesia', 'indonesia'],
    hi: ['tiếng hindi', 'hindi'],
  };

  const normalizedQuery = searchQuery.toLowerCase().trim();

  // Filter languages based on search query (English, native name, code, and Vietnamese aliases)
  const filteredLanguages = ISO_LANGUAGES.filter(lang => {
    const aliases = VI_ALIASES[lang.code as keyof typeof VI_ALIASES] || [];
    return (
      lang.name.toLowerCase().includes(normalizedQuery) ||
      lang.code.toLowerCase().includes(normalizedQuery) ||
      lang.nativeName.toLowerCase().includes(normalizedQuery) ||
      aliases.some(alias => alias.includes(normalizedQuery) || normalizedQuery.includes(alias))
    );
  }).slice(0, 10); // Limit to 10 suggestions

  // Handle name input with autocomplete
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const lower = value.toLowerCase();
    setName(value);
    setSearchQuery(value);
    setShowSuggestions(value.length > 0);
    validateName(value);
    
    // Try to find matching language (English name, native name, or Vietnamese alias) and auto-fill code
    if (value.length > 0) {
      const matched = ISO_LANGUAGES.find(lang => {
        const aliases = VI_ALIASES[lang.code as keyof typeof VI_ALIASES] || [];
        return (
          lang.name.toLowerCase() === lower ||
          lang.nativeName.toLowerCase() === lower ||
          aliases.some(alias => alias.toLowerCase() === lower)
        );
      });
      
      if (matched && !code) {
        setCode(matched.code);
        validateCode(matched.code);
        // Auto-fill English name (original name) when matched via Vietnamese alias
        if (VI_ALIASES[matched.code as keyof typeof VI_ALIASES]?.some(alias => alias.toLowerCase() === lower)) {
          setName(matched.name);
          setSearchQuery(matched.name);
        }
      }
    }
  };

  // Handle suggestion selection
  const selectLanguage = (selectedLang: typeof ISO_LANGUAGES[0]) => {
    // Always use English name (original name) for saving to database
    setName(selectedLang.name);
    setCode(selectedLang.code);
    setSearchQuery(selectedLang.name);
    setShowSuggestions(false);
    setCodeError('');
    setNameError('');
    validateCode(selectedLang.code);
    validateName(selectedLang.name);
  };

  // Validation
  const validateCode = (value: string) => {
    if (!value) {
      setCodeError('Mã ngôn ngữ là bắt buộc');
      return false;
    }
    if (value.length !== 2) {
      setCodeError('Mã ngôn ngữ phải có đúng 2 ký tự');
      return false;
    }
    if (!/^[a-z]{2}$/.test(value)) {
      setCodeError('Mã ngôn ngữ chỉ được chứa chữ cái thường');
      return false;
    }

    // Check for duplicates (excluding current language)
    const languages = existingLanguages?.data?.items || existingLanguages?.data || [];
    const duplicate = languages.find(
      (lang: Language) =>
        lang.code.toLowerCase() === value.toLowerCase() &&
        lang.id !== language?.id
    );
    if (duplicate) {
      setCodeError('Mã ngôn ngữ đã tồn tại');
      return false;
    }

    setCodeError('');
    return true;
  };

  const validateName = (value: string) => {
    if (!value.trim()) {
      setNameError('Tên ngôn ngữ là bắt buộc');
      return false;
    }
    if (value.length < 2) {
      setNameError('Tên ngôn ngữ phải có ít nhất 2 ký tự');
      return false;
    }
    setNameError('');
    return true;
  };

  // Handle code input changes
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setCode(value);
    validateCode(value);
    
    // Try to auto-fill name when code is entered manually
    if (value.length === 2 && !name) {
      const matched = ISO_LANGUAGES.find(lang => lang.code === value);
      if (matched) {
        setName(matched.name);
        setSearchQuery(matched.name);
        validateName(matched.name);
      }
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isCodeValid = validateCode(code);
    const isNameValid = validateName(name);

    if (!isCodeValid || !isNameValid) {
      return;
    }

    try {
      const formData = {
        code: code.trim(),
        name: name.trim(),
        is_active: isActive,
      };

      if (language?.id) {
        await updateLanguage.mutateAsync({ id: language.id, data: formData });
        toast.success('Cập nhật ngôn ngữ thành công!');
      } else {
        await createLanguage.mutateAsync(formData);
        toast.success('Tạo ngôn ngữ mới thành công!');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Error saving language:', error);
      
      // Handle network errors
      if (!error.response) {
        // Network error - không có response từ server
        const networkError = error.message || 'Không thể kết nối đến server. Vui lòng kiểm tra backend server có đang chạy không.';
        toast.error(networkError);
        return;
      }
      
      // Extract error message from API response
      // Handle both formats: FastAPI default (detail) and custom exception handler (error.message)
      const responseData = error?.response?.data;
      let errorMessage = 'Không thể tạo/cập nhật ngôn ngữ. Vui lòng thử lại.';
      
      if (responseData) {
        // Try custom exception handler format first
        if (responseData.error?.message) {
          errorMessage = responseData.error.message;
        }
        // Fallback to FastAPI default format
        else if (responseData.detail) {
          errorMessage = typeof responseData.detail === 'string' 
            ? responseData.detail 
            : JSON.stringify(responseData.detail);
        }
        // Fallback to message field
        else if (responseData.message) {
          errorMessage = responseData.message;
        }
      }
      
      // Fallback to error.message
      if (!errorMessage || errorMessage === 'Không thể tạo/cập nhật ngôn ngữ. Vui lòng thử lại.') {
        errorMessage = error?.message || errorMessage;
      }
      
      toast.error(errorMessage);
      
      // Show validation errors if available
      if (responseData?.error?.details) {
        const details = responseData.error.details;
        // Handle array of validation errors
        if (Array.isArray(details)) {
          details.forEach((err: any) => {
            if (err.loc && err.loc.includes('code')) {
              setCodeError(err.msg || 'Mã ngôn ngữ không hợp lệ');
            }
            if (err.loc && err.loc.includes('name')) {
              setNameError(err.msg || 'Tên ngôn ngữ không hợp lệ');
            }
          });
        }
      }
      // Handle old format
      else if (error?.response?.data?.errors) {
        const errors = error.response.data.errors;
        if (errors.code) {
          setCodeError(Array.isArray(errors.code) ? errors.code[0] : errors.code);
        }
        if (errors.name) {
          setNameError(Array.isArray(errors.name) ? errors.name[0] : errors.name);
        }
      }
    }
  };

  // Loading state
  const isLoading = createLanguage.isLoading || updateLanguage.isLoading;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Column - Form Inputs */}
      <div className="space-y-6">
        {/* Language Name - Autocomplete with dropdown suggestions */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tên ngôn ngữ <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              onFocus={() => name.length > 0 && setShowSuggestions(true)}
              onBlur={() => {
                // Delay hiding suggestions to allow click on suggestion
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors ${
                nameError
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
              } dark:bg-gray-700 dark:text-gray-100`}
              placeholder="Nhập hoặc chọn ngôn ngữ (vd: English, Tiếng Việt, 日本語)"
              maxLength={100}
              required
            />
            {showSuggestions && filteredLanguages.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => selectLanguage(lang)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {/* Hiển thị tên tiếng Anh (tên gốc) */}
                            {lang.name}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                            {lang.code.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          {/* Hiển thị tên tiếng Việt nếu có, sau đó là tên bản địa */}
                          {VI_DISPLAY_NAMES[lang.code] ? (
                            <>
                              <span className="font-medium">{VI_DISPLAY_NAMES[lang.code]}</span>
                              {lang.nativeName !== lang.name && ` • ${lang.nativeName}`}
                            </>
                          ) : (
                            lang.nativeName
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {nameError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {nameError}
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Nhập tên ngôn ngữ hoặc chọn từ danh sách gợi ý. Mã ngôn ngữ sẽ tự động điền khi chọn.
          </p>
        </div>

        {/* Language Code */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Mã ngôn ngữ <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={code}
            onChange={handleCodeChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 transition-colors ${
              codeError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            } dark:bg-gray-700 dark:text-gray-100`}
            placeholder="vd: vi, en, ja, zh"
            maxLength={2}
            required
          />
          {codeError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {codeError}
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Mã ngôn ngữ theo chuẩn ISO 639-1 (2 ký tự, ví dụ: vi, en, ja, zh). 
            Tự động điền khi chọn ngôn ngữ từ danh sách, hoặc nhập thủ công.
          </p>
        </div>

        {/* Active Status */}
        <div className="space-y-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Ngôn ngữ hoạt động
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Ngôn ngữ này có thể được sử dụng trong hệ thống dịch thuật
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
            type="button"
            disabled={isLoading || !!codeError || !!nameError || !code.trim() || !name.trim()}
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Đang lưu...
              </>
            ) : (
              language?.id ? 'Cập nhật ngôn ngữ' : 'Tạo ngôn ngữ'
            )}
          </button>
        </div>
      </div>

      {/* Right Column - Preview */}
      <div className="lg:sticky lg:top-6">
        {(code || name) && !codeError && !nameError ? (
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800 shadow-lg">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg mr-3">
                <span className="text-xl">👁️</span>
              </div>
              <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                Xem trước ngôn ngữ
              </h4>
            </div>

            <div className="flex items-center space-x-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">
                  {code.slice(0, 2).toUpperCase() || '🌐'}
                </span>
              </div>
              <div className="flex-1">
                <div className="font-bold text-blue-900 dark:text-blue-100 text-xl mb-1">
                  {name || 'Tên ngôn ngữ'}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300 uppercase tracking-wider font-medium">
                  {code.toUpperCase() || 'CODE'}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
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
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Độ dài code:
                </span>
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  {code.length}/2 ký tự
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Độ dài tên:
                </span>
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  {name.length}/100 ký tự
                </span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
              <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
                Ngôn ngữ này sẽ xuất hiện trong danh sách ngôn ngữ của hệ thống
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 text-center">
            <div className="text-4xl mb-3">🎨</div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Xem trước ngôn ngữ
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Nhập mã và tên ngôn ngữ để xem preview
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
