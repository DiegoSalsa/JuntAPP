/* ==========================================================================
   JuntAPP Utilities (Formatters & Chilean RUT Validator)
   ========================================================================== */

export const utils = {
  /** Remove executable markup from legacy template strings before they reach innerHTML. */
  sanitizeHtml(value) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(value ?? ''), 'text/html');
    doc.querySelectorAll('script, iframe, object, embed, link, meta, base, style').forEach((node) => node.remove());
    doc.querySelectorAll('*').forEach((element) => {
      [...element.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const attrValue = attribute.value.trim().toLowerCase();
        if (name.startsWith('on') || name === 'srcdoc' || ((name === 'href' || name === 'src' || name === 'action' || name === 'formaction') && (attrValue.startsWith('javascript:') || attrValue.startsWith('vbscript:') || attrValue.startsWith('data:text/html')))) {
          element.removeAttribute(attribute.name);
        }
      });
    });
    return doc.body.innerHTML;
  },

  installSafeHtmlPolicy() {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!descriptor?.set || window.__juntappSafeHtmlPolicy) return;
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) { descriptor.set.call(this, utils.sanitizeHtml(value)); },
    });
    window.__juntappSafeHtmlPolicy = true;
  },

  // Format to Chilean Pesos (CLP)
  formatCLP(amount) {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0
    }).format(amount);
  },

  // Format date YYYY-MM-DD to DD/MM/YYYY
  formatDate(dateStr) {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  },

  // Clean RUT: removes dots, spaces, dashes
  cleanRUT(rutStr) {
    return typeof rutStr === 'string' 
      ? rutStr.replace(/[^0-9kK]/g, '').toUpperCase() 
      : '';
  },

  // Format string to Chilean RUT format (e.g. 12345678K -> 12.345.678-K)
  formatRUT(rutStr) {
    let clean = this.cleanRUT(rutStr);
    if (clean.length === 0) return '';
    
    let dv = clean.slice(-1);
    let body = clean.slice(0, -1);
    
    // Add dots to body
    let formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    
    return formattedBody.length > 0 ? `${formattedBody}-${dv}` : dv;
  },

  // Validates Chilean RUT using Modulo 11 algorithm
  validateRUT(rutStr) {
    let clean = this.cleanRUT(rutStr);
    if (clean.length < 8) return false;
    
    let body = clean.slice(0, -1);
    let dv = clean.slice(-1).toUpperCase();
    
    let sum = 0;
    let multiplier = 2;
    
    // Process from right to left
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body.charAt(i), 10) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    
    let expectedDv = 11 - (sum % 11);
    let expectedDvStr = '';
    
    if (expectedDv === 11) expectedDvStr = '0';
    else if (expectedDv === 10) expectedDvStr = 'K';
    else expectedDvStr = expectedDv.toString();
    
    return dv === expectedDvStr;
  }
};
