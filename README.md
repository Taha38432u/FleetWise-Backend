# FleetWise Backend

NestJS + Prisma + PostgreSQL API for **FleetWise** — multi-tenant fleet operations with JWT auth, role guards, live GPS (Socket.IO), maintenance, fuel, finance, reports, and Stripe test billing.

Companion frontend: [FleetWise](https://github.com/Taha38432u/FleetWise)

---

## What this API does

Solves day-to-day fleet ops that usually live in spreadsheets:

- **Vehicle & driver registry** (org-scoped)
- **Route dispatch** (schedule → in progress → complete / cancel)
- **Live tracking** (GPS logs + Socket.IO broadcast)
- **Attendance** (driver check-in / out)
- **Maintenance** jobs (assign mechanic, status, cost)
- **Fuel logs** (liters, cost, odometer, km/L)
- **Finance** (accounts, categories, transactions, budgets, goals, recurring)
- **Reports** (+ CSV when plan allows)
- **Billing** (FREE → trial / Stripe test checkout, feature limits)
- **Staff + Super Admin** tenant management

### Roles

| Role | Capabilities (high level) |
|------|---------------------------|
| `SUPER_ADMIN` | SaaS overview, deactivate / reset orgs |
| `ADMIN` | Full org ops + staff + billing admin |
| `DISPATCHER` | Vehicles, drivers, routes, tracking, maintenance, finance, reports |
| `DRIVER` | Own routes, attendance, GPS post for assigned active route |
| `MECHANIC` | Read vehicles; list/update maintenance jobs |

Global guards: `JwtAuthGuard` → `RolesGuard` → `DemoReadOnlyGuard` (`@demo.com` cannot mutate).

---

## Architecture

```
HTTP /api/*
  ├── Controllers (REST) + DTOs / validation
  ├── Services (business rules, org scoping, billing limits)
  ├── Prisma → PostgreSQL
  └── Socket.IO namespace /tracking (broadcast only; clients do not write via WS)

Auth
  ├── Local login / register (ADMIN + org + FREE subscription)
  ├── Access JWT + refresh token rotation
  └── Password reset via email (Resend)
```

### Module map (`src/`)

| Module | Responsibility |
|--------|----------------|
| `auth` | Register, login, refresh, logout, me, password reset |
| `vehicle` | Fleet vehicle CRUD |
| `driver` | Profiles, assign vehicle, driving records |
| `routes` | Trip/route lifecycle + driver status + location request |
| `tracking` | GPS HTTP + Socket.IO gateway |
| `attendance` | Check-in / check-out |
| `maintenance` | Service records |
| `fuel` | Fuel logs + efficiency |
| `finance` | Accounts → transactions → budgets / goals / recurring |
| `reports` | Ops reports / CSV |
| `analytics` | Dashboard summary |
| `notifications` | In-app notifications |
| `billing` | Plans, trial, Stripe checkout, limits |
| `staff` | Org user management |
| `super-admin` | Platform owner APIs |
| `prisma` / `config` / `email` | Infrastructure |

API prefix: **`/api`**. Swagger: **`/api/docs`**.

### Data model (Prisma highlights)

`User` · `Organization` · `Subscription` · `Vehicle` · `Driver` · `Route` · `GpsLog` · `MaintenanceRecord` · `FuelLog` · finance tables · `Notification`

Multi-tenant scoping uses `organizationId` on users / vehicles.

---

## Stack

- **NestJS 11** · **Prisma 7** · **PostgreSQL**  
- **Passport JWT** · **Socket.IO** · **Stripe** (test) · **Resend**  
- **Swagger** · **Joi** config validation  

---

## Setup

```bash
cp .env.example .env
# fill DATABASE_URL, JWT secrets, email, Stripe test key

npm install
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

- API: `http://localhost:5000/api`  
- Docs: `http://localhost:5000/api/docs`

### Environment

See `.env.example`. Required at minimum:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Token signing |
| `EMAIL_*` / `RESEND_API_KEY` | Mail (welcome / reset) |
| `APP_URL` / `FRONTEND_URL` | Links in emails + CORS-ish app config |
| `STRIPE_SECRET_KEY` | Test billing checkout |

Never commit real `.env` files.

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Watch mode |
| `npm run build` | `prisma generate` + Nest build |
| `npm run start:prod` | Run compiled `dist` |
| `npm run prisma:migrate` | Dev migrations |
| `npm run prisma:seed` | Seed users + demo fleet |
| `npm run prisma:studio` | Prisma Studio |
| `npm test` | Jest |

---

## Demo accounts (after seed)

Read-only (`@demo.com` — mutating HTTP methods → **403**):

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@demo.com` | `DemoRead1!` |
| Driver | `driver@demo.com` | `DemoRead1!` |
| Mechanic | `mechanic@demo.com` | `DemoRead1!` |

Registration and staff/driver create reject `@demo.com` emails.

Writable seed accounts (local/dev) are printed by `prisma:seed` (owner/admin/dispatcher/driver/mechanic).

---

## Example flow

1. Admin registers → org + FREE plan  
2. Creates vehicles / staff / drivers  
3. Dispatcher creates route (driver + vehicle)  
4. Driver starts route, posts GPS  
5. Mechanic completes maintenance jobs  
6. Admin reviews fuel, finance, reports; upgrades via Stripe test  

---

## Related

- UI: [FleetWise](https://github.com/Taha38432u/FleetWise)  
- Version: **1.0** public release
