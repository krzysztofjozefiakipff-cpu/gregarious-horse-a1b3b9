import json
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage

def connect():
    return smtplib.SMTP_SSL(
        os.environ["RESET_SMTP_HOST"], 465, context=ssl.create_default_context(), timeout=8
    )


def main():
    with connect() as smtp:
        smtp.login(os.environ["RESET_SMTP_USER"], os.environ["RESET_SMTP_PASSWORD"])
        if sys.argv[1:] == ["--check"]:
            print("Bieg Wyżej: SMTP authentication succeeded")
            return
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
        smtp.send_message(message)


if __name__ == "__main__":
    try:
        main()
    except (OSError, smtplib.SMTPException) as error:
        print(f"Bieg Wyżej: SMTP failed ({type(error).__name__})", file=sys.stderr)
        raise SystemExit(1) from None
