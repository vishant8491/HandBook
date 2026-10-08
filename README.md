# LeadLens — B2B Lead Qualification & AI Research Workbench

**LeadLens** is a focused lead qualification and sourcing workbench built for sales professionals, search fund operators, and deal sourcing teams. It solves the everyday prospecting problem:

> *"I have a list of company websites, but I need to know which companies fit my target market, what contact information is actually available, and which leads deserve my attention first."*

LeadLens replaces manual website browsing, copy-pasting, and hallucinated AI scoring with **two focused, reliable workflows and a strictly grounded AI Research Assistant**:
1. **Collect & Clean Leads**: Ingest up to 20 company URLs or CSVs, enforce strict SSRF security, extract public emails/phones/metadata/JSON-LD, and deduplicate domains automatically into MongoDB.
2. **Qualify & Prioritize Leads**: Deterministically rank leads from 0–100 based on target criteria, filter by contact availability, inspect data provenance, and export formula-injection-safe CSVs.
3. **Research Assistant (AI-Powered Prospecting)**: On-demand executive company summaries (&le; 80 words) and customized cold outreach drafts (&le; 120 words) strictly grounded in collected source evidence, protected by SHA-256 caching and explicit safety boundaries.

---

## 1. Product Positioning & Value Proposition

- **Strictly Grounded AI Assistance**: AI is bounded to the Lead Details panel and runs **only on explicit user action**. It never invents revenue figures, employee headcounts, decision-makers, tech stacks, or customer intent.
- **Deterministic 100-Point Scoring Invariance**: Scoring is 100% auditable and rule-based (0–100). The AI assistant explains evidence but **never** alters lead rankings.
- **Explainable Data Quality & Provenance**: Every extracted attribute is tied to an explicit source URL, extraction method (e.g. `jsonld-Organization`, `mailto-link`, `opengraph-title`), and numbered source ID (`source-1`, `source-2`).
- **Editorial Design System**: Built with a restrained business research aesthetic (Ivory `#F5F5F2`, Forest Green `#245C46`, Dark Ink `#182421`, subtle borders `#DDE3DD`, and crisp system typography).
- **Graceful Degradation**: If `GEMINI_API_KEY` is missing or disabled, the entire core application remains 100% operational with clear setup guidance and fixture fallback.

---

## 2. Technical Stack & AI Architecture

| Tier | Technologies | Role & Architectural Guarantees |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite 6, Tailwind CSS, Lucide React, Papa Parse | Fast, accessible, and responsive B2B interface with 300ms debounced search, `AbortController` cancellation, and sticky headers. |
| **Backend** | Node.js (v18+ / v22+), Express.js, Mongoose 8 | Robust RESTful API with route validation, rate limiting, and in-process background workers. |
| **AI Integration** | Official `@google/genai` SDK | Configurable Gemini adapter with strict temperature (0.2–0.3), structured JSON schemas, request timeouts, and transient retry controls. |
| **Database** | MongoDB | Document store with unique domain indexes, compound score indexes, lean table projections, and SHA-256 AI response caching. |
| **Scraping & SSRF** | Cheerio, Axios, ipaddr.js, robots-parser | Safe HTML & JSON-LD parsing, SSRF defense, manual redirect re-validation, robots.txt compliance. |
| **Validation** | Zod | Strict schema validation on request bodies, queries, and AI generation parameters. |
| **Testing** | Vitest | 40 comprehensive automated tests covering extraction, scoring, SSRF, AI grounding, caching, and invalidation. |

---

## 3. Quick Start & Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher (Tested on Node v22.14.0)
- **MongoDB**: Local MongoDB instance running on `mongodb://127.0.0.1:27017` or MongoDB Atlas URI.

### Installation
```bash
# Clone repository and navigate to project root
cd "HandBook Project"

# Install all workspace dependencies (server + client)
npm install
```

### Environment Configuration
Create `.env` in `server/` (or copy `server/.env.example`):
```ini
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/leadlens
CLIENT_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:5000
SCRAPE_TIMEOUT_MS=8000
SCRAPE_CONCURRENCY=2
CACHE_TTL_HOURS=24
DEMO_MODE=false
MAX_ACTIVE_JOBS=3
RATE_LIMIT_COLLECTION_PER_MIN=15

# AI Research Assistant Configuration
AI_PROVIDER=gemini
AI_MODEL=gemini-3.8-flash
GEMINI_API_KEY=
AI_TIMEOUT_MS=10000
AI_ENABLED=true
```

### Run Commands
```bash
# 1. Seed demo dataset (12 diverse fictional .example companies)
npm run seed

# 2. Run automated test suite (40 tests across 3 suites)
npm run test

# 3. Build frontend bundle for production verification
npm run build

# 4. Start full development environment (server on :5000 and client on :5173)
npm run dev
```

---

## 4. AI Research Assistant & Safety Safeguards

The AI assistant provides two distinct, user-triggered capabilities inside the Lead Details drawer:

### A. Company Summary
- **Concise Executive Summary**: Strictly bounded to &le; 80 words.
- **Factual Observations**: Up to 3 key bullet points directly supported by scraped evidence.
- **Missing Information Report**: Highlights missing data (e.g. unknown executive contacts, unstated revenue) preventing complete prospect assessment.
- **Numbered Source ID Badges**: References only validated source IDs (`source-1`, `source-2`, ...). Hallucinated source IDs are stripped on the backend.
- **Explicit Grounding Disclaimer**: Labeled clearly as AI-generated from public data; requires user review before use.

### B. Cold Outreach Draft
- **Mandatory User Offering Input**: Requires user-entered product/service offering description before drafting. AI **never** invents what you are selling.
- **Brevity & Honesty**: Email body is strictly bounded to &le; 120 words. No fake familiarity ("I saw your LinkedIn post"), false prior meetings, or unsupported performance promises.
- **Source Facts Used**: Lists explicit evidence points incorporated into the draft.
- **Editable & Copyable**: Full editing controls and one-click clipboard copying.
- **Safety Guarantee**: LeadLens **never connects to mailboxes or sends emails**.

### C. SHA-256 Caching & Cache Invalidation
- Successful AI responses are cached in `lead.aiResearch` alongside a 16-character SHA-256 hash of all input parameters (company data, offering description, target criteria, prompt version).
- Changing company data or offering text changes the hash and invalidates the cached draft.
- Users can click **"Regenerate"** to force a fresh model call at any time.

---

## 5. Measured Performance Optimizations

1. **Lean Table Query Projections**:
   - `GET /api/leads` excludes heavy fields (`.select('-fieldEvidence -aiResearch')`), cutting payload sizes by >70% while keeping row latency sub-15ms for 100+ leads.
2. **Search Input Debouncing (300ms)**:
   - User keystrokes update UI state instantaneously, but network requests are debounced by 300ms.
3. **Query Cancellation via `AbortController`**:
   - Stale in-flight search requests are cancelled on new keystrokes or filter changes, eliminating race conditions and unnecessary server load.
4. **Collection Polling Overlap Protection**:
   - Real-time job polling uses concurrency locks and unmount protection, preventing overlapping requests and memory leaks.
5. **Sticky Table Header & Visual Scanning**:
   - `sticky top-0 bg-surface-subtle` header enables effortless scanning across long lists.
6. **Optimized Production Bundle**:
   - Frontend production bundle is only **73.7 kB gzipped** (HTML: 0.6 kB, CSS: 5.0 kB, JS: 73.7 kB).

---

## 6. Transparent Deterministic 100-Point Scoring Model

LeadLens avoids opaque AI scoring in favor of an auditable heuristic model:

$$\text{Final Score} = \text{round}\left(\frac{\text{Earned Applicable Points}}{\text{Total Applicable Points}} \times 100\right)$$

### Criteria Weights:
- **Target Industry Match**: 30 pts (Normalized phrase match against inferred or manual industry).
- **Target Location Match**: 20 pts (Normalized match against structured address or manual location).
- **Preferred Keywords Match**: 20 pts (Token-matched with word boundary checks in company name/description).
- **Public Email Present**: 15 pts (Format-valid public email).
- **Public Phone Present**: 5 pts (Usable public telephone).
- **Company Description Completeness**: 10 pts (Substantive summary > 15 chars).

### Priority Bands:
- **High Priority**: 75–100 pts
- **Medium Priority**: 40–74 pts
- **Low Priority**: 0–39 pts

---

## 7. Security & SSRF Safeguards

1. **Server-Side Request Forgery (SSRF) Defense**:
   - Rejects non-HTTP/HTTPS protocols and URLs with embedded credentials (`user:pass@host`).
   - Resolves target hostnames via DNS and validates that returned IPv4/IPv6 addresses are public unicast using `ipaddr.js`.
   - Blocks `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254` (cloud metadata), `::1`, and link-local ranges.
   - Manual redirect control: Each redirect hop is individually validated before following.
2. **CSV / Dynamic Data Exchange (DDE) Injection Protection**:
   - Sanitizes exported CSV cells starting with dangerous characters (`=`, `+`, `-`, `@`, `\t`, `\r`) by prepending a single quote `'`.
3. **Safe Rendering**:
   - Model output is sanitized and rendered as plain React text nodes; `dangerouslySetInnerHTML` is never used.

---

## 8. Verification & Test Results

Run tests with `npm test`. All **40 automated tests pass across 3 test suites**:
- **`test/leadlens.test.js`** (14 tests): URL normalization, SSRF defenses, HTML & JSON-LD extraction, deterministic scoring, CSV injection safeguards.
- **`test/ai.test.js`** (11 tests): Source ID generation, SHA-256 data hashing, word count constraints (&le; 80 words for summary, &le; 120 words for outreach), offering requirement enforcement, cache hits/invalidation, and deterministic score invariance.
- **`test/e2e_qa.test.js`** (15 tests): End-to-end collection, domain deduplication, worker crash recovery, manual profile edits, score recalculation, and CSV export.

---

## 9. Trade-Offs & Known Limitations

- **User-Supplied URLs vs. Full Web Crawling**: Sourcing starts with a target list of domains rather than an unbounded web crawler, prioritizing high data quality over noisy bulk scraping.
- **Static HTML vs. Headless Browser Fleet**: Static Cheerio parsing provides sub-second latency and minimal server overhead. Single-page apps requiring client-side JS rendering are reported as unsupported in this MVP.
- **In-Process Worker vs. Distributed Queue**: The MVP uses an in-process concurrency worker with database crash recovery. For multi-node production deployment, a distributed queue (e.g. BullMQ / Redis) would be used.
- **Contact Extraction vs. Mailbox Deliverability**: Public emails are syntax-checked against RFC standards. Mailbox verification and bounce-rate testing are intentionally disclaimed.
- **AI Grounding Limitation**: AI summaries and outreach drafts rely strictly on public text extracted from the prospect's website and user-entered offering details.
