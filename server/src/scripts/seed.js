import { connectDB, disconnectDB } from '../db.js';
import { Lead } from '../models/Lead.js';
import { QualificationSetting } from '../models/QualificationSetting.js';
import { calculateLeadScore } from '../services/scorer.js';

const DEMO_LEADS = [
  // High Priority SaaS / Enterprise leads
  {
    companyName: 'ApexFlow Systems',
    website: 'https://apexflow.example',
    normalizedDomain: 'apexflow.example',
    description: 'Enterprise B2B workflow orchestration and automated CI/CD software platform for cloud engineering teams.',
    industry: 'SaaS & Enterprise Software',
    industrySource: 'keyword-inference',
    location: 'San Francisco, CA',
    locationSource: 'structured-data',
    emails: ['sales@apexflow.example', 'contact@apexflow.example'],
    phones: ['+1 (415) 555-0101'],
    sourceUrls: ['https://apexflow.example', 'https://apexflow.example/about'],
    fieldEvidence: [
      { field: 'companyName', sourceUrl: 'https://apexflow.example', method: 'jsonld-Organization', rawValue: 'ApexFlow Systems' },
      { field: 'emails', sourceUrl: 'https://apexflow.example', method: 'mailto-link', rawValue: 'sales@apexflow.example' },
      { field: 'location', sourceUrl: 'https://apexflow.example', method: 'jsonld-postaladdress', rawValue: 'San Francisco, CA' },
      { field: 'industry', sourceUrl: 'https://apexflow.example', method: 'keyword-inference', rawValue: 'Matched SaaS & Enterprise Software' }
    ],
    outreachStatus: 'new',
    isDemo: true,
  },
  {
    companyName: 'CloudScale DevOps',
    website: 'https://cloudscale.example',
    normalizedDomain: 'cloudscale.example',
    description: 'High-availability Kubernetes clusters, cloud observability platform, and automated container scaling tools for B2B enterprises.',
    industry: 'SaaS & Enterprise Software',
    industrySource: 'keyword-inference',
    location: 'San Francisco, CA',
    locationSource: 'structured-data',
    emails: ['hello@cloudscale.example', 'inquiries@cloudscale.example'],
    phones: ['+1 (415) 555-0199'],
    sourceUrls: ['https://cloudscale.example'],
    fieldEvidence: [
      { field: 'companyName', sourceUrl: 'https://cloudscale.example', method: 'opengraph-title', rawValue: 'CloudScale DevOps' },
      { field: 'emails', sourceUrl: 'https://cloudscale.example', method: 'mailto-link', rawValue: 'hello@cloudscale.example' }
    ],
    outreachStatus: 'contacted',
    isDemo: true,
  },
  {
    companyName: 'OmniData Fabric',
    website: 'https://omnidata.example',
    normalizedDomain: 'omnidata.example',
    description: 'Unified real-time data streaming, lakehouse governance, and enterprise analytics platform for high-scale organizations.',
    industry: 'SaaS & Enterprise Software',
    industrySource: 'keyword-inference',
    location: 'San Francisco, CA',
    locationSource: 'structured-data',
    emails: ['leads@omnidata.example'],
    phones: ['+1 (415) 555-0167'],
    sourceUrls: ['https://omnidata.example'],
    fieldEvidence: [
      { field: 'companyName', sourceUrl: 'https://omnidata.example', method: 'jsonld-Organization', rawValue: 'OmniData Fabric' }
    ],
    outreachStatus: 'shortlisted',
    isDemo: true,
  },
  // Medium Priority Leads
  {
    companyName: 'PulseHealth AI',
    website: 'https://pulsehealth.example',
    normalizedDomain: 'pulsehealth.example',
    description: 'AI-assisted medical diagnostics and clinical hospital management platform for digital healthcare providers.',
    industry: 'Healthcare & Life Sciences',
    industrySource: 'keyword-inference',
    location: 'Boston, MA',
    locationSource: 'structured-data',
    emails: ['partnerships@pulsehealth.example'],
    phones: ['+1 (617) 555-0188'],
    sourceUrls: ['https://pulsehealth.example'],
    fieldEvidence: [
      { field: 'companyName', sourceUrl: 'https://pulsehealth.example', method: 'opengraph-site_name', rawValue: 'PulseHealth AI' },
      { field: 'industry', sourceUrl: 'https://pulsehealth.example', method: 'keyword-inference', rawValue: 'Matched Healthcare & Life Sciences' }
    ],
    outreachStatus: 'shortlisted',
    isDemo: true,
  },
  {
    companyName: 'FinVortex Global',
    website: 'https://finvortex.example',
    normalizedDomain: 'finvortex.example',
    description: 'Next-gen payment processing infrastructure, embedded banking APIs, and financial fraud detection software.',
    industry: 'Fintech & Financial Services',
    industrySource: 'keyword-inference',
    location: 'New York, NY',
    locationSource: 'structured-data',
    emails: ['team@finvortex.example'],
    phones: ['+1 (212) 555-0144'],
    sourceUrls: ['https://finvortex.example', 'https://finvortex.example/contact'],
    fieldEvidence: [
      { field: 'companyName', sourceUrl: 'https://finvortex.example', method: 'jsonld-Corporation', rawValue: 'FinVortex Global' }
    ],
    outreachStatus: 'new',
    isDemo: true,
  },
  {
    companyName: 'CyberShield Sentinel',
    website: 'https://cybershield.example',
    normalizedDomain: 'cybershield.example',
    description: 'Zero-trust enterprise cybersecurity suite, endpoint protection, and automated threat intelligence detection platform.',
    industry: 'SaaS & Enterprise Software',
    industrySource: 'keyword-inference',
    location: 'San Jose, CA',
    locationSource: 'structured-data',
    emails: ['security@cybershield.example'],
    phones: [],
    sourceUrls: ['https://cybershield.example'],
    fieldEvidence: [
      { field: 'companyName', sourceUrl: 'https://cybershield.example', method: 'jsonld-Organization', rawValue: 'CyberShield Sentinel' }
    ],
    outreachStatus: 'shortlisted',
    isDemo: true,
  },
  {
    companyName: 'ShopCraft Studio',
    website: 'https://shopcraft.example',
    normalizedDomain: 'shopcraft.example',
    description: 'Headless e-commerce storefront builder and multi-channel inventory management software for direct-to-consumer brands.',
    industry: 'E-Commerce & Retail',
    industrySource: 'keyword-inference',
    location: 'Austin, TX',
    locationSource: 'structured-data',
    emails: ['support@shopcraft.example'],
    phones: ['+1 (512) 555-0166'],
    sourceUrls: ['https://shopcraft.example'],
    fieldEvidence: [
      { field: 'companyName', sourceUrl: 'https://shopcraft.example', method: 'jsonld-Organization', rawValue: 'ShopCraft Studio' }
    ],
    outreachStatus: 'new',
    isDemo: true,
  },
  {
    companyName: 'NovaFreight Logistics',
    website: 'https://novafreight.example',
    normalizedDomain: 'novafreight.example',
    description: 'Smart freight marketplace, warehouse IoT tracking, and industrial logistics supply chain management platform.',
    industry: 'Industrial & Manufacturing',
    industrySource: 'keyword-inference',
    location: 'Chicago, IL',
    locationSource: 'structured-data',
    emails: ['dispatch@novafreight.example'],
    phones: ['+1 (312) 555-0122'],
    sourceUrls: ['https://novafreight.example'],
    fieldEvidence: [
      { field: 'companyName', sourceUrl: 'https://novafreight.example', method: 'html-title-tag', rawValue: 'NovaFreight Logistics' }
    ],
    outreachStatus: 'new',
    isDemo: true,
  },
  // Leads with Missing Email or Missing Phone to test data quality filters
  {
    companyName: 'BioGenix Analytics',
    website: 'https://biogenix.example',
    normalizedDomain: 'biogenix.example',
    description: 'Genomic data pipeline and clinical biomarker discovery software for life sciences and pharmaceutical research.',
    industry: 'Healthcare & Life Sciences',
    industrySource: 'keyword-inference',
    location: 'San Diego, CA',
    locationSource: 'structured-data',
    emails: [], // Missing Email
    phones: ['+1 (858) 555-0133'],
    sourceUrls: ['https://biogenix.example'],
    fieldEvidence: [
      { field: 'companyName', sourceUrl: 'https://biogenix.example', method: 'opengraph-site_name', rawValue: 'BioGenix Analytics' }
    ],
    outreachStatus: 'new',
    isDemo: true,
  },
  {
    companyName: 'HyperGrowth Media',
    website: 'https://hypergrowth.example',
    normalizedDomain: 'hypergrowth.example',
    description: 'Performance marketing agency specializing in customer acquisition, conversion rate optimization, and brand scaling.',
    industry: 'Marketing & Digital Media',
    industrySource: 'keyword-inference',
    location: 'Los Angeles, CA',
    locationSource: 'structured-data',
    emails: ['growth@hypergrowth.example'],
    phones: [], // Missing Phone
    sourceUrls: ['https://hypergrowth.example'],
    fieldEvidence: [
      { field: 'companyName', sourceUrl: 'https://hypergrowth.example', method: 'html-title-tag', rawValue: 'HyperGrowth Media' }
    ],
    outreachStatus: 'new',
    isDemo: true,
  },
  // Lead with Unknown Industry & Unknown Location
  {
    companyName: 'Vanguard Stealth Lab',
    website: 'https://vanguardlab.example',
    normalizedDomain: 'vanguardlab.example',
    description: 'Specialized technology research laboratory conducting experimental investigations.',
    industry: 'Unknown',
    industrySource: 'unknown',
    location: 'Unknown',
    locationSource: 'unknown',
    emails: [],
    phones: [],
    sourceUrls: ['https://vanguardlab.example'],
    fieldEvidence: [
      { field: 'companyName', sourceUrl: 'https://vanguardlab.example', method: 'html-title-tag', rawValue: 'Vanguard Stealth Lab' }
    ],
    outreachStatus: 'new',
    isDemo: true,
  },
  // Lead with User-Manual Provenance Overrides
  {
    companyName: 'TerraProperty Tech',
    website: 'https://terraprop.example',
    normalizedDomain: 'terraprop.example',
    description: 'Commercial real estate portfolio asset management, smart lease analysis, and tenant portal software platform.',
    industry: 'Real Estate & Property',
    industrySource: 'manual',
    location: 'Dallas, TX',
    locationSource: 'manual',
    emails: ['info@terraprop.example'],
    phones: ['+1 (214) 555-0155'],
    sourceUrls: ['https://terraprop.example'],
    fieldEvidence: [
      { field: 'companyName', sourceUrl: 'https://terraprop.example', method: 'jsonld-Organization', rawValue: 'TerraProperty Tech' },
      { field: 'industry', sourceUrl: 'https://terraprop.example', method: 'user-input-csv', rawValue: 'Real Estate & Property' },
      { field: 'location', sourceUrl: 'https://terraprop.example', method: 'user-input-csv', rawValue: 'Dallas, TX' }
    ],
    outreachStatus: 'not-relevant',
    isDemo: true,
  },
];

async function seed() {
  try {
    await connectDB();
    console.log('[Seed] Connected to database. Seeding demo dataset...');

    let settings = await QualificationSetting.findOne({ isActive: true });
    if (!settings) {
      settings = await QualificationSetting.create({
        targetIndustry: 'SaaS & Enterprise Software',
        targetLocation: 'San Francisco, CA',
        preferredKeywords: ['b2b', 'software', 'platform', 'cloud', 'enterprise', 'ai'],
      });
    }

    let seededCount = 0;
    for (const leadData of DEMO_LEADS) {
      const scoreResult = calculateLeadScore(leadData, settings);

      await Lead.findOneAndUpdate(
        { normalizedDomain: leadData.normalizedDomain },
        {
          $set: {
            ...leadData,
            score: scoreResult.finalScore,
            scoreBreakdown: scoreResult,
            lastScrapedAt: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      seededCount += 1;
    }

    console.log(`[Seed] Successfully seeded ${seededCount} diverse demo leads with scored priorities.`);
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Seeding failed:', err.message);
    process.exit(1);
  }
}

seed();
