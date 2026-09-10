from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import uuid
import random
import logging
import ipaddress
import asyncio
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import jwt
import httpx
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form, Header, Query
from fastapi.responses import Response as FastAPIResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ---------------- Config ----------------
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
ADMIN_EMAIL = os.environ['ADMIN_EMAIL'].lower().strip()
ADMIN_NAME = os.environ.get('ADMIN_NAME', 'Admin')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
EMAIL_KEY = os.environ.get('EMERGENT_EMAIL_KEY', '')
EMAIL_FROM_NAME = os.environ.get('EMAIL_FROM_NAME', 'Misbah Club')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
APP_NAME = os.environ.get('APP_NAME', 'misbah-club')

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Misbah Club API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("misbah")

# ---------------- Storage ----------------
_storage_key = None

def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    if not EMERGENT_LLM_KEY:
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage not initialized")
    r = requests.put(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": key, "Content-Type": content_type},
                     data=data, timeout=120)
    if r.status_code == 404:
        key = init_storage(force=True)
        r = requests.put(f"{STORAGE_URL}/objects/{path}",
                         headers={"X-Storage-Key": key, "Content-Type": content_type},
                         data=data, timeout=120)
    r.raise_for_status()
    return r.json()

def get_object(path: str):
    key = init_storage()
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if r.status_code == 404:
        key = init_storage(force=True)
        r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")

# ---------------- Email (Resend / Emergent) ----------------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)

def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host); return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)

def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)

class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__(); self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []
    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href"); self._text = []
    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []

def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks for credentials: {p!r}")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links must be https: {url!r}")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Unsafe URL: {url!r}")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real: continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != host {real!r}")

async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return None

def build_otp_email_html(code: str) -> str:
    return (
        '<table role="presentation" width="100%" style="background:#FAFCFD;padding:32px 0;font-family:Tajawal,Arial,sans-serif" dir="rtl">'
        '<tr><td align="center">'
        '<table role="presentation" width="480" style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #DFE8EE">'
        '<tr><td style="text-align:right">'
        f'<div style="font-size:14px;color:#2E8378;letter-spacing:2px;font-weight:600">{escape(EMAIL_FROM_NAME)}</div>'
        '<h1 style="font-size:22px;color:#1C2B39;margin:12px 0 4px 0">رمز الدخول إلى مصباح</h1>'
        '<p style="color:#3A4A58;font-size:15px;line-height:1.7">استخدمي الرمز التالي لإتمام تسجيل الدخول. صلاحيته 10 دقائق فقط.</p>'
        f'<div style="margin:20px 0;background:#F0F5F8;border:1px dashed #7BA7C9;border-radius:12px;padding:20px;text-align:center;font-size:34px;letter-spacing:12px;color:#1C2B39;font-weight:700">{escape(code)}</div>'
        '<p style="color:#5B6B78;font-size:12px;margin-top:20px">إن لم تطلبي هذا الرمز، يمكنك تجاهل الرسالة بأمان.</p>'
        f'<p style="font-size:11px;color:#6B7B88;margin-top:16px">أُرسلت من {escape(EMAIL_FROM_NAME)}. لن نطلب منكِ كلمة المرور أو بيانات البطاقة عبر البريد.</p>'
        '</td></tr></table></td></tr></table>'
    )

# ---------------- JWT ----------------
def create_access_token(user_id: str, email: str) -> str:
    return jwt.encode({"sub": user_id, "email": email, "type": "access",
                       "exp": datetime.now(timezone.utc) + timedelta(hours=12)},
                      JWT_SECRET, algorithm=JWT_ALG)

def create_refresh_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "type": "refresh",
                       "exp": datetime.now(timezone.utc) + timedelta(days=30)},
                      JWT_SECRET, algorithm=JWT_ALG)

def set_auth_cookies(response: Response, uid: str, email: str):
    at = create_access_token(uid, email)
    rt = create_refresh_token(uid)
    response.set_cookie("access_token", at, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", rt, httponly=True, secure=True, samesite="none", max_age=2592000, path="/")

async def _decode_user(token: str):
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    if payload.get("type") != "access":
        raise HTTPException(401, "Invalid token type")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        return await _decode_user(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

def require_role(*roles):
    async def _dep(user=Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(403, "Forbidden")
        return user
    return _dep

# ---------------- Models ----------------
Role = Literal[
    "student", "supervisor", "admin",
    "leader_admin", "leader_law", "leader_media", "leader_accounting",
    "deputy_admin", "deputy_law", "deputy_media", "deputy_accounting",
]

LEADER_ROLES = ("leader_admin", "leader_law", "leader_media", "leader_accounting")
SIGNUP_ROLES = ("student", "supervisor", *LEADER_ROLES,
                "deputy_admin", "deputy_law", "deputy_media", "deputy_accounting")
CLUB_MANAGERS = ("admin", "supervisor", *LEADER_ROLES)

class RequestOTP(BaseModel):
    email: EmailStr

class VerifyOTP(BaseModel):
    email: EmailStr
    code: str
    name: Optional[str] = None
    major: Optional[str] = None
    year: Optional[int] = None
    role: Optional[Role] = None  # only allowed if in ALLOWED_SIGNUP_ROLES

class UpdateProfile(BaseModel):
    name: Optional[str] = None
    major: Optional[str] = None
    year: Optional[int] = None

class EventCreate(BaseModel):
    title: str
    description: str
    date: str  # ISO
    location: str
    capacity: int = 50
    category: str = "workshop"
    image_url: Optional[str] = None
    points: int = 100

class WorkshopCreate(BaseModel):
    title: str
    description: str
    scheduled_at: str
    supervisor_name: Optional[str] = None
    video_url: Optional[str] = None
    materials: List[dict] = []
    capacity: int = 30
    points: int = 50

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    tag: str = "info"  # info, urgent, opportunity, congrats

class CommentCreate(BaseModel):
    content: str

class ApproveUser(BaseModel):
    approved: bool = True
    role: Optional[Role] = None

class RoleUpdate(BaseModel):
    role: Role

# ---------------- Helpers ----------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()

async def public_user(uid: str):
    u = await db.users.find_one({"id": uid}, {"_id": 0, "id": 1, "name": 1, "role": 1, "major": 1, "avatar": 1})
    return u or {"id": uid, "name": "مستخدم"}

def clean(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc.pop("_id")
    return doc

# ---------------- Auth Routes ----------------
@api.post("/auth/request-otp")
async def request_otp(body: RequestOTP):
    email = body.email.lower().strip()
    code = f"{random.randint(0, 999999):06d}"
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db.otp_codes.insert_one({
        "email": email, "code": code,
        "expires_at": expires.isoformat(), "used": False,
        "created_at": now_iso()
    })
    logger.info(f"[DEV] OTP for {email}: {code}")
    # Send email (non-blocking on failure — dev logs still show code)
    try:
        await send_email(to=email, subject=f"رمز الدخول - {EMAIL_FROM_NAME}", html=build_otp_email_html(code))
    except Exception as e:
        logger.error(f"OTP email error: {e}")
    return {"status": "sent", "email": email}

@api.post("/auth/verify-otp")
async def verify_otp(body: VerifyOTP, response: Response):
    email = body.email.lower().strip()
    code = body.code.strip()
    now = datetime.now(timezone.utc)
    otp = await db.otp_codes.find_one(
        {"email": email, "code": code, "used": False},
        sort=[("created_at", -1)]
    )
    if not otp:
        raise HTTPException(400, "رمز غير صحيح")
    try:
        exp = datetime.fromisoformat(otp["expires_at"])
    except Exception:
        exp = now - timedelta(minutes=1)
    if exp < now:
        raise HTTPException(400, "انتهت صلاحية الرمز")
    await db.otp_codes.update_one({"_id": otp["_id"]}, {"$set": {"used": True}})

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        # New signup
        requested_role = body.role if body.role in SIGNUP_ROLES else "student"
        uid = str(uuid.uuid4())
        # Admin auto-approve on the seeded email
        is_admin = (email == ADMIN_EMAIL)
        user = {
            "id": uid,
            "email": email,
            "name": body.name or ("مسؤولة النادي" if is_admin else email.split("@")[0]),
            "role": "admin" if is_admin else requested_role,
            "major": body.major or "",
            "year": body.year or 0,
            "avatar": "",
            "points": 0,
            "is_approved": True,
            "created_at": now_iso(),
        }
        await db.users.insert_one(dict(user))
        user.pop("_id", None)

    set_auth_cookies(response, user["id"], user["email"])
    return {"user": user}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"status": "logged_out"}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

@api.put("/auth/me")
async def update_me(body: UpdateProfile, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    return await db.users.find_one({"id": user["id"]}, {"_id": 0})

# ---------------- Events ----------------
@api.get("/events")
async def list_events(category: Optional[str] = None, upcoming: Optional[bool] = None):
    q = {}
    if category and category != "all":
        q["category"] = category
    events = await db.events.find(q, {"_id": 0}).sort("date", 1).to_list(500)
    # Add registration count
    for ev in events:
        ev["registered_count"] = await db.event_registrations.count_documents({"event_id": ev["id"]})
    return events

@api.post("/events")
async def create_event(body: EventCreate, user=Depends(require_role(*CLUB_MANAGERS))):
    ev = {"id": str(uuid.uuid4()), **body.model_dump(),
          "created_by": user["id"], "created_by_name": user["name"],
          "created_at": now_iso()}
    await db.events.insert_one(dict(ev))
    ev.pop("_id", None)
    return ev

@api.get("/events/{event_id}")
async def get_event(event_id: str):
    ev = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(404, "Event not found")
    ev["registered_count"] = await db.event_registrations.count_documents({"event_id": event_id})
    return ev

@api.delete("/events/{event_id}")
async def delete_event(event_id: str, user=Depends(require_role(*CLUB_MANAGERS))):
    await db.events.delete_one({"id": event_id})
    await db.event_registrations.delete_many({"event_id": event_id})
    return {"status": "deleted"}

@api.post("/events/{event_id}/register")
async def register_event(event_id: str, user=Depends(get_current_user)):
    ev = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(404, "Event not found")
    existing = await db.event_registrations.find_one({"event_id": event_id, "user_id": user["id"]})
    if existing:
        raise HTTPException(400, "أنتِ مسجّلة مسبقاً في هذه الفعالية")
    count = await db.event_registrations.count_documents({"event_id": event_id})
    if count >= ev.get("capacity", 0):
        raise HTTPException(400, "المقاعد ممتلئة")
    reg = {"id": str(uuid.uuid4()), "event_id": event_id, "user_id": user["id"],
           "user_name": user["name"], "attended": False, "created_at": now_iso()}
    await db.event_registrations.insert_one(dict(reg))
    reg.pop("_id", None)
    return reg

@api.post("/events/{event_id}/attend/{user_id}")
async def mark_attend(event_id: str, user_id: str, user=Depends(require_role(*CLUB_MANAGERS))):
    reg = await db.event_registrations.find_one({"event_id": event_id, "user_id": user_id})
    if not reg:
        raise HTTPException(404, "Registration not found")
    if reg.get("attended"):
        return {"status": "already"}
    ev = await db.events.find_one({"id": event_id}, {"_id": 0})
    pts = ev.get("points", 100) if ev else 100
    await db.event_registrations.update_one(
        {"event_id": event_id, "user_id": user_id},
        {"$set": {"attended": True, "attended_at": now_iso()}}
    )
    await db.users.update_one({"id": user_id}, {"$inc": {"points": pts}})
    await db.achievements.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "type": "event_attendance",
        "title": f"حضور {ev.get('title','فعالية')}", "points": pts, "created_at": now_iso()
    })
    return {"status": "ok", "points_awarded": pts}

@api.get("/events/{event_id}/attendees")
async def event_attendees(event_id: str, user=Depends(require_role(*CLUB_MANAGERS))):
    regs = await db.event_registrations.find({"event_id": event_id}, {"_id": 0}).to_list(500)
    return regs

# ---------------- Workshops ----------------
@api.get("/workshops")
async def list_workshops():
    ws = await db.workshops.find({}, {"_id": 0}).sort("scheduled_at", 1).to_list(500)
    for w in ws:
        w["registered_count"] = await db.workshop_registrations.count_documents({"workshop_id": w["id"]})
    return ws

@api.post("/workshops")
async def create_workshop(body: WorkshopCreate, user=Depends(require_role("supervisor", "admin"))):
    w = {"id": str(uuid.uuid4()), **body.model_dump(),
         "supervisor_id": user["id"],
         "supervisor_name": body.supervisor_name or user["name"],
         "created_at": now_iso()}
    await db.workshops.insert_one(dict(w))
    w.pop("_id", None)
    return w

@api.get("/workshops/{wid}")
async def get_workshop(wid: str):
    w = await db.workshops.find_one({"id": wid}, {"_id": 0})
    if not w: raise HTTPException(404, "Not found")
    w["registered_count"] = await db.workshop_registrations.count_documents({"workshop_id": wid})
    return w

@api.delete("/workshops/{wid}")
async def delete_workshop(wid: str, user=Depends(require_role("supervisor", "admin"))):
    await db.workshops.delete_one({"id": wid})
    await db.workshop_registrations.delete_many({"workshop_id": wid})
    return {"status": "deleted"}

@api.post("/workshops/{wid}/register")
async def register_workshop(wid: str, user=Depends(get_current_user)):
    w = await db.workshops.find_one({"id": wid}, {"_id": 0})
    if not w: raise HTTPException(404, "Not found")
    if await db.workshop_registrations.find_one({"workshop_id": wid, "user_id": user["id"]}):
        raise HTTPException(400, "أنتِ مسجّلة مسبقاً")
    if await db.workshop_registrations.count_documents({"workshop_id": wid}) >= w.get("capacity", 30):
        raise HTTPException(400, "المقاعد ممتلئة")
    r = {"id": str(uuid.uuid4()), "workshop_id": wid, "user_id": user["id"],
         "user_name": user["name"], "attended": False, "created_at": now_iso()}
    await db.workshop_registrations.insert_one(dict(r))
    r.pop("_id", None)
    return r

@api.post("/workshops/{wid}/attend/{user_id}")
async def workshop_attend(wid: str, user_id: str, user=Depends(require_role("supervisor", "admin"))):
    reg = await db.workshop_registrations.find_one({"workshop_id": wid, "user_id": user_id})
    if not reg: raise HTTPException(404, "Not found")
    if reg.get("attended"): return {"status": "already"}
    w = await db.workshops.find_one({"id": wid}, {"_id": 0})
    pts = w.get("points", 50) if w else 50
    await db.workshop_registrations.update_one(
        {"workshop_id": wid, "user_id": user_id},
        {"$set": {"attended": True, "attended_at": now_iso()}})
    await db.users.update_one({"id": user_id}, {"$inc": {"points": pts}})
    await db.achievements.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "type": "workshop_attendance",
        "title": f"حضور ورشة {w.get('title','')}", "points": pts, "created_at": now_iso()})
    return {"status": "ok", "points_awarded": pts}

@api.get("/workshops/{wid}/attendees")
async def workshop_attendees(wid: str, user=Depends(require_role("supervisor", "admin"))):
    return await db.workshop_registrations.find({"workshop_id": wid}, {"_id": 0}).to_list(500)

# ---------------- My items ----------------
@api.get("/me/events")
async def my_events(user=Depends(get_current_user)):
    regs = await db.event_registrations.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    ids = [r["event_id"] for r in regs]
    events = await db.events.find({"id": {"$in": ids}}, {"_id": 0}).to_list(500)
    ev_map = {e["id"]: e for e in events}
    out = []
    for r in regs:
        ev = ev_map.get(r["event_id"])
        if ev:
            out.append({**ev, "attended": r.get("attended", False), "registered_at": r.get("created_at")})
    return out

@api.get("/me/workshops")
async def my_workshops(user=Depends(get_current_user)):
    regs = await db.workshop_registrations.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    ids = [r["workshop_id"] for r in regs]
    ws = await db.workshops.find({"id": {"$in": ids}}, {"_id": 0}).to_list(500)
    m = {w["id"]: w for w in ws}
    out = []
    for r in regs:
        w = m.get(r["workshop_id"])
        if w:
            out.append({**w, "attended": r.get("attended", False)})
    return out

@api.get("/me/achievements")
async def my_achievements(user=Depends(get_current_user)):
    return await db.achievements.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)

# ---------------- Announcements ----------------
@api.get("/announcements")
async def list_announcements():
    return await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)

@api.post("/announcements")
async def create_announcement(body: AnnouncementCreate, user=Depends(require_role("admin"))):
    a = {"id": str(uuid.uuid4()), **body.model_dump(),
         "author_id": user["id"], "author_name": user["name"],
         "created_at": now_iso()}
    await db.announcements.insert_one(dict(a))
    a.pop("_id", None)
    return a

@api.delete("/announcements/{aid}")
async def delete_announcement(aid: str, user=Depends(require_role("admin"))):
    await db.announcements.delete_one({"id": aid})
    return {"status": "deleted"}

# ---------------- Comments ----------------
@api.get("/comments/{target_type}/{target_id}")
async def list_comments(target_type: str, target_id: str):
    return await db.comments.find({"target_type": target_type, "target_id": target_id}, {"_id": 0}).sort("created_at", 1).to_list(500)

@api.post("/comments/{target_type}/{target_id}")
async def create_comment(target_type: str, target_id: str, body: CommentCreate, user=Depends(get_current_user)):
    c = {"id": str(uuid.uuid4()), "target_type": target_type, "target_id": target_id,
         "user_id": user["id"], "user_name": user["name"], "user_role": user["role"],
         "content": body.content, "created_at": now_iso()}
    await db.comments.insert_one(dict(c))
    c.pop("_id", None)
    return c

# ---------------- Admin ----------------
@api.get("/admin/stats")
async def admin_stats(user=Depends(require_role("admin"))):
    users = await db.users.count_documents({})
    pending = await db.users.count_documents({"is_approved": False})
    events = await db.events.count_documents({})
    workshops = await db.workshops.count_documents({})
    regs = await db.event_registrations.count_documents({})
    attended = await db.event_registrations.count_documents({"attended": True})
    pts = await db.users.aggregate([{"$group": {"_id": None, "s": {"$sum": "$points"}}}]).to_list(1)
    return {
        "total_users": users, "pending_users": pending,
        "total_events": events, "total_workshops": workshops,
        "total_registrations": regs, "total_attended": attended,
        "total_points_awarded": pts[0]["s"] if pts else 0
    }

@api.get("/admin/users")
async def admin_users(pending_only: bool = False, user=Depends(require_role("admin"))):
    q = {"is_approved": False} if pending_only else {}
    return await db.users.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api.post("/admin/users/{uid}/approve")
async def admin_approve(uid: str, body: ApproveUser, user=Depends(require_role("admin"))):
    update = {"is_approved": body.approved}
    if body.role:
        update["role"] = body.role
    await db.users.update_one({"id": uid}, {"$set": update})
    return {"status": "ok"}

@api.put("/admin/users/{uid}/role")
async def admin_role(uid: str, body: RoleUpdate, user=Depends(require_role("admin"))):
    await db.users.update_one({"id": uid}, {"$set": {"role": body.role}})
    return {"status": "ok"}

@api.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, user=Depends(require_role("admin"))):
    if uid == user["id"]:
        raise HTTPException(400, "لا يمكنك حذف حسابك")
    await db.users.delete_one({"id": uid})
    return {"status": "deleted"}

@api.get("/leaderboard")
async def leaderboard():
    top = await db.users.find({"role": "student", "is_approved": True},
                              {"_id": 0, "id": 1, "name": 1, "major": 1, "points": 1, "avatar": 1}
                              ).sort("points", -1).limit(10).to_list(10)
    return top

# ---------------- Files ----------------
@api.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(get_current_user)):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    fid = str(uuid.uuid4())
    path = f"{APP_NAME}/uploads/{user['id']}/{fid}.{ext}"
    data = await file.read()
    ctype = file.content_type or "application/octet-stream"
    result = put_object(path, data, ctype)
    doc = {
        "id": fid, "storage_path": result["path"],
        "original_filename": file.filename, "content_type": ctype,
        "size": result.get("size", len(data)), "is_deleted": False,
        "owner_id": user["id"], "created_at": now_iso()
    }
    await db.files.insert_one(dict(doc))
    doc.pop("_id", None)
    return {"id": fid, "url": f"/api/files/{result['path']}", "filename": file.filename, "content_type": ctype, "size": doc["size"]}

@api.get("/files/{path:path}")
async def download(path: str):
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "File not found")
    data, ctype = get_object(path)
    return FastAPIResponse(content=data, media_type=rec.get("content_type", ctype))

# ---------------- Root ----------------
@api.get("/")
async def root():
    return {"app": "Misbah Club", "status": "ok"}

# ---------------- Startup ----------------
async def seed():
    await db.users.create_index("email", unique=True)
    await db.otp_codes.create_index("email")
    await db.otp_codes.create_index("created_at")
    await db.events.create_index("date")
    await db.event_registrations.create_index([("event_id", 1), ("user_id", 1)], unique=True)
    await db.workshop_registrations.create_index([("workshop_id", 1), ("user_id", 1)], unique=True)

    # Seed admin
    if not await db.users.find_one({"email": ADMIN_EMAIL}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": ADMIN_EMAIL, "name": ADMIN_NAME,
            "role": "admin", "major": "", "year": 0, "avatar": "", "points": 0,
            "is_approved": True, "created_at": now_iso()
        })
        logger.info(f"Seeded admin {ADMIN_EMAIL}")

    # Seed demo users
    demos = [
        {"email": "supervisor.demo@misbah.dev", "name": "د. سارة العتيبي", "role": "supervisor",
         "major": "علوم الحاسب", "year": 0, "points": 0, "is_approved": True},
        {"email": "student.demo@misbah.dev", "name": "نوره الشمري", "role": "student",
         "major": "علوم الحاسب", "year": 3, "points": 350, "is_approved": True},
        {"email": "student2.demo@misbah.dev", "name": "لطيفة القحطاني", "role": "student",
         "major": "إدارة أعمال", "year": 2, "points": 520, "is_approved": True},
        {"email": "student3.demo@misbah.dev", "name": "ريم الدوسري", "role": "student",
         "major": "تصميم جرافيك", "year": 1, "points": 180, "is_approved": True},
        {"email": "pending.demo@misbah.dev", "name": "منى المطيري", "role": "student",
         "major": "علوم صحية", "year": 2, "points": 0, "is_approved": False},
    ]
    for d in demos:
        if not await db.users.find_one({"email": d["email"]}):
            await db.users.insert_one({"id": str(uuid.uuid4()), "avatar": "", "created_at": now_iso(), **d})

    # Seed events
    if await db.events.count_documents({}) == 0:
        sup = await db.users.find_one({"email": "supervisor.demo@misbah.dev"}, {"_id": 0})
        admin = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
        now = datetime.now(timezone.utc)
        evs = [
            {"title": "ملتقى قياديات مصباح الأول",
             "description": "لقاء مفتوح للتعرف على مبادرات النادي، والالتقاء بالمشرفات والقياديات، مع فقرات نقاش وضيافة دافئة.",
             "date": (now + timedelta(days=3)).isoformat(),
             "location": "القاعة الكبرى - مبنى الطالبات",
             "capacity": 80, "category": "meetup", "points": 100,
             "image_url": "https://images.unsplash.com/photo-1664574654700-75f1c1fad74e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzF8MHwxfHNlYXJjaHwzfHx1bml2ZXJzaXR5JTIwc3R1ZGVudHMlMjBhcmFiJTIwd29tZW4lMjBzdHVkeWluZ3xlbnwwfHx8fDE3ODkwMjI1MjN8MA&ixlib=rb-4.1.0&q=85",
             "created_by": admin["id"], "created_by_name": admin["name"]},
            {"title": "ندوة: مهارات القيادة الرقمية للطالبة",
             "description": "ندوة حوارية مع نخبة من الأكاديميات حول أهمية القيادة الرقمية وإدارة الحضور المهني.",
             "date": (now + timedelta(days=8)).isoformat(),
             "location": "قاعة الندوات B203",
             "capacity": 60, "category": "seminar", "points": 120,
             "image_url": "https://images.unsplash.com/photo-1741241858332-83de91895bab?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzF8MHwxfHNlYXJjaHwyfHx1bml2ZXJzaXR5JTIwc3R1ZGVudHMlMjBhcmFiJTIwd29tZW4lMjBzdHVkeWluZ3xlbnwwfHx8fDE3ODkwMjI1MjN8MA&ixlib=rb-4.1.0&q=85",
             "created_by": sup["id"], "created_by_name": sup["name"]},
            {"title": "بطولة الشطرنج الذهنية",
             "description": "بطولة صديقة وترفيهية للشطرنج بين عضوات النادي مع جوائز رمزية وشهادات مشاركة.",
             "date": (now + timedelta(days=14)).isoformat(),
             "location": "الاستراحة الأكاديمية - الطابق الثاني",
             "capacity": 32, "category": "tournament", "points": 80,
             "image_url": "https://images.unsplash.com/photo-1608453162650-cba45689c284?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzF8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwc3R1ZGVudHMlMjBhcmFiJTIwd29tZW4lMjBzdHVkeWluZ3xlbnwwfHx8fDE3ODkwMjI1MjN8MA&ixlib=rb-4.1.0&q=85",
             "created_by": admin["id"], "created_by_name": admin["name"]},
        ]
        for e in evs:
            await db.events.insert_one({"id": str(uuid.uuid4()), "created_at": now_iso(), **e})

    # Seed workshops
    if await db.workshops.count_documents({}) == 0:
        sup = await db.users.find_one({"email": "supervisor.demo@misbah.dev"}, {"_id": 0})
        now = datetime.now(timezone.utc)
        wks = [
            {"title": "أساسيات كتابة السيرة الذاتية الأكاديمية",
             "description": "ورشة تخصصية لتعلّم صياغة سيرة ذاتية تعكس مهاراتكِ الأكاديمية والقيادية بأسلوب احترافي.",
             "scheduled_at": (now + timedelta(days=5)).isoformat(),
             "supervisor_id": sup["id"], "supervisor_name": sup["name"],
             "video_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
             "materials": [], "capacity": 40, "points": 60},
            {"title": "مقدمة في البحث العلمي وأدوات ChatGPT",
             "description": "استكشفي طرق البحث الأكاديمي الذكي والاستفادة من أدوات الذكاء الاصطناعي بمسؤولية.",
             "scheduled_at": (now + timedelta(days=10)).isoformat(),
             "supervisor_id": sup["id"], "supervisor_name": sup["name"],
             "video_url": "", "materials": [], "capacity": 30, "points": 80},
        ]
        for w in wks:
            await db.workshops.insert_one({"id": str(uuid.uuid4()), "created_at": now_iso(), **w})

    # Seed announcements
    if await db.announcements.count_documents({}) == 0:
        admin = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
        anns = [
            {"title": "افتتاح موسم نادي مصباح الجديد", "tag": "info",
             "content": "أهلاً بكن يا عضوات مصباح! انطلق موسمنا الجديد بعدد من الفعاليات والورش المميزة. سجّلن مبكراً لضمان مقعدكن."},
            {"title": "فرصة تطوعية: تنظيم ملتقى القياديات", "tag": "opportunity",
             "content": "نبحث عن 5 متطوعات لتنظيم ملتقى قياديات مصباح الأول. المقابلات هذا الأسبوع - تواصلن مع إدارة النادي."},
            {"title": "تهنئة لعضوات لوحة الشرف", "tag": "congrats",
             "content": "نبارك لعضوات لوحة الشرف لهذا الشهر على تفاعلهن وحضورهن المميز في فعاليات مصباح."},
        ]
        for a in anns:
            await db.announcements.insert_one({"id": str(uuid.uuid4()),
                "author_id": admin["id"], "author_name": admin["name"],
                "created_at": now_iso(), **a})


@app.on_event("startup")
async def on_startup():
    try:
        await seed()
    except Exception as e:
        logger.error(f"seed error: {e}")
    try:
        init_storage()
    except Exception as e:
        logger.error(f"storage init error: {e}")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
