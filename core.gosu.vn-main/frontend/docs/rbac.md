# RBAC (Role-Based Access Control)

## Tổng quan

Hệ thống RBAC quản lý quyền truy cập dựa trên roles và permissions.

## Cấu trúc

### Entities
- **Role**: Vai trò trong hệ thống (Admin, Manager, Employee, etc.)
- **Permission**: Quyền truy cập cụ thể (format: `module:resource:action`)
- **UserRole**: Gán role cho user (many-to-many)
- **Organization**: Tổ chức (cho multi-tenant support)

### Permission Format

Format: `{module}:{resource}:{action}`

Ví dụ:
- `erp_hr:users:read` - Đọc thông tin users
- `erp_hr:users:write` - Tạo/cập nhật users
- `gamification:quests:read` - Đọc quests
- `admin:system:manage` - Quản lý hệ thống

## API Endpoints

### Roles
- `GET /api/v1/rbac/roles` - Lấy danh sách roles
- `GET /api/v1/rbac/roles/{role_id}` - Lấy chi tiết role
- `POST /api/v1/rbac/roles` - Tạo role mới
- `PUT /api/v1/rbac/roles/{role_id}` - Cập nhật role
- `DELETE /api/v1/rbac/roles/{role_id}` - Xóa role

### Permissions
- `GET /api/v1/rbac/permissions` - Lấy danh sách permissions
- `POST /api/v1/rbac/permissions` - Tạo permission mới

### User Roles
- `POST /api/v1/rbac/user-roles/assign` - Gán role cho user
- `POST /api/v1/rbac/roles/{role_id}/permissions` - Gán permissions cho role

## Sử dụng trong Code

### Backend - FastAPI Dependency

```python
from app.modules.rbac.dependencies import require_permission

@router.get("/users")
async def get_users(
    current_user: User = Depends(require_permission("erp_hr:users:read"))
):
    # Endpoint này yêu cầu permission "erp_hr:users:read"
    return users
```

### Frontend - Permission Check

```typescript
import { usePermissions } from '@/lib/rbac';

function MyComponent() {
  const { hasPermission } = usePermissions();
  
  if (hasPermission('erp_hr:users:read')) {
    return <UserList />;
  }
  
  return <div>No permission</div>;
}
```

## Best Practices

1. **Permission Naming**: Sử dụng format `module:resource:action`
2. **System Roles**: Không xóa hoặc sửa system roles
3. **Permission Granularity**: Tạo permissions chi tiết, không quá chung chung
4. **Role Hierarchy**: Có thể tạo role hierarchy bằng cách gán nhiều roles cho user

