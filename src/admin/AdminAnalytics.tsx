import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lg/supabase";

// Type-only compatibility fix: the student and teacher detail projection sets
// intentionally have different keys. Keep their runtime shape unchanged while
// avoiding an impossible union lookup and Supabase's excessively-deep inference
// for dynamically selected tables.
