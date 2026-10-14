"use client";

import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { appPaths, externalUrls } from "@/config/paths-config";

// Bridge for desktop OAuth: Supabase redirects to this registered https origin
// after Google auth. We forward the PKCE code to the desktop app via deep link
// so its webview can exchange it for a session using the stored code verifier.
const DESKTOP_SCHEMES = new Set<string>([
  externalUrls.slug,
  externalUrls.devSlug,
]);

export function DesktopBridge() {
  const searchParams = useSearchParams();
  const [forwarded, setForwarded] = useState(false);
  const [copied, setCopied] = useState(false);

  const deepLink = useMemo(() => {
    const code = searchParams.get("code");
    const requestedScheme = searchParams.get("scheme");
    const scheme =
      requestedScheme && DESKTOP_SCHEMES.has(requestedScheme)
        ? requestedScheme
        : externalUrls.slug;
    if (!code) return null;
    const url = new URL(`${scheme}://auth`);
    url.searchParams.set("code", code);
    return url.toString();
  }, [searchParams]);

  useEffect(() => {
    if (!deepLink || forwarded) return;
    setForwarded(true);
    window.location.href = deepLink;
  }, [deepLink, forwarded]);

  async function copyLink() {
    if (!deepLink) return;
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (!deepLink) {
    return (
      <div className="grid max-w-sm gap-3 text-center">
        <p className="text-sm font-medium">Sign-in didn&apos;t complete</p>
        <p className="text-sm text-muted-foreground">
          The sign-in was cancelled or arrived without credentials.
        </p>
        <Link
          href={appPaths.login}
          className="text-sm text-primary hover:underline"
        >
          Back to sign-in
        </Link>
      </div>
    );
  }

  return (
    <div className="grid max-w-md gap-3 text-center">
      <p className="text-sm text-muted-foreground">
        Signed in — returning you to the Timer app…
      </p>
      <a
        href={deepLink}
        className="text-sm text-primary hover:underline"
      >
        Click here if the app doesn&apos;t open
      </a>
      <div className="grid gap-2 rounded-lg border border-border p-3 text-left">
        <p className="text-xs text-muted-foreground">
          Testing a dev build that can&apos;t receive the link? Copy it and
          paste it into the desktop sign-in screen.
        </p>
        <Input
          value={deepLink}
          readOnly
          onFocus={(e) => e.target.select()}
          aria-label="Desktop sign-in link"
          className="font-mono text-[11px]"
        />
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={copyLink}
          className="h-auto justify-self-start p-0 text-sm"
        >
          {copied ? "Copied!" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}
