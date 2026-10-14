"use client";

import { appPaths, sitePaths } from "@/config/paths-config";
import { APP_NAME } from "@/content/homepage";
import { useAuth } from "@/lib/auth-context";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@packages/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@packages/ui/components/card";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, signIn } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [message, setMessage] = useState<string | null>(
    searchParams.get("error") === "oauth"
      ? "Google sign-in failed. Please try again."
      : null,
  );

  useEffect(() => {
    if (loading || !user) return;
    router.replace(appPaths.dashboard);
  }, [loading, user, router]);

  async function handleSignIn() {
    setMessage(null);
    setSigningIn(true);
    try {
      await signIn();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sign-in failed.");
      setSigningIn(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Checking your session…</p>
    );
  }

  if (user) return null;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center justify-center text-center">
        <div className="flex items-center justify-center mb-5">
          <Image
            src="/logo.svg"
            alt={`${APP_NAME} logo`}
            width={70}
            height={70}
          />
        </div>

        <CardTitle>Welcome to {APP_NAME}</CardTitle>
        <CardDescription>
          Sign in with Google to manage projects and review your time.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isSupabaseConfigured() ? (
          <Button onClick={handleSignIn} disabled={signingIn} className="h-10">
            {signingIn ? "Redirecting to Google…" : "Continue with Google"}
          </Button>
        ) : (
          <p className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
            Supabase is not configured. Set{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and restart.
          </p>
        )}
        {message && (
          <p className="text-center text-sm text-destructive">{message}</p>
        )}
        <Link
          href={sitePaths.home}
          className="text-center text-sm text-muted-foreground hover:text-primary hover:underline"
        >
          Back to home
        </Link>
      </CardContent>
    </Card>
  );
}
