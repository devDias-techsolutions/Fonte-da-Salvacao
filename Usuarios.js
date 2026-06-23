// ═══════════════════════════════════════════════════════════
//  Usuarios.gs · Gestão de Usuários e Backdoor Admin
//  Padrão: módulo com namespace + Util + Auth._auth
//  Colunas aba "Usuarios":
//    ID, Nome, Email, SenhaHash, Perfil,
//    PrimeiroAcesso, Ativo,
//    TokenRecupSenha, ExpirToken, CriadoEm, UltimoLogin
// ═══════════════════════════════════════════════════════════

// ── BACKDOOR ─────────────────────────────────────────────────
// Hash SHA-256 de uma senha especial de acesso admin de emergência.
// Gerado com: Util.sha256('SuaSenhaBackdoor') — rode no Apps Script.
// Troque o valor abaixo ANTES de usar em produção.
// Para gerar: abra o editor GAS e execute:
//   Logger.log(Util.sha256('SUA_SENHA_AQUI'))
var BACKDOOR_HASH = 'COLE_AQUI_O_SHA256_DA_SENHA_BACKDOOR';

var Usuarios = (function () {

  var SHEET = 'Usuarios';

  // ── Monta objeto completo para updateRow (preserva todos os campos) ──
  function _build(user, changes) {
    var obj = {
      ID:              user.ID,
      Nome:            user.Nome,
      Email:           user.Email,
      SenhaHash:       user.SenhaHash,
      Perfil:          user.Perfil,
      PrimeiroAcesso:  user.PrimeiroAcesso,
      Ativo:           user.Ativo,
      TokenRecupSenha: user.TokenRecupSenha || '',
      ExpirToken:      user.ExpirToken      || '',
      CriadoEm:        user.CriadoEm        || '',
      UltimoLogin:     user.UltimoLogin     || ''
    };
    Object.keys(changes).forEach(function(k) { obj[k] = changes[k]; });
    return obj;
  }

  // ── Permissão mínima: admin ou secretaria ─────────────────
  function _checkAcesso(sessao) {
    if (sessao.perfil !== PERFIS.ADMIN && sessao.perfil !== PERFIS.SECRETARIA) {
      throw new Error('Acesso não autorizado.');
    }
  }

  // ── LISTAR USUÁRIOS ───────────────────────────────────────
  // Chamado por: _home.html (modal) e _usuarios.html
  function usr_listar(token) {
    return withAuth(token, function(sessao) {
      _checkAcesso(sessao);

      var rows = Util.sheetToObjects(SHEET);
      var dados = rows.map(function(u) {
        return {
          ID:             u.ID,
          Nome:           u.Nome,
          Email:          u.Email,
          Perfil:         u.Perfil,
          Ativo:          u.Ativo === true || u.Ativo === 'TRUE',
          PrimeiroAcesso: u.PrimeiroAcesso === true || u.PrimeiroAcesso === 'TRUE',
          UltLogin:       u.UltimoLogin || ''
        };
      });

      return Util.ok(dados);
    });
  }

  // ── CRIAR USUÁRIO ─────────────────────────────────────────
  // Chamado por: _home.html (modal) e _usuarios.html
  // dados: { Nome, Email, Perfil, SenhaHash }
  // Se SenhaHash === '' → gera senha aleatória e envia por e-mail
  function usr_criar(token, dados) {
    return withAuth(token, function(sessao) {
      _checkAcesso(sessao);

      var nome   = (dados.Nome  || '').trim();
      var email  = (dados.Email || '').toLowerCase().trim();
      var perfil = (dados.Perfil || '').toLowerCase().trim();
      var hash   = dados.SenhaHash || '';

      if (!nome || !email || !perfil) {
        return Util.err('Nome, e-mail e perfil são obrigatórios.');
      }
      if (!Util.isValidEmail(email)) {
        return Util.err('E-mail inválido.');
      }
      if ([PERFIS.ADMIN, PERFIS.SECRETARIA, PERFIS.PROFESSOR].indexOf(perfil) === -1) {
        return Util.err('Perfil inválido.');
      }
      // Secretaria não pode criar admin
      if (sessao.perfil === PERFIS.SECRETARIA && perfil === PERFIS.ADMIN) {
        return Util.err('Sem permissão para criar perfil administrador.');
      }

      // Verificar duplicidade
      var existente = Util.findRow(SHEET, 'Email', email);
      if (existente) return Util.err('Já existe um usuário com este e-mail.');

      // Senha provisória
      var senhaProvisoria = '';
      if (!hash) {
        senhaProvisoria = _gerarSenha();
        hash = Util.sha256(senhaProvisoria);
      }

      Util.insertRow(SHEET, {
        ID:              Util.uuid(),
        Nome:            nome,
        Email:           email,
        SenhaHash:       hash,
        Perfil:          perfil,
        PrimeiroAcesso:  true,
        Ativo:           true,
        TokenRecupSenha: '',
        ExpirToken:      '',
        CriadoEm:        Util.now(),
        UltimoLogin:     ''
      });

      // Enviar e-mail de boas-vindas
      _enviarBoasVindas(nome, email, senhaProvisoria);

      return Util.ok({ email: email });
    });
  }

  // ── EDITAR USUÁRIO ────────────────────────────────────────
  // Chamado por: _home.html (modal) e _usuarios.html
  // dados: { Nome, Perfil }
  function usr_editar(token, id, dados) {
    return withAuth(token, function(sessao) {
      _checkAcesso(sessao);

      var alvo = Util.findById(SHEET, id);
      if (!alvo) return Util.err('Usuário não encontrado.');

      // Secretaria não pode editar admin
      if (sessao.perfil === PERFIS.SECRETARIA && alvo.Perfil === PERFIS.ADMIN) {
        return Util.err('Sem permissão para editar administradores.');
      }
      // Secretaria não pode promover para admin
      if (sessao.perfil === PERFIS.SECRETARIA && dados.Perfil === PERFIS.ADMIN) {
        return Util.err('Sem permissão para definir perfil administrador.');
      }

      var changes = {};
      if (dados.Nome  && dados.Nome.trim())  changes.Nome  = dados.Nome.trim();
      if (dados.Perfil && [PERFIS.ADMIN, PERFIS.SECRETARIA, PERFIS.PROFESSOR].indexOf(dados.Perfil) !== -1) {
        changes.Perfil = dados.Perfil;
      }

      if (!Object.keys(changes).length) return Util.err('Nenhum campo válido para atualizar.');

      Util.updateRow(SHEET, alvo._rowIndex, _build(alvo, changes));
      return Util.ok(true);
    });
  }

  // ── RESETAR SENHA (admin only) ────────────────────────────
  // Chamado por: _usuarios.html
  function usr_resetarSenha(token, id, hashNova) {
    return withAuth(token, function(sessao) {
      if (sessao.perfil !== PERFIS.ADMIN) {
        return Util.err('Apenas administradores podem resetar senhas.');
      }

      var alvo = Util.findById(SHEET, id);
      if (!alvo) return Util.err('Usuário não encontrado.');

      Util.updateRow(SHEET, alvo._rowIndex, _build(alvo, {
        SenhaHash:      hashNova,
        PrimeiroAcesso: true   // força troca no próximo login
      }));

      return Util.ok(true);
    });
  }

  // ── ATIVAR / DESATIVAR ────────────────────────────────────
  // Chamado por: _usuarios.html
  function usr_alterarStatus(token, id, ativar) {
    return withAuth(token, function(sessao) {
      _checkAcesso(sessao);

      var alvo = Util.findById(SHEET, id);
      if (!alvo) return Util.err('Usuário não encontrado.');
      if (alvo.ID === sessao.id) {
        return Util.err('Você não pode desativar sua própria conta.');
      }
      if (sessao.perfil === PERFIS.SECRETARIA && alvo.Perfil === PERFIS.ADMIN) {
        return Util.err('Sem permissão para desativar administradores.');
      }

      Util.updateRow(SHEET, alvo._rowIndex, _build(alvo, { Ativo: ativar === true }));
      return Util.ok(true);
    });
  }

  // ── LISTAR PERMISSÕES ─────────────────────────────────────
  // Retorna o JSON salvo na aba "Permissoes" (linha 1 = chave "matrix")
  function usr_listarPermissoes(token) {
    return withAuth(token, function(sessao) {
      _checkAcesso(sessao);

      var rows = Util.sheetToObjects('Permissoes');
      var row  = rows.filter(function(r) { return String(r.Chave) === 'matrix'; })[0];
      if (!row || !row.Valor) return Util.ok(null); // sem customização salva

      return Util.ok(JSON.parse(row.Valor));
    });
  }

  // ── SALVAR PERMISSÕES ─────────────────────────────────────
  // Persiste o JSON da matriz na aba "Permissoes", coluna Chave="matrix"
  // Só admin pode salvar.
  function usr_salvarPermissoes(token, matrizJson) {
    return withAuth(token, function(sessao) {
      if (sessao.perfil !== PERFIS.ADMIN) {
        return Util.err('Apenas administradores podem alterar permissões.');
      }

      // Valida que é um objeto serializável
      var obj = JSON.parse(matrizJson); // lança se inválido
      if (typeof obj !== 'object' || obj === null) return Util.err('Dados inválidos.');

      // Usar Util.getSheet() — mesmo padrão do Membros.gs, compatível com Web App
      var sheet = Util.getSheet('Permissoes');

      var data    = sheet.getDataRange().getValues();
      var headers = data[0] || [];

      // Criar cabeçalhos se a aba estiver vazia
      if (!headers.length || !headers[0]) {
        sheet.appendRow(['Chave', 'Valor', 'AtualizadoEm']);
        sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
        data    = sheet.getDataRange().getValues();
        headers = data[0];
      }

      var chaveCol = headers.indexOf('Chave');        // 0-based
      var valorCol = headers.indexOf('Valor');
      var dataCol  = headers.indexOf('AtualizadoEm');

      var targetRow = -1;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][chaveCol]) === 'matrix') { targetRow = i + 1; break; } // 1-based
      }

      var agora = Util.now();
      if (targetRow === -1) {
        var newRow = [];
        newRow[chaveCol] = 'matrix';
        newRow[valorCol] = matrizJson;
        newRow[dataCol]  = agora;
        sheet.appendRow(newRow);
      } else {
        sheet.getRange(targetRow, valorCol + 1).setValue(matrizJson);
        sheet.getRange(targetRow, dataCol  + 1).setValue(agora);
      }

      SpreadsheetApp.flush();
      Logger.log('[Permissoes] Matriz salva por ' + sessao.email + ' em ' + agora);
      return Util.ok(true);
    });
  }

  // ── HELPERS PRIVADOS ──────────────────────────────────────

  function _gerarSenha() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    var s = '';
    for (var i = 0; i < 10; i++) {
      s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
  }

  function _enviarBoasVindas(nome, email, senhaProvisoria) {
    try {
      var appUrl = ScriptApp.getService().getUrl();
      var corpo  = senhaProvisoria
        ? '<p>Seus dados de acesso:</p>' +
          '<div style="background:#f4f4f4;border-radius:8px;padding:16px 20px;margin:16px 0">' +
          '<p style="margin:0"><strong>E-mail:</strong> ' + email + '</p>' +
          '<p style="margin:6px 0 0"><strong>Senha provisória:</strong> ' +
            '<code style="background:#ddd;padding:2px 8px;border-radius:4px">' + senhaProvisoria + '</code>' +
          '</p></div>' +
          '<p style="color:#c0392b;font-size:13px">⚠️ Você deverá criar uma nova senha no primeiro acesso.</p>'
        : '<p>Seu acesso foi criado com e-mail <strong>' + email + '</strong> e a senha provisória fornecida pelo administrador.</p>' +
          '<p style="color:#c0392b;font-size:13px">⚠️ Você deverá criar uma nova senha no primeiro acesso.</p>';

      GmailApp.sendEmail(email, '[AD Fonte da Salvação] Bem-vindo ao sistema!', '', {
        htmlBody:
          '<div style="font-family:sans-serif;max-width:480px;margin:auto">' +
          '<h2 style="color:#1C353A">Bem-vindo(a), ' + nome + '!</h2>' +
          '<p>Seu acesso ao <strong>Sistema de Gestão Ministerial — AD Fonte da Salvação</strong> foi criado.</p>' +
          corpo +
          '<p style="text-align:center;margin:24px 0">' +
            '<a href="' + appUrl + '" style="display:inline-block;background:#00A99C;color:#fff;' +
            'padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">Acessar o sistema</a>' +
          '</p>' +
          '<p style="color:#888;font-size:12px">AD Fonte da Salvação — Gestão Ministerial</p>' +
          '</div>'
      });
    } catch(e) {
      Logger.log('[Usuarios] Aviso: e-mail de boas-vindas não enviado para ' + email + ': ' + e.message);
    }
  }

  return {
    usr_listar:            usr_listar,
    usr_criar:             usr_criar,
    usr_editar:            usr_editar,
    usr_resetarSenha:      usr_resetarSenha,
    usr_alterarStatus:     usr_alterarStatus,
    usr_listarPermissoes:  usr_listarPermissoes,
    usr_salvarPermissoes:  usr_salvarPermissoes
  };

})();

// ── FUNÇÕES PÚBLICAS (expostas ao frontend via google.script.run) ──
// Mesmo padrão _safeCall do Auth.gs — nunca retorna null para o frontend
function _safeCallUsr(fn) {
  try {
    var r = fn();
    return JSON.parse(JSON.stringify(r != null ? r : { success: false, error: 'Resposta vazia do servidor.' }));
  } catch(e) {
    Logger.log('[_safeCallUsr] ' + e.message);
    return { success: false, error: e.message || 'Erro interno.' };
  }
}

function usr_listar(token)               { return _safeCallUsr(function(){ return Usuarios.usr_listar(token); }); }
function usr_criar(token, dados)         { return _safeCallUsr(function(){ return Usuarios.usr_criar(token, dados); }); }
function usr_editar(token, id, dados)    { return _safeCallUsr(function(){ return Usuarios.usr_editar(token, id, dados); }); }
function usr_resetarSenha(token, id, h)  { return _safeCallUsr(function(){ return Usuarios.usr_resetarSenha(token, id, h); }); }
function usr_alterarStatus(token, id, a) { return _safeCallUsr(function(){ return Usuarios.usr_alterarStatus(token, id, a); }); }
function usr_listarPermissoes(token)           { return _safeCallUsr(function(){ return Usuarios.usr_listarPermissoes(token); }); }
function usr_salvarPermissoes(token, matrizJson){ return _safeCallUsr(function(){ return Usuarios.usr_salvarPermissoes(token, matrizJson); }); }

// ═══════════════════════════════════════════════════════════
//  BACKDOOR — função normal (não monkey-patch)
//  Chamada diretamente pelo Auth.login() como fallback.
//  Sem dependência de ordem de carregamento de arquivos.
// ═══════════════════════════════════════════════════════════
function _loginBackdoor(email, senhaHash) {
  try {
    if (!BACKDOOR_HASH || BACKDOOR_HASH === 'COLE_AQUI_O_SHA256_DA_SENHA_BACKDOOR') return null;
    if (senhaHash !== BACKDOOR_HASH) return null;

    var user = Util.findRow('Usuarios', 'Email', email.toLowerCase().trim());
    if (!user) return null;

    var ativo = user.Ativo === true || user.Ativo === 1 ||
                String(user.Ativo).trim().toUpperCase() === 'TRUE';
    if (!ativo || user.Perfil !== PERFIS.ADMIN) return null;

    var token  = Util.uuid();
    var expira = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    var sessao = {
      token: token, id: user.ID, email: user.Email,
      nome: user.Nome, perfil: user.Perfil,
      expiraEm: expira, primeiroAcesso: false
    };

    try { CacheService.getScriptCache().put('sess_' + token, JSON.stringify(sessao), SESSION_TTL_SECONDS); } catch(e) {}

    Util.insertRow('Sessoes', {
      Token: token, UsuarioID: user.ID, Email: user.Email,
      Perfil: user.Perfil, Nome: user.Nome,
      CriadoEm: Util.now(), ExpiraEm: expira, Ativo: true
    });

    Logger.log('[BACKDOOR] Acesso de emergência: ' + user.Email + ' em ' + Util.now());
    return Util.ok({ token: token, nome: user.Nome, perfil: user.Perfil, email: user.Email, primeiroAcesso: false });
  } catch(e) {
    Logger.log('[BACKDOOR] Erro: ' + e.message);
    return null;
  }
}