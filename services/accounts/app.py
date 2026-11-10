"""CARVAMO account API (OVH). No default credentials or bootstrap endpoints."""
import hashlib
import os
import smtplib
import ssl
from concurrent.futures import ThreadPoolExecutor
from email.message import EmailMessage
from threading import BoundedSemaphore, Lock
import time
import secrets
from collections import defaultdict, deque
import re
from datetime import timedelta
from functools import wraps
from flask import Flask, request, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix
import psycopg
from psycopg.rows import dict_row
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

app = Flask(__name__)
app.json.ensure_ascii = False
# Only the private Caddy proxy can reach this container.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)
DATABASE_URL = os.environ["DATABASE_URL"]
SESSION_SECRET = os.environ["SESSION_SECRET"]
if len(SESSION_SECRET) < 40:
    raise RuntimeError("SESSION_SECRET must be at least 40 characters")
signer = URLSafeTimedSerializer(SESSION_SECRET, salt="carvamo-session-v1")
hasher = PasswordHasher()
reset_signer = URLSafeTimedSerializer(SESSION_SECRET, salt="carvamo-password-reset-v1")
RESET_SECONDS = 20 * 60
SMTP_USER = os.getenv("RESET_SMTP_USER")
SMTP_PASSWORD = os.getenv("RESET_SMTP_PASSWORD")
SMTP_HOST = os.getenv("RESET_SMTP_HOST")
RESET_ORIGIN = "https://preview.carvamo.com"
reset_pool = ThreadPoolExecutor(max_workers=2)
reset_slots = BoundedSemaphore(16)
reset_lock = Lock()
reset_attempts = {}
ROLES = {"admin", "staff", "dealer", "dealer_admin", "dealer_staff"}
SESSION_SECONDS = 8 * 3600
LOGIN_ATTEMPTS = defaultdict(deque)
LOGIN_LIMIT = 8
LOGIN_WINDOW = 900

def conn():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)

def fail(message, status=400):
    return jsonify({"error": message}), status

def credential_version_for(password_hash):
    return hashlib.sha256((password_hash or "").encode()).hexdigest()

def allow_reset_request(email):
    now = time.monotonic()
    keys = [("ip", request.remote_addr or "unknown", 8), ("email", email, 2)]
    with reset_lock:
        for key, attempts in list(reset_attempts.items()):
            while attempts and attempts[0] <= now - RESET_SECONDS:
                attempts.popleft()
            if not attempts:
                del reset_attempts[key]
        if len(reset_attempts) >= 4096:
            return False
        if any(len(reset_attempts.get((kind, value), ())) >= limit for kind, value, limit in keys):
            return False
        for kind, value, _ in keys:
            reset_attempts.setdefault((kind, value), deque()).append(now)
    return True

def send_reset_link(email):
    try:
        with conn() as db:
            user = db.execute(
                "SELECT id,email,password_hash FROM users WHERE lower(email)=%s AND enabled", (email,)
            ).fetchone()
        if not user or not user["password_hash"]:
            return
        token = reset_signer.dumps({
            "id": str(user["id"]),
            "version": credential_version_for(user["password_hash"]),
            "nonce": secrets.token_urlsafe(16),
        })
        message = EmailMessage()
        message["From"] = SMTP_USER
        message["To"] = user["email"]
        message["Subject"] = "Carvamo — reset hasła"
        message.set_content(
            "Ustaw nowe hasło do konta Carvamo. Link jest ważny 20 minut.\n\n"
            f"{RESET_ORIGIN}/accounts/#reset={token}\n\n"
            "Jeśli nie proszono o reset, zignoruj tę wiadomość.\n"
        )
        with smtplib.SMTP_SSL(SMTP_HOST, 465, context=ssl.create_default_context(), timeout=8) as smtp:
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(message)
    except Exception:
        app.logger.error("Password reset delivery failed")
    finally:
        reset_slots.release()

@app.post("/api/auth/password-reset/request")
def request_password_reset():
    if not all((SMTP_HOST, SMTP_USER, SMTP_PASSWORD)):
        return fail("Reset przez e-mail jest chwilowo niedostępny.", 503)
    data = request.get_json(silent=True)
    email = str(data.get("email", "")).strip().lower() if isinstance(data, dict) else ""
    if len(email) <= 254 and re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        if allow_reset_request(email) and reset_slots.acquire(blocking=False):
            reset_pool.submit(send_reset_link, email)
    return jsonify({"ok": True}), 202

@app.post("/api/auth/password-reset/confirm")
def confirm_password_reset():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return fail("Nieprawidłowe dane resetu.")
    password, token = data.get("password"), data.get("token")
    if not isinstance(password, str) or not 12 <= len(password) <= 256:
        return fail("Nowe hasło musi mieć od 12 do 256 znaków.")
    invalid = "Link do resetu jest nieprawidłowy, wygasł lub został już użyty."
    if not isinstance(token, str) or not 1 <= len(token) <= 1024:
        return fail(invalid)
    try:
        payload = reset_signer.loads(token, max_age=RESET_SECONDS)
    except BadSignature:
        return fail(invalid)
    with conn() as db:
        user = db.execute(
            "SELECT id,password_hash FROM users WHERE id=%s AND enabled FOR UPDATE",
            (payload["id"],),
        ).fetchone()
        if not user or not secrets.compare_digest(payload["version"], credential_version_for(user["password_hash"])):
            return fail(invalid)
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(user["id"]),))
        db.execute("UPDATE users SET password_hash=%s WHERE id=%s", (hasher.hash(password), user["id"]))
    return jsonify({"ok": True})

def account(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return fail("Wymagane logowanie", 401)
        try:
            payload = signer.loads(auth[7:], max_age=SESSION_SECONDS)
            uid = payload["id"]
            credential_version = payload["credential_version"]
        except (BadSignature, SignatureExpired):
            return fail("Sesja wygasła", 401)
        with conn() as db:
            user = db.execute(
                "SELECT id,email,role,dealer_id,enabled,password_hash FROM users WHERE id=%s", (uid,)
            ).fetchone()
        if not user or not user["enabled"]:
            return fail("Konto nieaktywne", 403)
        if not secrets.compare_digest(credential_version, credential_version_for(user["password_hash"])):
            return fail("Sesja została unieważniona", 401)
        user.pop("password_hash", None)
        return f(user, *args, **kwargs)
    return wrapper

def permitted(actor, role, dealer_id):
    if actor["role"] == "admin":
        return (role in {"admin", "staff"} and dealer_id is None) or (
            role in {"dealer", "dealer_admin", "dealer_staff"} and dealer_id is not None
        )
    return actor["role"] == "dealer_admin" and role == "dealer_staff" and (
        dealer_id is not None and str(actor["dealer_id"]) == str(dealer_id)
    )

@app.get("/api/health")
def health():
    with conn() as db:
        db.execute("SELECT 1")
    return jsonify({"status": "ok", "service": "carvamo-accounts"})

@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if len(email) > 254 or not password:
        return fail("Nieprawidłowe dane logowania", 401)
    # Conservative per-source throttling; production deployment should also apply proxy-level limits.
    source = (request.remote_addr or "unknown") + "|" + email
    now = time.monotonic()
    attempts = LOGIN_ATTEMPTS[source]
    while attempts and attempts[0] < now - LOGIN_WINDOW:
        attempts.popleft()
    if len(attempts) >= LOGIN_LIMIT:
        return fail("Zbyt wiele prób. Spróbuj później", 429)
    attempts.append(now)
    with conn() as db:
        user = db.execute("SELECT id,password_hash,enabled FROM users WHERE lower(email)=%s", (email,)).fetchone()
    if not user or not user["enabled"] or not user["password_hash"]:
        return fail("Nieprawidłowe dane logowania", 401)
    try:
        hasher.verify(user["password_hash"], password)
    except (VerifyMismatchError, VerificationError):
        return fail("Nieprawidłowe dane logowania", 401)
    attempts.clear()
    return jsonify({"token": signer.dumps({"id": str(user["id"]), "credential_version": credential_version_for(user["password_hash"])}), "expires_in": SESSION_SECONDS})

@app.get("/api/accounts")
@account
def list_accounts(actor):
    if actor["role"] not in {"admin", "dealer_admin"}:
        return fail("Brak uprawnień", 403)
    with conn() as db:
        if actor["role"] == "admin":
            rows = db.execute("SELECT id,email,role,dealer_id,enabled,created_at,(phone IS NOT NULL) AS has_phone FROM users ORDER BY created_at DESC LIMIT 500").fetchall()
        else:
            rows = db.execute("SELECT id,email,role,dealer_id,enabled,created_at,(phone IS NOT NULL) AS has_phone FROM users WHERE dealer_id=%s AND role='dealer_staff' ORDER BY created_at DESC LIMIT 500", (actor["dealer_id"],)).fetchall()
    return jsonify({"accounts": rows})

@app.post("/api/accounts")
@account
def create_account(actor):
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    role = str(data.get("role", ""))
    dealer_id = data.get("dealer_id") or None
    password = str(data.get("temporary_password", ""))
    raw_phone = data.get("phone", "")
    if not isinstance(raw_phone, str) or len(raw_phone) > 24:
        return fail("Nieprawidłowy numer telefonu")
    phone = re.sub(r"[ ()-]", "", raw_phone)
    if re.fullmatch(r"[0-9]{9}", phone):
        phone = "+48" + phone
    if phone and not re.fullmatch(r"\+[1-9][0-9]{7,14}", phone):
        return fail("Wpisz 9 cyfr dla Polski lub numer z prefiksem kraju.")
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) or len(email) > 254:
        return fail("Nieprawidłowy e-mail")
    if role not in ROLES or not permitted(actor, role, dealer_id):
        return fail("Nie można nadać tej roli", 403)
    if len(password) < 12 or len(password) > 256:
        return fail("Hasło tymczasowe musi mieć od 12 do 256 znaków")
    try:
        with conn() as db:
            db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
            row = db.execute(
                "INSERT INTO users(email,password_hash,role,dealer_id,enabled,phone) VALUES (%s,%s,%s,%s,true,%s) RETURNING id,email,role,dealer_id,enabled",
                (email, hasher.hash(password), role, dealer_id, phone or None)
            ).fetchone()
            db.execute("INSERT INTO account_audit(actor_id,target_id,dealer_id,action,new_role) VALUES (%s,%s,%s,'create',%s)",
                       (actor["id"], row["id"], dealer_id, role))
        return jsonify({"account": row}), 201
    except psycopg.errors.UniqueViolation:
        return fail("Konto z tym adresem już istnieje", 409)
    except psycopg.errors.ForeignKeyViolation:
        return fail("Dealer nie istnieje", 400)

@app.patch("/api/accounts/<uuid:target_id>/status")
@account
def set_status(actor, target_id):
    enabled = (request.get_json(silent=True) or {}).get("enabled")
    if not isinstance(enabled, bool):
        return fail("Pole enabled musi być wartością logiczną")
    with conn() as db:
        target = db.execute("SELECT id,role,dealer_id,enabled FROM users WHERE id=%s", (target_id,)).fetchone()
        if not target:
            return fail("Nie znaleziono konta", 404)
        if target["id"] == actor["id"] or not permitted(actor, target["role"], target["dealer_id"]):
            return fail("Brak uprawnień", 403)
        if target["role"] == "admin":
            return fail("Zmiana administratora wymaga procedury właścicielskiej", 403)
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
        db.execute("UPDATE users SET enabled=%s WHERE id=%s", (enabled, target_id))
        db.execute("INSERT INTO account_audit(actor_id,target_id,dealer_id,action,old_role,new_role) VALUES (%s,%s,%s,%s,%s,%s)",
                   (actor["id"], target_id, target["dealer_id"], "activate" if enabled else "deactivate", target["role"], target["role"]))
    return jsonify({"ok": True})

@app.get("/api/auth/me")
@account
def me(actor):
    return jsonify({"account": actor})

@app.post("/api/auth/change-password")
@account
def change_password(actor):
    data = request.get_json(silent=True) or {}
    old = str(data.get("current_password", ""))
    new = str(data.get("new_password", ""))
    if len(new) < 12 or len(new) > 256:
        return fail("Nowe hasło musi mieć od 12 do 256 znaków")
    with conn() as db:
        row = db.execute("SELECT password_hash FROM users WHERE id=%s", (actor["id"],)).fetchone()
        try:
            hasher.verify(row["password_hash"], old)
        except (VerifyMismatchError, VerificationError, TypeError):
            return fail("Nieprawidłowe obecne hasło", 403)
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
        db.execute("UPDATE users SET password_hash=%s WHERE id=%s", (hasher.hash(new), actor["id"]))
    return jsonify({"ok": True})

@app.get("/api/dealers")
@account
def list_dealers(actor):
    if actor["role"] != "admin":
        return fail("Brak uprawnień", 403)
    with conn() as db:
        rows = db.execute("SELECT id,name,active FROM dealers WHERE active=true ORDER BY name LIMIT 500").fetchall()
    return jsonify({"dealers": rows})


# Staging offer workflow: dealer isolation is enforced server-side, never by UI filters.
@app.get("/api/offers")
@account
def list_offers(actor):
    if actor["role"] not in {"admin", "staff", "dealer", "dealer_admin", "dealer_staff"}:
        return fail("Brak uprawnień", 403)
    with conn() as db:
        if actor["role"] in {"admin", "staff"}:
            rows = db.execute(
                "SELECT id,brand,model,body,fuel,gross_price,dealer_id,status,source,special,created_at "
                "FROM offers WHERE deletion_pending=false ORDER BY created_at DESC LIMIT 200"
            ).fetchall()
        else:
            if not actor["dealer_id"]:
                return fail("Brak przypisanego dealera", 403)
            rows = db.execute(
                "SELECT id,brand,model,body,fuel,gross_price,dealer_id,status,source,special,created_at "
                "FROM offers WHERE dealer_id=%s AND deletion_pending=false ORDER BY created_at DESC LIMIT 200",
                (actor["dealer_id"],)
            ).fetchall()
    return jsonify({"offers": rows})


@app.post("/api/offers")
@account
def create_offer(actor):
    if actor["role"] not in {"admin", "staff", "dealer", "dealer_admin", "dealer_staff"}:
        return fail("Brak uprawnień", 403)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return fail("Nieprawidłowe dane oferty")
    fields = {}
    for key in ("brand", "model", "body", "fuel"):
        value = data.get(key)
        if not isinstance(value, str) or not 1 <= len(value.strip()) <= 100:
            return fail("Wymagane pole: " + key)
        fields[key] = value.strip()
    try:
        from decimal import Decimal, InvalidOperation
        price = Decimal(str(data.get("gross_price")))
        if not price.is_finite() or not Decimal("0") < price < Decimal("100000000"):
            return fail("Nieprawidłowa cena brutto")
    except (InvalidOperation, TypeError, ValueError):
        return fail("Nieprawidłowa cena brutto")
    if not isinstance(data.get("special", False), bool):
        return fail("Nieprawidłowe pole special")
    if actor["role"] in {"admin", "staff"}:
        dealer_id = data.get("dealer_id")
        if not isinstance(dealer_id, str):
            return fail("Wybierz dealera")
    else:
        dealer_id = str(actor["dealer_id"]) if actor["dealer_id"] else None
    if not dealer_id:
        return fail("Brak przypisanego dealera", 403)
    with conn() as db:
        dealer = db.execute("SELECT id FROM dealers WHERE id::text=%s AND active=true", (dealer_id,)).fetchone()
        if not dealer:
            return fail("Dealer nie istnieje lub jest nieaktywny", 400)
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
        row = db.execute(
            "INSERT INTO offers(brand,model,body,fuel,gross_price,dealer_id,status,source,special,created_by) "
            "VALUES (%s,%s,%s,%s,%s,%s,'draft',%s,%s,%s) RETURNING id,status",
            (fields["brand"], fields["model"], fields["body"], fields["fuel"], price, dealer["id"],
             "dealer" if actor["role"].startswith("dealer") else "carvamo", data.get("special", False), actor["id"])
        ).fetchone()
    return jsonify({"offer": row}), 201


@app.patch("/api/offers/<uuid:offer_id>/publish")
@account
def publish_offer(actor, offer_id):
    """Dealer publishes own offer without CARVAMO approval."""
    with conn() as db:
        row = db.execute(
            "SELECT id,dealer_id,status FROM offers WHERE id=%s AND deletion_pending=false FOR UPDATE",
            (offer_id,)
        ).fetchone()
        if not row:
            return fail("Nie znaleziono oferty", 404)
        if actor["role"] not in {"admin", "staff"} and (
            actor["role"] not in {"dealer", "dealer_admin", "dealer_staff"} or
            str(actor["dealer_id"]) != str(row["dealer_id"])
        ):
            return fail("Brak uprawnień", 403)
        if row["status"] not in {"draft", "pending", "rejected"}:
            return fail("Oferty nie można opublikować", 409)
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
        db.execute("UPDATE offers SET status='published',updated_at=now() WHERE id=%s", (offer_id,))
    return jsonify({"ok": True, "status": "published"})


@app.patch("/api/offers/<uuid:offer_id>/withdraw")
@account
def withdraw_offer(actor, offer_id):
    with conn() as db:
        row = db.execute(
            "SELECT id,dealer_id,status FROM offers WHERE id=%s AND deletion_pending=false FOR UPDATE",
            (offer_id,)
        ).fetchone()
        if not row:
            return fail("Nie znaleziono oferty", 404)
        if actor["role"] not in {"admin", "staff"} and (
            actor["role"] not in {"dealer", "dealer_admin", "dealer_staff"} or
            str(actor["dealer_id"]) != str(row["dealer_id"])
        ):
            return fail("Brak uprawnień", 403)
        if row["status"] != "published":
            return fail("Oferta nie jest opublikowana", 409)
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
        db.execute("UPDATE offers SET status='draft',updated_at=now() WHERE id=%s", (offer_id,))
    return jsonify({"ok": True, "status": "draft"})


# Lead access is scoped in SQL, not merely hidden in the browser.
@app.get("/api/leads")
@account
def list_leads(actor):
    role = actor["role"]
    with conn() as db:
        if role == "admin":
            rows = db.execute("SELECT id,offer_id,dealer_id,assigned_to,full_name,email,phone,message,status,created_at FROM leads ORDER BY created_at DESC LIMIT 200").fetchall()
        elif role == "dealer_admin":
            rows = db.execute("SELECT id,offer_id,dealer_id,assigned_to,full_name,email,phone,message,status,created_at FROM leads WHERE dealer_id=%s ORDER BY created_at DESC LIMIT 200", (actor["dealer_id"],)).fetchall()
        elif role == "dealer_staff":
            rows = db.execute("SELECT id,offer_id,dealer_id,assigned_to,full_name,email,phone,message,status,created_at FROM leads WHERE dealer_id=%s AND assigned_to=%s ORDER BY created_at DESC LIMIT 200", (actor["dealer_id"],actor["id"])).fetchall()
        else:
            return fail("Brak uprawnień do leadów", 403)
    return jsonify({"leads": rows})


@app.patch("/api/leads/<uuid:lead_id>/assign")
@account
def assign_lead(actor, lead_id):
    if actor["role"] not in {"admin", "dealer_admin"}:
        return fail("Brak uprawnień", 403)
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or "assigned_to" not in data:
        return fail("Wymagane pole assigned_to")
    assignee = data["assigned_to"]
    if assignee is not None:
        try:
            from uuid import UUID
            assignee = UUID(str(assignee))
        except (ValueError, TypeError, AttributeError):
            return fail("Nieprawidłowy identyfikator pracownika")
    with conn() as db:
        lead = db.execute("SELECT id,dealer_id FROM leads WHERE id=%s FOR UPDATE", (lead_id,)).fetchone()
        if not lead:
            return fail("Nie znaleziono leada", 404)
        if actor["role"] == "dealer_admin" and str(actor["dealer_id"]) != str(lead["dealer_id"]):
            return fail("Brak uprawnień", 403)
        if assignee is not None:
            target = db.execute("SELECT id FROM users WHERE id=%s AND role='dealer_staff' AND dealer_id=%s AND enabled=true", (assignee, lead["dealer_id"])).fetchone()
            if not target:
                return fail("Pracownik musi być aktywny i należeć do tego samego dealera", 400)
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
        db.execute("UPDATE leads SET assigned_to=%s WHERE id=%s", (assignee, lead_id))
    return jsonify({"ok": True})


@app.patch("/api/leads/<uuid:lead_id>/status")
@account
def change_lead_status(actor, lead_id):
    data = request.get_json(silent=True)
    status = data.get("status") if isinstance(data, dict) else None
    if status not in {"new", "contacted", "qualified", "unqualified"}:
        return fail("Nieprawidłowy status")
    with conn() as db:
        lead = db.execute("SELECT dealer_id,assigned_to FROM leads WHERE id=%s FOR UPDATE", (lead_id,)).fetchone()
        if not lead:
            return fail("Nie znaleziono leada", 404)
        role = actor["role"]
        permitted = (role == "admin" or
                     (role == "dealer_admin" and str(actor["dealer_id"]) == str(lead["dealer_id"])) or
                     (role == "dealer_staff" and str(actor["dealer_id"]) == str(lead["dealer_id"]) and str(actor["id"]) == str(lead["assigned_to"])))
        if not permitted:
            return fail("Brak uprawnień", 403)
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
        db.execute("UPDATE leads SET status=%s WHERE id=%s", (status, lead_id))
    return jsonify({"ok": True, "status": status})
