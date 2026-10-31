import base64
import binascii
import hashlib
import hmac
import json
import os
import re
import time

import bcrypt
from fastapi import Depends, Header, HTTPException


def validate_password(password):
    if isinstance(password, str) and len(password.encode()) > 72:
        raise HTTPException(400, "Password must not exceed 72 bytes")
    if not isinstance(password, str) or not re.fullmatch(
        r"(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}", password
    ):
        raise HTTPException(400, "Password must be at least 9 characters and include uppercase, lowercase, and a special character")


def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password, password_hash):
    if not isinstance(password, str) or not isinstance(password_hash, str):
        return False
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except (ValueError, TypeError):
        return False


def _encode(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def create_token(user):
    secret = os.getenv("JWT_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(500, "JWT_SECRET must contain at least 32 characters")
    header = _encode(b'{"alg":"HS256","typ":"JWT"}')
    payload = _encode(json.dumps({"sub": str(user["_id"]), "role": user["role"], "exp": int(time.time()) + 86400}).encode())
    body = f"{header}.{payload}"
    signature = _encode(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{signature}"


def authenticate(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Bearer token required")
    secret = os.getenv("JWT_SECRET", "")
    parts = authorization[7:].split(".")
    if len(parts) != 3 or len(secret) < 32:
        raise HTTPException(401, "Invalid token")
    body = ".".join(parts[:2])
    expected = _encode(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(parts[2], expected):
        raise HTTPException(401, "Invalid token")
    try:
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
        if payload["exp"] < time.time():
            raise ValueError("expired")
        if payload.get("role") not in {"admin", "staff", "customer"}:
            raise ValueError("invalid role")
        return {"id": payload["sub"], "role": payload["role"]}
    except (ValueError, KeyError, TypeError, json.JSONDecodeError, binascii.Error):
        raise HTTPException(401, "Invalid or expired token")


def require_role(*roles):
    def check(user=Depends(authenticate)):
        if user["role"] not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return check
