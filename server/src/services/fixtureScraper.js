import { extractPageData } from './extractor.js';
import { normalizeDomain } from '../utils/url.js';

export const FIXTURE_PAGES = {
  'acmecloud.example': `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>AcmeCloud | Enterprise DevOps & Cloud Platform</title>
        <meta name="description" content="AcmeCloud accelerates enterprise cloud infrastructure and automated devops pipelines for high-growth software teams." />
        <meta property="og:site_name" content="Acme Cloud Technologies" />
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Corporation",
            "name": "Acme Cloud Technologies",
            "description": "Enterprise cloud automation and devops software platform.",
            "email": "sales@acmecloud.example",
            "telephone": "+1 (415) 555-0199",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "San Francisco",
              "addressRegion": "CA",
              "addressCountry": "USA"
            }
          }
        </script>
      </head>
      <body>
        <main>
          <h1>Next-Generation Cloud Orchestration</h1>
          <p>Deliver software 10x faster with our unified B2B platform and automated continuous deployment engine.</p>
          <a href="/contact">Contact Our Team</a>
        </main>
      </body>
    </html>
  `,
  'medipulse.example': `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>MediPulse - AI Patient Care & Diagnostics</title>
        <meta name="description" content="Modern clinical diagnostics platform connecting hospital networks and patient care providers." />
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "MedicalOrganization",
            "name": "MediPulse Health",
            "email": "info@medipulse.example",
            "telephone": "+1 (617) 555-4321",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Boston",
              "addressRegion": "MA",
              "addressCountry": "USA"
            }
          }
        </script>
      </head>
      <body>
        <h1>Revolutionizing Clinical Healthcare</h1>
        <p>Advanced diagnostic intelligence for healthcare providers and clinical research teams.</p>
      </body>
    </html>
  `,
  'finscale.example': `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>FinScale Payments | Global Banking API</title>
        <meta name="description" content="FinScale empowers fintech platforms and global merchants with next-gen automated payment processing." />
      </head>
      <body>
        <header>
          <h1>FinScale Financial Infrastructure</h1>
        </header>
        <section>
          <p>Global payments, banking integrations, and lending software for fast-growing financial services companies.</p>
          <div>Direct inquiries: <a href="mailto:partnerships@finscale.example">partnerships@finscale.example</a></div>
          <div>Call us: <a href="tel:+1-212-555-8833">+1 (212) 555-8833</a></div>
        </section>
      </body>
    </html>
  `,
  'novalogistics.example': `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Nova Logistics - Supply Chain & Freight Solutions</title>
        <meta name="description" content="Smart logistics and industrial supply chain management for modern manufacturing enterprises." />
      </head>
      <body>
        <h1>Nova Freight & Industrial Automation</h1>
        <p>End-to-end warehouse management, freight routing, and manufacturing supply chain optimization.</p>
        <p>Email our dispatch: operations@novalogistics.example | Phone: +1-312-555-0944</p>
      </body>
    </html>
  `,
  'shoppulse.example': `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>ShopPulse - Direct to Consumer E-Commerce Platform</title>
        <meta name="description" content="All-in-one storefront, retail inventory, and DTC commerce acceleration engine." />
      </head>
      <body>
        <h1>Grow your online store with ShopPulse</h1>
        <p>The leading e-commerce shop management and direct-to-consumer merchandising platform.</p>
        <p>Contact: hello@shoppulse.example</p>
      </body>
    </html>
  `,
};

export function getFixtureDataForDomain(urlOrDomain) {
  const domain = normalizeDomain(urlOrDomain);

  // Controlled failure for testing error handling in fixture mode
  if (domain.includes('fail') || domain.includes('error') || domain.includes('offline')) {
    throw new Error(`Controlled failure: Domain "${domain}" is unreachable (DNS_PROBE_FAILED)`);
  }

  // Direct match or partial match
  const matchKey = Object.keys(FIXTURE_PAGES).find(
    (key) => domain === key || domain.includes(key.split('.')[0])
  );

  if (matchKey) {
    const html = FIXTURE_PAGES[matchKey];
    return extractPageData(html, `https://${domain}`);
  }

  // Generative fallback fixture for any arbitrary .example or demo domain
  const brandName = domain.split('.')[0].replace(/[-_]/g, ' ');
  const capitalized = brandName
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const genericHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${capitalized} - Modern Business Platform</title>
        <meta name="description" content="${capitalized} provides high-performance software and scalable workflow solutions for modern enterprises." />
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "${capitalized}",
            "email": "contact@${domain}",
            "telephone": "+1 (800) 555-0100",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Austin",
              "addressRegion": "TX",
              "addressCountry": "USA"
            }
          }
        </script>
      </head>
      <body>
        <h1>Welcome to ${capitalized}</h1>
        <p>${capitalized} is dedicated to delivering industry-leading B2B cloud software and technology services.</p>
      </body>
    </html>
  `;

  return extractPageData(genericHtml, `https://${domain}`);
}
