import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db as db_get_db
from app.api.deps import get_db as api_get_db
from app.main import app
from app.services.seed_service import seed_database

# Use in-memory SQLite database for isolated test execution
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_database(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session(setup_db):
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[api_get_db] = override_get_db
    app.dependency_overrides[db_get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def admin_token(client):
    res = client.post("/api/v1/auth/login", json={"email": "admin@bloodbridge.org", "password": "admin123"})
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture()
def blood_bank_token(client):
    res = client.post("/api/v1/auth/login", json={"email": "bloodbank@bloodbridge.org", "password": "bloodbank123"})
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture()
def hospital_token(client):
    res = client.post("/api/v1/auth/login", json={"email": "hospital@bloodbridge.org", "password": "hospital123"})
    assert res.status_code == 200
    return res.json()["access_token"]

