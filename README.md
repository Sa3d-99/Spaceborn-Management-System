# Spaceborn Management System

Internal operations and employee management portal for tracking daily tasks, attendance, leave requests, and team performance.

## Signing in and requesting an account

Sign in with your registered email or employee ID. New members select **Request an account**. The CEO reviews requests under **Signup requests**. The CRM saves requests even if email is unavailable and emails the administrator when delivery is configured. Approval requires Resend settings so the applicant can receive a single-use link to set a password and get Intern access.

For a local demo, start with `SEED_DEMO_DATA=true` and an empty database. The demo CEO email is `john.doe@spaceborn.com`, employee ID `CEO001`, and password `admin123`. Keep the demo bound to your local machine.

## Features

### Date & Time Tracking
- **Date-wise Daily Work Reports:** Employees submit daily standup summaries, completed work, and blockers. Managers can filter and browse submissions day-by-day using an interactive date picker.
- **Attendance Clock-In & Clock-Out:** Real-time timestamp logging for check-in and check-out, automatically calculating daily working hours.
- **Hour Break Logging:** Shift break tracker that records break start time, end time, and total accumulated break duration.
- **Attendance History & Calendar:** Day-by-day logs showing attendance status (Present, Absent, On Leave, Late) alongside official company holidays.

### Task & Project Management
- **Task Assignment:** Create and assign tasks with descriptions, assignees, target due dates, and department tags.
- **Priority & Status Tracking:** Filter tasks by priority (Low, Medium, High, Urgent) and lifecycle state (Pending, In Progress, Review, Completed).
- **Project Roadmaps & Milestones:** Track active company projects, target delivery deadlines, and milestone completion percentages.

### Leave & Time-Off Management
- **Leave Requests:** Apply for leave by specifying start date, end date, total days, reason, and leave type (Casual, Sick, Annual, Emergency).
- **Balance Tracking:** Automatic calculation of allocated, used, and remaining leave days for each employee.
- **Approval Workflow:** Managers and team leads can review, approve, or reject pending leave applications with status notifications.

### Meeting Scheduling
- **Meeting Planner:** Schedule team and departmental meetings with date, start time, duration, location/link, and agenda.
- **Attendee Tracking:** View scheduled meetings and participant lists directly on the dashboard calendar.

### Executive & Resource Management
- **Executive Decisions:** Timestamped registry for leadership decisions, policy updates, and strategic announcements.
- **Resource Allocation:** Request hardware, software licenses, or equipment with date tracking and approval status.
- **Company Health & Metrics:** Overview of active headcounts, department capacity, open risks, and attendance rates.

### Role-Based Access
- **CEO & COO:** Full organizational visibility, strategic metrics, executive decisions, and company health overview.
- **Manager:** Team task tracking, date-wise report reviews, employee roster, and leave approvals.
- **Team Lead:** Team task delegation, standup reviews, and resource requests.
- **Member (Employee):** Clock-in/out, daily work report submission, personal tasks, and leave applications.

### Database Architecture
- **Local Development:** Uses embedded PostgreSQL (PGlite) stored in `backend/data/spaceborn_pgdata/`. No external database installation or Docker container required.
- **Production:** Automatically connects to managed PostgreSQL (e.g. Render, Supabase, AWS RDS) when `DATABASE_URL` is configured.

## Running Locally

Use Node.js 26 LTS and npm 12. The pinned Node release is in [.nvmrc](.nvmrc). The app uses Express 5, React 19, Vite 8, Tailwind CSS 4, DaisyUI 5, Font Awesome 7, and PostgreSQL 19.

### Run Production Build (Single Port)

Builds the React frontend and serves both the API and client from port 5000:

```bash
# Install dependencies and build frontend
npm run build

# Start the server
npm start
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

### Development Mode

Run backend and frontend separately with hot-reloading:

```bash
# Terminal 1 - Backend API (port 5000)
npm run dev:backend

# Terminal 2 - React Dev Server (port 3000)
npm run dev:frontend
```

## Deployment (Render)

This project can be deployed as a unified web service with a managed PostgreSQL database.

### Using Render Blueprint

1. Push this repository to GitHub.
2. In [Render](https://dashboard.render.com), go to **New** > **Blueprint**.
3. Select this repo. Render will read `render.yaml` and set up:
   - A Node.js web service that runs the backend API.
   - A free PostgreSQL database linked via `DATABASE_URL`.
4. Click **Apply**.

### Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Web server port | `5000` |
| `DATABASE_URL` | PostgreSQL connection string. If omitted, uses local embedded PGlite. | `""` |
| `JWT_SECRET` | Secret key for signing auth tokens | Required in production and Docker |
| `JWT_EXPIRE` | Auth token duration | `"24h"` |
| `PG_POOL_MAX` | Maximum PostgreSQL connections opened by this service | `2` |
| `APP_URL` | Public frontend origin used for links in email | Local Docker app URL |
| `RESEND_API_KEY` | Server-side Resend sending key | |
| `RESEND_FROM_EMAIL` | Sender address on a domain verified in Resend | |
| `SIGNUP_ADMIN_EMAIL` | Inbox for signup review emails | First active CEO email |
| `TRUST_PROXY_HOPS` | Number of trusted reverse-proxy hops for client-IP rate limits | `0` |

The frontend can be hosted separately on Vercel. In that case, set the Vercel
build environment variable `REACT_APP_API_URL` to the Render service URL ending
in `/api`, then redeploy the frontend. The Render service only installs backend
production dependencies and runs the API. Node's old-space limit is set to 320
MiB to leave room under Render's 512 MiB instance limit for native memory and the
PostgreSQL client. Google Drive's SDK is loaded only when a Drive upload runs.

## Deployment with Docker Compose

Docker Compose runs the complete application: the React frontend and Express API are served together by the app container, with PostgreSQL in a separate container. Database files and uploaded attachments are kept in named volumes.

Docker Compose, the local backend and its scripts, and Vite all read the root `.env`. From a fresh checkout, create that file from the project root with private permissions and unique secrets.

```sh
(
  umask 077
  set -C
  cat > .env <<EOF
APP_PORT=127.0.0.1:5000
APP_URL=http://localhost:5000
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 32)
SEED_DEMO_DATA=false
RESEND_API_KEY=
RESEND_FROM_EMAIL=
SIGNUP_ADMIN_EMAIL=
EOF
)
```

Start the application with `./start.sh`. The launcher builds and starts Compose, waits for the app and database to be healthy, and prints the URL even when the services were already running. Leave the command running while you use the CRM. Press Ctrl+C in that terminal to stop the app and database.

Keep server secrets in unprefixed variables such as `JWT_SECRET` and `RESEND_API_KEY`. Frontend settings use the `REACT_APP_` prefix and are visible to browser users. Docker passes the supported frontend settings to Vite at build time.

Set `APP_PORT` and `APP_URL` in `.env` when changing the host port. Use `docker compose down` to remove the containers while keeping the database and uploads.

For a local demo, set `APP_PORT=127.0.0.1:5000`, `APP_URL=http://localhost:5000`, and `SEED_DEMO_DATA=true` before the first start. Existing PostgreSQL 16 volumes and PGlite PG18 data require a logical migration. See the [database upgrade guide](docs/database-upgrade.md).

### Separate frontend and backend deployments

When the React frontend is deployed separately (for example, on Vercel), set the frontend build environment variable `REACT_APP_API_URL` to the backend's public API base URL, including `/api` (for example, `https://your-api.example.com/api`). Set it in the frontend hosting project's production environment and redeploy; React embeds this value at build time. The backend must be reachable over HTTPS. You can check it at `<backend-origin>/api/health` before testing login.

For a backend deployed on Vercel, set the Vercel project root directory to `backend` and configure `DATABASE_URL` to a reachable managed PostgreSQL database. Vercel functions do not provide persistent storage for the local PGlite database. Configure `JWT_SECRET` there as well.

## Resend email

Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `APP_URL` in the root `.env`. Use a public HTTPS frontend origin when recipients open links from another device. Set `SIGNUP_ADMIN_EMAIL` if the review inbox differs from the first active CEO account. Start Compose with `./start.sh` to apply the settings.

`Spaceborn Accounts <onboarding@resend.dev>` can send test mail to the Resend account's email address. To reach employee inboxes, set `RESEND_FROM_EMAIL` to an address on a domain verified for sending and use a key with permission for that domain. [Resend 403 guidance](https://resend.com/changelog/improved-logs-visibility)

**Forgot password** is available from sign-in and directly at `/forgot-password`. The Spaceborn email includes a **Reset Password** button and a plain-text fallback. The link expires after 30 minutes and can be used once. The reset page validates the link before showing the password form and offers a fresh request when the link is invalid, expired, or used. A successful reset revokes older sessions. New passwords accept 15–128 characters and passphrases.

When the CEO approves a signup, Resend sends the applicant their employee ID and a **Create Password** button. The link opens the same password form and expires after 30 minutes. If delivery fails or the link expires, the CEO can select **Resend setup link** in **Signup requests**.

For a Vercel-hosted frontend, set the API's `APP_URL` to the frontend's public HTTPS origin. Keep the Resend key and sender in the API environment, and build the frontend with `REACT_APP_API_URL` set to that API's HTTPS address ending in `/api`. The frontend's Vercel rewrite serves both recovery URLs directly. Keep click tracking disabled so reset links lead straight to the CRM. [Resend tracking settings](https://resend.com/blog/open-and-click-tracking)

## Importing Real Employees from Excel

The seeded users are demo data. To load your actual staff list:

**From the web app (CEO / COO / Manager):** Employee Database → **Import from Excel** → choose the `.xlsx` or `.csv`. You get a preview showing who will be created, who already exists, and which rows have problems (missing/invalid email, duplicates). Click **Import**, then **Download login credentials** — each new employee gets a random temporary password that is shown only once.

**From the command line (bulk / first-time load, works against local PGlite or Render via `DATABASE_URL`):**

```bash
npm install --prefix backend
npm run import:employees -- ./employees.xlsx                  # preview only, nothing written
npm run import:employees -- ./employees.xlsx --commit         # write to the database
npm run import:employees -- ./employees.xlsx --commit --update  # also update existing employees
```

The CLI writes `employee-credentials-<timestamp>.csv` next to the sheet (git-ignored). Share it privately, then delete it.

**Sheet format.** Only a name and an email column are required. Common headings are recognised automatically (`Employee Name`, `Official Email ID`, `Mobile No`, `Dept`, `Designation`, `Reporting Manager`, `Date of Joining`/`DOJ`, `DOB`, `Emp Code`, `Status`, …), title rows above the header are skipped, and unknown columns are kept under `additionalInfo`. Dates may be Excel dates, `DD/MM/YYYY` or `YYYY-MM-DD`; 10-digit phone numbers get a `+91` prefix.

- **Role** column sets access. Spaceborn titles map to the app's permission levels. `CEO` → CEO, `Director` → COO, `Team Lead` → Team Lead, `Co-Lead` → CO Head, `Project Manager` → Manager, `HR` / `Coordinator` → HR, and `Intern` → Member. The app displays the Spaceborn titles. Without a Role column, the import can infer leadership from explicit designations and otherwise uses Intern.
- **Employee ID** is optional; missing IDs are generated (`INT001`, `LD002`, `DIR001`, `PM001`, …) after the highest existing number.
- Employees are matched by Employee ID, then email. Re-running the same sheet is safe: existing people are skipped unless `--update` / "Update employees that already exist" is chosen. Passwords are never changed by an update.
- **Reporting Manager** (name, employee ID or email) is linked to that person's record when they exist in the system.
- Directors can import roles below Director. Project Managers and HR can import Interns.

### Starting fresh (removing the example data)

The example users (John Doe, Jane Smith, …) are no longer created automatically. Set `SEED_DEMO_DATA=true` if you want them for a demo, or run `npm run seed`.

To clear an existing database (local, or Render when `DATABASE_URL` is set) and load the real team:

```bash
npm run db:reset -- --yes                                   # deletes ALL data; cannot be undone
npm run import:employees -- ./Team_Data_CLEAN.xlsx --commit
```

Departments are defined once in `backend/src/config/departments.js` (and mirrored in `frontend/src/utils/departments.js`), including the spelling variants that get cleaned up on import.

## Project Structure

```text
Spaceborn-Management-System/
├── backend/
│   ├── server.js          # Express app entrypoint
│   ├── seed.js            # Default seed data
│   └── src/
│       ├── app.js         # API routes + static frontend handler
│       ├── config/db.js   # PGlite / PostgreSQL connection
│       ├── controllers/   # Route handlers
│       ├── models/        # PostgreSQL data models
│       └── routes/        # Express API endpoints
├── frontend/
│   ├── src/               # React components and pages
│   └── public/            # Static assets
├── package.json           # Root build and run scripts
└── render.yaml            # Render deployment config
```



## Tests and project knowledge

Run `npm test --prefix backend` and `npm test --prefix frontend` after installing dependencies. The [CRM knowledge base](docs/knowledge-base/crm.md) records workflows and outstanding decisions. The local Graphify outputs are in `graphify-out/`, with the Obsidian vault in `graphify-out/obsidian/`.
