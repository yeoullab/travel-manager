"use client";

import { getBrowserClient } from "@/lib/supabase/browser-client";
import { buildAuthCallbackUrl, sanitizeAuthRedirectPath } from "@/lib/auth/oauth-redirect";

export type SignInWithGoogleParams = {
  idToken: string;
  rawNonce: string;
};

export async function signInWithGoogle({ idToken, rawNonce }: SignInWithGoogleParams) {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
    nonce: rawNonce,
  });
  if (error) {
    throw new Error(`Supabase 로그인 실패: ${error.message}`);
  }
  return data;
}

export type SignInWithGoogleRedirectParams = {
  redirectPath?: string | null;
};

export async function signInWithGoogleRedirect({
  redirectPath,
}: SignInWithGoogleRedirectParams = {}) {
  if (typeof window === "undefined") {
    throw new Error("Google 리다이렉트 로그인은 브라우저에서만 동작합니다");
  }

  const supabase = getBrowserClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: buildAuthCallbackUrl(
        window.location.origin,
        sanitizeAuthRedirectPath(redirectPath),
      ),
      queryParams: {
        prompt: "select_account",
      },
    },
  });
  if (error) {
    throw new Error(`Supabase 리다이렉트 로그인 실패: ${error.message}`);
  }
  return data;
}
