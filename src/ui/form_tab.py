"""Post creation tab."""

from __future__ import annotations

from io import BytesIO

import streamlit as st

from src.models import CATEGORIES, Post
from src.services.d1_service import D1Service, D1ServiceError
from src.services.r2_service import R2Service, R2ServiceError
from src.utils.helpers import validate_file


def render_form_tab(d1: D1Service, r2: R2Service) -> None:
    """Render the create-post form and coordinate its services."""
    if message := st.session_state.pop("post_success", None):
        st.success(message)

    with st.form("create_post", clear_on_submit=True):
        author = st.text_input("Tên người đăng", max_chars=60)
        title = st.text_input("Tiêu đề", max_chars=150)
        category = st.selectbox("Danh mục", CATEGORIES)
        content = st.text_area("Nội dung", max_chars=10_000, height=180)
        attachment = st.file_uploader(
            "Tệp đính kèm (tối đa 20 MB)",
            type=["pdf", "docx", "xlsx", "pptx", "txt", "png", "jpg", "jpeg", "zip"],
        )
        submitted = st.form_submit_button("Đăng bài", type="primary")

    if not submitted:
        return

    file_key: str | None = None
    try:
        file_metadata: dict[str, object] = {}
        if attachment is not None:
            data = attachment.getvalue()
            validate_file(attachment.name, attachment.type, len(data))
            with st.spinner("Đang tải tệp lên..."):
                file_key = r2.upload(
                    BytesIO(data), attachment.name, attachment.type, len(data)
                )
            file_metadata = {
                "file_key": file_key,
                "file_name": attachment.name,
                "file_type": attachment.type,
                "file_size": len(data),
            }
        post = Post.create(
            title=title,
            content=content,
            category=category,
            author_name=author,
            **file_metadata,
        )
        with st.spinner("Đang lưu bài viết..."):
            d1.create_post(post)
    except (ValueError, D1ServiceError, R2ServiceError) as exc:
        if file_key:
            try:
                r2.delete(file_key)
            except R2ServiceError:
                pass
        st.error(str(exc))
        return

    from src.ui.feed_tab import load_posts

    load_posts.clear()
    st.session_state["post_success"] = "Đăng bài thành công."
    st.rerun()

