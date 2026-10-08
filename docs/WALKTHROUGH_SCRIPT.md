# LeadLens 1–2 Minute Video Walkthrough Script

**Target Duration**: 90–120 Seconds  
**Speaker Tone**: Professional, direct, and focused on real-world sales utility.

---

## [0:00 - 0:25] 1. The Real Sales Problem
> "Hi, I’m presenting **LeadLens**, a targeted lead qualification and sourcing workbench built for Caprae Capital’s sourcing workflow.
> 
> When sourcing B2B deals or prospective clients, sales reps usually start with a raw list of website URLs. The real pain isn't finding links—it's figuring out:
> - Which companies actually match our target market?
> - What public contact information is actually available?
> - And which accounts deserve our attention first?
> 
> LeadLens solves this through two focused workflows: **collecting and cleaning public business leads**, and **qualifying and prioritizing those leads with transparent scoring**."

---

## [0:25 - 0:55] 2. Collection Workflow & Partial Failure Handling
> *(Screen Share: Overview & Collect Page)*
> 
> "Starting on the **Overview**, we see real database metrics: total unique companies, high-priority accounts, email availability rate, and companies missing contact details.
> 
> Let’s navigate to **Collect**. We can paste up to 20 URLs or upload a CSV. Notice our two-step review: it immediately flags invalid URL formats, merges duplicate domains, and shows valid websites before sending any requests.
> 
> When we click **Start Collection**, our background worker fetches each site, parses JSON-LD structured data, and checks up to two internal contact pages.
> 
> If a site is unreachable, blocked, or returns a 404, the job continues smoothly without failing the batch. Here we see a concise summary: *'4 companies saved, 1 website failed collection'*, and we can retry failed sources with one click."

---

## [0:55 - 1:25] 3. Ranked Leads, Score Breakdown & Data Provenance
> *(Screen Share: Leads Directory & Details Drawer)*
> 
> "In the **Leads Directory**, leads are ranked using our deterministic 100-point scoring engine.
> 
> In **Target Criteria**, we can set our target industry, location, and keywords. Notice that if an industry is left blank, our algorithm dynamically excludes it from the denominator rather than penalizing the lead.
> 
> Using our quick filters, we can instantly isolate high-priority leads, accounts with verified public emails, or accounts missing contact data.
> 
> Opening a lead reveals its **Evidence & Provenance**: we see the exact score breakdown explaining why it ranks here, along with the extraction method—whether an industry was keyword-inferred, extracted from structured JSON-LD, or manually overridden."

---

## [1:25 - 1:45] 4. Safe Export & Honest Technical Limitation
> *(Screen Share: CSV Export & Terminal Test Suite)*
> 
> "When ready, we can export selected or filtered leads into a sanitized CSV with built-in Dynamic Data Exchange formula injection protection.
> 
> On the technical side, the application includes strict SSRF protection against private IP ranges and cloud metadata endpoints, with full test coverage across all extraction and scoring logic.
> 
> For an honest technical limitation: this 5-hour MVP uses static Cheerio parsing for fast sub-second extraction. Single-page applications that require client-side JavaScript execution are reported as unsupported rather than guessing data.
> 
> LeadLens delivers a reliable, explainable, and production-minded workbench for sales sourcing. Thank you!"
