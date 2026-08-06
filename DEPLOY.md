# Деплой backend через Docker + Dokploy

Build type: **Dockerfile** (не Nixpacks). Port: **3010**.

Env: см. `.env.example`.

Обязательно:

- `DATABASE_URL` на Postgres Dokploy
- `CORS_ORIGIN` / `FRONTEND_URL` = URL фронта
- `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true` на HTTPS

Старт контейнера: `prisma migrate deploy && node dist/src/main`.

Полная схема (FE + API + corporate): см. `DEPLOY.md` рядом с монорепо-папками или в frontend-репо.
