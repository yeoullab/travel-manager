"use client";

import { env } from "@/lib/env";
import { generateNonce, sha256Base64Url } from "@/lib/auth/nonce";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleInitConfig) => void;
          renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
          prompt: () => void;
          cancel: () => void;
        };
      };
    };
  }
}

type GoogleCredentialResponse = { credential: string };
type GoogleInitConfig = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  nonce: string;
  use_fedcm_for_prompt?: boolean;
};
type GoogleButtonOptions = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  width?: number;
};

const GIS_SRC = "https://accounts.google.com/gsi/client";
let scriptPromise: Promise<void> | null = null;

export function loadGisScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("GIS는 브라우저에서만 동작합니다"));
  }
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GIS 로드 실패")));
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GIS 로드 실패"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export type GoogleSignInResult = {
  idToken: string;
  rawNonce: string;
};

export async function requestGoogleIdToken(
  parent: HTMLElement,
): Promise<GoogleSignInResult> {
  await loadGisScript();
  if (!window.google) throw new Error("GIS 미로드");

  const rawNonce = generateNonce();
  const hashedNonce = await sha256Base64Url(rawNonce);

  return new Promise<GoogleSignInResult>((resolve, reject) => {
    try {
      window.google!.accounts.id.initialize({
        client_id: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        nonce: hashedNonce,
        use_fedcm_for_prompt: true,
        callback: (response) => {
          if (!response.credential) {
            reject(new Error("Google 응답에 credential이 없습니다"));
            return;
          }
          resolve({ idToken: response.credential, rawNonce });
        },
      });
      parent.innerHTML = "";
      window.google!.accounts.id.renderButton(parent, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: parent.clientWidth || 320,
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error("GIS 초기화 실패"));
    }
  });
}
