from io import BytesIO
from uuid import UUID

import pytest

from src.utils.helpers import make_object_key, sanitize_filename, validate_file


def test_sanitize_filename_removes_paths_unicode_and_unsafe_chars() -> None:
    assert sanitize_filename("../../Bài học (mới).PDF") == "Bai-hoc-moi.pdf"


def test_object_key_has_uuid_and_safe_filename() -> None:
    key = make_object_key("a file.pdf")
    prefix, object_id, filename = key.split("/")
    assert prefix == "uploads"
    UUID(object_id)
    assert filename == "a-file.pdf"


@pytest.mark.parametrize(
    ("name", "mime", "size", "message"),
    [
        ("malware.exe", "application/octet-stream", 10, "Định dạng"),
        ("notes.txt", "application/pdf", 10, "không khớp"),
        ("notes.txt", "text/plain", 20 * 1024 * 1024 + 1, "20 MB"),
    ],
)
def test_validate_file_rejects_invalid_files(
    name: str, mime: str, size: int, message: str
) -> None:
    with pytest.raises(ValueError, match=message):
        validate_file(name, mime, size)


def test_validate_file_accepts_pdf() -> None:
    validate_file("guide.pdf", "application/pdf", len(BytesIO(b"pdf").getvalue()))

