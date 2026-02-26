"""
Translate Service - Dịch theo thứ tự ưu tiên: Cache -> Từ điển game -> Từ điển chung -> AI.
Prompt dịch thuật lấy từ bảng prompts (quản lý prompts) nếu truyền prompt_id.
"""
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.settings.service import SettingsService
from app.modules.prompts.service import PromptsService
from app.modules.language.service import LanguageService
from app.modules.cache.service import CacheService
from app.modules.game_glossary.service import Game_GlossaryService
from app.modules.global_glossary.service import Global_GlossaryService


DEFAULT_SYSTEM_PROMPT = """You are a professional translator. Translate the following text from {source_lang} to {target_lang}.
Preserve tone, format and line breaks. Output only the translation, no explanation or prefix."""

# TTL cache mặc định (giây) khi lưu bản dịch AI
TRANSLATE_CACHE_TTL = 86400


def _cache_key(source_lang: str, target_lang: str, text: str) -> str:
    """Tạo cache key giống frontend (normalize 200 ký tự, hash, base36)."""
    normalized = (text.strip() or "")[:200]
    normalized = " ".join(normalized.split())
    h = 0
    for c in normalized:
        h = ((h << 5) - h + ord(c)) & 0xFFFFFFFF
    if h >= 0x80000000:
        h -= 0x100000000
    # base36
    n = abs(h)
    if n == 0:
        suffix = "0"
    else:
        digits = "0123456789abcdefghijklmnopqrstuvwxyz"
        s = []
        while n:
            s.append(digits[n % 36])
            n //= 36
        suffix = "".join(reversed(s))
    return f"translate:{source_lang}:{target_lang}:{suffix}"


async def verify_gemini_api_key(db: AsyncSession) -> Tuple[bool, str]:
    """
    Kiểm tra API key Gemini có hoạt động hay không.
    Dùng cùng model đã cấu hình (gemini_model) để tránh 429 do model khác quota.
    Returns (success, message).
    """
    settings_svc = SettingsService(db)
    api_key_setting = await settings_svc.get_setting_by_key("gemini_api_key")
    model_setting = await settings_svc.get_setting_by_key("gemini_model")
    api_key = (api_key_setting.value or "").strip() if api_key_setting else ""
    model = (model_setting.value or "gemini-2.5-flash-lite").strip() if model_setting else "gemini-2.5-flash-lite"

    if not api_key:
        return (False, "Chưa cấu hình Gemini API Key. Vui lòng vào Cài đặt để thêm gemini_api_key.")

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        return (False, "Thư viện google-genai chưa được cài đặt. Chạy: pip install google-genai")

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model,
            contents="Say OK",
            config=types.GenerateContentConfig(max_output_tokens=5),
        )
        _ = (response.text or "").strip()
        return (True, "API key hợp lệ và kết nối thành công.")
    except Exception as e:
        err_msg = getattr(e, "message", str(e))
        err_str = str(e).lower()
        status = getattr(e, "status_code", None) or getattr(e, "http_status", None)
        if status == 429 or "429" in err_str or "quota" in err_str or "resource exhausted" in err_str:
            return (
                False,
                "Đã hết hạn mức sử dụng Gemini (429). Vui lòng kiểm tra hạn mức tại https://aistudio.google.com/",
            )
        if "api_key" in err_str or "invalid" in err_str or "401" in str(e) or "403" in str(e):
            return (False, f"API key không hợp lệ: {err_msg}")
        return (False, f"Không thể kết nối Gemini: {err_msg}")


async def translate_with_ai(
    db: AsyncSession,
    text: str,
    source_lang: str,
    target_lang: str,
    prompt_id: Optional[int] = None,
    context: Optional[str] = None,
    style: Optional[str] = None,
) -> str:
    settings_svc = SettingsService(db)
    api_key_setting = await settings_svc.get_setting_by_key("gemini_api_key")
    model_setting = await settings_svc.get_setting_by_key("gemini_model")
    api_key = (api_key_setting.value or "").strip() if api_key_setting else ""
    model = (model_setting.value or "gemini-2.5-flash-lite").strip() if model_setting else "gemini-2.5-flash-lite"

    if not api_key:
        raise ValueError(
            "Chưa cấu hình Gemini API Key. Vui lòng vào Cài đặt > Hệ thống để thêm gemini_api_key."
        )

    # Resolve mã ngôn ngữ → tên (từ bảng languages) để đưa vào prompt
    language_svc = LanguageService(db)
    source_name = await language_svc.get_name_by_code(source_lang)
    target_name = await language_svc.get_name_by_code(target_lang)

    system_content = DEFAULT_SYSTEM_PROMPT.format(
        source_lang=source_name,
        target_lang=target_name,
    )
    if prompt_id:
        prompts_svc = PromptsService(db)
        prompt_obj = await prompts_svc.get(prompt_id)
        if prompt_obj and getattr(prompt_obj, "content", None):
            raw = prompt_obj.content or ""
            system_content = (
                raw.replace("{source_lang}", source_name)
                .replace("{target_lang}", target_name)
                .replace("{style_instructions}", style or "")
            )
    if context:
        system_content += f"\n\nNgữ cảnh / Context: {context}"
    if style:
        system_content += f"\n\nPhong cách dịch / Style: {style}"

    user_content = text

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise ValueError("Thư viện google-genai chưa được cài đặt. Chạy: pip install google-genai")

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model,
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction=system_content,
                temperature=0.3,
            ),
        )
        translated = (response.text or "").strip()
    except Exception as e:
        err_msg = getattr(e, "message", str(e))
        err_str = str(e).lower()
        status = getattr(e, "status_code", None) or getattr(e, "http_status", None)
        if status == 429 or "429" in err_str or "quota" in err_str or "resource exhausted" in err_str:
            raise ValueError(
                "Đã hết hạn mức sử dụng Gemini (429). Vui lòng kiểm tra hạn mức tại https://aistudio.google.com/"
            )
        raise
    return translated or ""


async def translate_with_priority(
    db: AsyncSession,
    text: str,
    source_lang: str,
    target_lang: str,
    prompt_id: Optional[int] = None,
    context: Optional[str] = None,
    style: Optional[str] = None,
) -> str:
    """
    Dịch theo thứ tự ưu tiên: 1.Cache 2.Từ điển game 3.Từ điển chung 4.AI (và lưu cache).
    """
    text = (text or "").strip()
    if not text:
        return ""

    language_pair = f"{source_lang.strip()}-{target_lang.strip()}"

    # 1. Cache
    cache_svc = CacheService(db)
    key = _cache_key(source_lang, target_lang, text)
    cached = await cache_svc.get_by_key(key)
    if cached and getattr(cached, "value", None):
        return (cached.value or "").strip()

    # 2. Từ điển game (exact match term)
    game_glossary_svc = Game_GlossaryService(db)
    game_trans = await game_glossary_svc.find_translation(term=text, language_pair=language_pair)
    if game_trans is not None:
        return game_trans.strip()

    # 3. Từ điển chung (exact match term)
    global_glossary_svc = Global_GlossaryService(db)
    global_trans = await global_glossary_svc.find_translation(term=text, language_pair=language_pair)
    if global_trans is not None:
        return global_trans.strip()

    # 4. AI translation
    translated = await translate_with_ai(
        db,
        text=text,
        source_lang=source_lang,
        target_lang=target_lang,
        prompt_id=prompt_id,
        context=context,
        style=style,
    )

    # Lưu vào cache để lần sau ưu tiên cache
    if translated:
        try:
            await cache_svc.create({"key": key, "value": translated, "ttl": TRANSLATE_CACHE_TTL})
        except Exception:
            pass  # ignore duplicate key or create error

    return translated or ""
