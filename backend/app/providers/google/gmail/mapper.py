import base64
import binascii
from datetime import datetime, timezone
from email.header import decode_header, make_header
from email.message import Message
from email.utils import formataddr, getaddresses
from typing import Any


def _decode_header_value(value: str | None) -> str | None:
    if not value:
        return None

    try:
        return str(make_header(decode_header(value)))
    except (LookupError, UnicodeDecodeError, ValueError):
        return value


def _get_header(headers: list[dict[str, Any]], name: str) -> str | None:
    for header in headers:
        if header.get("name", "").lower() == name.lower():
            return _decode_header_value(header.get("value"))
    return None


def _parse_addresses(value: str | None) -> list[str]:
    if not value:
        return []

    decoded = _decode_header_value(value) or ""
    result = []

    for display_name, address in getaddresses([decoded]):
        if address:
            result.append(formataddr((display_name, address)))
        elif display_name:
            result.append(display_name)

    return result


def _decode_part_body(part: dict[str, Any]) -> str:
    encoded_data = part.get("body", {}).get("data")
    if not encoded_data:
        return ""

    padding = "=" * (-len(encoded_data) % 4)

    try:
        raw_data = base64.urlsafe_b64decode(encoded_data + padding)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Gmail returned an invalid encoded message body.") from exc

    content_type = Message()
    content_type["Content-Type"] = part.get("mimeType", "text/plain")
    charset = content_type.get_content_charset() or "utf-8"

    return raw_data.decode(charset, errors="replace")


def _collect_bodies(
    part: dict[str, Any],
    bodies: dict[str, list[str]],
) -> None:
    # Message attachments are synchronized separately; don't store their data
    # as the email body.
    if part.get("filename"):
        return

    mime_type = part.get("mimeType", "").lower()

    if mime_type in ("text/plain", "text/html"):
        decoded_body = _decode_part_body(part)
        if decoded_body:
            bodies[mime_type].append(decoded_body)

    for child_part in part.get("parts", []):
        _collect_bodies(child_part, bodies)


def map_gmail_message(
    message: dict[str, Any],
    *,
    user_id: int,
    integration_id: int,
) -> dict[str, Any]:
    """Convert one full Gmail API message to Email model fields."""

    external_id = message.get("id")
    if not external_id:
        raise ValueError("Gmail message is missing its ID.")

    payload = message.get("payload") or {}
    headers = payload.get("headers", [])
    bodies: dict[str, list[str]] = {
        "text/plain": [],
        "text/html": [],
    }

    _collect_bodies(payload, bodies)

    label_ids = [str(label) for label in message.get("labelIds", [])]

    internal_date = message.get("internalDate")
    received_at = (
        datetime.fromtimestamp(int(internal_date) / 1000, tz=timezone.utc)
        if internal_date is not None
        else None
    )

    return {
        "user_id": user_id,
        "integration_id": integration_id,
        "external_id": str(external_id),
        "thread_id": message.get("threadId"),
        "subject": _get_header(headers, "Subject"),
        "sender": next(iter(_parse_addresses(_get_header(headers, "From"))), None),
        "recipients": _parse_addresses(_get_header(headers, "To")),
        "cc": _parse_addresses(_get_header(headers, "Cc")),
        "bcc": _parse_addresses(_get_header(headers, "Bcc")),
        "snippet": message.get("snippet"),
        "body_text": "\n".join(bodies["text/plain"]) or None,
        "body_html": "\n".join(bodies["text/html"]) or None,
        "received_at": received_at,
        "is_read": "UNREAD" not in label_ids,
        "is_starred": "STARRED" in label_ids,
        "labels": label_ids,
    }