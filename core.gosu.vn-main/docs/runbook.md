# Runbook - Production Operations

## Deployment

### Local Development
```bash
cd deploy
cp .env.example .env
# Edit .env với các giá trị phù hợp
docker-compose up -d
```

### Production
```bash
cd deploy
docker-compose -f docker-compose.prod.yml up -d
```

## Database Operations

### Backup
```bash
docker-compose exec postgres pg_dump -U core_user core_db > backup.sql
```

### Restore
```bash
docker-compose exec -T postgres psql -U core_user core_db < backup.sql
```

### Migrations
```bash
docker-compose exec backend alembic upgrade head
```

## Monitoring

### Health Checks
- Backend: `GET /api/v1/healthz`
- Frontend: `GET /`

### Logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Troubleshooting

### Database Connection Issues
- Check PostgreSQL container: `docker-compose ps postgres`
- Check DATABASE_URL trong .env
- Check network connectivity

### Authentication Issues
- Verify GOSU_SECRET trong .env
- Check GOSU_API_URL
- Review backend logs

### Frontend Not Loading
- Check NEXT_PUBLIC_API_URL
- Verify backend is running
- Check CORS settings

