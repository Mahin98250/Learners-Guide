import { A, type Row } from "./ReferenceAdminShared";
import { Badge, Btn, Table } from "./ReferenceAdminControls";
import { updR } from "@/lg/data";

export function Accounts({ rows, reload }: { rows: Row[]; reload: () => void }) {
  const users = rows.filter((x) => x.role !== "admin");
  const toggle = async (u: Row) => {
    await updR("users", u.id, { status: u.status === "active" ? "inactive" : "active" });
    reload();
  };
  return (
    <div className="content" style={{ padding: 28 }}>
      <div className="card">
        <Table
          rows={users}
          columns={[
            ["name", "Name", (r) => r.name],
            ["role", "Role", (r) => <Badge v={r.role} />],
            ["phone", "Login ID", (r) => r.phone],
            ["pass", "Password", (r) => r.pass || "Managed by Auth"],
            ["status", "Status", (r) => <Badge v={r.status || "active"} />],
          ]}
          actions={(r) => (
            <Btn
              onClick={() => void toggle(r)}
              outline
              color={r.status === "active" ? A.red : A.green}
            >
              {r.status === "active" ? "Disable" : "Activate"}
            </Btn>
          )}
        />
      </div>
    </div>
  );
}
