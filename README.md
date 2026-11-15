# Sites by Patrick

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

The build embeds the page and optimized WebP images into `dist/server/index.js`, a Cloudflare Worker ES module.

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
