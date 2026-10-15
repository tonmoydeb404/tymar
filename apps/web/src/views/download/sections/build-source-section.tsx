import { REPOSITORY_URL } from "@/content/homepage";

const repoName = REPOSITORY_URL.split("/").pop() ?? "repo";
import { CodeBlock, CodeBlockContent } from "@packages/ui/components/code-block";

const buildFromSource = `git clone ${REPOSITORY_URL}.git
cd ${repoName}
pnpm install

# Run the desktop app (Tauri dev)
pnpm dev:desktop

# Build the desktop app for production
pnpm --filter @apps/desktop tauri build`;

export function BuildSourceSection() {
  return (
    <section className="mt-16">
      <h2 className="text-xl font-medium">Build from source</h2>
      <p className="mt-2 leading-7 text-muted-foreground">
        Requires Node.js 18+, pnpm, and the Rust toolchain.
      </p>
      <CodeBlock className="mt-4">
        <CodeBlockContent wrap>{buildFromSource}</CodeBlockContent>
      </CodeBlock>
      <p className="mt-4 leading-7 text-muted-foreground">
        The finished binaries appear in{" "}
        <code className="font-mono">apps/desktop/src-tauri/target/release/bundle</code>
        .
      </p>
    </section>
  );
}
