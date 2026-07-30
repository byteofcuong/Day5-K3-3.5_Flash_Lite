"""Newsfeed tab."""

from __future__ import annotations

import math
from datetime import datetime

import streamlit as st

from src.models import CATEGORIES, Post
from src.services.d1_service import D1Service, D1ServiceError
from src.services.r2_service import R2Service, R2ServiceError
from src.utils.helpers import format_file_size

PAGE_SIZE = 10


@st.cache_data(ttl=30, show_spinner=False)
def load_posts(
    _d1: D1Service, page: int, search: str, category: str | None
) -> tuple[list[Post], int]:
    """Cache a short-lived page without hashing the credential-bearing client."""
    return _d1.list_posts(
        page=page, page_size=PAGE_SIZE, search=search, category=category
    )


def _render_post(post: Post, r2: R2Service) -> None:
    with st.container(border=True):
        st.subheader(post.title)
        try:
            created = datetime.fromisoformat(post.created_at.replace("Z", "+00:00"))
            date_label = created.strftime("%d/%m/%Y %H:%M UTC")
        except ValueError:
            date_label = post.created_at
        st.caption(f"{post.author_name} · {post.category} · {date_label}")
        st.write(post.content)
        if post.file_key and post.file_name:
            st.caption(f"📎 {post.file_name} · {format_file_size(post.file_size)}")
            if st.button("Tạo liên kết tải", key=f"download-{post.id}"):
                try:
                    url = r2.create_download_url(post.file_key)
                    st.link_button("Tải tài liệu", url, type="primary")
                    st.caption("Liên kết có hiệu lực trong 15 phút.")
                except R2ServiceError as exc:
                    st.error(str(exc))


def render_feed_tab(d1: D1Service, r2: R2Service) -> None:
    """Render filters, a paginated feed and attachment downloads."""
    search = st.text_input("Tìm kiếm", placeholder="Tiêu đề hoặc nội dung...")
    selected = st.selectbox("Lọc danh mục", ("Tất cả", *CATEGORIES))
    category = None if selected == "Tất cả" else selected

    filter_key = (search.strip(), category)
    if st.session_state.get("feed_filter") != filter_key:
        st.session_state["feed_page"] = 1
        st.session_state["feed_filter"] = filter_key
    page = st.session_state.get("feed_page", 1)

    try:
        with st.spinner("Đang tải bảng tin..."):
            posts, total = load_posts(d1, page, search.strip(), category)
    except (D1ServiceError, ValueError) as exc:
        st.error(f"Không thể tải bảng tin. {exc}")
        return

    if not posts:
        st.info("Chưa có bài viết phù hợp.")
        return

    st.caption(f"{total} bài viết")
    for post in posts:
        _render_post(post, r2)

    total_pages = max(1, math.ceil(total / PAGE_SIZE))
    if page > total_pages:
        st.session_state["feed_page"] = total_pages
        st.rerun()
    previous, indicator, following = st.columns([1, 2, 1])
    if previous.button("← Trước", disabled=page <= 1, use_container_width=True):
        st.session_state["feed_page"] = page - 1
        st.rerun()
    indicator.markdown(
        f"<p style='text-align:center'>Trang {page}/{total_pages}</p>",
        unsafe_allow_html=True,
    )
    if following.button(
        "Sau →", disabled=page >= total_pages, use_container_width=True
    ):
        st.session_state["feed_page"] = page + 1
        st.rerun()

