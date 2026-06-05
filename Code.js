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
var MEMBROS_FOTO_FOLDER_ID = '1qiHp44yRdnLPjYryt5EuH5SauD67K_k0';

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

// ═══════════════════════════════════════════════════════════════
//  Membros.gs · Módulo Membros
//  Cadastro · Carteirinha · Backup
//  Padrão idêntico ao EscolaDominical.gs — usa Util + Auth
// ═══════════════════════════════════════════════════════════════

var Membros = (function () {

  var SHEET = 'Membros';

  var HEADERS = [
    'id','rol','nome','sexo','nascimento','nomeMae','nomePai','estadoCivil',
    'batismo','Igreja','funcao','rua','numero','bairro','cidade','estado','cep',
    'celular','email','rg','cpf','foto','fotoZoom','fotoX','fotoY','ativo'
  ];

  // ── Helper defensivo (igual ao _safeSheetObjects da ED) ─────
  function _safeRows() {
    try { return Util.sheetToObjects(SHEET); }
    catch (e) { return []; }
  }

  // ── Garante que a aba existe com cabeçalhos corretos ────────
  function _ensureSheet() {
    var sh = Util.getSheet(SHEET);          // Util já resolve a planilha do projeto
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS);
      sh.getRange(1, 1, 1, HEADERS.length)
        .setFontWeight('bold')
        .setBackground('#00897B')
        .setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
    return sh;
  }

  // ── Setup público (chamado uma vez, via IDE ou frontend) ─────
  function setupPlanilhaMembros(token) {
    try {
      // token é opcional: permite chamar da IDE sem sessão ativa
      if (token) Auth._auth(token);
      _ensureSheet();
      Logger.log('[Membros] Aba "' + SHEET + '" pronta.');
      return Util.ok({ mensagem: 'Aba Membros configurada com sucesso.' });
    } catch (e) {
      Logger.log('[Membros] Erro setup: ' + e);
      return Util.err(e.message);
    }
  }

  // ── Listar todos os membros ──────────────────────────────────
  function getMembros(token) {
    try {
      Auth._auth(token);
      var rows = _safeRows();
      // Converte 'ativo' de forma robusta (boolean/string/número)
      rows = rows.map(function(r) {
        var a = r.ativo;
        r.ativo = (a === true || a === 1 || String(a).trim().toUpperCase() === 'TRUE');
        return r;
      });
      return rows;   // frontend espera array direto (igual ao padrão original)
    } catch (e) {
      Logger.log('[Membros] getMembros error: ' + e);
      return [];
    }
  }

  // ── Salvar (inserir ou atualizar) ────────────────────────────
  function salvarMembro(token, membro) {
    try {
      Auth._auth(token);
      _ensureSheet();

      var row = HEADERS.map(function(h) {
        return membro[h] !== undefined ? membro[h] : '';
      });

      // Buscar linha existente pelo id
      var sh   = Util.getSheet(SHEET);
      var data = sh.getDataRange().getValues();
      var foundRow = -1;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(membro.id)) { foundRow = i + 1; break; }
      }

      if (foundRow > 0) {
        sh.getRange(foundRow, 1, 1, HEADERS.length).setValues([row]);
      } else {
        sh.appendRow(row);
      }

      return { success: true };
    } catch (e) {
      Logger.log('[Membros] salvarMembro error: ' + e);
      return { success: false, error: String(e) };
    }
  }

  // ── Deletar por id ───────────────────────────────────────────
  function deletarMembro(token, id) {
    try {
      Auth._auth(token);
      var sh   = Util.getSheet(SHEET);
      var data = sh.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(id)) {
          sh.deleteRow(i + 1);
          return { success: true };
        }
      }
      return { success: false, error: 'Membro não encontrado.' };
    } catch (e) {
      Logger.log('[Membros] deletarMembro error: ' + e);
      return { success: false, error: String(e) };
    }
  }

  return {
    setupPlanilhaMembros: setupPlanilhaMembros,
    getMembros:           getMembros,
    salvarMembro:         salvarMembro,
    deletarMembro:        deletarMembro
  };

})();


// ── FUNÇÕES PÚBLICAS (expostas ao frontend via google.script.run) ─
// Wrapper _safe idêntico ao usado em EscolaDominical.gs

function setupPlanilhaMembros(token) {
  try {
    var r = Membros.setupPlanilhaMembros(token);
    return JSON.parse(JSON.stringify(r || { success: false, error: 'Resposta vazia.' }));
  } catch(e) { return { success: false, error: e.message }; }
}

function getMembros(token) {
  try {
    var r = Membros.getMembros(token);
    return JSON.parse(JSON.stringify(r || []));
  } catch(e) {
    Logger.log('[getMembros público] ' + e);
    return [];
  }
}

function salvarMembro(token, membro) {
  try {
    var r = Membros.salvarMembro(token, membro);
    return JSON.parse(JSON.stringify(r || { success: false, error: 'Resposta vazia.' }));
  } catch(e) { return { success: false, error: e.message }; }
}

function deletarMembro(token, id) {
  try {
    var r = Membros.deletarMembro(token, id);
    return JSON.parse(JSON.stringify(r || { success: false, error: 'Resposta vazia.' }));
  } catch(e) { return { success: false, error: e.message }; }
}

function _forcarEscopoDrive() {
  // Força o GAS a solicitar o escopo drive na próxima autorização
  var folder = DriveApp.getRootFolder();
  Logger.log('Drive OK: ' + folder.getName());
}

function _pingDriveWrite() {
  var folder = DriveApp.getRootFolder();
  // Testa escrita real: cria e apaga arquivo de teste
  var f = folder.createFile('_ping_test.txt', 'ok', MimeType.PLAIN_TEXT);
  f.setTrashed(true);
  Logger.log('Escrita no Drive OK');
}