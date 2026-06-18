# ODM Scheduler — Setup Guide

## Prerequisites
- Node.js 18+ (you have v22 ✓)
- MySQL 8.x running locally
- Redis running locally (default port 6379)
- Cloudflare R2 bucket + credentials
- Meta Developer App with Facebook Login configured

---

## 1. Backend Setup

```bash
cd backend
copy .env.example .env
# Fill in .env (see below)
npm install
npm run migrate   # creates DB + runs schema
npm run seed      # creates admin user + sample clients
npm run dev       # starts API on port 4000
```

### .env values to fill in:
| Key | Where to get it |
|-----|----------------|
| `DB_*` | Your local MySQL credentials |
| `REDIS_*` | Local Redis (defaults usually work) |
| `JWT_SECRET` | Any 64+ char random string |
| `JWT_REFRESH_SECRET` | Another 64+ char random string |
| `ENCRYPTION_KEY` | Exactly 64 hex chars (32 bytes) — run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `R2_ACCOUNT_ID` | Cloudflare dashboard → R2 → Account ID |
| `R2_ACCESS_KEY_ID` | Cloudflare → R2 → Manage R2 API Tokens |
| `R2_SECRET_ACCESS_KEY` | Same as above |
| `R2_BUCKET_NAME` | Your R2 bucket name |
| `R2_PUBLIC_URL` | Your R2 public bucket URL (enable public access in R2) |
| `META_APP_ID` | Meta Developer Console → Your App |
| `META_APP_SECRET` | Meta Developer Console → Your App → Settings → Basic |
| `META_REDIRECT_URI` | Must match exactly what's in Meta App OAuth settings: `http://localhost:4000/api/meta/callback` |

---

## 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev   # starts Vite on port 5173
```

---

## 3. First Login

After seeding:
- **Email:** `admin@odm.in`
- **Password:** `Admin@1234`
- **Change the password immediately** in Settings after first login.

---

## 4. Meta App Configuration

In your Meta Developer App:
1. Add `http://localhost:4000/api/meta/callback` as a Valid OAuth Redirect URI
2. Add `http://localhost:5173` to App Domains
3. Request permissions: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`
4. For production, switch App Mode from Development → Live and complete Business Verification

---

## 5. Connecting a Client's Accounts

1. Go to **Clients** → click a client → **Connect Account**
2. The wizard opens a Facebook Login popup
3. Log in as the Facebook user who manages the client's Pages
4. Select which Pages (and their linked Instagram accounts) to connect
5. Done — the accounts are saved with encrypted tokens

---

## Production Checklist

- [ ] Change `FRONTEND_URL` in `.env` to your production domain
- [ ] Update `META_REDIRECT_URI` to production URL and add it in Meta App settings
- [ ] Set `NODE_ENV=production`
- [ ] Use a process manager (PM2) for the backend
- [ ] Enable R2 public access and configure a custom domain for media URLs
- [ ] Set up MySQL backups
- [ ] Monitor Redis memory usage
