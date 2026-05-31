// ═══════════════════════════════════════════════════════════
//  ImportadorEBD.gs — Funções de importação em lote
//  Adicione este arquivo ao projeto GAS da Escola Dominical
//  DEPENDE de: Util (já existente no projeto)
//  v1.1 · AD Fonte da Salvação
// ═══════════════════════════════════════════════════════════

// ── Helpers locais que delegam ao Util do sistema ──────────
var _Imp = {
  uuid: function() { return Util.uuid ? Util.uuid() : Utilities.getUuid(); },
  now:  function() { return Util.now  ? Util.now()  : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'); },

  findByNome: function(sheetName, nome) {
    try {
      var rows = Util.sheetToObjects(sheetName);
      var nLow = (nome||'').trim().toLowerCase();
      return rows.find(function(r) {
        return String(r.Nome||'').trim().toLowerCase() === nLow;
      }) || null;
    } catch(e) { return null; }
  },

  findClasseByNome: function(nome) {
    try {
      var rows = Util.sheetToObjects('Classes');
      var nLow = (nome||'').trim().toLowerCase();
      return rows.find(function(r) {
        return String(r.Nome||'').trim().toLowerCase() === nLow;
      }) || null;
    } catch(e) { return null; }
  },

  ok:  function(data) { return { success: true,  data: data }; },
  err: function(msg)  { return { success: false, error: String(msg) }; }
};

// ══════════════════════════════════════════════════════════
//  ed_listarClasses — expõe lista de classes para o mapeamento
// ══════════════════════════════════════════════════════════
function ed_listarClasses(token) {
  try {
    var rows = Util.sheetToObjects('Classes').filter(function(r) {
      var a = r.Ativo;
      return !(a === false || String(a).toLowerCase() === 'false' || a === 0);
    });
    return _Imp.ok(rows.map(function(r) {
      return { ID: String(r.ID||''), Nome: String(r.Nome||'') };
    }));
  } catch(e) { return _Imp.err(e.message); }
}

// ══════════════════════════════════════════════════════════
//  ed_importarAluno(dados, nomeTurmaNovaOuNull)
// ══════════════════════════════════════════════════════════
function ed_importarAluno(dados, nomeTurmaNova) {
  try {
    if (!dados || !dados.Nome || !dados.Nome.trim())
      return _Imp.err('Nome obrigatório.');

    // Anti-duplicata
    if (_Imp.findByNome('Alunos', dados.Nome))
      return _Imp.err('Aluno já existe: ' + dados.Nome);

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
  } catch(e) { return _Imp.err(e.message); }
}

// ══════════════════════════════════════════════════════════
//  ed_importarProfessor(dados, nomeTurmaNovaOuNull)
// ══════════════════════════════════════════════════════════
function ed_importarProfessor(dados, nomeTurmaNova) {
  try {
    if (!dados || !dados.Nome || !dados.Nome.trim())
      return _Imp.err('Nome obrigatório.');

    // Anti-duplicata
    if (_Imp.findByNome('Professores', dados.Nome))
      return _Imp.err('Professor já existe: ' + dados.Nome);

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
  } catch(e) { return _Imp.err(e.message); }
}

// ── Criar classe nova se não existir ─────────────────────
function _criarClasseSeNecessario(nomeClasse) {
  if (!nomeClasse || !nomeClasse.trim()) return '';
  var exist = _Imp.findClasseByNome(nomeClasse);
  if (exist) return String(exist.ID||'');
  var id = _Imp.uuid();
  try {
    Util.insertRow('Classes', {
      ID:        id,
      Nome:      nomeClasse.trim(),
      Descricao: 'Importado do sistema antigo',
      Ativo:     true,
      CriadoEm: _Imp.now()
    });
  } catch(e) {
    Logger.log('Erro ao criar classe "'+nomeClasse+'": '+e.message);
    return '';
  }
  return id;
}