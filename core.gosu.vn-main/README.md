# GOSU Core Platform

> **🚀 Quick Start**: Chạy `python3 setup.py` để tự động setup toàn bộ hệ thống! Xem [SETUP.md](SETUP.md) để biết chi tiết.

Core platform template để xây dựng các dự án trong năm 2026 một cách nhanh chóng và đồng nhất về cấu trúc.

## 🎯 Mục tiêu

- **Chuẩn hóa**: Authentication, Authorization, Database access, API design, UI layout
- **Tái sử dụng**: Module scaffolding, shared components, utilities
- **Mở rộng**: Dễ thêm modules mới, dễ bảo trì, dễ onboarding developer
- **Tiếng Việt**: Tất cả comments trong code đều bằng tiếng Việt để dễ đọc và hiểu

## 📋 Tiêu chí hoàn thành Core v1.0

- ✅ Chạy local bằng 1 lệnh `python3 setup.py`
- ✅ Login thành công qua `apis.gosu.vn`
- ✅ Có dashboard + layout chuẩn
- ✅ Có RBAC hoạt động đầy đủ
- ✅ Có user management module
- ✅ Có tài liệu setup + conventions
- ✅ Comments tiếng Việt trong toàn bộ codebase

## 🏗️ Cấu trúc

```
core.gosu.vn/
├─ README.md
├─ SETUP.md                    # Hướng dẫn setup chi tiết
├─ COMPLETION_SUMMARY.md       # Tóm tắt các tính năng đã hoàn thành
├─ setup.py                    # Script setup tự động
├─ docs/                       # Tài liệu
│  ├─ architecture.md
│  ├─ conventions.md           # Coding conventions (Comments tiếng Việt)
│  ├─ env.md
│  ├─ runbook.md
│  └─ rbac.md
├─ infra/                      # Infrastructure configs
├─ deploy/                     # Docker & deployment
│  ├─ docker-compose.yml
│  ├─ .env.example
│  └─ scripts/
├─ backend/                    # FastAPI backend
│  ├─ app/
│  │  ├─ main.py              # (Comments tiếng Việt)
│  │  ├─ core/                 # Core modules (Comments tiếng Việt)
│  │  ├─ modules/              # Business modules (Comments tiếng Việt)
│  │  │  ├─ auth/
│  │  │  ├─ users/
│  │  │  ├─ rbac/
│  │  │  ├─ files/
│  │  │  └─ health/
│  │  └─ integrations/
│  └─ alembic/                 # Database migrations
├─ frontend/                   # Next.js frontend
│  └─ src/
│     ├─ app/
│     ├─ components/
│     ├─ lib/
│     └─ hooks/
└─ scripts/                    # Utility scripts
```

## 🚀 Quick Start

### Cách 1: Automated Setup (Khuyến nghị)

```bash
# 1. Clone repository
git clone <repository-url>
cd core.gosu.vn

# 2. Chạy setup script tự động
python3 setup.py

# Script sẽ tự động:
# - Kiểm tra dependencies (Docker, Python, Node.js)
# - Tạo file .env từ template
# - Build và khởi động Docker services
# - Chạy database migrations
# - Seed default permissions
# - Tạo ADMIN role và user
```

### Cách 2: Manual Setup

```bash
# 1. Copy environment file
cd deploy
cp .env.example .env
# Chỉnh sửa .env với các giá trị phù hợp

# 2. Start services
docker-compose up -d

# 3. Run migrations
docker-compose exec backend alembic upgrade head

# Hoặc sử dụng setup.py để chỉ chạy migrations (khi có migrations mới):
python3 setup.py --migrate

# 4. Seed permissions và tạo admin (xem scripts/)
```

### Truy cập hệ thống

Sau khi setup xong, truy cập:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **MinIO Console**: http://localhost:9001

## 📚 Tài liệu

- **[SETUP.md](SETUP.md)** - Hướng dẫn setup chi tiết
- **[COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md)** - Tóm tắt tính năng đã hoàn thành
- **[Architecture](docs/architecture.md)** - Kiến trúc hệ thống
- **[Conventions](docs/conventions.md)** - Coding conventions (Comments tiếng Việt)
- **[Environment Setup](docs/env.md)** - Cấu hình môi trường
- **[Docker Guide](docs/docker.md)** - Hướng dẫn sử dụng Docker
- **[Runbook](docs/runbook.md)** - Vận hành production
- **[RBAC](docs/rbac.md)** - Role-Based Access Control

## 🛠️ Công nghệ

### Backend
- **Python 3.11+** với type hints
- **FastAPI** - Modern async web framework
- **SQLAlchemy 2** (async) - ORM
- **Alembic** - Database migrations
- **Pydantic v2** - Data validation
- **PostgreSQL** - Database
- **Redis** - Caching (optional)
- **MinIO** - Object storage
- **JWT (HS256)** - Authentication

### Frontend
- **Next.js 14+** (App Router)
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **React Query** - Data fetching
- **Zustand/Context** - State management

### DevOps
- **Docker** - Containerization (xem [docs/docker.md](docs/docker.md))
- **Docker Compose** - Local development
- **Nginx** - Reverse proxy
- **Cloudflare** - CDN & DDoS protection

## 📝 Module Scaffolding

Tạo module mới nhanh chóng:

```bash
# Backend module
python scripts/scaffold_backend_module.py --name asset --with-model

# Frontend module
node scripts/scaffold_frontend_module.js --name asset
```

## 🔐 Authentication

Core tích hợp với `apis.gosu.vn` để xác thực:
- **Login** qua GOSU API
- **JWT token** nội bộ (HS256)
- **Refresh token** support
- **Auto token refresh** trong frontend
- **User sync** tự động từ GOSU API

## 👥 User Management

- **User sync** tự động từ apis.gosu.vn sau login
- **CRUD operations** với permission checks
- **User profile** với avatar support
- **Active/Inactive** status

## 🔒 RBAC (Role-Based Access Control)

Hệ thống phân quyền đầy đủ:
- **Roles**: Quản lý roles (ADMIN, USER, etc.)
- **Permissions**: Quản lý permissions (users:read, rbac:write, etc.)
- **User-Role Assignments**: Gán roles cho users
- **Permission Checks**: Tự động kiểm tra permissions trong endpoints
- **Multi-tenant**: Hỗ trợ organization_id

### Permission Format
```
{module}:{resource}:{action}
Ví dụ: users:read, rbac:roles:write, files:upload
```

## 📁 File Management

- **Upload files** lên MinIO
- **Presigned URLs** cho file access
- **File validation** (size, type)
- **Bucket management**

## 🎨 UI Components

- **Layout**: Header, Sidebar, Breadcrumb
- **Data Display**: DataTable, Pagination, FilterBar
- **Forms**: Input, Button, Dropdown
- **Feedback**: Toast notifications
- **Theme**: Light/Dark mode support

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 🚀 Deployment

### Production Setup

1. **Cấu hình production:**
   ```bash
   cp deploy/docker-compose.prod.yml docker-compose.yml
   # Chỉnh sửa configs cho production
   ```

2. **Build và deploy:**
   ```bash
   docker-compose -f deploy/docker-compose.prod.yml up -d --build
   ```

3. **Run migrations:**
   ```bash
   docker-compose exec backend alembic upgrade head
   ```

### Environment Variables

Xem [docs/env.md](docs/env.md) để biết chi tiết về các biến môi trường cần thiết.

## 📊 Monitoring

- **Health Checks**: `/healthz` và `/readyz`
- **Structured Logging**: Với request ID tracking
- **Error Tracking**: Standardized error responses

## 🤝 Contributing

1. Tạo feature branch
2. Commit với conventional commits
3. Tạo Pull Request
4. Đảm bảo tất cả comments bằng tiếng Việt

## 📝 Code Conventions

- **Comments**: Tất cả comments phải bằng **tiếng Việt**
- **Type Hints**: Bắt buộc cho tất cả functions
- **Docstrings**: Bắt buộc cho tất cả public functions
- **Error Handling**: Sử dụng AppException
- **Logging**: Structured logging với request ID

Xem [docs/conventions.md](docs/conventions.md) để biết chi tiết.

## 📦 License

Internal use only - GOSU Team

## 🎉 Bắt đầu ngay!

```bash
# Clone và setup
git clone <repository-url>
cd core.gosu.vn
python3 setup.py

# Truy cập http://localhost:3000 và bắt đầu phát triển!
```
# test
