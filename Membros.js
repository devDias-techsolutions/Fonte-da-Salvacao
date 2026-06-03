// ═══════════════════════════════════════════════════════════
//  Membros.gs · Módulo Membros — AD Fonte da Salvação
//  Arquitetura idêntica ao EscolaDominical.gs
//  Aba: 'Membros'  ·  Cabeçalho (lowercase, exatamente como na planilha):
//  id  rol  nome  sexo  nascimento  nomeMae  nomePai  estadoCivil
//  batismo  Igreja  funcao  rua  numero  bairro  cidade  estado  cep
//  celular  email  rg  cpf  foto  fotoZoom  fotoX  fotoY  ativo
// ═══════════════════════════════════════════════════════════

var Membros = (function () {

  var SHEET = 'Membros';

  var HEADERS = [
    'id','rol','nome','sexo','nascimento','nomeMae','nomePai','estadoCivil',
    'batismo','Igreja','funcao','rua','numero','bairro','cidade','estado','cep',
    'celular','email','rg','cpf','foto','fotoZoom','fotoX','fotoY','ativo'
  ];

  // ── ID SEGURO: sempre UUID (string), nunca float ────────────────────
  // IDs float do backup antigo (ex: 1770302317564.9172) perdem precisão
  // quando armazenados como número na planilha, gerando duplicatas.
  // Regra: qualquer ID que contenha '.' OU que seja um número puro é
  // substituído por um UUID novo e único.
  function _idSeguro(id) {
    var s = String(id || '').trim();
    // Vazio → gera UUID
    if (!s) return Util.uuid();
    // Float (contém ponto decimal) → não confiável → gera UUID
    if (s.indexOf('.') !== -1) return Util.uuid();
    // Número puro de 13 dígitos (timestamp ms) → pode colidir → gera UUID
    if (/^\d{10,}$/.test(s)) return Util.uuid();
    // UUID já formatado (contém traços) → usa como está
    return s;
  }

  function _safeRows() {
    try { return Util.sheetToObjects(SHEET); }
    catch (e) { return []; }
  }

  function _strip(rows) {
    return rows.map(function (r) {
      var obj = {};
      Object.keys(r).forEach(function (k) {
        if (k !== '_rowIndex') obj[k] = r[k];
      });
      return obj;
    });
  }

  function _isAtivo(val) {
    if (val === true  || val === 1)  return true;
    if (val === false || val === 0)  return false;
    var s = String(val).trim().toUpperCase();
    return s === 'TRUE' || s === '1' || s === 'SIM';
  }

  function _proximoRol() {
    var rows = _safeRows();
    var max = 0;
    rows.forEach(function (r) {
      var n = parseInt(r.rol || '0', 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return String(max + 1).padStart(4, '0');
  }

  // ══ LISTAR ══════════════════════════════════════════════
  function listarMembros(token) {
    try {
      Auth._auth(token);
      var rows = _safeRows().map(function (r) {
        r.ativo = _isAtivo(r.ativo);
        return r;
      });
      return Util.ok(_strip(rows));
    } catch (e) {
      Logger.log('[Membros] listarMembros: ' + e);
      return Util.err(e.message);
    }
  }

  function getProximoRol(token) {
    try {
      Auth._auth(token);
      return Util.ok(_proximoRol());
    } catch (e) { return Util.err(e.message); }
  }

  // ══ SALVAR (insert ou update por 'id') ══════════════════
  function salvarMembro(token, dados) {
    try {
      Auth._auth(token);
      if (!dados) return Util.err('Dados nao informados.');
      if (!dados.nome || !String(dados.nome).trim()) return Util.err('Nome e obrigatorio.');

      // Garante ID seguro (string UUID) — nunca float, nunca vazio
      dados.id = _idSeguro(dados.id);

      var sh   = Util.getSheet(SHEET);
      var data = sh.getDataRange().getValues();

      if (data.length === 0) {
        sh.appendRow(HEADERS);
        data = sh.getDataRange().getValues();
      }

      var row = HEADERS.map(function (h) {
        return dados[h] !== undefined ? dados[h] : '';
      });

      // Busca linha existente comparando como STRING
      var foundRow = -1;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === String(dados.id).trim()) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow > 0) {
        sh.getRange(foundRow, 1, 1, HEADERS.length).setValues([row]);
        return Util.ok({ id: dados.id, mensagem: 'Membro atualizado com sucesso.' });
      } else {
        sh.appendRow(row);
        return Util.ok({ id: dados.id, mensagem: 'Membro cadastrado com sucesso.' });
      }
    } catch (e) {
      Logger.log('[Membros] salvarMembro: ' + e);
      return Util.err(e.message);
    }
  }

  // ══ DELETAR (remove linha) ═══════════════════════════════
  function deletarMembro(token, id) {
    try {
      Auth._auth(token);
      var sh   = Util.getSheet(SHEET);
      var data = sh.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === String(id).trim()) {
          sh.deleteRow(i + 1);
          return Util.ok({ mensagem: 'Membro excluido com sucesso.' });
        }
      }
      return Util.err('Membro nao encontrado.');
    } catch (e) {
      Logger.log('[Membros] deletarMembro: ' + e);
      return Util.err(e.message);
    }
  }

  // ══ CORRIGIR IDs DUPLICADOS ══════════════════════════════
  // Execute uma vez pelo editor do GAS para sanar a planilha atual.
  // Percorre todas as linhas, detecta IDs inválidos (float, numérico puro,
  // vazio ou duplicado) e substitui por UUID novo.
  function corrigirIdsDuplicados(token) {
    try {
      if (token) Auth._auth(token);
      var sh      = Util.getSheet(SHEET);
      var data    = sh.getDataRange().getValues();
      if (data.length <= 1) return Util.ok({ corrigidos: 0, mensagem: 'Nenhuma linha de dados.' });

      var vistos    = {};
      var corrigidos = 0;

      for (var i = 1; i < data.length; i++) {
        var idAtual = String(data[i][0] || '').trim();
        var precisaCorrigir = false;

        // Critérios de ID inválido
        if (!idAtual)                          precisaCorrigir = true; // vazio
        if (idAtual.indexOf('.') !== -1)       precisaCorrigir = true; // float
        if (/^\d{10,}$/.test(idAtual))         precisaCorrigir = true; // timestamp numérico puro
        if (vistos[idAtual])                   precisaCorrigir = true; // duplicata

        if (precisaCorrigir) {
          var novoId = Util.uuid();
          sh.getRange(i + 1, 1).setValue(novoId);
          vistos[novoId] = true;
          corrigidos++;
          Logger.log('[Membros] corrigirIds: linha ' + (i+1) + ' id "' + idAtual + '" -> "' + novoId + '"');
        } else {
          vistos[idAtual] = true;
        }
      }

      return Util.ok({
        corrigidos: corrigidos,
        mensagem: 'IDs corrigidos: ' + corrigidos + ' de ' + (data.length - 1) + ' linhas.'
      });
    } catch (e) {
      Logger.log('[Membros] corrigirIds: ' + e);
      return Util.err(e.message);
    }
  }

  // ══ SETUP ════════════════════════════════════════════════
  function setupMembros(token) {
    try {
      if (token) Auth._auth(token);
      var ss = (typeof getSSInstance === 'function') ? getSSInstance() : SS;
      if (!ss) throw new Error('Planilha nao encontrada. Verifique SPREADSHEET_ID.');
      var sheet = ss.getSheetByName(SHEET);
      if (!sheet) {
        sheet = ss.insertSheet(SHEET);
        sheet.appendRow(HEADERS);
        sheet.getRange(1, 1, 1, HEADERS.length)
          .setFontWeight('bold').setBackground('#00897B').setFontColor('#ffffff');
        sheet.setFrozenRows(1);
        return Util.ok({ criada: true, mensagem: 'Aba Membros criada com sucesso.' });
      }
      return Util.ok({ criada: false, mensagem: 'Aba Membros ja existia.' });
    } catch (e) { return Util.err(e.message); }
  }

  return {
    listarMembros:        listarMembros,
    getProximoRol:        getProximoRol,
    salvarMembro:         salvarMembro,
    deletarMembro:        deletarMembro,
    corrigirIdsDuplicados: corrigirIdsDuplicados,
    setupMembros:         setupMembros
  };

})();


// ═══════════════════════════════════════════════════════════
//  FUNCOES PUBLICAS — frontend via google.script.run
//  Wrapper _safe identico ao padrao EscolaDominical.gs
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

function mb_listarMembros(token)        { return _safe_mb(function(){ return Membros.listarMembros(token); }); }
function mb_getProximoRol(token)        { return _safe_mb(function(){ return Membros.getProximoRol(token); }); }
function mb_salvarMembro(token, membro) { return _safe_mb(function(){ return Membros.salvarMembro(token, membro); }); }
function mb_deletarMembro(token, id)    { return _safe_mb(function(){ return Membros.deletarMembro(token, id); }); }
function mb_setupMembros(token)         { return _safe_mb(function(){ return Membros.setupMembros(token); }); }

/**
 * UTILITÁRIO DE SANEAMENTO — execute UMA VEZ pelo editor do GAS.
 * Corrige todos os IDs inválidos (float, timestamp, vazio, duplicado)
 * substituindo por UUIDs únicos. Registra cada correção no Logger.
 */
function mb_corrigirIdsDuplicados() {
  var resultado = Membros.corrigirIdsDuplicados(null); // sem auth — uso manual
  Logger.log('[mb_corrigirIdsDuplicados] ' + JSON.stringify(resultado));
  return resultado;
}

// Alias de compatibilidade
function setupPlanilhaMembros(token) { return mb_setupMembros(token); }