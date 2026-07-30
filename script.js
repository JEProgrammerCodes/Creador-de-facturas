'use strict';

/* ═══════════════════════════════════════════════════════════
   CREADOR DE FACTURAS — script.js
   ═══════════════════════════════════════════════════════════ */

// ── Storage keys ─────────────────────────────────────────────
const KEYS = {
  settings: 'facturador_config',
  invoices: 'facturador_invoices',
};

// ── App state ─────────────────────────────────────────────────
const state = {
  items:     [],   // current line items
  nextId:    1,    // auto-increment id for items
  logoUrl:   null, // data URL of issuer logo
  editingId: null, // id of invoice being edited (or null for new)
};

// ── Utility helpers ───────────────────────────────────────────
/** Get element by id */
const $ = (id) => document.getElementById(id);

/** Get trimmed value of an input/select by id */
const val = (id) => { const el = $(id); return el ? el.value.trim() : ''; };

/** Set value of an input/select/textarea by id */
const setVal = (id, v) => { const el = $(id); if (el) el.value = (v != null ? v : ''); };

/** Escape HTML special characters to prevent XSS */
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format ISO date YYYY-MM-DD to DD/MM/YYYY */
function fmtDate(d) {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

/** Today's date as YYYY-MM-DD */
function today() { return new Date().toISOString().slice(0, 10); }

/** Date N days from now as YYYY-MM-DD */
function futureDate(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

// ── localStorage helpers ──────────────────────────────────────
function lsGet(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v != null ? v : fallback; }
  catch (e) { return fallback; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { /* quota exceeded – ignore */ }
}

// ── Settings ──────────────────────────────────────────────────
function defaultSettings() {
  return {
    ivaPct:          16,
    currency:        'MXN',
    currencySymbol:  '$',
    companyName:     '',
    companyNif:      '',
    companyAddress:  '',
    companyEmail:    '',
    companyPhone:    '',
  };
}

function getSettings() {
  return Object.assign(defaultSettings(), lsGet(KEYS.settings, {}));
}

function loadSettingsUI() {
  const s = getSettings();
  setVal('settingsIva',            s.ivaPct);
  setVal('settingsCurrency',       s.currency);
  setVal('settingsCurrencySymbol', s.currencySymbol);
  setVal('settingsCompanyName',    s.companyName);
  setVal('settingsCompanyNif',     s.companyNif);
  setVal('settingsCompanyAddress', s.companyAddress);
  setVal('settingsCompanyEmail',   s.companyEmail);
  setVal('settingsCompanyPhone',   s.companyPhone);
}

function saveSettingsUI() {
  const s = {
    ivaPct:         parseFloat(val('settingsIva'))          || 16,
    currency:       val('settingsCurrency')                  || 'MXN',
    currencySymbol: val('settingsCurrencySymbol')            || '$',
    companyName:    val('settingsCompanyName'),
    companyNif:     val('settingsCompanyNif'),
    companyAddress: val('settingsCompanyAddress'),
    companyEmail:   val('settingsCompanyEmail'),
    companyPhone:   val('settingsCompanyPhone'),
  };
  lsSet(KEYS.settings, s);
  recalcTotals(); // symbol may have changed
  toast('Configuración guardada ✓');
}

function applyDefaultCompany() {
  const s = getSettings();
  if (s.companyName)    setVal('issuerName',    s.companyName);
  if (s.companyNif)     setVal('issuerNif',     s.companyNif);
  if (s.companyAddress) setVal('issuerAddress', s.companyAddress);
  if (s.companyEmail)   setVal('issuerEmail',   s.companyEmail);
  if (s.companyPhone)   setVal('issuerPhone',   s.companyPhone);
  toast('Datos de empresa cargados');
}

// ── Invoice number auto-generation ───────────────────────────
function nextInvoiceNumber() {
  const invoices = lsGet(KEYS.invoices, []);
  const year = new Date().getFullYear();
  const seq  = invoices.length + 1;
  return 'FAC-' + year + '-' + String(seq).padStart(4, '0');
}

// ── Logo upload ───────────────────────────────────────────────
function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    toast('El archivo de logo es demasiado grande (máx. 2 MB)', 'error');
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function (evt) {
    state.logoUrl = evt.target.result;
    $('logoPreview').src = evt.target.result;
    $('logoPreviewContainer').style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  state.logoUrl = null;
  $('logoInput').value = '';
  $('logoPreviewContainer').style.display = 'none';
}

// ── Item CRUD ─────────────────────────────────────────────────
function addItem(desc, qty, price, tax, disc) {
  const settings = getSettings();
  state.items.push({
    id:    state.nextId++,
    desc:  desc  != null ? String(desc)             : '',
    qty:   qty   != null ? (parseFloat(qty)   || 0) : 1,
    price: price != null ? (parseFloat(price) || 0) : 0,
    tax:   tax   != null ? (parseFloat(tax)   || 0) : settings.ivaPct,
    disc:  disc  != null ? (parseFloat(disc)  || 0) : 0,
  });
  renderItems();
  recalcTotals();
  // Focus the description field of the new item
  const newId = state.items[state.items.length - 1].id;
  setTimeout(function () {
    const descInput = $('item-desc-' + newId);
    if (descInput) descInput.focus();
  }, 50);
}

function removeItem(id) {
  state.items = state.items.filter(function (i) { return i.id !== id; });
  renderItems();
  recalcTotals();
}

function updateItemField(id, field, rawVal) {
  const item = state.items.find(function (i) { return i.id === id; });
  if (!item) return;
  if (field === 'desc') {
    item.desc = rawVal;
  } else {
    item[field] = parseFloat(rawVal) || 0;
  }
  // Update only the subtotal cell (avoids full re-render / cursor loss)
  const cell = $('subtotal-' + id);
  if (cell) cell.textContent = fmtCurrency(calcItem(item).total);
  recalcTotals();
}

// ── Financial calculations ────────────────────────────────────
/**
 * Calculate per-item amounts.
 * Formula:
 *   base     = qty * price
 *   discAmt  = base * (disc% / 100)
 *   net      = base - discAmt
 *   taxAmt   = net  * (tax%  / 100)
 *   total    = net  + taxAmt
 */
function calcItem(item) {
  var qty   = Math.max(0, parseFloat(item.qty)   || 0);
  var price = Math.max(0, parseFloat(item.price) || 0);
  var disc  = Math.min(100, Math.max(0, parseFloat(item.disc) || 0));
  var tax   = Math.min(100, Math.max(0, parseFloat(item.tax)  || 0));

  var base    = qty * price;
  var discAmt = base * (disc / 100);
  var net     = base - discAmt;
  var taxAmt  = net  * (tax  / 100);
  var total   = net  + taxAmt;

  return { base: base, discAmt: discAmt, net: net, taxAmt: taxAmt, total: total };
}

/** Sum totals across all items */
function calcTotals() {
  return state.items.reduce(function (acc, item) {
    var c = calcItem(item);
    acc.base    += c.base;
    acc.discAmt += c.discAmt;
    acc.taxAmt  += c.taxAmt;
    acc.total   += c.total;
    return acc;
  }, { base: 0, discAmt: 0, taxAmt: 0, total: 0 });
}

/** Format a number as currency with thousands separator */
function fmtCurrency(n) {
  var s   = getSettings();
  var num = isNaN(n) ? 0 : parseFloat(n);
  return s.currencySymbol + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Update the totals display in the form */
function recalcTotals() {
  var t = calcTotals();
  $('totalSubtotal').textContent = fmtCurrency(t.base);
  $('totalDiscount').textContent = fmtCurrency(t.discAmt);
  $('totalTax').textContent      = fmtCurrency(t.taxAmt);
  $('totalFinal').innerHTML      = '<strong>' + fmtCurrency(t.total) + '</strong>';
}

// ── Render items table ────────────────────────────────────────
function renderItems() {
  var tbody = $('itemsBody');
  clearErrors();

  if (state.items.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="empty-cell">' +
      'No hay conceptos. Haz clic en <strong>&#xFF0B; Agregar concepto</strong>.' +
      '</td></tr>';
    return;
  }

  tbody.innerHTML = state.items.map(function (item, idx) {
    var c    = calcItem(item);
    var iid  = item.id;
    var num  = idx + 1;
    return (
      '<tr data-id="' + iid + '">' +
        '<td>' +
          '<input type="text" class="item-input" id="item-desc-' + iid + '"' +
                ' value="' + escHtml(item.desc) + '"' +
                ' placeholder="Descripción del concepto"' +
                ' aria-label="Descripción concepto ' + num + '"' +
                ' oninput="updateItemField(' + iid + ',\'desc\',this.value)">' +
          '<span class="field-error" id="err-desc-' + iid + '" role="alert"></span>' +
        '</td>' +
        '<td class="col-num">' +
          '<input type="number" class="item-input num-input" id="item-qty-' + iid + '"' +
                ' value="' + item.qty + '" min="0" step="0.01"' +
                ' aria-label="Cantidad concepto ' + num + '"' +
                ' oninput="updateItemField(' + iid + ',\'qty\',this.value)">' +
          '<span class="field-error" id="err-qty-' + iid + '" role="alert"></span>' +
        '</td>' +
        '<td class="col-num">' +
          '<input type="number" class="item-input num-input" id="item-price-' + iid + '"' +
                ' value="' + item.price + '" min="0" step="0.01"' +
                ' aria-label="Precio unitario concepto ' + num + '"' +
                ' oninput="updateItemField(' + iid + ',\'price\',this.value)">' +
        '</td>' +
        '<td class="col-num">' +
          '<input type="number" class="item-input num-input"' +
                ' value="' + item.tax + '" min="0" max="100" step="0.01"' +
                ' aria-label="IVA porcentaje concepto ' + num + '"' +
                ' oninput="updateItemField(' + iid + ',\'tax\',this.value)">' +
        '</td>' +
        '<td class="col-num">' +
          '<input type="number" class="item-input num-input"' +
                ' value="' + item.disc + '" min="0" max="100" step="0.01"' +
                ' aria-label="Descuento porcentaje concepto ' + num + '"' +
                ' oninput="updateItemField(' + iid + ',\'disc\',this.value)">' +
        '</td>' +
        '<td class="col-num subtotal-cell" id="subtotal-' + iid + '">' +
          fmtCurrency(c.total) +
        '</td>' +
        '<td class="col-action">' +
          '<button type="button" class="btn-icon btn-danger-icon"' +
                ' onclick="removeItem(' + iid + ')"' +
                ' aria-label="Eliminar concepto ' + num + '">&#x2715;</button>' +
        '</td>' +
      '</tr>'
    );
  }).join('');
}

// ── Validation ────────────────────────────────────────────────
function validateForm() {
  clearErrors();
  var ok = true;

  function req(id, label) {
    var el = $(id);
    if (!el || !el.value.trim()) {
      showFieldError(id, label + ' es requerido');
      ok = false;
    }
  }

  req('issuerName',    'El nombre del emisor');
  req('clientName',    'El nombre del cliente');
  req('invoiceNumber', 'El número de factura');
  req('issueDate',     'La fecha de emisión');

  if (state.items.length === 0) {
    $('itemsError').textContent = 'Agrega al menos un concepto a la factura';
    ok = false;
  } else {
    state.items.forEach(function (item, idx) {
      if (!item.desc.trim()) {
        var errEl = $('err-desc-' + item.id);
        if (errEl) errEl.textContent = 'La descripción es requerida';
        var inputEl = $('item-desc-' + item.id);
        if (inputEl) inputEl.classList.add('input-error');
        ok = false;
      }
      if (item.qty <= 0) {
        var errEl2 = $('err-qty-' + item.id);
        if (errEl2) errEl2.textContent = 'Debe ser mayor que 0';
        var inputEl2 = $('item-qty-' + item.id);
        if (inputEl2) inputEl2.classList.add('input-error');
        ok = false;
      }
    });
  }

  if (!ok) {
    var firstErr = document.querySelector('.field-error:not(:empty)');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return ok;
}

function showFieldError(inputId, msg) {
  var errEl = $('error-' + inputId);
  if (errEl) errEl.textContent = msg;
  var input = $(inputId);
  if (input) input.classList.add('input-error');
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(function (el) { el.textContent = ''; });
  document.querySelectorAll('.input-error').forEach(function (el) { el.classList.remove('input-error'); });
}

/** Clear error for a field when the user starts typing */
function attachErrorClearListeners() {
  document.querySelectorAll('#invoiceForm input, #invoiceForm textarea, #invoiceForm select')
    .forEach(function (el) {
      el.addEventListener('input', function () {
        this.classList.remove('input-error');
        var errEl = $('error-' + this.id);
        if (errEl) errEl.textContent = '';
      });
    });
}

// ── Collect form data ─────────────────────────────────────────
function collectFormData() {
  var settings = getSettings();
  var tots     = calcTotals();
  return {
    issuerName:    val('issuerName'),
    issuerNif:     val('issuerNif'),
    issuerAddress: val('issuerAddress'),
    issuerEmail:   val('issuerEmail'),
    issuerPhone:   val('issuerPhone'),
    logoUrl:       state.logoUrl,
    clientName:    val('clientName'),
    clientNif:     val('clientNif'),
    clientAddress: val('clientAddress'),
    clientEmail:   val('clientEmail'),
    clientPhone:   val('clientPhone'),
    invoiceNumber: val('invoiceNumber'),
    issueDate:     val('issueDate'),
    dueDate:       val('dueDate'),
    currency:      val('invoiceCurrency'),
    notes:         val('invoiceNotes'),
    items: state.items.map(function (item) {
      return Object.assign({}, item, calcItem(item));
    }),
    subtotal:       tots.base,
    discAmt:        tots.discAmt,
    taxAmt:         tots.taxAmt,
    total:          tots.total,
    currencySymbol: settings.currencySymbol,
  };
}

// ── Preview generation ────────────────────────────────────────
function generatePreview() {
  if (!validateForm()) { showTab('form'); return; }

  var d   = collectFormData();
  var sym = d.currencySymbol;

  function f(n) {
    var num = isNaN(n) ? 0 : parseFloat(n);
    return sym + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  var logoHtml = d.logoUrl
    ? '<img src="' + escHtml(d.logoUrl) + '" alt="Logo de la empresa" class="inv-logo">'
    : '';

  var rowsHtml = d.items.map(function (item, i) {
    var discDisplay = parseFloat(item.disc) > 0
      ? parseFloat(item.disc).toFixed(1) + '%'
      : '&mdash;';
    return (
      '<tr>' +
        '<td class="item-num">' + (i + 1) + '</td>' +
        '<td>' + escHtml(item.desc) + '</td>' +
        '<td class="text-right">' + parseFloat(item.qty).toFixed(2) + '</td>' +
        '<td class="text-right">' + f(item.price) + '</td>' +
        '<td class="text-right">' + parseFloat(item.tax).toFixed(1) + '%</td>' +
        '<td class="text-right">' + discDisplay + '</td>' +
        '<td class="text-right">' + f(item.total) + '</td>' +
      '</tr>'
    );
  }).join('');

  var discRow = d.discAmt > 0
    ? '<tr><td>Descuentos</td><td class="text-right text-danger">&minus;' + f(d.discAmt) + '</td></tr>'
    : '';

  var notesHtml = d.notes
    ? '<div class="inv-notes"><h4>Notas / Condiciones de pago</h4><p>' +
      escHtml(d.notes).replace(/\n/g, '<br>') + '</p></div>'
    : '';

  var dueDateRow = d.dueDate
    ? '<tr><td>Vencimiento:</td><td>' + fmtDate(d.dueDate) + '</td></tr>'
    : '';

  var html = (
    '<div class="invoice-doc" id="invoiceDoc">' +

      '<div class="inv-top">' +
        '<div class="inv-from">' +
          logoHtml +
          '<h2 class="inv-company">' + escHtml(d.issuerName) + '</h2>' +
          (d.issuerNif     ? '<p>NIF/RFC: ' + escHtml(d.issuerNif) + '</p>' : '') +
          (d.issuerAddress ? '<p class="inv-addr">' + escHtml(d.issuerAddress).replace(/\n/g, '<br>') + '</p>' : '') +
          (d.issuerEmail   ? '<p>' + escHtml(d.issuerEmail) + '</p>' : '') +
          (d.issuerPhone   ? '<p>Tel: ' + escHtml(d.issuerPhone) + '</p>' : '') +
        '</div>' +
        '<div class="inv-meta">' +
          '<p class="inv-title-label">FACTURA</p>' +
          '<table class="inv-meta-tbl">' +
            '<tr><td>N.&ordm;:</td><td><strong>' + escHtml(d.invoiceNumber) + '</strong></td></tr>' +
            '<tr><td>Emisi&oacute;n:</td><td>' + fmtDate(d.issueDate) + '</td></tr>' +
            dueDateRow +
            '<tr><td>Moneda:</td><td>' + escHtml(d.currency) + '</td></tr>' +
          '</table>' +
        '</div>' +
      '</div>' +

      '<div class="inv-client">' +
        '<p class="inv-client-label">Facturar a:</p>' +
        '<p class="inv-client-name">' + escHtml(d.clientName) + '</p>' +
        (d.clientNif     ? '<p>NIF/RFC: ' + escHtml(d.clientNif) + '</p>' : '') +
        (d.clientAddress ? '<p>' + escHtml(d.clientAddress).replace(/\n/g, '<br>') + '</p>' : '') +
        (d.clientEmail   ? '<p>' + escHtml(d.clientEmail) + '</p>' : '') +
        (d.clientPhone   ? '<p>Tel: ' + escHtml(d.clientPhone) + '</p>' : '') +
      '</div>' +

      '<table class="inv-items">' +
        '<thead>' +
          '<tr>' +
            '<th class="item-num">#</th>' +
            '<th>Descripci&oacute;n</th>' +
            '<th class="text-right">Cant.</th>' +
            '<th class="text-right">Precio unit.</th>' +
            '<th class="text-right">IVA</th>' +
            '<th class="text-right">Desc.</th>' +
            '<th class="text-right">Subtotal</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
      '</table>' +

      '<div class="inv-totals-wrap">' +
        '<table class="inv-totals">' +
          '<tr><td>Subtotal:</td><td class="text-right">' + f(d.subtotal) + '</td></tr>' +
          discRow +
          '<tr><td>Impuestos:</td><td class="text-right">' + f(d.taxAmt) + '</td></tr>' +
          '<tr class="inv-total-final">' +
            '<td><strong>TOTAL:</strong></td>' +
            '<td class="text-right"><strong>' + f(d.total) + '</strong></td>' +
          '</tr>' +
        '</table>' +
      '</div>' +

      notesHtml +
    '</div>'
  );

  $('previewContent').innerHTML = html;
  showTab('preview');
}

// ── Print ─────────────────────────────────────────────────────
function printInvoice() {
  if (!validateForm()) { showTab('form'); return; }
  // Make sure preview is up-to-date before printing
  var d   = collectFormData();
  var sym = d.currencySymbol;

  function f(n) {
    var num = isNaN(n) ? 0 : parseFloat(n);
    return sym + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  var logoHtml = d.logoUrl
    ? '<img src="' + escHtml(d.logoUrl) + '" alt="Logo de la empresa" class="inv-logo">'
    : '';

  var rowsHtml = d.items.map(function (item, i) {
    var discDisplay = parseFloat(item.disc) > 0
      ? parseFloat(item.disc).toFixed(1) + '%'
      : '&mdash;';
    return (
      '<tr>' +
        '<td class="item-num">' + (i + 1) + '</td>' +
        '<td>' + escHtml(item.desc) + '</td>' +
        '<td class="text-right">' + parseFloat(item.qty).toFixed(2) + '</td>' +
        '<td class="text-right">' + f(item.price) + '</td>' +
        '<td class="text-right">' + parseFloat(item.tax).toFixed(1) + '%</td>' +
        '<td class="text-right">' + discDisplay + '</td>' +
        '<td class="text-right">' + f(item.total) + '</td>' +
      '</tr>'
    );
  }).join('');

  var discRow = d.discAmt > 0
    ? '<tr><td>Descuentos</td><td class="text-right text-danger">&minus;' + f(d.discAmt) + '</td></tr>'
    : '';

  var notesHtml = d.notes
    ? '<div class="inv-notes"><h4>Notas / Condiciones de pago</h4><p>' +
      escHtml(d.notes).replace(/\n/g, '<br>') + '</p></div>'
    : '';

  var dueDateRow = d.dueDate
    ? '<tr><td>Vencimiento:</td><td>' + fmtDate(d.dueDate) + '</td></tr>'
    : '';

  var html = (
    '<div class="invoice-doc" id="invoiceDoc">' +
      '<div class="inv-top">' +
        '<div class="inv-from">' +
          logoHtml +
          '<h2 class="inv-company">' + escHtml(d.issuerName) + '</h2>' +
          (d.issuerNif     ? '<p>NIF/RFC: ' + escHtml(d.issuerNif) + '</p>' : '') +
          (d.issuerAddress ? '<p>' + escHtml(d.issuerAddress).replace(/\n/g, '<br>') + '</p>' : '') +
          (d.issuerEmail   ? '<p>' + escHtml(d.issuerEmail) + '</p>' : '') +
          (d.issuerPhone   ? '<p>Tel: ' + escHtml(d.issuerPhone) + '</p>' : '') +
        '</div>' +
        '<div class="inv-meta">' +
          '<p class="inv-title-label">FACTURA</p>' +
          '<table class="inv-meta-tbl">' +
            '<tr><td>N.&ordm;:</td><td><strong>' + escHtml(d.invoiceNumber) + '</strong></td></tr>' +
            '<tr><td>Emisi&oacute;n:</td><td>' + fmtDate(d.issueDate) + '</td></tr>' +
            dueDateRow +
            '<tr><td>Moneda:</td><td>' + escHtml(d.currency) + '</td></tr>' +
          '</table>' +
        '</div>' +
      '</div>' +
      '<div class="inv-client">' +
        '<p class="inv-client-label">Facturar a:</p>' +
        '<p class="inv-client-name">' + escHtml(d.clientName) + '</p>' +
        (d.clientNif     ? '<p>NIF/RFC: ' + escHtml(d.clientNif) + '</p>' : '') +
        (d.clientAddress ? '<p>' + escHtml(d.clientAddress).replace(/\n/g, '<br>') + '</p>' : '') +
        (d.clientEmail   ? '<p>' + escHtml(d.clientEmail) + '</p>' : '') +
        (d.clientPhone   ? '<p>Tel: ' + escHtml(d.clientPhone) + '</p>' : '') +
      '</div>' +
      '<table class="inv-items">' +
        '<thead><tr>' +
          '<th class="item-num">#</th>' +
          '<th>Descripci&oacute;n</th>' +
          '<th class="text-right">Cant.</th>' +
          '<th class="text-right">Precio unit.</th>' +
          '<th class="text-right">IVA</th>' +
          '<th class="text-right">Desc.</th>' +
          '<th class="text-right">Subtotal</th>' +
        '</tr></thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
      '</table>' +
      '<div class="inv-totals-wrap">' +
        '<table class="inv-totals">' +
          '<tr><td>Subtotal:</td><td class="text-right">' + f(d.subtotal) + '</td></tr>' +
          discRow +
          '<tr><td>Impuestos:</td><td class="text-right">' + f(d.taxAmt) + '</td></tr>' +
          '<tr class="inv-total-final"><td><strong>TOTAL:</strong></td><td class="text-right"><strong>' + f(d.total) + '</strong></td></tr>' +
        '</table>' +
      '</div>' +
      notesHtml +
    '</div>'
  );

  $('previewContent').innerHTML = html;
  // Switch to preview tab so @media print shows it
  document.querySelectorAll('.tab-content').forEach(function (el) {
    el.classList.remove('active');
  });
  $('tab-preview').classList.add('active');

  setTimeout(function () { window.print(); }, 150);
}

// ── Save invoice ──────────────────────────────────────────────
function saveInvoice() {
  if (!validateForm()) return;

  var data      = collectFormData();
  data.rawItems = state.items.slice(); // raw items for re-editing
  data.logoUrl  = state.logoUrl;
  data.id       = state.editingId || String(Date.now());
  data.savedAt  = new Date().toISOString();

  var list = lsGet(KEYS.invoices, []);
  var idx  = list.findIndex(function (inv) { return inv.id === data.id; });
  if (idx >= 0) {
    list[idx] = data;
  } else {
    list.unshift(data);
  }
  lsSet(KEYS.invoices, list);
  state.editingId = data.id;

  renderHistory();
  toast('Factura guardada ✓');
}

// ── Load invoice ──────────────────────────────────────────────
function loadInvoice(id) {
  var list = lsGet(KEYS.invoices, []);
  var inv  = list.find(function (i) { return i.id === id; });
  if (!inv) return;

  setVal('issuerName',      inv.issuerName);
  setVal('issuerNif',       inv.issuerNif);
  setVal('issuerAddress',   inv.issuerAddress);
  setVal('issuerEmail',     inv.issuerEmail);
  setVal('issuerPhone',     inv.issuerPhone);
  setVal('clientName',      inv.clientName);
  setVal('clientNif',       inv.clientNif);
  setVal('clientAddress',   inv.clientAddress);
  setVal('clientEmail',     inv.clientEmail);
  setVal('clientPhone',     inv.clientPhone);
  setVal('invoiceNumber',   inv.invoiceNumber);
  setVal('issueDate',       inv.issueDate);
  setVal('dueDate',         inv.dueDate);
  setVal('invoiceCurrency', inv.currency);
  setVal('invoiceNotes',    inv.notes);

  // Restore logo
  state.logoUrl = inv.logoUrl || null;
  if (state.logoUrl) {
    $('logoPreview').src = state.logoUrl;
    $('logoPreviewContainer').style.display = 'flex';
  } else {
    $('logoInput').value = '';
    $('logoPreviewContainer').style.display = 'none';
  }

  // Restore line items
  var rawItems = inv.rawItems || inv.items || [];
  state.items  = rawItems.map(function (item) {
    return {
      id:    parseInt(item.id, 10) || 0,
      desc:  String(item.desc  || ''),
      qty:   parseFloat(item.qty)   || 0,
      price: parseFloat(item.price) || 0,
      tax:   parseFloat(item.tax)   || 0,
      disc:  parseFloat(item.disc)  || 0,
    };
  });
  state.nextId = state.items.length > 0
    ? Math.max.apply(null, state.items.map(function (i) { return i.id; })) + 1
    : 1;

  state.editingId = id;

  renderItems();
  recalcTotals();
  clearErrors();
  showTab('form');
  toast('Factura cargada ✓');
}

// ── Delete invoice ────────────────────────────────────────────
function deleteInvoice(id) {
  if (!confirm('¿Eliminar esta factura del historial? Esta acción no se puede deshacer.')) return;
  var list = lsGet(KEYS.invoices, []).filter(function (i) { return i.id !== id; });
  lsSet(KEYS.invoices, list);
  if (state.editingId === id) state.editingId = null;
  renderHistory();
  toast('Factura eliminada');
}

// ── History rendering ─────────────────────────────────────────
function renderHistory() {
  var list = lsGet(KEYS.invoices, []);
  var el   = $('historyList');

  if (list.length === 0) {
    el.innerHTML = '<p class="empty-msg">No hay facturas guardadas aún.</p>';
    return;
  }

  el.innerHTML = list.map(function (inv) {
    var sym     = escHtml(inv.currencySymbol || '$');
    var total   = parseFloat(inv.total || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var date    = inv.savedAt ? new Date(inv.savedAt).toLocaleDateString('es-MX') : '&mdash;';
    var active  = inv.id === state.editingId ? ' history-active' : '';
    return (
      '<div class="history-card' + active + '">' +
        '<div class="history-info">' +
          '<span class="hist-num">' + escHtml(inv.invoiceNumber || '&mdash;') + '</span>' +
          '<span class="hist-client">' + escHtml(inv.clientName || '&mdash;') + '</span>' +
          '<span class="hist-total">' + sym + total + '</span>' +
          '<span class="hist-date">' + date + '</span>' +
        '</div>' +
        '<div class="history-actions">' +
          '<button class="btn btn-secondary btn-sm" onclick="loadInvoice(\'' + inv.id + '\')">Cargar</button>' +
          '<button class="btn btn-danger btn-sm"    onclick="deleteInvoice(\'' + inv.id + '\')">Eliminar</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

// ── New / Reset ───────────────────────────────────────────────
function newInvoice() {
  var hasData = state.items.length > 0 || val('issuerName') || val('clientName');
  if (hasData) {
    if (!confirm('¿Crear una nueva factura? Los datos no guardados se perderán.')) return;
  }
  resetForm();
}

function resetForm() {
  $('invoiceForm').reset();

  state.items     = [];
  state.nextId    = 1;
  state.logoUrl   = null;
  state.editingId = null;

  $('logoInput').value                   = '';
  $('logoPreviewContainer').style.display = 'none';

  // Set sensible defaults
  setVal('issueDate',       today());
  setVal('dueDate',         futureDate(30));
  setVal('invoiceNumber',   nextInvoiceNumber());
  setVal('invoiceCurrency', getSettings().currency);

  renderItems();
  recalcTotals();
  clearErrors();
  addItem(); // start with one blank row
}

// ── Tab navigation ────────────────────────────────────────────
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(function (el) {
    el.classList.remove('active');
    el.setAttribute('aria-hidden', 'true');
  });
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    var isActive = btn.dataset.tab === name;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });
  var panel = $('tab-' + name);
  if (panel) {
    panel.classList.add('active');
    panel.removeAttribute('aria-hidden');
  }
  if (name === 'history')  renderHistory();
  if (name === 'settings') loadSettingsUI();
}

// ── Toast notifications ───────────────────────────────────────
var _toastTimer = null;
function toast(msg, type) {
  var el  = $('notification');
  el.textContent = msg;
  el.className   = 'notification notification-' + (type || 'success') + ' show';
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3500);
}

// ── Keyboard shortcuts ────────────────────────────────────────
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', function (e) {
    var ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 's') { e.preventDefault(); saveInvoice(); }
    if (ctrl && e.key === 'p') { e.preventDefault(); printInvoice(); }
  });
}

// ── Wire up events ────────────────────────────────────────────
function wireEvents() {
  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { showTab(btn.dataset.tab); });
  });

  // Toolbar
  $('btnNew').addEventListener(     'click', newInvoice);
  $('btnSave').addEventListener(    'click', saveInvoice);
  $('btnPreview').addEventListener( 'click', generatePreview);
  $('btnPrint').addEventListener(   'click', printInvoice);
  $('btnAddItem').addEventListener( 'click', function () { addItem(); });
  $('btnApplyDefaults').addEventListener('click', applyDefaultCompany);

  // Preview page
  $('btnBackToForm').addEventListener(  'click', function () { showTab('form'); });
  $('btnPrintPreview').addEventListener('click', printInvoice);

  // Settings
  $('btnSaveSettings').addEventListener('click', saveSettingsUI);

  // Logo
  $('logoInput').addEventListener(    'change', handleLogoUpload);
  $('btnRemoveLogo').addEventListener('click',  removeLogo);

  // Clear validation errors on user input
  attachErrorClearListeners();
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  wireEvents();
  setupKeyboardShortcuts();
  resetForm();
}

document.addEventListener('DOMContentLoaded', init);
