# GOSU Core Platform - Setup Guide

## 🚀 Automated Setup (Khuyến nghị)

Script setup tự động (`setup.py`) sẽ giúp bạn cấu hình toàn bộ hệ thống chỉ với một lệnh.

### Yêu cầu

- **Docker** và **Docker Compose** (phiên bản mới nhất)
- **Python 3.8+** (để chạy setup script)
- **Node.js 18+** (để build frontend, script sẽ tự động build)

### Cách sử dụng

1. **Clone repository:**
   ```bash
   git clone <repository-url>
   cd core.gosu.vn
   ```

2. **Chạy script setup:**
   ```bash
   python3 setup.py
   ```

3. **Làm theo hướng dẫn trên màn hình:**

   Script sẽ hỏi các thông tin sau:

   #### Bước 1: Environment Configuration (Có thể skip nếu đã có .env)
   - **Database Pas
   sword**: Mật khẩu PostgreSQL (tối thiểu 32 ký tự)
   - **JWT Secret Key**: Secret key cho JWT (tối thiểu 64 ký tự, có thể để trống để tự động generate)
   - **GOSU API Secret**: Secret key cho GOSU API
   - **MinIO Access Key**: Access key cho MinIO
   - **MinIO Secret Key**: Secret key cho MinIO
   - **App Name**: Tên ứng dụng
   - **Frontend URL**: URL của frontend (default: http://localhost:3000)
   - **CORS Origins**: Các origins được phép (comma-separated)

   #### Bước 2: Admin User Configuration
   - **Admin Email**: Email của admin user (sẽ được sync từ apis.gosu.vn)
   - **Admin Full Name**: Tên đầy đủ của admin (optional)

4. **Script sẽ tự động thực hiện:**
   - ✓ Kiểm tra dependencies (Docker, Python, Node.js)
   - ✓ Tạo file `.env` từ template `.env.example`
   - ✓ Xử lý port conflicts (MinIO port 9000)
   - ✓ Quản lý PostgreSQL volumes (nếu password thay đổi)
   - ✓ Build và khởi động Docker services
   - ✓ Chạy database migrations
   - ✓ Seed default permissions (users:*, rbac:*)
   - ✓ Tạo ADMIN role với full permissions
   - ✓ Tạo admin user và gán ADMIN role

### Sau khi setup

1. **Login với admin email:**
   - Truy cập: http://localhost:3000/login
   - Login với email admin đã nhập trong setup
   - User sẽ được tự động sync từ apis.gosu.vn
   - ADMIN role đã được tự động gán cho user

2. **Truy cập hệ thống:**
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:8000
   - **API Docs**: http://localhost:8000/docs
   - **MinIO Console**: http://localhost:9001 (nếu port 9000 không bị conflict)

3. **Xem logs:**
   ```bash
   cd deploy
   docker-compose logs -f
   ```

## 🔧 Manual Setup (Nếu cần)

Nếu bạn muốn setup thủ công hoặc script tự động gặp vấn đề:

### 1. Tạo file .env

```bash
cd deploy
cp .env.example .env
```

Chỉnh sửa `.env` với các giá trị thực tế:
- `POSTGRES_PASSWORD`: Mật khẩu PostgreSQL (tối thiểu 32 ký tự)
- `DATABASE_URL`: URL kết nối database
- `JWT_SECRET_KEY`: Secret key cho JWT (tối thiểu 64 ký tự)
- `GOSU_SECRET`: Secret key cho GOSU API
- `MINIO_ACCESS_KEY`: Access key cho MinIO
- `MINIO_SECRET_KEY`: Secret key cho MinIO

### 2. Start Docker services

```bash
cd deploy
docker-compose up -d --build
```

### 3. Chạy migrations

```bash
docker-compose exec backend alembic upgrade head
```

### 4. Seed permissions và tạo admin

```bash
# Seed permissions
docker-compose exec backend python /app/scripts/seed_permissions.py

# Tạo admin role và user
docker-compose exec backend python /app/scripts/create_admin_role_and_user.py
```

## 🐛 Troubleshooting

### Database không kết nối được

**Kiểm tra:**
```bash
# Kiểm tra Docker services đã chạy
docker-compose -f deploy/docker-compose.yml ps

# Kiểm tra logs
docker-compose -f deploy/docker-compose.yml logs postgres

# Kiểm tra database đã sẵn sàng
docker-compose -f deploy/docker-compose.yml exec postgres pg_isready -U core_user
```

**Giải pháp:**
- Đảm bảo PostgreSQL container đang chạy
- Kiểm tra password trong `.env` khớp với password đã set
- Nếu đã thay đổi password, cần xóa volume cũ:
  ```bash
  docker volume rm deploy_postgres_data
  docker-compose -f deploy/docker-compose.yml up -d
  ```

### Migrations thất bại

**Kiểm tra:**
```bash
# Kiểm tra DATABASE_URL trong .env
cat deploy/.env | grep DATABASE_URL

# Kiểm tra database connection
docker-compose exec backend python -c "from app.core.config import settings; print(settings.DATABASE_URL)"
```

**Giải pháp:**
- Đảm bảo `DATABASE_URL` đúng format: `postgresql+asyncpg://user:password@postgres:5432/dbname`
- Password trong URL phải được URL-encoded (script setup tự động làm điều này)
- Đảm bảo database đã sẵn sàng trước khi chạy migrations

### MinIO port 9000 đã được sử dụng

**Kiểm tra:**
```bash
# Kiểm tra port 9000
lsof -i :9000
```

**Giải pháp:**
- Script setup tự động phát hiện và xử lý conflict
- Có thể chọn:
  1. Đổi port MinIO sang port khác (ví dụ: 9002)
  2. Skip MinIO port mapping (chỉ dùng trong Docker network)
  3. Dừng process đang sử dụng port 9000

### Admin user không có quyền

**Kiểm tra:**
```bash
# Kiểm tra user đã được tạo
docker-compose exec backend python -c "
from app.db.session import get_db
from app.modules.users.models import User
from sqlalchemy import select
import asyncio

async def check():
    async for db in get_db():
        result = await db.execute(select(User))
        users = result.scalars().all()
        for u in users:
            print(f'User: {u.email}, ID: {u.id}')
        break

asyncio.run(check())
"
```

**Giải pháp:**
1. Login với admin email để sync user từ apis.gosu.vn
2. Sau đó gán ADMIN role:
   ```bash
   docker-compose exec backend python /app/scripts/assign_admin_role.py <admin-email>
   ```

### JWT Secret Key quá ngắn

**Lỗi:**
```
ValueError: JWT_SECRET_KEY must be at least 32 characters
```

**Giải pháp:**
- Script setup tự động generate JWT secret 64 ký tự nếu bạn để trống
- Hoặc nhập JWT secret tối thiểu 32 ký tự

### File .env không được tạo

**Kiểm tra:**
```bash
# Kiểm tra file .env.example có tồn tại
ls -la deploy/.env.example
```

**Giải pháp:**
- Đảm bảo file `deploy/.env.example` tồn tại
- Script sẽ tự động copy từ `.env.example` và thay thế các placeholder

## 📝 Lưu ý quan trọng

### Security

- **File `.env`** chứa các secrets quan trọng. **KHÔNG commit vào Git!**
- **Database Password** phải đủ mạnh (tối thiểu 32 ký tự)
- **JWT Secret** phải đủ mạnh (tối thiểu 64 ký tự)
- **GOSU API Secret** phải được lấy từ apis.gosu.vn

### Database

- **Password**: Đảm bảo password database đủ mạnh (tối thiểu 32 ký tự)
- **Volume**: Nếu thay đổi password, cần xóa volume cũ để PostgreSQL khởi tạo lại với password mới
- **Backup**: Sử dụng script `deploy/scripts/backup_restore.sh` để backup database

### JWT Secret

- Script tự động generate JWT secret 64 ký tự nếu không nhập
- JWT secret được sử dụng để sign và verify tokens
- **KHÔNG** sử dụng các giá trị yếu như "secret", "password", etc.

### Admin User

- User sẽ được **sync từ apis.gosu.vn** sau khi login lần đầu
- ADMIN role sẽ được **tự động gán** cho user sau khi sync
- Nếu user chưa tồn tại trong apis.gosu.vn, cần tạo user trước

### Port Conflicts

- **MinIO port 9000**: Script tự động phát hiện và xử lý conflict
- **PostgreSQL port 5432**: Đảm bảo không có service khác đang sử dụng
- **Redis port 6379**: Đảm bảo không có service khác đang sử dụng

## 🔄 Re-run Setup

Nếu cần chạy lại setup:

```bash
# Chạy lại toàn bộ setup
python3 setup.py

# Script sẽ hỏi:
# - Có muốn ghi đè .env không? (Nếu đã có .env)
# - Có muốn tạo lại admin role/user không?
```

## 📚 Tài liệu tham khảo

- **[README.md](README.md)** - Tổng quan về project
- **[COMPLETION_SUMMARY.md](COMPLETION_SUMMARY.md)** - Tóm tắt tính năng đã hoàn thành
- **[docs/architecture.md](docs/architecture.md)** - Kiến trúc hệ thống
- **[docs/env.md](docs/env.md)** - Chi tiết về environment variables
- **[docs/rbac.md](docs/rbac.md)** - Hướng dẫn sử dụng RBAC

## ✅ Checklist sau khi setup

- [ ] Docker services đang chạy (`docker-compose ps`)
- [ ] Database migrations đã chạy (`alembic upgrade head`)
- [ ] Permissions đã được seed
- [ ] ADMIN role đã được tạo
- [ ] Admin user đã được tạo và gán ADMIN role
- [ ] Frontend accessible tại http://localhost:3000
- [ ] Backend API accessible tại http://localhost:8000
- [ ] API Docs accessible tại http://localhost:8000/docs
- [ ] Login thành công với admin email
- [ ] User được sync từ apis.gosu.vn
- [ ] Permissions và roles hiển thị đúng trong `/auth/me`

## 🎉 Hoàn thành!

Sau khi setup xong, bạn có thể:
1. Login với admin email
2. Truy cập dashboard
3. Quản lý users và roles
4. Bắt đầu phát triển modules mới!

Chúc bạn phát triển vui vẻ! 🚀
