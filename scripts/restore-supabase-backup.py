#!/usr/bin/env python3
"""Restore Storage buckets/files from a Learner's Guide backup archive.

The SQL portion of the restore is intentionally handled by psql in the GitHub
Actions workflow. This helper uses the supported Supabase Storage API for the
file portion and verifies the restored file count.
"""

from __future__ import annotations

import json
import mimetypes
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


class RestoreError(RuntimeError):
    pass


def request_json(url: str, method: str, key: str, payload: dict[str, Any]) -> tuple[int, Any]:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            raw = response.read()
            return response.status, json.loads(raw.decode("utf-8") or "null")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        raise RestoreError(f"Storage API {method} {url} failed with HTTP {exc.code}: {raw[:500]}") from exc
    except urllib.error.URLError as exc:
        raise RestoreError(f"Storage API request failed: {exc}") from exc


def upload_file(base_url: str, key: str, bucket: str, object_path: str, local_path: Path) -> None:
    encoded_bucket = urllib.parse.quote(bucket, safe="")
    encoded_path = "/".join(urllib.parse.quote(part, safe="") for part in object_path.split("/"))
    url = f"{base_url}/object/{encoded_bucket}/{encoded_path}"
    content_type = mimetypes.guess_type(local_path.name)[0] or "application/octet-stream"

    try:
        result = subprocess.run(
            [
                "curl",
                "--silent",
                "--show-error",
                "--fail",
                "--retry",
                "3",
                "--retry-all-errors",
                "--connect-timeout",
                "30",
                "--max-time",
                "900",
                "-X",
                "POST",
                url,
                "-H",
                f"Authorization: Bearer {key}",
                "-H",
                f"apikey: {key}",
                "-H",
                f"Content-Type: {content_type}",
                "-H",
                "x-upsert: true",
                "-H",
                "Cache-Control: 3600",
                "--data-binary",
                f"@{local_path}",
            ],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError as exc:
        raise RestoreError(f"curl could not be started for {bucket}/{object_path}: {exc}") from exc

    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "unknown curl error").strip()[:500]
        raise RestoreError(f"upload failed for {bucket}/{object_path}: {detail}")


def safe_object_path(storage_files_root: Path, bucket: str, object_name: str) -> Path:
    """Resolve a backup object and reject path traversal outside storage/files."""
    if not bucket or not object_name:
        raise RestoreError("Storage object bucket/name cannot be empty")
    candidate = (storage_files_root / bucket / object_name).resolve()
    root = storage_files_root.resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise RestoreError(f"Unsafe Storage object path rejected: {bucket}/{object_name}") from exc
    return candidate


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: restore-supabase-backup.py <extracted-backup-directory>", file=sys.stderr)
        return 2

    root = Path(sys.argv[1]).resolve()
    supabase_url = os.environ.get("TARGET_SUPABASE_URL", "").rstrip("/")
    service_role_key = os.environ.get("TARGET_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_role_key:
        raise RestoreError("TARGET_SUPABASE_URL and TARGET_SERVICE_ROLE_KEY are required")
    if not supabase_url.startswith("https://"):
        raise RestoreError("TARGET_SUPABASE_URL must be an https Supabase project URL")

    storage_root = root / "storage"
    buckets_path = storage_root / "buckets.json"
    objects_path = storage_root / "objects.json"
    files_root = storage_root / "files"
    if not buckets_path.is_file() or not objects_path.is_file() or not files_root.is_dir():
        raise RestoreError("Backup is missing storage/buckets.json, storage/objects.json, or storage/files")

    buckets = json.loads(buckets_path.read_text(encoding="utf-8"))
    objects = json.loads(objects_path.read_text(encoding="utf-8"))
    if not isinstance(buckets, list) or not isinstance(objects, list):
        raise RestoreError("Storage metadata must be JSON arrays")

    storage_api = f"{supabase_url}/storage/v1"
    restored_buckets = 0
    uploaded = 0

    # Recreate bucket configuration using the supported bucket API.
    for bucket in buckets:
        bucket_id = bucket.get("id") or bucket.get("name")
        name = bucket.get("name") or bucket_id
        if not isinstance(bucket_id, str) or not isinstance(name, str):
            raise RestoreError("A storage bucket is missing id/name")
        options: dict[str, Any] = {"public": bool(bucket.get("public", False))}
        for source, target in (("file_size_limit", "file_size_limit"), ("allowed_mime_types", "allowed_mime_types")):
            if bucket.get(source) is not None:
                options[target] = bucket[source]
        payload = {"id": bucket_id, "name": name, **options}
        try:
            request_json(f"{storage_api}/bucket", "POST", service_role_key, payload)
            restored_buckets += 1
        except RestoreError as create_error:
            # The destination may already contain the bucket. In that case,
            # update its configuration rather than failing the whole restore.
            try:
                request_json(
                    f"{storage_api}/bucket/{urllib.parse.quote(bucket_id, safe='')}",
                    "PUT",
                    service_role_key,
                    options,
                )
                restored_buckets += 1
            except RestoreError:
                raise create_error

    # Upload every backed-up object from the extracted directory.
    for item in objects:
        bucket = item.get("bucket")
        object_name = item.get("name")
        if not isinstance(bucket, str) or not isinstance(object_name, str):
            raise RestoreError("A storage object is missing bucket/name")
        local_path = safe_object_path(files_root, bucket, object_name)
        if not local_path.is_file():
            raise RestoreError(f"Missing backed-up Storage file: {bucket}/{object_name}")
        upload_file(storage_api, service_role_key, bucket, object_name, local_path)
        uploaded += 1
        if uploaded % 25 == 0:
            print(f"storage-progress: uploaded {uploaded}/{len(objects)}")

    summary = {
        "storage_buckets_restored": restored_buckets,
        "storage_objects_expected": len(objects),
        "storage_objects_uploaded": uploaded,
        "ok": True,
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RestoreError as exc:
        print(f"restore-error: {exc}", file=sys.stderr)
        raise SystemExit(1)
