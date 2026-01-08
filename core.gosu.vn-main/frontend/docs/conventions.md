# Coding Conventions

## Backend Conventions

### Python
- Python 3.11+
- Type hints cho tất cả functions
- Docstrings cho modules và functions
- Black formatter (line length: 100)
- isort cho import sorting

### FastAPI
- Router prefix: `/api/v1/{module}`
- Response models: Pydantic models
- Error handling: AppException với standardized format
- Dependencies: Sử dụng FastAPI Depends

### Database
- SQLAlchemy 2 async style
- Models: Inherit từ `Base`
- Migrations: Alembic với descriptive names

## Frontend Conventions

### TypeScript
- Strict mode enabled
- Type definitions cho tất cả props và state
- Interfaces cho data structures

### Next.js
- App Router (Next.js 14+)
- Route groups: `(auth)`, `(portal)`
- Server components by default, client components khi cần

### React
- Functional components với hooks
- Custom hooks cho reusable logic
- Context API cho global state

### Styling
- TailwindCSS utility classes
- Dark mode support
- Responsive design (mobile-first)

## Git Conventions

- Conventional commits
- Feature branches
- Pull requests với description

## Module Scaffolding

Khi tạo module mới:
1. Backend: Router, Service, Repository, Schema, Migration
2. Frontend: Page, Query hooks, Table/Form components

## Code Comment Requirements (MANDATORY)

### 13.1 Objectives

New developers reading code must understand:
- What this file does
- Main processing flow
- Why it's written this way (not just what it does)
- Reduce dependency on original author
- Easy to maintain and extend modules

❗ Comments are NOT to explain Python/JS syntax, but to explain **intent & architectural context**.

### 14. Backend Comment Requirements (FastAPI)

#### 14.1 File-Level Comments (MANDATORY)

Every backend file MUST have a header comment:

```python
"""
Module: auth.router
Purpose:
    - Expose authentication-related APIs for core system
    - Handle login, refresh token, logout
Context:
    - Authentication is delegated to apis.gosu.vn
    - Core only issues internal JWT after successful verification
Used by:
    - Frontend core portal
    - Other internal services
"""
```

👉 New devs only need to read the header to understand the file's role in the system.

#### 14.2 Module/Class-Level Comments

Every class or module logic MUST describe responsibilities:

```python
class AuthService:
    """
    AuthService handles authentication logic for core platform.

    Responsibilities:
    - Forward login credentials to apis.gosu.vn
    - Validate response and user status
    - Issue internal JWT tokens for core services

    Notes:
    - This service DOES NOT validate password locally
    - Any change in auth logic must stay backward-compatible
    """
```

#### 14.3 Function/Method-Level Comments

Every function MUST have a standard docstring:

```python
async def login(self, payload: LoginRequest) -> TokenResponse:
    """
    Authenticate user via external GOSU API and issue core JWT.

    Flow:
    1. Forward credentials to apis.gosu.vn
    2. Validate external response
    3. Cache user profile & permissions
    4. Issue internal access & refresh tokens

    Raises:
        AuthenticationError: if credentials are invalid
        ExternalServiceError: if apis.gosu.vn is unreachable
    """
```

#### 14.4 Complex Logic Comments (MANDATORY)

Any complex logic:
- RBAC
- Permission merging
- Token validation
- Cache fallback
- Retry / circuit breaker

👉 MUST have inline comments explaining WHY:

```python
# We cache permissions to avoid hitting apis.gosu.vn on every request.
# Cache TTL is short to ensure permission changes propagate quickly.
permissions = await redis.get(cache_key)
```

### 15. Frontend Comment Requirements (Next.js)

#### 15.1 File-Level Comments

Every page/layout/hook MUST have clear description:

```typescript
/**
 * Page: Dashboard
 * Purpose:
 *   - Main entry after successful login
 *   - Display modules user has permission to access
 *
 * Notes:
 *   - Menu items are filtered by RBAC permissions
 *   - Data is loaded via React Query
 */
```

#### 15.2 Component Comments

Components MUST describe role and input/output data:

```typescript
/**
 * Sidebar navigation component.
 *
 * Responsibilities:
 * - Render menu items based on user permissions
 * - Highlight active route
 *
 * Important:
 * - Menu config is centralized in menu.config.ts
 */
export function Sidebar() {}
```

#### 15.3 Hooks & API Calls Comments

```typescript
/**
 * Fetch current authenticated user profile.
 *
 * This hook:
 * - Calls /api/v1/auth/me
 * - Auto refresh token if expired
 * - Is shared across entire application
 */
export function useMeQuery() {}
```

### 16. Comment & Documentation Conventions

#### 16.1 Comment Language

**MANDATORY: Tiếng Việt**

- Tất cả comments trong code phải sử dụng tiếng Việt
- Viết rõ ràng, dễ hiểu, tránh dùng từ lóng
- Comments phải có tính hệ thống, không mang tính cá nhân
- Giữ nguyên thuật ngữ kỹ thuật tiếng Anh khi cần (ví dụ: JWT, API, database, etc.)

#### 16.2 What NOT to Comment (Anti-Pattern)

❌ Không comment như thế này:

```python
# tăng i lên 1
i += 1
```

❌ Không thêm comments thừa chỉ lặp lại code

### 17. Documentation Links in Comments

#### 17.1 Code ↔ Docs Mapping

Comments in code MUST reference:

- `docs/architecture.md`
- `docs/rbac.md`
- `docs/conventions.md`

Example:

```python
# Xem docs/rbac.md cho permission resolution strategy
```

### 18. Review & Enforcement (MANDATORY)

#### 18.1 Code Review Checklist

PRs CANNOT be merged if:
- New files don't have header comments
- Public functions don't have docstrings
- Complex logic doesn't have explanations
- Comments don't clearly describe responsibilities

#### 18.2 CI Rules (Recommended)

**Backend:**
- Fail CI if public functions lack docstrings

**Frontend:**
- ESLint rule requiring comments for hooks/layout

### 19. "Readable Code" Criteria

A new developer:
- Doesn't know the project
- Only reads code + comments
- Within ≤ 30 minutes must understand:
  - Auth flow
  - Permission flow
  - Layout & data flow

👉 If not achieved → core doesn't meet standards

### 20. Conclusion

This ensures:
- Core doesn't depend on individuals
- New devs onboard quickly
- System scales 3–5 years without breaking

