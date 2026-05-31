// ═══════════════════════════════════════════════════════════
//  SetupSheets.gs · Criação das abas do Google Sheets
//  Execute setupSpreadsheet() UMA VEZ para inicializar o banco
// ═══════════════════════════════════════════════════════════

var SetupSheets = (function () {

  var SCHEMA = {

    Usuarios: [
      'ID', 'Nome', 'Email', 'SenhaHash', 'Perfil',
      'PrimeiroAcesso', 'Ativo',
      'TokenRecupSenha', 'ExpirToken',
      'CriadoEm', 'UltimoLogin'
    ],

    Sessoes: [
      'Token', 'UsuarioID', 'Email', 'Perfil', 'Nome',
      'CriadoEm', 'ExpiraEm', 'Ativo'
    ],

    Classes: [
      'ID', 'Nome', 'FaixaEtaria', 'LicaoCPAD', 'Ativo', 'CriadoEm'
    ],

    Alunos: [
      'ID', 'Nome', 'DataNasc', 'ClasseID',
      'Telefone', 'Endereco', 'Email',
      'TotalPontos', 'Ativo', 'CriadoEm'
    ],

    Professores: [
      'ID', 'AlunoOrigemID', 'UsuarioID', 'Nome',
      'ClasseID', 'Telefone', 'DataNasc',
      'Endereco', 'Email', 'Cursos',
      'Ativo', 'CriadoEm'
    ],

    Aulas: [
      'ID', 'Data', 'Trimestre', 'NumLicao',
      'Titulo', 'Ano', 'CriadoPor', 'CriadoEm'
    ],

    Chamadas: [
      'ID', 'AulaID', 'ClasseID', 'AlunoID',
      'Presente', 'Biblia', 'Revista',
      'PontosExtrasJSON', 'TotalPontos',
      'TotalOfertas', 'LancadoPor', 'CriadoEm'
    ],

    ChamadasInfo: [
      'ID', 'AulaID', 'ClasseID',
      'NumVisitantes', 'TotalOferta', 'Observacoes',
      'LancadoPor', 'CriadoEm'
    ],

    PontosExtras: [
      'ID', 'Nome', 'Pontos', 'Ativo'
    ],

    Config: [
      'Chave', 'Valor', 'Descricao', 'AtualizadoEm'
    ]
  };

  // Cores de cabeçalho por aba
  var HEADER_COLORS = {
    Usuarios:      '#1C353A',
    Sessoes:       '#0f2a2f',
    Classes:       '#1a3a2a',
    Alunos:        '#1a2a3a',
    Professores:   '#2a1a3a',
    Aulas:         '#2a2a1a',
    Chamadas:      '#2a1a1a',
    ChamadasInfo:  '#1a2a3a',
    PontosExtras:  '#1a2a2a',
    Config:        '#2a2a2a'
  };

  // ─────────────────────────────────────────────────────────────
  //  Migração segura: adiciona colunas ausentes em abas existentes
  //  NÃO apaga dados. Execute após atualizar o SCHEMA acima.
  // ─────────────────────────────────────────────────────────────
  function migrateColumns() {
    var report = [];
    Object.keys(SCHEMA).forEach(function(name) {
      var sheet = SS.getSheetByName(name);
      if (!sheet) {
        report.push('⏭️  "' + name + '" não existe — rode createAllSheets() primeiro.');
        return;
      }
      var expected = SCHEMA[name];
      var existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
      var toAdd = expected.filter(function(col) { return existing.indexOf(col) === -1; });
      if (!toAdd.length) {
        report.push('✅ "' + name + '" — sem colunas novas.');
        return;
      }
      toAdd.forEach(function(col) {
        var nextCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, nextCol).setValue(col)
          .setBackground(HEADER_COLORS[name] || '#1C353A')
          .setFontColor('#00A99C')
          .setFontWeight('bold')
          .setFontSize(11)
          .setFontFamily('Courier New');
        report.push('➕ "' + name + '" — coluna adicionada: ' + col);
      });
      sheet.autoResizeColumns(1, sheet.getLastColumn());
    });
    SpreadsheetApp.flush();
    Logger.log(report.join('\n'));
    return report;
  }

  function createAllSheets() {
    var created = [];
    var skipped = [];

    Object.keys(SCHEMA).forEach(function (name) {
      var existing = SS.getSheetByName(name);
      if (existing) {
        skipped.push(name);
        return;
      }

      var sheet = SS.insertSheet(name);
      var headers = SCHEMA[name];

      // Escrever cabeçalhos
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

      // Estilo do cabeçalho
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange
        .setBackground(HEADER_COLORS[name] || '#1C353A')
        .setFontColor('#00A99C')
        .setFontWeight('bold')
        .setFontSize(11)
        .setFontFamily('Courier New');

      // Congelar linha de cabeçalho
      sheet.setFrozenRows(1);

      // Auto-resize colunas
      sheet.autoResizeColumns(1, headers.length);

      created.push(name);
    });

    // Seed: Usuário admin padrão
    _seedAdmin();

    // Seed: Pontos extras padrão
    _seedPontosExtras();

    // Seed: Config padrão
    _seedConfig();

    // Remover a aba "Plan1" padrão se existir
    var defaultSheet = SS.getSheetByName('Plan1') || SS.getSheetByName('Sheet1');
    if (defaultSheet && SS.getSheets().length > 1) {
      SS.deleteSheet(defaultSheet);
    }

    Logger.log('✅ Abas criadas: ' + created.join(', '));
    Logger.log('⏭️  Abas já existentes: ' + skipped.join(', '));
    Logger.log('🌱 Seed de admin e dados iniciais aplicado.');

    return { created: created, skipped: skipped };
  }

  function _seedAdmin() {
    var sheet = SS.getSheetByName('Usuarios');
    var data  = sheet.getDataRange().getValues();

    // Só cria se ainda não houver nenhum usuário
    if (data.length > 1) return;

    // Senha padrão: "Admin@1234" — hash SHA-256
    // O admin DEVE trocar na primeira entrada (PrimeiroAcesso = TRUE)
    var senhaHash = Util.sha256('Admin@1234');

    Util.insertRow('Usuarios', {
      ID:               Util.uuid(),
      Nome:             'Administrador',
      Email:            'admin@adfontesalvacao.com',
      SenhaHash:        senhaHash,
      Perfil:           PERFIS.ADMIN,
      PrimeiroAcesso:   true,
      Ativo:            true,
      TokenRecupSenha:  '',
      ExpirToken:       '',
      CriadoEm:        Util.now(),
      UltimoLogin:     ''
    });

    Logger.log('🌱 Admin padrão criado: admin@adfontesalvacao.com / Admin@1234');
  }

  function _seedPontosExtras() {
    var sheet = SS.getSheetByName('PontosExtras');
    var data  = sheet.getDataRange().getValues();
    if (data.length > 1) return;

    var extras = [
      { Nome: 'Questionário respondido', Pontos: 5 },
      { Nome: 'Versículo memorizado',    Pontos: 3 },
      { Nome: 'Tarefa da lição entregue', Pontos: 3 }
    ];

    extras.forEach(function (e) {
      Util.insertRow('PontosExtras', {
        ID:     Util.uuid(),
        Nome:   e.Nome,
        Pontos: e.Pontos,
        Ativo:  true
      });
    });
  }

  function _seedConfig() {
    var sheet = SS.getSheetByName('Config');
    var data  = sheet.getDataRange().getValues();
    if (data.length > 1) return;

    var configs = [
      { Chave: 'NOME_IGREJA',      Valor: 'AD Fonte da Salvação',  Descricao: 'Nome da igreja exibido na plataforma' },
      { Chave: 'ANO_LETIVO',       Valor: new Date().getFullYear(), Descricao: 'Ano letivo ativo da Escola Dominical'  },
      { Chave: 'PONTOS_PRESENCA',  Valor: 1,                        Descricao: 'Pontos por presença'                  },
      { Chave: 'PONTOS_BIBLIA',    Valor: 2,                        Descricao: 'Pontos por bíblia levada'             },
      { Chave: 'PONTOS_REVISTA',   Valor: 2,                        Descricao: 'Pontos por revista levada'            }
    ];

    configs.forEach(function (c) {
      Util.insertRow('Config', {
        Chave:        c.Chave,
        Valor:        c.Valor,
        Descricao:    c.Descricao,
        AtualizadoEm: Util.now()
      });
    });
  }

  return {
    createAllSheets: createAllSheets,
    migrateColumns:  migrateColumns
  };

})();