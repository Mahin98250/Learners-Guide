import { A, META, type PageKey, type Row } from "./ReferenceAdminShared";
import { Dashboard } from "./ReferenceAdminDashboard";
import { Students } from "./ReferenceAdminStudents";
import { Teachers } from "./ReferenceAdminTeachers";
import { Batches } from "./ReferenceAdminBatches";
import { Materials } from "./ReferenceAdminMaterials";
import { SearchProfiles } from "./ReferenceAdminSearchProfiles";
import { Accounts } from "./ReferenceAdminAccounts";
import { Marks } from "./ReferenceAdminMarks";
import { SimpleCrud } from "./ReferenceAdminSimpleCrud";

export function AppPage({
  page,
  data,
  reload,
  navigate,
}: {
  page: PageKey;
  data: Record<string, Row[]>;
  reload: () => void;
  navigate: (p: PageKey) => void;
}) {
  if (page === "dashboard") return <Dashboard data={data} navigate={navigate} />;
  if (page === "students") return <Students data={data.students || []} reload={reload} />;
  if (page === "teachers") return <Teachers data={data.teachers || []} reload={reload} />;
  if (page === "batches") return <Batches data={data.batches || []} reload={reload} />;
  if (page === "materials") return <Materials data={data.materials || []} reload={reload} />;
  if (page === "search")
    return <SearchProfiles students={data.students || []} teachers={data.teachers || []} />;
  if (page === "accounts") return <Accounts rows={data.users || []} reload={reload} />;
  if (page === "marks") return <Marks rows={data.marks || []} />;
  return <SimpleCrud page={page} rows={data[META[page].table!] || []} reload={reload} />;
}