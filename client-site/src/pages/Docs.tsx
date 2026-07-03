import type { ReactNode } from 'react';
import { Footer } from '../components/landing/Footer';

const models = [
  ['dlg-pro', 'Pro pass default: deliberate coding, tests, and multi-file edits.'],
  ['dlg-light', 'Cheaper thinking lane for long edits and fallback traffic.'],
  ['image uploads', 'Workbench auto-routes uploaded visuals to image analysis inside the pass.'],
  ['swe-ultra', 'UltraSpeed beta: ultraspeed lane (~600 tps).'],
];

const surfaces = [
  ['Coding tools', 'Use the OpenAI-compatible endpoint with your sess_ key.'],
  ['Workbench', 'Use the same Pro pass for studio files, decks, sheets, PDFs, and uploads.'],
  ['Office add-in', 'Coming soon: Word, Excel, and PowerPoint automations after the web launch is stable.'],
];

export function Docs() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center">
      <div className="flex w-full justify-center border-b border-line py-8">
        <a href="/" className="flex items-center gap-3">
          <img
            src="/delegators_icon_transparent_cropped.png"
            alt="Delegators Icon"
            className="h-8 w-auto object-contain"
          />
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-foreground">Delegators</span>
        </a>
      </div>

      <main className="w-full max-w-[960px] flex-1 px-4 py-14">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Docs</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-[400] tracking-tight text-foreground md:text-6xl">
          One session key across the suite.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-secondary">
          Delegators gives you an OpenAI-compatible gateway for coding sessions plus the
          Workbench artifact studio. The gateway owns auth, budgets, harness routing,
          stream locks, and usage accounting.
        </p>

        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {surfaces.map(([title, body]) => (
            <article key={title} className="border border-line bg-white p-4">
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-secondary">{body}</p>
            </article>
          ))}
        </section>

        <DocBlock title="Base URL">
          <Code>{`https://api.delegators.in/v1`}</Code>
          <p className="mt-3 text-sm text-secondary">
            The checkout success page prints this endpoint with your session key.
          </p>
        </DocBlock>

        <DocBlock title="Authentication">
          <Code>{`Authorization: Bearer <YOUR_SESSION_KEY>`}</Code>
          <p className="mt-3 text-sm text-secondary">
            Session keys start with `sess_`. Workbench purchases are also issued as `sess_` keys;
            `wb_*` values are plan codes, not pasteable credentials.
          </p>
        </DocBlock>

        <DocBlock title="Chat completions">
          <Code>{`curl -X POST https://api.delegators.in/v1/chat/completions \\
  -H "Authorization: Bearer <YOUR_SESSION_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "dlg-pro",
    "messages": [
      { "role": "user", "content": "Review this function and suggest a safe fix." }
    ],
    "max_tokens": 1200,
    "project_id": "my-app",
    "thread_id": "checkout-bug"
  }'`}</Code>
        </DocBlock>

        <DocBlock title="Session status and usage">
          <Code>{`curl https://api.delegators.in/v1/session/status \\
  -H "Authorization: Bearer <YOUR_SESSION_KEY>"

curl https://api.delegators.in/v1/session/usage \\
  -H "Authorization: Bearer <YOUR_SESSION_KEY>"`}</Code>
          <p className="mt-3 text-sm text-secondary">
            Status reads do not start the timer. A session activates on the first model request.
          </p>
        </DocBlock>

        <DocBlock title="Model aliases">
          <div className="grid gap-3 md:grid-cols-2">
            {models.map(([model, body]) => (
              <div key={model} className="border border-line bg-white p-4">
                <h3 className="font-mono text-sm text-foreground">{model}</h3>
                <p className="mt-2 text-sm leading-6 text-secondary">{body}</p>
              </div>
            ))}
          </div>
        </DocBlock>

        <DocBlock title="SWE Ultra">
          <Code>{`model: swe-ultra`}</Code>
          <p className="mt-3 text-sm text-secondary">
            SWE Ultra is a beta coding session on the ultraspeed lane — use an enabled UltraSpeed pass
            and point any OpenAI-compatible tool at the same endpoint with model `swe-ultra`.
          </p>
        </DocBlock>

        <DocBlock title="Workbench">
          <Code>{`Endpoint: https://api.delegators.in
API key:  <YOUR_SESSION_KEY>
Pass:     Pro (dlg_lite) or UltraSpeed beta`}</Code>
          <p className="mt-3 text-sm text-secondary">
            Sign in once on this site and the Workbench picks up your credits automatically.
            Uploads are analyzed natively inside the Workbench harness, including visual evidence
            from images, without choosing a separate vision model. The Office add-in (coming soon)
            will use the same wallet.
          </p>
        </DocBlock>
      </main>
      <Footer />
    </div>
  );
}

function DocBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">{title}</p>
      {children}
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto border border-line bg-white p-5 font-mono text-sm leading-6 text-foreground">
      <code>{children}</code>
    </pre>
  );
}
