"""Cloudflare D1 REST API client."""

from __future__ import annotations

from typing import Any

import requests

from src.config import Settings
from src.models import Post


class D1ServiceError(RuntimeError):
    """A safe, contextual D1 failure."""


class D1Service:
    def __init__(
        self, settings: Settings, session: requests.Session | None = None
    ) -> None:
        self.settings = settings
        self.session = session or requests.Session()

    def _query(self, sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
        try:
            response = self.session.post(
                self.settings.d1_query_url,
                headers={
                    "Authorization": f"Bearer {self.settings.api_token}",
                    "Content-Type": "application/json",
                },
                json={"sql": sql, "params": params or []},
                timeout=self.settings.http_timeout,
            )
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as exc:
            raise D1ServiceError("Không thể kết nối Cloudflare D1.") from exc

        if not payload.get("success"):
            errors = payload.get("errors") or []
            message = errors[0].get("message", "D1 từ chối truy vấn.") if errors else ""
            raise D1ServiceError(f"Truy vấn D1 thất bại. {message}".strip())
        results = payload.get("result") or []
        if not results:
            return []
        query_result = results[0]
        if not query_result.get("success", True):
            raise D1ServiceError("D1 không thể thực thi truy vấn.")
        return query_result.get("results") or []

    def create_post(self, post: Post) -> None:
        """Persist one validated post."""
        self._query(
            """
            INSERT INTO posts (
                id, title, content, category, author_name, file_key,
                file_name, file_type, file_size, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                post.id,
                post.title,
                post.content,
                post.category,
                post.author_name,
                post.file_key,
                post.file_name,
                post.file_type,
                post.file_size,
                post.created_at,
            ],
        )

    def list_posts(
        self,
        *,
        page: int = 1,
        page_size: int = 10,
        search: str = "",
        category: str | None = None,
    ) -> tuple[list[Post], int]:
        """Return a filtered D1 page and the total matching row count."""
        page = max(1, page)
        page_size = min(max(1, page_size), 50)
        clauses: list[str] = []
        params: list[Any] = []
        if search.strip():
            clauses.append("(title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')")
            escaped = (
                search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            )
            params.extend([f"%{escaped}%", f"%{escaped}%"])
        if category:
            clauses.append("category = ?")
            params.append(category)
        where = f" WHERE {' AND '.join(clauses)}" if clauses else ""

        count_rows = self._query(f"SELECT COUNT(*) AS total FROM posts{where}", params)
        total = int(count_rows[0]["total"]) if count_rows else 0
        rows = self._query(
            f"""
            SELECT id, title, content, category, author_name, file_key,
                   file_name, file_type, file_size, created_at
            FROM posts{where}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            [*params, page_size, (page - 1) * page_size],
        )
        return [Post.from_d1(row) for row in rows], total

