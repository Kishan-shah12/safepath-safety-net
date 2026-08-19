# SafeRoute AI — Requirement Alignment Matrix

> **Theme:** Safety Net  
> **Hackathon Constraint:** < 200 KB total repo, Vanilla HTML5 + CSS3 + ES6 Modules, Zero frameworks

---

## 1. Problem Statement → Feature Mapping

### 1.1 Core Tool: Route Safety & Check-Ins

| # | Requirement | Module | UI/UX Component | Status |
|---|-------------|--------|------------------|--------|
| R1 | Route safety assessment | `js/agent.js` → `analyzeRoute()` | Interactive map view with color-coded safety overlays (green/amber/red zones) | MVP |
| R2 | Real-time check-in system | `js/app.js` → `CheckInManager` class | Check-in timer with pulse animation, one-tap "I'm Safe" button | MVP |
| R3 | Location tracking during journey | `js/app.js` → `LocationTracker` class | Live position indicator on map, breadcrumb trail of traveled path | MVP |
| R4 | Trusted contacts management | `js/security.js` → `TrustedCircle` class | Contact list panel with add/edit/remove, emergency priority ordering | MVP |
| R5 | Journey start/end lifecycle | `js/app.js` → `JourneySession` class | "Start Journey" / "End Journey" flow with destination input | MVP |

---

### 1.2 AI Enhancements

| # | Requirement | Module | UI/UX Component | Status |
|---|-------------|--------|------------------|--------|
| R6 | Distress detection from message patterns | `js/agent.js` → `DistressAnalyzer` class | Sentiment indicator badge (calm/anxious/distress), subtle UI color shift on distress detection | MVP |
| R7 | Risk-aware route suggestions | `js/agent.js` → `RouteSuggestionEngine` class | Alternative route cards with risk scores, comparative safety breakdown | MVP |
| R8 | Contextual safety scoring | `js/agent.js` → `SafetyScorer` class | Numeric safety score (0–100) with descriptive label, displayed per route segment | MVP |
| R9 | Natural language safety queries | `js/agent.js` → `SafetyChat` class | Chat-style input for questions like "Is this area safe at night?" | Stretch |

---

### 1.3 Stretch Goals: Auto-Escalation

| # | Requirement | Module | UI/UX Component | Status |
|---|-------------|--------|------------------|--------|
| R10 | Unresponsive user detection | `js/app.js` → `CheckInManager.detectTimeout()` | Countdown timer with escalating visual urgency (green → amber → red) | Stretch |
| R11 | Auto-notify trusted circle | `js/security.js` → `EscalationEngine` class | Notification dispatch panel, escalation status feed | Stretch |
| R12 | Graduated escalation tiers | `js/security.js` → `EscalationEngine.escalate()` | Tier indicator (Tier 1: SMS → Tier 2: Call → Tier 3: Emergency services) | Stretch |
| R13 | False-alarm cancellation | `js/app.js` → `CheckInManager.cancelAlert()` | "I'm OK" emergency cancel button with confirmation | Stretch |

---

## 2. Module Responsibility Chart

```
┌─────────────────────────────────────────────────────────────┐
│                        index.html                           │
│              (Single-page shell, semantic HTML5)             │
├─────────────────────────────────────────────────────────────┤
│                     styles/main.css                          │
│       (Design system: tokens, components, animations)        │
├──────────┬──────────┬───────────────┬───────────────────────┤
│ js/app.js│js/agent.js│js/security.js │    js/test.js         │
│          │          │               │                       │
│ ● App    │ ● Route  │ ● Trusted     │ ● Unit tests for     │
│   init   │   analysis│  circle mgmt │   all modules         │
│ ● Journey│ ● Distress│ ● Escalation │ ● Assertion runner    │
│   session│   detect  │   engine      │ ● Coverage report     │
│ ● Check  │ ● Safety │ ● Data        │   in console          │
│   -in mgr│   scoring │   encryption │                       │
│ ● Location│● Route  │ ● Local       │                       │
│   tracker│   suggest │   storage API │                       │
│ ● UI ctrl│ ● NLP    │               │                       │
│          │   chat    │               │                       │
└──────────┴──────────┴───────────────┴───────────────────────┘
```

---

## 3. Data Flow Architecture

```
User Input (destination, check-in, message)
        │
        ▼
   ┌─────────┐    imports    ┌────────────┐
   │ app.js  │──────────────▶│  agent.js   │
   │         │               │             │
   │ Journey │  route data   │ analyzeRoute│
   │ Session │◀──────────────│ scoreRisk   │
   │         │               │ detectDist. │
   │ CheckIn │               └────────────┘
   │ Manager │
   │         │    imports    ┌──────────────┐
   │ Location│──────────────▶│ security.js  │
   │ Tracker │               │              │
   │         │  escalation   │ TrustedCircle│
   │    UI   │◀──────────────│ Escalation   │
   │ Control │               │ Engine       │
   └─────────┘               └──────────────┘
        │
        ▼
   ┌─────────┐
   │  DOM    │  (index.html + main.css)
   │ Updates │
   └─────────┘
```

---

## 4. AI Strategy (No External API Dependency for MVP)

Since the hackathon demands a **working** demo under 200 KB with no heavy dependencies:

| AI Feature | Implementation Approach | Rationale |
|------------|------------------------|-----------|
| Distress detection | **Rule-based NLP** — keyword matching, sentiment lexicon (AFINN-subset), message frequency/length anomaly detection | Zero external calls, instant response, fully offline-capable |
| Route risk scoring | **Weighted heuristic model** — time-of-day factor, area type (residential/commercial/isolated), lighting proxy, crowd density proxy | Deterministic, explainable scores, < 2 KB of scoring logic |
| Route suggestions | **Graph-based pathfinding** with safety-weighted edges — Dijkstra variant prioritizing safety score over shortest distance | Classic CS algorithm, lightweight, no ML model needed |
| Contextual Q&A | **Pattern-matched FAQ engine** — regex + template responses for common safety queries | Feels conversational, zero API cost |

> **Note:** Architecture is designed so that `agent.js` can be swapped to call a real LLM API (Gemini, etc.) in production without touching any other module.

---

## 5. Size Budget Allocation

| Asset | Target Size | Notes |
|-------|-------------|-------|
| `index.html` | ~5 KB | Semantic structure, zero inline styles |
| `styles/main.css` | ~15 KB | Full design system with animations |
| `js/app.js` | ~20 KB | Core application logic |
| `js/agent.js` | ~15 KB | AI/heuristic engine |
| `js/security.js` | ~10 KB | Security & escalation |
| `js/test.js` | ~8 KB | Test suite |
| `ALIGNMENT.md` | ~6 KB | This file |
| `.gitignore` | <1 KB | — |
| **Total** | **~80 KB** | **Well under 200 KB limit** |

---

## 6. UI/UX Screen Inventory

| Screen | Primary Purpose | Key Components |
|--------|----------------|----------------|
| **Home / Dashboard** | Journey overview, quick-start | Safety score card, "Start Journey" CTA, recent routes |
| **Route Planner** | Destination input + route selection | Map canvas, route cards with risk comparison, time-of-day toggle |
| **Active Journey** | Real-time tracking + check-ins | Live map, check-in timer, "I'm Safe" button, SOS trigger |
| **Contacts Panel** | Trusted circle management | Contact list, add/edit modal, priority drag-reorder |
| **Safety Chat** | AI Q&A about area safety | Chat bubbles, quick-reply chips, distress indicator |
| **Alert / Escalation** | Escalation status during emergency | Countdown, escalation tier progress, cancel button |

---

## 7. Non-Functional Requirements Alignment

| Constraint | How We Address It |
|-----------|-------------------|
| < 200 KB repo | No `node_modules`, no build tools, hand-optimized vanilla code |
| No global pollution | All modules use `export`/`import`, IIFE for any initialization |
| ES6+ strict | `'use strict'` in all modules, `const`/`let` only, classes, arrow functions |
| Offline-capable | All AI logic runs client-side, `localStorage` for persistence |
| Accessibility | ARIA labels, keyboard navigation, high-contrast mode support |
| Security | No plaintext storage of contacts, basic encryption via `security.js` |
