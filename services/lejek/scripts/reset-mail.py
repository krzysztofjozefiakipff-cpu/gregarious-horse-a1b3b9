import json
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage

recipient, url = json.load(sys.stdin)
message = EmailMessage()
message["From"] = os.environ["RESET_SMTP_USER"]
message["To"] = recipient
message["Subject"] = "Bieg Wyżej — reset hasła"
message.set_content(
    "Ustaw nowe hasło do Biegu Wyżej. Link jest ważny 20 minut.\n\n"
    f"{url}\n\n"
    "Jeśli nie proszono o reset, zignoruj tę wiadomość.\n"
)
with smtplib.SMTP_SSL(os.environ["RESET_SMTP_HOST"], 465, context=ssl.create_default_context(), timeout=8) as smtp:
    smtp.login(os.environ["RESET_SMTP_USER"], os.environ["RESET_SMTP_PASSWORD"])
    smtp.send_message(message)
