from email.message import EmailMessage
from email.utils import formataddr
import smtplib
import ssl

from app.core.config import settings


def send_email_verification_code(to_email: str, otp: str) -> None:
    required_settings = (
        settings.smtp_host,
        settings.smtp_username,
        settings.smtp_password,
        settings.smtp_from_email,
    )

    if not all(required_settings):
        raise RuntimeError("SMTP settings are incomplete.")

    message = EmailMessage()
    message["Subject"] = "Verify your email address"
    message["From"] = (
        formataddr((settings.smtp_from_name, settings.smtp_from_email))
        if settings.smtp_from_name
        else settings.smtp_from_email
    )
    message["To"] = to_email
    message.set_content(
        f"Your email verification code is: {otp}\n\n"
        "This code expires in 5 minutes. "
        "If you did not request it, you can ignore this email."
    )

    tls_context = ssl.create_default_context()

    if settings.smtp_port == 465:
        with smtplib.SMTP_SSL(
            settings.smtp_host,
            settings.smtp_port,
            timeout=settings.smtp_timeout_seconds,
            context=tls_context,
        ) as server:
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
        return

    if not settings.smtp_starttls:
        raise RuntimeError("SMTP must use STARTTLS or port 465 with SSL.")

    with smtplib.SMTP(
        settings.smtp_host,
        settings.smtp_port,
        timeout=settings.smtp_timeout_seconds,
    ) as server:
        server.ehlo()
        server.starttls(context=tls_context)
        server.ehlo()
        server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)