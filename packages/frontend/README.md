This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, install dependencies and run the development server:

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Hiding offboarded users

When someone leaves, removing their Google Workspace account blocks new logins but leaves everything else intact: they keep their leaderboard rank and profile, and any API token they already issued keeps working (`api_tokens.expires_at` is nullable), so their machine can keep submitting.

Hiding a user sets `users.hidden_at`, drops them from every public surface (leaderboard, profile, badge/embed) and deletes their API tokens and sessions. Their submissions are kept, so org-wide token and cost totals still reflect the work they did.

```bash
# preview first
bun run users:hide -- @alice @bob --dry-run

# apply
bun run users:hide -- @alice @bob

# emails and files work too
bun run users:hide -- --email alice@corp.com
bun run users:hide -- --file offboarded.txt   # one identifier per line, # comments ok

# reverse it (tokens are NOT restored — they must issue new ones)
bun run users:hide -- @alice --unhide
```

Requires `DATABASE_URL`. Against production also pass `NODE_ENV=production` so the client connects with SSL. Public pages are cached for 60 s, so changes show up within a minute.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
