# Runtime and local setup

The root app is the 3D product. `packages/input` contains shared capture/voice/request modules and an earlier standalone prototype.

## Without credentials

Run `npm ci`, `npm run dev`, then open the printed URL. Library's three recorded experiments, the real solver, numerical editing, plots, Save and export are available without a provider. The same static assets are produced by `npm run build`.

A static build does not create model endpoints. `vite.config.ts` registers bounded `/api/status`, `/api/interpret` and `/api/command` middleware for local development/preview. The `api/` routes supply the production Vercel API using the same validators, prompts and providers. Credentials stay on the server.

## Vercel deployment

Import this repository as a Vite project, use Node.js 24, run `npm ci` and `npm run build`, and publish `dist`. `vercel.json` configures Fluid compute with a 150-second function limit; model work still aborts after 120 seconds. This fits the free Hobby function duration and requires no paid upgrade.

Set `NOX_DEMO_ACCESS_CODE` to a randomly generated value of at least 32 characters as a **Production Secret**. Share it privately with authorized reviewers. `/api/access` exchanges it for an eight-hour HttpOnly, Secure, SameSite cookie; rotating the code revokes sessions. Unlocking opens a separate tab to preserve unconfirmed work. The shared code is an access gate, not a per-person request quota.

Set the model variables below as server-side Production Secrets and redeploy after changing them. Without a configured provider, even an unlocked session cannot run inference. Public solver examples remain usable. Keep live calls disabled until the account owner has confirmed available participant funding and no personal billing/overages. No fallback provider or automatic retry is enabled.

## Configured model service

Copy `.env.example` to a local, ignored `.env` on the server machine. Fill only server-side values for a runtime you are authorized to use. The source Momen adapter requires:

- `NOX_LIVE_CALLS=enabled` and `NOX_MODEL_PROVIDER=momen`.
- Project external ID, admin token and AI agent ID.
- The agent's instruction/request/image argument keys.

The model agent must accept an image for interpretation and return the raw structured output specified by Nox's prompts. Real tokens belong in deployment secrets, never this repository, client variables, screenshots or logs. The shipped example contains placeholders only. Live calls remain disabled without complete configuration, and there is no automatic paid fallback.

Recorded live cases used GPT 6 Luna through Momen. Their model, source, date and result do not imply the same output for every new drawing or a current provider balance.

## Speech and persistence

Voice uses the browser's speech service. It fills a transcript; users still review and apply changes. If speech is denied or unavailable, type into the same control. Check the displayed runtime availability before a free-form request; offline numerical grammar is distinct from model interpretation.

Save uses browser storage. Confirmed experiments can retain source, versions, baseline samples and a paused checkpoint. Export before moving devices or clearing browser data; unconfirmed drawing drafts do not survive reload.
