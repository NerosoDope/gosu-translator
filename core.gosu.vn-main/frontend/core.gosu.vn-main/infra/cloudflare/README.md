# Cloudflare Configuration

## SSL Mode
- **Full (strict)**: Recommended cho production
- Origin certificate hoặc Let's Encrypt

## Cache Rules
- Cache static assets: `/*.css`, `/*.js`, `/*.png`, `/*.jpg`, etc.
- Don't cache: `/api/*`

## WAF Rules
- Rate limit login endpoint: 5 requests/minute per IP
- Block suspicious patterns

## Security Headers
- HSTS: max-age=31536000
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin

