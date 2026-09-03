/* THE CAPITAL — Accessibility runtime
 * Adds stable names and accessible labels to static and dynamically rendered
 * controls without changing existing IDs/selectors or business logic.
 */
(function () {
  'use strict';
  if (window.__TC_ACCESSIBILITY_RUNTIME__) return;
  window.__TC_ACCESSIBILITY_RUNTIME__ = true;

  function labelFrom(el) {
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return placeholder.replace(/…/g, '').trim();
    const aria = el.getAttribute('aria-label');
    if (aria) return aria.trim();
    const id = el.id || '';
    if (id) return id.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
    const parent = el.closest('.field,.form-group,.portf-form,.screener-filters,.search-bar,.card-tools');
    const text = parent && parent.querySelector('label')?.textContent;
    return text ? text.trim() : 'Champ de formulaire';
  }

  function normalize(root) {
    if (!root || root.nodeType !== 1 && root !== document) return;
    const controls = root.querySelectorAll
      ? root.querySelectorAll('input:not([type="hidden"]), select, textarea')
      : [];
    controls.forEach((el) => {
      if (!el.id && !el.name) {
        const base = (labelFrom(el) || 'field').toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'field';
        let name = `tc-${base}`;
        let n = 2;
        while (document.querySelector(`[name="${CSS.escape(name)}"]`)) name = `tc-${base}-${n++}`;
        el.name = name;
      }

      const hasExplicitLabel = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      const wrappedLabel = el.closest('label');
      if (!hasExplicitLabel && !wrappedLabel && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) {
        el.setAttribute('aria-label', labelFrom(el));
      }
    });
  }

  function boot() {
    normalize(document.body);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => m.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) normalize(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
