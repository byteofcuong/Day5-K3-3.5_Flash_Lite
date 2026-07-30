"""Pure helper functions used throughout VShare."""

from __future__ import annotations

import mimetypes
import re
import unicodedata
from pathlib import Path
from uuid import UUID, uuid4

MAX_FILE_SIZE = 20 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".xlsx",
    ".pptx",
    ".txt",
    ".png",
    ".jpg",
    ".jpeg",
    ".zip",
}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "image/png",
    "image/jpeg",
    "application/zip",
    "application/x-zip-compressed",
}


def sanitize_filename(filename: str) -> str:
    """Return a safe basename while preserving a supported extension."""
    basename = Path(filename.replace("\\", "/")).name
    normalized = unicodedata.normalize("NFKD", basename)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    stem = Path(ascii_name).stem
    extension = Path(ascii_name).suffix.lower()
    safe_stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("._-")
    return f"{safe_stem or 'file'}{extension}"


def make_object_key(filename: str, object_id: UUID | None = None) -> str:
    """Create a collision-resistant R2 object key."""
    unique_id = object_id or uuid4()
    return f"uploads/{unique_id}/{sanitize_filename(filename)}"


def validate_file(filename: str, mime_type: str, size: int) -> None:
    """Validate an attachment's name, type and size."""
    if size <= 0:
        raise ValueError("Tệp tải lên đang trống.")
    if size > MAX_FILE_SIZE:
        raise ValueError("Tệp vượt quá giới hạn 20 MB.")

    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Định dạng tệp không được hỗ trợ.")
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ValueError("MIME type của tệp không được hỗ trợ.")

    guessed_type, _ = mimetypes.guess_type(filename)
    if guessed_type and extension != ".zip" and guessed_type != mime_type:
        raise ValueError("Phần mở rộng và MIME type của tệp không khớp.")


def format_file_size(size: int | None) -> str:
    """Format a byte count for display."""
    if size is None:
        return ""
    if size < 1024:
        return f"{size} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    return f"{size / (1024 * 1024):.1f} MB"

