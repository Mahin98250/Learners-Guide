# Phase 1 Runtime Stabilization Checklist

Use this checklist before calling Learner's Guide production-ready for existing workflows.

## Admin
- [ ] Login and logout
- [ ] Refresh / re-login identity consistency
- [ ] Student create/edit/deactivate
- [ ] Teacher create/edit/deactivate
- [ ] Parent linking/unlinking
- [ ] Batch create/edit and membership updates
- [ ] Timetable create/edit/delete and conflict handling
- [ ] Attendance workflows
- [ ] Homework create/edit/delete/upload/download
- [ ] Exam/test schedule workflows
- [ ] Result entry/update/delete
- [ ] Fees create/update/delete
- [ ] Announcements create/update/delete
- [ ] Leave request review
- [ ] Materials upload/folder/delete/download
- [ ] Report-card generation
- [ ] Account/security flows

## Teacher
- [ ] Assigned-batch data only
- [ ] Attendance writes
- [ ] Homework writes/uploads
- [ ] Materials writes/uploads
- [ ] Exams/results within permitted scope
- [ ] Announcements and notifications
- [ ] Refresh/re-login persistence

## Student
- [ ] Own profile/data only
- [ ] Timetable
- [ ] Attendance
- [ ] Homework/materials
- [ ] Exams/results
- [ ] Fees
- [ ] Announcements/notifications
- [ ] Leave request
- [ ] Refresh/re-login persistence

## Parent
- [ ] Linked child/children only
- [ ] Attendance/timetable/homework
- [ ] Materials/exams/results/fees
- [ ] Announcements/notifications
- [ ] Leave requests
- [ ] Monthly reports
- [ ] Parent A cannot access Parent B data

## Cross-cutting runtime checks
- [ ] No raw Supabase errors shown as primary end-user messages
- [ ] Failed writes never update local cache as if successful
- [ ] Duplicate identifiers never reuse another record
- [ ] No destructive cache-to-database synchronization is reachable from a supported workflow
- [ ] Empty/loading/error states are deterministic
- [ ] Navigation does not remount the whole portal unnecessarily
- [ ] Browser back/forward/BFCache behavior is stable
- [ ] Mobile viewport does not hide required navigation/actions
- [ ] Upload/download failures do not leave phantom records
- [ ] Notifications do not duplicate after refresh/retry

## Release evidence
- [ ] CI green
- [ ] Production Check green
- [ ] Deployed commit matches intended `main`
- [ ] Four-role authenticated smoke test complete
- [ ] Mobile/tablet smoke test complete
- [ ] No known P0/P1 issues
