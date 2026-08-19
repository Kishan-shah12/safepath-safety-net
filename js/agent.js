/**
 * ============================================================
 * SafePath AI — AI Safety Engine & Resilient Fallback
 * ============================================================
 * Covers: R1 (Route Safety), R6 (Distress Detection), R7 (Route
 * Suggestions), R8 (Safety Scoring), R9 (Safety Chat — stretch)
 * Zero external ML deps. Client-side heuristic + NLP engine.
 * ============================================================
 */
'use strict';

import { sanitizeInput, validatePayload, DISTRESS_SCHEMA, ROUTE_SCHEMA } from './security.js';

// ─── SafeCity Demo Data ────────────────────────────────────────
/**
 * Fictional city with 5 named zones.
 * Each zone has pre-scored safety attributes used by the heuristic engine.
 * Canvas coordinates define polygon boundaries for map rendering.
 */
export const SAFE_CITY = {
  zones: [
    {
      id: 'university',
      name: 'University Campus (Safe)',
      safety: 90,
      type: 'educational',
      lighting: 0.95,
      crowd: 0.85,
      color: 'safe',
      poly: [
        [0.05, 0.05], [0.4, 0.05], [0.42, 0.22], [0.4, 0.42], [0.05, 0.42],
      ],
      center: [0.22, 0.22],
    },
    {
      id: 'market',
      name: 'Market Square (Safe)',
      safety: 82,
      type: 'commercial',
      lighting: 0.85,
      crowd: 0.8,
      color: 'safe',
      poly: [
        [0.05, 0.48], [0.4, 0.48], [0.4, 0.92], [0.05, 0.92],
      ],
      center: [0.22, 0.70],
    },
    {
      id: 'transit',
      name: 'Transit Hub (Caution)',
      safety: 62,
      type: 'transit',
      lighting: 0.75,
      crowd: 0.9,
      color: 'caution',
      poly: [
        [0.45, 0.05], [0.7, 0.05], [0.7, 0.45], [0.45, 0.45],
      ],
      center: [0.57, 0.25],
    },
    {
      id: 'park',
      name: 'North Park (Risk Zone)',
      safety: 38,
      type: 'isolated',
      lighting: 0.35,
      crowd: 0.2,
      color: 'danger',
      poly: [
        [0.45, 0.5], [0.7, 0.5], [0.7, 0.92], [0.45, 0.92],
      ],
      center: [0.57, 0.71],
    },
    {
      id: 'industrial',
      name: 'Industrial Outskirts (Risk Zone)',
      safety: 31,
      type: 'isolated',
      lighting: 0.3,
      crowd: 0.15,
      color: 'danger',
      poly: [
        [0.73, 0.05], [0.95, 0.05], [0.95, 0.92], [0.73, 0.92],
      ],
      center: [0.84, 0.48],
    },
  ],

  /**
   * Route graph: edges connecting zone centers with distance weights.
   */
  edges: [
    { from: 'university', to: 'transit', distance: 3 },
    { from: 'university', to: 'market', distance: 2 },
    { from: 'market', to: 'park', distance: 3 },
    { from: 'market', to: 'transit', distance: 4 },
    { from: 'transit', to: 'park', distance: 2 },
    { from: 'transit', to: 'industrial', distance: 3 },
    { from: 'park', to: 'industrial', distance: 2 },
  ],
};

// ─── Sentiment Lexicon (AFINN-inspired subset, ~150 words) ────
/** @type {Object<string, number>} Word → valence score (-5 to +5) */
const SENTIMENT_LEXICON = {
  // Strong negative (distress indicators)
  'help': -4, 'sos': -5, 'emergency': -5, 'danger': -5, 'trapped': -5,
  'attacked': -5, 'mugged': -4, 'robbed': -4, 'stalked': -4, 'followed': -4,
  'scared': -4, 'terrified': -5, 'afraid': -3, 'panic': -4, 'hurt': -4,
  'bleeding': -5, 'lost': -3, 'kidnapped': -5, 'threatening': -4, 'weapon': -5,
  'knife': -4, 'gun': -5, 'die': -5, 'dying': -5, 'kill': -5,
  'please': -2, 'crying': -3, 'scream': -4, 'run': -3, 'hide': -3,
  'dark': -2, 'alone': -3, 'suspicious': -3, 'unsafe': -4, 'creepy': -3,
  'strange': -2, 'worried': -3, 'anxious': -3, 'nervous': -2, 'uneasy': -2,
  'wrong': -2, 'bad': -2, 'horrible': -4, 'terrible': -4, 'awful': -3,
  'threat': -4, 'harass': -4, 'assault': -5, 'violence': -5, 'abduct': -5,

  // Mild negative
  'late': -1, 'uncomfortable': -2, 'noisy': -1, 'crowded': -1, 'sketchy': -3,
  'shady': -2, 'deserted': -3, 'isolated': -3, 'abandoned': -3, 'broken': -2,
  'confused': -2, 'annoyed': -1, 'frustrated': -2, 'tired': -1, 'cold': -1,

  // Positive (safety indicators)
  'safe': 4, 'okay': 3, 'ok': 3, 'fine': 3, 'good': 3,
  'great': 4, 'arrived': 4, 'home': 4, 'reached': 4, 'secure': 4,
  'happy': 3, 'calm': 3, 'relaxed': 3, 'comfortable': 3, 'well': 2,
  'perfect': 4, 'excellent': 4, 'wonderful': 4, 'beautiful': 3, 'bright': 2,
  'friendly': 3, 'welcome': 3, 'helped': 3, 'police': 2, 'guard': 2,
  'lit': 2, 'busy': 1, 'populated': 2, 'familiar': 2, 'known': 2,
  'love': 3, 'enjoy': 3, 'fun': 3, 'laugh': 2, 'smile': 2,
  'thanks': 2, 'thank': 2, 'appreciate': 3, 'relief': 3, 'relieved': 3,
};

// ─── Distress Analyzer (R6) ──────────────────────────────────
/**
 * Evaluates user messages for distress signals using:
 * 1. Sentiment lexicon scoring (AFINN-subset)
 * 2. Pattern detection (ALL CAPS, excessive punctuation, SOS keywords)
 * 3. Produces a classified output: calm → anxious → distress
 */
export class DistressAnalyzer {
  /**
   * Analyze a text message for distress indicators.
   * @param {string} text — Raw user message
   * @returns {{ level: string, score: number, triggers: string[], message: string }}
   */
  analyze(text) {
    if (!text || typeof text !== 'string') {
      return { level: 'calm', score: 0, triggers: [], message: 'No input to analyze' };
    }

    const triggers = [];
    let rawScore = 0;

    // 1. Tokenize and score against lexicon
    const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
    let lexiconHits = 0;

    for (const word of words) {
      if (word in SENTIMENT_LEXICON) {
        rawScore += SENTIMENT_LEXICON[word];
        lexiconHits += 1;
        if (SENTIMENT_LEXICON[word] <= -3) {
          triggers.push(`Keyword: "${word}" (valence: ${SENTIMENT_LEXICON[word]})`);
        }
      }
    }

    // 2. ALL CAPS detection (shouting / panic indicator)
    const capsRatio = text.replace(/[^A-Za-z]/g, '').length > 0
      ? (text.replace(/[^A-Z]/g, '').length / text.replace(/[^A-Za-z]/g, '').length)
      : 0;
    if (capsRatio > 0.6 && text.length > 5) {
      rawScore -= 3;
      triggers.push(`Pattern: ALL CAPS detected (${(capsRatio * 100).toFixed(0)}% uppercase)`);
    }

    // 3. Excessive punctuation (!!!, ???, ...)
    const excessivePunctuation = (text.match(/[!?]{3,}/g) || []).length;
    if (excessivePunctuation > 0) {
      rawScore -= 2 * excessivePunctuation;
      triggers.push(`Pattern: Excessive punctuation (${excessivePunctuation} instance(s))`);
    }

    // 4. Repeated words (sign of panic / urgency)
    const wordFreq = {};
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
      if (wordFreq[word] === 3) {
        rawScore -= 2;
        triggers.push(`Pattern: Repeated word "${word}" (3+ times)`);
      }
    }

    // 5. Normalize score to 0–1 range (0 = perfectly calm, 1 = extreme distress)
    // rawScore: positive = calm, negative = distress
    const normalizedScore = Math.min(1, Math.max(0, (-rawScore) / 15));

    // 6. Classify level
    let level;
    let message;
    if (normalizedScore < 0.25) {
      level = 'calm';
      message = 'No distress signals detected. User appears safe.';
    } else if (normalizedScore < 0.55) {
      level = 'anxious';
      message = 'Mild distress indicators found. Monitoring recommended.';
    } else {
      level = 'distress';
      message = 'HIGH DISTRESS DETECTED. Immediate attention required.';
    }

    const result = { level, score: normalizedScore, triggers, message };

    // Validate own output against schema before returning
    const validation = validatePayload(result, DISTRESS_SCHEMA);
    if (!validation.valid) {
      console.warn('[DistressAnalyzer] Output validation failed:', validation.errors);
    }

    return result;
  }
}

// ─── Safety Scorer (R8) ──────────────────────────────────────
/**
 * Computes safety scores using a weighted heuristic model.
 * Factors: base zone safety, time-of-day modifier, lighting, crowd density.
 */
export class SafetyScorer {
  /**
   * Score a single zone's safety at a given time.
   * @param {string} zoneId — Zone identifier from SAFE_CITY
   * @param {number} [hour=null] — Hour of day (0-23), defaults to current
   * @returns {{ score: number, label: string, factors: object }}
   */
  scoreZone(zoneId, hour = null) {
    const zone = SAFE_CITY.zones.find((z) => z.id === zoneId);
    if (!zone) return { score: 0, label: 'Unknown', factors: {} };

    const currentHour = hour ?? new Date().getHours();

    // Time-of-day multiplier (safer during daylight 6-18)
    const isDaytime = currentHour >= 6 && currentHour < 18;
    const timeMultiplier = isDaytime ? 1.0 : 0.65;

    // Weighted formula
    const weights = { base: 0.4, lighting: 0.25, crowd: 0.2, time: 0.15 };
    const rawScore =
      (zone.safety * weights.base) +
      (zone.lighting * 100 * weights.lighting) +
      (zone.crowd * 100 * weights.crowd) +
      (timeMultiplier * 100 * weights.time);

    const score = Math.round(Math.min(100, Math.max(0, rawScore)));

    let label;
    if (score >= 70) label = 'Safe';
    else if (score >= 45) label = 'Caution';
    else label = 'Avoid';

    return {
      score,
      label,
      factors: {
        baseSafety: zone.safety,
        lighting: zone.lighting,
        crowdDensity: zone.crowd,
        timeOfDay: isDaytime ? 'Day' : 'Night',
        timeMultiplier,
      },
    };
  }

  /**
   * Score an entire route (array of zone IDs).
   * Aggregate = weighted average biased toward the weakest link.
   * @param {string[]} zoneIds — Ordered zone IDs in the route
   * @param {number} [hour=null]
   * @returns {{ overallScore: number, label: string, segments: object[] }}
   */
  scoreRoute(zoneIds, hour = null) {
    const segments = zoneIds.map((id) => ({
      zoneId: id,
      ...this.scoreZone(id, hour),
    }));

    if (segments.length === 0) return { overallScore: 0, label: 'Unknown', segments: [] };

    // Weakest-link bias: overall = 60% average + 40% minimum
    const avg = segments.reduce((sum, s) => sum + s.score, 0) / segments.length;
    const min = Math.min(...segments.map((s) => s.score));
    const overallScore = Math.round(avg * 0.6 + min * 0.4);

    let label;
    if (overallScore >= 70) label = 'Safe Route';
    else if (overallScore >= 45) label = 'Proceed with Caution';
    else label = 'High Risk — Avoid';

    return { overallScore, label, segments };
  }
}

// ─── Route Suggestion Engine (R7) ─────────────────────────────
/**
 * Dijkstra-based pathfinding with safety-weighted edges.
 * Edge cost = distance * (1 + (100 - destinationSafety) / 100)
 * This penalizes routes through dangerous zones.
 */
export class RouteSuggestionEngine {
  #scorer;

  constructor() {
    this.#scorer = new SafetyScorer();
  }

  /**
   * Find the safest route between two zones.
   * @param {string} originId
   * @param {string} destinationId
   * @param {number} [hour=null]
   * @returns {{ path: string[], totalCost: number, safetyResult: object }|null}
   */
  suggest(originId, destinationId, hour = null) {
    const zoneIds = SAFE_CITY.zones.map((z) => z.id);
    if (!zoneIds.includes(originId) || !zoneIds.includes(destinationId)) {
      return null;
    }

    // Build adjacency list with safety-weighted costs
    const graph = {};
    for (const id of zoneIds) {
      graph[id] = [];
    }

    for (const edge of SAFE_CITY.edges) {
      const destSafety = this.#scorer.scoreZone(edge.to, hour).score;
      const cost = edge.distance * (1 + (100 - destSafety) / 100);
      graph[edge.from].push({ to: edge.to, cost });

      // Bidirectional edges
      const origSafety = this.#scorer.scoreZone(edge.from, hour).score;
      const reverseCost = edge.distance * (1 + (100 - origSafety) / 100);
      graph[edge.to].push({ to: edge.from, cost: reverseCost });
    }

    // Dijkstra's algorithm
    const dist = {};
    const prev = {};
    const visited = new Set();

    for (const id of zoneIds) {
      dist[id] = Infinity;
      prev[id] = null;
    }
    dist[originId] = 0;

    while (visited.size < zoneIds.length) {
      // Find unvisited node with smallest distance
      let current = null;
      let currentDist = Infinity;
      for (const id of zoneIds) {
        if (!visited.has(id) && dist[id] < currentDist) {
          current = id;
          currentDist = dist[id];
        }
      }

      if (current === null || current === destinationId) break;
      visited.add(current);

      for (const neighbor of graph[current]) {
        if (visited.has(neighbor.to)) continue;
        const newDist = dist[current] + neighbor.cost;
        if (newDist < dist[neighbor.to]) {
          dist[neighbor.to] = newDist;
          prev[neighbor.to] = current;
        }
      }
    }

    // Reconstruct path
    const path = [];
    let node = destinationId;
    while (node !== null) {
      path.unshift(node);
      node = prev[node];
    }

    if (path[0] !== originId) return null; // No path found

    const safetyResult = this.#scorer.scoreRoute(path, hour);

    return { path, totalCost: dist[destinationId], safetyResult };
  }

  /**
   * Get all possible routes and rank by safety.
   * Uses DFS to find all paths then scores each.
   * @param {string} originId
   * @param {string} destinationId
   * @param {number} [hour=null]
   * @returns {Array<{ path: string[], safetyResult: object }>}
   */
  suggestAll(originId, destinationId, hour = null) {
    const allPaths = [];
    const visited = new Set();

    const dfs = (current, path) => {
      if (current === destinationId) {
        allPaths.push([...path]);
        return;
      }
      if (path.length > 5) return; // Limit depth to prevent combinatorial explosion

      visited.add(current);
      for (const edge of SAFE_CITY.edges) {
        let neighbor = null;
        if (edge.from === current && !visited.has(edge.to)) neighbor = edge.to;
        if (edge.to === current && !visited.has(edge.from)) neighbor = edge.from;
        if (neighbor) {
          path.push(neighbor);
          dfs(neighbor, path);
          path.pop();
        }
      }
      visited.delete(current);
    };

    dfs(originId, [originId]);

    return allPaths
      .map((path) => ({
        path,
        safetyResult: this.#scorer.scoreRoute(path, hour),
      }))
      .sort((a, b) => b.safetyResult.overallScore - a.safetyResult.overallScore);
  }
}

// ─── Auto-Escalation Timeout (R10) ────────────────────────────
/**
 * Creates a check-in challenge with timeout.
 * If user doesn't respond within `timeoutMs`, fires the escalation callback.
 *
 * Wrapped in Promise.race with a 3-second hard cap on any async operations.
 *
 * @param {number} timeoutMs — Time to wait for check-in response
 * @param {Function} onTimeout — Called when user fails to respond
 * @returns {{ cancel: Function, promise: Promise<string> }}
 */
export function createCheckInChallenge(timeoutMs = 5000, onTimeout = null) {
  let resolver = null;
  let timeoutHandle = null;
  let settled = false;

  const promise = new Promise((resolve) => {
    resolver = resolve;

    timeoutHandle = setTimeout(() => {
      if (!settled) {
        settled = true;
        if (typeof onTimeout === 'function') onTimeout();
        resolve('timeout');
      }
    }, timeoutMs);
  });

  const respond = () => {
    if (!settled) {
      settled = true;
      clearTimeout(timeoutHandle);
      resolver('safe');
    }
  };

  const cancel = () => {
    if (!settled) {
      settled = true;
      clearTimeout(timeoutHandle);
      resolver('cancelled');
    }
  };

  return { promise, respond, cancel };
}

// ─── Resilient Fetch Wrapper ──────────────────────────────────
/**
 * Wraps any async operation with a 3-second timeout fallback.
 * Ensures the demo never hangs on network failures.
 *
 * @param {Promise} asyncOp — The operation to race against timeout
 * @param {*} fallbackValue — Value returned if timeout fires
 * @param {number} [timeoutMs=3000]
 * @returns {Promise<*>}
 */
export async function withTimeout(asyncOp, fallbackValue, timeoutMs = 3000) {
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(fallbackValue), timeoutMs);
  });

  try {
    return await Promise.race([asyncOp, timeout]);
  } catch (error) {
    console.warn('[SafePath] Async operation failed, using fallback:', error?.message);
    return fallbackValue;
  }
}

// ─── Safety Chat FAQ Engine (R9 — Stretch) ────────────────────
/**
 * Pattern-matched FAQ engine for natural language safety queries.
 * Returns template responses matched via regex patterns.
 */
export class SafetyChat {
  #patterns = [
    {
      regex: /safe.*(night|dark|late|evening)/i,
      response: (zone) => `${zone?.name || 'This area'} has a nighttime safety score of ${zone ? new SafetyScorer().scoreZone(zone.id, 22).score : '??'}/100. We recommend well-lit main roads and active check-ins after dark.`,
    },
    {
      regex: /safe.*(walk|route|path)/i,
      response: (zone) => `The safest walking routes prioritize well-lit areas with higher foot traffic. Current route safety analysis uses ${SAFE_CITY.zones.length} zone profiles.`,
    },
    {
      regex: /(avoid|dangerous|unsafe|risky)/i,
      response: () => {
        const worst = SAFE_CITY.zones.reduce((a, b) => a.safety < b.safety ? a : b);
        return `Currently, ${worst.name} has the lowest safety rating (${worst.safety}/100) due to poor lighting and low foot traffic. Avoid if possible.`;
      },
    },
    {
      regex: /(check.?in|timer|respond)/i,
      response: () => 'The check-in system sends periodic prompts. If you miss a check-in, auto-escalation begins — first SMS, then calls, then emergency services.',
    },
    {
      regex: /(escalat|emergency|alert|sos)/i,
      response: () => 'Auto-escalation has 3 tiers: Tier 1 (SMS to primary contact), Tier 2 (calls to all contacts), Tier 3 (emergency services). You can cancel at any time.',
    },
    {
      regex: /(contact|circle|trust)/i,
      response: () => 'Your trusted circle receives alerts during escalation. Priority 1 contacts are notified first. You can manage contacts in the Trusted Contacts panel.',
    },
  ];

  /**
   * Answer a natural language safety query.
   * @param {string} query
   * @param {string} [currentZoneId=null]
   * @returns {{ response: string, confidence: number }}
   */
  ask(query, currentZoneId = null) {
    const cleanQuery = sanitizeInput(query);
    const zone = currentZoneId ? SAFE_CITY.zones.find((z) => z.id === currentZoneId) : null;

    for (const pattern of this.#patterns) {
      if (pattern.regex.test(query)) {
        return {
          response: pattern.response(zone),
          confidence: 0.85,
        };
      }
    }

    return {
      response: `I can help with route safety, nighttime risks, check-ins, escalation procedures, and trusted contacts. Try asking: "Is ${SAFE_CITY.zones[0].name} safe at night?"`,
      confidence: 0.3,
    };
  }
}
