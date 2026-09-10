"""Backend API tests for Misbah Club — focuses on the new no-pending-approval behavior + core CRUD."""
import os
import re
import time
import uuid
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://club-portal-30.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
LOG_PATH = "/var/log/supervisor/backend.err.log"
LOG_PATH_OUT = "/var/log/supervisor/backend.out.log"


def _get_otp(email: str, timeout: int = 6) -> str:
    """Read latest OTP for email from backend logs."""
    end = time.time() + timeout
    pattern = re.compile(rf"OTP for {re.escape(email)}: (\d{{6}})")
    while time.time() < end:
        for p in (LOG_PATH, LOG_PATH_OUT):
            try:
                out = subprocess.check_output(["tail", "-n", "200", p]).decode(errors="ignore")
                m = list(pattern.finditer(out))
                if m:
                    return m[-1].group(1)
            except Exception:
                pass
        time.sleep(0.5)
    raise AssertionError(f"OTP not found in logs for {email}")


def _login(email: str, name=None, role=None, major=None, year=None):
    s = requests.Session()
    r = s.post(f"{API}/auth/request-otp", json={"email": email})
    assert r.status_code == 200, r.text
    code = _get_otp(email)
    payload = {"email": email, "code": code}
    if name: payload["name"] = name
    if role: payload["role"] = role
    if major: payload["major"] = major
    if year: payload["year"] = year
    r = s.post(f"{API}/auth/verify-otp", json=payload)
    assert r.status_code == 200, r.text
    return s, r.json()["user"]


# ---------------- Auth: NO pending approval gate ----------------
class TestAuthNoPending:
    def test_signup_student_is_approved_immediately(self):
        email = f"qa.student.{uuid.uuid4().hex[:6]}@misbah.dev"
        _, user = _login(email, name="طالبة اختبار", role="student", major="حاسب", year=2)
        assert user["is_approved"] is True
        assert user["role"] == "student"

    def test_signup_leader_media_is_approved_immediately(self):
        email = f"qa.leader.{uuid.uuid4().hex[:6]}@misbah.dev"
        _, user = _login(email, name="قائدة اعلام", role="leader_media")
        assert user["is_approved"] is True
        assert user["role"] == "leader_media"

    def test_signup_supervisor_role(self):
        email = f"qa.sup.{uuid.uuid4().hex[:6]}@misbah.dev"
        _, user = _login(email, name="دكتورة", role="supervisor")
        assert user["is_approved"] is True
        assert user["role"] == "supervisor"

    def test_admin_login(self):
        s, user = _login("4ccc4r267b@privaterelay.appleid.com")
        assert user["role"] == "admin"
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200

    def test_invalid_otp(self):
        email = f"qa.bad.{uuid.uuid4().hex[:6]}@misbah.dev"
        requests.post(f"{API}/auth/request-otp", json={"email": email})
        r = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": "000000"})
        assert r.status_code == 400


# ---------------- Events ----------------
class TestEvents:
    def test_list_events_seeded(self):
        r = requests.get(f"{API}/events")
        assert r.status_code == 200
        events = r.json()
        assert len(events) >= 3
        for e in events:
            assert "id" in e and "title" in e and "capacity" in e
            assert "_id" not in e

    def test_event_register_and_count(self):
        s, _ = _login("student.demo@misbah.dev")
        events = s.get(f"{API}/events").json()
        ev_id = events[0]["id"]
        before = events[0]["registered_count"]
        r = s.post(f"{API}/events/{ev_id}/register")
        # 200 first-time OR 400 if already registered
        assert r.status_code in (200, 400)
        after = s.get(f"{API}/events/{ev_id}").json()["registered_count"]
        if r.status_code == 200:
            assert after == before + 1
        # Duplicate should fail
        r2 = s.post(f"{API}/events/{ev_id}/register")
        assert r2.status_code == 400


# ---------------- Workshops ----------------
class TestWorkshops:
    def test_list_workshops(self):
        r = requests.get(f"{API}/workshops")
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_supervisor_can_create_workshop(self):
        s, _ = _login("supervisor.demo@misbah.dev")
        payload = {
            "title": f"TEST_ورشة {uuid.uuid4().hex[:6]}",
            "description": "test",
            "scheduled_at": "2026-06-01T10:00:00+00:00",
            "capacity": 20, "points": 30,
        }
        r = s.post(f"{API}/workshops", json=payload)
        assert r.status_code == 200, r.text
        wid = r.json()["id"]
        # GET verify persistence
        g = requests.get(f"{API}/workshops/{wid}")
        assert g.status_code == 200
        assert g.json()["title"] == payload["title"]
        # cleanup
        s.delete(f"{API}/workshops/{wid}")

    def test_student_cannot_create_workshop(self):
        s, _ = _login("student.demo@misbah.dev")
        r = s.post(f"{API}/workshops", json={
            "title": "x", "description": "x", "scheduled_at": "2026-06-01T10:00:00+00:00"
        })
        assert r.status_code == 403


# ---------------- Announcements ----------------
class TestAnnouncements:
    def test_list(self):
        r = requests.get(f"{API}/announcements")
        assert r.status_code == 200
        assert len(r.json()) >= 3

    def test_admin_creates(self):
        s, _ = _login("4ccc4r267b@privaterelay.appleid.com")
        r = s.post(f"{API}/announcements", json={
            "title": f"TEST_إعلان {uuid.uuid4().hex[:6]}",
            "content": "test",
            "tag": "info",
        })
        assert r.status_code == 200, r.text
        aid = r.json()["id"]
        s.delete(f"{API}/announcements/{aid}")

    def test_student_cannot_create(self):
        s, _ = _login("student.demo@misbah.dev")
        r = s.post(f"{API}/announcements", json={"title": "x", "content": "x"})
        assert r.status_code == 403


# ---------------- Admin ----------------
class TestAdmin:
    def test_stats(self):
        s, _ = _login("4ccc4r267b@privaterelay.appleid.com")
        r = s.get(f"{API}/admin/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ("total_users", "total_events", "total_workshops"):
            assert k in d

    def test_update_role(self):
        s, _ = _login("4ccc4r267b@privaterelay.appleid.com")
        # Create a fresh user via signup
        target_email = f"qa.role.{uuid.uuid4().hex[:6]}@misbah.dev"
        _login(target_email, name="test", role="student")
        users = s.get(f"{API}/admin/users").json()
        target = next(u for u in users if u["email"] == target_email)
        r = s.put(f"{API}/admin/users/{target['id']}/role", json={"role": "leader_law"})
        assert r.status_code == 200
        users2 = s.get(f"{API}/admin/users").json()
        assert next(u for u in users2 if u["id"] == target["id"])["role"] == "leader_law"
        s.delete(f"{API}/admin/users/{target['id']}")


# ---------------- Comments ----------------
class TestComments:
    def test_post_and_list(self):
        s, _ = _login("student.demo@misbah.dev")
        events = requests.get(f"{API}/events").json()
        ev_id = events[0]["id"]
        content = f"TEST comment {uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/comments/event/{ev_id}", json={"content": content})
        assert r.status_code == 200
        lst = requests.get(f"{API}/comments/event/{ev_id}").json()
        assert any(c["content"] == content for c in lst)


# ---------------- Leaderboard ----------------
class TestLeaderboard:
    def test_ranked(self):
        r = requests.get(f"{API}/leaderboard")
        assert r.status_code == 200
        pts = [u["points"] for u in r.json()]
        assert pts == sorted(pts, reverse=True)
