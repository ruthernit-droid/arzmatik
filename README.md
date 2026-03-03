This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

## Environment

Create `.env.local` (already ignored by git) and set:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

See `.env.example`.

## Twelve Data (BIST / XIST)

This app is a static export. Do NOT put `TWELVEDATA_API_KEY` in `.env.local`.
Instead, use Firebase Functions and store it as a secret:

```bash
firebase functions:secrets:set TWELVEDATA_API_KEY
```

Endpoints (via Firebase Hosting rewrite):

- `GET /api/twelve/stocks?exchange=XIST`
- `GET /api/twelve/quote?ticker=THYAO`
- `POST /api/twelve/import` with JSON body: `{ "exchange": "XIST", "withPrices": true, "limit": 500, "offset": 0 }`
- `POST /api/twelve/import_all` with JSON body: `{ "exchange": "XIST" }`

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

App routes:

- `/portfolio`
- `/accounts`
- `/ipos`

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
