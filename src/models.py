"""Data models and validation for VShare posts."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Mapping
from uuid import UUID, uuid4

CATEGORIES = ("Kiến thức", "Tài liệu", "Công cụ", "Sự kiện", "Khác")


def _required_text(value: str, field: str, minimum: int, maximum: int) -> str:
    cleaned = value.strip()
    if not minimum <= len(cleaned) <= maximum:
        raise ValueError(f"{field} phải có từ {minimum} đến {maximum} ký tự.")
    return cleaned


@dataclass(frozen=True)
class Post:
    id: str
    title: str
    content: str
    category: str
    author_name: str
    created_at: str
    file_key: str | None = None
    file_name: str | None = None
    file_type: str | None = None
    file_size: int | None = None

    @classmethod
    def create(
        cls,
        *,
        title: str,
        content: str,
        category: str,
        author_name: str,
        file_key: str | None = None,
        file_name: str | None = None,
        file_type: str | None = None,
        file_size: int | None = None,
    ) -> "Post":
        """Validate user input and create a new post."""
        if category not in CATEGORIES:
            raise ValueError("Danh mục không hợp lệ.")
        if file_key is None and any(
            value is not None for value in (file_name, file_type, file_size)
        ):
            raise ValueError("Metadata tệp không đầy đủ.")
        return cls(
            id=str(uuid4()),
            title=_required_text(title, "Tiêu đề", 5, 150),
            content=_required_text(content, "Nội dung", 10, 10_000),
            category=category,
            author_name=_required_text(author_name, "Tên người đăng", 2, 60),
            created_at=datetime.now(timezone.utc).isoformat(),
            file_key=file_key,
            file_name=file_name,
            file_type=file_type,
            file_size=file_size,
        )

    @classmethod
    def from_d1(cls, row: Mapping[str, Any]) -> "Post":
        """Map and minimally validate a D1 result row."""
        required = ("id", "title", "content", "category", "author_name", "created_at")
        missing = [key for key in required if key not in row]
        if missing:
            raise ValueError(f"D1 response thiếu trường: {', '.join(missing)}")
        try:
            UUID(str(row["id"]))
            datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00"))
        except (ValueError, TypeError) as exc:
            raise ValueError("D1 response chứa id hoặc thời gian không hợp lệ.") from exc
        return cls(
            id=str(row["id"]),
            title=str(row["title"]),
            content=str(row["content"]),
            category=str(row["category"]),
            author_name=str(row["author_name"]),
            created_at=str(row["created_at"]),
            file_key=row.get("file_key"),
            file_name=row.get("file_name"),
            file_type=row.get("file_type"),
            file_size=row.get("file_size"),
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert the model to a serializable dictionary."""
        return asdict(self)

