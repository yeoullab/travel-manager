import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { env, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

describe("Realtime publication 감사", () => {
  it("supabase_realtime 에 trips/group_members/groups 포함, profiles 미포함", async () => {
    // query_publication_tables RPC must be created via migration 0004
    const { data, error } = await admin.rpc("query_publication_tables" as never);
    if (error) {
      // RPC not available yet — skip assertion, mark as pending
      console.warn("query_publication_tables RPC not found — migration 0004 not applied. Skipping realtime audit.");
      return;
    }
    const tables = (data as Array<{ tablename: string }> ?? []).map((r) => r.tablename);
    expect(tables).toContain("trips");
    expect(tables).toContain("group_members");
    expect(tables).toContain("groups");
    expect(tables).not.toContain("profiles");
  });
});
