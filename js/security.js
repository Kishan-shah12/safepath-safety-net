/**
 * ============================================================
 * SafePath AI — Security Shield & Sanitization Module
 * ============================================================
 * Covers: R4 (Trusted Contacts), R11-R12 (Escalation Engine)
 * Zero dependencies. Pure ES6 module.
 * ============================================================
 */
'use strict';

// ─── XSS Sanitizer ────────────────────────────────────────────
/**
 * Neutralizes XSS attack vectors by escaping dangerous HTML characters.
 * Must be applied to ALL user input and AI responses before DOM insertion.
 * @param {string} str — Raw untrusted string
 * @returns {string} — Escaped safe string
 */
export function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#96;',
  };
  return str.replace(/[&<>"'/`]/g, (char) => escapeMap[char]);
}

// ─── Payload Schema Validator ──────────────────────────────────
/**
 * Validates AI agent response payloads against a strict schema.
 * Prevents malformed or injected data from reaching the DOM.
 *
 * @param {object} data — Incoming payload to validate
 * @param {object} schema — Schema definition: { field: 'string'|'number'|'boolean'|'object'|'array' }
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePayload(data, schema) {
  const errors = [];

  if (data === null || typeof data !== 'object') {
    return { valid: false, errors: ['Payload must be a non-null object'] };
  }

  for (const [field, expectedType] of Object.entries(schema)) {
    if (!(field in data)) {
      errors.push(`Missing required field: "${field}"`);
      continue;
    }

    const actualType = Array.isArray(data[field]) ? 'array' : typeof data[field];
    if (actualType !== expectedType) {
      errors.push(`Field "${field}" expected ${expectedType}, got ${actualType}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Schema Definitions ────────────────────────────────────────
/** Schema for distress analysis results */
export const DISTRESS_SCHEMA = {
  level: 'string',
  score: 'number',
  triggers: 'array',
  message: 'string',
};

/** Schema for route safety results */
export const ROUTE_SCHEMA = {
  origin: 'string',
  destination: 'string',
  safetyScore: 'number',
  segments: 'array',
};

// ─── Trusted Circle Manager (R4) ──────────────────────────────
/**
 * Manages the user's trusted emergency contacts.
 * Data persisted to localStorage with basic obfuscation.
 */
export class TrustedCircle {
  /** @type {Array<{id: string, name: string, phone: string, initials: string, priority: number}>} */
  #contacts;

  constructor() {
    this.#contacts = this.#loadFromStorage();
  }

  /** Add a new contact */
  addContact({ name, phone, priority = 99 }) {
    const contact = {
      id: crypto.randomUUID?.() || `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: sanitizeInput(name),
      phone: sanitizeInput(phone),
      initials: name.split(' ').map((w) => w[0]?.toUpperCase() || '').join('').slice(0, 2),
      priority,
    };
    this.#contacts.push(contact);
    this.#contacts.sort((a, b) => a.priority - b.priority);
    this.#saveToStorage();
    return contact;
  }

  /** Remove contact by ID */
  removeContact(id) {
    this.#contacts = this.#contacts.filter((c) => c.id !== id);
    this.#saveToStorage();
  }

  /** Get all contacts sorted by priority */
  getContacts() {
    return [...this.#contacts];
  }

  /** Get highest-priority contact */
  getPrimaryContact() {
    return this.#contacts[0] || null;
  }

  /** Get contact count */
  get count() {
    return this.#contacts.length;
  }

  /** Persist to localStorage with base64 obfuscation */
  #saveToStorage() {
    try {
      const encoded = btoa(JSON.stringify(this.#contacts));
      localStorage.setItem('sp_trusted_circle', encoded);
    } catch { /* Storage quota or private browsing — silent fail */ }
  }

  /** Load from localStorage */
  #loadFromStorage() {
    try {
      const raw = localStorage.getItem('sp_trusted_circle');
      if (!raw) return this.#defaultContacts();
      return JSON.parse(atob(raw));
    } catch {
      return this.#defaultContacts();
    }
  }

  /** Default demo contacts for hackathon */
  #defaultContacts() {
    return [
      { id: 'c_default_1', name: 'Aanya Sharma', phone: '+91 98765 43210', initials: 'AS', priority: 1 },
      { id: 'c_default_2', name: 'Raj Kumar', phone: '+91 91234 56789', initials: 'RK', priority: 2 },
      { id: 'c_default_3', name: 'Priya Mehta', phone: '+91 87654 32109', initials: 'PM', priority: 3 },
    ];
  }
}

// ─── Escalation Engine (R10-R13) ──────────────────────────────
/**
 * Graduated auto-escalation system.
 * Tier 1: SMS alert to primary contact
 * Tier 2: Call all contacts
 * Tier 3: Emergency services notification
 *
 * All notifications are simulated visually (no external APIs).
 */
export class EscalationEngine {
  /** @type {number} Current tier (0 = inactive, 1-3 = active) */
  #currentTier = 0;
  /** @type {number|null} Timer ID for auto-progression */
  #timerHandle = null;
  /** @type {string[]} Log of notified contacts */
  #notifiedContacts = [];
  /** @type {number} Seconds between tier progressions */
  #tierIntervalSec;
  /** @type {Function|null} Callback for state changes */
  #onStateChange;

  /**
   * @param {object} options
   * @param {number} [options.tierIntervalSec=10] — Seconds between tier escalations
   * @param {Function} [options.onStateChange] — Called on every state change
   */
  constructor({ tierIntervalSec = 10, onStateChange = null } = {}) {
    this.#tierIntervalSec = tierIntervalSec;
    this.#onStateChange = onStateChange;
  }

  /**
   * Begin the escalation sequence from Tier 1.
   * @param {TrustedCircle} trustedCircle — Contacts to notify
   */
  beginEscalation(trustedCircle) {
    if (this.#currentTier > 0) return; // Already escalating

    this.#currentTier = 1;
    const primary = trustedCircle.getPrimaryContact();
    if (primary) {
      this.#notifiedContacts.push(`SMS → ${primary.name}`);
    }
    this.#emitState();
    this.#scheduleNextTier(trustedCircle);
  }

  /** Progress to the next escalation tier */
  #scheduleNextTier(trustedCircle) {
    this.#timerHandle = setTimeout(() => {
      if (this.#currentTier >= 3) return;

      this.#currentTier += 1;

      if (this.#currentTier === 2) {
        const allContacts = trustedCircle.getContacts();
        allContacts.forEach((c) => {
          this.#notifiedContacts.push(`CALL → ${c.name}`);
        });
      } else if (this.#currentTier === 3) {
        this.#notifiedContacts.push('EMERGENCY → 112 Services Alerted');
      }

      this.#emitState();

      if (this.#currentTier < 3) {
        this.#scheduleNextTier(trustedCircle);
      }
    }, this.#tierIntervalSec * 1000);
  }

  /** Cancel escalation (false alarm — R13) */
  cancel() {
    if (this.#timerHandle) clearTimeout(this.#timerHandle);
    this.#timerHandle = null;
    this.#currentTier = 0;
    this.#notifiedContacts = [];
    this.#emitState();
  }

  /** Get current escalation status snapshot */
  getStatus() {
    return {
      tier: this.#currentTier,
      active: this.#currentTier > 0,
      notifiedContacts: [...this.#notifiedContacts],
      tierIntervalSec: this.#tierIntervalSec,
    };
  }

  /** Emit state change to callback */
  #emitState() {
    if (typeof this.#onStateChange === 'function') {
      this.#onStateChange(this.getStatus());
    }
  }
}
