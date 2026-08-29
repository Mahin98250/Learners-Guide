# 🌟 Learner's Guide

> **A modern Student & Institute Management Platform for Admins, Teachers, Students, and Parents.**

Learner's Guide brings the day-to-day operations of an educational institute into one responsive web application. It combines role-based dashboards, attendance, timetable management, homework, study materials, fees, examinations, announcements, notifications, leave requests, and secure account management.

The application is built as a responsive React/PWA experience and uses Supabase as its production data and authentication platform.

---

## 🎯 What Learner's Guide Solves

Learner's Guide is designed to reduce the need for separate spreadsheets, paper registers, messaging threads, and disconnected tools.

It gives each role the information and controls relevant to them:

| Role | Main purpose |
| --- | --- |
| 👑 **Admin** | Run and manage the institute |
| 👨‍🏫 **Teacher** | Manage classes, timetable, attendance, homework and materials |
| 🎓 **Student** | Follow classes, attendance, homework, materials, exams and fees |
| 👪 **Parent** | Monitor linked children and their academic/institute information |

---

# 👑 Admin Portal

The Admin portal is the central management area of the platform.

### Dashboard & Institute Overview
- Institute-wide dashboard
- Student and teacher counts
- Attendance overview
- Fee collection overview
- Homework and announcement activity
- Recent student and institute information

### Student Management
- Add students
- Edit student information
- Student ID / roll number management
- Class and section assignment
- Parent information
- Student account provisioning
- Student status management
- Student search

### Teacher Management
- Add and manage teachers
- Teacher ID and contact information
- Subject information
- Teacher status management
- Teacher account provisioning

### Classes, Batches & Academic Structure
- Batch management
- Class and section organization
- Student-to-batch membership
- Teacher-to-batch assignment
- Subject assignment
- Academic-year structure
- Room management
- Batch capacity and active/inactive status

### Timetable Management
- Weekly timetable
- Teacher assignment
- Subject assignment
- Batch/class assignment
- Room assignment
- Start and end times
- Active/inactive timetable entries
- Academic-year association

### Attendance Management
- Attendance records per student and date
- Present / Absent / Leave statuses
- Lecture-aware attendance architecture
- Teacher-controlled attendance during scheduled lectures
- Attendance history and reporting foundation
- Leave-request integration

### Homework Management
- Create and manage homework
- Assign homework to batches/classes
- Subject-based homework
- Due dates
- Descriptions and attachments
- File-backed homework storage

### Exam Management
- Exam/test scheduling
- Subject
- Date
- Start and end time
- Venue
- Syllabus
- Total marks
- Batch association
- Exam status

### Study Materials Drive
- Drive-style material library
- Folders and subfolders
- Folder hierarchy
- Access standards
- Material metadata
- File uploads
- Storage-backed files
- Downloads
- Rename/delete workflows
- Mobile-friendly material browsing

### Fees
- Student-linked fee records
- Fee description
- Amount
- Due date
- Pending / Paid / Overdue status
- Payment date
- Fee collection overview

### Announcements
- Institute-wide announcements
- Role-targeted announcements
- Student/parent/teacher targeting
- Batch-targeted announcements
- Announcement history

### Leave Request Management
- Review student/parent leave requests
- Pending / Approved / Rejected / Cancelled workflow
- Reviewer and review timestamp
- Rejection reason
- Attendance integration for approved leave

### User & Account Management
- Role-based accounts
- Admin-controlled account provisioning
- Account status handling
- Password recovery workflow
- Secure authentication through Supabase Auth
- Mobile-accessible logout

---

# 👨‍🏫 Teacher Portal

Teachers get a focused workspace for their assigned academic responsibilities.

### Teacher Dashboard
- Personal dashboard
- Assigned class/batch information
- Quick access to daily workflows

### Timetable
- Personal teaching schedule
- Scheduled lecture information
- Subject and batch context
- Time-aware lecture workflow

### Lecture-Based Attendance
Attendance is designed around scheduled lectures rather than an unrestricted attendance form.

- View scheduled lectures
- Attendance availability is tied to the lecture schedule
- Mark students Present / Absent / Leave
- Maintain separate lecture attendance records
- Keep attendance connected to the institute's timetable structure

### Homework
- Select an assigned batch
- Select an assigned subject
- Create homework
- Set due dates
- Add descriptions
- Attach supported files
- Manage previously assigned homework

Supported homework attachments include PDF, PowerPoint, Word documents and common image formats, with a maximum attachment size enforced by the application.

### Study Materials
- Upload teaching materials
- Manage class/batch materials
- Work with the shared Study Materials system

### Notifications
- In-app notifications
- Unread notification count
- Mark individual notifications as read
- Mark all notifications as read
- Real-time notification updates where supported

---

# 🎓 Student Portal

The Student portal provides a simple view of the student's academic and institute information.

### Student Dashboard
- Personal institute dashboard
- Quick access to major student workflows

### Timetable
- Weekly class schedule
- Subject information
- Teacher information
- Class/batch context
- Formatted lecture times

### Attendance
- Attendance history
- Present / Absent / Leave status
- Attendance information linked to the student's profile

### Homework
- View assigned homework
- Subject and due-date information
- Homework descriptions
- Attachment access where available

### Study Materials
- Browse available learning materials
- Class/batch-aware access
- Folder-based material organization
- View/download supported files

### Fees
- Student-linked fee information
- Amounts and due dates
- Pending, paid and overdue states

### Exams
- Scheduled tests/exams
- Subject
- Date and timing
- Venue
- Syllabus and total marks where provided

### Announcements
- Institute announcements
- Role/batch-targeted announcements

### Leave Requests
Students can submit leave requests with:
- From date
- To date
- Reason
- Optional note
- Request status

Requests move through the institute approval workflow before approved leave is reflected in attendance.

### Notifications & Account
- Push/in-app notification support
- Change-password workflow
- Secure logout
- Session persistence

---

# 👪 Parent Portal

Parents can monitor their linked children without needing access to unrelated student records.

### Linked Children
- Parent-to-student relationship management
- Child selection
- Support for linked-child access control

### Child Academic View
For the selected child, parents can access supported information such as:
- Timetable
- Attendance
- Homework
- Study Materials
- Fees
- Scheduled tests/exams
- Institute announcements
- Notifications

### Parent Leave Requests
Parents can submit and track leave requests for their linked child through the same controlled approval workflow.

### Parent Analytics
The portal includes parent-facing analytics components for the child's institute/academic information.

---

# 🏖️ Leave Request System

Learner's Guide includes a structured leave workflow instead of treating leave as an informal message.

### Workflow

```text
Student / Parent
      ↓
Submit Leave Request
      ↓
Pending
      ↓
Teacher / Admin Review
   ↙           ↘
Approved      Rejected
   ↓
Attendance integration
```

### Request information
- Student
- Requesting account
- Start date
- End date
- Reason
- Optional note
- Optional attachment field
- Status
- Reviewer
- Review timestamp
- Rejection reason
- Created/updated timestamps

### Attendance Integration
Approved leave is linked to attendance through the leave request ID. This preserves an audit trail explaining why an attendance record has a `leave` status.

The system is designed to avoid silently overwriting conflicting attendance records.

---

# 📚 Study Materials & File Management

Study Materials is designed as a shared educational file library rather than a simple list of links.

### Features
- Folders
- Nested subfolders
- Materials metadata
- Class/batch-aware organization
- Storage-backed files
- Protected access controls
- Signed/protected file access where applicable
- Download support
- Mobile-friendly browsing

The application also contains offline/PWA infrastructure for cached application resources and material caching so previously available content can remain useful when connectivity is unavailable, subject to browser/device cache availability.

---

# 📱 Mobile & PWA Experience

Learner's Guide is designed to work across desktop and mobile screens.

### Mobile features
- Responsive role-specific navigation
- Mobile admin logout access
- Mobile-friendly dashboards and cards
- Responsive tables/forms
- Touch-friendly controls
- Safe-area-aware floating controls

### PWA capabilities
- Installable web-app experience
- Web app manifest
- Service worker
- Cached application resources
- Offline fallback behavior
- Push notification infrastructure

---

# 🔔 Notifications

The platform includes a notification system for role-specific updates.

- In-app notification panel
- Read/unread state
- Mark one as read
- Mark all as read
- Supabase-backed notification records
- Real-time updates
- Web Push infrastructure
- Notification click routing

---

# 🔐 Authentication & Security

Learner's Guide uses role-aware authentication with Supabase Auth.

### Supported roles
- Admin
- Teacher
- Student
- Parent

### Security architecture
- Supabase Auth handles credentials and sessions
- Role and profile references are server-managed through authentication metadata
- Student and teacher profiles are re-validated after online login
- Parent access is based on active parent/student relationships
- Inactive/disabled profiles are rejected
- Supabase Row Level Security (RLS) is used as the database authorization boundary
- Privileged operations are handled through server-side Edge Functions
- Protected storage access is designed around controlled object access

> **Security rule:** privileged keys and service-role credentials must never be shipped to the browser.

---

# 🗄️ Production Data Layer

The live Supabase project contains structured data for the main institute workflows.

### Core data areas

| Data area | Purpose |
| --- | --- |
| `users` | Application role/account records |
| `students` | Student profiles |
| `teachers` | Teacher profiles |
| `batches` | Classes/batches |
| `batch_students` | Student-batch relationships |
| `batch_teachers` | Teacher-batch-subject relationships |
| `timetable_entries` | Structured timetable/lecture entries |
| `attendance` | Student attendance |
| `leave_requests` | Leave submission and approval workflow |
| `homework` | Homework assignments and attachments |
| `materials` | Study material metadata |
| `material_folders` | Material folder hierarchy |
| `fees` | Student fee records |
| `announcements` | Institute announcements |
| `examschedule` | Exam schedule records |
| `tests` | Scheduled test records |
| `test_results` | Test-result data |
| `subjects` | Subject catalog |
| `academic_years` | Academic-year management |
| `rooms` | Room management |
| `notifications` | User notifications |
| `push_subscriptions` | Web Push subscriptions |
| `parent_student_links` | Parent-child access relationships |

### Attendance & Leave Relationship

```text
leave_requests.id
        │
        ▼
attendance.leave_request_id
        │
        ▼
attendance.status = leave
```

This provides traceability between an approved leave request and the attendance record it created or is associated with.

---

# ⚡ Performance & Reliability

Performance has been an ongoing engineering focus.

### Application optimizations
- Lazy loading of secondary UI such as installation prompts and database activity overlays
- TanStack Router intent preloading
- Query caching with configured stale and garbage-collection windows
- Window-focus refetch suppression where appropriate
- In-flight request deduplication in the shared data layer
- Local browser caching for supported data
- Role-specific data hydration
- Avoidance of unnecessary full-admin data downloads during admin startup
- Memoized/derived dashboard data in major workflows
- Deferred service-worker registration after the main page load
- Deferred non-critical offline-cache initialization during idle time

### Production reliability
- Error boundaries
- Loading states
- Empty states
- Auth/session recovery
- Database error handling
- RLS-aware failures
- Mobile responsive handling
- Production deployment checks

---

# 🧭 Application Routes

The main application is organized around a small set of authenticated entry points:

| Route | Purpose |
| --- | --- |
| `/` | Public landing/login entry |
| `/auth` | Authentication flow |
| `/app` | Authenticated Teacher/Student/Parent application shell |
| `/admin` | Admin portal |
| `/reset-password` | Password reset/change flow |

Unknown application routes are handled by the global 404 experience.

---

# 🎨 UI & User Experience

The interface uses a role-focused design system with:

- Responsive layouts
- Reusable cards, buttons, badges and sections
- Consistent institute branding
- Dashboard-style information hierarchy
- Mobile navigation
- Accessible focus states on key controls
- Loading/error/empty states
- Polished glass-style 404 error experience

### 404 Error Page

The application has a global custom 404 screen featuring a **liquid-glass / glassmorphism visual style**, with:
- Large 404 indicator
- Branded Learner's Guide presentation
- Back-to-home action
- Browser back action
- Responsive mobile layout

---

# 🛠️ Technology Stack

### Frontend
- React 19
- Vite
- TypeScript / JavaScript
- TanStack Router
- TanStack React Query
- React Hook Form
- Radix UI components
- Tailwind CSS
- Recharts
- Lucide React
- Sonner

### Backend / Data
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Supabase Row Level Security
- Supabase Edge Functions
- Supabase Realtime where used

### Platform
- PWA / Service Worker
- GitHub
- GitHub Actions / CI
- Vercel-compatible deployment

---

# ☁️ Supabase Edge Functions

The production Supabase project currently contains active server-side functions for:

- **`auth-login`** — role-aware login gateway for non-admin application accounts
- **`admin-provision-user`** — privileged admin account provisioning/update/delete operations
- **`homework-file`** — protected homework-file handling
- **`password-recovery-request`** — password recovery workflow
- **`web-push`** — web push notification delivery infrastructure

These functions keep privileged operations away from browser code.

---

# 🔄 Typical User Workflows

## Student day-to-day flow

```text
Login
  ↓
Dashboard
  ├── Timetable
  ├── Attendance
  ├── Homework
  ├── Study Materials
  ├── Fees
  ├── Exams
  ├── Announcements
  ├── Leave Requests
  └── Notifications
```

## Teacher day-to-day flow

```text
Login
  ↓
Teacher Dashboard
  ├── Schedule
  ├── Active Lecture
  │      ↓
  │   Attendance
  ├── Homework
  ├── Study Materials
  └── Notifications
```

## Parent day-to-day flow

```text
Login
  ↓
Select Linked Child
  ↓
Child Dashboard
  ├── Timetable
  ├── Attendance
  ├── Homework
  ├── Study Materials
  ├── Fees
  ├── Exams
  ├── Announcements
  ├── Leave Requests
  └── Notifications
```

## Admin day-to-day flow

```text
Login
  ↓
Admin Dashboard
  ├── Students
  ├── Teachers
  ├── Batches
  ├── Timetable
  ├── Attendance
  ├── Homework
  ├── Exams
  ├── Study Materials
  ├── Fees
  ├── Announcements
  ├── Leave Requests
  └── User Accounts
```

---

# 🚫 Intentionally Retired Features

The following features are not part of the current user-facing product scope:

- **Messages / direct messaging**
- **Marks Overview / legacy marks workflow**
- **Student Results as a standalone legacy workflow**

The database may retain historical structures for compatibility or audit purposes, but these retired workflows are not presented as active product features.

---

# 📂 Project Structure

```text
Learners-Guide/
├── src/
│   ├── admin/              # Admin portal and management UI
│   ├── lg/                 # Shared role workflows, data, auth and UI
│   ├── routes/             # Application routes
│   ├── main.tsx            # Application bootstrap
│   └── router.tsx          # Router configuration
│
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js               # Service worker / PWA caching
│   └── application icons
│
├── supabase/
│   └── migrations/         # Database schema, RLS, triggers and hardening
│
├── docs/                   # Production-readiness and engineering documentation
├── scripts/                # Build-time scripts
├── package.json
└── README.md
```

---

# 🚀 Local Development

## Requirements

- Node.js 22+
- npm

## Install

```bash
npm install
```

## Development server

```bash
npm run dev
```

## Production build

```bash
npm run build
```

## Type checking

```bash
npm run typecheck
```

## Formatting check

```bash
npm run lint
```

## Format files

```bash
npm run format
```

---

# 🌍 Environment Configuration

Configure environment-specific values through the deployment platform or local environment configuration.

Typical browser-safe Supabase variables are:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Never expose privileged Supabase credentials in frontend code, public assets, or browser-delivered JavaScript.

---

# 🚢 Deployment & Release Quality

The project is maintained with a production-oriented workflow:

1. Implement a focused change.
2. Run type checking.
3. Run the production build.
4. Review the affected role workflow.
5. Review database/RLS implications.
6. Commit and deploy.
7. Confirm deployment status.
8. Perform role-based smoke testing.

A green build alone is **not** considered proof that a business workflow is correct; authentication, data persistence, authorization and the affected user experience should also be checked.

---

# 🧪 Client Demo / Acceptance Checklist

### Admin
- [ ] Admin login
- [ ] Dashboard
- [ ] Student management
- [ ] Teacher management
- [ ] Batches/classes
- [ ] Timetable
- [ ] Attendance
- [ ] Homework
- [ ] Exams
- [ ] Study Materials
- [ ] Fees
- [ ] Announcements
- [ ] Leave Requests
- [ ] User accounts

### Teacher
- [ ] Login
- [ ] Dashboard
- [ ] Timetable
- [ ] Lecture-based attendance
- [ ] Homework
- [ ] Homework attachments
- [ ] Study Materials
- [ ] Notifications

### Student
- [ ] Login
- [ ] Dashboard
- [ ] Timetable
- [ ] Attendance
- [ ] Homework
- [ ] Study Materials
- [ ] Fees
- [ ] Exams
- [ ] Announcements
- [ ] Leave Requests
- [ ] Notifications

### Parent
- [ ] Login
- [ ] Linked child selection
- [ ] Timetable
- [ ] Attendance
- [ ] Homework
- [ ] Study Materials
- [ ] Fees
- [ ] Exams
- [ ] Announcements
- [ ] Leave Requests
- [ ] Notifications

### Platform / Reliability
- [ ] Mobile layout
- [ ] Installable PWA experience
- [ ] Offline/cached-resource behavior
- [ ] 404 page
- [ ] Logout
- [ ] Password change/recovery
- [ ] Loading and empty states
- [ ] Unauthorized-access protection

---

# 📌 Product Status

Learner's Guide is an actively developed, production-oriented institute management platform. The current codebase includes the major Admin, Teacher, Student and Parent workflows described above, together with the supporting Supabase database, authentication, storage, security, notifications, PWA and performance infrastructure.

Some workflows are intentionally evolving as the product is hardened and tested. The README describes the **current implemented architecture and product scope**, not a promise of future features.

---

# 📄 License

**Private project.** All rights reserved unless a separate license is provided by the project owner.
