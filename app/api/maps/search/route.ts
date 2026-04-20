import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server-client";
import { searchNaver } from "@/lib/maps/search/naver-search";
import { searchGoogle } from "@/lib/maps/search/google-search";
import { tryAcquireRateSlot } from "@/lib/maps/rate-limit";

const requestSchema = z.object({
  query: z.string().min(1).max(100),
  provider: z.enum(["naver", "google"]),
  near: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export async function POST(req: Request) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!tryAcquireRateSlot(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_input", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  try {
    const results =
      parsed.provider === "naver"
        ? await searchNaver(parsed.query)
        : await searchGoogle(parsed.query, parsed.near);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: "upstream_failure", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
