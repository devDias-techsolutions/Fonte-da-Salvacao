// ═══════════════════════════════════════════════════════════
//  EscolaDominical.gs · Módulo Escola Dominical
//  Classes · Alunos · Professores · Aulas · Chamadas
//  v1.0 · 2025
// ═══════════════════════════════════════════════════════════

var EscolaDominical = (function () {

  // ══════════════════════════════════════════
  //  HELPERS DEFENSIVOS
  // ══════════════════════════════════════════

  // Sheet segura — retorna [] se aba não existir
  function _safeSheetObjects(name) {
    try { return Util.sheetToObjects(name); }
    catch (e) { return []; }
  }

  // Remover campo interno _rowIndex antes de enviar ao cliente
  function _strip(rows) {
    return rows.map(function(r) {
      var obj = {};
      Object.keys(r).forEach(function(k) { if (k !== '_rowIndex') obj[k] = r[k]; });
      return obj;
    });
  }

  // Checar Ativo de forma robusta — aceita boolean true, string 'TRUE', 'true', 1, etc.
  function _isAtivo(val) {
    if (val === true)   return true;
    if (val === false)  return false;
    if (val === 1)      return true;
    if (val === 0)      return false;
    var s = String(val).trim().toUpperCase();
    return s === 'TRUE' || s === '1' || s === 'SIM';
  }

  // ── Helper: ClasseIDs permitidas para o professor logado ─────────────────
  // Lê Professores onde UsuarioID === sess.id e Ativo === true.
  // Retorna { "classeId": true } para lookup O(1).
  // Retorna null para admin/secretaria → sem restrição.
  function _classesDoProfessor(sess) {
    if (!sess || sess.perfil !== 'professor') return null;
    var set = {};
    _safeSheetObjects('Professores').forEach(function(r) {
      if (_isAtivo(r.Ativo) &&
          String(r.UsuarioID).trim() === String(sess.id).trim() &&
          r.ClasseID) {
        set[String(r.ClasseID)] = true;
      }
    });
    return set;
  }

  // ══════════════════════════════════════════
  //  CLASSES
  // ══════════════════════════════════════════

  function listarClasses(token) {
    return withAuth(token, function(sess) {
      var ok = _classesDoProfessor(sess);
      var rows = _safeSheetObjects('Classes').filter(function(r) {
        if (!_isAtivo(r.Ativo)) return false;
        if (ok !== null && !ok[String(r.ID)]) return false;
        return true;
      });
      return Util.ok(_strip(rows));
    });
  }

  function listarClassesTodas(token) {
    return withAuth(token, function(sess) {
      return Util.ok(_strip(_safeSheetObjects('Classes')));
    });
  }

  function criarClasse(token, dados) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');
      if (!dados.Nome || !dados.Nome.trim()) return Util.err('Nome da classe é obrigatório.');

      var existente = _safeSheetObjects('Classes').filter(function (r) {
        return r.Nome.toLowerCase() === dados.Nome.trim().toLowerCase() && (_isAtivo(r.Ativo));
      });
      if (existente.length) return Util.err('Já existe uma classe com este nome.');

      var id = Util.uuid();
      Util.insertRow('Classes', {
        ID:          id,
        Nome:        dados.Nome.trim(),
        FaixaEtaria: dados.FaixaEtaria || '',
        LicaoCPAD:   dados.LicaoCPAD  || '',
        Ativo:       true,
        CriadoEm:   Util.now()
      });
      return Util.ok({ id: id, mensagem: 'Classe criada com sucesso.' });
    });
  }

  function editarClasse(token, id, dados) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');

      var row = Util.findById('Classes', id);
      if (!row) return Util.err('Classe não encontrada.');

      if (dados.Nome) {
        var dup = _safeSheetObjects('Classes').filter(function (r) {
          return r.Nome.toLowerCase() === dados.Nome.trim().toLowerCase() &&
                 r.ID !== id && (_isAtivo(r.Ativo));
        });
        if (dup.length) return Util.err('Já existe uma classe com este nome.');
      }

      var atualizado = {
        ID:          row.ID,
        Nome:        dados.Nome        !== undefined ? dados.Nome.trim()       : row.Nome,
        FaixaEtaria: dados.FaixaEtaria !== undefined ? dados.FaixaEtaria       : row.FaixaEtaria,
        LicaoCPAD:   dados.LicaoCPAD  !== undefined ? dados.LicaoCPAD         : row.LicaoCPAD,
        Ativo:       row.Ativo,
        CriadoEm:   row.CriadoEm
      };
      Util.updateRow('Classes', row._rowIndex, atualizado);
      return Util.ok({ mensagem: 'Classe atualizada com sucesso.' });
    });
  }

  function excluirClasse(token, id) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');

      var row = Util.findById('Classes', id);
      if (!row) return Util.err('Classe não encontrada.');

      // Verificar se há alunos ativos nesta classe
      var alunos = _safeSheetObjects('Alunos').filter(function (r) {
        return r.ClasseID === id && (_isAtivo(r.Ativo));
      });
      if (alunos.length) return Util.err('Não é possível excluir: há ' + alunos.length + ' aluno(s) nesta classe.');

      var atualizado = {
        ID: row.ID, Nome: row.Nome, FaixaEtaria: row.FaixaEtaria,
        LicaoCPAD: row.LicaoCPAD, Ativo: false, CriadoEm: row.CriadoEm
      };
      Util.updateRow('Classes', row._rowIndex, atualizado);
      return Util.ok({ mensagem: 'Classe desativada com sucesso.' });
    });
  }

  // ══════════════════════════════════════════
  //  ALUNOS
  // ══════════════════════════════════════════

  function listarAlunos(token, classeId) {
    return withAuth(token, function(sess) {
      var ok = _classesDoProfessor(sess);
      var rows = _safeSheetObjects('Alunos').filter(function(r) {
        if (!_isAtivo(r.Ativo)) return false;
        if (classeId && r.ClasseID !== classeId) return false;
        if (ok !== null && !ok[String(r.ClasseID)]) return false;
        return true;
      });
      return Util.ok(_strip(rows));
    });
  }

  function criarAluno(token, dados) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');
      if (!dados.Nome || !dados.Nome.trim()) return Util.err('Nome do aluno é obrigatório.');
      if (!dados.ClasseID) return Util.err('Classe é obrigatória.');

      var classe = Util.findById('Classes', dados.ClasseID);
      if (!classe) return Util.err('Classe não encontrada.');

      var id = Util.uuid();
      Util.insertRow('Alunos', {
        ID:          id,
        Nome:        dados.Nome.trim(),
        DataNasc:    dados.DataNasc   || '',
        ClasseID:    dados.ClasseID,
        Telefone:    dados.Telefone   || '',
        Endereco:    dados.Endereco   || '',
        Email:       dados.Email      || '',
        TotalPontos: 0,
        Ativo:       true,
        CriadoEm:   Util.now()
      });
      return Util.ok({ id: id, mensagem: 'Aluno cadastrado com sucesso.' });
    });
  }

  function editarAluno(token, id, dados) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');

      var row = Util.findById('Alunos', id);
      if (!row) return Util.err('Aluno não encontrado.');

      if (dados.ClasseID) {
        var classe = Util.findById('Classes', dados.ClasseID);
        if (!classe) return Util.err('Classe não encontrada.');
      }

      Util.updateRow('Alunos', row._rowIndex, {
        ID:          row.ID,
        Nome:        dados.Nome      !== undefined ? dados.Nome.trim()  : row.Nome,
        DataNasc:    dados.DataNasc  !== undefined ? dados.DataNasc     : row.DataNasc,
        ClasseID:    dados.ClasseID  !== undefined ? dados.ClasseID     : row.ClasseID,
        Telefone:    dados.Telefone  !== undefined ? dados.Telefone     : row.Telefone,
        Endereco:    dados.Endereco  !== undefined ? dados.Endereco     : row.Endereco,
        Email:       dados.Email     !== undefined ? dados.Email        : row.Email,
        TotalPontos: row.TotalPontos,
        Ativo:       row.Ativo,
        CriadoEm:   row.CriadoEm
      });
      return Util.ok({ mensagem: 'Aluno atualizado com sucesso.' });
    });
  }

  function excluirAluno(token, id) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');

      var row = Util.findById('Alunos', id);
      if (!row) return Util.err('Aluno não encontrado.');

      Util.updateRow('Alunos', row._rowIndex, {
        ID: row.ID, Nome: row.Nome, DataNasc: row.DataNasc, ClasseID: row.ClasseID,
        Telefone: row.Telefone, Endereco: row.Endereco, Email: row.Email,
        TotalPontos: row.TotalPontos, Ativo: false, CriadoEm: row.CriadoEm
      });
      return Util.ok({ mensagem: 'Aluno desativado com sucesso.' });
    });
  }

  // ══════════════════════════════════════════
  //  PROFESSORES
  // ══════════════════════════════════════════

  function listarProfessores(token) {
    return withAuth(token, function(sess) {
      var rows = _safeSheetObjects('Professores').filter(function (r) {
        return _isAtivo(r.Ativo);
      });
      return Util.ok(_strip(rows));
    });
  }

  function criarProfessor(token, dados) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');
      if (!dados.Nome || !dados.Nome.trim()) return Util.err('Nome é obrigatório.');

      var id = Util.uuid();
      Util.insertRow('Professores', {
        ID:            id,
        AlunoOrigemID: dados.AlunoOrigemID || '',
        UsuarioID:     dados.UsuarioID     || '',
        Nome:          dados.Nome.trim(),
        ClasseID:      dados.ClasseID      || '',
        Telefone:      dados.Telefone      || '',
        DataNasc:      dados.DataNasc      || '',
        Endereco:      dados.Endereco      || '',
        Email:         dados.Email         || '',
        Cursos:        dados.Cursos        || '',
        NumeroWA:      dados.NumeroWA      || '',
        Ativo:         true,
        CriadoEm:     Util.now()
      });
      return Util.ok({ id: id, mensagem: 'Professor cadastrado com sucesso.' });
    });
  }

  function editarProfessor(token, id, dados) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');

      var row = Util.findById('Professores', id);
      if (!row) return Util.err('Professor não encontrado.');

      Util.updateRow('Professores', row._rowIndex, {
        ID:            row.ID,
        AlunoOrigemID: dados.AlunoOrigemID !== undefined ? dados.AlunoOrigemID : row.AlunoOrigemID,
        UsuarioID:     dados.UsuarioID     !== undefined ? dados.UsuarioID     : row.UsuarioID,
        Nome:          dados.Nome          !== undefined ? dados.Nome.trim()   : row.Nome,
        ClasseID:      dados.ClasseID      !== undefined ? dados.ClasseID      : row.ClasseID,
        Telefone:      dados.Telefone      !== undefined ? dados.Telefone      : row.Telefone,
        DataNasc:      dados.DataNasc      !== undefined ? dados.DataNasc      : row.DataNasc,
        Endereco:      dados.Endereco      !== undefined ? dados.Endereco      : row.Endereco,
        Email:         dados.Email         !== undefined ? dados.Email         : row.Email,
        Cursos:        dados.Cursos        !== undefined ? dados.Cursos        : row.Cursos,
        NumeroWA:      dados.NumeroWA      !== undefined ? dados.NumeroWA      : row.NumeroWA,
        Ativo:         row.Ativo,
        CriadoEm:     row.CriadoEm
      });
      return Util.ok({ mensagem: 'Professor atualizado com sucesso.' });
    });
  }

  function excluirProfessor(token, id) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');

      var row = Util.findById('Professores', id);
      if (!row) return Util.err('Professor não encontrado.');

      Util.updateRow('Professores', row._rowIndex, {
        ID: row.ID, AlunoOrigemID: row.AlunoOrigemID, UsuarioID: row.UsuarioID,
        Nome: row.Nome, ClasseID: row.ClasseID, Telefone: row.Telefone,
        DataNasc: row.DataNasc, Endereco: row.Endereco, Email: row.Email,
        Cursos: row.Cursos, NumeroWA: row.NumeroWA, Ativo: false, CriadoEm: row.CriadoEm
      });
      return Util.ok({ mensagem: 'Professor desativado com sucesso.' });
    });
  }

  // ══════════════════════════════════════════
  //  AULAS
  // ══════════════════════════════════════════

  function listarAulas(token, filtros) {
    return withAuth(token, function(sess) {
      filtros = filtros || {};
      var rows = _safeSheetObjects('Aulas');
      if (filtros.ano)       rows = rows.filter(function(r) { return String(r.Ano) === String(filtros.ano); });
      if (filtros.trimestre) rows = rows.filter(function(r) { return String(r.Trimestre) === String(filtros.trimestre); });
      rows.sort(function(a, b) {
        var da = _parseDateBR(a.CriadoEm), db = _parseDateBR(b.CriadoEm);
        return db - da;
      });
      return Util.ok(rows);
    });
  }

  function criarAula(token, dados) {
    return withAuth(token, function(sess) {
      if (!dados.Trimestre || !dados.NumLicao) {
        return Util.err('Trimestre e número da lição são obrigatórios.');
      }
      var id = Util.uuid();
      Util.insertRow('Aulas', {
        ID:        id,
        Data:      dados.Data      || Util.now().split(' ')[0],
        Trimestre: dados.Trimestre,
        NumLicao:  dados.NumLicao,
        Titulo:    dados.Titulo.trim(),
        Ano:       dados.Ano || new Date().getFullYear(),
        CriadoPor: sess.email,
        CriadoEm: Util.now()
      });
      return Util.ok({ id: id, mensagem: 'Aula registrada com sucesso.' });
    });
  }

  function editarAula(token, id, dados) {
    return withAuth(token, function(sess) {
      var row = Util.findById('Aulas', id);
      if (!row) return Util.err('Aula não encontrada.');
      Util.updateRow('Aulas', row._rowIndex, {
        ID:        row.ID,
        Data:      dados.Data      !== undefined ? dados.Data      : row.Data,
        Trimestre: dados.Trimestre !== undefined ? dados.Trimestre : row.Trimestre,
        NumLicao:  dados.NumLicao  !== undefined ? dados.NumLicao  : row.NumLicao,
        Titulo:    dados.Titulo    !== undefined ? dados.Titulo.trim() : row.Titulo,
        Ano:       dados.Ano       !== undefined ? dados.Ano       : row.Ano,
        CriadoPor: row.CriadoPor,
        CriadoEm: row.CriadoEm
      });
      return Util.ok({ mensagem: 'Aula atualizada com sucesso.' });
    });
  }

  function excluirAula(token, id) {
    return withAuth(token, function(sess) {
      if (sess.perfil === 'professor') return Util.err('Sem permissão.');
      var sheet = Util.getSheet('Aulas');
      var rows  = _safeSheetObjects('Aulas');
      var row   = null;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].ID === id) { row = rows[i]; break; }
      }
      if (!row) return Util.err('Aula não encontrada.');
      sheet.deleteRow(row._rowIndex);
      return Util.ok({ mensagem: 'Aula excluída com sucesso.' });
    });
  }

  // ══════════════════════════════════════════
  //  CHAMADAS
  // ══════════════════════════════════════════

  function getChamada(token, aulaId, classeId) {
    return withAuth(token, function(sess) {
      if (!aulaId || !classeId) return Util.err('aulaId e classeId são obrigatórios.');
      var ok = _classesDoProfessor(sess);
      if (ok !== null && !ok[String(classeId)]) return Util.err('Sem permissão para acessar esta turma.');

      // Alunos da classe
      var alunos = _safeSheetObjects('Alunos').filter(function (r) {
        return r.ClasseID === classeId && (_isAtivo(r.Ativo));
      });

      // Professores desta turma — aparecem no topo da chamada
      var profsDaTurma = _safeSheetObjects('Professores').filter(function(r) {
        return r.ClasseID === classeId && _isAtivo(r.Ativo);
      });

      // Chamadas já lançadas para esta aula+classe
      var chamadas = _safeSheetObjects('Chamadas').filter(function (r) {
        return r.AulaID === aulaId && r.ClasseID === classeId;
      });

      // Pontos extras disponíveis
      var extras = _safeSheetObjects('PontosExtras').filter(function (r) {
        return _isAtivo(r.Ativo);
      });

      var chamadaMap = {};
      chamadas.forEach(function (c) { chamadaMap[c.AlunoID] = c; });

      var resultado = alunos.map(function (a) {
        var c = chamadaMap[a.ID] || {};
        var extrasJson = [];
        try { extrasJson = c.PontosExtrasJSON ? JSON.parse(c.PontosExtrasJSON) : []; } catch(e) { extrasJson = []; }
        return {
          alunoId:        a.ID,
          nome:           a.Nome,
          isProfessor:    false,
          presente:       c.Presente  === true  || c.Presente  === 'TRUE',
          biblia:         c.Biblia    === true  || c.Biblia    === 'TRUE',
          revista:        c.Revista   === true  || c.Revista   === 'TRUE',
          pontosExtras:   extrasJson,
          totalPontos:    c.TotalPontos  || 0,
          totalOfertas:   c.TotalOfertas || 0,
          chamadaId:      c.ID || null
        };
      });

      // Construir entradas dos professores (com flag isProfessor: true) e colocá-los no topo
      var profEntradas = profsDaTurma.map(function(p) {
        var cp = chamadaMap[p.ID] || {};
        var extrasJsonP = [];
        try { extrasJsonP = cp.PontosExtrasJSON ? JSON.parse(cp.PontosExtrasJSON) : []; } catch(e) { extrasJsonP = []; }
        return {
          alunoId:      p.ID,
          nome:         p.Nome,
          isProfessor:  true,
          presente:     cp.Presente === true || cp.Presente === 'TRUE',
          biblia:       cp.Biblia   === true || cp.Biblia   === 'TRUE',
          revista:      cp.Revista  === true || cp.Revista  === 'TRUE',
          pontosExtras: extrasJsonP,
          totalPontos:  cp.TotalPontos  || 0,
          totalOfertas: cp.TotalOfertas || 0,
          chamadaId:    cp.ID || null
        };
      });
      resultado = profEntradas.concat(resultado);

      // Dados da turma nesta aula (visitantes, oferta, observações)
      var infoRows = _safeSheetObjects('ChamadasInfo').filter(function(r) {
        return r.AulaID === aulaId && r.ClasseID === classeId;
      });
      var info = infoRows.length ? infoRows[0] : {};
      var turmaInfo = {
        numVisitantes: Number(info.NumVisitantes) || 0,
        totalOferta:   Number(info.TotalOferta)   || 0,
        observacoes:   info.Observacoes || ''
      };

      return Util.ok({ alunos: resultado, extras: extras, jaLancada: chamadas.length > 0, turmaInfo: turmaInfo });
    });
  }

  function salvarChamada(token, aulaId, classeId, registros, turmaInfo) {
    return withAuth(token, function(sess) {
      if (!aulaId || !classeId || !registros) return Util.err('Dados incompletos.');
      var ok = _classesDoProfessor(sess);
      if (ok !== null && !ok[String(classeId)]) return Util.err('Sem permissão para registrar chamada nesta turma.');

      var config     = _getConfig();
      var ptPresenca = Number(config.PONTOS_PRESENCA) || 1;
      var ptBiblia   = Number(config.PONTOS_BIBLIA)   || 2;
      var ptRevista  = Number(config.PONTOS_REVISTA)  || 2;

      // Carregar chamadas existentes para saber o que atualizar ou inserir
      var chamadas = _safeSheetObjects('Chamadas');
      var chamadaMap = {};
      chamadas.forEach(function (c) {
        if (c.AulaID === aulaId && c.ClasseID === classeId) {
          chamadaMap[c.AlunoID] = c;
        }
      });

      registros.forEach(function (reg) {
        var presente = reg.presente === true;
        var biblia   = presente && (reg.biblia   === true);
        var revista  = presente && (reg.revista  === true);
        var extras   = presente ? (reg.pontosExtras || []) : [];
        var ptExtras = 0;
        extras.forEach(function (e) { ptExtras += Number(e.pontos) || 0; });
        var total = (presente ? ptPresenca : 0) + (biblia ? ptBiblia : 0) + (revista ? ptRevista : 0) + ptExtras;

        var obj = {
          AulaID:          aulaId,
          ClasseID:        classeId,
          AlunoID:         reg.alunoId,
          Presente:        presente,
          Biblia:          biblia,
          Revista:         revista,
          PontosExtrasJSON: JSON.stringify(extras),
          TotalPontos:     total,
          TotalOfertas:    reg.totalOfertas || 0,
          LancadoPor:      sess.email,
          CriadoEm:       Util.now()
        };

        var existente = chamadaMap[reg.alunoId];
        if (existente) {
          obj.ID = existente.ID;
          Util.updateRow('Chamadas', existente._rowIndex, obj);
        } else {
          obj.ID = Util.uuid();
          Util.insertRow('Chamadas', obj);
        }

        // Recalcular TotalPontos do aluno
        _recalcularPontosAluno(reg.alunoId);
      });

      // Salvar / atualizar ChamadasInfo (visitantes, oferta, observações da turma)
      if (turmaInfo) {
        var ti = turmaInfo;
        var infoRows = _safeSheetObjects('ChamadasInfo');
        var existInfo = null;
        infoRows.forEach(function(r) {
          if (r.AulaID === aulaId && r.ClasseID === classeId) existInfo = r;
        });
        var infoObj = {
          AulaID:        aulaId,
          ClasseID:      classeId,
          NumVisitantes: Number(ti.numVisitantes) || 0,
          TotalOferta:   Number(ti.totalOferta)   || 0,
          Observacoes:   String(ti.observacoes    || '').trim(),
          LancadoPor:    sess.email,
          CriadoEm:      Util.now()
        };
        if (existInfo) {
          infoObj.ID = existInfo.ID;
          Util.updateRow('ChamadasInfo', existInfo._rowIndex, infoObj);
        } else {
          infoObj.ID = Util.uuid();
          Util.insertRow('ChamadasInfo', infoObj);
        }
      }

      return Util.ok({ mensagem: 'Chamada salva com sucesso.' });
    });
  }

  function listarChamadasPorAula(token, aulaId) {
    return withAuth(token, function(sess) {
      var ok = _classesDoProfessor(sess);
      var chamadas = _safeSheetObjects('Chamadas').filter(function(r) {
        if (r.AulaID !== aulaId) return false;
        if (ok !== null && !ok[String(r.ClasseID)]) return false;
        return true;
      });
      var infoTurmas = _safeSheetObjects('ChamadasInfo').filter(function(r) {
        if (r.AulaID !== aulaId) return false;
        if (ok !== null && !ok[String(r.ClasseID)]) return false;
        return true;
      });
      return Util.ok({ chamadas: chamadas, infoTurmas: infoTurmas });
    });
  }

  function getRankingAlunos(token, classeId) {
    return withAuth(token, function(sess) {
      var ok = _classesDoProfessor(sess);
      var filtro = classeId || null;
      var alunos = _safeSheetObjects('Alunos').filter(function(r) {
        if (!_isAtivo(r.Ativo)) return false;
        if (filtro && r.ClasseID !== filtro) return false;
        if (ok !== null && !ok[String(r.ClasseID)]) return false;
        return true;
      });
      alunos.sort(function(a, b) {
        return (Number(b.TotalPontos) || 0) - (Number(a.TotalPontos) || 0);
      });
      return Util.ok(alunos);
    });
  }

  // NOTA: NÃO migrada para withAuth de propósito — aceita token ausente
  // ou 'dummy-token' (sess fica null, sem filtro de turma aplicado).
  // Nenhum chamador atual envia isso, mas o contrato é preservado.
  function getEstatisticasGerais(token) {
    try {
      var sess = (token && token !== 'dummy-token') ? Auth._auth(token) : null;
      var ok = sess ? _classesDoProfessor(sess) : null;
      var alunos = _safeSheetObjects('Alunos').filter(function(r) {
        if (!_isAtivo(r.Ativo)) return false;
        if (ok !== null && !ok[String(r.ClasseID)]) return false;
        return true;
      });
      var classes = _safeSheetObjects('Classes').filter(function(r) {
        if (!_isAtivo(r.Ativo)) return false;
        if (ok !== null && !ok[String(r.ID)]) return false;
        return true;
      });
      var professores = _safeSheetObjects('Professores').filter(function(r) { return _isAtivo(r.Ativo); });
      var aulas    = _safeSheetObjects('Aulas');
      var chamadas = _safeSheetObjects('Chamadas');
      if (ok !== null) {
        chamadas = chamadas.filter(function(c) { return ok[String(c.ClasseID)]; });
        var _ids = {};
        chamadas.forEach(function(c) { if (c.AulaID) _ids[String(c.AulaID)] = true; });
        aulas = aulas.filter(function(a) { return _ids[String(a.ID)]; });
      }
      var totalPresentes = chamadas.filter(function(c) { return c.Presente === true || c.Presente === 'TRUE'; }).length;
      var mediaPres = chamadas.length ? Math.round((totalPresentes / chamadas.length) * 100) : 0;
      var hoje = new Date();
      var aulasHoje = aulas.filter(function(a) {
        var d = _parseDateBR(a.CriadoEm);
        return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
      });
      return Util.ok({
        totalAlunos:      alunos.length,
        totalClasses:     classes.length,
        totalProfessores: professores.length,
        totalAulas:       aulas.length,
        aulasMes:         aulasHoje.length,
        presencaMedia:    mediaPres
      });
    } catch (e) { return Util.err(e.message); }
  }

  function getPontosExtras(token) {
    return withAuth(token, function(sess) {
      var EXCLUIR_EXATOS = ['questionário', 'questionario'];
      var rows = _safeSheetObjects('PontosExtras').filter(function (r) {
        if (!_isAtivo(r.Ativo)) return false;
        var nome = String(r.Nome || '').trim().toLowerCase();
        return EXCLUIR_EXATOS.indexOf(nome) === -1;
      });
      return Util.ok(rows);
    });
  }

  // ══════════════════════════════════════════
  //  RESUMOS / AGREGAÇÕES
  // ══════════════════════════════════════════

  // Resumo por classe: total de alunos, presença média, última aula
  function getResumoClasses(token) {
    return withAuth(token, function(sess) {
      var ok = _classesDoProfessor(sess);
      var classes = _safeSheetObjects('Classes').filter(function(r) {
        if (!_isAtivo(r.Ativo)) return false;
        if (ok !== null && !ok[String(r.ID)]) return false;
        return true;
      });
      var alunos = _safeSheetObjects('Alunos').filter(function(r) { return _isAtivo(r.Ativo); });
      var aulas       = _safeSheetObjects('Aulas');
      var chamadas    = _safeSheetObjects('Chamadas');

      var alunosPorClasse = {};
      alunos.forEach(function(a) {
        if (!alunosPorClasse[a.ClasseID]) alunosPorClasse[a.ClasseID] = 0;
        alunosPorClasse[a.ClasseID]++;
      });

      var presentesPorClasse = {};
      var totalPorClasse     = {};
      chamadas.forEach(function(c) {
        var cid = c.ClasseID;
        if (!cid) return;
        if (!totalPorClasse[cid])     totalPorClasse[cid]     = 0;
        if (!presentesPorClasse[cid]) presentesPorClasse[cid] = 0;
        totalPorClasse[cid]++;
        if (c.Presente === true || c.Presente === 'TRUE') presentesPorClasse[cid]++;
      });

      var ultimaAulaPorClasse = {};
      chamadas.forEach(function(c) {
        var cid = c.ClasseID;
        if (!cid || !c.AulaID) return;
        var aula = null;
        for (var i = 0; i < aulas.length; i++) {
          if (aulas[i].ID === c.AulaID) { aula = aulas[i]; break; }
        }
        if (!aula) return;
        var d = _parseDateBR(aula.CriadoEm);
        if (!ultimaAulaPorClasse[cid] || d > ultimaAulaPorClasse[cid].data) {
          ultimaAulaPorClasse[cid] = { data: d, titulo: aula.Titulo, aulaId: aula.ID };
        }
      });

      var resumo = classes.map(function(cl) {
        var total     = totalPorClasse[cl.ID]     || 0;
        var presentes = presentesPorClasse[cl.ID] || 0;
        var ultima    = ultimaAulaPorClasse[cl.ID] || null;
        return {
          classeId:      cl.ID,
          nome:          cl.Nome,
          faixaEtaria:   cl.FaixaEtaria || '',
          totalAlunos:   alunosPorClasse[cl.ID] || 0,
          presencaMedia: total ? Math.round((presentes / total) * 100) : 0,
          ultimaAula:    ultima ? {
            titulo: ultima.titulo,
            aulaId: ultima.aulaId,
            data:   Utilities.formatDate(ultima.data, Session.getScriptTimeZone(), 'dd/MM/yyyy')
          } : null
        };
      });

      return Util.ok(resumo);
    });
  }

  // Resumo por aula: presença geral, ofertas totais, classes participantes
  function getResumoAulas(token) {
    return withAuth(token, function(sess) {
      var aulas    = _safeSheetObjects('Aulas');
      var chamadas = _safeSheetObjects('Chamadas');
      var classes  = _safeSheetObjects('Classes');

      var classeMap = {};
      classes.forEach(function(c) { classeMap[c.ID] = c.Nome; });

      var por = {};
      chamadas.forEach(function(c) {
        var aid = c.AulaID;
        if (!aid) return;
        if (!por[aid]) por[aid] = { presentes: 0, total: 0, ofertas: 0, classes: {} };
        por[aid].total++;
        por[aid].ofertas += Number(c.TotalOfertas) || 0;
        if (c.Presente === true || c.Presente === 'TRUE') por[aid].presentes++;
        if (c.ClasseID) por[aid].classes[c.ClasseID] = classeMap[c.ClasseID] || c.ClasseID;
      });

      aulas.sort(function(a, b) {
        return _parseDateBR(b.CriadoEm) - _parseDateBR(a.CriadoEm);
      });

      var resumo = aulas.map(function(a) {
        var ag = por[a.ID] || { presentes: 0, total: 0, ofertas: 0, classes: {} };
        return {
          aulaId:        a.ID,
          titulo:        a.Titulo,
          data:          a.Data      || '',
          trimestre:     a.Trimestre || '',
          numLicao:      a.NumLicao  || '',
          ano:           a.Ano       || '',
          totalAlunos:   ag.total,
          presentes:     ag.presentes,
          presencaMedia: ag.total ? Math.round((ag.presentes / ag.total) * 100) : 0,
          totalOfertas:  ag.ofertas,
          classesCom:    Object.keys(ag.classes).map(function(k) { return ag.classes[k]; })
        };
      });

      return Util.ok(resumo);
    });
  }

  // Carga inicial em uma única chamada — elimina cascatas no frontend
  function getDadosIniciais(token, tabs) {
    return withAuth(token, function(sess) {
      var ok = _classesDoProfessor(sess);
      tabs = tabs || [];
      var result = {};

      result.classes = _strip(_safeSheetObjects('Classes').filter(function(r) {
        if (!_isAtivo(r.Ativo)) return false;
        if (ok !== null && !ok[String(r.ID)]) return false;
        return true;
      }));

      if (tabs.indexOf('alunos') !== -1) {
        result.alunos = _strip(_safeSheetObjects('Alunos').filter(function(r) {
          if (!_isAtivo(r.Ativo)) return false;
          if (ok !== null && !ok[String(r.ClasseID)]) return false;
          return true;
        }));
      }
      if (tabs.indexOf('professores') !== -1) {
        result.professores = _strip(_safeSheetObjects('Professores').filter(function(r) { return _isAtivo(r.Ativo); }));
      }
      if (tabs.indexOf('aulas') !== -1) {
        var aulas = _safeSheetObjects('Aulas');
        aulas.sort(function(a,b) { return _parseDateBR(b.CriadoEm) - _parseDateBR(a.CriadoEm); });
        result.aulas = aulas;
      }
      if (tabs.indexOf('stats') !== -1) {
        var rs = getEstatisticasGerais(token);
        result.stats = rs.success ? rs.data : null;
      }
      if (tabs.indexOf('resumoClasses') !== -1) {
        var rc = getResumoClasses(token);
        result.resumoClasses = rc.success ? rc.data : [];
      }
      if (tabs.indexOf('resumoAulas') !== -1) {
        var ra = getResumoAulas(token);
        result.resumoAulas = ra.success ? ra.data : [];
      }
      if (tabs.indexOf('extras') !== -1) {
        var _EXCLUIR = ['questionário', 'questionario'];
        result.extras = _safeSheetObjects('PontosExtras').filter(function(r) {
          if (!_isAtivo(r.Ativo)) return false;
          var _n = String(r.Nome || '').trim().toLowerCase();
          return _EXCLUIR.indexOf(_n) === -1;
        });
      }

      return Util.ok(result);
    });
  }

  // ══════════════════════════════════════════
  //  HELPERS INTERNOS
  // ══════════════════════════════════════════

  function _recalcularPontosAluno(alunoId) {
    var chamadas = _safeSheetObjects('Chamadas').filter(function (c) {
      return c.AlunoID === alunoId;
    });
    var total = 0;
    chamadas.forEach(function (c) { total += Number(c.TotalPontos) || 0; });

    var aluno = Util.findById('Alunos', alunoId);
    if (aluno) {
      Util.updateRow('Alunos', aluno._rowIndex, {
        ID: aluno.ID, Nome: aluno.Nome, DataNasc: aluno.DataNasc,
        ClasseID: aluno.ClasseID, Telefone: aluno.Telefone,
        Endereco: aluno.Endereco, Email: aluno.Email,
        TotalPontos: total, Ativo: aluno.Ativo, CriadoEm: aluno.CriadoEm
      });
    }
  }

  function _getConfig() {
    var rows = _safeSheetObjects('Config');
    var map  = {};
    rows.forEach(function (r) { map[r.Chave] = r.Valor; });
    return map;
  }

  function _parseDateBR(str) {
    if (!str) return new Date(0);
    if (typeof str === 'string' && str.indexOf('/') !== -1) {
      var p = str.split(' ');
      var d = p[0].split('/');
      var t = p[1] ? p[1].split(':') : ['0','0','0'];
      return new Date(+d[2], +d[1]-1, +d[0], +t[0], +t[1], +(t[2]||0));
    }
    return new Date(str);
  }

  // ══════════════════════════════════════════
  //  EXPORTAÇÃO
  // ══════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════
  //  ANIVERSÁRIOS & ALERTAS WHATSAPP
  // ═══════════════════════════════════════════════════════════

  function _parseDataNasc(val) {
    if (!val) return null;
    try {
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      var s = String(val).trim();
      var d;
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        d = new Date(s.substring(0, 10));
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        var p = s.split('/'); d = new Date(p[2] + '-' + p[1] + '-' + p[0]);
      } else { d = new Date(s); }
      return isNaN(d.getTime()) ? null : d;
    } catch(e) { return null; }
  }

  function _isBirthdayOn(dateVal, refDate) {
    var d = _parseDataNasc(dateVal);
    if (!d) return false;
    var ref = refDate || new Date();
    return d.getDate() === ref.getDate() && d.getMonth() === ref.getMonth();
  }

  function _anivSemana(dateVal) {
    var d = _parseDataNasc(dateVal);
    if (!d) return null;
    var today = new Date();
    var dow = today.getDay();
    for (var i = 0; i < 7; i++) {
      var ref = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow + i);
      if (d.getDate() === ref.getDate() && d.getMonth() === ref.getMonth()) {
        var days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
        return { diaLabel: days[i]+' '+('0'+ref.getDate()).slice(-2)+'/'+('0'+(ref.getMonth()+1)).slice(-2), diaIndex: i, isHoje: (i === dow) };
      }
    }
    return null;
  }

  function _getConfigAlertas() {
    try {
      var raw = PropertiesService.getScriptProperties().getProperty('ED_ALERTAS_CONFIG');
      return raw ? JSON.parse(raw) : {};
    } catch(e) { return {}; }
  }

  function _setConfigAlertas(config) {
    try { PropertiesService.getScriptProperties().setProperty('ED_ALERTAS_CONFIG', JSON.stringify(config)); } catch(e) {}
  }

  // (WhatsApp removido — alertas agora via GmailApp)

  function _enviarEmail(emailDest, assunto, corpo) {
    // corpo deve ser plaintext puro sem emojis fora do BMP (U+FFFF+)
    // htmlBody gerado aqui via escape seguro
    if (!emailDest || !/\S+@\S+\.\S+/.test(emailDest)) return { ok: false, erro: 'Email invalido: ' + emailDest };
    try {
      var htmlBody = '<meta charset="UTF-8">' +
        corpo
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')
          .replace(/\*(.*?)\*/g, '<strong>$1</strong>');
      GmailApp.sendEmail(emailDest, assunto, corpo, { htmlBody: htmlBody });
      return { ok: true };
    } catch(e) { return { ok: false, erro: e.message }; }
  }

  function _enviarEmailHtml(emailDest, assunto, corpoPlain, htmlBody) {
    // Use este quando quiser emojis: passe-os apenas no htmlBody como entidades &#x...
    // corpoPlain deve ser ASCII puro (fallback para clientes sem HTML)
    if (!emailDest || !/\S+@\S+\.\S+/.test(emailDest)) return { ok: false, erro: 'Email invalido: ' + emailDest };
    try {
      GmailApp.sendEmail(emailDest, assunto, corpoPlain, { htmlBody: htmlBody });
      return { ok: true };
    } catch(e) { return { ok: false, erro: e.message }; }
  }

  function _alertaDiarioFn() {
    var cfg = _getConfigAlertas();
    if (!cfg.email_ativo) return { enviados: 0, motivo: 'email_inativo' };
    var today = new Date();
    var alunos  = _safeSheetObjects('Alunos').filter(function(a){ return _isAtivo(a.Ativo) && _isBirthdayOn(a.DataNasc, today); });
    var profs   = _safeSheetObjects('Professores').filter(function(p){ return _isAtivo(p.Ativo) && _isBirthdayOn(p.DataNasc, today); });
    var classes = _safeSheetObjects('Classes');
    if (!alunos.length && !profs.length) return { enviados: 0, motivo: 'sem_aniversariantes' };

    var assunto = 'Escola Dominical - Aniversario(s) Hoje!';
    var enviados = 0;

    // Avisar professor da turma sobre aluno aniversariante
    if (cfg.alerta_dia) {
      var todosProfs = _safeSheetObjects('Professores').filter(function(p){ return _isAtivo(p.Ativo) && p.Email; });
      todosProfs.forEach(function(prof) {
        var anivTurma = alunos.filter(function(a){ return a.ClasseID === prof.ClasseID; });
        if (!anivTurma.length) return;
        var cl = (classes.filter(function(c){ return c.ID === prof.ClasseID; })[0] || {}).Nome || 'sua turma';
        var nomes = anivTurma.map(function(a){ return a.Nome; }).join(', ');
        var plain = 'Escola Dominical - Aniversario Hoje!\n\n' +
          'Ola, ' + prof.Nome.split(' ')[0] + '! Hoje e aniversario de:\n\n' +
          anivTurma.map(function(a){ return '* ' + a.Nome + ' *'; }).join('\n') +
          '\n\nNao esqueca de parabenizar!';
        var html = '<meta charset="UTF-8">' +
          '<p><strong>&#x1F382; Escola Dominical &#x2013; Anivers&#xe1;rio Hoje!</strong></p>' +
          '<p>Ol&#xe1;, ' + prof.Nome.split(' ')[0] + '! Hoje &#xe9; anivers&#xe1;rio de:</p><ul>' +
          anivTurma.map(function(a){ return '<li><strong>' + a.Nome + '</strong> &#x1F973;</li>'; }).join('') +
          '</ul><p>N&#xe3;o esque&#xe7;a de parabenizar! &#x2764;&#xfe0f;</p>';
        var r = _enviarEmailHtml(prof.Email, assunto, plain, html);
        if (r.ok) enviados++;
      });
    }

    // Destinatários globais
    var dest = cfg.destinatarios || [];
    dest.forEach(function(r) {
      if (!r.email || !r.alertaDia) return;
      var todos = alunos.concat(profs);
      var plain2 = 'Escola Dominical - Aniversario(s) Hoje!\n\n' +
        todos.map(function(p){ return '* ' + p.Nome + ' *'; }).join('\n');
      var html2 = '<meta charset="UTF-8">' +
        '<p><strong>&#x1F382; Escola Dominical &#x2013; Anivers&#xe1;rio(s) Hoje!</strong></p><ul>' +
        todos.map(function(p){ return '<li><strong>' + p.Nome + '</strong> &#x1F973;</li>'; }).join('') +
        '</ul>';
      var res = _enviarEmailHtml(r.email, assunto, plain2, html2);
      if (res.ok) enviados++;
    });

    return { enviados: enviados };
  }

  function _alertaSegundaFeiraFn() {
    var cfg = _getConfigAlertas();
    if (!cfg.email_ativo || !cfg.alerta_semana) return;
    var today = new Date();
    var dow = today.getDay();
    var classes  = _safeSheetObjects('Classes');
    var alunos   = _safeSheetObjects('Alunos').filter(function(a){ return _isAtivo(a.Ativo); });
    var todosProfs = _safeSheetObjects('Professores').filter(function(p){ return _isAtivo(p.Ativo); });
    var days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    var assunto = 'Escola Dominical - Aniversariantes da Semana';

    // Para cada professor, mandar lista da turma dele
    todosProfs.forEach(function(prof) {
      if (!prof.Email) return;
      var anivTurma = [];
      for (var i = 0; i < 7; i++) {
        var ref = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow + i);
        alunos.filter(function(a){ return a.ClasseID === prof.ClasseID; }).forEach(function(a){
          if (_isBirthdayOn(a.DataNasc, ref))
            anivTurma.push({ nome: a.Nome, diaLabel: days[i]+' '+('0'+ref.getDate()).slice(-2)+'/'+('0'+(ref.getMonth()+1)).slice(-2) });
        });
      }
      if (!anivTurma.length) return;
      var cl = (classes.filter(function(c){ return c.ID === prof.ClasseID; })[0] || {}).Nome || 'sua turma';

      // Bloco alunos sem DataNasc (somente se cfg.alerta_sem_nasc ativo)
      var semNascTurma = cfg.alerta_sem_nasc
        ? alunos.filter(function(a){ return a.ClasseID === prof.ClasseID && !a.DataNasc; })
        : [];
      var plainSemNasc = semNascTurma.length
        ? '\n\n--- ATENCAO: ' + semNascTurma.length + ' aluno(s) sem data de nascimento cadastrada ---\n' +
          semNascTurma.map(function(a){ return '* ' + a.Nome; }).join('\n') +
          '\nCadastre as datas para receber os alertas de aniversario.'
        : '';
      var htmlSemNasc = semNascTurma.length
        ? '<hr><p style="color:#B45309"><strong>&#x26A0;&#xfe0f; ' + semNascTurma.length +
          ' aluno(s) sem data de nascimento cadastrada em ' + cl + ':</strong></p><ul>' +
          semNascTurma.map(function(a){ return '<li>' + a.Nome + '</li>'; }).join('') +
          '</ul><p style="font-size:12px;color:#666">Cadastre as datas no m&#xf3;dulo Escola Dominical para que os alertas de anivers&#xe1;rio funcionem corretamente.</p>'
        : '';

      var plain1 = 'Escola Dominical - Aniversariantes da Semana\n\n' +
        'Ola, ' + prof.Nome.split(' ')[0] + '! Esta semana temos aniversariantes em ' + cl + ':\n\n' +
        anivTurma.map(function(a){ return a.nome + ' - ' + a.diaLabel; }).join('\n') +
        '\n\nNao esqueca de desejar parabens!' + plainSemNasc;
      var html1 = '<meta charset="UTF-8">' +
        '<p><strong>&#x1F382; Escola Dominical &#x2013; Aniversariantes da Semana</strong></p>' +
        '<p>Ol&#xe1;, ' + prof.Nome.split(' ')[0] + '! Esta semana temos aniversariantes em <strong>' + cl + '</strong>:</p><ul>' +
        anivTurma.map(function(a){ return '<li><strong>' + a.nome + '</strong> &#x2013; ' + a.diaLabel + ' &#x1F973;</li>'; }).join('') +
        '</ul><p>N&#xe3;o esque&#xe7;a de desejar parab&#xe9;ns!</p>' + htmlSemNasc;
      _enviarEmailHtml(prof.Email, assunto, plain1, html1);
    });

    // Destinatários globais
    var dest = cfg.destinatarios || [];

    // Lista global de alunos ativos sem DataNasc (reutilizada por todos os destinatários)
    var semNascGlobal = cfg.alerta_sem_nasc
      ? alunos.filter(function(a){ return !a.DataNasc; })
      : [];
    var plainSemNascGlobal = semNascGlobal.length
      ? '\n\n--- ATENCAO: ' + semNascGlobal.length + ' aluno(s) sem data de nascimento cadastrada ---\n' +
        semNascGlobal.map(function(a){
          var cl = (classes.filter(function(c){ return c.ID === a.ClasseID; })[0] || {}).Nome || 'Sem turma';
          return '* ' + a.Nome + ' (' + cl + ')';
        }).join('\n') +
        '\nCadastre as datas para receber os alertas de aniversario.'
      : '';
    var htmlSemNascGlobal = semNascGlobal.length
      ? '<hr><p style="color:#B45309"><strong>&#x26A0;&#xfe0f; ' + semNascGlobal.length +
        ' aluno(s) sem data de nascimento cadastrada:</strong></p><ul>' +
        semNascGlobal.map(function(a){
          var cl = (classes.filter(function(c){ return c.ID === a.ClasseID; })[0] || {}).Nome || 'Sem turma';
          return '<li><strong>' + a.Nome + '</strong> &#x2013; ' + cl + '</li>';
        }).join('') +
        '</ul><p style="font-size:12px;color:#666">Cadastre as datas no m&#xf3;dulo Escola Dominical para que os alertas de anivers&#xe1;rio funcionem corretamente.</p>'
      : '';

    dest.forEach(function(r) {
      if (!r.email || !r.alertaSemana) return;
      var todos = [];
      for (var i = 0; i < 7; i++) {
        var ref = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow + i);
        alunos.concat(todosProfs).forEach(function(p){
          if (_isBirthdayOn(p.DataNasc, ref))
            todos.push({ nome: p.Nome, diaLabel: days[i]+' '+('0'+ref.getDate()).slice(-2)+'/'+('0'+(ref.getMonth()+1)).slice(-2) });
        });
      }
      var plain2 = 'Escola Dominical - Aniversariantes da Semana\n\n' +
        (todos.length ? todos.map(function(p){ return p.nome + ' - ' + p.diaLabel; }).join('\n') : 'Nenhum aniversariante esta semana.') +
        plainSemNascGlobal;
      var html2 = '<meta charset="UTF-8"><p><strong>&#x1F382; Escola Dominical &#x2013; Aniversariantes da Semana</strong></p>' +
        (todos.length
          ? '<ul>' + todos.map(function(p){ return '<li><strong>' + p.nome + '</strong> &#x2013; ' + p.diaLabel + ' &#x1F973;</li>'; }).join('') + '</ul>'
          : '<p>Nenhum aniversariante esta semana. &#x1F60A;</p>') +
        htmlSemNascGlobal;
      _enviarEmailHtml(r.email, assunto, plain2, html2);
    });
  }

  function getConfigAlertas(token) {
    return withAuth(token, function(sess) { return Util.ok(_getConfigAlertas()); });
  }

  function salvarConfigAlertas(token, config) {
    return withAuth(token, function(sess) { _setConfigAlertas(config); return Util.ok(true); });
  }

  function dispararAlertaManual(token, tipo) {
    return withAuth(token, function(sess) {
      var cfg = _getConfigAlertas();
      if (!cfg.email_ativo) return Util.err('Email não ativo. Configure e ative primeiro.');

      if (tipo === 'teste') {
        // Envia email de confirmação para todos os destinatários globais com email válido,
        // independente de haver aniversariantes. Serve apenas para validar a configuração.
        var dest = (cfg.destinatarios || []).filter(function(d){ return d.email && /\S+@\S+\.\S+/.test(d.email); });
        if (!dest.length) return Util.err('Nenhum destinatário global com email válido encontrado. Adicione e salve antes de testar.');
        var assunto = '[Teste] Alertas Escola Dominical (AD Fonte da Salvacao)';
        var enviados = 0;
        dest.forEach(function(d) {
          // plaintext: sem emojis fora do BMP para evitar encoding corrompido
          var corpo = 'Teste de Email - Escola Dominical\n\n' +
            'Ola, ' + (d.nome || 'destinatario') + '!\n\n' +
            'Este e um email de teste do sistema de alertas de aniversarios.\n' +
            'Se voce recebeu esta mensagem, a configuracao esta funcionando corretamente.\n\n' +
            '-- Sistema AD Fonte da Salvacao';
          // htmlBody: emojis como entidades hexadecimais (sem risco de encoding)
          var html = '<meta charset="UTF-8">' +
            '<p><strong>&#x2705; Teste de Email &#x2013; Escola Dominical</strong></p>' +
            '<p>Ol&#xe1;, ' + (d.nome || 'destinat&#xe1;rio') + '!</p>' +
            '<p>Este &#xe9; um email de teste do sistema de alertas de anivers&#xe1;rios.<br>' +
            'Se voc&#xea; recebeu esta mensagem, a configura&#xe7;&#xe3;o est&#xe1; funcionando corretamente. &#x2705;</p>' +
            '<p>&#x2014; Sistema AD Fonte da Salva&#xe7;&#xe3;o</p>';
          var r = _enviarEmailHtml(d.email, assunto, corpo, html);
          if (r.ok) enviados++;
        });
        if (!enviados) return Util.err('Falha ao enviar para os destinatários. Verifique se o script tem a permissão gmail.send autorizada.');
        return Util.ok({ enviados: enviados });
      }

      if (tipo === 'dia') {
        var res = _alertaDiarioFn();
        if (res && res.motivo === 'sem_aniversariantes')
          return Util.ok({ enviados: 0, aviso: 'Nenhum aniversariante hoje — nenhum email enviado.' });
        return Util.ok(res || true);
      } else if (tipo === 'semana') {
        _alertaSegundaFeiraFn();
        return Util.ok(true);
      }
      return Util.ok(true);
    });
  }

  function alertaDiario()      { _alertaDiarioFn(); }
  function alertaSegundaFeira(){ _alertaSegundaFeiraFn(); }

  return {
    listarClasses:          listarClasses,
    listarClassesTodas:     listarClassesTodas,
    criarClasse:            criarClasse,
    editarClasse:           editarClasse,
    excluirClasse:          excluirClasse,

    listarAlunos:           listarAlunos,
    criarAluno:             criarAluno,
    editarAluno:            editarAluno,
    excluirAluno:           excluirAluno,

    listarProfessores:      listarProfessores,
    criarProfessor:         criarProfessor,
    editarProfessor:        editarProfessor,
    excluirProfessor:       excluirProfessor,

    listarAulas:            listarAulas,
    criarAula:              criarAula,
    editarAula:             editarAula,
    excluirAula:            excluirAula,

    getChamada:             getChamada,
    salvarChamada:          salvarChamada,
    listarChamadasPorAula:  listarChamadasPorAula,
    getRankingAlunos:       getRankingAlunos,
    getEstatisticasGerais:  getEstatisticasGerais,
    getPontosExtras:        getPontosExtras,
    getResumoClasses:       getResumoClasses,
    getResumoAulas:         getResumoAulas,
    getDadosIniciais:       getDadosIniciais,
    ed_diagnostico:         ed_diagnostico,

    getConfigAlertas:       getConfigAlertas,
    salvarConfigAlertas:    salvarConfigAlertas,
    dispararAlertaManual:   dispararAlertaManual,
    alertaDiario:           alertaDiario,
    alertaSegundaFeira:     alertaSegundaFeira
  };

})();


// ── FUNÇÕES PÚBLICAS ────────────────────────────────────────
// Wrapper seguro: garante que NUNCA retorna null/undefined
function _safe(fn, args) {
  try {
    var r = fn.apply(null, args);
    if (r === null || r === undefined) return { success: false, error: 'Resposta vazia do servidor.' };
    
    // Força a conversão de Dates e Objetos complexos para texto puro
    return JSON.parse(JSON.stringify(r)); 
    
  } catch(e) {
    return { success: false, error: e.message || 'Erro interno.' };
  }
}

function ed_diagnostico(token)                         { return _safe(function(){ return EscolaDominical.ed_diagnostico(token); }, []); }
function ed_listarClasses(token)                       { return _safe(function(){ return EscolaDominical.listarClasses(token); }, []); }
function ed_listarClassesTodas(token)                  { return _safe(function(){ return EscolaDominical.listarClassesTodas(token); }, []); }
function ed_criarClasse(token, dados)                  { return _safe(function(){ return EscolaDominical.criarClasse(token, dados); }, []); }
function ed_editarClasse(token, id, dados)             { return _safe(function(){ return EscolaDominical.editarClasse(token, id, dados); }, []); }
function ed_excluirClasse(token, id)                   { return _safe(function(){ return EscolaDominical.excluirClasse(token, id); }, []); }
function ed_listarAlunos(token, classeId)              { return _safe(function(){ return EscolaDominical.listarAlunos(token, classeId); }, []); }
function ed_criarAluno(token, dados)                   { return _safe(function(){ return EscolaDominical.criarAluno(token, dados); }, []); }
function ed_editarAluno(token, id, dados)              { return _safe(function(){ return EscolaDominical.editarAluno(token, id, dados); }, []); }
function ed_excluirAluno(token, id)                    { return _safe(function(){ return EscolaDominical.excluirAluno(token, id); }, []); }
function ed_listarProfessores(token)                   { return _safe(function(){ return EscolaDominical.listarProfessores(token); }, []); }
function ed_criarProfessor(token, dados)               { return _safe(function(){ return EscolaDominical.criarProfessor(token, dados); }, []); }
function ed_editarProfessor(token, id, dados)          { return _safe(function(){ return EscolaDominical.editarProfessor(token, id, dados); }, []); }
function ed_excluirProfessor(token, id)                { return _safe(function(){ return EscolaDominical.excluirProfessor(token, id); }, []); }
function ed_listarAulas(token, filtros)                { return _safe(function(){ return EscolaDominical.listarAulas(token, filtros); }, []); }
function ed_criarAula(token, dados)                    { return _safe(function(){ return EscolaDominical.criarAula(token, dados); }, []); }
function ed_editarAula(token, id, dados)               { return _safe(function(){ return EscolaDominical.editarAula(token, id, dados); }, []); }
function ed_excluirAula(token, id)                     { return _safe(function(){ return EscolaDominical.excluirAula(token, id); }, []); }
function ed_getChamada(token, aulaId, classeId)        { return _safe(function(){ return EscolaDominical.getChamada(token, aulaId, classeId); }, []); }
function ed_salvarChamada(token, aulaId, classeId, r, ti) { return _safe(function(){ return EscolaDominical.salvarChamada(token, aulaId, classeId, r, ti); }, []); }
function ed_listarChamadasPorAula(token, aulaId)       { return _safe(function(){ return EscolaDominical.listarChamadasPorAula(token, aulaId); }, []); }
function ed_getRankingAlunos(token, classeId)          { return _safe(function(){ return EscolaDominical.getRankingAlunos(token, classeId); }, []); }
function ed_getEstatisticasGerais(token)               { return _safe(function(){ return EscolaDominical.getEstatisticasGerais(token); }, []); }
function ed_getPontosExtras(token)                     { return _safe(function(){ return EscolaDominical.getPontosExtras(token); }, []); }
function ed_getResumoClasses(token)                    { return _safe(function(){ return EscolaDominical.getResumoClasses(token); }, []); }
function ed_getResumoAulas(token)                      { return _safe(function(){ return EscolaDominical.getResumoAulas(token); }, []); }
function ed_getDadosIniciais(token, tabs)               { return _safe(function(){ return EscolaDominical.getDadosIniciais(token, tabs); }, []); }
// ─── ALERTAS / ANIVERSÁRIOS — wrappers públicos ────────────
function ed_getConfigAlertas(token)                 { return _safe(function(){ return EscolaDominical.getConfigAlertas(token); }, {}); }
function ed_salvarConfigAlertas(token, config)      { return _safe(function(){ return EscolaDominical.salvarConfigAlertas(token, config); }, {}); }
function ed_dispararAlertaManual(token, tipo)       { return _safe(function(){ return EscolaDominical.dispararAlertaManual(token, tipo); }, {}); }

// Handlers dos triggers GAS (não recebem parâmetros)
function ed_alertaDiario()      { EscolaDominical.alertaDiario(); }
function ed_alertaSegundaFeira(){ EscolaDominical.alertaSegundaFeira(); }

// Configurar triggers GAS — chamado manualmente pelo admin via frontend
function ed_setupAlertaTriggers(token) {
  return withAuth(token, function(sess) {
    if (sess.perfil === 'professor') return { success: false, error: 'Sem permissão.' };
    // Remove triggers existentes de alertas ED
    ScriptApp.getProjectTriggers().forEach(function(t) {
      var fn = t.getHandlerFunction();
      if (fn === 'ed_alertaDiario' || fn === 'ed_alertaSegundaFeira') ScriptApp.deleteTrigger(t);
    });
    // Trigger semanal: toda segunda-feira às 07h00
    ScriptApp.newTrigger('ed_alertaSegundaFeira')
      .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
    // Trigger diário: todo dia às 08h00
    ScriptApp.newTrigger('ed_alertaDiario')
      .timeBased().everyDays(1).atHour(8).create();
    return { success: true, data: { triggers: 2 } };
  });
}