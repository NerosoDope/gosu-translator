# Code Comment Examples

This document provides examples of good comments following our conventions.

## Backend Examples

### File Header

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

See also:
    - docs/architecture.md for auth flow
    - docs/rbac.md for permission checks
"""
```

### Class Comment

```python
class RBACService:
    """
    RBAC Service - Policy engine for role-based access control.

    Responsibilities:
    - Resolve user permissions from assigned roles
    - Check if user has specific permission
    - Manage role assignments to users
    - Support multi-tenant permission isolation

    Notes:
    - Permissions are union of all role permissions (not intersection)
    - Only active permissions are considered
    - Organization ID allows same user to have different roles per org
    """
```

### Function Comment

```python
async def get_user_permissions(self, user_id: int, organization_id: Optional[int] = None) -> List[Permission]:
    """
    Get all permissions for a user (union of all role permissions).

    Flow:
    1. Get all roles assigned to user (optionally filtered by org)
    2. Collect all permissions from these roles
    3. Filter only active permissions
    4. Return unique permissions (deduplicate)

    Why union (not intersection):
    - User with multiple roles gets all permissions from all roles
    - More permissive approach (easier to grant access)
    - Can restrict via explicit deny permissions if needed

    Performance:
    - Consider caching result in Redis for frequently accessed users
    - Cache TTL should be short to reflect permission changes quickly
    """
```

### Complex Logic Comment

```python
# We cache permissions to avoid hitting apis.gosu.vn on every request.
# Cache TTL is short (5 minutes) to ensure permission changes propagate quickly.
# If cache miss, we fetch from DB and update cache atomically.
permissions = await redis.get(cache_key)
if not permissions:
    permissions = await self._fetch_from_db(user_id)
    await redis.setex(cache_key, 300, json.dumps(permissions))
```

## Frontend Examples

### Page Comment

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
 *   - Server-side rendering for SEO (if needed)
 *
 * See also:
 *   - src/lib/rbac.ts for permission checks
 *   - docs/architecture.md for routing
 */
```

### Component Comment

```typescript
/**
 * Component: Sidebar
 * 
 * Main navigation sidebar for portal.
 *
 * Responsibilities:
 * - Render menu items based on user permissions
 * - Highlight active route
 * - Handle collapse/expand state
 * - Support mobile responsive design
 *
 * Important:
 * - Menu config is centralized in menu.config.ts
 * - Active route detection uses pathname matching
 * - Permission filtering happens in SidebarContext
 */
export function Sidebar() {}
```

### Hook Comment

```typescript
/**
 * Hook: useMeQuery
 * 
 * Fetch current authenticated user profile.
 *
 * This hook:
 * - Calls /api/v1/auth/me
 * - Auto refresh token if expired
 * - Is shared across entire application
 * - Caches result in React Query
 *
 * Usage:
 *   const { data: user, isLoading } = useMeQuery();
 *
 * Performance:
 * - Result is cached and shared across components
 * - Only refetches on window focus (if enabled)
 */
export function useMeQuery() {}
```

## Anti-Patterns (What NOT to Do)

### ❌ Bad: Commenting Syntax

```python
# increment i by 1
i += 1

# return the result
return result
```

### ❌ Bad: Redundant Comments

```python
def get_user(id: int):
    """Get user by ID"""  # Too obvious, code already says this
    return db.query(User).filter(User.id == id).first()
```

### ❌ Bad: Personal Comments

```python
# TODO: Fix this later (John, 2024-01-15)
# This is a hack but it works for now
```

### ✅ Good: Explain Why

```python
# We use union (not intersection) for permissions because:
# 1. More permissive approach is easier to manage
# 2. Users typically need access to all their role permissions
# 3. Explicit deny can be added later if needed
permissions = set(role.permissions for role in user.roles)
```

## Checklist for Code Review

When reviewing PRs, ensure:

- [ ] All new files have header comments
- [ ] All public functions have docstrings
- [ ] Complex logic has inline comments explaining WHY
- [ ] Comments reference relevant documentation
- [ ] No redundant or syntax-explaining comments
- [ ] Comments are in English and clear

