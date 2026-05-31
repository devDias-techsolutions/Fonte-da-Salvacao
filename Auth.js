// ═══════════════════════════════════════════════════════════
//  Auth.gs · Autenticação, Sessão e Senhas
// ═══════════════════════════════════════════════════════════

var Auth = (function () {

  // Cache lazy — não inicializar no escopo global
  function _cache() {
    return CacheService.getScriptCache();
  }

  // ── _auth: cache primeiro, planilha como fallback ─────────
  function _auth(token) {
    if (!token) throw new Error('Não autorizado: token ausente.');

    // 1. Tentar cache
    try {
      var raw = _cache().get('sess_' + token);
      if (raw) return JSON.parse(raw);
    } catch(e) { /* cache indisponível, continuar para fallback */ }

    // 2. Fallback: buscar na aba Sessoes
    var rows = Util.sheetToObjects('Sessoes');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.Token === token && (r.Ativo === true || r.Ativo === 'TRUE')) {
        // Verificar expiração
        var expira = new Date(r.ExpiraEm);
        if (new Date() > expira) throw new Error('Sessão expirada. Faça login novamente.');

        // Repovoar cache
        var sessao = {
          token:          r.Token,
          id:             r.UsuarioID,
          email:          r.Email,
          nome:           r.Nome,
          perfil:         r.Perfil,
          expiraEm:       r.ExpiraEm,
          primeiroAcesso: false
        };
        var ttl = Math.min(Math.max(60, Math.floor((expira - new Date()) / 1000)), 21600);
        try { _cache().put('sess_' + token, JSON.stringify(sessao), ttl); } catch(e) {}
        return sessao;
      }
    }

    throw new Error('Sessão expirada. Faça login novamente.');
  }

  // ── LOGIN ──────────────────────────────────────────────────
  function login(email, senhaHash) {
    try {
      if (!email || !senhaHash) return Util.err('Email e senha são obrigatórios.');
      var user = Util.findRow('Usuarios', 'Email', email.toLowerCase().trim());
      if (!user)           return Util.err('Credenciais inválidas.');
      if (!user.Ativo)     return Util.err('Usuário inativo. Contate o administrador.');
      if (user.SenhaHash !== senhaHash) return Util.err('Credenciais inválidas.');

      var token  = Util.uuid();
      var expira = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

      var sessao = {
        token:          token,
        id:             user.ID,
        email:          user.Email,
        nome:           user.Nome,
        perfil:         user.Perfil,
        expiraEm:       expira,
        primeiroAcesso: user.PrimeiroAcesso === true || user.PrimeiroAcesso === 'TRUE'
      };

      try { _cache().put('sess_' + token, JSON.stringify(sessao), SESSION_TTL_SECONDS); } catch(e) {}

      Util.insertRow('Sessoes', {
        Token:     token,
        UsuarioID: user.ID,
        Email:     user.Email,
        Perfil:    user.Perfil,
        Nome:      user.Nome,
        CriadoEm: Util.now(),
        ExpiraEm:  expira,
        Ativo:     true
      });

      _atualizarUltimoLogin(user);

      return Util.ok({
        token:          token,
        nome:           user.Nome,
        perfil:         user.Perfil,
        email:          user.Email,
        primeiroAcesso: sessao.primeiroAcesso
      });
    } catch(e) { return Util.err(e.message); }
  }

  // ── LOGOUT ─────────────────────────────────────────────────
  function logout(token) {
    try {
      try { _cache().remove('sess_' + token); } catch(e) {}
      return Util.ok(true);
    } catch(e) { return Util.err(e.message); }
  }

  // ── GET SESSION ────────────────────────────────────────────
  function getSession(token) {
    try {
      var sessao = _auth(token);
      return Util.ok(sessao);
    } catch(e) { return Util.err(e.message); }
  }

  // ── TROCAR SENHA ───────────────────────────────────────────
  function trocarSenha(token, senhaAtualHash, novaSenhaHash) {
    try {
      var sessao = _auth(token);
      var user   = Util.findRow('Usuarios', 'Email', sessao.email);
      if (!user) return Util.err('Usuário não encontrado.');
      if (user.SenhaHash !== senhaAtualHash) return Util.err('Senha atual incorreta.');
      var updated = _buildUserUpdate(user, { SenhaHash: novaSenhaHash, PrimeiroAcesso: false });
      Util.updateRow('Usuarios', user._rowIndex, updated);
      sessao.primeiroAcesso = false;
      try { _cache().put('sess_' + token, JSON.stringify(sessao), SESSION_TTL_SECONDS); } catch(e) {}
      return Util.ok(true);
    } catch(e) { return Util.err(e.message); }
  }

  // ── DEFINIR PRIMEIRA SENHA ─────────────────────────────────
  function definirPrimeiraSenha(token, novaSenhaHash) {
    try {
      var sessao = _auth(token);
      if (!sessao.primeiroAcesso) return Util.err('Operação não permitida.');
      var user = Util.findRow('Usuarios', 'Email', sessao.email);
      if (!user) return Util.err('Usuário não encontrado.');
      var updated = _buildUserUpdate(user, { SenhaHash: novaSenhaHash, PrimeiroAcesso: false });
      Util.updateRow('Usuarios', user._rowIndex, updated);
      sessao.primeiroAcesso = false;
      try { _cache().put('sess_' + token, JSON.stringify(sessao), SESSION_TTL_SECONDS); } catch(e) {}
      return Util.ok(true);
    } catch(e) { return Util.err(e.message); }
  }

  // ── RECUPERAÇÃO DE SENHA ───────────────────────────────────
  function solicitarRecuperacao(email) {
    try {
      var user = Util.findRow('Usuarios', 'Email', email.toLowerCase().trim());
      if (!user || !user.Ativo) return Util.ok(true);
      var token  = Util.randomToken();
      var expira = new Date(Date.now() + 3600 * 1000).toISOString();
      var updated = _buildUserUpdate(user, { TokenRecupSenha: token, ExpirToken: expira });
      Util.updateRow('Usuarios', user._rowIndex, updated);
      var link = ScriptApp.getService().getUrl() + '?view=recuperar-senha&token=' + token;
      GmailApp.sendEmail(user.Email, '[AD Fonte da Salvação] Recuperação de senha', '', {
        htmlBody:
          '<div style="font-family:sans-serif;max-width:480px;margin:auto">' +
          '<h2 style="color:#1C353A">Recuperação de Senha</h2>' +
          '<p>Olá, <strong>' + user.Nome + '</strong>!</p>' +
          '<p>Clique no botão abaixo para redefinir sua senha (válido por 1 hora):</p>' +
          '<a href="' + link + '" style="display:inline-block;background:#00A99C;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Redefinir minha senha</a>' +
          '<p style="color:#888;font-size:12px">Se não solicitou, ignore este email.</p>' +
          '</div>'
      });
      return Util.ok(true);
    } catch(e) { return Util.err(e.message); }
  }

  function redefinirSenhaToken(tokenRecup, novaSenhaHash) {
    try {
      var rows = Util.sheetToObjects('Usuarios');
      var user = null;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].TokenRecupSenha === tokenRecup) { user = rows[i]; break; }
      }
      if (!user) return Util.err('Token inválido ou expirado.');
      if (new Date() > new Date(user.ExpirToken)) return Util.err('Token expirado. Solicite nova recuperação.');
      var updated = _buildUserUpdate(user, { SenhaHash: novaSenhaHash, PrimeiroAcesso: false, TokenRecupSenha: '', ExpirToken: '' });
      Util.updateRow('Usuarios', user._rowIndex, updated);
      return Util.ok(true);
    } catch(e) { return Util.err(e.message); }
  }

  function verificarTokenRecuperacao(tokenRecup) {
    try {
      var rows = Util.sheetToObjects('Usuarios');
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].TokenRecupSenha === tokenRecup) {
          if (new Date() > new Date(rows[i].ExpirToken)) return Util.err('Token expirado.');
          return Util.ok({ email: rows[i].Email, nome: rows[i].Nome });
        }
      }
      return Util.err('Token inválido.');
    } catch(e) { return Util.err(e.message); }
  }

  // ── HELPERS ────────────────────────────────────────────────
  function _atualizarUltimoLogin(user) {
    try {
      var updated = _buildUserUpdate(user, { UltimoLogin: Util.now() });
      Util.updateRow('Usuarios', user._rowIndex, updated);
    } catch(e) {}
  }

  function _buildUserUpdate(user, changes) {
    var obj = {
      ID: user.ID, Nome: user.Nome, Email: user.Email,
      SenhaHash: user.SenhaHash, Perfil: user.Perfil,
      PrimeiroAcesso: user.PrimeiroAcesso, Ativo: user.Ativo,
      TokenRecupSenha: user.TokenRecupSenha, ExpirToken: user.ExpirToken,
      CriadoEm: user.CriadoEm, UltimoLogin: user.UltimoLogin
    };
    Object.keys(changes).forEach(function(k) { obj[k] = changes[k]; });
    return obj;
  }

  return {
    _auth:                     _auth,
    login:                     login,
    logout:                    logout,
    getSession:                getSession,
    trocarSenha:               trocarSenha,
    definirPrimeiraSenha:      definirPrimeiraSenha,
    solicitarRecuperacao:      solicitarRecuperacao,
    redefinirSenhaToken:       redefinirSenhaToken,
    verificarTokenRecuperacao: verificarTokenRecuperacao
  };

})();

// ── FUNÇÕES PÚBLICAS ─────────────────────────────────────────
function login(email, senhaHash)              { return Auth.login(email, senhaHash); }
function logout(token)                         { return Auth.logout(token); }
function getSession(token)                     { return Auth.getSession(token); }
function trocarSenha(t, atual, nova)           { return Auth.trocarSenha(t, atual, nova); }
function definirPrimeiraSenha(token, hash)     { return Auth.definirPrimeiraSenha(token, hash); }
function solicitarRecuperacao(email)           { return Auth.solicitarRecuperacao(email); }
function redefinirSenhaToken(token, hash)      { return Auth.redefinirSenhaToken(token, hash); }
function verificarTokenRecuperacao(token)      { return Auth.verificarTokenRecuperacao(token); }
