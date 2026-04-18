const express = require("express");
const axios = require("axios");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- CONFIGURAÇÃO DE CHAVES (Chave suspensa removida) ---
const MINHAS_CHAVES = [
    "436750b6150d5db8d6158516cb2acb40", 
    "d1b404d28502c3e36310dfc09ae249b5", 
    "c8c6ed13166be5f8eb35a14ec614a008"
];

const TOKEN = process.env.TELEGRAM_TOKEN;
const BASE_URL = "https://v3.football.api-sports.io";

// Inicialização do Bot Telegram
const bot = new TelegramBot(TOKEN || "DUMMY_TOKEN", { polling: (!!TOKEN) });
bot.on("polling_error", (err) => { 
    if (!err.message.includes("409")) console.log("Erro Telegram:", err.message); 
});

let chaveAtualIndex = 0;
function getChaveAtiva() { return MINHAS_CHAVES[chaveAtualIndex]; }

// ROTA DO SCANNER
app.get("/ao-vivo", async (req, res) => {
    const chave = getChaveAtiva();
    
    try {
        // 1. Tenta buscar jogos AO VIVO primeiro
        let resp = await axios.get(`${BASE_URL}/fixtures?live=all`, {
            headers: { 
                'x-apisports-key': chave,
                'x-rapidapi-host': 'v3.football.api-sports.io'
            },
            timeout: 12000 
        });

        let partidas = resp.data.response || [];

        // 2. Se não houver jogos ao vivo, busca a agenda do dia com ajuste de Fuso
        if (partidas.length === 0) {
            const agora = new Date();
            // Ajuste manual para UTC-3 (Horário de Brasília)
            const offset = -3; 
            const dataBrasil = new Date(agora.getTime() + (offset * 3600 * 1000));
            const hojeFormatado = dataBrasil.toISOString().split('T')[0];

            console.log(`🔍 Sem jogos ao vivo. Buscando agenda para: ${hojeFormatado}`);
            
            const respAgenda = await axios.get(`${BASE_URL}/fixtures?date=${hojeFormatado}`, {
                headers: { 'x-apisports-key': chave }
            });
            partidas = respAgenda.data.response || [];
        }

        console.log(`📡 Scanner: ${partidas.length} partidas processadas | Chave Index: [${chaveAtualIndex}]`);
        res.json(partidas);

    } catch (e) {
        console.error("⚠️ Erro na requisição. Rotacionando chave...");
        
        // Em caso de erro 429 (Limite) ou 403 (Chave inválida), pula para a próxima
        chaveAtualIndex = (chaveAtualIndex + 1) % MINHAS_CHAVES.length;
        
        // Retorna lista vazia para o frontend não quebrar
        res.status(200).json([]); 
    }
});

// Inicialização
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`---`);
    console.log(`🚀 TERMINAL FUTEXCHANGE OPERACIONAL`);
    console.log(`💰 BANCA: USD 6.30`);
    console.log(`🔑 CHAVES ATIVAS: ${MINHAS_CHAVES.length}`);
    console.log(`📅 DATA DO SISTEMA: ${new Date().toLocaleString('pt-BR')}`);
    console.log(`---`);
});
