import pytest
from datetime import datetime, date, timedelta
from app.models.enums import UserRole, BloodGroup, InventoryStatus, RequestStatus, RequestPriority


def get_token_for(client, email, password):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_list_inventory_and_expiry_calculations(client):
    bb_token = get_token_for(client, "bloodbank@bloodbridge.org", "bloodbank123")
    res = client.get("/api/v1/inventory", headers={"Authorization": f"Bearer {bb_token}"})
    assert res.status_code == 200
    items = res.json()
    assert len(items) > 0

    # Ensure dynamic expiry calculation is present
    for item in items:
        assert "days_until_expiry" in item
        assert "expiry_urgency" in item
        assert item["expiry_urgency"] in ("Normal", "Warning", "Urgent", "Critical", "Expired")


def test_inventory_summary_and_low_stock(client):
    bb_token = get_token_for(client, "bloodbank@bloodbridge.org", "bloodbank123")
    res = client.get("/api/v1/inventory/summary", headers={"Authorization": f"Bearer {bb_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["total_available_units"] > 0
    assert len(data["by_blood_group"]) == 8

    # O- or AB- must be flagged low stock based on seeded counts
    o_neg = next((bg for bg in data["by_blood_group"] if bg["blood_group"] == "O-"), None)
    assert o_neg is not None
    assert o_neg["is_low_stock"] is True


def test_add_inventory_batch(client):
    bb_token = get_token_for(client, "bloodbank@bloodbridge.org", "bloodbank123")
    today = date.today()
    payload = {
        "blood_group": "B+",
        "quantity": 8,
        "collection_date": today.isoformat(),
        "expiry_date": (today + timedelta(days=35)).isoformat(),
        "batch_id": "BATCH-TEST-999",
        "blood_bank_id": 1,
        "storage_location": "Refrig-Z9",
        "status": "Available",
    }
    res = client.post("/api/v1/inventory", json=payload, headers={"Authorization": f"Bearer {bb_token}"})
    assert res.status_code == 201
    created = res.json()
    assert created["batch_id"] == "BATCH-TEST-999"
    assert created["days_until_expiry"] == 35
    assert created["expiry_urgency"] == "Normal"


def test_add_inventory_batch_without_blood_bank_id(client):
    # Mirrors the frontend form payload, which omits blood_bank_id
    bb_token = get_token_for(client, "bloodbank@bloodbridge.org", "bloodbank123")
    today = date.today()
    payload = {
        "blood_group": "O-",
        "quantity": 5,
        "collection_date": today.isoformat(),
        "expiry_date": (today + timedelta(days=35)).isoformat(),
        "batch_id": "BATCH-TEST-NOBB",
        "storage_location": "Refrig-A1",
        "status": "Available",
    }
    res = client.post("/api/v1/inventory", json=payload, headers={"Authorization": f"Bearer {bb_token}"})
    assert res.status_code == 201
    created = res.json()
    assert created["batch_id"] == "BATCH-TEST-NOBB"
    assert created["blood_bank_id"] is not None


def test_end_to_end_request_submission_and_fulfillment(client):
    # Step 1: Hospital staff creates emergency blood request for O-
    hosp_token = get_token_for(client, "hospital@bloodbridge.org", "hospital123")
    now = datetime.utcnow()
    req_payload = {
        "blood_group": "O-",
        "quantity": 2,
        "priority": "Critical",
        "required_datetime": (now + timedelta(hours=3)).isoformat(),
        "notes": "Emergency surgery request",
        "blood_bank_id": 1,
    }
    create_res = client.post("/api/v1/requests", json=req_payload, headers={"Authorization": f"Bearer {hosp_token}"})
    assert create_res.status_code == 201
    req_data = create_res.json()
    req_id = req_data["id"]
    assert req_data["status"] == "Submitted"
    assert req_data["quantity"] == 2

    # Step 2: Blood Bank staff views request list
    bb_token = get_token_for(client, "bloodbank@bloodbridge.org", "bloodbank123")
    list_res = client.get("/api/v1/requests", headers={"Authorization": f"Bearer {bb_token}"})
    assert list_res.status_code == 200
    all_reqs = list_res.json()
    assert any(r["id"] == req_id for r in all_reqs)

    # Check inventory before fulfillment
    sum_before = client.get("/api/v1/inventory/summary", headers={"Authorization": f"Bearer {bb_token}"}).json()
    o_neg_before = next(bg["available_units"] for bg in sum_before["by_blood_group"] if bg["blood_group"] == "O-")

    # Step 3: Blood Bank staff approves and fulfills request
    approve_res = client.put(
        f"/api/v1/requests/{req_id}/status",
        json={"status": "Approved", "notes": "Approved for dispatch"},
        headers={"Authorization": f"Bearer {bb_token}"},
    )
    assert approve_res.status_code == 200

    fulfill_res = client.post(
        f"/api/v1/requests/{req_id}/fulfill",
        json={"units_to_fulfill": 2, "notes": "Dispatched via courier"},
        headers={"Authorization": f"Bearer {bb_token}"},
    )
    assert fulfill_res.status_code == 200
    fulfilled_data = fulfill_res.json()
    assert fulfilled_data["status"] == "Fulfilled"
    assert fulfilled_data["fulfilled_quantity"] == 2

    # Step 4: Verify atomic inventory reduction
    sum_after = client.get("/api/v1/inventory/summary", headers={"Authorization": f"Bearer {bb_token}"}).json()
    o_neg_after = next(bg["available_units"] for bg in sum_after["by_blood_group"] if bg["blood_group"] == "O-")
    assert o_neg_after == o_neg_before - 2


def test_insufficient_inventory_error_handling(client):
    bb_token = get_token_for(client, "bloodbank@bloodbridge.org", "bloodbank123")
    hosp_token = get_token_for(client, "hospital@bloodbridge.org", "hospital123")

    # Create request for impossible quantity
    req_payload = {
        "blood_group": "AB-",
        "quantity": 9999,
        "priority": "Critical",
        "required_datetime": datetime.utcnow().isoformat(),
        "notes": "Stress test excessive quantity",
        "blood_bank_id": 1,
    }
    create_res = client.post("/api/v1/requests", json=req_payload, headers={"Authorization": f"Bearer {hosp_token}"})
    assert create_res.status_code == 201
    req_id = create_res.json()["id"]

    # Fulfill should return 400 Insufficient inventory
    fulfill_res = client.post(
        f"/api/v1/requests/{req_id}/fulfill",
        json={"units_to_fulfill": 9999},
        headers={"Authorization": f"Bearer {bb_token}"},
    )
    assert fulfill_res.status_code == 400
    assert "Insufficient inventory" in fulfill_res.json()["detail"]


def test_role_dashboards_integration(client):
    # Hospital Dashboard
    hosp_token = get_token_for(client, "hospital@bloodbridge.org", "hospital123")
    hosp_res = client.get("/api/v1/dashboards/hospital", headers={"Authorization": f"Bearer {hosp_token}"})
    assert hosp_res.status_code == 200
    hosp_data = hosp_res.json()
    assert "kpis" in hosp_data
    assert "my_requests" in hosp_data

    # Blood Bank Dashboard
    bb_token = get_token_for(client, "bloodbank@bloodbridge.org", "bloodbank123")
    bb_res = client.get("/api/v1/dashboards/blood-bank", headers={"Authorization": f"Bearer {bb_token}"})
    assert bb_res.status_code == 200
    bb_data = bb_res.json()
    assert "kpis" in bb_data
    assert "inventory_by_group" in bb_data

    # Admin Dashboard
    admin_token = get_token_for(client, "admin@bloodbridge.org", "admin123")
    admin_res = client.get("/api/v1/dashboards/admin", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_res.status_code == 200
    admin_data = admin_res.json()
    assert admin_data["kpis"]["total_hospitals"] >= 3
    assert len(admin_data["recent_audit_logs"]) > 0
