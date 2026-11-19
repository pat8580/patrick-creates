# patrickcreates.it

Patrick's responsive personal branding website and landing page portfolio.

## Features

- Responsive hero and about sections with Patrick's portraits.
- Seven portfolio projects with cover images and full-design dialogs, including zoom and keyboard navigation.
- An accessible project enquiry dialog with email/WhatsApp preferences.
- Server-side enquiry validation and durable Cloudflare D1 storage.
- Independent email and WhatsApp notification jobs, signed provider callbacks, and retry support.

## Build and checks

Requires Node.js 22 or later. The build has no package dependencies.

```sh
npm test
npm run build
```

The build creates two deployment targets: `public/` for Vercel static hosting and `dist/server/index.js` for the existing Sites Cloudflare Worker. Vercel also deploys the server-side `api/enquiries.mjs` function.

## Source files

- `worker/page.html`: page markup, styles, and browser interactions.
- `worker/backend.mjs`: enquiry endpoints, notification jobs, and delivery webhooks.
- `assets/`: portraits and portfolio images. The page uses optimized WebP versions; supplied originals are also retained.
- `build.mjs`: creates the deployable Worker bundle.
- `drizzle/`: deployed database migration and journal.
- `.openai/hosting.json`: existing Sites project identity and D1 binding.
- `SETUP.md`: provider configuration and remaining launch requirements.

## Deployment

The existing website is hosted with Sites:

https://sites-by-patrick-studio.fizzysundae8.chatgpt.site

It currently has owner-private access. Uploading this repository does not change that access or configure GitHub Pages. GitHub Pages alone cannot run the Cloudflare Worker or enquiry database. To deploy elsewhere, configure a compatible Cloudflare Worker with a `DB` D1 binding, apply the schema migrations, and configure runtime secrets through the hosting provider. Preserve the existing Sites identity when updating the existing hosted website.

Never put API keys or access tokens in source or browser code. Email and WhatsApp automation remains pending until provider credentials, destinations, approved templates, and delivery verification are complete. See `SETUP.md`.

## Deploy on Vercel

Import this repository with Framework Preset **Other**. The committed `vercel.json` selects `npm run build` and output directory `public`. The build writes `public/index.html` and all optimized images, resolving `STATIC_BUILD_NO_OUT_DIR`.

Configure server-side environment variables for the enquiry function:

- `ENQUIRY_BACKEND_URL`: `https://sites-by-patrick-studio.fizzysundae8.chatgpt.site`
- `SITES_BACKEND_TOKEN`: the existing private Site's service-access bearer token, stored as a sensitive Vercel environment variable. Never put the token in GitHub, client code, or a `NEXT_PUBLIC_` variable.

Redeploy after adding these values. The Vercel function forwards enquiries to the existing backend, which retains durable lead storage, duplicate protection, and notification jobs. Without backend configuration the site still builds, but form submission returns a recoverable error and keeps entered details. Verify a real test submission after configuration. Email and WhatsApp provider setup remains as described in `SETUP.md`.

The npm `Unknown env config "cache-dir"` warning in the supplied Vercel logs comes from the hosting environment; it did not cause the deployment failure. The output directory error was the blocking failure.
