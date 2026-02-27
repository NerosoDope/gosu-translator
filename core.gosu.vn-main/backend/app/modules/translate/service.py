"""
Translate Service - Dịch theo thứ tự ưu tiên: Cache -> Từ điển game -> Từ điển chung -> AI.
Prompt dịch thuật lấy từ bảng prompts (quản lý prompts) nếu truyền prompt_id.
Batch mode: gộp nhiều đoạn thành 1 lần gọi AI để giảm chi phí.
"""
import hashlib
from typing import Dict, List, Optional, Tuple
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
    """Tạo cache key bằng SHA-256 của toàn bộ text (chuẩn hóa whitespace).
    Dùng 16 ký tự hex đầu (64-bit) — xác suất collision gần như bằng 0 ở quy mô thực tế.
    """
    normalized = " ".join((text.strip() or "").split())
    raw = f"{source_lang}|{target_lang}|{normalized}".encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()[:16]
    return f"translate:{source_lang}:{target_lang}:{digest}"


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
        response = await client.aio.models.generate_content(
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
        response = await client.aio.models.generate_content(
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


# Separator dùng để ngăn cách các segment trong batch – không trùng với nội dung thực tế
_BATCH_SEP = "|||SEGMENT|||"

# Prompt batch: yêu cầu AI dịch từng dòng, giữ nguyên cấu trúc đánh số
_BATCH_SYSTEM_PROMPT = (
    "You are a professional translator. Translate EACH numbered line from {source_lang} to {target_lang}. "
    "Return ONLY the translated lines in the same numbered format. "
    "Do NOT add explanations, notes, or extra text. "
    "Preserve placeholders like {{variable}}, %s, %d exactly as-is.\n"
    "Format:\n1. <translated line 1>\n2. <translated line 2>\n..."
)


async def translate_with_ai_batch(
    db: AsyncSession,
    texts: List[str],
    source_lang: str,
    target_lang: str,
    prompt_id: Optional[int] = None,
    context: Optional[str] = None,
    style: Optional[str] = None,
) -> List[str]:
    """
    Gộp nhiều đoạn text thành 1 lần gọi AI (numbered list). Trả về list kết quả cùng thứ tự.
    Nếu parse thất bại thì fall back sang dịch lẻ.
    """
    if not texts:
        return []
    settings_svc = SettingsService(db)
    api_key_setting = await settings_svc.get_setting_by_key("gemini_api_key")
    model_setting = await settings_svc.get_setting_by_key("gemini_model")
    api_key = (api_key_setting.value or "").strip() if api_key_setting else ""
    model = (model_setting.value or "gemini-2.5-flash-lite").strip() if model_setting else "gemini-2.5-flash-lite"
    if not api_key:
        raise ValueError("Chưa cấu hình Gemini API Key.")

    language_svc = LanguageService(db)
    source_name = await language_svc.get_name_by_code(source_lang)
    target_name = await language_svc.get_name_by_code(target_lang)

    system_content = _BATCH_SYSTEM_PROMPT.format(source_lang=source_name, target_lang=target_name)
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

    numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(texts))

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise ValueError("Thư viện google-genai chưa được cài đặt.")

    try:
        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model=model,
            contents=numbered,
            config=types.GenerateContentConfig(
                system_instruction=system_content,
                temperature=0.3,
            ),
        )
        raw_output = (response.text or "").strip()
    except Exception as e:
        err_str = str(e).lower()
        status = getattr(e, "status_code", None) or getattr(e, "http_status", None)
        if status == 429 or "429" in err_str or "quota" in err_str or "resource exhausted" in err_str:
            raise ValueError("Đã hết hạn mức sử dụng Gemini (429).")
        raise

    # Parse output: mỗi dòng dạng "N. <nội dung>" → dict {index: text}
    import re as _re
    parsed: Dict[int, str] = {}
    for line in raw_output.splitlines():
        line = line.strip()
        m = _re.match(r"^(\d+)\.\s*(.*)", line)
        if m:
            idx = int(m.group(1))
            parsed[idx] = m.group(2).strip()
    # Điền kết quả theo thứ tự gốc; nếu thiếu thì trả chuỗi gốc
    results = []
    for i, orig in enumerate(texts):
        results.append(parsed.get(i + 1) or orig)
    return results


async def translate_check_only(
    db: AsyncSession,
    text: str,
    source_lang: str,
    target_lang: str,
    game_id: Optional[int] = None,
    game_category_id: Optional[int] = None,
) -> Optional[str]:
    """
    Chỉ tra Cache + Từ điển (game + chung). KHÔNG gọi AI.
    Trả về bản dịch nếu có, None nếu không có.
    Nếu game_id/game_category_id được chỉ định, chỉ tra trong từ điển tương ứng.
    """
    text = (text or "").strip()
    if not text:
        return ""

    language_pair = f"{source_lang.strip()}-{target_lang.strip()}"
    cache_svc = CacheService(db)
    key = _cache_key(source_lang, target_lang, text)
    cached = await cache_svc.get_by_key(key)
    if cached and getattr(cached, "value", None):
        return (cached.value or "").strip()

    game_glossary_svc = Game_GlossaryService(db)
    game_trans = await game_glossary_svc.find_translation(
        term=text, language_pair=language_pair, game_id=game_id
    )
    if game_trans is not None:
        return game_trans.strip()

    global_glossary_svc = Global_GlossaryService(db)
    global_trans = await global_glossary_svc.find_translation(
        term=text, language_pair=language_pair, game_category_id=game_category_id
    )
    if global_trans is not None:
        return global_trans.strip()

    return None


async def save_translation_to_cache(
    db: AsyncSession,
    text: str,
    translated: str,
    source_lang: str,
    target_lang: str,
) -> None:
    """
    Upsert 1 cặp bản dịch vào cache.
    Skip nếu key đã tồn tại với value giống nhau (tránh ghi thừa).
    Rollback session nếu lỗi để tránh ảnh hưởng transaction tiếp theo.
    """
    if not translated:
        return
    key = _cache_key(source_lang, target_lang, text)
    cache_svc = CacheService(db)
    try:
        existing = await cache_svc.get_by_key(key)
        if existing and getattr(existing, "value", None) == translated:
            return
        await cache_svc.create({"key": key, "value": translated, "ttl": TRANSLATE_CACHE_TTL})
    except Exception:
        try:
            await db.rollback()
        except Exception:
            pass


async def translate_with_priority(
    db: AsyncSession,
    text: str,
    source_lang: str,
    target_lang: str,
    prompt_id: Optional[int] = None,
    context: Optional[str] = None,
    style: Optional[str] = None,
    game_id: Optional[int] = None,
    game_category_id: Optional[int] = None,
) -> str:
    """
    Dịch theo thứ tự ưu tiên: 1.Cache 2.Từ điển game 3.Từ điển chung 4.AI (và lưu cache).
    game_id/game_category_id để lọc từ điển theo game/thể loại cụ thể.
    """
    hit = await translate_check_only(
        db, text, source_lang, target_lang,
        game_id=game_id, game_category_id=game_category_id,
    )
    if hit is not None:
        return hit

    text = (text or "").strip()
    translated = await translate_with_ai(
        db,
        text=text,
        source_lang=source_lang,
        target_lang=target_lang,
        prompt_id=prompt_id,
        context=context,
        style=style,
    )

    await save_translation_to_cache(db, text, translated, source_lang, target_lang)
    return translated or ""


# ─────────────────────────────────────────────────────────────────────────────
# Proofread (Hiệu Đính) – AI cải thiện bản dịch đã có
# ─────────────────────────────────────────────────────────────────────────────

_PROOFREAD_SYSTEM_PROMPT = (
    "You are a professional translator and proofreader. "
    "Review the provided translation and improve it if necessary. "
    "Source language: {source_lang}. Target language: {target_lang}. "
    "Output ONLY the improved translation text. "
    "If the translation is already accurate and natural, return it as-is. "
    "Do NOT add explanations, comments, or notes."
)

_PROOFREAD_BATCH_SYSTEM_PROMPT = (
    "You are a professional translator and proofreader. "
    "Review and improve the following translations. "
    "Source: {source_lang}. Target: {target_lang}. "
    "For each numbered item you receive:\n"
    "  Original: <source text>\n"
    "  Current: <existing translation>\n"
    "Return ONLY the improved translations in numbered format:\n"
    "1. <improved translation>\n2. <improved translation>\n...\n"
    "If a translation is already correct and natural, return it as-is. "
    "Do NOT add explanations or extra text."
)


async def proofread_with_ai(
    db: AsyncSession,
    original: str,
    translated: str,
    source_lang: str,
    target_lang: str,
    prompt_id: Optional[int] = None,
    context: Optional[str] = None,
    style: Optional[str] = None,
) -> str:
    """Hiệu đính 1 cặp văn bản gốc/bản dịch bằng AI. Trả về bản dịch đã cải thiện."""
    settings_svc = SettingsService(db)
    api_key_setting = await settings_svc.get_setting_by_key("gemini_api_key")
    model_setting = await settings_svc.get_setting_by_key("gemini_model")
    api_key = (api_key_setting.value or "").strip() if api_key_setting else ""
    model = (model_setting.value or "gemini-2.5-flash-lite").strip() if model_setting else "gemini-2.5-flash-lite"
    if not api_key:
        raise ValueError("Chưa cấu hình Gemini API Key.")

    language_svc = LanguageService(db)
    source_name = await language_svc.get_name_by_code(source_lang)
    target_name = await language_svc.get_name_by_code(target_lang)

    system_content = _PROOFREAD_SYSTEM_PROMPT.format(
        source_lang=source_name, target_lang=target_name
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
        system_content += f"\n\nPhong cách / Style: {style}"

    user_content = f"Original: {original}\nCurrent: {translated}"

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise ValueError("Thư viện google-genai chưa được cài đặt.")

    try:
        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model=model,
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction=system_content,
                temperature=0.3,
            ),
        )
        result = (response.text or "").strip()
    except Exception as e:
        err_str = str(e).lower()
        status = getattr(e, "status_code", None) or getattr(e, "http_status", None)
        if status == 429 or "429" in err_str or "quota" in err_str or "resource exhausted" in err_str:
            raise ValueError("Đã hết hạn mức sử dụng Gemini (429).")
        raise
    return result or translated


async def proofread_with_ai_batch(
    db: AsyncSession,
    items: List[Dict],
    source_lang: str,
    target_lang: str,
    prompt_id: Optional[int] = None,
    context: Optional[str] = None,
    style: Optional[str] = None,
) -> List[Dict]:
    """
    Hiệu đính nhiều cặp gốc/dịch cùng lúc (batch AI). 
    items: [{"index": int, "original": str, "translated": str}]
    Trả về: [{"index": int, "proofread": str}]
    """
    if not items:
        return []
    settings_svc = SettingsService(db)
    api_key_setting = await settings_svc.get_setting_by_key("gemini_api_key")
    model_setting = await settings_svc.get_setting_by_key("gemini_model")
    api_key = (api_key_setting.value or "").strip() if api_key_setting else ""
    model = (model_setting.value or "gemini-2.5-flash-lite").strip() if model_setting else "gemini-2.5-flash-lite"
    if not api_key:
        raise ValueError("Chưa cấu hình Gemini API Key.")

    language_svc = LanguageService(db)
    source_name = await language_svc.get_name_by_code(source_lang)
    target_name = await language_svc.get_name_by_code(target_lang)

    system_content = _PROOFREAD_BATCH_SYSTEM_PROMPT.format(
        source_lang=source_name, target_lang=target_name
    )
    if context:
        system_content += f"\n\nNgữ cảnh / Context: {context}"
    if style:
        system_content += f"\n\nPhong cách / Style: {style}"

    numbered = "\n".join(
        f"{i+1}.\n  Original: {item['original']}\n  Current: {item['translated']}"
        for i, item in enumerate(items)
    )

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise ValueError("Thư viện google-genai chưa được cài đặt.")

    try:
        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model=model,
            contents=numbered,
            config=types.GenerateContentConfig(
                system_instruction=system_content,
                temperature=0.3,
            ),
        )
        raw_output = (response.text or "").strip()
    except Exception as e:
        err_str = str(e).lower()
        status = getattr(e, "status_code", None) or getattr(e, "http_status", None)
        if status == 429 or "429" in err_str or "quota" in err_str or "resource exhausted" in err_str:
            raise ValueError("Đã hết hạn mức sử dụng Gemini (429).")
        raise

    import re as _re
    parsed: Dict[int, str] = {}
    for line in raw_output.splitlines():
        line = line.strip()
        m = _re.match(r"^(\d+)\.\s*(.*)", line)
        if m:
            idx = int(m.group(1))
            parsed[idx] = m.group(2).strip()

    results = []
    for i, item in enumerate(items):
        results.append({
            "index": item["index"],
            "proofread": parsed.get(i + 1) or item["translated"],
        })
    return results
