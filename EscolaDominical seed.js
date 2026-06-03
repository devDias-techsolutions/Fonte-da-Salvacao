// ════════════════════════════════════════════════════════════════
//  SEED — Carga de Dados Fictícios · Escola Dominical
//  Limpa Classes, Alunos, Professores, Aulas e Chamadas,
//  depois insere um cenário robusto para testes.
//
//  Como executar:
//    1. Abra o Apps Script do projeto
//    2. Selecione a função  ed_seedDados  no seletor
//    3. Clique em ▶ Executar
//    4. Veja o retorno no console (Ctrl+Enter) ou via Logger
//
//  ⚠️  ATENÇÃO: APAGA todos os dados das 5 tabelas antes de inserir.
// ════════════════════════════════════════════════════════════════

function ed_seedDados() {

  var log = [];

  // ──────────────────────────────────────────────────────────────
  //  MICRO-HELPERS
  // ──────────────────────────────────────────────────────────────
  function rInt(min, max)  { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr)       { return arr[rInt(0, arr.length - 1)]; }
  function chance(p)       { return Math.random() < p; }

  function _clearSheet(name) {
    var s = Util.getSheet(name);
    if (s && s.getLastRow() > 1) {
      s.deleteRows(2, s.getLastRow() - 1);
    }
  }

  function _dataNasc(minAge, maxAge) {
    var ano = new Date().getFullYear() - rInt(minAge, maxAge);
    var mes = rInt(1, 12);
    var dia = rInt(1, 28);
    return ('0' + dia).slice(-2) + '/' + ('0' + mes).slice(-2) + '/' + ano;
  }

  function _fone() {
    return '(31) 9' + rInt(1000, 9999) + '-' + rInt(1000, 9999);
  }

  function _email(nome) {
    return nome.split(' ')[0].toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      + rInt(10, 99) + '@email.com';
  }

  var _RUAS    = ['das Palmeiras','do Ipê','das Acácias','São Pedro','da Saudade','dos Cedros','Santa Maria','do Progresso','Nossa Senhora','Belo Horizonte','José Ferreira','João Pinheiro','Tiradentes'];
  var _BAIRROS = ['Jardim das Flores','Centro','Vila Nova','Boa Vista','Alto da Serra','Santo André','Parque Real','Santa Cruz','Vila Esperança','Bela Vista'];

  function _endereco() {
    return 'Rua ' + pick(_RUAS) + ', ' + rInt(1, 500) + ' — ' + pick(_BAIRROS) + ' — Betim/MG';
  }

  // Banco de nomes — evita duplicatas globais
  var _usados = {};
  var NM = ['Lucas','Gabriel','Mateus','Pedro','João','Rafael','Felipe','André','Marcos','Daniel',
            'Paulo','Bruno','Carlos','Tiago','Vinicius','Davi','Samuel','Eduardo','Luiz','Henrique',
            'Ricardo','Alexandre','Leandro','Rodrigo','Márcio','Thiago','Gustavo','Diego','Wagner','Sérgio'];
  var NF = ['Ana','Maria','Júlia','Beatriz','Larissa','Fernanda','Camila','Aline','Patrícia','Sandra',
            'Regina','Kelly','Priscila','Mariana','Rafaela','Bruna','Letícia','Débora','Simone','Gisele',
            'Carla','Cristina','Adriana','Renata','Vanessa','Tânia','Rosana','Elaine','Luciana','Natália'];
  var SB = ['Silva','Santos','Oliveira','Souza','Lima','Pereira','Alves','Ferreira','Costa','Carvalho',
            'Rodrigues','Nascimento','Martins','Araújo','Gonçalves','Barbosa','Ribeiro','Cardoso','Monteiro','Mendes',
            'Moreira','Nunes','Castro','Reis','Teixeira'];

  function _nome(g) {
    for (var t = 0; t < 30; t++) {
      var n = pick(g === 'M' ? NM : NF) + ' ' + pick(SB) + ' ' + pick(SB);
      if (!_usados[n]) { _usados[n] = true; return n; }
    }
    // fallback com sufixo numérico
    var n2 = pick(g === 'M' ? NM : NF) + ' ' + pick(SB) + ' ' + pick(SB) + ' ' + rInt(2, 9);
    _usados[n2] = true;
    return n2;
  }

  // ──────────────────────────────────────────────────────────────
  //  1. LIMPAR AS 5 TABELAS
  // ──────────────────────────────────────────────────────────────
  var TABELAS = ['Classes', 'Alunos', 'Professores', 'Aulas', 'Chamadas'];
  TABELAS.forEach(function(t) {
    _clearSheet(t);
    log.push('[LIMPAR] Tabela "' + t + '" zerada.');
  });

  // ──────────────────────────────────────────────────────────────
  //  2. GARANTIR ENTRADA "Questionário" EM PontosExtras
  //     (extras são configuráveis — o seed apenas assegura que
  //      existe pelo menos este, sem apagar os demais.)
  // ──────────────────────────────────────────────────────────────
  var QUIZ_ID = 'SEED-QUIZ-001';
  var PT_QUIZ = 3;
  try {
    var extRows = Util.sheetToObjects('PontosExtras') || [];
    if (!extRows.some(function(r) { return r.ID === QUIZ_ID; })) {
      Util.insertRow('PontosExtras', {
        ID:       QUIZ_ID,
        Nome:     'Questionário',
        Pontos:   PT_QUIZ,
        Ativo:    true,
        CriadoEm: Util.now()
      });
      log.push('[EXTRAS] "Questionário" inserido em PontosExtras (ID=' + QUIZ_ID + ', Pontos=' + PT_QUIZ + ').');
    } else {
      log.push('[EXTRAS] "Questionário" já existe em PontosExtras — mantido.');
    }
  } catch (e) {
    log.push('[AVISO] Não foi possível acessar PontosExtras: ' + e.message);
  }

  // ──────────────────────────────────────────────────────────────
  //  3. LER PONTUAÇÃO DA CONFIG (usa padrões se ausente)
  // ──────────────────────────────────────────────────────────────
  var PT_PRES = 1, PT_BIB = 2, PT_REV = 2;
  try {
    var cfg = {};
    (Util.sheetToObjects('Config') || []).forEach(function(r) { cfg[r.Chave] = r.Valor; });
    PT_PRES = Number(cfg.PONTOS_PRESENCA) || 1;
    PT_BIB  = Number(cfg.PONTOS_BIBLIA)   || 2;
    PT_REV  = Number(cfg.PONTOS_REVISTA)  || 2;
  } catch (e) {
    log.push('[AVISO] Config não acessível — usando pontos padrão (P=1, B=2, R=2).');
  }

  // ──────────────────────────────────────────────────────────────
  //  4. DEFINIÇÃO DAS 5 TURMAS
  //
  //  oferta  → 'sempre'   todas as 5 aulas têm ofertas
  //            'as_vezes' aulas alternadas têm oferta (~3 de 5)
  //            'nunca'    nenhuma aula tem oferta
  //
  //  visita  → cenário declarado; armazenamento não implementado
  //            no esquema atual (ver aviso no final do log).
  // ──────────────────────────────────────────────────────────────
  var TURMAS = [
    // ── Turma 1: Infantil ─────────────────────────────────────
    {
      nome: 'Infantil', faixa: '4–6 anos', licao: 'Lição Infantil CPAD',
      nAlunos: 7,
      profNome: 'Claudete Ferreira dos Santos', profEmail: 'claudete.santos@gmail.com',
      profCursos: 'Pedagogia Cristã · Escola Bíblica Dominical CPAD',
      idadeMin: 4, idadeMax: 6,
      // Presença alta (crianças vêm com os pais), bíblia e revista moderadas
      taxaPresenca: 0.85, taxaBiblia: 0.40, taxaRevista: 0.65, taxaQuiz: 0.75,
      oferta: 'sempre',   // coleta oferta em TODAS as aulas
      visita: 'sempre'    // cenário A: visitantes em todas as aulas
    },
    // ── Turma 2: Juniores ─────────────────────────────────────
    {
      nome: 'Juniores', faixa: '7–9 anos', licao: 'Lição Juniores CPAD',
      nAlunos: 8,
      profNome: 'Rogério Almeida Barbosa', profEmail: 'rogerio.barbosa@gmail.com',
      profCursos: 'Didática no Ensino Bíblico · Teologia EAD',
      idadeMin: 7, idadeMax: 9,
      taxaPresenca: 0.75, taxaBiblia: 0.55, taxaRevista: 0.50, taxaQuiz: 0.65,
      oferta: 'as_vezes', // oferta em ~3 de 5 aulas
      visita: 'as_vezes'  // cenário B: visitantes em algumas aulas
    },
    // ── Turma 3: Adolescentes ─────────────────────────────────
    {
      nome: 'Adolescentes', faixa: '10–14 anos', licao: 'Lição Adolescentes CPAD',
      nAlunos: 9,
      profNome: 'Patrícia Nascimento Lima', profEmail: 'patricia.lima@gmail.com',
      profCursos: 'Escola Bíblica Dominical CPAD · Pedagogia Bíblica',
      idadeMin: 10, idadeMax: 14,
      taxaPresenca: 0.68, taxaBiblia: 0.60, taxaRevista: 0.55, taxaQuiz: 0.60,
      oferta: 'as_vezes', // oferta em ~2 de 5 aulas (alternância oposta à turma 2)
      visita: 'nunca'     // cenário C: sem visitantes
    },
    // ── Turma 4: Jovens ───────────────────────────────────────
    {
      nome: 'Jovens', faixa: '15–25 anos', licao: 'Lição Jovens CPAD',
      nAlunos: 8,
      profNome: 'Fábio Costa Rodrigues', profEmail: 'fabio.rodrigues@gmail.com',
      profCursos: 'Teologia · Liderança Cristã · EBD Avançado',
      idadeMin: 15, idadeMax: 25,
      taxaPresenca: 0.72, taxaBiblia: 0.65, taxaRevista: 0.60, taxaQuiz: 0.55,
      oferta: 'sempre',   // coleta oferta em TODAS as aulas
      visita: 'as_vezes'  // cenário B: visitantes em algumas aulas
    },
    // ── Turma 5: Adultos ──────────────────────────────────────
    {
      nome: 'Adultos', faixa: '26+ anos', licao: 'Lição Adultos CPAD',
      nAlunos: 6,
      profNome: 'Antônio Pereira Gonçalves', profEmail: 'antonio.goncalves@gmail.com',
      profCursos: 'Teologia Bíblica · Exposição Bíblica · Pedagogia Cristã',
      idadeMin: 26, idadeMax: 65,
      taxaPresenca: 0.70, taxaBiblia: 0.72, taxaRevista: 0.65, taxaQuiz: 0.50,
      oferta: 'nunca',    // sem coleta de oferta
      visita: 'nunca'     // cenário C: sem visitantes
    }
  ];

  // ──────────────────────────────────────────────────────────────
  //  5. INSERIR CLASSES E PROFESSORES
  // ──────────────────────────────────────────────────────────────
  var classeIds = [];
  var profIds   = [];

  TURMAS.forEach(function(t, i) {
    var cId = Util.uuid();
    classeIds.push(cId);
    Util.insertRow('Classes', {
      ID: cId, Nome: t.nome, FaixaEtaria: t.faixa,
      LicaoCPAD: t.licao, Ativo: true, CriadoEm: Util.now()
    });

    var pId = Util.uuid();
    profIds.push(pId);
    Util.insertRow('Professores', {
      ID:            pId,
      AlunoOrigemID: '',
      UsuarioID:     '',
      Nome:          t.profNome,
      ClasseID:      cId,
      Telefone:      _fone(),
      DataNasc:      _dataNasc(30, 60),
      Endereco:      _endereco(),
      Email:         t.profEmail,
      Cursos:        t.profCursos,
      Ativo:         true,
      CriadoEm:     Util.now()
    });

    log.push('[TURMA ' + (i + 1) + '] "' + t.nome + '" criada · Prof.: ' + t.profNome);
  });

  // ──────────────────────────────────────────────────────────────
  //  6. INSERIR ALUNOS
  //     • Infantil/Juniores: sem telefone nem e-mail (crianças)
  //     • Adolescentes: só telefone
  //     • Jovens/Adultos: telefone + e-mail
  // ──────────────────────────────────────────────────────────────
  var alunosPorClasse = {}; // { classeId: [alunoId, ...] }

  TURMAS.forEach(function(t, i) {
    var cId = classeIds[i];
    alunosPorClasse[cId] = [];

    for (var j = 0; j < t.nAlunos; j++) {
      var g   = chance(0.5) ? 'M' : 'F';
      var aId = Util.uuid();
      var nm  = _nome(g);

      var temTelefone = t.idadeMin >= 10;
      var temEmail    = t.idadeMin >= 15;

      Util.insertRow('Alunos', {
        ID:          aId,
        Nome:        nm,
        DataNasc:    _dataNasc(t.idadeMin, t.idadeMax),
        ClasseID:    cId,
        Telefone:    temTelefone ? _fone()     : '',
        Endereco:    _endereco(),
        Email:       temEmail    ? _email(nm)  : '',
        TotalPontos: 0,
        Ativo:       true,
        CriadoEm:   Util.now()
      });

      alunosPorClasse[cId].push(aId);
    }

    log.push('[ALUNOS] "' + t.nome + '": ' + t.nAlunos + ' alunos inseridos.');
  });

  // ──────────────────────────────────────────────────────────────
  //  7. INSERIR 5 AULAS — 1º Trimestre 2025
  // ──────────────────────────────────────────────────────────────
  var AULAS_DEF = [
    { data: '02/03/2025', tri: '1', num: '1', titulo: 'A Criação e o Amor de Deus' },
    { data: '09/03/2025', tri: '1', num: '2', titulo: 'Abraão: O Pai da Fé' },
    { data: '16/03/2025', tri: '1', num: '3', titulo: 'Moisés e a Libertação do Egito' },
    { data: '23/03/2025', tri: '1', num: '4', titulo: 'Davi: Um Homem Segundo o Coração de Deus' },
    { data: '30/03/2025', tri: '1', num: '5', titulo: 'O Sermão do Monte e as Bem-Aventuranças' }
  ];

  var aulaIds = [];
  AULAS_DEF.forEach(function(def) {
    var aId = Util.uuid();
    aulaIds.push(aId);
    Util.insertRow('Aulas', {
      ID:        aId,
      Data:      def.data,
      Trimestre: def.tri,
      NumLicao:  def.num,
      Titulo:    def.titulo,
      Ano:       '2025',
      CriadoPor: 'seed@sistema.com',
      CriadoEm:  def.data + ' 09:00:00'
    });
  });
  log.push('[AULAS] 5 aulas do 1º Trimestre/2025 inseridas.');

  // ──────────────────────────────────────────────────────────────
  //  8. INSERIR CHAMADAS  (aula × turma × aluno)
  //
  //  REGRAS DE CONSISTÊNCIA APLICADAS:
  //   • Bíblia     → só se presente
  //   • Revista    → só se presente
  //   • Questionário → SÓ se presente E trouxe revista
  //   • Oferta     → só se presente E a aula desta turma tem oferta
  //
  //  CENÁRIO DE OFERTA por turma:
  //   'sempre'   → todas as 5 aulas registram oferta
  //   'as_vezes' → aulas nos índices onde (aulaIdx % 2 === tuIdx % 2)
  //                  Juniores (tuIdx=1): aulas 1 e 3 têm oferta
  //                  Adolescentes (tuIdx=2): aulas 0, 2 e 4 têm oferta
  //   'nunca'    → sem oferta em nenhuma aula
  // ──────────────────────────────────────────────────────────────
  var pontosAcum = {}; // { alunoId: totalPontos acumulado }
  var nChamadas  = 0;

  aulaIds.forEach(function(aulaId, aulaIdx) {
    TURMAS.forEach(function(t, tuIdx) {
      var classeId = classeIds[tuIdx];
      var alunos   = alunosPorClasse[classeId];

      // Determina se esta aula coleta oferta para esta turma
      var aulaTemOferta = false;
      if (t.oferta === 'sempre') {
        aulaTemOferta = true;
      } else if (t.oferta === 'as_vezes') {
        aulaTemOferta = (aulaIdx % 2 === tuIdx % 2);
      }
      // 'nunca' → false (padrão)

      alunos.forEach(function(alunoId) {

        // ── Presença ────────────────────────────────────────────
        var presente = chance(t.taxaPresenca);

        // ── Bíblia, Revista, Questionário ───────────────────────
        var biblia   = false;
        var revista  = false;
        var quiz     = false;
        var extraJson = [];
        var ptExtra  = 0;
        var totalOfertas = 0;

        if (presente) {
          biblia  = chance(t.taxaBiblia);
          revista = chance(t.taxaRevista);

          // Questionário EXIGE revista (regra de negócio)
          if (revista) {
            quiz = chance(t.taxaQuiz);
          }

          if (quiz) {
            extraJson = [{ id: QUIZ_ID, pontos: PT_QUIZ }];
            ptExtra   = PT_QUIZ;
          }

          // Oferta (apenas para presentes, na aula correta do cenário)
          if (aulaTemOferta) {
            totalOfertas = rInt(2, 30);
          }
        }

        // ── Cálculo de pontos ────────────────────────────────────
        var total = (presente ? PT_PRES : 0)
                  + (biblia   ? PT_BIB  : 0)
                  + (revista  ? PT_REV  : 0)
                  + ptExtra;

        if (!pontosAcum[alunoId]) pontosAcum[alunoId] = 0;
        pontosAcum[alunoId] += total;

        // ── Persistir chamada ────────────────────────────────────
        Util.insertRow('Chamadas', {
          ID:               Util.uuid(),
          AulaID:           aulaId,
          ClasseID:         classeId,
          AlunoID:          alunoId,
          Presente:         presente,
          Biblia:           biblia,
          Revista:          revista,
          PontosExtrasJSON: JSON.stringify(extraJson),
          TotalPontos:      total,
          TotalOfertas:     totalOfertas,
          LancadoPor:       'seed@sistema.com',
          CriadoEm:         Util.now()
        });

        nChamadas++;
      });

      log.push(
        '[CHAMADA] Aula ' + (aulaIdx + 1) + ' · "' + t.nome +
        '" · ' + alunos.length + ' registros' +
        (aulaTemOferta ? ' · com oferta' : ' · sem oferta')
      );
    });
  });

  // ──────────────────────────────────────────────────────────────
  //  9. RECALCULAR TotalPontos DE CADA ALUNO
  // ──────────────────────────────────────────────────────────────
  var allAlunos = Util.sheetToObjects('Alunos');
  allAlunos.forEach(function(a) {
    Util.updateRow('Alunos', a._rowIndex, {
      ID:          a.ID,
      Nome:        a.Nome,
      DataNasc:    a.DataNasc,
      ClasseID:    a.ClasseID,
      Telefone:    a.Telefone,
      Endereco:    a.Endereco,
      Email:       a.Email,
      TotalPontos: pontosAcum[a.ID] || 0,
      Ativo:       a.Ativo,
      CriadoEm:   a.CriadoEm
    });
  });
  log.push('[PONTOS] TotalPontos recalculados para ' + allAlunos.length + ' alunos.');

  // Forçar gravação na planilha antes de retornar
  SpreadsheetApp.flush();

  // ──────────────────────────────────────────────────────────────
  //  NOTAS IMPORTANTES
  // ──────────────────────────────────────────────────────────────
  log.push('');
  log.push('─────────────────────────────────────────────────────────');
  log.push('⚠️  VISITANTES — campo não existe no esquema atual.');
  log.push('   O módulo HTML declara a variável "visitantes" mas');
  log.push('   o próprio código comenta: "não temos no esquema atual".');
  log.push('   Para suportar visitantes, adicione a coluna:');
  log.push('     NumVisitantes  (inteiro)  na aba "Chamadas"');
  log.push('   e atualize salvarChamada() para gravar e ler o campo.');
  log.push('   Cenários declarados neste seed:');
  log.push('     Infantil  → visita: SEMPRE   (implementar: sempre > 0)');
  log.push('     Juniores  → visita: ÀS VEZES (implementar: 0 em ~2 aulas)');
  log.push('     Adolescentes → visita: NUNCA');
  log.push('     Jovens    → visita: ÀS VEZES');
  log.push('     Adultos   → visita: NUNCA');
  log.push('─────────────────────────────────────────────────────────');

  // ──────────────────────────────────────────────────────────────
  //  RESUMO FINAL
  // ──────────────────────────────────────────────────────────────
  var totalAlunos = Object.keys(alunosPorClasse).reduce(function(s, k) {
    return s + alunosPorClasse[k].length;
  }, 0);

  log.push('');
  log.push('✅  SEED CONCLUÍDO');
  log.push('    Classes:    5');
  log.push('    Professores: 5');
  log.push('    Alunos:     ' + totalAlunos);
  log.push('    Aulas:      5  (1º Trimestre 2025, lições 1–5)');
  log.push('    Chamadas:   ' + nChamadas + '  (' + (TURMAS.length * AULAS_DEF.length) + ' aula×turma × média ~' + Math.round(totalAlunos / TURMAS.length) + ' alunos/turma)');
  log.push('    Pontuação:  Presença=' + PT_PRES + ' · Bíblia=' + PT_BIB + ' · Revista=' + PT_REV + ' · Questionário=' + PT_QUIZ);

  Logger.log(log.join('\n'));
  return { success: true, log: log };
}