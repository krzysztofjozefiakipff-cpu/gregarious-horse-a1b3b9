"""CARVAMO account API (OVH). No default credentials or bootstrap endpoints."""
import os
import time
import secrets
from collections import defaultdict, deque
import re
from datetime import timedelta
from functools import wraps
from flask import Flask, request, jsonify
import psycopg
from psycopg.rows import dict_row
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

app = Flask(__name__)
app.json.ensure_ascii = False
DATABASE_URL = os.environ["DATABASE_URL"]
SESSION_SECRET = os.environ["SESSION_SECRET"]
if len(SESSION_SECRET) < 40:
    raise RuntimeError("SESSION_SECRET must be at least 40 characters")
signer = URLSafeTimedSerializer(SESSION_SECRET, salt="carvamo-session-v1")
hasher = PasswordHasher()
ROLES = {"admin", "staff", "dealer", "dealer_admin", "dealer_staff"}
SESSION_SECONDS = 8 * 3600
LOGIN_ATTEMPTS = defaultdict(deque)
LOGIN_LIMIT = 8
LOGIN_WINDOW = 900

def conn():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)

def fail(message, status=400):
    return jsonify({"error": message}), status

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
        if not secrets.compare_digest(credential_version, __import__("hashlib").sha256((user["password_hash"] or "").encode()).hexdigest()):
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
    source = request.remote_addr or "unknown"
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
    return jsonify({"token": signer.dumps({"id": str(user["id"]), "credential_version": __import__("hashlib").sha256(user["password_hash"].encode()).hexdigest()}), "expires_in": SESSION_SECONDS})

@app.get("/api/accounts")
@account
def list_accounts(actor):
    if actor["role"] not in {"admin", "dealer_admin"}:
        return fail("Brak uprawnień", 403)
    with conn() as db:
        if actor["role"] == "admin":
            rows = db.execute("SELECT id,email,role,dealer_id,enabled,created_at FROM users ORDER BY created_at DESC LIMIT 500").fetchall()
        else:
            rows = db.execute("SELECT id,email,role,dealer_id,enabled,created_at FROM users WHERE dealer_id=%s AND role='dealer_staff' ORDER BY created_at DESC LIMIT 500", (actor["dealer_id"],)).fetchall()
    return jsonify({"accounts": rows})

@app.post("/api/accounts")
@account
def create_account(actor):
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    role = str(data.get("role", ""))
    dealer_id = data.get("dealer_id") or None
    password = str(data.get("temporary_password", ""))
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) or len(email) > 254:
        return fail("Nieprawidłowy e-mail")
    if role not in ROLES or not permitted(actor, role, dealer_id):
        return fail("Nie można nadać tej roli", 403)
    if len(password) < 14 or len(password) > 256:
        return fail("Hasło tymczasowe musi mieć od 14 do 256 znaków")
    try:
        with conn() as db:
            db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
            row = db.execute(
                "INSERT INTO users(email,password_hash,role,dealer_id,enabled) VALUES (%s,%s,%s,%s,true) RETURNING id,email,role,dealer_id,enabled",
                (email, hasher.hash(password), role, dealer_id)
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
    if len(new) < 14 or len(new) > 256:
        return fail("Nowe hasło musi mieć od 14 do 256 znaków")
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
