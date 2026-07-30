"""Cloudflare R2 storage client."""

from __future__ import annotations

from typing import BinaryIO

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from src.config import Settings
from src.utils.helpers import make_object_key, validate_file


class R2ServiceError(RuntimeError):
    """A safe, contextual R2 failure."""


class R2Service:
    def __init__(self, settings: Settings, client: object | None = None) -> None:
        self.settings = settings
        self.client = client or boto3.client(
            "s3",
            endpoint_url=settings.r2_endpoint_url,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name="auto",
            config=Config(
                connect_timeout=settings.http_timeout,
                read_timeout=settings.http_timeout,
                retries={"max_attempts": 2},
                signature_version="s3v4",
            ),
        )

    def upload(
        self, file_obj: BinaryIO, filename: str, mime_type: str, size: int
    ) -> str:
        """Validate and upload a file, returning only its object key."""
        validate_file(filename, mime_type, size)
        object_key = make_object_key(filename)
        try:
            self.client.upload_fileobj(
                file_obj,
                self.settings.r2_bucket_name,
                object_key,
                ExtraArgs={"ContentType": mime_type},
            )
        except (BotoCoreError, ClientError, OSError) as exc:
            raise R2ServiceError("Không thể tải tệp lên Cloudflare R2.") from exc
        return object_key

    def delete(self, object_key: str) -> None:
        """Best-effort caller-facing deletion of an R2 object."""
        try:
            self.client.delete_object(
                Bucket=self.settings.r2_bucket_name, Key=object_key
            )
        except (BotoCoreError, ClientError) as exc:
            raise R2ServiceError("Không thể xóa tệp khỏi Cloudflare R2.") from exc

    def create_download_url(self, object_key: str) -> str:
        """Create a short-lived download URL without persisting or logging it."""
        try:
            return self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.settings.r2_bucket_name, "Key": object_key},
                ExpiresIn=self.settings.download_expiry,
            )
        except (BotoCoreError, ClientError) as exc:
            raise R2ServiceError("Không thể tạo liên kết tải tệp.") from exc

