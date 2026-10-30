# School Management System v2 — Next.js App Router & Supabase

A complete replacement for the Laravel v1 (`lav_sms`) School Management System built in a separate `v2/` directory, preserving the running Laravel v1 stack untouched (`localhost:8000` / MySQL `3307`).

---

## 1. Architecture & Core Capabilities

- **Framework & UI**: Next.js 14 App Router, TypeScript, Tailwind CSS, `shadcn/ui`-style accessible primitives, pinned dependencies in `package.json`, and an independent `package-lock.json`.
- **Database, Auth, & Storage**: Supabase PostgreSQL 15, Supabase Auth (`@supabase/ssr` cookie-based sessions with middleware refresh and uncached authenticated responses), and private Supabase Storage buckets (`study-materials` max 10 MB; `profile-photos` max 2 MB).
- **Defense-in-Depth Security**:
  - Public self-registration is disabled (`[auth] enable_signup = false`). Accounts are provisioned by administrators.
  - Supports **username or email** login (`resolve_login_email` RPC), logout, self-service password change, email recovery, and administrator password resets (`super_admin` required for privileged accounts).
  - Role checks enforced in both Next.js Server Actions / Route Handlers and PostgreSQL Row-Level Security (RLS) across all 7 roles.
- **Indian Localization & Configurable Board Profiles**:
  - Defaults to `en-IN`, `INR` (`₹`), `Asia/Kolkata`, Classes `I–XII` (`1–12`), and an editable April–March academic session (`2026-2027`).
  - Supports **CBSE, ICSE, WBBSE, WBCHSE (Semester I–II for Class XI and Semester III–IV for Class XII), and Custom** board profiles (with custom display name).
  - *Note*: Board profiles are school-managed assessment templates, not claims of official board certification.
  - Assessment configurations are immutably versioned once used. Published results are stored as permanent revision snapshots, so corrections and later configuration versions never alter historical report cards.
- **Examinations & Report Cards**:
  - Distinguishes **zero (`PRESENT` with `0.00`)**, **absence (`ABSENT` contributing `0` and displayed as `AB`)**, and **missing (`MISSING` blocking publication)**.
  - Supports administrator-opened correction drafts, immutable numbered publication revisions, current/superseded history, stable exam rosters, and revision-specific report-card/tabulation PDFs.
  - Shared competition ranks (`1, 1, 3` for ties) at both section and class levels, multi-term annual weighting, teacher/principal remarks, skill ratings, optional Result-Access PIN gate (`require_result_pin` disabled initially, enforced in PostgreSQL RLS when enabled), printable layouts, and downloadable PDFs.
- **Timetables, Fees, Library, Notices, Calendar, & Study Materials**:
  - Reusable time slots, class & exam timetables, and PostgreSQL trigger (`check_timetable_teacher_conflict`) preventing teacher double-booking.
  - `NUMERIC(12,2)` fee definitions, student invoices, concurrency-safe partial payments (`CASH`, `UPI`, `BANK_TRANSFER`) with `idempotency_key`, overpayment rejection, numbered receipts (`RCP-YYYY-NNNNNN`), and `super_admin`-only audited payment reversals.
  - Completed **Library** module: catalogue, individual barcoded copies (`library_book_copies`), borrow requests, approval/rejection, concurrency-safe checkout (14-day default loan, no automatic fines), return, and overdue tracking.
  - Completed **Notices & Calendar** module: targeted to `SCHOOL`, `ROLES`, or `CLASSES`.
  - Completed **Study Materials** module: private Storage bucket (`study-materials`) with RLS and expiring signed / authenticated download Route Handler.

---

## 2. Demo Credentials (All 7 Roles)

All seeded accounts share the password: **`School@2026`**

| Role | Username | Email | Full Name | Highlights |
|---|---|---|---|---|
| **Super Administrator** | `superadmin` | `superadmin@vidyabharati.edu.in` | Dr. Subir Chatterjee | Full access, school settings, privileged accounts, payment & promotion reversals, audit logs |
| **Administrator** | `admin` | `admin@vidyabharati.edu.in` | Smt. Ananya Sen | Admissions, operational users, classes/subjects, boards, timetables, exam publication, notices |
| **Teacher** | `teacher` | `teacher@vidyabharati.edu.in` | Prof. Debashis Mukherjee | Assigned Class IX–XII Mathematics & Science, bulk marks entry, comments, study materials |
| **Teacher (Humanities)** | `teacher2` | `kavita.sharma@vidyabharati.edu.in` | Ms. Kavita Sharma | Assigned English & Social Science classes and study materials |
| **Accountant** | `accountant` | `accountant@vidyabharati.edu.in` | Shri Rajat Banerjee | Fee structures, student invoices, partial payments, balances, numbered PDF receipts |
| **Librarian** | `librarian` | `librarian@vidyabharati.edu.in` | Ms. Poulomi Ghosh | Library catalogue, barcoded copies, borrow request reviews, 14-day checkouts & returns |
| **Student** | `student` | `student@vidyabharati.edu.in` | Aarav Roy (`VBM-2025-001`) | Class X Sec A (promoted from Class IX); tied Rank #1 in Term I; active loan & partial fee invoice |
| **Parent (Linked)** | `parent` | `parent@vidyabharati.edu.in` | Shri Vikram Roy | Linked to Aarav Roy (Class X) & Ishita Bose (Class XI WBCHSE); views children's results, fees, notices |
| **Parent (Second)** | `parent2` | `meera.sen@vidyabharati.edu.in` | Smt. Meera Sen | Linked only to Diya Sen (`student2`); isolated from other students by PostgreSQL RLS |

**Seeded Result-Access PINs** (for testing when *Require Result-Access PIN* is enabled in `/settings`):
- `VBM26-78901-ABCDEF`
- `VBM26-12345-GHIJKL`
- `VBM26-55555-XYZ123`

---

## 3. Local & LAN Development Startup

### Prerequisites
- Node.js 20+ and npm
- Docker Desktop (running both the existing Laravel v1 containers on ports `8000`/`3307` and the isolated v2 Supabase stack on ports `54321`–`54324`)

### Environment Variables (`.env`)
Copy `.env.example` to `.env`:
```ini
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local_supabase_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<local_supabase_service_role_key>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
NEXT_PUBLIC_APP_URL=http://localhost:4100
```

### One-Command Database Setup & Seeding
```bash
# Start local Supabase stack (if not already running)
npx supabase start

# Apply all SQL migrations and seed repeatable demo data + Storage files
npm run setup
```

Individual database scripts:
- `npm run db:migrate`: Applies versioned SQL migrations in `supabase/migrations/` idempotently.
- `npm run db:seed`: Resets and seeds all 7 roles, Classes I–XII, all 5 Indian board profiles, exams, timetables, fees, library copies, notices, and PDF study materials.
- `npm run db:types`: Regenerates `src/lib/database.types.ts` from the local Supabase schema.

### Starting the Next.js Server
```bash
# Local development (http://localhost:4100)
npm run dev

# LAN development accessible to other devices on the local network (0.0.0.0:4100)
npm run dev:lan

# LAN production server after `npm run build`
npm run start:lan
```

### Running Automated Verification Suites
```bash
# TypeScript check & ESLint
npm run typecheck
npm run lint

# Vitest unit calculation + PostgreSQL RLS & concurrency integration tests
npm test

# Production build
npm run build

# Playwright End-to-End browser tests (Desktop & Mobile)
npm run test:e2e
```

---

## 4. Free Hosted Demo Deployment Guide (Vercel Hobby + Supabase Free)

### Step 1: Provision Supabase Free Project
1. Create a new project on [Supabase](https://supabase.com/) (Free Plan) in the **Mumbai (`ap-south-1`)** region.
2. In **Authentication -> Providers -> Email**, keep Email enabled, disable *Confirm email* for demo accounts, and under **Authentication -> User Signups**, disable **Allow new users to sign up** (public registration disabled).
3. Copy your project's `DATABASE_URL` (Session Pooler or Direct URI), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
4. Apply the migrations and seed demo data against your hosted Supabase instance:
   ```bash
   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" \
   NEXT_PUBLIC_SUPABASE_URL="https://[ref].supabase.co" \
   SUPABASE_SERVICE_ROLE_KEY="[service_role_key]" \
   npm run setup
   ```

### Step 2: Deploy to Vercel Hobby (`v2` Root Directory)
1. Push the repository to GitHub/GitLab/Bitbucket and import it into [Vercel](https://vercel.com/).
2. Set **Root Directory** to `v2`.
3. Configure the Environment Variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Server-only; never prefix with `NEXT_PUBLIC_`)
   - `NEXT_PUBLIC_APP_URL` (e.g., `https://your-school-v2.vercel.app`)
4. Deploy.

### Free-Tier Operational Constraints & Manual Backup Procedure
- **Vercel Hobby Plan**: Restricted to personal, non-commercial demonstration use.
- **Supabase Free Plan Limits**:
  - **500 MB** PostgreSQL database storage limit.
  - **1 GB** Supabase Storage limit.
  - **Inactivity Pause**: Free-tier Supabase projects pause after **7 days of inactivity** and can be resumed from the Supabase Dashboard.
  - **No Automatic Backups**: Free-tier projects do not include automated point-in-time or daily backups. Perform manual backups before major changes using `pg_dump`:
    ```bash
    # Manual Backup
    pg_dump "$DATABASE_URL" --format=custom --file="v2_backup_$(date +%Y%m%d).dump"

    # Manual Restore
    pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "v2_backup_YYYYMMDD.dump"
    ```

---

## 5. Feature-Completion Checklist

- [x] **Preserved Laravel v1 (`lav_sms`)**: Running v1 application and database remain untouched while v2 runs independently in `v2/`.
- [x] **Next.js App Router + TypeScript + Tailwind + `shadcn/ui`**: Pinned dependencies in `package.json` and independent `package-lock.json`.
- [x] **Supabase Auth (`@supabase/ssr`)**: Cookie-based session refresh, uncached authenticated reads, username/email login, logout, self password change, password recovery, and administrator password resets. Public registration disabled.
- [x] **Seven-Role RBAC + PostgreSQL RLS**: `super_admin`, `admin`, `teacher`, `accountant`, `librarian`, `student`, `parent` enforced in Server Actions, Route Handlers, and PostgreSQL RLS.
- [x] **School Administration**: Student admission, staff & user management, explicit `parent_student_links`, classes (`I–XII`), sections, subjects, teacher assignments, hostels, school settings, profile photographs, and audit log.
- [x] **Promotion, Retention, Graduation & Reversal**: Preserves multi-year enrollment history; blocks `super_admin` reversal (`PROMOTION_REVERSAL_BLOCKED`) when downstream marks, fee payments, or later promotions exist.
- [x] **Indian Localization & 5 Board Profiles**: `INR` (`₹`), `en-IN`, `Asia/Kolkata`, April–March academic year, and selectable `CBSE | ICSE | WBBSE | WBCHSE | CUSTOM` profiles (including WBCHSE Semester I–II for Class XI and Semester III–IV for Class XII) with immutable versioning once used.
- [x] **Examinations & Report Cards**: Distinguishes zero (`0`), absence (`AB` -> `0`), and missing (`MISSING` blocks publication); enforces component minima; preserves immutable numbered revisions and correction drafts; shared competition ranks (`1, 1, 3`); term weighting; optional Result-Access PINs; revision-specific printable views and PDFs.
- [x] **Timetables & Conflict Validation**: Reusable time slots, class & exam schedules, teacher double-booking prevention trigger, and PDF export.
- [x] **Fees, Partial Payments, Receipts & Reversals**: `NUMERIC(12,2)` invoices, `CASH | UPI | BANK_TRANSFER` partial payments, idempotency keys, row-locked concurrency safety, numbered receipts (`RCP-YYYY-NNNNNN`), PDF download, and `super_admin` audited payment reversal.
- [x] **Completed Library Module**: Catalogue, individual barcoded copies, borrow requests, approval/rejection, concurrency-safe 14-day checkouts (no automatic fines), returns, and overdue list.
- [x] **Completed Notices, Calendar & Study Materials**: Role/class/school-targeted announcements and events; private Supabase Storage (`study-materials` <= 10 MB, `profile-photos` <= 2 MB) with RLS and signed/authenticated downloads.
