import pytest
from fastapi.testclient import TestClient


def test_forecast_endpoints_removed(client: TestClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}
    assert client.get("/api/v1/forecasts", headers=headers).status_code == 404
    assert client.post("/api/v1/forecasts/generate", headers=headers).status_code == 404


def test_risk_engine(client: TestClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Recompute risks (demand is estimated internally from usage history)
    gen_resp = client.post("/api/v1/risks/generate", headers=headers)
    assert gen_resp.status_code == 200
    assert any(a["predicted_demand"] > 0 for a in gen_resp.json()["assessments"])

    # 2. Fetch explainable risks
    risk_resp = client.get("/api/v1/risks", headers=headers)
    assert risk_resp.status_code == 200
    risk_data = risk_resp.json()
    assert "assessments" in risk_data
    assert len(risk_data["assessments"]) > 0
    # Verify reasons are transparent and explainable
    first_risk = risk_data["assessments"][0]
    assert "risk_level" in first_risk
    assert "reasons" in first_risk
    assert isinstance(first_risk["reasons"], list)

    # 3. Fetch specific blood group risk
    single_risk = client.get("/api/v1/risks/O+", headers=headers)
    assert single_risk.status_code == 200
    assert single_risk.json()["blood_group"] == "O+"


def test_multi_bank_coordination(client: TestClient, hospital_token: str):
    headers = {"Authorization": f"Bearer {hospital_token}"}
    resp = client.get("/api/v1/inventory/coordination/O-?quantity_needed=6", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["blood_group"] == "O-"
    assert data["quantity_needed"] == 6
    assert "participating_blood_banks" in data
    assert "policy_notice" in data
    assert len(data["participating_blood_banks"]) > 0


def test_analytics_metrics(client: TestClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = client.get("/api/v1/analytics", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "summary" in data
    assert "demand_by_blood_group" in data
    assert "daily_usage_trend" in data
    assert "forecast_accuracy_pct" not in data["summary"]
    assert "wastage_rate_pct" in data["summary"]


def test_automation_and_webhooks(client: TestClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. List supported workflows
    wf_resp = client.get("/api/v1/automation/workflows", headers=headers)
    assert wf_resp.status_code == 200
    assert len(wf_resp.json()) == 5
    assert "demand-forecast" not in [w["id"] for w in wf_resp.json()]

    # 2. Trigger workflow manually
    trig_resp = client.post("/api/v1/automation/trigger/low-inventory", headers=headers)
    assert trig_resp.status_code == 200
    assert trig_resp.json()["status"] == "executed"

    # 3. Check automation events
    events_resp = client.get("/api/v1/automation/events", headers=headers)
    assert events_resp.status_code == 200
    events = events_resp.json()
    assert len(events) > 0
    assert events[0]["workflow_name"] is not None


def test_bloodbridge_assistant_grounded_queries(client: TestClient, blood_bank_token: str):
    headers = {"Authorization": f"Bearer {blood_bank_token}"}

    # 1. Query available stock
    q1 = client.post("/api/v1/chat", json={"message": "How many O+ units are available?"}, headers=headers)
    assert q1.status_code == 200
    res1 = q1.json()
    assert res1["source_type"] == "LIVE_DATABASE"
    assert "Available Units:" in res1["response_text"]

    # 2. Query low groups
    q2 = client.post("/api/v1/chat", json={"message": "Which blood groups are low?"}, headers=headers)
    assert q2.status_code == 200
    assert "Low" in q2.json()["response_text"] or "healthy" in q2.json()["response_text"]

    # 3. Forecast queries are no longer answered
    q3 = client.post("/api/v1/chat", json={"message": "What is the predicted O+ demand for the next 7 days?"}, headers=headers)
    assert q3.status_code == 200
    assert q3.json()["source_type"] != "ML_FORECAST"

    # 4. Query explainable risk
    q4 = client.post("/api/v1/chat", json={"message": "Why is O- showing high shortage risk?"}, headers=headers)
    assert q4.status_code == 200
    assert q4.json()["source_type"] == "RISK_ENGINE"

    # 5. Controlled Action Preparation
    q5 = client.post("/api/v1/chat", json={"message": "Create an emergency request for 6 units of O-"}, headers=headers)
    assert q5.status_code == 200
    res5 = q5.json()
    assert res5["source_type"] == "ACTION_CONFIRMATION"
    assert "pending_action" in res5
    assert res5["pending_action"]["action_type"] == "CREATE_REQUEST"

    # 6. Explicit Confirmation Execution
    confirm_resp = client.post(
        "/api/v1/chat/confirm",
        json={
            "action_type": res5["pending_action"]["action_type"],
            "parameters": res5["pending_action"]["parameters"],
        },
        headers=headers,
    )
    assert confirm_resp.status_code == 200
    confirm_data = confirm_resp.json()
    assert confirm_data["status"] == "COMPLETED"
    assert "request_id" in confirm_data["data"]
