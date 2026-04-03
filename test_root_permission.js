import { idsMatch, atualizarMapeamento } from "./src/utils/userMapper.js";

// Simular IDs do Fernando
const FERNANDO_LID = "65060886032554";
const FERNANDO_PN = "554792671477";
const OUTRO_ID = "1234567890";

console.log("🧪 TESTE DE PERMISSÃO ROOT (FERNANDO)\n");

// Teste 1: Igualdade direta (LID)
console.log(`1. Match LID direto: ${idsMatch(FERNANDO_LID, FERNANDO_LID) ? "✅ OK" : "❌ FALHOU"}`);

// Teste 2: Igualdade direta (PN)
console.log(`2. Match PN direto: ${idsMatch(FERNANDO_PN, FERNANDO_PN) ? "✅ OK" : "❌ FALHOU"}`);

// Teste 3: Match entre LID e PN (via Hardcoded)
console.log(`3. Match LID vs PN (Hardcoded): ${idsMatch(FERNANDO_LID, FERNANDO_PN) ? "✅ OK" : "❌ FALHOU"}`);

// Teste 4: Match entre PN e LID (via Hardcoded)
console.log(`4. Match PN vs LID (Hardcoded): ${idsMatch(FERNANDO_PN, FERNANDO_LID) ? "✅ OK" : "❌ FALHOU"}`);

// Teste 5: Match com ROOT do ENV (simulado)
process.env.ROOT_ID = FERNANDO_LID;
console.log(`5. Match PN vs ENV ROOT: ${idsMatch(FERNANDO_PN, process.env.ROOT_ID) ? "✅ OK" : "❌ FALHOU"}`);

// Teste 6: Não match com outro ID
console.log(`6. Não match com estranho: ${!idsMatch(FERNANDO_LID, OUTRO_ID) ? "✅ OK" : "❌ FALHOU"}`);

// Teste 7: Mapeamento dinâmico
atualizarMapeamento("999999999", "888888888");
console.log(`7. Match via Mapeamento Dinâmico: ${idsMatch("999999999", "888888888") ? "✅ OK" : "❌ FALHOU"}`);

console.log("\n🚀 Todos os testes de lógica de permissão concluídos!");
