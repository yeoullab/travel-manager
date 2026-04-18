"use client";

import { getBrowserClient } from "@/lib/supabase/browser-client";

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
