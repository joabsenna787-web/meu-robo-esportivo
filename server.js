const express = require("express");
const axios = require("axios");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- CONFIGURAÇÃO DE CHAVES ATIVAS ---
const MINHAS_CHAVES = [
    "d1b404d28502c3e36310dfc09ae249b5", 
    "c8c6ed13166be5f8eb35a14ec614a008"
];

const TOKEN = process.env.TELEGRAM_TOKEN;
const BASE_URL = "https://v3.football.api-sports.io";

// Inicialização do Bot (Tratamento para não crashar sem Token)
const bot = new TelegramBot(TOKEN || "000:DUMMY", { polling: !!TOKEN });
bot.on("polling_error", (err) => { if (!err.message.includes("409")) console.log("Telegram:", err.message); });

let chaveAtualIndex = 0;
function getChaveAtiva() { return MINHAS_CHAVES[chaveAtualIndex]; }

// ROTA DO SCANNER: BUSCA AMPLA (TESTE DE CONEXÃO)
app.get("/ao-vivo", async (req, res) => {
    const chave = getChaveAtiva();
    
    try {
        // Data de hoje ajustada para o fuso do Brasil (18/04/2026)
        const agora = new Date();
        const dataBrasil = new Date(agora.getTime() + (-3 * 3600 * 1000));
        const hoje = dataBrasil.toISOString().split('T')[0];

        console.log(`\n🔄 Tentando Chave ${chaveAtualIndex} | Data: ${hoje}`);

        // Buscando todos os jogos da data para validar a chave
        const resp = await axios.get(`${BASE_URL}/fixtures?date=${hoje}`, {
            headers: { 
                'x-apisports-key': chave,
                'x-rapidapi-host': 'v3.football.api-sports.io'
            },
            timeout: 10000
        });

        // 1. Verifica se a API retornou erros específicos (como Limite de Requests)
        if (resp.data.errors && Object.keys(resp.data.errors).length > 0) {
            console.error("❌ Resposta da API contém erros:", resp.data.errors);
            // Se o erro for limite, força a rotação de chave
            throw new Error("API_LIMIT_REACHED");
        }

        const partidas = resp.data.response || [];
        
        // 2. Filtro de Segurança: Se não houver nada, tenta buscar 'Live' como última opção
        if (partidas.length === 0) {
            console.log("⚠️ Agenda vazia, tentando buscar apenas jogos AO VIVO...");
            const respLive = await axios.get(`${BASE_URL}/fixtures?live=all`, {
                headers: { 'x-apisports-key': chave }
            });
            const aoVivo = respLive.data.response || [];
            console.log(`📡 Scanner: ${aoVivo.length} partidas AO VIVO encontradas.`);
            return res.json(aoVivo);
        }

        console.log(`📡 Scanner: ${partidas.length} partidas encontradas na agenda.`);
        res.json(partidas);

    } catch (e) {
        console.error(`⚠️ Falha na Chave Index [${chaveAtualIndex}]: ${e.message}`);
        
        // Rotaciona para a próxima chave
        chaveAtualIndex = (chaveAtualIndex + 1) % MINHAS_CHAVES.length;
        
        // Retorna vazio para o painel não travar
        res.status(200).json([]); 
    }
});

// Inicialização
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`---`);
    console.log(`🚀 TERMINAL FUTEXCHANGE V2 OPERACIONAL`);
    console.log(`🔑 RODÍZIO: ${MINHAS_CHAVES.length} CHAVES ATIVAS`);
    console.log(`💰 STATUS: BANCA USD 6.30`);
    console.log(`---`);
});
