# Environment Variables

Tài liệu về các biến môi trường cần thiết cho GOSU Core Platform.

## Backend Environment Variables

### Database
- `DATABASE_URL`: PostgreSQL connection string (required)
  - Format: `postgresql+psycopg://user:password@host:port/dbname`

### Redis
- `REDIS_URL`: Redis connection string (default: `redis://redis:6379/0`)

### MinIO
- `MINIO_ENDPOINT`: MinIO endpoint (default: `http://minio:9000`)
- `MINIO_ACCESS_KEY`: MinIO access key (required)
- `MINIO_SECRET_KEY`: MinIO secret key (required)
- `MINIO_BUCKET_NAME`: Default bucket name (default: `core-files`)

### JWT
- `JWT_SECRET_KEY`: JWT secret key, minimum 32 characters (required)
- `JWT_ALGORITHM`: JWT algorithm (default: `HS256`)
- `JWT_EXPIRE_MINUTES`: Access token expiration in minutes (default: `30`)
- `JWT_REFRESH_EXPIRE_DAYS`: Refresh token expiration in days (default: `7`)

### GOSU API Integration
- `GOSU_API_URL`: GOSU API base URL (default: `https://apis.gosu.vn`)
- `GOSU_APP_ID`: Application ID (default: `UA`)
- `GOSU_SECRET`: GOSU API secret (required)

### Application
- `APP_NAME`: Application name (default: `GOSU Core Platform`)
- `APP_VERSION`: Application version (default: `1.0.0`)
- `DEBUG`: Debug mode (default: `False`, MUST be False in production)
- `ENVIRONMENT`: Environment (default: `production`)
- `API_PORT`: API port (default: `8000`)

### CORS
- `ALLOWED_ORIGINS`: Allowed CORS origins, comma-separated (default: `http://localhost:3000`)

### SSL
- `SSL_VERIFY`: Enable SSL verification (default: `True`)
- `SSL_CA_BUNDLE`: Optional CA bundle path for self-signed certs (dev only)

## Frontend Environment Variables

- `NEXT_PUBLIC_API_URL`: Backend API URL (default: `http://localhost:8000`)

## Docker Compose Variables

Xem file `deploy/.env.example` để biết tất cả các biến cần thiết.

