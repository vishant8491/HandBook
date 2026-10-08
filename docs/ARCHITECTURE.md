# LeadLens System Architecture

## 1. High-Level System Overview

LeadLens is structured around a decoupled client-server architecture designed for high responsiveness, resilient web scraping, and auditable lead prioritization.

```
┌────────────────────────────────────────────────────────┐
│                   React + Vite Client                  │
│  (Tailwind CSS, Lucide Icons, Papa Parse, Accessible)  │
└──────────────────────────┬─────────────────────────────┘
                           │ REST HTTP JSON / CSV
                           ▼
┌────────────────────────────────────────────────────────┐
│                   Express.js Backend                   │
│   ┌─────────────────────────────────────────────────┐  │
│   │ Middleware: Zod Validation, CORS, Rate Limiter  │  │
│   └────────────────────────┬────────────────────────┘  │
│                            │                           │
│   ┌────────────────────────▼────────────────────────┐  │
│   │ API Routes: Health, Dashboard, Jobs, Leads, CSV │  │
│   └──────┬──────────────────────────────────┬───────┘  │
│          │                                  │          │
│   ┌──────▼──────────────┐            ┌──────▼───────┐  │
│   │ In-Process Worker   │            │ 100-Pt Score │  │
│   │ (Concurrency Pool)  │            │ Engine       │  │
│   └──────┬──────────────┘            └──────────────┘  │
│          │                                             │
│   ┌──────▼──────────────────────────────────────────┐  │
│   │ Scraper Service: SSRF check, DNS, robots.txt,   │  │
│   │ Cheerio HTML parser, JSON-LD, Link Traverser    │  │
│   └────────────────────────┬────────────────────────┘  │
└────────────────────────────┼───────────────────────────┘
                             │ Mongoose ODM
                             ▼
              ┌─────────────────────────────┐
              │       MongoDB Database      │
              │  - Leads (Unique Domain)    │
              │  - CollectionJobs           │
              │  - QualificationSettings    │
              └─────────────────────────────┘
```

---

## 2. Collection Job Lifecycle & Concurrency

1. **Submission & Deduplication**:
   - The user inputs up to 20 URLs via textarea or CSV upload.
   - The client parses and previews valid, duplicate, and invalid formats.
   - `POST /api/collection-jobs` receives the validated URLs. Duplicate hostnames within the same batch are merged.
   - The backend creates a `CollectionJob` document in state `pending` and immediately returns HTTP 201 Created.
2. **Background Execution**:
   - The in-process worker picks up the job and transitions it to `running`.
   - A concurrency pool runs up to `SCRAPE_CONCURRENCY` (default 2) simultaneous fetches.
   - For each URL:
     - Checks the 24-hour freshness cache in MongoDB. If fresh, serves existing data immediately.
     - Resolves DNS and validates destination IP against private, loopback, and metadata ranges (SSRF defense).
     - Checks `robots.txt` policy.
     - Fetches homepage HTML and parses JSON-LD (`@graph`, `Organization`, `LocalBusiness`), meta tags, OpenGraph, mailto, and tel links.
     - Follows at most 2 internal same-host links (e.g. `/contact`, `/about`) to gather missing emails or phone numbers.
     - Infers industry via keyword taxonomy and stores field evidence provenance.
     - Executes non-destructive upsert into MongoDB.
     - Updates per-URL job results and progress counters.
3. **Completion**:
   - When all items finish, status is marked `completed` (or `failed`).
   - The client UI polls every 1.5s to display live progress bars and per-URL results.
   - Failed URLs can be retried in a new batch with a single click.

---

## 3. Worker Crash Recovery & Interrupted State

Because the background worker runs in-process for this MVP, an unexpected server restart could leave active jobs stranded in a `running` state.

To guarantee system integrity:
- Upon startup, `server/src/index.js` invokes `recoverInterruptedJobs()`.
- Any jobs found in `status: 'running'` are transitioned to `status: 'interrupted'` with a clear error explanation and completion timestamp.
- The UI renders interrupted jobs with an amber status badge, allowing immediate resumption or retries.

---

## 4. MongoDB Data Model & Indexing Strategy

### `Lead` Collection
- `normalizedDomain`: String, **Unique Index**, lowercase, stripped of `www.`. Guarantees deduplication across different protocols (`http://` vs `https://`) and URL paths.
- `companyName`: String
- `website`: String
- `description`: String
- `emails`: Array of Strings
- `phones`: Array of Strings
- `industry`: String
- `industrySource`: Enum (`"keyword-inference"`, `"manual"`, `"unknown"`)
- `location`: String
- `locationSource`: Enum (`"structured-data"`, `"manual"`, `"unknown"`)
- `sourceUrls`: Array of Strings
- `fieldEvidence`: Array of `{ field, sourceUrl, method, rawValue }`
- `score`: Number (0–100), **Indexed** for fast sorting.
- `scoreBreakdown`: Object with per-criterion earned points and explanations.
- `outreachStatus`: Enum (`"new"`, `"shortlisted"`, `"contacted"`, `"not-relevant"`), **Indexed**.
- `lastScrapedAt`: Date, **Indexed** for TTL cache freshness checks.
- `isDemo`: Boolean, **Indexed**.

**Compound Text Index**:
- Indexes `companyName`, `description`, `industry`, and `location` for sub-millisecond server-side full-text searches.

---

## 5. Security & SSRF Defense Architecture

```
User Input URL
     │
     ▼
[URL Protocol & Port Check] ──> (Rejects ftp://, file://, custom ports)
     │
     ▼
[DNS Resolution] ──> Extracts all IPv4 / IPv6 addresses
     │
     ▼
[ipaddr.js Range Validator] ──> Blocks:
                                 - 127.0.0.0/8 (Loopback)
                                 - 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 (RFC 1918)
                                 - 169.254.169.254 (Cloud Metadata)
                                 - ::1, fe80::/10 (IPv6 link-local)
     │
     ▼
[Robots.txt Evaluator] ──> Respects user-agent disallow rules
     │
     ▼
[Bounded HTTP Request] ──> 8000ms timeout, 2MB max body size, HTML-only content type
     │
     ▼
[Manual Redirect Hop] ──> Revalidates target IP for every redirect (prevents DNS rebinding)
```

---

## 6. CSV Formula Injection (DDE) Defense

When exporting data to CSV, spreadsheet software (Microsoft Excel, Google Sheets, LibreOffice Calc) may automatically execute formulas if cell values begin with certain characters.

LeadLens inspects all exported string values:
- If a trimmed cell begins with `=`, `+`, `-`, `@`, `\t`, or `\r`, LeadLens prepends a single quotation mark `'`.
- This neutralizes formula interpretation and forces spreadsheet software to render the cell as plain text.

---

## 7. Target Deployment Architecture

| Tier | Service | Configuration |
| :--- | :--- | :--- |
| **Frontend** | Static Vite SPA on Vercel | Set `VITE_API_BASE_URL` to backend service URL. |
| **Backend** | Node Web Service on Render / Railway | Set `MONGODB_URI`, `PORT=5000`, `CLIENT_ORIGIN`. |
| **Database** | MongoDB Atlas Shared Tier (M0) | Dedicated database user, IP access allowlist. |
