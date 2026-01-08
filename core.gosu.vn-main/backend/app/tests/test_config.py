"""
Tests cho Configuration

Module này test các cấu hình hệ thống.

Author: GOSU Development Team
Version: 1.0.0
"""

import pytest
from app.core.config import settings


@pytest.mark.unit
def test_settings_loaded():
    """Test rằng settings được load thành công"""
    assert settings is not None
    assert hasattr(settings, "DATABASE_URL")
    assert hasattr(settings, "SECRET_KEY")


@pytest.mark.unit
def test_database_url_format():
    """Test rằng DATABASE_URL có format đúng"""
    assert settings.DATABASE_URL is not None
    assert isinstance(settings.DATABASE_URL, str)
    assert len(settings.DATABASE_URL) > 0

