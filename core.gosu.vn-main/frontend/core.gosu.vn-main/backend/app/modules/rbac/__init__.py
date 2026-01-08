# RBAC Module
from app.modules.rbac.router import router
from app.modules.rbac.service import RBACService
from app.modules.rbac.dependencies import get_rbac_service, require_permission, require_any_permission

__all__ = ["router", "RBACService", "get_rbac_service", "require_permission", "require_any_permission"]
