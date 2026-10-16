This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, create the local environment file (PowerShell):

```powershell
Copy-Item .env.example .env.local
```

Next.js does not load `.env.example`. In `.env.local`, set `API_BASE_URL` to the NestJS API URL and `APP_ORIGIN` to the exact dashboard origin, including its port. The local example uses the API on `http://localhost:3000` and the dashboard on `http://localhost:3001`. Keep `.env.local` untracked; production hosting must provide its own values and HTTPS. See [session configuration](docs/frontend/session-management.md#configuration-and-security).

Then run the development server on the configured dashboard port:

```bash
npm run dev -- --port 3001
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see the result. If you use another port or hostname, update `APP_ORIGIN` accordingly. Restart the development server if it has not reloaded changes to `.env.local`.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
