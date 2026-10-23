import pytest
from app.models.enums import UserRole


def test_health_check(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["service"] == "BloodBridge API"


def test_login_success(client):
    # Admin login
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@bloodbridge.org", "password": "admin123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["role"] == UserRole.ADMIN.value
    assert data["token_type"] == "bearer"


def test_login_invalid_credentials(client):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@bloodbridge.org", "password": "wrongpassword"},
    )
    assert res.status_code == 401
    assert "Incorrect email or password" in res.json()["detail"]


def test_get_current_user_profile(client):
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "hospital@bloodbridge.org", "password": "hospital123"},
    )
    token = login_res.json()["access_token"]

    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "hospital@bloodbridge.org"
    assert data["role"] == UserRole.HOSPITAL_STAFF.value
    assert data["organization_name"] == "City General Hospital"


def test_rbac_admin_can_list_users(client):
    # Login as Admin
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@bloodbridge.org", "password": "admin123"},
    )
    admin_token = admin_login.json()["access_token"]

    res = client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    users = res.json()
    assert len(users) >= 5


def test_rbac_hospital_staff_forbidden_from_admin_endpoints(client):
    # Login as Hospital Staff
    hosp_login = client.post(
        "/api/v1/auth/login",
        json={"email": "hospital@bloodbridge.org", "password": "hospital123"},
    )
    hosp_token = hosp_login.json()["access_token"]

    # Attempting to access admin-only /users
    res = client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {hosp_token}"},
    )
    assert res.status_code == 403
    assert "Operation not permitted" in res.json()["detail"]


def test_rbac_admin_can_view_audit_logs(client):
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@bloodbridge.org", "password": "admin123"},
    )
    admin_token = admin_login.json()["access_token"]

    res = client.get(
        "/api/v1/audit-logs",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    logs = res.json()
    assert len(logs) >= 3


def test_rbac_non_admin_forbidden_from_audit_logs(client):
    bb_login = client.post(
        "/api/v1/auth/login",
        json={"email": "bloodbank@bloodbridge.org", "password": "bloodbank123"},
    )
    bb_token = bb_login.json()["access_token"]

    res = client.get(
        "/api/v1/audit-logs",
        headers={"Authorization": f"Bearer {bb_token}"},
    )
    assert res.status_code == 403


def test_organizations_accessible_by_authenticated_users(client):
    bb_login = client.post(
        "/api/v1/auth/login",
        json={"email": "bloodbank@bloodbridge.org", "password": "bloodbank123"},
    )
    bb_token = bb_login.json()["access_token"]

    hosp_res = client.get(
        "/api/v1/hospitals",
        headers={"Authorization": f"Bearer {bb_token}"},
    )
    assert hosp_res.status_code == 200
    assert len(hosp_res.json()) >= 3

    bb_res = client.get(
        "/api/v1/blood-banks",
        headers={"Authorization": f"Bearer {bb_token}"},
    )
    assert bb_res.status_code == 200
    assert len(bb_res.json()) >= 2
