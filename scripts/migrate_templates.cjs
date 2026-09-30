const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── 7 Work Details Updates (Google XYZ standard formula) ─────────────────────
const workUpdates = {
  // 1. Understand Spec-Driven Development (2026-09-19)
  '8a2876fa-39f8-40e6-9c91-57b35b265bb6': `### 🎯 Objective & Context
Conduct an in-depth research investigation into Spec-Driven Development (SDD) methodologies to establish an engineering standard for the studio, comparing open-source workflows against proprietary vendor tools.

### 🛠️ Technical Execution [Doing Z]
* **Workflow Analysis**: Analyzed the end-to-end SDD lifecycle (\`constitution → specify → clarify → plan → tasks → implement → verify\`), clarifying the architectural distinction between spec-as-source-of-truth and code-first TDD/BDD.
* **Comparative Framework Benchmarking**: Evaluated GitHub Spec Kit (free, open, agent-agnostic), AWS Kiro (proprietary bundled IDE), OpenSpec, BMAD-METHOD, and Tessl. Debunked vendor lock-in misconceptions around AWS Kiro (supports 20+ languages without AWS accounts; lock-in stems from proprietary spec engines and Bedrock token billing).
* **Cost & Token Economics Deep Dive**: Benchmarked the $20/month tier head-to-head (Claude Pro + Spec Kit vs. AWS Kiro Pro), analyzing token/credit pooling behaviors, IDE restrictions, and cross-model interoperability across 30+ coding agents (Claude, Gemini CLI, Google Antigravity, OpenRouter).
* **Technical Documentation**: Authored and iterated a 2-page decision brief incorporating team feedback and pricing trade-offs.

### 🏆 Key Accomplishments [Accomplished X]
* Delivered the official studio SDD Framework Recommendation Report (\`SDD_Framework_Recommendation.pdf\`) recommending GitHub Spec Kit as the open studio standard while preserving model-backend flexibility.

### 📊 Measured Impact & Metrics [Measured by Y]
* **Interoperability**: Validated compatibility across **30+ AI agents**, enabling cross-team credit reuse and zero single-vendor lock-in.
* **Deliverable**: Published finalized \`SDD_Framework_Recommendation.pdf\` adopted for executive tool-selection discussions.`,

  // 2. Project Scaffolding & First Spec (2026-09-21)
  '38adab3e-4a31-42a2-91d1-2fa54366af3c': `### 🎯 Objective & Context
Initialize and scaffold the Apollo Books prototype—an agentic AI accounting platform for Australian SMBs—establishing foundational architecture docs and the initial database integration specification.

### 🛠️ Technical Execution [Doing Z]
* **Architecture & Governance Scaffolding**: Authored foundational project context specifications including System Architecture Documentation, UI Context Specifications, Coding Standards, Project Tracker, and the core \`agent.md\` operational guidelines.
* **Database & Spec Modeling**: Formulated the initial project specification defining the relational dummy accounting schema (accounts, transactions, invoices, receipts) designed to decouple rapid agent prototyping from complex third-party accounting ERP integrations.
* **Backend Agent Scaffolding**: Designed the conversational orchestrator pipeline to handle natural language accounting queries and delegate to specialized financial sub-agents.

### 🏆 Key Accomplishments [Accomplished X]
* Established complete system architectural baselines and delivered the first formal database schema specification for the Apollo Books platform.

### 📊 Measured Impact & Metrics [Measured by Y]
* **Specification Coverage**: Produced **5 foundational architectural documents** (\`agent.md\`, Architecture, UI Context, Code Standards, Project Tracker) and 100% of the initial database schema specification.
* **Execution Velocity**: Enabled parallel frontend and agent workflow engineering with zero uncoordinated dependencies.`,

  // 3. Apolobooks Home Section Implementation (2026-09-21)
  '1217926c-9b25-4a6d-bb6d-aae597adcb8e': `### 🎯 Objective & Context
Implement a pixel-perfect Home section for Apollo Books matching Figma V2 designs and transform the static "Ask Chase anything" drawer into an interactive state machine for investor demonstrations.

### 🛠️ Technical Execution [Doing Z]
* **Conversational State Machine**: Upgraded the Chase assistant drawer from a static mockup into a dynamic state machine with simulated 600ms AI latency, multi-stage turn sequencing, and smooth slide-up animations terminating in an interactive Decision Card.
* **Layout & Sticky Ergonomics**: Engineered \`100dvh\` sticky sidebar positioning to anchor profile and session controls permanently during viewport scrolling, standardizing IBM Plex Sans / Google Sans typography, 12px radii, and elevation shadows.
* **Design Token Auditing & Blocker Analysis**: Parsed a 20MB local Figma cache to extract Desk typography and spacing specs; diagnosed and documented an upstream Figma API 429 rate limit blocking animated flow frame extraction.
* **Cloud Deployment Pipeline**: Built and deployed the updated prototype to Netlify with clean SPA routing.

### 🏆 Key Accomplishments [Accomplished X]
* Delivered an investor-demo-ready interactive Home dashboard with conversational AI drawer and live Netlify deployment.

### 📊 Measured Impact & Metrics [Measured by Y]
* **Design Fidelity**: Resolved **47 visual discrepancies** against Figma V2 down to zero defects.
* **Production Status**: Successfully deployed to Netlify with 100% responsive sticky sidebar alignment.`,

  // 4. Desk Section Implementation, Home Section Polish & Deployment Fixes (2026-09-22)
  '39781007-2891-4a22-b086-c3d77a6a9a86': `### 🎯 Objective & Context
Build the core Apollo Books Desk section from scratch based on Figma specifications, refine the Home section Chase conversational experience, and resolve critical deployment routing issues.

### 🛠️ Technical Execution [Doing Z]
* **Full-Stack UI Component Engineering**: Engineered the modular Desk section from scratch (\`DeskSidebarNav\`, \`DeskHeader\`, \`BillRow\`, \`BillRowSkeleton\`, and \`BillDetailDrawer\` side-by-side split view) using tokens extracted from Figma.
* **Reconciliation State Machine**: Built \`DeskFlowContext\`—a 6-stage automated receipt reconciliation engine (receiving → extracting → checking bank → categorizing → creating vendor → bill reconciled) with live timers, floating Chase status pill, and mock datasets for 9 realistic bills.
* **Conversational Animation & Polish**: Refined the Home Chase drawer with conversational branching (*"Why did my profits drop?"* → 3 reasons → recommendations), smooth cubic-bezier auto-expansion, 750ms pacing pauses, and one-click injection into the **NEEDS YOU** feed.
* **Infrastructure & Routing Fixes**: Resolved Netlify SPA 404 reloads via \`public/_redirects\` and \`netlify.toml\`, extracted official Aplobooks branding/favicons, updated authentication password handling, and redirected post-login landing to \`/home\`.
* **Testing Documentation**: Created comprehensive team walkthrough documentation with embedded video links and a WhatsApp-optimized quick guide.

### 🏆 Key Accomplishments [Accomplished X]
* Engineered the complete Desk reconciliation interface, refined the conversational Chase drawer, resolved all SPA routing defects, and deployed the production prototype.

### 📊 Measured Impact & Metrics [Measured by Y]
* **System Scope**: Created **5 core UI components**, 9 realistic vendor bill datasets, and a **6-stage automated state machine**.
* **Reliability**: 0% 404 errors on SPA route refreshes across Netlify deployment; verified end-to-end demo flow.
* **Deliverable Link**: Live prototype verified at https://magical-dango-fdfa84.netlify.app/`,

  // 5. Spec-Driven Development Framework Evaluation (2026-09-28)
  '8c0f8cf7-208e-421a-a95b-dc716580c48d': `### 🎯 Objective & Context
Design and execute a rigorous, repeatable empirical benchmark comparing Spec-Driven Development (SDD) frameworks (GitHub Spec Kit, OpenSpec, and BMAD Method) using the NeuroTODO reference app, delivering findings via an interactive self-service leadership portal.

### 🛠️ Technical Execution [Doing Z]
* **Controlled Evaluation Harness**: Designed a dual-axis scoring framework (process quality vs. product quality) using Google DeepMind Antigravity on Gemini 3.8 Flash High with zero manual coding intervention, isolated trial directories, and separate database namespaces.
* **Comparative Trial Execution**:
  * *GitHub Spec Kit*: CLI spec workflow generated functioning React app but flattened 3-column Kanban into grid cards (58.8% test pass rate).
  * *OpenSpec*: Delta-change specification workflow showed high test discipline (94.1% pass rate) but missed UI badge details.
  * *BMAD Method*: Multi-agent persona workflow (\`bmad-method@6.12.0\`) delivered 97.1% acceptance and near 1:1 visual fidelity.
* **Manual QA & Verification Suite**: Designed and executed an exhaustive 7-section manual test suite covering auth gating, CRUD operations, persistence audits, UI mockup fidelity, accessibility, and stress edge cases.
* **Interactive Portal Engineering**: Engineered a self-service evaluation portal (\`portal.html\`) featuring interactive target mockups, live sandbox runners with one-click credential copy, and in-browser markdown document readers.
* **Dual Deployment Architecture**: Implemented local dev mode (zero-dependency Node \`server.js\` on ports 4000–4003) and static Netlify production mode with isolated IndexedDB namespaces per framework.

### 🏆 Key Accomplishments [Accomplished X]
* Established BMAD Method as the official AINative Studio SDD standard and delivered an interactive self-service evaluation portal deployed live to leadership.

### 📊 Measured Impact & Metrics [Measured by Y]
* **Framework Benchmark**: BMAD Method selected with **97.1% acceptance rate**, highest visual fidelity, and lowest developer alignment effort.
* **Research Depth**: Authored **~2,000 lines of research thesis**, executive board summary, and 7 QA suites.
* **Deliverable Links**: Portal live at https://tangerine-speculoos-b16965.netlify.app/ | Evaluation reports on Google Drive.`,

  // 6. SDD Migration Evaluation (2026-09-29)
  '0ccbea8c-74e1-4b05-b88f-88945f249c23': `### 🎯 Objective & Context
Execute Phase 2 brownfield architecture migrations on the NeuroTODO prototypes across all three SDD frameworks, evaluating how effectively each tool handles existing codebase evolution, and update the interactive portal with the migration results.

### 🛠️ Technical Execution [Doing Z]
* **Target Architecture Design**: Defined and executed migration from client-side SPA to a full-stack architecture: React frontend, Python FastAPI backend, SQLite persistence, SQLAlchemy ORM, backend token authentication, and IndexedDB-to-SQLite data migration.
* **Evaluation Framework & Prompting**: Authored \`SDD_Migration_Evaluation_Framework.md\`, unified migration prompts requiring spec/plan updates prior to code edits, and strict file separation to preserve Phase 1 baselines.
* **Prototype Migration & Validation**: Migrated all three framework prototypes, verifying backend routing, protected endpoints, ORM data access, database creation, duplicate prevention during data migration, and full regression test suites.
* **Portal Update**: Expanded the Netlify evaluation portal with a dedicated Phase 2 view (\`#phase2\`), embedding the migrated prototypes in interactive sandboxes and linking the migration executive summary.

### 🏆 Key Accomplishments [Accomplished X]
* Successfully migrated all three framework prototypes to FastAPI/SQLite backends and deployed the updated Phase 2 evaluation portal to Netlify.

### 📊 Measured Impact & Metrics [Measured by Y]
* **Architectural Coverage**: Migrated **3 independent codebases** to full-stack FastAPI + SQLite with 100% data integrity during IndexedDB transfer.
* **Historical Baseline**: Preserved 100% of Phase 1 benchmarks read-only; delivered live Phase 2 interactive portal at https://tangerine-speculoos-b16965.netlify.app/#phase2.`,

  // 7. Phase 3 Greenfield Evaluation, Three-Phase Synthesis & Portal Deployment (2026-09-30)
  '3c3e5333-2d80-400c-b378-be9868bf6086': `### 🎯 Objective & Context
Execute Phase 3 clean-slate full-stack greenfield evaluation across all three SDD frameworks, synthesize findings across all three study phases into a master executive decision document, and deploy the unified evaluation portal to Netlify.

### 🛠️ Technical Execution [Doing Z]
* **Phase 3 Greenfield Trial**: Executed autonomous generation from an empty directory for GitHub Spec Kit, OpenSpec, and BMAD Method targeting React 18, Tailwind CSS, Python FastAPI, SQLAlchemy 2.0, Alembic migrations, and Bearer token auth.
* **48-Scenario Acceptance Testing**: Validated all three implementations across 8 QA suites covering API contracts, route protection, ORM schema integrity, Alembic migrations, mobile sidebar ergonomics, and destructive deletion modals.
* **Cross-Phase Synthesis & Foundational Discoveries**: Analyzed empirical data across 9 total runs (Phase 1 client SPA, Phase 2 brownfield migration, Phase 3 greenfield full-stack), documenting the collapse of developer remedial load (from 180 min to 0 min) and establishing 5 core engineering discoveries (Multimodal Blind Spot, Automated Test Illusion, Greenfield vs Brownfield Asymmetry, Destructive Action Safety Gap, Mobile Static Rail Trap).
* **Netlify Sandbox Hybrid Engine**: Diagnosed and resolved browser Mixed Content security blocks (HTTPS Netlify to HTTP localhost) by engineering an in-browser localStorage fallback store with isolated namespaces for each framework.
* **Unified Portal Deployment**: Built and deployed the production portal with Mermaid.js diagram rendering, interactive grouped bar charts, and streamlined 3-Phase synthesis navigation.

### 🏆 Key Accomplishments [Accomplished X]
* Formally established the **AINative Venture Studio Dual-Framework Standard** (BMAD Method for greenfield/prototypes; OpenSpec for brownfield maintenance) and deployed the complete multi-phase portal to Netlify.

### 📊 Measured Impact & Metrics [Measured by Y]
* **Remedial Velocity**: Achieved **0m 00s developer remediation** across all 3 frameworks in Phase 3 (down from 180m in Phase 1).
* **Test Reliability**: **100% pass rate** across the 48-scenario acceptance suite.
* **Production Deployment**: Unified portal live at https://tangerine-speculoos-b16965.netlify.app/ with interactive sandboxes, synthesis scorecard, and executive summaries.`
};

// ── 9 Meeting Details Updates (Alignment & Decisions template) ───────────────
const meetingUpdates = {
  // 1. Spec-Driven Development Discussion (2026-09-17)
  '2f8c63b4-b250-4c6a-b2fc-d0d13bbc37d4': {
    decisions: 'Initiate formal evaluation of Spec-Driven Development (SDD) frameworks comparing open-source options against Amazon Kiro; prepare React frontend foundation for upcoming accounting AI prototype.',
    discussion_summary: `### 🎯 Purpose & Alignment
Explore the emergence of Spec-Driven Development (SDD) methodologies and assess upcoming client prototype requirements for an AI-powered accounting concept.

### ⚖️ Agreed Decisions & Direction
* **SDD Evaluation**: Evaluate SDD frameworks to establish studio best practices, comparing open-source spec frameworks against managed IDE tools like Amazon Kiro.
* **Frontend Prototype Scope**: Prepare for building a frontend prototype based on Figma UI/UX designs to support an upcoming investor pitch to an accounting firm.

### 💡 Discussion Breakdown & Trade-offs
* **Methodology Options**: Discussed whether an open-source workflow (Spec Kit, OpenSpec) provides better flexibility and lower vendor lock-in than an integrated tool like Amazon Kiro.
* **Client Concept Requirements**: Reviewed early Figma designs for the accounting AI platform to understand required UI capabilities.

### 📌 Action Items & Next Steps
* [ ] Research Spec-Driven Development principles and compare candidate frameworks.
* [ ] Refresh React fundamentals and modern component patterns ahead of prototyping.`
  },

  // 2. Apollo Books Prototype (2026-09-21)
  '4b388730-50ff-4605-aba1-6e427cf395cb': {
    decisions: `1. Use a database containing realistic dummy accounting data instead of directly connecting to live accounting software.
2. Build a functional, polished prototype focused on agent UX and financial analytics rather than a full production platform.
3. Architect a central orchestrator agent coordinating specialized sub-agents (AP, AR, invoicing, analytics).
4. Scaffold backend and agent workflow before completing frontend UI.
5. Prioritize initial prototype delivery for Thursday demo.`,
    discussion_summary: `### 🎯 Purpose & Alignment
Kick-off alignment for Apollo Books, an agentic AI platform designed to simplify accounting operations for Australian SMBs through natural language interactions.

### ⚖️ Agreed Decisions & Direction
* **Decoupled Architecture**: Utilize a realistic dummy accounting database (accounts, bills, transactions) for rapid validation rather than integrating complex third-party ERP platforms immediately.
* **Multi-Agent Orchestration**: Implement a central orchestrator agent that interprets natural language and delegates tasks to specialized sub-agents (invoicing, accounts payable, accounts receivable, analytics).
* **Delivery Milestone**: Target Thursday for a functional demonstration of the conversational UI, analytics dashboard, and agent coordination.

### 💡 Discussion Breakdown & Trade-offs
* **Core Platform Sections**: Agreed on three key functional areas: Financial Analytics Dashboard, Always-Visible Conversational AI Side Panel, and Accounting Operations.
* **Agent Capabilities**: Outlined natural language commands to support (e.g., *"Why did my profit drop?"*, *"Which invoices are overdue?"*, *"Generate an invoice"*).
* **Evolution Path**: Confirmed the prototype architecture must allow seamless future replacement of the dummy database with real accounting software APIs.

### 📌 Action Items & Next Steps
* [ ] Model the dummy accounting database schema and seed realistic business data.
* [ ] Scaffold the backend API and conversational agent routing workflow.
* [ ] Define supported prototype interactions and prepare for frontend integration.`
  },

  // 3. UX Walkthrough with Mr. Dinukar (2026-09-21)
  '82343629-e6c4-467a-83b2-88cbd4a1c8ff': {
    decisions: `1. Expand the existing Agent prototype deployed on Vercel rather than rebuilding from scratch.
2. Connect the database to Figma MCP to extract layout tokens and workflows.
3. Implement sections in sequential order: Desk section first, then Home section.`,
    discussion_summary: `### 🎯 Purpose & Alignment
Detailed walkthrough of existing Apollo Books designs with the Research UX Implementer to review completed features and plan the implementation of Desk and Home sections.

### ⚖️ Agreed Decisions & Direction
* **Iterative Expansion**: Preserve and build upon the existing hard-coded Agent prototype deployed on Vercel.
* **Component Extraction**: Connect the project database to Figma MCP to automate layout, spacing, and typography token extraction.
* **Build Sequence**: Prioritize the Desk section (bills, transactions, accounting tools) before implementing the Home performance dashboard.

### 💡 Discussion Breakdown & Trade-offs
* **Desk Receipt Reconciliation Flow**: Walked through the automated flow: email receipt notification → transaction verification against bank records → bill generation → side panel drawer inspection.
* **Home Dashboard Metrics**: Defined critical KPI cards (Safe to Spend, Liabilities, Revenue, Profit, Needs You action feed).
* **Conversational Chase Drawer**: Reviewed the conversational diagnostic flow explaining profit dips and turning recommendations into action items.

### 📌 Action Items & Next Steps
* [x] Connect database to Figma MCP and extract workflow assets.
* [ ] Build the Desk section (Actions, Activity, Accounts, Transactions, Bills, Drawer).
* [ ] Build the Home section (KPI cards, Chase drawer, Needs You feed).`
  },

  // 4. Home Section UX Review & Workflow Discussion (2026-09-22)
  'f755bec9-0958-4152-9cdb-5c40d019df3e': {
    decisions: 'Adopt an offline blueprint workflow to circumvent Figma MCP rate limits; utilize direct .figma files for AI-assisted layout corrections; resolve specific UI differences in Home section.',
    discussion_summary: `### 🎯 Purpose & Alignment
Conduct a UI/UX review of the Apollo Books Home section implementation and optimize developer workflow around Figma API limitations with the Tech Lead and UX Researcher.

### ⚖️ Agreed Decisions & Direction
* **Figma Rate Limit Strategy**: Transition away from repeated Figma MCP API calls to an offline blueprint approach that captures all content and demo flows in local Markdown cache.
* **Direct File Usage**: Experiment with importing raw \`.figma\` files directly into AI tools for layout adjustments.
* **UI Discrepancy Remediation**: Address specific Home section layout, animation depth, and typography defects identified during review.

### 💡 Discussion Breakdown & Trade-offs
* **Visual Audit Points**: Identified section height differences, floating AI agent bar opening animation depth, and text alignment discrepancies.
* **Tooling Constraints**: Evaluated the Figma MCP rate limit bottleneck (HTTP 429) and agreed that an offline cached blueprint preserves engineering velocity without API interruptions.

### 📌 Action Items & Next Steps
* [ ] Fix Home section visual defects: section heights, AI bar animation depth, text placement.
* [ ] Continue refining the offline blueprint approach for demo flows.`
  },

  // 5. Prototype Handover & Spec-Driven Development Discussion (2026-09-23)
  '700bd6f7-7f86-47e7-b057-c5c297df0e1e': {
    decisions: 'Hand over Apollo Books prototype and documentation to team; initiate participation in studio Spec-Driven Development working group and upcoming reusable RAG framework initiative.',
    discussion_summary: `### 🎯 Purpose & Alignment
Hand over the completed Apollo Books prototype, testing documentation, and video walkthroughs to the team, and align on upcoming SDD and reusable RAG initiatives.

### ⚖️ Agreed Decisions & Direction
* **Prototype Handover**: Transition completed Apollo Books prototype and testing documentation to the team for stakeholder demonstrations.
* **SDD Working Group**: Join studio WhatsApp groups and communication channels to coordinate on Spec-Driven Development standards.
* **RAG Framework Collaboration**: Participate in the studio initiative to build a reusable, cross-industry Retrieval-Augmented Generation (RAG) platform.

### 💡 Discussion Breakdown & Trade-offs
* **Documentation Review**: Walked through the complete testing guide, demo flows (Home Chase drawer, Desk 5-second demo), and embedded video links.
* **Reusable RAG Concept**: Discussed the business need for a plug-and-play RAG framework that can be rapidly pitched and deployed to enterprise clients by updating domain documents.

### 📌 Action Items & Next Steps
* [x] Deliver complete prototype documentation and video links to team.
* [ ] Join SDD communication threads and prepare for framework evaluation experiments.`
  },

  // 6. Prototype UI/UX Fixes — Chat Agent Polish & PDF Guide Update (2026-09-23)
  'ca1f900b-14f1-4aff-b896-1e0e4b0f6dee': {
    decisions: 'Apply UI/UX engineer change requests to chat agent styling, deploy updated build to Netlify, and update client-facing PDF walkthrough guide.',
    discussion_summary: `### 🎯 Purpose & Alignment
Review and implement visual refinements requested by the UI/UX engineer for the Apollo Books chat agent interface, ensuring alignment with client demonstration standards.

### ⚖️ Agreed Decisions & Direction
* **Visual Styling Updates**: Remove redundant container borders, update chat agent avatars, and add an accent frame around the active agent.
* **Feedback Animations**: Enhance the thinking pulse animation displayed while the AI assistant generates responses.
* **Documentation Synchronization**: Re-generate and deploy the client PDF guide to match the updated visual interface.

### 💡 Discussion Breakdown & Trade-offs
* **Agent Differentiation**: Reviewed avatar designs to ensure clear visual distinction between specialized financial sub-agents.
* **Deployment Workflow**: Agreed on immediate verification on Netlify post-push to confirm production layout consistency.

### 📌 Action Items & Next Steps
* [x] Remove border, update avatars, and add active selection frame.
* [x] Update thinking pulse animation.
* [x] Push to GitHub, deploy to Netlify, and update PDF walkthrough guide.`
  },

  // 7. Spec-Driven Development Experiment Review (2026-09-29)
  '9183750d-b12d-4257-8f34-ce6b14f8cdc6': {
    decisions: 'Proceed to Phase 3 fresh greenfield implementation using updated Business Requirements; address specification ambiguity around persistence layers in future benchmarks.',
    discussion_summary: `### 🎯 Purpose & Alignment
Present empirical findings and comparative benchmarks from Phase 1 (Greenfield SPA) and Phase 2 (Brownfield Migration) across BMAD, OpenSpec, and GitHub Spec Kit to the software architect and technology leadership.

### ⚖️ Agreed Decisions & Direction
* **Specification Precision**: Identified that ambiguous specifications (e.g., "persistent database") caused models to default to client-side IndexedDB; agreed that future requirements must explicitly specify server-side architecture.
* **Phase 3 Authorization**: Proceed with Phase 3 greenfield full-stack implementation with updated, unambiguous Business Requirements (FastAPI, SQLite, SQLAlchemy 2.0).
* **Portal Sharing**: Publish the findings portal to stakeholders for interactive review.

### 💡 Discussion Breakdown & Trade-offs
* **Comparative Strengths**: Walked through BMAD Method\'s high visual fidelity (97.1%) and OpenSpec\'s strong test discipline (94.1%).
* **Architect Feedback**: Reviewed the architect\'s input on database contracts, Alembic migrations, and backend authentication gating.

### 📌 Action Items & Next Steps
* [ ] Share the live evaluation portal link with leadership stakeholders.
* [ ] Execute Phase 3 fresh greenfield evaluation with updated full-stack specifications.`
  },

  // 8. Reusable AI Prototype Strategy (2026-09-30)
  '2837fc9a-8e71-4349-a16b-dd2f530b679d': {
    decisions: `1. Adopt a breadth-first prototyping strategy: build lightweight, reusable MVP demos before committing to deep production builds.
2. Build on the existing hierarchical architecture developed by the Principal Engineer rather than starting from scratch.
3. Prioritize architectural expandability so demo prototypes evolve into client production deployments without rewrites.
4. Shortlist preferred APIs for RAG pipelines and calling agents.`,
    discussion_summary: `### 🎯 Purpose & Alignment
Formulate a studio strategy for reusable, client-facing AI prototypes (RAG document intelligence, AI calling agents) and establish architectural foundation principles.

### ⚖️ Agreed Decisions & Direction
* **Breadth-First Strategy**: Prioritize rapid, modular MVP demos to validate client demand; upon client sign-off, deepen into production architectures.
* **Architectural Inheritance**: Build directly upon the hierarchical system designed by the Principal Engineer to leverage proven patterns.
* **Expandable Design**: Enforce strict modularity so demonstration prototypes can scale into enterprise environments without costly rewrites.
* **API Shortlist**: Evaluate and shortlist candidate AI and LLM APIs based on latency, cost, and tool-calling support.

### 💡 Discussion Breakdown & Trade-offs
* **Market Demand**: Analyzed client demand trends centering on internal policy/manual RAG agents and voice calling agents.
* **Codebase Reuse vs Greenfield**: Evaluated whether to create independent micro-repos or extend the Principal Engineer\'s framework; agreed that leveraging the existing framework accelerates time-to-market.

### 📌 Action Items & Next Steps
* [ ] Review the Principal Engineer\'s codebase, hierarchical architecture, and component implementations.
* [ ] Identify expansion requirements and capability gaps for RAG pipelines and calling agents.`
  },

  // 9. Architecture Planning Meeting (2026-09-30)
  'dbb3fc5c-a503-4c28-a14e-5532f5657897': {
    decisions: 'Formally adopt breadth-first approach using the Principal Engineer’s hierarchical architecture; prioritize reusable MVP prototypes; shortlist candidate APIs for implementation.',
    discussion_summary: `### 🎯 Purpose & Alignment
Conduct technical planning for client-requested AI capabilities (RAG chat over enterprise manuals/policies and automated calling agents), finalizing architecture and API selections.

### ⚖️ Agreed Decisions & Direction
* **Architecture Strategy**: Formally adopt breadth-first strategy building upon the existing hierarchical architecture.
* **API Selections**: Finalized shortlisted model backends and service providers balancing latency, cost, and reliability.
* **Modular Milestones**: Structure prototypes into modular phases allowing immediate client demonstration followed by incremental production hardening.

### 💡 Discussion Breakdown & Trade-offs
* **Component Reusability**: Analyzed document ingestion pipelines, vector storage options, and conversational state persistence.
* **Execution Alignment**: Aligned on dividing research tasks between architecture review and interface prototyping.

### 📌 Action Items & Next Steps
* [ ] Review Principal Engineer\'s codebase and document hierarchical architecture decisions.
* [ ] Audit current capabilities and specify needed features for RAG and calling agents.`
  }
};

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

function runMigration() {
  console.log('Generating migration SQL...');
  let sql = 'BEGIN;\n\n';

  // 1. Update project tags on events
  sql += `-- Fix project tag typos / long descriptions on events\n`;
  sql += `UPDATE events SET project_tag = 'Apollo Books Prototype' WHERE id = '38adab3e-4a31-42a2-91d1-2fa54366af3c';\n`;
  sql += `UPDATE events SET project_tag = 'Apollo Books Prototype' WHERE id = '39781007-2891-4a22-b086-c3d77a6a9a86';\n\n`;

  // 2. Update Work Details (7 records)
  sql += `-- Update Work Details to Google XYZ Standard Template\n`;
  for (const [eventId, description] of Object.entries(workUpdates)) {
    sql += `UPDATE work_details SET description = ${escapeSql(description)} WHERE event_id = '${eventId}';\n`;
  }
  sql += '\n';

  // 3. Update Meeting Details (9 records)
  sql += `-- Update Meeting Details to Standard Alignment & Decisions Template\n`;
  for (const [eventId, data] of Object.entries(meetingUpdates)) {
    sql += `UPDATE meeting_details SET discussion_summary = ${escapeSql(data.discussion_summary)}, decisions = ${escapeSql(data.decisions)} WHERE event_id = '${eventId}';\n`;
  }
  sql += '\nCOMMIT;\n';

  const migrationFilePath = path.resolve(__dirname, '..', 'supabase', 'migrations', '20261004120000_standardize_log_templates.sql');
  fs.writeFileSync(migrationFilePath, sql, 'utf8');
  console.log(`Migration SQL written to: ${migrationFilePath}`);

  console.log('Applying migration to linked Supabase database...');
  try {
    const output = execSync(`npx supabase db query --linked -f "${migrationFilePath}"`, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024
    });
    console.log('Migration successfully executed!');
    console.log(output.slice(0, 400));
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
