import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server-client";
import { getServerEnv } from "@/lib/env";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Dev-only test sign-in.
 * Guard 3중:
 *  1. NODE_ENV !== 'production'
 *  2. ALLOW_TEST_SIGNIN === 'true'
 *  3. X-Test-Secret 헤더 = TEST_SECRET 일치
 * production 배포 시 Vercel 환경변수에서 ALLOW_TEST_SIGNIN 을 false 로 두거나 미설정.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "forbidden_in_production" }, { status: 404 });
  }

  const serverEnv = getServerEnv();
  if (serverEnv.ALLOW_TEST_SIGNIN !== "true") {
    return NextResponse.json({ error: "test_signin_disabled" }, { status: 404 });
  }
  if (!serverEnv.TEST_SECRET) {
    return NextResponse.json({ error: "test_secret_unset" }, { status: 500 });
  }

  const providedSecret = req.headers.get("x-test-secret");
  if (!providedSecret || providedSecret !== serverEnv.TEST_SECRET) {
    return NextResponse.json({ error: "secret_mismatch" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const supabase = await getServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
