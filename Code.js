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

// ── ENTRY POINT ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════
//  doGet — Roteador principal do GAS Web App
//
//  Suporta dois cenários de URL:
//    1) Link de recuperação de senha:
//       ?view=recuperar-senha&token=TOKEN
//    2) Acesso normal:
//       (sem parâmetros)
//
//  O template index.html lê as variáveis <?= recovToken ?>
//  e <?= view ?> injetadas aqui.
// ═══════════════════════════════════════════════════════════
function doGet(e) {
  var params     = e && e.parameter ? e.parameter : {};
  var view       = params.view  || '';
  var recovToken = params.token || '';

  // ── Rota: manifest PWA ──────────────────────────────────────
  if (params.page === 'manifest') {
    var iconUrl = 'https://drive.google.com/thumbnail?id=1D9uYwzWawJPpdcCp2hAtr0u20RnmOpQf&sz=w512';
    var manifest = {
      name: 'AD Fonte da Salvação',
      short_name: 'AD Fonte',
      start_url: ScriptApp.getService().getUrl(),
      display: 'standalone',
      background_color: '#050B10',
      theme_color: '#050B10',
      icons: [
        { src: iconUrl, sizes: '192x192', type: 'image/png' },
        { src: iconUrl, sizes: '512x512', type: 'image/png' }
      ]
    };
    return ContentService
      .createTextOutput(JSON.stringify(manifest))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // ───────────────────────────────────────────────────────────

  var tmpl = HtmlService.createTemplateFromFile('index');

  // Injeta no template — o JS do index.html lê com <?= recovToken ?> e <?= view ?>
  tmpl.recovToken = recovToken;
  tmpl.view       = view;

  return tmpl.evaluate()
    .setTitle('AD Fonte da Salvação — Gestão Ministerial')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ═══════════════════════════════════════════════════════════
//  getSession — Valida token de sessão
//  NUNCA lança exceção — sempre retorna Util.ok ou Util.err
//  para evitar res=null no frontend.
// ═══════════════════════════════════════════════════════════
function getSession(token) {
  try {
    if (!token) return Util.err('Token ausente.');
    var sessao = Auth._auth(token); // lança se inválido
    return Util.ok({
      token:          token,
      id:             sessao.id,
      nome:           sessao.nome,
      email:          sessao.email,
      perfil:         sessao.perfil,
      primeiroAcesso: sessao.primeiroAcesso || false
    });
  } catch(e) {
    // Retorna erro estruturado — jamais lança para o frontend
    return Util.err(e.message || 'Sessão inválida.');
  }
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

// ── MEMBROS: módulo definido em Membros.js ───────────────────
// Wrappers públicos abaixo — implementação em Membros.js

/* REMOVIDO: var Membros = (function () {

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

REMOVIDO FIM */

// ── FUNÇÕES PÚBLICAS (expostas ao frontend via google.script.run) ─
// setupPlanilhaMembros → alias correto definido em Membros.js
// getMembros           → migrado para mb_listarMembros em Membros.js

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




// solicitarRecuperacao, verificarTokenRecuperacao e redefinirSenhaToken
// estão definidas em Auth.js com _safeCall — removidas daqui para evitar override.

/* REMOVIDO — duplicatas sem _safeCall:
function solicitarRecuperacao(email) {
  try {
    email = (email || '').toLowerCase().trim();
    if (!Util.isValidEmail(email)) return Util.err('E-mail inválido.');

    var user = Util.findRow('Usuarios', 'Email', email);

    // Responde success mesmo se não encontrar (segurança anti-enumeração)
    if (!user || !user.Ativo) return Util.ok(true);

    var token  = Util.randomToken();
    var expira = new Date(Date.now() + RECUP_TTL_MINUTES * 60 * 1000).toISOString();

    // Salvar token na planilha
    var changes = { TokenRecupSenha: token, ExpirToken: expira };
    var updated = {};
    Object.keys(user).forEach(function(k) { updated[k] = user[k]; });
    Object.keys(changes).forEach(function(k) { updated[k] = changes[k]; });
    Util.updateRow('Usuarios', user._rowIndex, updated);

    // ── LINK CORRETO: inclui view=recuperar-senha ──────────
    var appUrl = ScriptApp.getService().getUrl();
    var link   = appUrl + '?view=recuperar-senha&token=' + token;
    // ──────────────────────────────────────────────────────

    GmailApp.sendEmail(email, '[AD Fonte da Salvação] Redefinição de senha', '', {
      htmlBody:
        '<div style="font-family:sans-serif;max-width:480px;margin:auto">' +
        '<h2 style="color:#1C353A">Redefinição de Senha</h2>' +
        '<p>Olá, <strong>' + user.Nome + '</strong>!</p>' +
        '<p>Recebemos uma solicitação de redefinição de senha. Clique no botão abaixo para criar uma nova senha.</p>' +
        '<p style="text-align:center;margin:28px 0">' +
          '<a href="' + link + '" style="display:inline-block;background:#00A99C;color:#fff;' +
          'padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">' +
          'Redefinir senha</a>' +
        '</p>' +
        '<p style="color:#888;font-size:12px">Este link expira em ' + RECUP_TTL_MINUTES + ' minutos.<br>' +
        'Se você não solicitou a redefinição, ignore este e-mail.</p>' +
        '<p style="color:#aaa;font-size:11px">AD Fonte da Salvação — Gestão Ministerial</p>' +
        '</div>'
    });

    return Util.ok(true);
  } catch(e) {
    Logger.log('[solicitarRecuperacao] ' + e.message);
    return Util.ok(true); // nunca revela o erro real ao frontend
  }
}

// ── VERIFICAR TOKEN ───────────────────────────────────────
// Chamado pelo frontend ao carregar a tela de redefinição.
// Retorna { nome } se válido para exibir "Olá, Nome".
function verificarTokenRecuperacao(token) {
  try {
    if (!token) return Util.err('Token ausente.');

    var user = Util.findRow('Usuarios', 'TokenRecupSenha', token);
    if (!user) return Util.err('Link inválido ou já utilizado.');

    var expira = user.ExpirToken ? new Date(user.ExpirToken) : null;
    if (!expira || isNaN(expira) || Date.now() > expira.getTime()) {
      return Util.err('Este link expirou. Solicite um novo.');
    }

    return Util.ok({ nome: user.Nome });
  } catch(e) {
    return Util.err('Erro ao verificar link: ' + e.message);
  }
}

// ── REDEFINIR SENHA VIA TOKEN ─────────────────────────────
// Chamado pelo frontend com o hash da nova senha.
REMOVIDO FIM */