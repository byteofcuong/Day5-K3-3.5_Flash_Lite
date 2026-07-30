from io import BytesIO
from unittest.mock import Mock

import pytest
import requests
from botocore.exceptions import ClientError

from src.config import Settings
from src.models import Post
from src.services.d1_service import D1Service, D1ServiceError
from src.services.r2_service import R2Service, R2ServiceError


@pytest.fixture
def settings() -> Settings:
    return Settings(
        account_id="account",
        api_token="token",
        d1_database_id="database",
        r2_access_key_id="access",
        r2_secret_access_key="secret",
        r2_bucket_name="bucket",
    )


def test_d1_timeout_is_wrapped(settings: Settings) -> None:
    session = Mock()
    session.post.side_effect = requests.Timeout("slow")
    with pytest.raises(D1ServiceError, match="kết nối"):
        D1Service(settings, session=session).list_posts()


def test_d1_list_maps_response_and_parameterizes_search(settings: Settings) -> None:
    post = Post.create(
        title="Một tiêu đề",
        content="Một nội dung hợp lệ",
        category="Kiến thức",
        author_name="An",
    )
    count_response = Mock()
    count_response.raise_for_status.return_value = None
    count_response.json.return_value = {
        "success": True,
        "result": [{"success": True, "results": [{"total": 1}]}],
    }
    rows_response = Mock()
    rows_response.raise_for_status.return_value = None
    rows_response.json.return_value = {
        "success": True,
        "result": [{"success": True, "results": [post.to_dict()]}],
    }
    session = Mock()
    session.post.side_effect = [count_response, rows_response]

    posts, total = D1Service(settings, session=session).list_posts(search="100%")

    assert posts == [post]
    assert total == 1
    first_payload = session.post.call_args_list[0].kwargs["json"]
    assert "100%" not in first_payload["sql"]
    assert first_payload["params"] == ["%100\\%%", "%100\\%%"]


def test_r2_upload_error_is_wrapped(settings: Settings) -> None:
    client = Mock()
    client.upload_fileobj.side_effect = ClientError(
        {"Error": {"Code": "500", "Message": "failed"}}, "PutObject"
    )
    service = R2Service(settings, client=client)
    with pytest.raises(R2ServiceError, match="tải tệp"):
        service.upload(BytesIO(b"pdf"), "guide.pdf", "application/pdf", 3)

