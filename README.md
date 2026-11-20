# Spaceborn Management System

Internal operations and employee management portal for tracking daily tasks, attendance, leave requests, and team performance.

## Logging In

Accounts are created from the team sheet (see **Importing Real Employees from Excel** below). Each person's Employee ID and temporary password are in the `employee-credentials-*.csv` file the import creates. Employee IDs look like `CEO001`, `DIR001`, `LD001`, `PM001`, `INT001`.

The old demo accounts (CEO001 / admin123, etc.) only exist if the database is started with `SEED_DEMO_DATA=true` or `npm run seed` is run.

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

Requires Node.js 18 or higher.

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
| `JWT_SECRET` | Secret key for signing auth tokens | `"spaceborn-secret-key"` |
| `JWT_EXPIRE` | Auth token duration | `"24h"` |
| `PG_POOL_MAX` | Maximum PostgreSQL connections opened by this service | `2` |

The frontend can be hosted separately on Vercel. In that case, set the Vercel
build environment variable `REACT_APP_API_URL` to the Render service URL ending
in `/api`, then redeploy the frontend. The Render service only installs backend
production dependencies and runs the API. Node's old-space limit is set to 320
MiB to leave room under Render's 512 MiB instance limit for native memory and the
PostgreSQL client. Google Drive's SDK is loaded only when a Drive upload runs.

## Deployment with Docker Compose

Docker Compose runs the complete application: the React frontend and Express API are served together by the app container, with PostgreSQL in a separate container. Database files and uploaded attachments are kept in named volumes.

1. Copy `.env.docker.example` to `.env` and set strong, unique values for `POSTGRES_PASSWORD` and `JWT_SECRET`.
2. Start the application with `docker compose up --build -d`.
3. Open `http://localhost:5000`. The API health endpoint is `http://localhost:5000/api/health`.

Set `APP_PORT` in `.env` to change the host port. To stop the containers while preserving database and upload data, run `docker compose down`. To remove that data too, run `docker compose down --volumes`.

### Separate frontend and backend deployments

When the React frontend is deployed separately (for example, on Vercel), set the frontend build environment variable `REACT_APP_API_URL` to the backend's public API base URL, including `/api` (for example, `https://your-api.example.com/api`). Set it in the frontend hosting project's production environment and redeploy; React embeds this value at build time. The backend must be reachable over HTTPS. You can check it at `<backend-origin>/api/health` before testing login.

For a backend deployed on Vercel, set the Vercel project root directory to `backend` and configure `DATABASE_URL` to a reachable managed PostgreSQL database. Vercel functions do not provide persistent storage for the local PGlite database. Configure `JWT_SECRET` there as well.

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

- **Role** column sets access. Spaceborn titles map to the app's permission levels: `CEO` → CEO, `Director` → COO (full access), `Team Lead` / `Co-Lead` → Team Lead, `Project Manager` → Manager (can add/remove people, approve leave), `HR` → HR, `Intern` → Member. The app shows the Spaceborn titles everywhere (see `frontend/src/utils/roleLabels.js`). Without a Role column everyone is imported as Intern.
- **Employee ID** is optional; missing IDs are generated (`INT001`, `LD002`, `DIR001`, `PM001`, …) after the highest existing number.
- Employees are matched by Employee ID, then email. Re-running the same sheet is safe: existing people are skipped unless `--update` / "Update employees that already exist" is chosen. Passwords are never changed by an update.
- **Reporting Manager** (name, employee ID or email) is linked to that person's record when they exist in the system.
- COO cannot import a CEO; Managers and HR cannot import CEO/COO.

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


