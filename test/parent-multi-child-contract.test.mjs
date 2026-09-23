import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/lg/parentWorkflows.jsx", import.meta.url), "utf8");

const must = (pattern, message) => assert.match(source, pattern, message);

must(/const \[children, setChildren\]/, "Parent portal must maintain a collection of linked children");
must(/parent_student_links[\s\S]{0,260}?parent_auth_id/, "Parent portal must load child links using the authenticated parent");
must(/\.eq\("status", "active"\)/, "Only active parent-child links may be used");
must(/\.in\("id", ids\)/, "Student loading must use the complete linked-child ID set");
must(/const selected = useMemo\(\(\) => children\.find\(c => String\(c\.id\) === String\(selectedId\)\)/, "Parent portal must derive one explicit selected child from the child collection");
must(/setSelectedId\(e\.target\.value\)/, "Parent portal must allow switching the active child");
must(/children\.length > 1/, "Parent portal must expose the child switcher only when multiple children exist");
must(/childAttendance = useMemo\([\s\S]{0,260}?attendance\.filter[\s\S]{0,220}?selected\?\.id/, "Attendance must be scoped to the selected child");
must(/childFees = useMemo\([\s\S]{0,260}?fees\.filter[\s\S]{0,220}?selected\?\.id/, "Fees must be scoped to the selected child");
must(/childResults = useMemo\([\s\S]{0,260}?results\.filter[\s\S]{0,220}?selected\?\.id/, "Results must be scoped to the selected child");
must(/childHomework = useMemo\([\s\S]{0,260}?homework\.filter[\s\S]{0,220}?childBatchIds/, "Homework must be scoped to the selected child's active batches");
must(/childTimetable = useMemo\([\s\S]{0,260}?timetable\.filter[\s\S]{0,260}?childBatchIds/, "Timetable must be scoped to the selected child's active batches");
must(/childTests = useMemo\([\s\S]{0,260}?tests\.filter[\s\S]{0,220}?childBatchIds/, "Tests must be scoped to the selected child's active batches");

console.log("Parent multi-child contract checks passed.");
