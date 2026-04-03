// test_leilao_v2.js — Testes das melhorias do sistema de leilão
// Testa: sessão cruzada, config msg, relatórios humanizados, blocos, delays

import {
  iniciarSessao,
  temSessaoAtiva,
  getSessaoAtiva,
  registrarEnquete,
  registrarVotoFallback,
  getStatusSessao,
  cancelarSessao,
  encerrarSessao,
  gerarAnuncioGrupoBlocos,
  gerarRelatorioComprador,
  gerarRelatorioAdmin,
  formatarReais,
  extrairValorNumerico,
  computeOptionHash,
  setMsgPagamento,
  getMsgPagamento,
  getConfigLeilao,
  delayHumano,
  delayEntreBloco,
} from "./src/core/leilaoManager.js";

import fs from "fs";
import path from "path";

const LEILOES_PATH = path.resolve("src/data/leiloes_ativos.json");
const HISTORICO_PATH = path.resolve("src/data/historico_leiloes.json");
const CONFIG_PATH = path.resolve("src/data/config_leilao.json");

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.log(`  ❌ FALHOU: ${msg}`);
    failed++;
  }
}

function resetData() {
  fs.writeFileSync(LEILOES_PATH, JSON.stringify({ sessoes: {} }, null, 2));
  fs.writeFileSync(HISTORICO_PATH, JSON.stringify({ historico: [] }, null, 2));
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({}, null, 2));
}

console.log("═══════════════════════════════════════════");
console.log("   TESTES V2: MELHORIAS DO SISTEMA DE LEILÃO");
console.log("═══════════════════════════════════════════");

// ============================================================
// TESTE 1: Sessão cruzada — dois leilões simultâneos
// ============================================================
console.log("\n📋 TESTE 1: Sessões simultâneas em grupos diferentes");
console.log("─────────────────────────────────");
resetData();

const grupo1 = "120363423975280243@g.us";
const grupo2 = "120363402792383817@g.us";
const admin1 = "65060886032554@lid";
const admin2 = "53077390397562@lid";

iniciarSessao(grupo1, admin1);
iniciarSessao(grupo2, admin2);

assert(temSessaoAtiva(grupo1), "Sessão ativa no grupo 1");
assert(temSessaoAtiva(grupo2), "Sessão ativa no grupo 2");

// Criar enquetes em cada grupo
registrarEnquete(grupo1, "POLL_G1_001", "Pikachu Holo", ["R$ 50", "R$ 100", "R$ 150"]);
registrarEnquete(grupo2, "POLL_G2_001", "Charizard EX", ["R$ 200", "R$ 300", "R$ 400"]);

// Registrar votos no grupo 1
const hash50 = computeOptionHash("R$ 50");
const hash100 = computeOptionHash("R$ 100");
registrarVotoFallback(grupo1, "POLL_G1_001", "voter1@lid", [hash100]);

// Registrar votos no grupo 2
const hash200 = computeOptionHash("R$ 200");
const hash400 = computeOptionHash("R$ 400");
registrarVotoFallback(grupo2, "POLL_G2_001", "voter2@lid", [hash400]);

// Verificar que os votos não se cruzaram
const sessao1 = getSessaoAtiva(grupo1);
const sessao2 = getSessaoAtiva(grupo2);

assert(Object.keys(sessao1.enquetes["POLL_G1_001"].votos).length === 1, "Grupo 1 tem 1 voto");
assert(Object.keys(sessao2.enquetes["POLL_G2_001"].votos).length === 1, "Grupo 2 tem 1 voto");
assert(sessao1.enquetes["POLL_G1_001"].votos["voter1@lid"]?.opcaoTexto === "R$ 100", "Voto no grupo 1 é R$ 100");
assert(sessao2.enquetes["POLL_G2_001"].votos["voter2@lid"]?.opcaoTexto === "R$ 400", "Voto no grupo 2 é R$ 400");

// ============================================================
// TESTE 2: Voto com groupJid errado — deve redirecionar
// ============================================================
console.log("\n📋 TESTE 2: Voto com groupJid errado (redirecionamento)");
console.log("─────────────────────────────────");

// Voto chega com groupJid errado mas pollMsgId correto
registrarVotoFallback("grupo_errado@g.us", "POLL_G1_001", "voter3@lid", [hash50]);

const sessao1After = getSessaoAtiva(grupo1);
assert(Object.keys(sessao1After.enquetes["POLL_G1_001"].votos).length === 2, "Voto redirecionado para grupo correto (2 votos)");
assert(sessao1After.enquetes["POLL_G1_001"].votos["voter3@lid"]?.opcaoTexto === "R$ 50", "Voto redirecionado com opção correta");

// ============================================================
// TESTE 3: Config de mensagem de pagamento
// ============================================================
console.log("\n📋 TESTE 3: Configurar mensagem de pagamento");
console.log("─────────────────────────────────");

// Mensagem padrão
const msgPadrao = getMsgPagamento(grupo1);
assert(msgPadrao === "Procura o admin pra acertar o pagamento!", "Mensagem padrão correta");

// Configurar mensagem personalizada
setMsgPagamento(grupo1, "Pix: 11999999999 (Fernando) - Envie o comprovante no PV!");
const msgCustom = getMsgPagamento(grupo1);
assert(msgCustom === "Pix: 11999999999 (Fernando) - Envie o comprovante no PV!", "Mensagem personalizada salva");

// Grupo 2 mantém padrão
const msgG2 = getMsgPagamento(grupo2);
assert(msgG2 === "Procura o admin pra acertar o pagamento!", "Grupo 2 mantém mensagem padrão");

// ============================================================
// TESTE 4: Relatório do comprador com mensagem personalizada
// ============================================================
console.log("\n📋 TESTE 4: Relatório do comprador humanizado");
console.log("─────────────────────────────────");

const compras = {
  itens: [
    { descricao: "Shaymin-V-ASTRO (013/100) JP", valor: 7, valorTexto: "R$ 7" },
    { descricao: "Mega Charizard X ex (023/∞)", valor: 200, valorTexto: "R$ 200" },
    { descricao: "teste enquete manual", valor: 1, valorTexto: "R$ 1" },
  ],
  total: 208,
};

const relatorio = gerarRelatorioComprador("voter1@lid", compras, "Testes", "Pix: 11999999999 (Fernando)");
assert(relatorio.includes("🎉 Você arrematou itens no leilão do grupo *Testes*"), "Cabeçalho humanizado");
assert(relatorio.includes("Aqui tá o seu resumo:"), "Frase de resumo");
assert(relatorio.includes("1. Shaymin-V-ASTRO (013/100) JP — R$ 7"), "Item 1 formatado");
assert(relatorio.includes("2. Mega Charizard X ex (023/∞) — R$ 200"), "Item 2 formatado");
assert(relatorio.includes("3. teste enquete manual — R$ 1"), "Item 3 formatado");
assert(relatorio.includes("R$ 208,00"), "Total correto");
assert(relatorio.includes("Pix: 11999999999 (Fernando)"), "Mensagem personalizada no rodapé");
assert(!relatorio.includes("Procura o admin"), "Não contém mensagem padrão");

// ============================================================
// TESTE 5: Relatório com mensagem padrão (sem config)
// ============================================================
console.log("\n📋 TESTE 5: Relatório com mensagem padrão");
console.log("─────────────────────────────────");

const relatorioPadrao = gerarRelatorioComprador("voter1@lid", compras, "Grupo Teste", null);
assert(relatorioPadrao.includes("Procura o admin pra acertar o pagamento!"), "Mensagem padrão quando não configurada");

// ============================================================
// TESTE 6: Anúncio em blocos
// ============================================================
console.log("\n📋 TESTE 6: Anúncio no grupo em blocos");
console.log("─────────────────────────────────");
resetData();

iniciarSessao(grupo1, admin1);

// Criar 12 enquetes para testar blocos de 5
for (let i = 1; i <= 12; i++) {
  registrarEnquete(grupo1, `POLL_${i}`, `Item ${i}`, [`R$ ${i * 10}`, `R$ ${i * 20}`]);
  registrarVotoFallback(grupo1, `POLL_${i}`, `voter${i}@lid`, [computeOptionHash(`R$ ${i * 20}`)]);
}

const dadosEnc = encerrarSessao(grupo1, "Grupo Teste");
assert(dadosEnc.ok, "Encerramento OK");
assert(dadosEnc.resultados.length === 12, "12 itens vendidos");

const blocos = gerarAnuncioGrupoBlocos(dadosEnc);
console.log(`  📦 Total de blocos gerados: ${blocos.length}`);

// Bloco 1: abertura
// Bloco 2-4: 5+5+2 resultados
// Bloco 5: fechamento
assert(blocos.length >= 4, "Pelo menos 4 blocos (abertura + 3 de resultados + fechamento)");
assert(blocos[0].texto.includes("LEILÃO ENCERRADO"), "Primeiro bloco é abertura");
assert(blocos[blocos.length - 1].texto.includes("Relatórios individuais"), "Último bloco é fechamento");

// Verificar que cada bloco de resultados tem no máximo 5 itens
for (let i = 1; i < blocos.length - 1; i++) {
  const numItens = (blocos[i].texto.match(/📦/g) || []).length;
  assert(numItens <= 5, `Bloco ${i} tem ${numItens} itens (máx 5)`);
}

// ============================================================
// TESTE 7: Anúncio sem lances
// ============================================================
console.log("\n📋 TESTE 7: Anúncio sem nenhum lance");
console.log("─────────────────────────────────");
resetData();

iniciarSessao(grupo1, admin1);
registrarEnquete(grupo1, "POLL_SL", "Item sem lance", ["R$ 10", "R$ 20"]);
const dadosSL = encerrarSessao(grupo1, "Grupo Teste");
const blocosSL = gerarAnuncioGrupoBlocos(dadosSL);

assert(blocosSL.length >= 1, "Pelo menos 1 bloco");
// Verifica que menciona itens sem lance
const textoCompleto = blocosSL.map(b => b.texto).join("\n");
assert(textoCompleto.includes("sem lance") || textoCompleto.includes("Nenhum item"), "Menciona itens sem lance");

// ============================================================
// TESTE 8: Delay humanizado
// ============================================================
console.log("\n📋 TESTE 8: Delay humanizado");
console.log("─────────────────────────────────");

const start = Date.now();
await delayHumano(100, 200);
const elapsed = Date.now() - start;
assert(elapsed >= 90, `Delay mínimo respeitado (${elapsed}ms >= 90ms)`);
assert(elapsed < 500, `Delay máximo respeitado (${elapsed}ms < 500ms)`);

// ============================================================
// TESTE 9: Relatório admin com múltiplos compradores
// ============================================================
console.log("\n📋 TESTE 9: Relatório admin consolidado");
console.log("─────────────────────────────────");
resetData();

iniciarSessao(grupo1, admin1);
registrarEnquete(grupo1, "POLL_A1", "Pikachu", ["R$ 50", "R$ 100"]);
registrarEnquete(grupo1, "POLL_A2", "Charizard", ["R$ 200", "R$ 300"]);
registrarEnquete(grupo1, "POLL_A3", "Mewtwo", ["R$ 150", "R$ 250"]);
registrarEnquete(grupo1, "POLL_A4", "Sem lance", ["R$ 10", "R$ 20"]);

registrarVotoFallback(grupo1, "POLL_A1", "comprador1@lid", [computeOptionHash("R$ 100")]);
registrarVotoFallback(grupo1, "POLL_A2", "comprador1@lid", [computeOptionHash("R$ 300")]);
registrarVotoFallback(grupo1, "POLL_A3", "comprador2@lid", [computeOptionHash("R$ 250")]);

const dadosAdmin = encerrarSessao(grupo1, "Grupo Leilão");
const relAdmin = gerarRelatorioAdmin(dadosAdmin, "Grupo Leilão");

assert(relAdmin.texto.includes("RELATÓRIO DE LEILÃO ENCERRADO"), "Cabeçalho do relatório admin");
assert(relAdmin.texto.includes("Grupo Leilão"), "Nome do grupo");
assert(relAdmin.texto.includes("Itens vendidos:* 3"), "3 itens vendidos");
assert(relAdmin.texto.includes("Itens sem lance:* 1"), "1 item sem lance");
assert(relAdmin.texto.includes("R$ 650,00"), "Faturamento total R$ 650");
assert(relAdmin.texto.includes("RESUMO POR COMPRADOR"), "Seção de compradores");
assert(relAdmin.texto.includes("Sem lance"), "Lista item sem lance");
assert(relAdmin.mentions.length === 2, "2 compradores mencionados");

// ============================================================
// TESTE 10: Config por grupo é isolada
// ============================================================
console.log("\n📋 TESTE 10: Config isolada por grupo");
console.log("─────────────────────────────────");

setMsgPagamento(grupo1, "Pix grupo 1");
setMsgPagamento(grupo2, "Pix grupo 2");

assert(getMsgPagamento(grupo1) === "Pix grupo 1", "Config grupo 1 isolada");
assert(getMsgPagamento(grupo2) === "Pix grupo 2", "Config grupo 2 isolada");
assert(getMsgPagamento("outro@g.us") === "Procura o admin pra acertar o pagamento!", "Grupo sem config retorna padrão");

// ============================================================
// TESTE 11: Encerrar com empate de valor (primeiro voto ganha)
// ============================================================
console.log("\n📋 TESTE 11: Empate de valor — primeiro voto ganha");
console.log("─────────────────────────────────");
resetData();

iniciarSessao(grupo1, admin1);
registrarEnquete(grupo1, "POLL_EMP", "Item Empate", ["R$ 100", "R$ 200"]);

// voter1 vota primeiro em R$ 200
registrarVotoFallback(grupo1, "POLL_EMP", "voter1@lid", [computeOptionHash("R$ 200")]);
// Simular timestamp posterior para voter2
const db = JSON.parse(fs.readFileSync(LEILOES_PATH, "utf8"));
db.sessoes[grupo1].enquetes["POLL_EMP"].votos["voter2@lid"] = {
  opcaoTexto: "R$ 200",
  hashOriginal: computeOptionHash("R$ 200"),
  timestamp: Date.now() + 5000, // 5 segundos depois
};
fs.writeFileSync(LEILOES_PATH, JSON.stringify(db, null, 2));

const dadosEmp = encerrarSessao(grupo1, "Teste");
assert(dadosEmp.resultados[0].vencedorJid === "voter1@lid", "Primeiro a votar vence no empate");

// ============================================================
// TESTE 12: Múltiplas enquetes com mesmo comprador
// ============================================================
console.log("\n📋 TESTE 12: Mesmo comprador em múltiplas enquetes");
console.log("─────────────────────────────────");
resetData();

iniciarSessao(grupo1, admin1);
registrarEnquete(grupo1, "POLL_M1", "Item A", ["R$ 10", "R$ 20"]);
registrarEnquete(grupo1, "POLL_M2", "Item B", ["R$ 30", "R$ 40"]);
registrarEnquete(grupo1, "POLL_M3", "Item C", ["R$ 50", "R$ 60"]);

registrarVotoFallback(grupo1, "POLL_M1", "comprador@lid", [computeOptionHash("R$ 20")]);
registrarVotoFallback(grupo1, "POLL_M2", "comprador@lid", [computeOptionHash("R$ 40")]);
registrarVotoFallback(grupo1, "POLL_M3", "comprador@lid", [computeOptionHash("R$ 60")]);

const dadosMulti = encerrarSessao(grupo1, "Teste");
assert(Object.keys(dadosMulti.comprasPorPessoa).length === 1, "1 comprador consolidado");
assert(dadosMulti.comprasPorPessoa["comprador@lid"].itens.length === 3, "3 itens para o mesmo comprador");
assert(dadosMulti.comprasPorPessoa["comprador@lid"].total === 120, "Total R$ 120");

const relMulti = gerarRelatorioComprador("comprador@lid", dadosMulti.comprasPorPessoa["comprador@lid"], "Teste", "Pix aqui!");
assert(relMulti.includes("1. Item A — R$ 20"), "Item A no relatório");
assert(relMulti.includes("2. Item B — R$ 40"), "Item B no relatório");
assert(relMulti.includes("3. Item C — R$ 60"), "Item C no relatório");
assert(relMulti.includes("R$ 120,00"), "Total R$ 120,00");
assert(relMulti.includes("Pix aqui!"), "Mensagem personalizada");

// ============================================================
// TESTE 13: getConfigLeilao
// ============================================================
console.log("\n📋 TESTE 13: getConfigLeilao");
console.log("─────────────────────────────────");

setMsgPagamento(grupo1, "Teste config");
const config = getConfigLeilao(grupo1);
assert(config.msgPagamento === "Teste config", "Config retorna msgPagamento");

const configVazio = getConfigLeilao("inexistente@g.us");
assert(Object.keys(configVazio).length === 0, "Config inexistente retorna objeto vazio");

// ============================================================
// RESULTADO FINAL
// ============================================================
console.log("\n═══════════════════════════════════════════");
console.log(`   RESULTADO: ${passed} PASSOU | ${failed} FALHOU`);
console.log("═══════════════════════════════════════════");

if (failed > 0) {
  console.log("❌ ALGUNS TESTES FALHARAM!");
  process.exit(1);
} else {
  console.log("✅ TODOS OS TESTES PASSARAM! Sistema pronto para deploy.");
}
