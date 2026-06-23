// ═══════════════════════════════════════════════════════════
//  Dashboard.gs · KPIs e Atividade Recente
// ═══════════════════════════════════════════════════════════

var Dashboard = (function () {

  // ── KPIs DA HOME ─────────────────────────────────────────
  function getKpisHome(token) {
    return withAuth(token, function(sess) {
      var membros     = Util.sheetToObjects('Membros').filter(function(r)     { return r.ativo === true || r.ativo === 1 || String(r.ativo).trim().toUpperCase() === 'TRUE'; });
      var alunos      = Util.sheetToObjects('Alunos').filter(function(r)      { return r.Ativo === true || r.Ativo === 'TRUE'; });
      var professores = Util.sheetToObjects('Professores').filter(function(r) { return r.Ativo === true || r.Ativo === 'TRUE'; });
      var turmas      = Util.sheetToObjects('Classes').filter(function(r)     { return r.Ativo === true || r.Ativo === 'TRUE'; });

      return Util.ok({
        membros:     membros.length,
        alunos:      alunos.length,
        professores: professores.length,
        turmas:      turmas.length
      });
    });
  }

  // ── ATIVIDADE RECENTE ─────────────────────────────────────
  function getAtividadeRecente(token) {
    return withAuth(token, function(sess) {
      var atividades = [];

      // Últimas aulas criadas
      var aulas = Util.sheetToObjects('Aulas');
      aulas.sort(function(a, b) { return new Date(b.CriadoEm) - new Date(a.CriadoEm); });
      aulas.slice(0, 3).forEach(function(a) {
        atividades.push({
          icon:  'book-open',
          texto: 'Aula registrada: Trimestre ' + a.Trimestre + ' · Lição ' + a.NumLicao,
          tempo: _tempoRelativo(a.CriadoEm),
          ts:    new Date(a.CriadoEm).getTime() || 0
        });
      });

      // Últimos alunos cadastrados
      var alunos = Util.sheetToObjects('Alunos');
      alunos.sort(function(a, b) { return new Date(b.CriadoEm) - new Date(a.CriadoEm); });
      alunos.slice(0, 2).forEach(function(a) {
        atividades.push({
          icon:  'backpack',
          texto: 'Novo aluno cadastrado: ' + a.Nome,
          tempo: _tempoRelativo(a.CriadoEm),
          ts:    new Date(a.CriadoEm).getTime() || 0
        });
      });

      // Últimos usuários criados
      var usuarios = Util.sheetToObjects('Usuarios');
      usuarios.sort(function(a, b) { return new Date(b.CriadoEm) - new Date(a.CriadoEm); });
      usuarios.slice(0, 2).forEach(function(u) {
        atividades.push({
          icon:  'user-plus',
          texto: 'Usuário adicionado: ' + u.Nome,
          tempo: _tempoRelativo(u.CriadoEm),
          ts:    new Date(u.CriadoEm).getTime() || 0
        });
      });

      // Ordenar por mais recente
      atividades.sort(function(a, b) { return b.ts - a.ts; });

      return Util.ok(atividades.slice(0, 5));
    });
  }

  // ── HELPER: tempo relativo ────────────────────────────────
  function _tempoRelativo(dateStr) {
    if (!dateStr) return '';
    var d;
    // Suporte a formato BR dd/MM/yyyy HH:mm:ss
    if (typeof dateStr === 'string' && dateStr.indexOf('/') !== -1) {
      var parts = dateStr.split(' ');
      var dateParts = parts[0].split('/');
      var timeParts = parts[1] ? parts[1].split(':') : ['0','0','0'];
      d = new Date(
        parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]),
        parseInt(timeParts[0]), parseInt(timeParts[1]), parseInt(timeParts[2] || 0)
      );
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d)) return '';

    var diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60)   return 'agora';
    if (diff < 3600) return Math.floor(diff / 60) + ' min atrás';
    if (diff < 86400)return Math.floor(diff / 3600) + 'h atrás';
    return Math.floor(diff / 86400) + 'd atrás';
  }

  return {
    getKpisHome:          getKpisHome,
    getAtividadeRecente:  getAtividadeRecente
  };

})();

// ── FUNÇÕES PÚBLICAS ──────────────────────────────────────
function getKpisHome(token)         { return _safeCall(function(){ return Dashboard.getKpisHome(token); }); }
function getAtividadeRecente(token) { return _safeCall(function(){ return Dashboard.getAtividadeRecente(token); }); }