# Docker Setup Guide

Hướng dẫn sử dụng Docker cho GOSU Core Platform.

## 📋 Mục lục

- [Cài đặt Docker](#cài-đặt-docker)
- [Cấu trúc Docker](#cấu-trúc-docker)
- [Sử dụng Docker Compose](#sử-dụng-docker-compose)
- [Dockerfiles](#dockerfiles)
- [Troubleshooting](#troubleshooting)

## 🐳 Cài đặt Docker

### Windows

1. Tải và cài đặt [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. Khởi động Docker Desktop
3. Đảm bảo Docker service đang chạy:
   ```powershell
   Get-Service -Name "com.docker.service"
   ```

### Linux

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Khởi động lại terminal hoặc đăng nhập lại
```

### macOS

1. Tải và cài đặt [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
2. Khởi động Docker Desktop từ Applications

### Kiểm tra cài đặt

```bash
docker --version
docker-compose --version
```

## 📁 Cấu trúc Docker

```
core.gosu.vn/
├─ docker-compose.yml          # Root-level compose file (dễ truy cập)
├─ deploy/
│  ├─ docker-compose.yml       # Main compose file
│  ├─ docker-compose.prod.yml  # Production config
│  └─ .env                     # Environment variables
├─ backend/
│  ├─ Dockerfile               # Production image
│  ├─ Dockerfile.dev           # Development image
│  └─ .dockerignore            # Files to exclude from build
└─ frontend/
   ├─ Dockerfile               # Production image
   ├─ Dockerfile.dev           # Development image
   └─ .dockerignore            # Files to exclude from build
```

## 🚀 Sử dụng Docker Compose

### Development (Khuyến nghị)

Sử dụng `setup.py` script tự động:

```bash
python3 setup.py
```

Hoặc thủ công:

```bash
# Từ thư mục root
docker-compose up -d

# Hoặc từ thư mục deploy
cd deploy
docker-compose up -d
```

### Production

```bash
cd deploy
docker-compose -f docker-compose.prod.yml up -d --build
```

### Các lệnh thường dùng

```bash
# Khởi động services
docker-compose up -d

# Xem logs
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend

# Dừng services
docker-compose down

# Dừng và xóa volumes (⚠️ Xóa dữ liệu)
docker-compose down -v

# Rebuild images
docker-compose build --no-cache

# Restart một service
docker-compose restart backend

# Xem status
docker-compose ps

# Execute command trong container
docker-compose exec backend alembic upgrade head
docker-compose exec backend python scripts/seed_permissions.py
docker-compose exec backend python -m pytest

# Shell vào container
docker-compose exec backend bash
docker-compose exec frontend sh
```

## 🏗️ Dockerfiles

### Backend Dockerfile

**Production (`Dockerfile`):**
- Multi-stage build (nếu cần)
- Optimized cho production
- Không có hot-reload

**Development (`Dockerfile.dev`):**
- Hot-reload enabled
- Volume mount cho code changes
- Debug tools

### Frontend Dockerfile

**Production (`Dockerfile`):**
- Multi-stage build với Next.js standalone
- Optimized production build
- Minimal runtime image

**Development (`Dockerfile.dev`):**
- Development server với hot-reload
- Volume mount cho code changes
- Fast refresh enabled

## 🔧 Services

### PostgreSQL

- **Port**: 5432
- **Database**: core_db
- **User**: core_user
- **Password**: Từ biến môi trường `POSTGRES_PASSWORD`
- **Volume**: `postgres_data` (persistent storage)

### Redis

- **Port**: 6379 (internal)
- **Volume**: `redis_data` (persistent storage)
- **Use case**: Caching, session storage

### MinIO

- **API Port**: 9000
- **Console Port**: 9001
- **Volume**: `minio_data` (persistent storage)
- **Access**: Từ biến môi trường `MINIO_ACCESS_KEY` và `MINIO_SECRET_KEY`

### Backend (FastAPI)

- **Port**: 8000
- **Health Check**: `/api/v1/healthz`
- **Auto-reload**: Enabled trong development mode
- **Dependencies**: PostgreSQL, Redis

### Frontend (Next.js)

- **Port**: 3000
- **Hot Reload**: Enabled trong development mode
- **Dependencies**: Backend

## 🐛 Troubleshooting

### Port đã được sử dụng

```bash
# Kiểm tra port đang được sử dụng
# Windows
netstat -ano | findstr :8000
netstat -ano | findstr :3000

# Linux/Mac
lsof -i :8000
lsof -i :3000

# Thay đổi port trong docker-compose.yml nếu cần
```

### Container không khởi động

```bash
# Xem logs chi tiết
docker-compose logs backend
docker-compose logs frontend

# Kiểm tra health status
docker-compose ps

# Rebuild từ đầu
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Database connection errors

```bash
# Kiểm tra PostgreSQL đã sẵn sàng
docker-compose exec postgres pg_isready -U core_user

# Kiểm tra connection từ backend
docker-compose exec backend python -c "from app.db.session import engine; print(engine)"

# Xem PostgreSQL logs
docker-compose logs postgres
```

### Volume permissions

```bash
# Nếu gặp permission issues trên Linux
sudo chown -R $USER:$USER ./backend
sudo chown -R $USER:$USER ./frontend
```

### Clean up

```bash
# Xóa tất cả containers, networks, volumes
docker-compose down -v

# Xóa images không sử dụng
docker image prune -a

# Xóa tất cả (⚠️ Cẩn thận!)
docker system prune -a --volumes
```

### Rebuild specific service

```bash
# Rebuild chỉ backend
docker-compose build --no-cache backend
docker-compose up -d backend

# Rebuild chỉ frontend
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

## 📝 Environment Variables

Tất cả biến môi trường được định nghĩa trong `deploy/.env`. Xem [env.md](./env.md) để biết chi tiết.

## 🔐 Security Best Practices

1. **Không commit `.env` file** - Sử dụng `.env.example` làm template
2. **Production secrets** - Sử dụng secret management (Docker secrets, Kubernetes secrets, etc.)
3. **Image scanning** - Quét images cho vulnerabilities
4. **Non-root user** - Frontend image sử dụng non-root user (nextjs)
5. **Health checks** - Tất cả services có health checks

## 🚀 Production Deployment

Xem [runbook.md](./runbook.md) để biết chi tiết về production deployment.

### Production Checklist

- [ ] Sử dụng `docker-compose.prod.yml`
- [ ] Set `ENVIRONMENT=production`
- [ ] Set `DEBUG=False`
- [ ] Sử dụng strong passwords
- [ ] Configure SSL/TLS
- [ ] Setup backup strategy
- [ ] Configure monitoring
- [ ] Setup log aggregation
- [ ] Review security settings

## 📚 Tài liệu tham khảo

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)

