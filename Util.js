// ═══════════════════════════════════════════════════════════
//  Util.gs · Helpers compartilhados
// ═══════════════════════════════════════════════════════════

var Util = (function () {

  function uuid() {
    return Utilities.getUuid();
  }

  function now() {
    return Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm:ss'
    );
  }

  function nowISO() {
    return new Date().toISOString();
  }

  // ── getSheet: usa getSSInstance() para evitar dependência de SS global ──
  function getSheet(name) {
    var ss = (typeof getSSInstance === 'function') ? getSSInstance() : SS;
    if (!ss) throw new Error('Planilha não encontrada. Verifique o SPREADSHEET_ID.');
    var sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error('Aba "' + name + '" não encontrada. Execute setupSpreadsheet() primeiro.');
    return sheet;
  }

  function sheetToObjects(sheetName) {
    var sheet = getSheet(sheetName);
    var data  = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    var headers = data[0];
    var rows    = [];
    for (var i = 1; i < data.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      row._rowIndex = i + 1;
      rows.push(row);
    }
    return rows;
  }

  function findRow(sheetName, field, value) {
    var rows = sheetToObjects(sheetName);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][field]).toLowerCase() === String(value).toLowerCase()) {
        return rows[i];
      }
    }
    return null;
  }

  function findById(sheetName, id) {
    return findRow(sheetName, 'ID', id);
  }

  function insertRow(sheetName, data) {
    var sheet   = getSheet(sheetName);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var row     = headers.map(function(h) { return data[h] !== undefined ? data[h] : ''; });
    sheet.appendRow(row);
  }

  function updateRow(sheetName, rowIndex, data) {
    var sheet   = getSheet(sheetName);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var row     = headers.map(function(h) { return data[h] !== undefined ? data[h] : ''; });
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  }

  function sha256(str) {
    var bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      str,
      Utilities.Charset.UTF_8
    );
    return bytes.map(function(b) {
      var hex = (b < 0 ? b + 256 : b).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function ok(data) {
    return { success: true, data: data };
  }

  function err(msg) {
    return { success: false, error: msg };
  }

  function randomToken() {
    return uuid().replace(/-/g,'') + uuid().replace(/-/g,'');
  }

  return {
    uuid:           uuid,
    now:            now,
    nowISO:         nowISO,
    getSheet:       getSheet,
    sheetToObjects: sheetToObjects,
    findRow:        findRow,
    findById:       findById,
    insertRow:      insertRow,
    updateRow:      updateRow,
    sha256:         sha256,
    isValidEmail:   isValidEmail,
    ok:             ok,
    err:            err,
    randomToken:    randomToken
  };

})();
