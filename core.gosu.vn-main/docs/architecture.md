# Architecture

## Tổng quan

GOSU Core Platform là một template full-stack để xây dựng các dự án nhanh chóng và đồng nhất.

## Kiến trúc

```
[User]
   |
   v
+---------------- Nginx / Cloudflare ----------------+
|                                                    |
+-------|--------------------------------------------+
        |
        v
+-----------+     +-----------+
| Frontend  |     | Backend   |
| Next.js   |     | FastAPI   |
+-----+-----+     +-----+-----+
      |                 |
      | JWT             |
      +--------+--------+
               |
               v
       api.gosu.vn (apis.gosu.vn)
               |
   +-----------+-------------+---------------+
   |                         |               |
   v                         v               v
PostgreSQL               Redis             MinIO
```

## Backend Architecture

### Core Modules
- `app/core/`: Core functionality (config, security, logging, exceptions, middleware)
- `app/db/`: Database session và base models
- `app/integrations/`: External API clients (GOSU APIs)

### Business Modules
- `app/modules/auth/`: Authentication endpoints
- `app/modules/rbac/`: Role-Based Access Control
- `app/modules/files/`: File upload/download (MinIO)
- `app/modules/health/`: Health check endpoints

### Shared
- `app/shared/schemas/`: Shared Pydantic schemas
- `app/shared/utils/`: Shared utilities
- `app/shared/constants/`: Shared constants

## Frontend Architecture

### App Router Structure
- `app/(auth)/`: Authentication pages (login, etc.)
- `app/(portal)/`: Protected pages (dashboard, etc.)
- `app/layout.tsx`: Root layout

### Components
- `components/layout/`: Layout components (Header, Sidebar, etc.)
- `components/ui/`: UI components (Button, Input, etc.)
- `components/data/`: Data components (Table, Filters, etc.)

### Lib
- `lib/api/`: API client
- `lib/auth/`: Auth utilities
- `lib/rbac/`: Permission checks

## Authentication Flow

1. User nhập username/password trên FE
2. FE gửi POST `/api/v1/auth/login`
3. Backend forward credentials -> `apis.gosu.vn` để xác thực
4. Nếu thành công:
   - Backend phát hành `core_access_token` (JWT HS256)
   - Backend phát hành `refresh_token`
   - Trả về tokens + user info
5. FE lưu tokens
6. Các request sau gửi kèm header: `Authorization: Bearer <token>`

## Database

- PostgreSQL với SQLAlchemy 2 (async)
- Alembic cho migrations
- Redis cho caching và session storage

## File Storage

- MinIO cho object storage
- Presigned URLs cho secure file access

