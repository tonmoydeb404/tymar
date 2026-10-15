import { useApp } from "@/context/app-context";
import { displayName } from "@/lib/display-name";
import { desktopScheme } from "@/lib/config";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { useState } from "react";

const AUTH_LINK_PLACEHOLDER = `${desktopScheme}://auth?code=…`;

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.44 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function LoginScreen() {
  const { auth, signingIn, signIn, completeSignInWithUrl, resetSigningIn } =
    useApp();
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  const configured = auth?.configured ?? true;
  const expired = auth?.status === "expired";

  async function handleSignIn() {
    setMessage(null);
    const result = await signIn();
    if (!result.ok && result.message) {
      setMessage(result.message);
    }
  }

  async function handlePasteLink() {
    setMessage(null);
    const result = await completeSignInWithUrl(link);
    if (!result.ok && result.message) {
      setMessage(result.message);
    } else {
      setLink("");
    }
  }

  return (
    <main className="flex h-svh w-full flex-col items-center justify-center gap-6 overflow-hidden px-6">
      <div className="grid justify-items-center gap-2 text-center">
        <img
          src="/logo.svg"
          alt={`${displayName} logo`}
          className="size-18"
        />
        <h1 className="text-xl font-[760] text-ink">
          Welcome to {displayName}
        </h1>
        <p className="max-w-xs text-[0.82rem] text-muted-foreground">
          {expired
            ? "Your session expired. Sign in again to keep tracking."
            : "Track work and breaks in one click. Sign in to get started."}
        </p>
      </div>

      {configured ? (
        <Button
          onClick={handleSignIn}
          disabled={signingIn}
          className="h-10 min-w-60"
        >
          <GoogleIcon />
          Continue with Google
        </Button>
      ) : (
        <p className="max-w-sm rounded-lg bg-inset p-3 text-center text-[0.78rem] text-muted-foreground">
          Supabase is not configured. Set{" "}
          <code className="rounded bg-inset px-1 py-0.5">
            VITE_SUPABASE_URL
          </code>{" "}
          and{" "}
          <code className="rounded bg-inset px-1 py-0.5">
            VITE_SUPABASE_ANON_KEY
          </code>{" "}
          in{" "}
          <code className="rounded bg-inset px-1 py-0.5">
            apps/desktop/.env.local
          </code>{" "}
          and restart.
        </p>
      )}

      {message && (
        <p className="max-w-sm text-center text-[0.78rem] text-danger">
          {message}
        </p>
      )}

      {configured && (
        <p className="max-w-xs text-center text-[0.76rem] text-muted-foreground">
          You&apos;ll approve in your browser, then land back here
          automatically.
        </p>
      )}

      {configured && !showPaste && (
        <button
          type="button"
          onClick={() => {
            resetSigningIn();
            setShowPaste(true);
          }}
          className="text-[0.76rem] text-muted-foreground underline-offset-2 hover:text-ink hover:underline"
        >
          App didn&apos;t reopen? Paste the sign-in link instead
        </button>
      )}

      {configured && showPaste && (
        <div className="grid w-full max-w-sm gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
          <p className="text-[0.76rem] text-muted-foreground">
            Copy the link from your browser&apos;s address bar (it carries the
            sign-in code) and paste it here.
          </p>
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && link.trim() && !signingIn) {
                void handlePasteLink();
              }
            }}
            placeholder={AUTH_LINK_PLACEHOLDER}
            autoComplete="off"
            spellCheck={false}
            aria-label="Sign-in link"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowPaste(false);
                setLink("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handlePasteLink}
              disabled={signingIn || !link.trim()}
            >
              {signingIn ? "Signing in…" : "Sign in with link"}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
