import json
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage

def connect(host):
    return smtplib.SMTP_SSL(
        host, 465, context=ssl.create_default_context(), timeout=8
    )


def main():
    invite = "--invite" in sys.argv[1:]
    sender = "admin@biegwyzej.pl" if invite else os.environ["RESET_SMTP_USER"]
    password = os.environ["INVITE_SMTP_PASSWORD" if invite else "RESET_SMTP_PASSWORD"]
    with connect(os.environ["RESET_SMTP_HOST"]) as smtp:
        smtp.login(sender, password)
        if "--check" in sys.argv[1:]:
            print("Bieg Wyżej: SMTP authentication succeeded")
            return
        recipient, url, *details = json.load(sys.stdin)
        message = EmailMessage()
        message["From"] = sender
        message["To"] = recipient
        message["Subject"] = "Bieg Wyżej — reset hasła"
        message.set_content(
            "Ustaw nowe hasło do Biegu Wyżej. Link jest ważny 20 minut.\n\n"
            f"{url}\n\n"
            "Jeśli nie proszono o reset, zignoruj tę wiadomość.\n"
        )
        if invite:
            inviter, roles = details
            descriptions = {
                "reception": "Recepcja: korzystasz z komunikacji salonu.",
                "sales_assistant": "Asystent sprzedaży: korzystasz z komunikacji salonu.",
                "carwash": "Pracownik myjni: korzystasz ze skrzynki działu.",
                "logistics": "Pracownik logistyki i transportu: korzystasz ze skrzynki działu.",
                "carwash_manager": "Kierownik myjni: zarządzasz zespołem i skrzynką myjni.",
                "logistics_manager": "Kierownik logistyki i transportu: zarządzasz zespołem i skrzynką działu.",
                "staff": "Pracownik: korzystasz ze wspólnej zakładki Z życia salonu.",
                "seller": "Handlowiec: uzupełniasz działania i wyniki, śledzisz własny lejek i cele oraz korzystasz z lekcji dnia.",
                "manager": "Kierownik salonu: zarządzasz zespołem w przypisanych salonach, ustawiasz plany i sprawdzasz wyniki handlowców.",
                "group": "Szef grupy dealerskiej: przeglądasz i porównujesz wyniki salonów w swojej grupie oraz zarządzasz salonami i użytkownikami w zakresie swoich uprawnień.",
            }
            permissions = "\n".join("- " + descriptions[role] for role in roles)
            message.replace_header("Subject", "Bieg Wyżej — zaproszenie do aplikacji")
            message.set_content(
                f"{inviter} zaprasza Cię do aplikacji Bieg Wyżej.\n\n"
                f"Twoje uprawnienia:\n{permissions}\n\n"
                "Pierwsze logowanie:\n"
                f"1. Otwórz link i ustaw własne hasło (co najmniej 8 znaków):\n{url}\n"
                f"2. Wejdź na https://biegwyzej.pl/login i zaloguj się jako {recipient} nowym hasłem.\n"
                "Link jest jednorazowy i ważny przez 24 godziny. Po jego wygaśnięciu użyj opcji „Nie pamiętam hasła” na stronie logowania.\n"
            )
        smtp.send_message(message)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Bieg Wyżej: SMTP failed ({type(error).__name__})", file=sys.stderr)
        raise SystemExit(1) from None
