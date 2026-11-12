"""Public lead endpoint for the CARVAMO OVH accounts Flask app."""
import re
import time
from collections import defaultdict, deque
from threading import Lock
from uuid import UUID
from flask import jsonify, request

_ATTEMPTS = defaultdict(deque)
_LOCK = Lock()

def register_public_leads(app, conn, fail):
    @app.post("/api/public/leads")
    def public_lead():
        origin = request.headers.get("Origin")
        if origin and origin != "https://preview.carvamo.com":
            return fail("Niedozwolone źródło żądania", 403)
        if request.content_length and request.content_length > 8192:
            return fail("Zbyt duże zgłoszenie", 413)
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return fail("Nieprawidłowe zgłoszenie")
        if str(data.get("website") or "").strip():
            return jsonify({"ok": True}), 202
        name = str(data.get("full_name") or "").strip()
        email = str(data.get("email") or "").strip().lower()
        phone = str(data.get("phone") or "").strip()
        message = str(data.get("message") or "").strip()
        if (data.get("consent") is not True or not 2 <= len(name) <= 120
                or len(email) > 254 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email)
                or not re.fullmatch(r"[+0-9 ()-]{7,25}", phone) or len(message) > 1200):
            return fail("Sprawdź dane kontaktowe i zgodę")
        try:
            offer_id = UUID(str(data.get("offer_id")))
        except (ValueError, TypeError, AttributeError):
            return fail("Nieprawidłowy identyfikator oferty")
        ip = request.remote_addr or "unknown"
        now = time.monotonic()
        with _LOCK:
            attempts = _ATTEMPTS[ip]
            while attempts and attempts[0] < now - 3600:
                attempts.popleft()
            if len(attempts) >= 5:
                return fail("Limit zapytań został przekroczony", 429)
            attempts.append(now)
            if len(_ATTEMPTS) > 4096:
                for key in list(_ATTEMPTS):
                    if not _ATTEMPTS[key] or _ATTEMPTS[key][-1] < now - 3600:
                        del _ATTEMPTS[key]
        with conn() as db:
            offer = db.execute(
                "SELECT o.dealer_id FROM offers o JOIN dealers d ON d.id=o.dealer_id "
                "WHERE o.id=%s AND o.status='published' AND o.deletion_pending=false AND d.active=true",
                (offer_id,)
            ).fetchone()
            if not offer:
                return fail("Oferta niedostępna", 404)
            row = db.execute(
                "INSERT INTO leads (offer_id,dealer_id,full_name,email,phone,message,status) "
                "VALUES (%s,%s,%s,%s,%s,%s,'new') RETURNING id",
                (offer_id, offer["dealer_id"], name, email, phone, message)
            ).fetchone()
        return jsonify({"ok": True, "reference": str(row["id"])}), 201
