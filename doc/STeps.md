# STeps

> **Map:** AI Systems > AI SDLC > STeps
> **Exported:** September 10, 2026

---

Here is the exact step-by-step breakdown of Phase 1 (Product Discovery & Market Alignment), extracted strictly from the methodology in the transcript and framed through the lens of a Forward Deployed Engineer (FDE).


An FDE doesn’t just take tickets and write code; they sit between the business problem and the technical execution. Directors and venture studios want to see that before you touch an AI coding agent, you deeply understand the operational friction you are trying to eliminate.


Here is the general framework and the exact narration you can mimic. You can later feed this template into Anti-Gravity to fill in the blanks with your specific project details.


---

### The FDE Mindset: Phase 1 (Product Discovery & Market Alignment)


Based on the transcript, this phase is all about the "conversations to have before you build." It is the externalization of architectural thinking where you pressure-test your ideas using a planning AI (like ChatGPT or Claude) to figure out what the system is before writing the first spec.


**The Core Steps:**


1. **Defining the Business Problem & Pain Points:** What is the actual operational friction? FDEs look for what people are currently doing manually or inefficiently.

1. **User Profiling & Core Flows:** Who uses this, and what is the absolute shortest path to deliver value to them? (e.g., from sign-in to the final output).

1. **Market & Implementation Research:** How is this currently being solved? What tools are people duct-taping together, and where do those tools fail?

1. **Ruthless Scoping (In-Scope vs. Out-of-Scope):** FDEs must deliver rapid, reliable value. That means aggressively defining what *not* to build so the AI agent stays disciplined and doesn't hallucinate unnecessary features.

---

### The Narration Template (FDE Persona)


Use this script as your structural template. The bracketed sections `[...]` are where you will eventually inject your project details.


**The Opening (Setting the FDE Frame)**


> *"In a venture studio environment, my job isn't to just open Cursor and start vibe-coding. My job is to act as the bridge between a business problem and a technical solution. So, before I ever initialize a codebase, I start with product discovery. I sit down with a planning AI to pressure-test the core logic. I need to answer: What are we actually building, who is it for, and what could go wrong?"*

**Step 1: The Business Problem & Pain Points**


> *"I always start by defining the operational friction. The current market has a clear pain point: ****[Describe the painful, manual, or slow process users currently face]****. The problem isn't that tools don't exist; it's that ****[Explain why current solutions fail—e.g., they require too much manual labor, lack real-time syncing, etc.]****."*

**Step 2: The Solution & Core User Flow**


> *"Once the pain point was clear, I defined the exact solution and the core user flow. As an FDE, I want the shortest path to value. The flow is strictly defined: ****[Describe the sequence: e.g., A user authenticates -> enters a workspace -> inputs plain English -> the system outputs a specific deliverable]****. By defining this sequence explicitly, I ensure the AI coding agent won't later try to build a core feature on the wrong page."*

**Step 3: Implementation Research**


> *"I evaluated the current market to see how incumbents approach this. You have ****[Competitor A]****, which does ****[Feature]**** well but completely misses ****[Gap in the market]****. Then you have ****[Competitor B]****, which is too rigid. The implementation opportunity here was to build a system that leverages ****[Specific Tech, e.g., Agentic AI, Real-time WebSockets]**** to automate the heavy lifting while keeping the user in the architect seat."*

**Step 4: Setting MVP Guardrails (The 'Out-of-Scope' Rule)**


> *"The most critical part of my discovery phase was deciding what NOT to build. If you give an AI an open-ended prompt, the codebase will eventually collapse under its own weight. I explicitly defined the boundaries: ****[List 3-4 complex features like Enterprise Billing, Role-Based Permissions, or Version History]**** were deliberately marked as OUT OF SCOPE. My success criteria was simply: ****[State the one binary metric of success for the core feature]****."*

---

Here is the breakdown of **Phase 2 (Architectural Planning & The 6-File Context System)**, extracted directly from the transcript and framed for the Forward Deployed Engineer (FDE) persona.


An FDE knows that the biggest risk with AI-assisted development is "context drift." If you just ask an AI to build a project, it might do great for two hours, but by week three, it forgets previous decisions, contradicts its own codebase, and breaks features. To prevent this, an FDE establishes strict, immutable constraints *before* the AI touches the code.


---

### The FDE Mindset: Phase 2 (Architectural Planning)


Based on the transcript, this phase is about building the brain of the project. You take all the product discovery from Phase 1 and translate it into a structured context system (the 6 files). This turns the AI from a "guesser" into an implementation engine that understands your exact system architecture.


**The Core Steps (The 6 Files):**


1. **Project Overview:** A concrete definition of goals, core user flows, and success criteria.

1. **Architecture Blueprint (Invariants):** The exact tech stack, database schema strategies, and system "invariants" (strict rules the system must never violate, like where state is managed or how background tasks run).

1. **Code Standards:** Shared conventions for TypeScript, linting, and framework features to keep the AI's syntax consistent across hundreds of prompts.

1. **UI Context:** Design tokens and color palettes so the UI remains cohesive and the AI doesn't hallucinate random styling.

1. **AI Workflow Rules:** Behavioral guardrails for the agent. The golden rule: *Focus on one subsystem at a time and stay in your lane.*

1. **Progress Tracker:** The most critical file. LLMs have no memory between sessions. This living document tracks the current phase, completed work, and architectural decisions made along the way.

---

### The Narration Template (FDE Persona)


Use this script to explain how you control and command AI tools during the architectural planning phase.


**The Opening (Setting the FDE Frame)**


> *"As a Forward Deployed Engineer, my job is to build robust systems rapidly, which means I use AI as an implementation engine. But I know the trap: AI codebases easily collapse under their own weight if they lack architectural boundaries. So, before writing a single prompt, I create a 6-file context system to act as the AI's 'brain' for the project."*

**Step 1: Establishing the System Rules (Overview & Architecture)**


> *"I start by defining the boundaries. In the *`project_overview`* and *`architecture`* files, I lock in the tech stack and the system invariants. I explicitly tell the AI how the layers communicate—for instance, how ****[Authentication Tool]**** talks to the ****[Database]****. I define hard rules, like: ****[State an invariant rule, e.g., 'Never run long-lived tasks in standard API routes; always route them to a background job']****. This stops the AI from guessing my architecture."*

**Step 2: Enforcing Consistency (Standards & UI)**


> *"Next, I set the standards. AI tends to drift in its coding style. To prevent this, I feed it a *`code_standards`* and a *`ui_context`* file. This forces the agent to strictly adhere to ****[Specific Framework Rules, e.g., Next.js 15 App Router conventions]**** and use predefined design tokens instead of hardcoding random hex colors."*

**Step 3: Managing Agent Behavior (Workflow & Progress Tracking)**


> *"The final piece is controlling the agent's behavior over time. I create *`ai_workflow_rules`* which enforce a strict protocol: the AI must only work on one scoped feature at a time. Most importantly, I maintain a dynamic *`progress_tracker`*. Because agents lose memory between sessions, my very first prompt every morning is to make the agent read the tracker. It instantly knows what is built, what is in progress, and the architectural decisions we made yesterday. This completely eliminates context drift."*

---

Here is the breakdown of **Phase 3 (Agent Initialization & Spec-Driven Execution)**, extracted strictly from the transcript and framed for the Forward Deployed Engineer (FDE) persona.


For an FDE, the execution phase is about eliminating variables. You do not want the AI guessing syntax, using deprecated documentation, or touching parts of the codebase it shouldn't. This phase is about turning the AI into a highly controlled, predictable execution engine through "Agent Skills" and isolated "Feature Specs."


---

### The FDE Mindset: Phase 3 (Agent Initialization & Execution)


Based on the transcript, this phase moves from planning to building. Instead of writing one massive prompt, you break the build into highly scoped, sequential units (e.g., UI first, then database, then API routing, then wiring them together).


**The Core Steps:**


1. **Agent Initialization & Skill Injection:** Creating an entry file (like `agents.md` or `.cursorrules`) at the root so the agent automatically reads your 6-file context. Crucially, installing "Agent Skills" via CLI to give the AI the latest documentation and best practices for specific frameworks.

1. **Feature Scoping (The Unit Spec):** Writing a dedicated markdown file for *one* feature at a time (e.g., `03_auth.md`). Every spec contains a Goal, Design Decisions, Implementation Details, and a Verification Checklist.

1. **The Execution Protocol:** Using a strict, repeatable prompt to trigger the build: *"Read this spec, update the progress tracker, and implement exactly as specified."*

1. **Quality Assurance & Code Review:** Treating AI output like a junior developer's pull request. Reviewing the code (or using tools like CodeRabbit), isolating bugs, and running corrective prompts before merging to the main branch.

---

### The Narration Template (FDE Persona)


Use this script to explain how you drive the AI to execute complex features without breaking the system.


**The Opening (Setting the FDE Frame)**


> *"As a Forward Deployed Engineer, execution is about predictability. I don't let the AI 'vibe code' its way through a project. I treat the AI as an execution engine that requires explicit, isolated instructions. My execution phase is strictly spec-driven, ensuring every feature lands exactly within the architectural boundaries I set."*

**Step 1: Skill Injection & Initialization**


> *"Before asking the agent to write code, I solve the LLM knowledge-cutoff problem. I inject 'Agent Skills' into the workspace for my core technologies ****[Mention tools, e.g., Auth provider, Database ORM]****. This gives the agent the absolute latest documentation, API routes, and integration patterns, so it never hallucinates deprecated syntax. I also set a root instructions file to force the agent to read my context documents before every session."*

**Step 2: Writing the Feature Spec**


> *"I break the project down into isolated units. For example, when building ****[Specific Feature]****, I don't just prompt the chat. I write a dedicated spec document. I define the Goal, the specific ****[UI/Backend]**** constraints, the dependencies, and most importantly, a Verification Checklist. This tells the AI exactly what 'done' looks like and explicitly tells it what NOT to touch."*

**Step 3: The Execution Protocol**


> *"My prompting strategy is highly disciplined. For every feature, I open a fresh chat window to clear stale context, and I use the exact same protocol: ****'Read this spec file, update the progress tracker to mark this as in-progress, and implement it exactly as specified.'**** The AI reads the rules, logs its intent, and executes cleanly."*

**Step 4: Review and Isolate**


> *"I treat AI output like a Pull Request. If a bug occurs, I don't panic-prompt the agent with a raw error log. I document the error in a *`current_issues.md`* file, provide a screenshot or specific logs, and instruct the AI to ****'Analyze this issue using best practices and provide your reasoning before writing a fix.'**** Once it passes my review, I merge the branch and move to the next spec."*

---

Here is the breakdown of **Phase 4 (Structured Debugging & Edge Case Handling)**, extracted from the transcript and framed for the Forward Deployed Engineer (FDE) persona.


When working with AI agents, the most dangerous moment is when a bug occurs. Junior developers will immediately paste the raw error log into the chat, hit send, and watch the AI spiral—trying to fix one bug while breaking ten other features. An FDE handles debugging as a strict, documented protocol to maintain total control over the codebase.


---

### The FDE Mindset: Phase 4 (Structured Debugging)


Based on the transcript, this phase is about slowing the AI down. You force the agent to analyze the root cause, present a plan, and wait for your human approval before it is allowed to write a single line of corrective code. You also leverage automated review tools to catch the edge cases that both humans and LLMs miss.


**The Core Steps:**


1. **The **`current_issues.md`** Protocol:** Never paste errors directly into a conversational prompt. Document the bug, the error logs, and the replication steps in a dedicated markdown file.

1. **Visual Debugging:** If the issue is UI-related, place a screenshot in a `screenshots/` folder and link it in the issues document so the AI "sees" the layout failure.

1. **The Analysis-First Prompt:** Command the agent to read the issue, consult its framework skills, and output a root-cause analysis. Explicitly tell it to *wait for your green light* before executing.

1. **Automated Code Review (The PR Gate):** Use AI code review tools (like CodeRabbit) on Pull Requests before merging. This catches edge cases (like missing accessibility labels, unhandled promise rejections, or empty string validations) that the coding agent overlooked.

---

### The Narration Template (FDE Persona)


Use this script to explain how you surgically resolve issues when the AI hallucinates or breaks the system.


**The Opening (Setting the FDE Frame)**


> *"As a Forward Deployed Engineer, my biggest risk isn't the AI failing to write code; it's the AI spiraling and breaking the architecture when trying to fix a bug. To prevent this, I use a strict, structured debugging protocol. I don't let the agent guess. I force it to analyze the root cause before it is allowed to execute a fix."*

**Step 1: Documenting and Isolating the Issue**


> *"Whenever I hit a bug—whether it's a server error or a UI glitch—I never paste raw logs into the chat. Instead, I log it in a *`current_issues.md`* file. I outline the exact error log, the context of what I was trying to do, and if it's a visual issue, I drag a screenshot into the workspace. I isolate the problem entirely from the previous generation context."*

**Step 2: The Analysis-First Prompting Strategy**


> *"Once documented, I open a fresh chat and use a specific corrective prompt: ****'Read ***`current_issues.md`***. Consult your [Specific Framework] agent skills. Deeply analyze the root cause of this bug. Provide a fix plan, and wait for my approval to execute.'**** By forcing the AI to explain its reasoning first, I ensure it actually understands the system architecture rather than just guessing syntax."*

**Step 3: Edge Case Reviews**


> *"Finally, because AI coding agents optimize for the 'happy path,' they often miss edge cases. I treat the AI's output like a junior developer's pull request. I push the code to a staging branch and run an automated review tool to catch unhandled states—like ****[Mention a specific edge case, e.g., missing API error handling, empty string validations, or security leaks]****. I merge to the main branch only when the code is fully hardened."*

---

There is **one crucial final phase** left from the video: **Phase 5 (Production Hardening, Deployment & Delivery)**.


For a Forward Deployed Engineer, a project is never considered done when it runs on `localhost:3000`. FDEs are judged strictly on **customer delivery and live production stability**.


Here is Phase 5, structured with the exact same FDE persona and narration framework.


---

### The FDE Mindset: Phase 5 (Production Hardening & Deployment)


Based on the transcript, this phase is about taking a system that works in isolation and making it survive real-world traffic. In the video, moving to production required transitioning third-party services from sandbox mode to live infrastructure, resolving environment variable conflicts, and fixing edge-case build failures during deployment.


**The Core Steps:**


1. **Infrastructure Transition (Dev to Prod):** Moving all keys and services (Auth, Database, Storage, Background Workers) from sandbox/development tiers to production configurations with proper rate-limiting and security.

1. **Build Pipeline & Deployment Hardening:** Fixing the subtle build traps that pass in local development but break on cloud providers (e.g., configuring `postinstall` scripts for database clients like `prisma generate`, clearing lockfile caching issues).

1. **Multi-Session Live Verification:** Testing live production URLs across multiple authenticated sessions to ensure webhooks, background tasks, and real-time syncing actually work in the wild.

1. **Stakeholder Delivery & Handover:** Exporting the system's generated artifacts (e.g., technical specifications, live workspace links) and handing them over to business stakeholders or directors.

---

### The Narration Template (FDE Persona)


Use this script to show the interviewers that you think about the entire lifecycle through to production:


**The Opening (Setting the FDE Frame)**


> *"As a Forward Deployed Engineer, my job isn't finished when code runs on *`localhost`*. My mandate is to deliver working, enterprise-grade software into production. The final phase of my pipeline is production hardening—transitioning from development sandbox environments to live infrastructure, hardening the build pipeline, and verifying the live deployment."*

**Step 1: Environment & Credential Isolation**


> *"Before deploying, I strictly separate development from production. I swap out sandbox keys for production credentials across ****[Mention services, e.g., Auth, Database, Storage, Background Workers]****. I ensure that storage policies are strictly private so client data isn't publicly exposed via unsecured URLs."*

**Step 2: Resolving Production Build Traps**


> *"Production environments build differently than local environments. When deploying to platforms like Vercel, I preemptively handle common build failures—such as adding a *`postinstall: prisma generate`* script to *`package.json`* so the database client compiles cleanly in serverless functions, and ensuring *`.env`* variables match the production pipeline exactly."*

**Step 3: Verification & Handover**


> *"Once the build passes, I perform end-to-end smoke testing on the live domain across multiple separate browser sessions to verify real-time sync, background job execution, and access control. Finally, I package the generated technical documentation and hand over a validated, functioning product to the client or director."*

---

### The Complete End-to-End FDE Framework (At a Glance)


With all 5 phases complete, your entire interview narration follows this logical progression:


| Phase | Core Focus | FDE Deliverable |
| --- | --- | --- |
| Phase 1 | Product Discovery & Market Alignment | Business friction defined, market gap analyzed, strict "Out of Scope" list. |
| Phase 2 | Architectural Planning (6 Context Files) | Stack invariants, hybrid data storage rules, dynamic Progress Tracker. |
| Phase 3 | Agent Initialization & Spec Execution | Agent Skills installed, unit-by-unit isolated spec files, prompt execution. |
| Phase 4 | Structured Debugging & PR Reviews | current_issues.md root-cause analysis, CodeRabbit automated reviews. |
| Phase 5 | Production Hardening & Deployment | Prod key transitions, build pipeline fixes, live multi-session smoke test. |
