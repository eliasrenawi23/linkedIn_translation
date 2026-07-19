This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

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

## Candidate Score integration

The `/candidate-score` page adapts the explainable technical-portfolio rubric from HackerRank's MIT-licensed [Hiring Agent](https://github.com/interviewstreet/hiring-agent). It first extracts a structured, privacy-reduced technical profile, then evaluates open source, self-directed projects, production experience, and technical skills. An optional public GitHub username or profile URL adds contributor-aware analysis for up to ten high-signal repositories and selects up to seven projects with at least four attributed commits.

The integration uses the existing Next.js document parser and configured AI providers; it does not require the original Python runtime. Set `GITHUB_TOKEN` on the server to increase GitHub API limits. Never expose this token through a `NEXT_PUBLIC_` variable.

This output is intended for portfolio development, not automated hiring decisions. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for attribution.

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
