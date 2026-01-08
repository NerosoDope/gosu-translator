# Module Scaffolding Scripts

Scripts để tạo module mới nhanh chóng và đồng nhất.

## Backend Module Scaffolding

Tạo module backend với cấu trúc chuẩn:

```bash
# Tạo module cơ bản
python scripts/scaffold_backend_module.py --name asset

# Tạo module kèm model
python scripts/scaffold_backend_module.py --name voting --with-model
```

**Cấu trúc được tạo:**
```
app/modules/{name}/
├── __init__.py
├── router.py      # API endpoints
├── service.py     # Business logic
├── repository.py  # Data access
├── schemas.py     # Pydantic schemas
└── models.py      # SQLAlchemy models (nếu --with-model)
```

**Sau khi tạo:**
1. Update models.py với các fields cần thiết
2. Update schemas.py với Pydantic models
3. Implement repository methods
4. Add router vào main.py
5. Tạo migration (nếu có model)

## Frontend Module Scaffolding

Tạo module frontend với cấu trúc chuẩn:

```bash
node scripts/scaffold_frontend_module.js --name asset
```

**Cấu trúc được tạo:**
```
src/app/(portal)/{name}/
└── page.tsx

src/hooks/
└── use{Name}.ts

src/components/{name}/
└── {Name}Table.tsx
```

**Sau khi tạo:**
1. Update page.tsx với UI
2. Update hooks với API endpoints
3. Update table component với columns
4. Add route vào sidebar menu

## Examples

### Tạo Asset Management Module

**Backend:**
```bash
python scripts/scaffold_backend_module.py --name asset --with-model
```

**Frontend:**
```bash
node scripts/scaffold_frontend_module.js --name asset
```

### Tạo Voting Module

**Backend:**
```bash
python scripts/scaffold_backend_module.py --name voting --with-model
```

**Frontend:**
```bash
node scripts/scaffold_frontend_module.js --name voting
```

