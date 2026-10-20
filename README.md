# SETUP COMMANDS — QR Attendance App

> **Target:** First-year students | **Expo SDK:** 54 | **Expo Go:** 54.0.8

---

## PREREQUISITES

| Tool | Download | Verify |
|---|---|---|
| Node.js (LTS) | https://nodejs.org/en | `node --version` |
| VS Code | https://code.visualstudio.com | (open it) |
| Expo Go 54.0.8 | Play Store → "Expo Go" | (version in app settings) |

---

## STEP 1 — Create the App

```powershell
cd D:\QR-ATT
npx create-expo-app@latest qr-att

# When prompted, select "SDK 54"
# Wait for npm install (~2 min)
```

---

## STEP 2 — Install Matching Versions

The default install may need these fixed versions that match Expo Go 54.0.8:

```powershell
npm install expo@~54.0.35 react@19.1.0 react-native@0.81.5 expo-router@~6.0.24 @expo/vector-icons@^15.0.3 expo-linking@~8.0.12 expo-constants@~18.0.13 expo-font@~14.0.12 expo-status-bar@~3.0.9 expo-splash-screen@~31.0.13 react-native-screens@~4.16.0 react-native-safe-area-context@~5.6.0 react-native-gesture-handler@~2.28.0 react-native-reanimated@~4.1.1 react-dom@19.1.0 react-native-web@~0.21.0 @types/react@~19.1.0 typescript@~5.9.2 --legacy-peer-deps
```

---

## STEP 3 — Start

```powershell
npx expo start
```

Scan QR code with Expo Go. Or press `W` for web.

## DATABASE SETUP

Create a `.env` file from [`.env.example`](./.env.example) and fill in your Supabase project URL and publishable/anon key. These client values are intended for public app use; never put a service-role key in the app.

The app uses Supabase for authentication, profiles, events, attendance, and audited attendance corrections. Run these scripts in the Supabase SQL Editor, in order:

1. Run [`supabase/schema.sql`](./supabase/schema.sql) to create the relational tables, profile trigger, and owner-scoped base RLS policies.
2. Run [`supabase/admin-access.sql`](./supabase/admin-access.sql) to enable the admin role and its access helper.
3. Run [`supabase/project-requirements.sql`](./supabase/project-requirements.sql) to add student profile fields and stored attendance status, event status/metadata, role-scoped event and attendance policies, server-validated attendance recording, duplicate protection, administrator correction auditing, and the Realtime attendance publication.
4. Promote a trusted existing account in the SQL Editor using the commented example at the end of `admin-access.sql`. Public registration cannot assign administrator privileges.
5. Sign in again. Teacher and administrator users can manage events. Only students can scan and check in. Admin role changes are limited to student/teacher accounts in the dashboard; administrator provisioning remains restricted to Supabase.

Do not skip the third script: the app calls its `record_event_attendance` database function and uses the audit table and student fields it creates. A unique `(student_id, event_id)` constraint prevents concurrent duplicate check-ins. Teacher attendance history and administrator monitoring subscribe to new attendance records and refresh when a student checks in.

Native sessions are persisted using Expo SecureStore; the web app uses browser local storage. The database trigger saves the selected student/teacher role and name at signup. Role changes after signup are restricted to administrators.

## FINAL EXAM DEMONSTRATION

The project demonstrates event-driven programming through flows such as:

| Event | Handler | Action | Result |
|---|---|---|---|
| User presses Sign In | Auth form submit handler | Supabase validates credentials and creates a session | User enters the role-appropriate app |
| Teacher/Admin saves an event | Event form submit handler | Validates input and inserts/updates the Supabase event | Event is listed and a QR payload is generated |
| Teacher/Admin closes an event | Close-event handler | Updates event status to `closed` | Future check-ins are denied by the database |
| Scanner detects a QR code | Barcode scan handler | Calls `record_event_attendance` | Student sees success, duplicate, closed, or invalid-event feedback |
| Admin corrects attendance | Correction submit handler | Calls an admin-only database function with a reason | Record is removed and the correction is written to the audit log |
| User presses Logout | Auth sign-out handler | Supabase session is cleared | Protected screens redirect to Login |

---

## TROUBLESHOOTING

| Problem | Solution |
|---|---|
| npm install fails | Use `npm install --legacy-peer-deps` |
| App crashes in Expo Go | Make sure all versions match STEP 2 exactly |
| QR won't scan | Phone + computer on same WiFi |
| White screen | Wait 10s, or shake → Reload |
| TypeScript errors | Run `npx tsc --noEmit` |
