from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _get_fernet() -> Fernet:
    key = settings.oauth_encryption_key

    if not key:
        raise RuntimeError("OAUTH_ENCRYPTION_KEY is not configured.")

    try:
        return Fernet(key.encode("utf-8"))
    except (TypeError, ValueError) as exc:
        raise RuntimeError("OAUTH_ENCRYPTION_KEY is invalid.") from exc


def encrypt_token(token: str) -> str:
    encrypted = _get_fernet().encrypt(token.encode("utf-8"))
    return encrypted.decode("utf-8")


def decrypt_token(encrypted_token: str) -> str:
    try:
        decrypted = _get_fernet().decrypt(encrypted_token.encode("utf-8"))
        return decrypted.decode("utf-8")
    except InvalidToken as exc:
        raise ValueError(
            "Could not decrypt the stored OAuth token."
        ) from exc