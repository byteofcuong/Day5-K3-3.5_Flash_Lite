"""VShare Streamlit entrypoint."""

import streamlit as st

from src.config import ConfigError, load_settings
from src.services.d1_service import D1Service
from src.services.r2_service import R2Service
from src.ui.feed_tab import render_feed_tab
from src.ui.form_tab import render_form_tab

st.set_page_config(page_title="VShare", page_icon="📚", layout="centered")
st.title("📚 VShare")
st.caption("Chia sẻ kiến thức và tài liệu cùng cộng đồng")

try:
    settings = load_settings()
except ConfigError as exc:
    st.error(str(exc))
    st.info("Sao chép `.streamlit/secrets.toml.example` thành `secrets.toml`.")
    st.stop()

d1_service = D1Service(settings)
r2_service = R2Service(settings)
feed_tab, form_tab = st.tabs(["Bảng tin", "Đăng bài"])
with feed_tab:
    render_feed_tab(d1_service, r2_service)
with form_tab:
    render_form_tab(d1_service, r2_service)

