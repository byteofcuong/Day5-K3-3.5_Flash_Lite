from datetime import datetime, timezone
from uuid import uuid4

import pytest

from src.models import Post


def valid_post(**overrides: object) -> Post:
    values = {
        "title": "Tiêu đề hợp lệ",
        "content": "Nội dung đủ dài để đăng.",
        "category": "Kiến thức",
        "author_name": "An",
    }
    values.update(overrides)
    return Post.create(**values)


def test_create_post_trims_and_sets_uuid_utc_timestamp() -> None:
    post = valid_post(title="  Tiêu đề hợp lệ  ")
    assert post.title == "Tiêu đề hợp lệ"
    assert str(uuid4().__class__(post.id)) == post.id
    assert datetime.fromisoformat(post.created_at).tzinfo == timezone.utc


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("title", "ngắn"),
        ("content", "quá ngắn"),
        ("author_name", "A"),
        ("category", "Không tồn tại"),
    ],
)
def test_create_post_rejects_invalid_input(field: str, value: str) -> None:
    with pytest.raises(ValueError):
        valid_post(**{field: value})


def test_from_d1_maps_row() -> None:
    source = valid_post(file_key="uploads/id/a.pdf", file_name="a.pdf")
    mapped = Post.from_d1(source.to_dict())
    assert mapped == source


def test_from_d1_rejects_missing_fields() -> None:
    with pytest.raises(ValueError, match="thiếu trường"):
        Post.from_d1({"id": str(uuid4())})

