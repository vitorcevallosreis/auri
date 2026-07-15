import { supabase } from "./lib/supabase/config";
import SUPA_TABLES from "./contexts/supa_tables";

// Função para testar o acesso a uma tabela no schema 'nexa'
async function testSchemaAccess() {
  console.log("Testando acesso ao schema 'nexa'...");
  
  try {
    // Tentar acessar a tabela de assistentes
    const { data: assistants, error: assistantsError } = await supabase
      .from(SUPA_TABLES.table_assistants)
      .select("id, nome")
      .limit(5);
    
    console.log("Resultado da consulta a assistentes:");
    if (assistantsError) {
      console.error("Erro ao acessar assistentes:", assistantsError);
    } else {
      console.log("Sucesso! Assistentes encontrados:", assistants?.length || 0);
      console.log(assistants);
    }
    
    // Tentar acessar a tabela de canais
    const { data: channels, error: channelsError } = await supabase
      .from(SUPA_TABLES.table_myia_channels)
      .select("id, nome, status")
      .limit(5);
    
    console.log("\nResultado da consulta a canais:");
    if (channelsError) {
      console.error("Erro ao acessar canais:", channelsError);
    } else {
      console.log("Sucesso! Canais encontrados:", channels?.length || 0);
      console.log(channels);
    }
    
    // Tentar acessar a tabela de empresas
    const { data: companies, error: companiesError } = await supabase
      .from(SUPA_TABLES.table_companies)
      .select("id, nome")
      .limit(5);
    
    console.log("\nResultado da consulta a empresas:");
    if (companiesError) {
      console.error("Erro ao acessar empresas:", companiesError);
    } else {
      console.log("Sucesso! Empresas encontradas:", companies?.length || 0);
      console.log(companies);
    }
    
    return !assistantsError && !channelsError && !companiesError;
  } catch (error) {
    console.error("Erro durante o teste:", error);
    return false;
  }
}

// Executar o teste
testSchemaAccess()
  .then(success => {
    console.log("\n=== Resultado do teste ===");
    if (success) {
      console.log("✅ Todas as consultas foram bem-sucedidas! O schema 'nexa' está acessível.");
    } else {
      console.log("❌ Houve erros ao acessar o schema 'nexa'. Verifique os logs acima.");
    }
  })
  .catch(error => {
    console.error("Erro ao executar o teste:", error);
  });
