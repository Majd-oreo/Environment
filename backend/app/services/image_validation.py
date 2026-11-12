"""Validate and normalise uploaded images.

- Checks the real file signature with Pillow (not just the extension / MIME header).
- Rejects oversized files and decompression bombs.
- Re-encodes to JPEG, downscales, fixes orientation and strips EXIF/GPS metadata
  before anything is sent to the AI provider.
"""
from __future__ import annotations

import base64
import io

from PIL import Image, ImageOps, UnidentifiedImageError

from ..config import Settings
from .errors import AppError

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "BMP"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/bmp",
}
MIN_SIDE_PX = 64

# Guard against decompression bombs (~50 megapixels).
Image.MAX_IMAGE_PIXELS = 50_000_000


def prepare_image(data: bytes, content_type: str | None, settings: Settings) -> str:
    """Return a base64 data URL of a sanitised JPEG, or raise AppError."""
    if not data:
        raise AppError("لم يتم استلام أي صورة. يرجى اختيار صورة والمحاولة مجددًا.", "empty_file")

    if len(data) > settings.max_upload_bytes:
        raise AppError(
            f"حجم الصورة كبير جدًا. الحد الأقصى {settings.max_upload_mb} ميغابايت.",
            "file_too_large",
            413,
        )

    if content_type and content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise AppError("نوع الملف غير مدعوم. استخدم صورة JPG أو PNG أو WEBP.", "unsupported_type", 415)

    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt = probe.format
            probe.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise AppError("تعذّر قراءة الصورة. قد يكون الملف تالفًا أو ليس صورة.", "invalid_image", 415)

    if fmt not in ALLOWED_FORMATS:
        raise AppError("نوع الملف غير مدعوم. استخدم صورة JPG أو PNG أو WEBP.", "unsupported_type", 415)

    try:
        with Image.open(io.BytesIO(data)) as img:
            img.seek(0)  # first frame for animated formats
            img = ImageOps.exif_transpose(img)
            if min(img.size) < MIN_SIDE_PX:
                raise AppError("الصورة صغيرة جدًا للتحليل. استخدم صورة أوضح.", "image_too_small")

            if img.mode in ("RGBA", "LA", "P"):
                img = img.convert("RGBA")
                bg = Image.new("RGB", img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[-1])
                img = bg
            elif img.mode != "RGB":
                img = img.convert("RGB")

            img.thumbnail((settings.max_image_side_px, settings.max_image_side_px), Image.LANCZOS)

            out = io.BytesIO()
            img.save(out, format="JPEG", quality=86, optimize=True)  # no EXIF written
    except AppError:
        raise
    except Exception:
        raise AppError("تعذّر معالجة الصورة. جرّب صورة أخرى.", "invalid_image", 415)

    return "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode("ascii")
