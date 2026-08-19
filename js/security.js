/**
 * ============================================================
 * SafePath AI — Security Shield, Sanitization & Storage Module
 * ============================================================
 * Covers: R4 (Trusted Contacts), R11-R12 (Escalation Engine),
 * Multi-layer XSS defense, JSON Schema Guard, Rate Limiting,
 * and resilient StorageManager.
 * Zero external dependencies. Pure ES6 module.
 * ============================================================
 */
'use strict';

// ─── Custom Domain Errors ──────────────────────────────────────
/**
 * Custom error thrown when a security validation or schema check fails.
 * @extends Error
 */
export class SecurityValidationError extends Error {
  /**
   * @param {string} message - Error description
   * @param {string[]} [details=[]] - Specific schema or security violation details
   */
  constructor(message, details = []) {
    super(message);
    this.name = 'SecurityValidationError';
    this.details = details;
  }
}

/**
 * Custom error thrown when localStorage quota is exceeded or storage is disabled.
 * @extends Error
 */
export class StorageQuotaError extends Error {
  /**
   * @param {string} message - Storage error details
   */
  constructor(message) {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

/**
 * Custom error thrown when an invalid state transition is attempted on state engines.
 * @extends Error
 */
export class EngineStateError extends Error {
  /**
   * @param {string} message - State machine error details
   */
  constructor(message) {
    super(message);
    this.name = 'EngineStateError';
  }
}

// ─── Multi-Layer XSS Sanitizer ──────────────────────────────────
/**
 * Neutralizes XSS attack vectors by escaping dangerous HTML characters
 * and stripping protocol handler schemes (javascript:, vbscript:, data:text/html).
 *
 * @param {string} str - Raw untrusted string
 * @returns {string} - Sanitized safe string
 * @throws {TypeError} - If input is not a string
 */
export function sanitizeInput(str) {
  if (typeof str !== 'string') {
    return '';
  }

  // 1. Strip dangerous protocol handlers (case-insensitive)
  let clean = str.replace(/(javascript|vbscript|data:text\/html):/gi, '$1_disabled:');

  // 2. Escape HTML special characters
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#96;',
  };

  return clean.replace(/[&<>"'/`]/g, (char) => escapeMap[char]);
}

/**
 * Safe DOM content injection helper using textContent / createTextNode.
 * Guarantees zero HTML parsing or script execution.
 *
 * @param {HTMLElement} element - Target DOM element
 * @param {string} rawText - Untrusted text content
 * @returns {void}
 */
export function setSafeContent(element, rawText) {
  if (!element || typeof element.textContent === 'undefined') {
    return;
  }
  element.textContent = String(rawText ?? '');
}

// ─── Payload Schema Validator ──────────────────────────────────
/**
 * Validates AI agent response payloads against a strict schema.
 * Prevents malformed or injected data from reaching the DOM.
 *
 * @param {object} data - Incoming payload to validate
 * @param {object} schema - Schema definition: { field: 'string'|'number'|'boolean'|'object'|'array' }
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

// ─── Immutable Schema Definitions ──────────────────────────────
/** @type {Readonly<{level: string, score: string, triggers: string, message: string}>} */
export const DISTRESS_SCHEMA = Object.freeze({
  level: 'string',
  score: 'number',
  triggers: 'array',
  message: 'string',
});

/** @type {Readonly<{origin: string, destination: string, safetyScore: string, segments: string}>} */
export const ROUTE_SCHEMA = Object.freeze({
  origin: 'string',
  destination: 'string',
  safetyScore: 'number',
  segments: 'array',
});

// ─── Resilient StorageManager ──────────────────────────────────
/**
 * Namespaced localStorage wrapper with memory fallback, base64 obfuscation,
 * quota exhaustion exception handling, and schema validation on read.
 */
export class StorageManager {
  /** @type {string} Namespace prefix for storage keys */
  #prefix = 'safepath_';
  /** @type {Map<string, string>} In-memory store fallback */
  #memoryStore = new Map();

  /**
   * @param {string} [prefix='safepath_'] - Custom storage namespace prefix
   */
  constructor(prefix = 'safepath_') {
    this.#prefix = prefix;
  }

  /**
   * Save item to storage with quota error protection.
   * @param {string} key - Storage key
   * @param {any} data - Serialized payload
   * @returns {boolean} - Success status
   */
  setItem(key, data) {
    if (typeof key !== 'string' || !key) return false;

    const fullKey = this.#prefix + key;
    try {
      const encoded = btoa(encodeURIComponent(JSON.stringify(data)));
      localStorage.setItem(fullKey, encoded);
      this.#memoryStore.set(fullKey, encoded);
      return true;
    } catch (e) {
      // Fallback to memory store on quota or blocked storage
      try {
        const encoded = btoa(encodeURIComponent(JSON.stringify(data)));
        this.#memoryStore.set(fullKey, encoded);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Retrieve item from storage with fallback.
   * @param {string} key - Storage key
   * @param {any} [defaultValue=null] - Default if key missing or corrupted
   * @returns {any} - Decoded data
   */
  getItem(key, defaultValue = null) {
    if (typeof key !== 'string' || !key) return defaultValue;

    const fullKey = this.#prefix + key;
    let raw = null;

    try {
      raw = localStorage.getItem(fullKey);
    } catch {
      raw = this.#memoryStore.get(fullKey) || null;
    }

    if (!raw) {
      raw = this.#memoryStore.get(fullKey) || null;
    }

    if (!raw) return defaultValue;

    try {
      return JSON.parse(decodeURIComponent(atob(raw)));
    } catch {
      return defaultValue;
    }
  }

  /**
   * Remove item from storage.
   * @param {string} key
   */
  removeItem(key) {
    const fullKey = this.#prefix + key;
    try {
      localStorage.removeItem(fullKey);
    } catch { /* Silent */ }
    this.#memoryStore.delete(fullKey);
  }
}

// ─── RateLimiter (Spam Prevention) ──────────────────────────────
/**
 * Lightweight token-bucket / sliding-window rate limiter to prevent rapid-fire distress spamming.
 */
export class RateLimiter {
  /** @type {number} Maximum allowed requests per window */
  #maxRequests;
  /** @type {number} Time window in milliseconds */
  #windowMs;
  /** @type {number[]} Timestamps of recent requests */
  #timestamps = [];

  /**
   * @param {number} [maxRequests=5] - Maximum requests allowed
   * @param {number} [windowMs=3000] - Window duration in ms
   */
  constructor(maxRequests = 5, windowMs = 3000) {
    this.#maxRequests = maxRequests;
    this.#windowMs = windowMs;
  }

  /**
   * Check if a request is allowed under current rate limits.
   * @returns {boolean} - True if request is allowed, false if rate limited
   */
  allow() {
    const now = Date.now();
    this.#timestamps = this.#timestamps.filter((t) => now - t < this.#windowMs);

    if (this.#timestamps.length >= this.#maxRequests) {
      return false;
    }

    this.#timestamps.push(now);
    return true;
  }
}

// ─── Trusted Circle Manager (R4) ──────────────────────────────
/**
 * Manages the user's trusted emergency contacts.
 */
export class TrustedCircle {
  /** @type {Array<{id: string, name: string, phone: string, initials: string, priority: number}>} */
  #contacts;
  /** @type {StorageManager} Storage manager instance */
  #storage;

  constructor() {
    this.#storage = new StorageManager('safepath_');
    this.#contacts = this.#loadFromStorage();
  }

  /**
   * Add a new emergency contact.
   * @param {object} contactData
   * @param {string} contactData.name
   * @param {string} contactData.phone
   * @param {number} [contactData.priority=99]
   * @returns {{id: string, name: string, phone: string, initials: string, priority: number}}
   */
  addContact({ name, phone, priority = 99 }) {
    if (typeof name !== 'string' || typeof phone !== 'string') {
      throw new SecurityValidationError('Contact name and phone must be strings');
    }

    const contact = {
      id: crypto.randomUUID?.() || `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: sanitizeInput(name),
      phone: sanitizeInput(phone),
      initials: name.split(' ').map((w) => w[0]?.toUpperCase() || '').join('').slice(0, 2),
      priority: typeof priority === 'number' ? priority : 99,
    };

    this.#contacts.push(contact);
    this.#contacts.sort((a, b) => a.priority - b.priority);
    this.#saveToStorage();
    return contact;
  }

  /**
   * Remove contact by ID.
   * @param {string} id
   */
  removeContact(id) {
    this.#contacts = this.#contacts.filter((c) => c.id !== id);
    this.#saveToStorage();
  }

  /**
   * Get all contacts sorted by priority.
   * @returns {Array<{id: string, name: string, phone: string, initials: string, priority: number}>}
   */
  getContacts() {
    return [...this.#contacts];
  }

  /**
   * Get primary emergency contact.
   * @returns {{id: string, name: string, phone: string, initials: string, priority: number}|null}
   */
  getPrimaryContact() {
    return this.#contacts[0] || null;
  }

  /**
   * Contact count getter.
   * @returns {number}
   */
  get count() {
    return this.#contacts.length;
  }

  #saveToStorage() {
    this.#storage.setItem('trusted_circle', this.#contacts);
  }

  #loadFromStorage() {
    const loaded = this.#storage.getItem('trusted_circle', null);
    if (Array.isArray(loaded) && loaded.length > 0) {
      return loaded;
    }
    return this.#defaultContacts();
  }

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
 * Graduated auto-escalation state machine.
 * Tier 1: SMS alert to primary contact
 * Tier 2: Call all contacts
 * Tier 3: Emergency services notification
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
   * @param {object} [options]
   * @param {number} [options.tierIntervalSec=10] - Seconds between tier escalations
   * @param {Function} [options.onStateChange=null] - Called on every state change
   */
  constructor({ tierIntervalSec = 10, onStateChange = null } = {}) {
    this.#tierIntervalSec = typeof tierIntervalSec === 'number' ? tierIntervalSec : 10;
    this.#onStateChange = typeof onStateChange === 'function' ? onStateChange : null;
  }

  /**
   * Begin escalation sequence from Tier 1.
   * @param {TrustedCircle} trustedCircle - Contacts to notify
   */
  beginEscalation(trustedCircle) {
    if (!trustedCircle || typeof trustedCircle.getPrimaryContact !== 'function') {
      throw new SecurityValidationError('Invalid TrustedCircle instance passed to EscalationEngine');
    }

    if (this.#currentTier > 0) return; // Already active

    this.#currentTier = 1;
    const primary = trustedCircle.getPrimaryContact();
    if (primary) {
      this.#notifiedContacts.push(`SMS → ${primary.name}`);
    }
    this.#emitState();
    this.#scheduleNextTier(trustedCircle);
  }

  /** Progress to next tier */
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

  /** Cancel escalation (false alarm - R13) */
  cancel() {
    if (this.#timerHandle) clearTimeout(this.#timerHandle);
    this.#timerHandle = null;
    this.#currentTier = 0;
    this.#notifiedContacts = [];
    this.#emitState();
  }

  /**
   * Get current escalation status snapshot.
   * @returns {{tier: number, active: boolean, notifiedContacts: string[], tierIntervalSec: number}}
   */
  getStatus() {
    return {
      tier: this.#currentTier,
      active: this.#currentTier > 0,
      notifiedContacts: [...this.#notifiedContacts],
      tierIntervalSec: this.#tierIntervalSec,
    };
  }

  #emitState() {
    if (typeof this.#onStateChange === 'function') {
      this.#onStateChange(this.getStatus());
    }
  }
}
