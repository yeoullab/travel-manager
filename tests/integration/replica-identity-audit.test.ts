import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

describe("REPLICA IDENTITY FULL on trips (§9.4)", () => {
  it("trips.relreplident = 'f' (FULL)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any).rpc("replica_identity_of", { p_table: "trips" });
    expect(error).toBeNull();
    expect(data).toBe("f");
  });

  it("schedule_items.relreplident 은 'd' 또는 'f'", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any).rpc("replica_identity_of", { p_table: "schedule_items" });
    expect(error).toBeNull();
    expect(["d", "f"]).toContain(data as string);
  });
});
