// ═══════════════════════════════════════════════════════════
//  DiagnosticoFinal.gs
//  Cole no GAS e execute: diagnosticoCompleto()
// ═══════════════════════════════════════════════════════════

function diagnosticoCompleto() {
  Logger.log('=== DIAGNÓSTICO COMPLETO ===\n');

  // 1. SS existe?
  try {
    var nome = SS.getName();
    Logger.log('✓ SS ok: ' + nome);
  } catch(e) {
    Logger.log('❌ SS falhou: ' + e.message);
    return;
  }

  // 2. Aba Sessoes existe e tem dados?
  try {
    var sessoes = Util.sheetToObjects('Sessoes');
    Logger.log('✓ Sessoes: ' + sessoes.length + ' linha(s)');
    if (sessoes.length > 0) {
      var s = sessoes[sessoes.length - 1]; // última sessão
      Logger.log('  Última sessão:');
      Logger.log('  - Token: ' + (s.Token||'').substring(0,8) + '...');
      Logger.log('  - Email: ' + s.Email);
      Logger.log('  - Ativo: ' + s.Ativo + ' (' + typeof s.Ativo + ')');
      Logger.log('  - ExpiraEm: ' + s.ExpiraEm);
      Logger.log('  - Ainda válida? ' + (new Date() < new Date(s.ExpiraEm)));
    }
  } catch(e) {
    Logger.log('❌ Sessoes falhou: ' + e.message);
  }

  // 3. Tentar Auth._auth com o último token real
  try {
    var sessoes2 = Util.sheetToObjects('Sessoes');
    if (sessoes2.length > 0) {
      var ultimaSessao = sessoes2[sessoes2.length - 1];
      var token = ultimaSessao.Token;
      Logger.log('\n✓ Testando Auth._auth com token real...');
      var resultado = Auth._auth(token);
      Logger.log('✓ Auth._auth OK: email=' + resultado.email + ', perfil=' + resultado.perfil);

      // 4. Testar ed_listarClasses com esse token
      Logger.log('\nTestando ed_listarClasses...');
      var r = ed_listarClasses(token);
      Logger.log('Resultado: ' + JSON.stringify(r));

    } else {
      Logger.log('❌ Nenhuma sessão encontrada. Faça login no sistema primeiro.');
    }
  } catch(e) {
    Logger.log('❌ ERRO: ' + e.message);
    Logger.log('Stack: ' + e.stack);
  }

  // 5. Testar diretamente sem auth
  Logger.log('\n=== Teste sem autenticação ===');
  try {
    var classes = Util.sheetToObjects('Classes');
    Logger.log('Classes raw: ' + classes.length + ' linhas');
    classes.forEach(function(c, i) {
      Logger.log('  [' + i + '] Nome=' + c.Nome + ' Ativo=' + c.Ativo + ' tipo=' + typeof c.Ativo);
    });
  } catch(e) {
    Logger.log('❌ sheetToObjects Classes falhou: ' + e.message);
  }
}
