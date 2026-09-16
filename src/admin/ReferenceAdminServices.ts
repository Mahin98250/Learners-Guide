import { supabase } from "@/lg/supabase";
import { gdb } from "@/lg/data";

async function provision(
  role: string,
  loginId: string,
  password: string,
  name: string,
  ref: string | null,
  authId?: string | null,
) {
  const { data, error } = await supabase.functions.invoke("admin-provision-user", {
    body: { action: authId ? "update" : "create", role, loginId, password, name, ref, authId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
async function removeAuth(authId?: string | null) {
  if (!authId) return;
  const { data, error } = await supabase.functions.invoke("admin-provision-user", {
    body: {
      action: "delete",
      role: "student",
      loginId: "",
      password: "",
      name: "",
      ref: null,
      authId,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}