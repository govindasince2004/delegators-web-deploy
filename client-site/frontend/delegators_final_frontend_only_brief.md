# Delegators — Final Frontend-Only Implementation Brief

## Purpose

This document defines the **final frontend-only implementation direction** for the Delegators website.

It covers:

1. Main landing page
2. Minimal API documentation page
3. Visual design system
4. Component structure
5. Copywriting
6. Strict production guardrails

This brief is only for the client-side frontend.

---

# 0. Absolute implementation rule

## Frontend only

Do **not** touch backend code.

Do **not** create backend code.

Do **not** create fake API routes.

Do **not** create dummy API connections.

Do **not** create simulated session generation.

Do **not** create fake payment flows.

Do **not** create fake checkout.

Do **not** create fake auth.

Do **not** create fake API responses.

Do **not** create mock server behavior.

Do **not** make buttons silently pretend to work.

Do **not** hardcode fake working endpoints as if they are live.

The website may visually show how Delegators will be used, but the frontend must not invent functionality.

---

# 1. Product positioning

Delegators is a **session-based API platform for focused SWE work**.

Public message:

> Focused SWE sessions.  
> Build sharply, ship faster.

Short explanation:

> On-demand SWE sessions for students, indie builders, and developers. No credit card. No subscriptions. No lock-in.

Tone:

- minimal
- sharp
- modern
- research-startup style
- blog-like
- quiet
- premium
- developer-first
- no hype
- no fake AI language
- no dashboard clutter
- no overdesigned SaaS feel

---

# 2. Pages to build

Build only these frontend pages for now:

```txt
/
```

Main landing page.

```txt
/docs
```

Static documentation-style page.

No other routes should be created unless they already exist in the production codebase.

If routes such as `/pricing`, `/status`, or `/api-reference` already exist, links may point to them. If they do not exist, links should be disabled or marked with a frontend TODO.

---

# 3. Main landing page

## Page structure

The landing page should be extremely minimal.

Use this structure:

```txt
01 Hero
02 Tools / integrations strip
03 Pricing / payment section
Footer
```

No extra sections.

No big sidebar.

No dashboard mockup.

No terminal-heavy component.

No workflow theater.

No fake agent illustration.

No over-explaining.

---

# 4. Main landing page — visual direction

Inspired by calm research-startup sites.

Use:

- soft off-white background
- very faint vertical grid lines
- thin horizontal dividers
- centered top wordmark/logo
- editorial section numbers: `01`, `02`, `03`
- large but thin typography
- generous whitespace
- mostly black and white
- very restrained accents only if needed

Avoid:

- heavy cards
- gradients
- neon
- glass overload
- fake analytics
- fake dashboards
- large screenshots
- cluttered hero illustrations
- generic AI sparkles
- “agent” visual noise

---

# 5. Top brand area

At the top center, show the Delegators logo/wordmark.

Use the currently approved Delegators mark if already available in the codebase.

If the asset is not yet present, use a text fallback:

```txt
DELEGATORS
```

Style:

```css
font-size: 12px;
font-weight: 600;
letter-spacing: 0.28em;
text-transform: uppercase;
```

Do not create a new logo in code.

Do not invent new logo geometry.

Do not add extra icons.

---

# 6. Hero section

## Required hero copy

Headline must be exactly two lines:

```txt
Focused SWE sessions.
Build sharply, ship faster.
```

Supporting copy:

```txt
On-demand SWE sessions for students, indie builders, and developers.
No credit card. No subscriptions. No lock-in.
```

Primary CTA:

```txt
Get started
```

Secondary CTA:

```txt
Pricing
```

## Hero layout

The hero should be centered.

It should feel light and editorial, not like a SaaS splash page.

Recommended hierarchy:

```txt
small section number 01
centered brand/logo above or at page top
large two-line headline
short supporting copy
two buttons
```

## Button behavior

### Get started

If real checkout/session flow is not connected yet:

- do not create fake session behavior
- do not call an API
- do not generate fake keys
- do not create mock responses

Allowed behavior:

```txt
href="#pricing"
```

or

```txt
disabled button with TODO comment
```

Preferred for now:

```txt
href="#pricing"
```

### Pricing

Allowed behavior:

```txt
href="#pricing"
```

---

# 7. Tools / integrations strip

## Section number

Use:

```txt
02
```

## Purpose

Show the ecosystem Delegators is meant to fit into.

This section should be minimal and black-and-white.

No colorful branding.

No large feature cards.

No paragraphs.

## Tools to show

Use black-and-white text/icon tiles for:

```txt
Claude Code
Codex
Cursor
GitHub
VS Code
Terminal
API
```

Optional extra if needed:

```txt
Docs
```

## Style

Each tool item should be simple:

```txt
[small monochrome icon]
Tool Name
```

Use uniform spacing.

No background cards unless extremely subtle.

No shadows.

No colored logos.

No fake tool integrations or claims.

## Documentation button

Add a minimal button under or near the tools strip:

```txt
Documentation →
```

Behavior:

```txt
href="/docs"
```

If `/docs` is not implemented yet, create only the static frontend docs page described in this brief.

No backend logic.

No API call.

---

# 8. Pricing section

## Section number

Use:

```txt
03
```

## Section heading

Use:

```txt
Simple pricing.
Powerful sessions.
```

Supporting line:

```txt
Pay per session. Start only when needed.
```

## Pricing cards

Use four minimal cards or rows.

Cards should have:

- thin border
- no heavy shadow
- no dark glassmorphism
- quiet spacing
- a black `Start` button
- price
- short use-case copy

## Pricing card 1

Price:

```txt
₹39
```

Copy:

```txt
SWE Lite
mimo-v2.5 coding,
quick fixes, tests
```

Button:

```txt
Start
```

## Pricing card 2

Price:

```txt
₹44
```

Copy:

```txt
SWE Lite + Thinking
lite plus reasoning,
debugging loops
```

Button:

```txt
Start
```

## Pricing card 3

Price:

```txt
₹59
```

Copy:

```txt
SWE Pro
mimo-v2.5-pro,
deep SWE sessions
```

Button:

```txt
Start
```

## Pricing card 4

Price:

```txt
₹64
```

Copy:

```txt
SWE Pro + Thinking
pro plus reasoning,
complex fixes
```

Button:

```txt
Start
```

## Pricing button behavior

Until real payment/session flow is connected:

Allowed:

```txt
href="#"
```

with a visible TODO in code comments.

Better:

```txt
href="/pricing"
```

only if `/pricing` already exists.

Do not implement:

- fake payment
- fake checkout
- fake Razorpay
- fake Stripe
- fake session provisioning
- fake API key creation
- fake “success” screen

Button code should clearly state:

```tsx
// TODO: connect to real session purchase flow when backend is ready.
```

---

# 9. Footer

Minimal footer only.

Footer links:

```txt
DELEGATORS
API Docs
Terms
Privacy
```

Optional:

```txt
Status
Contact
```

Keep it light and quiet.

No footer column clutter.

No social clutter unless already required.

---

# 10. Documentation page

Route:

```txt
/docs
```

This page is a **static frontend documentation page**.

It must not call any API.

It must not validate keys.

It must not create sessions.

It must not simulate responses.

It must visually explain the API in a blog-like way.

---

# 11. Documentation page — visual direction

Same style as the main page:

- soft off-white background
- faint vertical grid lines
- centered small Delegators wordmark
- editorial numbering
- blog-like documentation layout
- thin typography
- code blocks as static visual examples
- no interactive backend logic

---

# 12. Documentation page — structure

Use this structure:

```txt
01 Overview
02 Base URL
03 Authentication
04 Create a session
05 Example response
06 Choose a model
07 Start work
Footer
```

Use section markers softly in the margin if possible.

---

# 13. Documentation page copy

## Page title

```txt
Using the Delegators API
```

## Intro copy

```txt
The Delegators API lets you start and run focused SWE sessions programmatically.
```

```txt
Create a session, choose the mode that fits your task, and begin focused work from your own tools.
```

---

# 14. Documentation page — Base URL

Use placeholder-safe copy.

Do not claim this endpoint is live unless production confirms it.

Display:

```txt
Base URL
<DELEGATORS_API_BASE>/v1
```

Optional helper text:

```txt
Replace <DELEGATORS_API_BASE> with the production API base URL provided by Delegators.
```

If production has officially confirmed the domain, the engineering team may replace it later.

Do not make frontend code call this URL.

---

# 15. Documentation page — Authentication

Display:

```txt
Authorization: Bearer <YOUR_SESSION_KEY>
```

Text:

```txt
Use your session key in the Authorization header.
```

Do not create:

- key validation
- fake key input
- fake auth response
- local fake token generation

---

# 16. Documentation page — Create a session

Static code block only:

```bash
curl -X POST <DELEGATORS_API_BASE>/v1/sessions \
  -H "Authorization: Bearer <YOUR_SESSION_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "swe-balanced",
    "task": "Build a responsive pricing page",
    "context": "Next.js project with Tailwind",
    "duration_minutes": 120
  }'
```

This is a documentation example.

It should not run from the frontend.

---

# 17. Documentation page — Example response

Static example only:

```json
{
  "id": "sess_example",
  "status": "created",
  "mode": "swe-balanced",
  "duration_minutes": 120
}
```

Important:

This is a visual documentation sample.

Do not generate real-looking random session IDs.

Do not simulate dynamic responses.

Do not store this in state as if it came from a backend.

---

# 18. Documentation page — Choose a mode

Use `mode`, not provider/model names.

Display:

```txt
swe-fast
swe-balanced
swe-pro
```

Descriptions:

```txt
swe-fast
Quick tasks, small fixes, and focused edits.
```

```txt
swe-balanced
Features, UI work, mockups, and product tasks.
```

```txt
swe-pro
Deeper sessions and continuous focused work.
```

Do not mention:

- provider names
- model names
- MiMo
- DeepSeek
- GPT
- Claude provider
- backend routing

---

# 19. Documentation page — Start work

Static endpoint example:

```bash
POST <DELEGATORS_API_BASE>/v1/sessions/{session_id}/start
```

Text:

```txt
Start the session when you are ready to begin focused work.
```

Do not implement a start button that performs this action.

---

# 20. Copy restrictions

## Avoid public-facing terms

Do not use these on the frontend:

```txt
arbitrage
resale
provider keys
MiMo
DeepSeek
cache hit
cache miss
token plan
account pooling
backend routing
server prompt
abuse detection
IP locking
master key
unlimited
cheap API
```

## Use these terms

Approved frontend terms:

```txt
focused SWE sessions
session-based API access
on-demand
pay per session
start only when needed
students
indie builders
developers
no credit card
no subscriptions
no lock-in
compute for engineering
swe-fast
swe-balanced
swe-pro
```

---

# 21. Design system

## Colors

Recommended:

```txt
background: #F7F6F2
surface: #FFFFFF
text primary: #080808
text secondary: #666666
text muted: #999999
line: rgba(0,0,0,0.08)
button black: #050505
button text: #FFFFFF
```

Tiny accent allowed:

```txt
accent: #2F5EFF
```

Use accent only for very small active states if needed.

## Typography

Use thin modern sans-serif.

Recommended:

```txt
Geist
Inter
Suisse-like fallback
Helvetica Neue
Arial
sans-serif
```

Hero should not be overly bold.

Suggested hero weight:

```txt
font-weight: 400 or 450
```

## Grid

Use faint vertical lines.

Example:

```css
background-image:
  linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px);
background-size: 25% 100%;
```

Keep it subtle.

## Spacing

Use large spacing.

Avoid packing content tightly.

Recommended:

```txt
section padding desktop: 96px to 150px
hero max width: 820px
content max width: 1040px
```

---

# 22. Suggested component structure

Adapt to existing codebase if different.

```txt
src/
  app/
    page.tsx
    docs/
      page.tsx
  components/
    delegators/
      BrandMark.tsx
      Hero.tsx
      ToolStrip.tsx
      PricingSection.tsx
      Footer.tsx
      DocsHeader.tsx
      DocsSection.tsx
      CodeBlock.tsx
      Button.tsx
```

Do not introduce unnecessary state management.

Do not introduce backend utilities.

Do not add API client files.

Do not add server actions.

Do not add route handlers.

---

# 23. Allowed frontend interactivity

Allowed:

- hover states
- copy-to-clipboard for static code snippets
- anchor scrolling
- simple tab switch for code language if purely static
- responsive menu only if nav exists

Not allowed:

- fetch calls
- POST calls
- fake loading states
- fake session creation
- fake payment success
- fake auth validation
- fake API key generation
- fake dashboard state

---

# 24. Button implementation rules

## Get started

For now:

```tsx
<a href="#pricing">Get started</a>
```

or:

```tsx
<button disabled>Get started</button>
```

with TODO.

## Pricing

```tsx
<a href="#pricing">Pricing</a>
```

## Documentation

```tsx
<a href="/docs">Documentation</a>
```

## Start buttons in pricing

For now:

```tsx
<button type="button">Start</button>
```

with TODO comment.

Do not connect them to payment or backend until the real flow is ready.

---

# 25. Acceptance checklist

Before shipping this frontend branch, verify:

## Main landing page

- [ ] No sidebar.
- [ ] No heavy navbar.
- [ ] Logo/wordmark is centered or top-minimal.
- [ ] Hero line is exactly two lines.
- [ ] Hero says: `Focused SWE sessions. Build sharply, ship faster.`
- [ ] Copy says no credit card, no subscriptions, no lock-in.
- [ ] Tools row is black and white.
- [ ] Tools include Claude Code, Codex, Cursor, GitHub, VS Code, Terminal, API.
- [ ] Documentation button links to `/docs`.
- [ ] Pricing section is minimal and bordered.
- [ ] Pricing cards include Start buttons.
- [ ] No fake payment.
- [ ] No fake API calls.
- [ ] No backend route added.

## Docs page

- [ ] Static frontend page only.
- [ ] Uses placeholder `<DELEGATORS_API_BASE>`.
- [ ] Shows Authorization header example.
- [ ] Shows cURL example.
- [ ] Shows example response as static text only.
- [ ] No API calls.
- [ ] No session simulation.
- [ ] No backend logic.
- [ ] Same visual style as landing page.

## General

- [ ] No provider names.
- [ ] No token-count marketing.
- [ ] No internal backend details.
- [ ] No invented functionality.
- [ ] No noisy components.
- [ ] Minimal, blog-like, research-startup style.

---

# 26. Final copy snapshot

## Landing hero

```txt
Focused SWE sessions.
Build sharply, ship faster.
```

```txt
On-demand SWE sessions for students, indie builders, and developers.
No credit card. No subscriptions. No lock-in.
```

```txt
Get started
Pricing
```

## Tools section

```txt
Claude Code
Codex
Cursor
GitHub
VS Code
Terminal
API
```

```txt
Documentation →
```

## Pricing

```txt
Simple pricing.
Powerful sessions.
```

```txt
Pay per session. Start only when needed.
```

```txt
₹39
SWE Lite
mimo-v2.5 coding,
quick fixes, tests
Start
```

```txt
₹44
SWE Lite + Thinking
lite plus reasoning,
debugging loops
Start
```

```txt
₹59
SWE Pro
mimo-v2.5-pro,
deep SWE sessions
Start
```

```txt
₹64
SWE Pro + Thinking
pro plus reasoning,
complex fixes
Start
```

## Footer

```txt
DELEGATORS
API Docs
Terms
Privacy
```

## Docs title

```txt
Using the Delegators API
```

## Docs intro

```txt
The Delegators API lets you start and run focused SWE sessions programmatically.
```

---

# 27. Final implementation note

This is a frontend-only design implementation.

The correct mindset:

> Build the visual website and static docs now.  
> Connect real backend, checkout, sessions, and API later only when production services are ready.

Do not fake the product.

Do not create placeholder backend behavior.

Do not make the frontend lie.
