// ═══════════════════════════════════════════════════════════
//  Code.gs · Entry Point & Router
// ═══════════════════════════════════════════════════════════

var SPREADSHEET_ID     = '16Es1ybDiTm90HL75c6rRgqQv98AcZ7W33WMrfhksxkg';
var SESSION_TTL_SECONDS = 21600; // 6 horas (limite real do CacheService)

var SHEETS = {
  USUARIOS:      'Usuarios',
  SESSOES:       'Sessoes',
  CLASSES:       'Classes',
  ALUNOS:        'Alunos',
  PROFESSORES:   'Professores',
  AULAS:         'Aulas',
  CHAMADAS:      'Chamadas',
  PONTOS_EXTRAS: 'PontosExtras',
  CONFIG:        'Config'
};

var PERFIS = {
  ADMIN:      'admin',
  SECRETARIA: 'secretaria',
  PROFESSOR:  'professor'
};

// ── SS: inicialização LAZY (evita crash global) ──────────────
var _SS = null;
function getSSInstance() {
  if (!_SS) {
    _SS = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return _SS;
}

// Compatibilidade: outros arquivos usam SS diretamente
// Definir como getter para inicialização lazy
var SS = null; // será sobrescrito abaixo
try {
  SS = SpreadsheetApp.openById(SPREADSHEET_ID);
} catch(e) {
  // Se falhar, SS ficará null e getSSInstance() será usado como fallback
  Logger.log('Aviso: SS não inicializado no escopo global: ' + e.message);
}

// ── ENTRY POINT ─────────────────────────────────────────────
function doGet(e) {
  var view = (e && e.parameter && e.parameter.view) ? e.parameter.view : 'login';
  var publicViews = ['login', 'primeiro-acesso', 'recuperar-senha'];
  var template = HtmlService.createTemplateFromFile('index');
  template.view         = view;
  template.isPublicView = publicViews.indexOf(view) !== -1;
  return template.evaluate()
    .setTitle('AD Fonte da Salvação')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0');
}

// ── INCLUDE HELPER ───────────────────────────────────────────
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── SETUP ────────────────────────────────────────────────────
function setupSpreadsheet() {
  SetupSheets.createAllSheets();
}

function runMigrate() {
  SetupSheets.migrateColumns();
  }
