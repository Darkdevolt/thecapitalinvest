/**
 * Validation et sanitization des entrées
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const TICKER_REGEX = /^[A-Z]{2,6}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const validators = {
  email: (v) => typeof v === 'string' && v.length <= 254 && EMAIL_REGEX.test(v),
  password: (v) => typeof v === 'string' && v.length >= 6 && v.length <= 128,
  name: (v) => typeof v === 'string' && v.length >= 1 && v.length <= 100 && /^[\p{L}\s'-]+$/u.test(v),
  ticker: (v) => typeof v === 'string' && TICKER_REGEX.test(v),
  uuid: (v) => typeof v === 'string' && UUID_REGEX.test(v),
  integer: (v, min = -Infinity, max = Infinity) => Number.isInteger(v) && v >= min && v <= max,
  number: (v, min = -Infinity, max = Infinity) => typeof v === 'number' && !isNaN(v) && v >= min && v <= max,
  string: (v, min = 0, max = 1000) => typeof v === 'string' && v.length >= min && v.length <= max,
  enum: (v, values) => values.includes(v),
};

/**
 * Sanitize une chaîne pour prévenir XSS
 * @param {string} str
 * @returns {string}
 */
export function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Valide un objet contre un schéma
 * @param {Object} data — données à valider
 * @param {Object} schema — { champ: { type, required, min, max, values } }
 * @returns {{valid: boolean, errors: string[], sanitized: Object}}
 */
export function validate(data, schema) {
  const errors = [];
  const sanitized = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    if (value === undefined || value === null) {
      if (rules.required) errors.push(`Champ '${field}' requis`);
      continue;
    }

    let valid = false;
    const v = rules.sanitize ? sanitize(value) : value;

    switch (rules.type) {
      case 'email':
        valid = validators.email(v);
        break;
      case 'password':
        valid = validators.password(v);
        break;
      case 'name':
        valid = validators.name(v);
        break;
      case 'ticker':
        valid = validators.ticker(v?.toUpperCase?.());
        break;
      case 'uuid':
        valid = validators.uuid(v);
        break;
      case 'integer':
        valid = validators.integer(Number(v), rules.min, rules.max);
        break;
      case 'number':
        valid = validators.number(Number(v), rules.min, rules.max);
        break;
      case 'string':
        valid = validators.string(v, rules.min, rules.max);
        break;
      case 'enum':
        valid = validators.enum(v, rules.values);
        break;
      default:
        valid = true;
    }

    if (!valid) {
      errors.push(`Champ '${field}' invalide`);
    } else {
      sanitized[field] = v;
    }
  }

  return { valid: errors.length === 0, errors, sanitized };
}
