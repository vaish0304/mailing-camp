# Mailing Camp — Resend campaign tool

A lightweight bulk-email tool for the AI Sales Assistant project. Upload a CSV/Excel
of contacts, organise them into **groups**, compose an HTML email with personalisation
tokens, and send to one or more groups through the **Resend API**. The sender address
is fixed server-side (set once in the Render backend), so campaigns always go out from
your verified domain.

```
mailing-camp/
├── backend/     Node + Express API, MongoDB (Mongoose), Resend  → deploy on Render
├── frontend/    React + Vite + Tailwind admin console            → deploy on Netlify
└── render.yaml  Render blueprint for the backend web service
```

---

## 1. CSV / Excel format

The importer accepts `.csv`, `.xlsx` and `.xls`. **Row 1 must be a header row.**
Only `email` is required; everything else is optional and used for personalisation.

| Column       | Required | Notes                                                    |
|--------------|----------|----------------------------------------------------------|
| `email`      | ✅       | Invalid or duplicate rows are skipped and reported       |
| `first_name` |          | token `{{first_name}}`                                   |
| `last_name`  |          | token `{{last_name}}`                                    |
| `company`    |          | token `{{company}}`                                      |
| `phone`      |          | WhatsApp number, stored for reference — token `{{phone}}`|
| `city`       |          | cluster/city, stored for reference — token `{{city}}`    |

Header names are matched loosely — `Email Address`, `First Name`, `Firm`, `Mobile`,
`WhatsApp`, `Town`, etc. all map to the right field. A ready-made template is at
[`backend/sample-recipients.csv`](backend/sample-recipients.csv) and can also be
downloaded from the UI.

Re-importing is safe: existing contacts (matched by email) are updated, not duplicated,
and blank cells never overwrite existing data.

---

## 2. Backend — deploy on Render

### Database — MongoDB Atlas
Create a free cluster at <https://www.mongodb.com/atlas>, add a database user, allow
network access (`0.0.0.0/0` for Render), and copy the connection string
(**Connect → Drivers**). Put the database name in the path, e.g.
`mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/mailing_camp`.

### Option A: Blueprint (recommended)
1. Push this folder to a Git repo.
2. Render → **New → Blueprint** → select the repo. `render.yaml` creates the web service.
3. After the first deploy, open the service → **Environment** and set:
   | Var | Example | |
   |---|---|---|
   | `MONGODB_URI` | `mongodb+srv://…/mailing_camp` | Atlas connection string |
   | `RESEND_API_KEY` | `re_...` | from <https://resend.com/api-keys> |
   | `FROM_EMAIL` | `campaigns@yourdomain.com` | must be on a **verified** Resend domain |
   | `FROM_NAME` | `AI Sales Assistant` | optional inbox display name |
   | `REPLY_TO` | `you@yourdomain.com` | optional |
   | `ADMIN_TOKEN` | *(random string)* | protects the API; the console asks for it |
   | `CORS_ORIGIN` | `https://your-console.netlify.app` | your frontend origin |
   | `PUBLIC_BASE_URL` | `https://mailing-camp-backend.onrender.com` | for unsubscribe links |
   | `RESEND_WEBHOOK_SECRET` | `whsec_...` | optional, enables delivery tracking |

### Option B: manual
Create a Render **Web Service** (root dir `backend`, build `npm install`, start
`npm start`) and set the vars above.

### Local dev
```bash
cd backend
cp .env.example .env      # fill in MONGODB_URI, RESEND_API_KEY, FROM_EMAIL
npm install
npm run dev                # uses your MONGODB_URI
# or, with no Atlas cluster — ephemeral in-memory MongoDB (data not persisted):
npm run dev:mem           # still needs RESEND_API_KEY + FROM_EMAIL in .env
```
Collections and indexes are created automatically on first connect. Health check: `GET /api/health`.

Run the integration test suite (spins up its own in-memory MongoDB, mocks Resend):
```bash
npm test
```

### Resend webhook (optional but recommended)
In Resend → **Webhooks**, add `https://<backend>/api/webhooks/resend` and subscribe to
`email.delivered`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`.
Put the signing secret in `RESEND_WEBHOOK_SECRET`. The History tab then shows live
delivery/open/bounce status, and bounced/complained addresses are auto-unsubscribed.

---

## 3. Frontend — deploy on Netlify

1. Netlify → **Add new site → Import**, pick the repo.
2. Base directory `frontend`, build `npm run build`, publish `frontend/dist`
   (already set in [`frontend/netlify.toml`](frontend/netlify.toml)).
3. Env var `VITE_API_BASE` = your Render backend URL.
4. On first load, open **Settings** in the app and enter the backend URL + `ADMIN_TOKEN`
   (stored in the browser only).

### Local dev
```bash
cd frontend
cp .env.example .env      # VITE_API_BASE=http://localhost:8080
npm install
npm run dev
```

---

## 4. Using it

1. **Groups & Recipients** — create a group (e.g. *"Pune CCTV dealers"*), upload a CSV.
2. **Compose & Send** — write the subject and HTML body, use `{{first_name}}` etc.
   for personalisation, **Preview** against a real contact, **Send test** to yourself,
   then **Send** to the selected groups.
3. **History** — watch each campaign send in real time with per-recipient status.

Sending runs in the background in batches of 100 (Resend's batch endpoint), throttled
by `BATCH_DELAY_MS`. Unsubscribed contacts and cross-group duplicates are removed at
send time. Every email gets an unsubscribe footer and `List-Unsubscribe` header.

---

## API reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | status + configured sender |
| `GET/POST` | `/api/groups` | list / create groups |
| `PATCH/DELETE` | `/api/groups/:id` | rename / delete group |
| `GET` | `/api/groups/:id/recipients` | list members |
| `POST` | `/api/groups/:id/import` | multipart `file` — CSV/XLSX import |
| `DELETE` | `/api/groups/:id/members/:recipientId` | remove from group |
| `GET/PATCH/DELETE` | `/api/recipients[/:id]` | manage contacts |
| `POST` | `/api/campaigns/preview` | recipient count + rendered sample |
| `POST` | `/api/campaigns/test` | send a one-off `[TEST]` email |
| `POST` | `/api/campaigns` | create + start a campaign |
| `GET` | `/api/campaigns[/:id]` | history / per-recipient detail |
| `GET` | `/api/unsubscribe?email=` | one-click unsubscribe (public) |
| `POST` | `/api/webhooks/resend` | Resend delivery events (public, signed) |

All `/api/groups`, `/api/recipients`, `/api/campaigns` routes require
`Authorization: Bearer <ADMIN_TOKEN>` when `ADMIN_TOKEN` is set.
