# Safe Deployment Flow

## Goal

Make deployment both safer and easier:

- GitHub Actions only triggers the deployment
- the server loads `/opt/lifetracker/.env` itself
- database schema is synced automatically
- runtime artifacts are replaced in a controlled way
- backend health is checked after restart

## Files

- `.github/workflows/deploy.yml`
- `scripts/deployment/deploy-server.sh`

## Current Flow

1. Push code to `main`
2. GitHub Actions connects to the server by SSH
3. Actions creates a fresh temporary checkout for the pushed commit
4. The server runs `scripts/deployment/deploy-server.sh`
5. The script:
   - loads `/opt/lifetracker/.env`
   - runs `npx prisma db push`
   - builds backend and frontend
   - stages new backend runtime files under `/opt/lifetracker/app/*.new`
   - replaces `/opt/lifetracker/app/backend-dist`
   - replaces `/opt/lifetracker/app/node_modules`
   - replaces `/opt/lifetracker/app/prisma`
   - publishes frontend static files to `/var/www/html`
   - restarts `lifetracker-backend`
   - checks `http://127.0.0.1:3002/api/health`
   - rolls back the backend runtime payload if startup or health check fails

## Why This Is Safer

- It no longer depends on the server source directory being clean
- It no longer requires manual `source .env` before `prisma db push`
- It avoids nested `node_modules/node_modules` copy mistakes
- It fails early if the backend service or health endpoint is broken
- It automatically rolls back to the previous backend runtime payload on failure

## Manual Fallback

If GitHub Actions fails but SSH still works:

```bash
cd /opt/lifetracker
REMOTE_URL="$(git remote get-url origin)"
RELEASE_DIR="/tmp/lifetracker-deploy-manual-$(date +%s)"

rm -rf "$RELEASE_DIR"
git clone --depth 1 --branch main "$REMOTE_URL" "$RELEASE_DIR"
cd "$RELEASE_DIR"

bash scripts/deployment/deploy-server.sh
```

## Notes

- `/opt/lifetracker/.env` stays on the server and is not committed to git
- this flow still uses `prisma db push`, not Prisma migration files
- if the project later adopts Prisma migrations, replace `npx prisma db push`
  with `npx prisma migrate deploy`
