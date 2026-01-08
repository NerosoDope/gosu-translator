"""
Module: dashboard.router - Router cho dashboard API

Module này cung cấp các API endpoints cho dashboard.

Mục đích:
    - Expose dashboard metrics APIs
    - Cung cấp statistics và overview data

Ngữ cảnh:
    - Dashboard là trang đầu tiên user thấy sau khi login
    - Metrics được tính real-time từ database
    - Yêu cầu authentication để truy cập

Được sử dụng bởi:
    - Frontend dashboard components
    - Admin users để xem overview hệ thống

Xem thêm:
    - app/modules/dashboard/service.py cho business logic
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any
from app.db.session import get_db
from app.modules.users.models import User
from app.modules.users.dependencies import get_current_user
from app.modules.dashboard.service import DashboardService

router = APIRouter()


@router.get("/metrics", response_model=Dict[str, Any])
async def get_dashboard_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get Dashboard Metrics - Lấy metrics cho dashboard
    
    Endpoint này trả về các metrics tổng quan của hệ thống:
    - Users: Tổng số, active, inactive
    - Roles: Tổng số, system, custom, active
    - Permissions: Tổng số, active
    - User-Role assignments: Tổng số
    
    Yêu cầu authentication để truy cập.
    """
    service = DashboardService(db)
    metrics = await service.get_metrics()
    return metrics

