# MailCleaner — Smart Gmail Inbox Cleaner

> Bulk-clean your Gmail inbox in seconds. Unsubscribe, trash by category, and set auto-delete rules — all from a fast, private dashboard.

---

## Features

- **Inbox Cleaner** — scan up to 1 000 emails, filter by category (heavy files, ancient mail, mass notifications, etc.) and trash in bulk.
- **1-Click Unsubscribe** — detect and fire unsubscribe links for mailing lists without leaving the app.
- **Cleaning Wizard** — step-by-step guided flow that walks you through every email category with trash / unsubscribe / keep actions.
- **Auto-Delete Rules** — save patterns from the wizard so future email batches are automatically cleaned on the next sync.
- **Blocklist** — permanently block senders so they never clutter your inbox again.
- **Digital Footprint** *(coming soon)* — account breach inspection and password hygiene tools.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Auth | Google OAuth 2.0 |
| Database | Supabase (Postgres) |
| Styling | Tailwind CSS |
| Email API | Gmail REST API |

---

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/your-org/mail-cleaner.git
cd mail-cleaner
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables are documented in [`.env.example`](.env.example).

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment

The easiest deployment target is [Vercel](https://vercel.com). Push to your connected repository and set the environment variables in the Vercel dashboard — no extra configuration needed.

---

## Privacy

- No email content is stored; only metadata (sender, size, date, flags) is processed.
- OAuth tokens are stored server-side in Supabase and never exposed to the client.
- Auto-delete rules are stored in `localStorage` on the user's device only.
