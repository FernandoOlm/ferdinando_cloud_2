// ============================================================
// test_all_commands.js — Validação de assinaturas e imports de TODOS os comandos
// ============================================================

import fs from "fs";
import path from "path";

const COMANDOS_PATH = path.resolve("src/data/comandos.json");
const comandosJSON = JSON.parse(fs.readFileSync(COMANDOS_PATH, "utf8"));

let total = 0;
let ok = 0;
let erros = [];

console.log("🔍 AUDITORIA DE TODOS OS COMANDOS REGISTRADOS\n");
console.log("━".repeat(60));

for (const [cmd, cfg] of Object.entries(comandosJSON)) {
  total++;
  const filePath = cfg.file.replace("../", "src/");
  const funcName = cfg.function;
  
  try {
    // Verificar se o arquivo existe
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      erros.push(`❌ ${cmd}: Arquivo não encontrado: ${filePath}`);
      continue;
    }
    
    // Importar o módulo
    const modulo = await import(`./${filePath}`);
    
    // Verificar se a função existe
    if (!modulo[funcName]) {
      erros.push(`❌ ${cmd}: Função "${funcName}" não encontrada em ${filePath}`);
      continue;
    }
    
    const fn = modulo[funcName];
    
    // Verificar se é uma função
    if (typeof fn !== "function") {
      erros.push(`❌ ${cmd}: "${funcName}" não é uma função`);
      continue;
    }
    
    // Verificar número de parâmetros
    // O dispatcher chama: fn(msg, sock, fromClean, args)
    // Funções podem ter 1-4 params (JS não obriga todos)
    const paramCount = fn.length;
    
    // Verificar se a assinatura é compatível
    // Funções com 1-2 params são OK (ignoram extras)
    // Funções com 3 params: o 2º DEVE ser sock, não fromClean
    // Funções com 4 params: padrão completo
    
    let status = "✅";
    let nota = `${paramCount} params`;
    
    // Ler o código-fonte para verificar a assinatura real
    const source = fs.readFileSync(fullPath, "utf8");
    const funcRegex = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${funcName}\\s*\\(([^)]*)`);
    const match = source.match(funcRegex);
    
    if (match) {
      const params = match[1].split(",").map(p => p.trim()).filter(Boolean);
      nota = params.join(", ");
      
      // Verificar se o 2º param é sock (não fromClean)
      if (params.length >= 3) {
        const secondParam = params[1].toLowerCase();
        if (secondParam.includes("from") || secondParam.includes("clean") || secondParam.includes("texto")) {
          status = "⚠️";
          nota += " [FALTA SOCK como 2º param!]";
          erros.push(`⚠️ ${cmd}: Assinatura incompatível - ${funcName}(${params.join(", ")}) - falta sock como 2º param`);
        }
      }
    }
    
    console.log(`${status} ${cmd.padEnd(25)} → ${funcName.padEnd(30)} (${nota})`);
    if (status === "✅") ok++;
    
  } catch (e) {
    erros.push(`❌ ${cmd}: Erro ao importar: ${e.message}`);
    console.log(`❌ ${cmd.padEnd(25)} → ERRO: ${e.message}`);
  }
}

console.log("\n" + "━".repeat(60));
console.log(`\n📊 RESULTADO: ${ok}/${total} comandos OK`);

if (erros.length > 0) {
  console.log(`\n⚠️ PROBLEMAS ENCONTRADOS (${erros.length}):`);
  for (const e of erros) {
    console.log(`  ${e}`);
  }
} else {
  console.log("\n✅ Todos os comandos estão com assinaturas compatíveis!");
}

// ============================================================
// TESTE ESPECÍFICO: clawBrain.js
// ============================================================
console.log("\n" + "━".repeat(60));
console.log("\n🧠 TESTE DO clawBrain.js\n");

const { clawBrainProcess_Unique01 } = await import("./src/core/clawBrain.js");

// Teste 1: Comando com status ok sem mensagem → deve retornar null
const r1 = await clawBrainProcess_Unique01({ tipo: "comando", comando: "all", dados: { status: "ok", tipo: "all", totalMembros: 10 } });
console.log(`  Teste 1 (status ok sem msg): ${r1 === null ? "✅ null" : `❌ "${r1}"`}`);

// Teste 2: Comando com status erro e motivo mapeado
const r2 = await clawBrainProcess_Unique01({ tipo: "comando", comando: "all", dados: { status: "erro", motivo: "nao_autorizado" } });
console.log(`  Teste 2 (erro nao_autorizado): ${r2.includes("autorizado") ? "✅" : "❌"} "${r2}"`);

// Teste 3: Comando com status erro e motivo grupo_sem_autorizacao
const r3 = await clawBrainProcess_Unique01({ tipo: "comando", comando: "all", dados: { status: "erro", motivo: "grupo_sem_autorizacao" } });
console.log(`  Teste 3 (grupo_sem_autorizacao): ${r3.includes("grupo") ? "✅" : "❌"} "${r3}"`);

// Teste 4: Comando com status erro e motivo mensagem_vazia
const r4 = await clawBrainProcess_Unique01({ tipo: "comando", comando: "cadastro-all", dados: { status: "erro", motivo: "mensagem_vazia" } });
console.log(`  Teste 4 (mensagem_vazia): ${r4.includes("mensagem") ? "✅" : "❌"} "${r4}"`);

// Teste 5: Comando com mensagem direta
const r5 = await clawBrainProcess_Unique01({ tipo: "comando", comando: "cadastro-all", dados: { status: "ok", mensagem: "Mensagem do !all atualizada" } });
console.log(`  Teste 5 (ok com mensagem): ${r5.includes("atualizada") ? "✅" : "❌"} "${r5}"`);

// Teste 6: Comando com status erro e motivo nao_root
const r6 = await clawBrainProcess_Unique01({ tipo: "comando", comando: "autorizar", dados: { status: "erro", motivo: "nao_root" } });
console.log(`  Teste 6 (nao_root): ${r6.includes("administrador") ? "✅" : "❌"} "${r6}"`);

console.log("\n✅ Auditoria completa!");
