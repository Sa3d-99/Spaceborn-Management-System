# Saad’s Spaceborn CRM checklist

This checklist covers Saad’s 57 assigned bugs from *Spaceborn CRM — Saad, Rahul, Mahmoud*, PDF pages 2–32. The shared SRS v1.1 is on pages 67–82. See [CRM workflows](./crm.md) for the current architecture.

## 1. Critical

- [x] **BUG-009** Require authentication on every daily-report route. The focused regression reproduced the open read and now passes for all eight routes.

## 2. Major

### Reports

- [x] **BUG-023** Enforce report ownership and team scope. An Intern receives 403 for access to another employee’s report.
- [x] **BUG-029** Derive report author, employee identity, and department from the authenticated account.
- [x] **BUG-034** Validate required report fields and lengths. Accept submissions for today’s IST business date.
- [x] **BUG-063** Show real report counts and submission rates for the selected date and department.
- [x] **BUG-064** List who submitted and who missed a report within the reviewer’s scope.

### Sign-in, passwords, and CORS

- [x] **BUG-015** Lock the account for 15 minutes after five failed sign-in attempts on the server. The fifth failure locks the account across employee ID and email aliases.
- [x] **BUG-024** Retest that refresh restores the signed-in session and current dashboard section. The frontend restores the session and dashboard section on refresh.
- [x] **BUG-040** Store and display Co-Lead separately from Team Lead and enforce its permissions. Sign-in stores and returns the separate Co-Lead role. Administrative action tests enforce its limits.
- [x] **BUG-061** Return to sign-in when the session expires or is revoked during normal app use. A revoked session returns to sign-in when the active page checks the token. The UI preserves the remembered identifier.
- [x] **BUG-148** Give HR the assigned menu, including Employee Database, Excel Import, and Attendance. Chrome verifies the HR employee database, Excel import and role-specific navigation. API tests verify HR attendance access.
- [x] **BUG-014** Provide a working Change Password form in My Profile. Chrome verified a password change from My Profile, sign-out, and sign-in with the new password.
- [x] **BUG-018** Remove plaintext passwords from ordinary API responses, public browser bundles, and server logs. API regression tests verify that account, signup, and setup responses omit passwords. The production bundle scan found no known demo passwords, mock token, or configured server secret values.
- [x] **BUG-020** Require a new password at first use of a temporary credential, before opening the dashboard. A legacy temporary credential permits password change only. The API and UI tests verify the gate and successful full sign-in after the change.
- [x] **BUG-048** Let HR reset passwords and terminate employees within its authorized scope. The focused HR test sends an Intern a reset link through the Resend stub and terminates the account.
- [x] **BUG-050** Enforce the three-per-hour forgot-password limit per employee ID. Keep account-existence responses uniform. Four requests in one hour produce three sends. Active, inactive, and unknown accounts receive the same public message.
- [x] **BUG-133** Apply the SRS password rules and 8–64 character limits at each password entry point. API tests cover 8-character passwords, 65-character rejection, unsafe phrases, Unicode, and reuse of the current password.
- [x] **BUG-060** Restrict production CORS to the authorized CRM frontend. Verify both direct and preflight requests.

### Employees and uploads

- [x] **BUG-031** Validate employee names, email, phone, designation, and join date in the form and API. API tests cover invalid inputs and duplicates. Chrome completed creation and editing through the validated form.
- [x] **BUG-038** Accept supported documents up to 10 MB. Return a clear size error for larger employee or roadmap uploads. Both routes returned 201 for exactly 10 MiB and 413 above it. The employee test used a Drive stub.
- [x] **BUG-046** Show real counts and team assignments in Teams & Roles and Accounts. The API counted actual employee records, and Chrome displayed the created account and the corresponding Teams & Roles assignments.
- [x] **BUG-074** Allocate role-prefixed employee IDs without reuse after termination or concurrent creation. Termination and concurrent creation regression checks preserve the role-prefixed counter.
- [x] **BUG-075** Email a single-use password setup link when an authorized administrator adds an employee. The integration and Chrome tests confirm a one-time setup email, successful sign-in after password creation, and rejection on reuse. Resend was stubbed.
- [x] **BUG-115** Resolve the account-stats and task daily-log errors. Return data or a clear JSON client error. Integration tests cover account counts and task daily logs, including tasks without an existing log array.
- [x] **BUG-119** Block Intern access to broad employee directories while providing their scoped team view. Directory requests from an Intern are denied. Signup and team tests verify access to My Team.
- [x] **BUG-130** Restore Project Manager activation, deactivation, and termination rights for employees below Director. The integration suite checks Project Manager activation, deactivation, and termination permissions.
- [x] **BUG-131** Block Team Lead and Co-Lead employee deactivation and termination at the API. Integration tests deny employee lifecycle changes to Team Lead and Co-Lead.
- [x] **BUG-136** Display deactivated employees as inactive and offline. The deactivation regression verifies Inactive, offline, and activated states. The directory and accounts use the server status.
- [x] **BUG-145** Match the approved employee creation rights for Director, Project Manager, and HR. The role matrix tests verify Director, Project Manager, and HR creation and block additional Directors except when created by the CEO.

### Activity and import performance

- [x] **BUG-062** Show real login and attendance activity and verify the export matches. The recorded activity suite and Chrome verify real sign-ins, attendance, and Excel export. The frontend suite also checks CSV.
- [x] **BUG-078** Benchmark a 2,000-row import against the 30-second limit and deployment memory limit. A 2,000-row .xlsx against PostgreSQL in Docker previewed in 157 ms and committed in 149 ms. The process peaked at 146.9 MiB in a 512 MiB container.

## 3. Minor

### Sign-in and passwords

- [x] **BUG-097** Return a validation message for a login password longer than 64 characters. The API returns HTTP 400 for login passwords above 64 characters.
- [x] **BUG-099** Display the IST shift as information and allow sign-in at any time. The sign-in UI shows the informational shift. An integration test signed in successfully at 3:00 AM IST.
- [x] **BUG-125** Keep the employee ID remembered after logout until the user clears the option. The active-session and logout tests retain the remembered employee ID. Unchecking Remember me clears it.
- [x] **BUG-134** Expire reset links 15 minutes after issuance. The recovery test verified a 900-second database expiry and rejection after expiry.
- [x] **BUG-140** Send a password-reset confirmation email and create the corresponding notification. The reset integration verifies one confirmation email and one notification after successful redemption.
- [x] **BUG-144** Apply the agreed bcrypt policy while keeping existing hashes verifiable during migration. A legacy scrypt hash was verified and upgraded on sign-in. A new password was stored as bcrypt cost 12.

### Employee records and imports

- [x] **BUG-081** Save optional date of birth and validate age on the join date. API tests cover DOB age limits. Chrome verified that the saved DOB reappears during editing.
- [x] **BUG-096** Display the correct leave balance, reporting manager, and last sign-in. The detail integration test verifies the persisted leave balance, referenced manager, and last sign-in. The Employee Database displays these fields.
- [x] **BUG-105** Limit search text to 100 characters and match special characters literally. The API accepted a literal bracket and rejected a 101-character query. Employee, Accounts, and Teams & Roles search fields enforce the limit.
- [x] **BUG-126** Keep former-employee history attributable after termination. Verify attendance and notification retention. The termination test verified retained attendance linked to the former employee and removal of their orphaned notifications.
- [x] **BUG-141** Apply the shared Intern ID format to new CEO-approved signups. The approved signup flow verifies a shared INT-prefixed employee ID and successful first sign-in.
- [x] **BUG-108** Recognize “E-mail Address” and the supported import headers. The CSV test and browser import verified E-mail Address and header detection below the title row.
- [x] **BUG-109** Reject import files above 5 MB with a clear size message. The multipart endpoint returned 413 for a file over 5 MiB, and the browser uses the same bound.
- [x] **BUG-110** Accept .xlsx and .csv. Reject unsupported extensions, including .xls. CSV and a multi-sheet .xlsx passed. The multipart test rejected .xls.

### Reports and system screens

- [x] **BUG-129** Use the same validation and same-day update behavior for Team Lead reports.
- [x] **BUG-082** Add Login Management for authorized roles and remove the obsolete Password Reset Requests menu item. Chrome and the frontend suite verify Login Management in the Project Manager sidebar.
- [x] **BUG-084** Make the logo open the dashboard and support browser Back and Forward within the app. Chrome verifies the logo and browser Back and Forward.
- [x] **BUG-101** Use Spaceborn role labels throughout menus, records, filters, and messages. Chrome verified the Spaceborn labels across the controlled dashboard pages for Project Manager and CEO, along with the Co-Lead sidebar.
- [x] **BUG-102** Return a JSON 404 for unknown API routes.
- [x] **BUG-117** Require authentication and role authorization on menu routes.
- [x] **BUG-137** Show the HR user’s name, role, and department on the dashboard profile card. Chrome verifies the HR profile with name, role and department.
- [x] **BUG-138** Show one user block and keep Logout visible in Team Lead, Co-Lead, Intern, and HR sidebars. The frontend suite verifies one sidebar account block and a visible Logout action.
- [x] **BUG-142** Align validation and authorization messages with the documented flows. HTTP regressions verify required sign-in fields, required and malformed recovery identifiers, invalid reset links, and clear permission errors.
- [x] **BUG-143** Add online status, attendance action, and working hours to the header. Put time-zone preferences in My Profile. Chrome verifies online status, attendance action, working hours and the profile time-zone setting.
- [x] **BUG-147** Show the role badges in company order. The frontend suite checks the company role badge order.
- [x] **BUG-149** Remove production debug messages containing user details and verify dashboard requests resolve. The complete Project Manager sidebar sweep in Chrome produced no first-party 4xx or 5xx, uncaught page errors, or user-detail debug output.

## 4. SRS and release checks

- [x] Verify TOTP enrollment, codes, backup codes, and authorized recovery under AUTH-013 and AUTH-014. Chrome verified ten backup codes and complete hyphenated code entry. API tests covered reuse, the five-code lock, and authorized recovery.
- [x] Verify login attendance, logout invalidation, live sessions, and role enforcement in the UI and API. Chrome and the HTTP suite checked these flows.
- [x] Verify import preview and commit, header detection, duplicate handling, row errors, update rules, and one-time credential delivery. Focused tests verify row numbers and preserved credentials on update. Chrome verified the preview and commit actions.
- [x] Verify daily-report notifications and one report per employee and IST date, including concurrent submissions and existing data. The API test checked the notification scope. Docker PostgreSQL archived the old duplicate and preserved the latest report across restart.
- [x] Verify database constraints and migrations, JSON errors, real dashboard data, and HTTPS production configuration. PostgreSQL and browser checks used isolated instances. The Render and Vercel deployment settings were reviewed locally.
- [x] The full suites passed with 87 backend and 15 frontend tests. Chrome covered the core flows. Firefox verified sign-in and refresh. Compose verified the public recovery pages, the database migration across restart, and that Ctrl+C stops both services.

## Retest limits

- All bug checks used disposable local data. The Resend and Google Drive integrations were exercised with test responses. Live delivery measured against production credentials remains unverified.
- Chrome and the Firefox sign-in smoke test ran at 1366×768 on Linux. The Windows compatibility matrix and Microsoft Edge remain unverified.
- The changes are local to `fix/saad-crm-backlog`. Production still needs to be deployed from reviewed changes. Authenticator enrollment remains staged behind `REQUIRE_TWO_FACTOR_AUTH`.

## Confirmed decisions and dependencies

- Deliver one-time password setup links by email. Keep passwords out of ordinary API responses, credential downloads, and logs.
- Assign Director creation to the CEO. Director, Project Manager, and HR can create employees below Director under the role matrix.
- Roll out authenticator enrollment through an opt-in production setting.
- Preserve the existing CEO-approved signup flow. Keep legacy IDs usable and use the shared format for new IDs.
- Coordinate shared touchpoints with Rahul, including login attendance, task daily logs, and roadmap upload limits.
