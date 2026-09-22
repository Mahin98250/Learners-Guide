# 🌟 Mahin

> **A complete education management system for Admins, Teachers, Students and Parents.**

Mahin is a web-based education management platform designed to bring the important daily work of an institute into one connected system.

It is made to reduce the need for separate notebooks, spreadsheets, manual registers, scattered messages and disconnected tools.

The system has four main portals:

- 👑 **Admin Portal** — manages the institute
- 👨‍🏫 **Teacher Portal** — manages teaching and academic work
- 🎓 **Student Portal** — helps students follow their learning
- 👪 **Parent Portal** — helps parents follow their linked child/children

This README explains the project in **simple, non-technical language** so that an institute owner, teacher, parent, student or other non-technical person can understand what the system does, what is included, how it is protected, and what the expected pricing and running costs are.

---

# 📌 Quick Project Summary

| Item | Details |
|---|---|
| Product | Mahin |
| Type | Education / Institute Management System |
| Main users | Admin, Teacher, Student, Parent |
| Web app | Yes |
| Mobile-friendly | Yes |
| Installable as app | Yes, through PWA support |
| Login system | Yes |
| Online database | Yes |
| Notifications | In-app + browser push support |
| Exams & results | Yes |
| Attendance | Yes |
| Homework | Yes |
| Timetable | Yes |
| Fees | Yes |
| Study materials | Yes |
| Analytics | Yes |
| Reports | Yes |
| Initial project price | **₹45,000** |
| Maintenance | **₹1,000/month** |
| Backend platform | Supabase |
| Production hosting | Vercel-compatible deployment |

---

# 💰 Project Price

## One-time Project Price: **₹45,000**

The planned price for the complete Mahin system is:

### **₹45,000 one-time**

This covers the development and delivery of the application described in this README, including the four main portals and the major systems already built into the project.

The price is for the **software project itself**. Third-party services may have their own separate charges.

### Monthly Maintenance: **₹1,000/month**

After the project is delivered, optional/ongoing maintenance is priced at:

### **₹1,000 per month**

Maintenance is intended for normal ongoing support such as:

- Fixing software bugs
- Small corrections
- Minor adjustments
- Keeping the application healthy
- Checking important production problems
- Basic deployment/support work
- Small compatibility fixes when required

Large new features or major redesigns are not automatically included in the ₹1,000 maintenance charge. They can be treated as separate work if they require substantial development.

---

# 💡 What the ₹45,000 Includes

The project price covers the overall Mahin application and its main systems, including:

- Admin portal
- Teacher portal
- Student portal
- Parent portal
- Login and account system
- Student management
- Teacher management
- Parent/student linking
- Batch/class management
- Subject management
- Timetable
- Attendance
- Leave requests
- Homework
- Study materials
- Fees
- Announcements
- Exams/tests
- Results
- Notifications
- Push-notification support
- Analytics
- Parent monthly reporting
- PWA/mobile-friendly experience
- Security rules and access control
- Database structure
- Performance improvements
- Production build and deployment support
- Automated quality checks

The exact scope is the functionality described in this README and the current project repository.

---

# 🏫 What Problem Does Mahin Solve?

An institute often has many separate tasks:

- Student records
- Teacher records
- Attendance
- Homework
- Timetable
- Exams
- Results
- Fees
- Announcements
- Leave requests
- Study materials
- Parent communication
- Reports

If these are handled separately, information can become difficult to find and maintain.

Mahin brings these areas together so the institute can use one connected system.

### Simple example

Instead of:

**Teacher → WhatsApp/message → Student → Notebook → Admin spreadsheet → Parent**

The goal is:

**Admin → Mahin → Teacher / Student / Parent**

The same academic information can then move through the correct part of the system.

---

# 👑 Admin Portal

The Admin Portal is the main control center of Mahin.

The admin can manage the institute's important information and workflows.

## Admin Dashboard

The dashboard can provide an overall view of institute activity, including areas such as:

- Student count
- Teacher count
- Attendance information
- Fee information
- Homework activity
- Announcements
- Recent institute activity

## Student Management

Admins can manage:

- Student profiles
- Student IDs / roll numbers
- Class/batch assignment
- Sections
- Parent relationships
- Student account access
- Active/inactive status
- Student information updates
- Student search

## Teacher Management

Admins can manage:

- Teacher profiles
- Teacher IDs
- Contact information
- Subjects
- Teacher status
- Teacher account access
- Teacher assignments

## Parent Management

The system can connect parents with the students they are allowed to monitor.

This helps ensure that a parent sees the information belonging to their linked child rather than unrelated students.

## Batch / Class Management

Admins can manage:

- Batches/classes
- Sections
- Students in each batch
- Teachers assigned to each batch
- Subjects
- Academic-year information
- Rooms
- Active/inactive status

---

# 📅 Timetable System

The timetable helps organize classes and teaching schedules.

It can contain:

- Day
- Start time
- End time
- Subject
- Teacher
- Batch/class
- Room
- Active/inactive status

### Multiple subjects

A timetable slot can contain multiple subjects when required.

For example:

**English + Social Studies**

can be stored as one timetable entry with both subjects.

This prevents the timetable from being limited to only one subject per time slot.

Students and parents see the timetable relevant to their batch/class.

Teachers can see their relevant teaching schedule.

Admins can edit or delete timetable entries.

---

# 👨‍🏫 Teacher Portal

The Teacher Portal is focused on the teacher's assigned work.

Teachers can have access to:

- Dashboard
- Assigned batches
- Assigned subjects
- Timetable
- Attendance
- Homework
- Exams/tests
- Result entry
- Study materials
- Notifications
- Account settings

## Teacher Attendance

Attendance is connected to the academic schedule where applicable.

A teacher can work with the students belonging to the relevant class/batch and record supported attendance states such as:

- Present
- Absent
- Leave

## Teacher Homework

Teachers can:

- Select the relevant batch
- Select the relevant subject
- Create homework
- Add descriptions
- Set due dates
- Add supported attachments
- Manage assigned homework

## Teacher Exams & Results

Teachers can work with tests/exams that are within their permitted academic area and enter student results where allowed.

Important result rules are also protected in the database so that invalid marks are not accepted simply because someone changes something on the screen.

---

# 🎓 Student Portal

The Student Portal gives each student a personal view of their institute information.

Students can access supported areas such as:

- Dashboard
- Timetable
- Attendance
- Homework
- Study materials
- Fees
- Exams
- Results
- Announcements
- Leave requests
- Notifications
- Account settings

## Student Timetable

Students can see their relevant timetable, including:

- Subjects
- Time
- Day
- Teacher information where available
- Class/batch information

## Student Homework

Students can see:

- Assigned homework
- Subject
- Description
- Due date
- Attachments where available

## Student Attendance

Students can see their attendance information and supported attendance statuses.

## Student Exams & Results

Students can see relevant scheduled tests/exams and available results.

Result information can include:

- Test/exam
- Subject
- Marks
- Total marks
- Performance information
- Result history where available

---

# 👪 Parent Portal

The Parent Portal is designed to help parents follow their linked student or students.

Parents can access supported information such as:

- Child overview
- Timetable
- Attendance
- Homework
- Study materials
- Fees
- Exams
- Results
- Announcements
- Leave requests
- Notifications
- Monthly reports

## Parent access is limited

A parent should only be able to access information connected to their linked student.

This is important because a parent should not be able to see another student's private academic information.

---

# 📝 Exams & Results System

The Exams & Results system is one of the major academic parts of Mahin.

The basic flow is:

```text
Admin / Teacher creates test
          ↓
Test is connected to the correct academic batch
          ↓
Student marks/results are entered
          ↓
System checks the result
          ↓
Student can see the result
          ↓
Parent can see the relevant result
```

## Result protection

The system has database-level protection for important result rules.

For example:

- Marks cannot be negative.
- Marks cannot be higher than the test's total marks.
- A result must belong to the correct test/student/batch context.
- Duplicate results for the same test and student are protected against.
- Teacher/admin permissions continue to apply.

This is important because the system does not depend only on what a user sees on the screen.

---

# 🏖️ Leave Request System

Students and parents can use the leave request workflow instead of relying on informal communication.

A typical flow is:

```text
Student / Parent
      ↓
Leave Request
      ↓
Pending
      ↓
Teacher / Admin Review
   ↙           ↘
Approved      Rejected
   ↓
Attendance can reflect approved leave
```

A request can contain:

- Student
- Requesting account
- Start date
- End date
- Reason
- Optional note
- Status
- Reviewer
- Review time
- Rejection reason where applicable

Approved leave can be connected to attendance so that there is a clear record of why the attendance status is marked as leave.

---

# 📚 Homework System

Homework can be created and assigned to the appropriate academic group.

Supported information includes:

- Homework title/details
- Description
- Subject
- Batch/class
- Due date
- Attachments where supported
- Creation information
- Completion-related information where available

The system is designed so students see homework relevant to them rather than the entire institute's homework list.

---

# 📁 Study Materials

Mahin includes a Study Materials area that works like an organized educational file library.

It supports concepts such as:

- Folders
- Subfolders
- Files
- Batch/class organization
- Material information
- Protected access
- Downloads
- Mobile-friendly browsing

This can help an institute keep learning resources in one organized location instead of depending only on scattered files.

---

# 💵 Fees System

The Fees area helps keep student-linked fee information organized.

Supported information can include:

- Student
- Fee description
- Amount
- Due date
- Status
- Payment date

Typical statuses include:

- Pending
- Paid
- Overdue

Students and parents can see the fee information that belongs to them, while admins can manage the institute's fee records.

---

# 📢 Announcements

Admins can publish important institute information.

Announcements can be targeted according to the supported audience, such as:

- Everyone
- Students
- Parents
- Teachers
- Specific batches/classes

This makes announcements more useful than sending the same information to everyone when it is not relevant to everyone.

---

# 🔔 Notifications

Mahin includes both in-app and browser push notification support.

Notifications can be used for supported events such as:

- Attendance changes
- Homework
- Announcements
- Study materials
- Timetable-related updates
- Other supported system events

## Duplicate notification protection

A duplicate attendance-notification trigger was identified in the database and removed.

The push-notification system has also been improved so supported notifications can use a unique event identity. This helps prevent the same event from repeatedly appearing as a new notification.

Dead browser push subscriptions can also be removed when the push provider reports that a subscription is no longer valid.

---

# 📱 Mobile & PWA

Mahin is a web application that is designed to work well on both computers and mobile devices.

It also has Progressive Web App (PWA) support.

This means the application can provide an app-like experience through the browser, including supported features such as:

- Installable web app
- Mobile-friendly layout
- Cached application resources
- Offline fallback
- Browser push notifications
- Notification click handling
- Opening the correct page from a notification

PWA behavior depends on the browser and device.

---

# 📊 Analytics & Reports

The system includes analytics and reporting features without requiring a separate analytics product.

## Admin People & Analytics

Admin analytics can bring together information such as:

### Student information
- Monthly attendance
- Academic average
- Subject performance
- Homework assigned
- Homework completed
- Homework pending
- Homework overdue
- Leave history
- Assessment history

### Teacher information
- Assigned batches
- Assigned subjects
- Homework created
- Tests created
- Recent academic activity

The system is designed to avoid unnecessarily counting the same academic result twice when newer result information already exists.

## Parent Monthly Reports

Parents can have a monthly view of their linked student's available academic/institute information.

Reports are intended to be easy to read and suitable for the Mahin brand.

---

# 🔐 Security in Simple Language

Security is an important part of the system.

Mahin uses a combination of:

- Secure login
- Role-based access
- Database security rules
- Protected admin operations
- Student/parent relationship checks
- Teacher assignment checks
- Protected files where applicable
- Server-side functions for sensitive operations

### Simple example

A student should not be able to open the admin portal and see all students.

A parent should not be able to open another parent's child's records.

A teacher should only work with the academic information they are permitted to access.

These rules are not intended to depend only on hiding buttons. Important protections are also enforced by the backend/database.

### Important security rule

Private service keys must never be placed inside the public browser application.

---

# 🔑 Login & Password Recovery

The system includes account login and password recovery.

The recovery flow is designed to:

1. Receive a recovery request.
2. Identify the eligible account.
3. Send the recovery email.
4. Return the user to the password reset page.
5. Allow the password to be changed.

The production authentication configuration must also allow the production password-reset page.

---

# ⚡ Speed & Performance

Performance has been improved while keeping the existing features.

The system includes improvements such as:

- Avoiding repeated requests when the same information is already available
- Short-term reuse of recently loaded information
- Loading large portal sections only when they are needed
- Student/teacher/parent/admin portal separation
- Database indexes for important searches and timetable queries
- Smaller initial loading requirements where possible
- Background/non-critical work being delayed when appropriate

### Why this matters

A student should not have to download the full admin system just to open the student dashboard.

Similarly, an admin should not need to load every teacher/student portal feature before seeing the admin area.

---

# 🧪 Quality & Reliability

The project has automated checks to catch problems before changes are considered complete.

Checks cover areas such as:

- Security rules
- Database rules
- Timetable behavior
- Analytics behavior
- Performance/query behavior
- Notification behavior
- TypeScript correctness
- Code quality
- Production build
- Formatting

The production build and automated checks are run through GitHub Actions.

A successful automated build means the code passed the project's automated checks for that version. It does not mean every possible phone, browser and internet connection has been manually tested.

---

# 🗃️ Backend & Database

Mahin uses **Supabase** as its main backend platform.

In simple language, Supabase provides the online services that store and protect the application's important information.

It handles areas such as:

- Login and accounts
- Database
- File storage
- Secure access rules
- Server-side functions
- Real-time features where used
- Push-notification support through the application's notification infrastructure

---

# ☁️ Supabase — Free Plan vs Paid Plan

Supabase offers multiple plans. The most relevant comparison for Mahin is the **Free Plan** and **Pro Plan**.

> **Important:** Supabase pricing can change. The figures below are based on the official Supabase pricing information checked for this README. Third-party service charges are separate from the ₹45,000 project price and ₹1,000 monthly maintenance charge.

## 🆓 Supabase Free Plan

### Price

**$0/month**

The current Free Plan includes useful limits for development, testing and smaller projects.

Important included limits/features currently listed by Supabase include:

- 500 MB database size per project
- 1 GB file storage
- 5 GB data transfer/egress
- 5 GB cached egress
- 50,000 monthly active users included
- Unlimited API requests
- 500,000 Edge Function calls
- 2 million Realtime messages
- Up to 200 peak Realtime connections
- Basic authentication features
- Social login support
- Basic multi-factor authentication
- Protected file access controls
- Community support
- Two active free projects across the applicable free-project allowance

### Important Free Plan limitation

Free projects can be **paused after one week of inactivity**.

That means the Free Plan can be excellent for development, testing, learning and small/low-activity use, but it is not automatically the best choice for an institute that expects the system to be available continuously.

---

# 💳 Supabase Pro Plan

### Current listed starting price

**$25/month** for the Pro plan, before any applicable usage beyond included quotas or additional resources.

Supabase currently lists the Pro Plan as including everything in Free plus larger limits and additional production-oriented features.

Important current Pro features include:

- 100,000 monthly active users included
- 8 GB database disk included per project
- 250 GB egress included
- 250 GB cached egress included
- 100 GB file storage included
- 5 million Realtime messages included
- 500 peak Realtime connections included
- 2 million Edge Function invocations included
- Daily backups stored for 7 days
- 7-day log retention
- Email support
- Projects do not pause because of the Free Plan inactivity rule
- More production scaling options
- Additional security and operational add-ons available

### Usage beyond the included Pro limits

Some services can have additional usage charges if the included quota is exceeded.

For example, Supabase currently lists additional charges for items such as:

- Extra database disk usage
- Extra data transfer/egress
- Extra file storage
- Extra monthly active users
- Extra Edge Function calls
- Extra Realtime messages
- Additional compute resources

Supabase also provides a Spend Cap option on Pro to help control certain unexpected usage charges.

---

# 🆓 vs 💳 Supabase in Simple Terms

| Area | Free | Pro |
|---|---|---|
| Monthly plan price | **$0** | **From $25/month** |
| Database | 500 MB | 8 GB included |
| File storage | 1 GB | 100 GB included |
| Data transfer | 5 GB | 250 GB included |
| Monthly active users | 50,000 | 100,000 included |
| Edge Functions | 500,000 calls | 2 million calls |
| Realtime messages | 2 million | 5 million |
| Realtime peak connections | 200 | 500 |
| Automatic backups | No | Yes, 7-day retention |
| Log retention | 1 day | 7 days |
| Email support | No | Yes |
| Free-project inactivity pause | Yes | No |
| Production suitability | Small/testing use | Better for always-on production |

**Source:** official Supabase pricing and billing documentation. urlSupabase Pricinghttps://supabase.com/pricing

---

# 🏫 Which Supabase Plan Makes Sense for Mahin?

For a small institute with relatively low usage, the Free Plan can be enough for development and early testing.

However, if Mahin is being used as a real institute system where users expect it to be available every day, the **Supabase Pro Plan is the safer production choice** because the Free Plan's inactivity pause does not fit an always-on production expectation.

The final choice should depend on:

- Number of students
- Number of parents
- Number of teachers
- File/material usage
- Number of daily logins
- Notification usage
- Database size
- Traffic/data transfer
- Required backup expectations

Supabase usage should be monitored rather than assuming the monthly cost will always remain exactly the base Pro price.

---

# 💸 Important: Project Price vs Running Costs

The **₹45,000** price is the software project price.

The **₹1,000/month** maintenance charge is maintenance/support.

Third-party infrastructure is separate.

Possible running costs can include:

- Supabase plan
- Vercel/hosting plan if the selected usage requires a paid plan
- Custom domain, if purchased
- Email delivery services if additional service is used
- Other third-party services if added later

Therefore:

```text
One-time software price
        ₹45,000

        +

Monthly maintenance
        ₹1,000/month

        +

Third-party infrastructure/service charges
        If applicable
```

This keeps the project price and external service bills clearly separated.

---

# 📈 Example of the Basic Cost Structure

If maintenance is continued for one year:

**₹1,000 × 12 months = ₹12,000/year**

So the first-year software + maintenance amount would be:

**₹45,000 + ₹12,000 = ₹57,000**

This is **before third-party service charges** such as Supabase Pro, domain or other paid services.

This is a simple planning calculation, not a promise of the final infrastructure bill.

---

# 🧑‍💼 What the Institute Gets

In simple terms, the institute gets one connected system for:

### People
- Students
- Parents
- Teachers
- Admins

### Academics
- Classes/batches
- Subjects
- Timetable
- Homework
- Exams
- Results
- Study materials

### Student management
- Attendance
- Leave requests
- Fees
- Academic information

### Communication
- Announcements
- Notifications
- Browser push notifications

### Management
- Admin dashboard
- User management
- Analytics
- Reports

### Technology
- Secure login
- Database
- Role-based access
- Mobile-friendly interface
- PWA support
- Automated quality checks
- Performance improvements

---

# 🔄 How Everything Connects

The main strength of Mahin is that the systems are connected.

For example:

```text
Admin creates batch
       ↓
Teacher is assigned
       ↓
Subjects are assigned
       ↓
Students join batch
       ↓
Timetable is created
       ↓
Teacher conducts class
       ↓
Attendance is recorded
       ↓
Homework is assigned
       ↓
Test/exam is created
       ↓
Result is entered
       ↓
Student sees result
       ↓
Parent sees relevant result
```

Another example:

```text
Student/Parent submits leave
       ↓
Teacher/Admin reviews
       ↓
Leave approved
       ↓
Attendance can reflect leave
       ↓
Student and parent can see the status
```

This connected structure is what makes the application an institute management system rather than only a collection of separate pages.

---

# 👥 Access in Simple Terms

| User | What they mainly do |
|---|---|
| 👑 Admin | Manage the institute and control the system |
| 👨‍🏫 Teacher | Teach, manage assigned academic work, attendance, homework and results |
| 🎓 Student | Follow timetable, homework, attendance, exams, results, fees and learning information |
| 👪 Parent | Monitor linked student information and reports |

Each role has different permissions.

---

# 🚫 Retired Features

Some older features have intentionally been removed from the active user-facing product scope.

### Messages / Direct Messaging

The old direct Messages area is not part of the current active product scope.

### Legacy result/marks screens

Older standalone marks/result workflows are not treated as the main current workflow where the newer Exams & Results system is used.

This does **not** mean results are removed. The current Exams & Results system remains the active academic result direction.

### Old AI Chat area

The older AI Chat area is not part of the current active product scope.

These decisions help keep the product focused instead of maintaining multiple overlapping systems for the same job.

---

# 📱 Typical Student Day

A student can use the system like this:

```text
Open Mahin
       ↓
Login
       ↓
See Dashboard
       ↓
Check Today's Timetable
       ↓
Attend Class
       ↓
Attendance is recorded
       ↓
Check Homework
       ↓
Open Study Material
       ↓
Check Exams / Results
       ↓
Check Notifications
```

---

# 👨‍🏫 Typical Teacher Day

```text
Login
  ↓
Teacher Dashboard
  ↓
Check Timetable
  ↓
Open Assigned Class
  ↓
Take Attendance
  ↓
Create/Manage Homework
  ↓
Manage Tests/Results
  ↓
Upload/Manage Study Material
  ↓
Check Notifications
```

---

# 👪 Typical Parent Day

```text
Login
  ↓
Select Child
  ↓
Check Attendance
  ↓
Check Homework
  ↓
Check Timetable
  ↓
Check Exams / Results
  ↓
Check Fees
  ↓
Check Monthly Report
  ↓
Check Notifications
```

---

# 👑 Typical Admin Day

```text
Login
  ↓
Admin Dashboard
  ↓
Manage Students / Teachers
  ↓
Manage Batches / Subjects
  ↓
Manage Timetable
  ↓
Check Attendance
  ↓
Manage Homework / Exams
  ↓
Manage Fees / Announcements
  ↓
Review Leave Requests
  ↓
Check Analytics / Reports
```

---

# 🧩 Main Systems at a Glance

| System | Included |
|---|---:|
| Admin portal | ✅ |
| Teacher portal | ✅ |
| Student portal | ✅ |
| Parent portal | ✅ |
| Login & authentication | ✅ |
| Student management | ✅ |
| Teacher management | ✅ |
| Parent-child linking | ✅ |
| Batch/class management | ✅ |
| Subject management | ✅ |
| Timetable | ✅ |
| Multiple subjects in timetable slot | ✅ |
| Attendance | ✅ |
| Leave requests | ✅ |
| Homework | ✅ |
| Study materials | ✅ |
| Fees | ✅ |
| Announcements | ✅ |
| Exams/tests | ✅ |
| Results | ✅ |
| Analytics | ✅ |
| Parent monthly reports | ✅ |
| In-app notifications | ✅ |
| Browser push notifications | ✅ |
| PWA support | ✅ |
| Mobile-friendly UI | ✅ |
| Security/RLS | ✅ |
| Automated quality checks | ✅ |
| Performance optimization | ✅ |
| Direct messaging | ❌ Retired |
| Legacy Marks workflow | ❌ Retired |
| Legacy AI Chat | ❌ Retired |

---

# 🛠️ Technology — Explained Simply

The project uses modern software tools, but you do not need to understand them to use Mahin.

### React
Used to build the screens and user interface.

### Supabase
Provides the online database, login system, file storage and secure backend services.

### Vercel
Used for production web hosting/deployment where configured.

### GitHub
Stores the project and runs automated checks when changes are made.

### PWA / Service Worker
Helps the website behave more like an installable app and supports caching/offline/push features.

---

# ☁️ Production Backend Services

The current production Supabase setup includes server-side functions for important tasks such as:

- Login handling
- Admin user provisioning
- Password recovery
- Protected homework-file handling
- Web push notifications

Sensitive operations are kept away from normal browser code wherever appropriate.

---

# 📂 Project Structure — Simple Explanation

You do not need programming knowledge to understand the project structure.

```text
Mahin
│
├── App screens
│   ├── Admin
│   ├── Teacher
│   ├── Student
│   └── Parent
│
├── Shared systems
│   ├── Login
│   ├── Notifications
│   ├── Data handling
│   └── Common UI
│
├── Database
│   ├── Students
│   ├── Teachers
│   ├── Batches
│   ├── Attendance
│   ├── Homework
│   ├── Exams
│   ├── Results
│   ├── Fees
│   ├── Timetable
│   └── Other institute information
│
├── PWA
│   └── Offline/cache/push support
│
└── Automated checks
    └── Quality and production checks
```

---

# 🔄 Maintenance & Future Improvements

The system can continue to grow after delivery.

Possible future work can include:

- New institute-specific reports
- Additional analytics
- More advanced fee management
- More exam/result options
- More notification options
- More parent reporting
- Additional PWA improvements
- UI improvements
- Additional integrations
- Additional automation

New major features should be planned separately so the system remains stable instead of adding changes without checking existing workflows.

---

# ⚠️ Important Cost & Service Notes

1. **₹45,000 is the stated one-time project price.**
2. **₹1,000/month is the stated maintenance charge.**
3. Supabase charges are separate if a paid Supabase plan is selected.
4. Vercel/hosting charges are separate if the selected hosting usage requires payment.
5. Domain charges are separate if a custom domain is purchased.
6. Third-party service pricing can change over time.
7. Supabase usage-based charges can apply when included quotas are exceeded.
8. The Free Supabase Plan can pause inactive projects, so production requirements should be considered before choosing it.
9. Major new features are not automatically included in the ₹1,000/month maintenance fee.

---

# 📋 Recommended Production Setup

For a real institute that expects the application to be available regularly, the recommended approach is:

```text
Mahin application
          ↓
Production hosting
          ↓
Supabase production backend
          ↓
Regular monitoring
          ↓
Backups / recovery planning
          ↓
₹1,000/month maintenance support
```

For Supabase, the **Pro Plan is generally more appropriate for an always-on production system** than relying on the Free Plan's inactive-project behavior, but the actual choice should be based on the institute's size and usage.

---

# 🧾 Final Summary

**Mahin is a complete institute management platform designed to connect Admins, Teachers, Students and Parents in one system.**

It covers the main academic and administrative workflows:

- 👥 People management
- 🏫 Classes and batches
- 📚 Subjects
- 📅 Timetable
- 📝 Homework
- ✅ Attendance
- 🏖️ Leave requests
- 🧪 Exams
- 📊 Results
- 💵 Fees
- 📁 Study materials
- 📢 Announcements
- 🔔 Notifications
- 📱 PWA/mobile experience
- 📈 Analytics
- 📄 Reports
- 🔐 Security and role-based access

### Commercial summary

**One-time project price: ₹45,000**

**Maintenance: ₹1,000/month**

**Supabase: Free plan available; Pro currently starts at $25/month, with usage-based charges possible beyond included limits.**

The software price, maintenance fee and third-party infrastructure charges should be treated as separate costs.

---

# 📚 Official Supabase Pricing Reference

Supabase pricing and limits can change. For the latest official information, use the official Supabase pricing page:

https://supabase.com/pricing

---

# 📄 Project Status

This README describes the current Mahin project scope and the major systems implemented in the repository.

The application is continuously improved, so this document should be updated when major product scope, pricing assumptions or infrastructure decisions change.

**Mahin — One system. Four portals. Connected institute management.**