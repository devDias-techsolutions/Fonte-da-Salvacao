// ═══════════════════════════════════════════════════════════
//  Membros.gs · Módulo Membros — AD Fonte da Salvação
//  CRUD completo · Aba "Membros" na planilha
//  Padrão idêntico ao EscolaDominical.gs
// ═══════════════════════════════════════════════════════════

var Membros = (function () {

  // ── Colunas da aba "Membros" (ordem define as colunas na planilha) ──
  // Execute setupMembros() uma única vez para criar a aba com esse cabeçalho.
  var COLUNAS = [
    'ID', 'Rol', 'Nome', 'Sexo', 'Nascimento',
    'NomeMae', 'NomePai', 'EstadoCivil', 'Batismo', 'IgrejaOrigen',
    'Funcao', 'Rua', 'Numero', 'Bairro', 'Cidade', 'Estado', 'CEP',
    'Celular', 'Email', 'RG', 'CPF',
    'Foto', 'FotoZoom', 'FotoX', 'FotoY',
    'Ativo', 'CriadoEm', 'AtualizadoEm'
  ];

  // ── Lê a aba com segurança — retorna [] se não existir ──
  function _safeRows() {
    try { return Util.sheetToObjects('Membros'); }
    catch (e) { return []; }
  }

  // ── Remove _rowIndex antes de enviar ao cliente ──
  function _strip(rows) {
    return rows.map(function (r) {
      var obj = {};
      Object.keys(r).forEach(function (k) {
        if (k !== '_rowIndex') obj[k] = r[k];
      });
      return obj;
    });
  }

  // ── Normaliza o campo Ativo (boolean, 'TRUE', 1, etc.) ──
  function _isAtivo(val) {
    if (val === true  || val === 1)   return true;
    if (val === false || val === 0)   return false;
    var s = String(val).trim().toUpperCase();
    return s === 'TRUE' || s === '1' || s === 'SIM';
  }

  // ══════════════════════════════════════════
  //  LISTAR
  // ══════════════════════════════════════════

  function listarMembros(token) {
    try {
      Auth._auth(token);
      var rows = _safeRows();
      return Util.ok(_strip(rows));          // retorna todos (ativos e inativos)
    } catch (e) { return Util.err(e.message); }
  }

  // ══════════════════════════════════════════
  //  SALVAR (insert ou update por ID)
  // ══════════════════════════════════════════

  function salvarMembro(token, dados) {
    try {
      Auth._auth(token);
      if (!dados)       return Util.err('Dados não informados.');
      if (!dados.Nome || !String(dados.Nome).trim())
                        return Util.err('Nome é obrigatório.');

      var agora = Util.now();
      var existente = dados.ID ? Util.findById('Membros', dados.ID) : null;

      if (existente) {
        // ── UPDATE ──
        Util.updateRow('Membros', existente._rowIndex, {
          ID:           existente.ID,
          Rol:          dados.Rol          !== undefined ? dados.Rol          : existente.Rol,
          Nome:         dados.Nome         !== undefined ? String(dados.Nome).trim() : existente.Nome,
          Sexo:         dados.Sexo         !== undefined ? dados.Sexo         : existente.Sexo,
          Nascimento:   dados.Nascimento   !== undefined ? dados.Nascimento   : existente.Nascimento,
          NomeMae:      dados.NomeMae      !== undefined ? dados.NomeMae      : existente.NomeMae,
          NomePai:      dados.NomePai      !== undefined ? dados.NomePai      : existente.NomePai,
          EstadoCivil:  dados.EstadoCivil  !== undefined ? dados.EstadoCivil  : existente.EstadoCivil,
          Batismo:      dados.Batismo      !== undefined ? dados.Batismo      : existente.Batismo,
          IgrejaOrigen: dados.IgrejaOrigen !== undefined ? dados.IgrejaOrigen : existente.IgrejaOrigen,
          Funcao:       dados.Funcao       !== undefined ? dados.Funcao       : existente.Funcao,
          Rua:          dados.Rua          !== undefined ? dados.Rua          : existente.Rua,
          Numero:       dados.Numero       !== undefined ? dados.Numero       : existente.Numero,
          Bairro:       dados.Bairro       !== undefined ? dados.Bairro       : existente.Bairro,
          Cidade:       dados.Cidade       !== undefined ? dados.Cidade       : existente.Cidade,
          Estado:       dados.Estado       !== undefined ? dados.Estado       : existente.Estado,
          CEP:          dados.CEP          !== undefined ? dados.CEP          : existente.CEP,
          Celular:      dados.Celular      !== undefined ? dados.Celular      : existente.Celular,
          Email:        dados.Email        !== undefined ? dados.Email        : existente.Email,
          RG:           dados.RG           !== undefined ? dados.RG           : existente.RG,
          CPF:          dados.CPF          !== undefined ? dados.CPF          : existente.CPF,
          Foto:         dados.Foto         !== undefined ? dados.Foto         : existente.Foto,
          FotoZoom:     dados.FotoZoom     !== undefined ? dados.FotoZoom     : existente.FotoZoom,
          FotoX:        dados.FotoX        !== undefined ? dados.FotoX        : existente.FotoX,
          FotoY:        dados.FotoY        !== undefined ? dados.FotoY        : existente.FotoY,
          Ativo:        dados.Ativo        !== undefined ? dados.Ativo        : existente.Ativo,
          CriadoEm:     existente.CriadoEm || agora,
          AtualizadoEm: agora
        });
        return Util.ok({ id: existente.ID, mensagem: 'Membro atualizado com sucesso.' });

      } else {
        // ── INSERT ──
        var id = dados.ID || Util.uuid();
        Util.insertRow('Membros', {
          ID:           id,
          Rol:          dados.Rol          || '',
          Nome:         String(dados.Nome).trim(),
          Sexo:         dados.Sexo         || '',
          Nascimento:   dados.Nascimento   || '',
          NomeMae:      dados.NomeMae      || '',
          NomePai:      dados.NomePai      || '',
          EstadoCivil:  dados.EstadoCivil  || '',
          Batismo:      dados.Batismo      || '',
          IgrejaOrigen: dados.IgrejaOrigen || '',
          Funcao:       dados.Funcao       || '',
          Rua:          dados.Rua          || '',
          Numero:       dados.Numero       || '',
          Bairro:       dados.Bairro       || '',
          Cidade:       dados.Cidade       || '',
          Estado:       dados.Estado       || '',
          CEP:          dados.CEP          || '',
          Celular:      dados.Celular      || '',
          Email:        dados.Email        || '',
          RG:           dados.RG           || '',
          CPF:          dados.CPF          || '',
          Foto:         dados.Foto         || '',
          FotoZoom:     dados.FotoZoom     !== undefined ? dados.FotoZoom : 1,
          FotoX:        dados.FotoX        !== undefined ? dados.FotoX    : 50,
          FotoY:        dados.FotoY        !== undefined ? dados.FotoY    : 50,
          Ativo:        dados.Ativo        !== undefined ? dados.Ativo    : true,
          CriadoEm:     agora,
          AtualizadoEm: agora
        });
        return Util.ok({ id: id, mensagem: 'Membro cadastrado com sucesso.' });
      }

    } catch (e) { return Util.err(e.message); }
  }

  // ══════════════════════════════════════════
  //  DELETAR (soft delete — marca Ativo=false)
  // ══════════════════════════════════════════

  function deletarMembro(token, id) {
    try {
      Auth._auth(token);
      var row = Util.findById('Membros', id);
      if (!row) return Util.err('Membro não encontrado.');

      Util.updateRow('Membros', row._rowIndex, {
        ID:           row.ID,
        Rol:          row.Rol,
        Nome:         row.Nome,
        Sexo:         row.Sexo,
        Nascimento:   row.Nascimento,
        NomeMae:      row.NomeMae,
        NomePai:      row.NomePai,
        EstadoCivil:  row.EstadoCivil,
        Batismo:      row.Batismo,
        IgrejaOrigen: row.IgrejaOrigen,
        Funcao:       row.Funcao,
        Rua:          row.Rua,
        Numero:       row.Numero,
        Bairro:       row.Bairro,
        Cidade:       row.Cidade,
        Estado:       row.Estado,
        CEP:          row.CEP,
        Celular:      row.Celular,
        Email:        row.Email,
        RG:           row.RG,
        CPF:          row.CPF,
        Foto:         row.Foto,
        FotoZoom:     row.FotoZoom,
        FotoX:        row.FotoX,
        FotoY:        row.FotoY,
        Ativo:        false,
        CriadoEm:     row.CriadoEm,
        AtualizadoEm: Util.now()
      });
      return Util.ok({ mensagem: 'Membro excluído com sucesso.' });
    } catch (e) { return Util.err(e.message); }
  }

  // ══════════════════════════════════════════
  //  SETUP — cria a aba "Membros" se não existir
  // ══════════════════════════════════════════

  function setupMembros() {
    try {
      var ss = (typeof getSSInstance === 'function') ? getSSInstance() : SS;
      if (!ss) throw new Error('Planilha não encontrada.');

      var sheet = ss.getSheetByName('Membros');
      if (!sheet) {
        sheet = ss.insertSheet('Membros');
        sheet.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]);
        sheet.setFrozenRows(1);
        // Largura da coluna Foto: bem larga para suportar base64
        var fotoCol = COLUNAS.indexOf('Foto') + 1;
        if (fotoCol > 0) sheet.setColumnWidth(fotoCol, 60);
        return { criada: true, mensagem: 'Aba Membros criada com sucesso.' };
      }
      return { criada: false, mensagem: 'Aba Membros já existia.' };
    } catch (e) {
      return { erro: e.message };
    }
  }

  return {
    listarMembros: listarMembros,
    salvarMembro:  salvarMembro,
    deletarMembro: deletarMembro,
    setupMembros:  setupMembros
  };

})();


// ═══════════════════════════════════════════════════════════
//  FUNÇÕES PÚBLICAS — chamadas pelo frontend via google.script.run
//  Wrapper _safe idêntico ao padrão da EscolaDominical
// ═══════════════════════════════════════════════════════════

function _safe_mb(fn) {
  try {
    var r = fn();
    if (r === null || r === undefined)
      return { success: false, error: 'Resposta vazia do servidor.' };
    return JSON.parse(JSON.stringify(r));
  } catch (e) {
    return { success: false, error: e.message || 'Erro interno.' };
  }
}

/** Lista todos os membros (ativos e inativos) */
function getMembros(token) {
  return _safe_mb(function () { return Membros.listarMembros(token); });
}

/**
 * Salva um membro (insert ou update por ID).
 * @param {string} token  - token de sessão
 * @param {Object} membro - objeto com campos do membro (ID presente = update)
 */
function salvarMembro(token, membro) {
  return _safe_mb(function () { return Membros.salvarMembro(token, membro); });
}

/**
 * Soft-delete: marca Ativo=false na planilha.
 * @param {string} token - token de sessão
 * @param {string} id    - ID do membro
 */
function deletarMembro(token, id) {
  return _safe_mb(function () { return Membros.deletarMembro(token, id); });
}

/**
 * Utilitário: cria a aba "Membros" com o cabeçalho correto.
 * Execute manualmente uma única vez pelo editor do GAS.
 */
function setupMembros() {
  var resultado = Membros.setupMembros();
  Logger.log(JSON.stringify(resultado));
  return resultado;
}
