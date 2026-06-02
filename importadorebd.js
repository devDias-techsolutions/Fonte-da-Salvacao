// ═══════════════════════════════════════════════════════════
//  ImportadorEBD.gs — Funções de importação em lote
//  Adicione este arquivo ao projeto GAS da Escola Dominical
//  DEPENDE de: Util (já existente no projeto)
//  v1.2 · AD Fonte da Salvação
// ═══════════════════════════════════════════════════════════

// ── Helpers locais ─────────────────────────────────────────
var _Imp = {
  uuid: function() { return Util.uuid ? Util.uuid() : Utilities.getUuid(); },
  now:  function() { return Util.now  ? Util.now()  : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'); },

  findByNome: function(sheetName, nome) {
    try {
      var rows = Util.sheetToObjects(sheetName);
      var nLow = (nome||'').trim().toLowerCase();
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i].Nome||'').trim().toLowerCase() === nLow) return rows[i];
      }
      return null;
    } catch(e) { return null; }
  },

  findClasseByNome: function(nome) {
    try {
      var rows = Util.sheetToObjects('Classes');
      var nLow = (nome||'').trim().toLowerCase();
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i].Nome||'').trim().toLowerCase() === nLow) return rows[i];
      }
      return null;
    } catch(e) { return null; }
  },

  ok:  function(data) { return { success: true,  data: data }; },
  err: function(msg)  { return { success: false, error: String(msg) }; }
};

// ── Wrapper seguro (mesmo padrão do sistema principal) ─────
function _impSafe(fn) {
  try {
    var r = fn();
    if (r === null || r === undefined) return { success: false, error: 'Resposta vazia.' };
    return JSON.parse(JSON.stringify(r));
  } catch(e) {
    return { success: false, error: e.message || 'Erro interno.' };
  }
}

// ══════════════════════════════════════════════════════════
//  LISTAR CLASSES para o mapeamento do importador
//  — usa nome diferente para não colidir com ed_listarClasses
//    do módulo principal
// ══════════════════════════════════════════════════════════
function imp_listarClasses() {
  return _impSafe(function() {
    var rows = Util.sheetToObjects('Classes').filter(function(r) {
      var a = r.Ativo;
      return !(a === false || String(a).toLowerCase() === 'false' || a === 0);
    });
    return _Imp.ok(rows.map(function(r) {
      return { ID: String(r.ID||''), Nome: String(r.Nome||'') };
    }));
  });
}

// ══════════════════════════════════════════════════════════
//  LIMPAR DADOS FICTÍCIOS
//  Apaga TODOS os registros das abas operacionais.
//  Mantém cabeçalhos e abas de configuração (Config, PontosExtras).
//  ATENÇÃO: irreversível — use apenas antes da importação real.
// ══════════════════════════════════════════════════════════
function imp_limparDados(token) {
  return _impSafe(function() {
    // Valida sessão — exige pelo menos perfil secretario/admin
    var sess = Auth._auth(token);
    if (sess.perfil === 'professor') return _Imp.err('Sem permissão para limpar dados.');

    // Abas a limpar (mantém linha 1 = cabeçalho)
    var abas = ['Classes', 'Alunos', 'Professores', 'Aulas', 'Chamadas', 'ChamadasInfo'];

    var relatorio = [];
    abas.forEach(function(nomeAba) {
      try {
        var ss    = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = ss.getSheetByName(nomeAba);
        if (!sheet) { relatorio.push(nomeAba + ': aba não encontrada'); return; }
        var lastRow = sheet.getLastRow();
        if (lastRow <= 1) { relatorio.push(nomeAba + ': já vazia'); return; }
        // Apaga da linha 2 até a última (preserva cabeçalho na linha 1)
        sheet.deleteRows(2, lastRow - 1);
        relatorio.push(nomeAba + ': ' + (lastRow - 1) + ' registros removidos');
      } catch(e) {
        relatorio.push(nomeAba + ': ERRO — ' + e.message);
      }
    });

    return _Imp.ok({ mensagem: 'Limpeza concluída.', detalhes: relatorio });
  });
}

// ══════════════════════════════════════════════════════════
//  IMPORTAR ALUNO
// ══════════════════════════════════════════════════════════
function imp_importarAluno(dados, nomeTurmaNova) {
  return _impSafe(function() {
    if (!dados || !dados.Nome || !dados.Nome.trim())
      return _Imp.err('Nome obrigatório.');

    // Anti-duplicata
    if (_Imp.findByNome('Alunos', dados.Nome))
      return _Imp.err('Duplicado ignorado: ' + dados.Nome);

    // Resolver ClasseID
    var classeID = dados.ClasseID || '';
    if (!classeID && nomeTurmaNova)
      classeID = _criarClasseSeNecessario(nomeTurmaNova);

    var id = _Imp.uuid();
    Util.insertRow('Alunos', {
      ID:          id,
      Nome:        dados.Nome.trim(),
      DataNasc:    dados.DataNasc  || '',
      ClasseID:    classeID,
      Telefone:    dados.Telefone  || '',
      Endereco:    dados.Endereco  || '',
      Email:       dados.Email     || '',
      TotalPontos: 0,
      Ativo:       dados.Ativo !== undefined ? dados.Ativo : true,
      CriadoEm:   dados.CriadoEm || _Imp.now()
    });
    return _Imp.ok({ id: id, nome: dados.Nome });
  });
}

// ══════════════════════════════════════════════════════════
//  IMPORTAR PROFESSOR
// ══════════════════════════════════════════════════════════
function imp_importarProfessor(dados, nomeTurmaNova) {
  return _impSafe(function() {
    if (!dados || !dados.Nome || !dados.Nome.trim())
      return _Imp.err('Nome obrigatório.');

    // Anti-duplicata
    if (_Imp.findByNome('Professores', dados.Nome))
      return _Imp.err('Duplicado ignorado: ' + dados.Nome);

    // Resolver ClasseID
    var classeID = dados.ClasseID || '';
    if (!classeID && nomeTurmaNova)
      classeID = _criarClasseSeNecessario(nomeTurmaNova);

    var id = _Imp.uuid();
    Util.insertRow('Professores', {
      ID:            id,
      AlunoOrigemID: '',
      UsuarioID:     '',
      Nome:          dados.Nome.trim(),
      ClasseID:      classeID,
      Telefone:      dados.Telefone  || '',
      DataNasc:      dados.DataNasc  || '',
      Endereco:      dados.Endereco  || '',
      Email:         dados.Email     || '',
      Cursos:        '',
      NumeroWA:      dados.Email     || '',
      Ativo:         dados.Ativo !== undefined ? dados.Ativo : true,
      CriadoEm:     dados.CriadoEm || _Imp.now()
    });
    return _Imp.ok({ id: id, nome: dados.Nome });
  });
}

// ── Criar classe nova se não existir ─────────────────────
function _criarClasseSeNecessario(nomeClasse) {
  if (!nomeClasse || !nomeClasse.trim()) return '';
  var exist = _Imp.findClasseByNome(nomeClasse);
  if (exist) return String(exist.ID||'');
  var id = _Imp.uuid();
  try {
    Util.insertRow('Classes', {
      ID:          id,
      Nome:        nomeClasse.trim(),
      FaixaEtaria: '',
      LicaoCPAD:   '',
      Ativo:       true,
      CriadoEm:   _Imp.now()
    });
  } catch(e) {
    Logger.log('Erro ao criar classe "' + nomeClasse + '": ' + e.message);
    return '';
  }
  return id;
}