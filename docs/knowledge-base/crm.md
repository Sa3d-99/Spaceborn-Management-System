# CRM workflows

Spaceborn's internal CRM manages attendance, meetings, leave, resource requests, and employee access. Express serves the API and the Vite-built React interface. PostgreSQL stores operational data and PGlite supports local development. The [root README](../../README.md) lists setup, demo access, and Resend settings. The [database upgrade guide](../database-upgrade.md) covers existing databases.

Docker Compose, backend entry points, and Vite use a single git-ignored root `.env`. The backend receives server settings at runtime. Vite reads public `REACT_APP_` settings, which Compose supplies as build arguments for Docker. The `./start.sh` launcher prints `APP_URL` after both services become healthy, including when they were already running, and stops both services on Ctrl+C.

## Authentication and signup

- On reload, the app verifies the saved token with `GET /api/auth/verify` before showing the dashboard. It restores the previous section for the current tab, URL path, verified account, and role. An HTTP 401 response returns to sign-in. A temporary check failure offers a retry. Signup and password recovery links open their forms directly.
- Auth routes support employee ID or email login, password reset, profile time zones, and public signup. The signup controller saves one request per normalized email even when Resend or the review inbox is unavailable. An active CEO reviews requests from the dashboard. The administrator inbox is configurable through `SIGNUP_ADMIN_EMAIL`. A pending request can trigger its first review email on resubmission after email is configured. Approval requires Resend settings, creates the Member account with a pending department assignment, and sends its registered email a branded **Create Password** link. An unfinished setup link can be resent. **Approve again** is available when the linked account is missing and the applicant email is available. **Delete request** removes the queue record while preserving the employee account.
- The password reset service stores a temporary token digest separately from the user record. The branded email template includes an HTML button and matching plain-text link. The `/reset-password` page takes the token from the URL fragment, clears it from the address bar, and checks it through a read-only POST before inviting the user to choose a password. One database update consumes the token, replaces the password, and applies the pending department during initial signup setup. The setup page signs in using the normal credential endpoint and opens **My Team**. The team roster uses the authenticated member’s department. Other password resets revoke older sessions and return to sign-in.
- The shared server-side email service uses `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `APP_URL` to send password reset, signup review, and account setup emails via Resend. Compose passes these settings to the backend at runtime.
- The Resend sandbox sender can reach the Resend account email and documented test addresses. Employee delivery requires an address on a verified sending domain and a key with sending permission for that domain. Server-side HTTP 403 diagnostics identify the sender requirement without including recipient addresses or credentials.
- The Docker demo seeds an empty database when `SEED_DEMO_DATA=true`. Password reset and signup integration tests use an isolated database and a Resend API stub.

## Attendance and approvals

- Sign-in is available at any time. Attendance uses the signed-in user's identity after authentication.
- Business dates and meeting entry use `Asia/Kolkata`. The first company or department meeting defines the attendance cutoff. A check-in more than five minutes after that start is late. Users can choose their display zone and attendance still follows the India schedule.
- Past sick leave is accepted. Leave requests use the signed-in identity and are stored in the database. Existing Director leave review is limited to lower roles. Project Manager reviews are scoped to their department.
- HR receives intern hour-break and resource requests. The relevant Team Lead and Project Manager may review them, as may higher leadership. Self-approval is blocked. Older Team Lead records with a Co-Lead designation are treated as Co-Leads.
- Team Leads can deactivate access in their department. HR and executives can deactivate within their role scope. Co-Lead access excludes deactivation and termination.

## Task management

- CEOs, Directors, and Project Managers can edit and delete tasks. Team Leads and Co-Leads can manage tasks within their department. Assignees can update progress on their own tasks.
- Task creation timestamps come from the server. New or changed due dates must be today or later in `Asia/Kolkata`. An existing overdue task can be edited while retaining its due date.

## Decisions pending

HR must supply leads for Operations & Management, Creative & Marketing, Business & Partnerships, ANSA, and Founding Team. Leadership needs to confirm the final Director leave matrix and the rollout for company email and mandatory two-factor authentication.

## Local knowledge files

Graphify writes `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md`. Open `graphify-out/obsidian/` as the Obsidian vault. This Markdown note is the durable workflow reference.
