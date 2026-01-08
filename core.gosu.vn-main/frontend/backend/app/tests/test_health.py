"""
Tests cho Health Check Endpoints

Module này test các health check endpoints để đảm bảo hệ thống hoạt động đúng.

Author: GOSU Development Team
Version: 1.0.0
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.mark.unit
def test_health_check():
    """Test health check endpoint"""
    client = TestClient(app)
    response = client.get("/api/v1/healthz")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "healthy"
    assert "version" in data
    assert "environment" in data


@pytest.mark.unit
def test_readiness_check():
    """Test readiness check endpoint"""
    client = TestClient(app)
    response = client.get("/api/v1/readyz")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "ready"
    assert "version" in data

