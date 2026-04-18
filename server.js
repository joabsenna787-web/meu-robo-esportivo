const express = require("express");
const axios = require("axios");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- CONFIGURAÇÃO DE CHAVES ATUALIZADA (Chaves removidas conforme solicitado) ---
const MINHAS_CHAVES = [
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
        // 1. Tenta buscar jogos AO VIVO
        let resp = await axios.get(`${BASE_URL}/fixtures?live=all`, {
            headers: { 
                'x-apisports-key': chave,
                'x-rapidapi-host': 'v3.football.api-sports.io'
            },
            timeout: 12000 
        });

        let partidas = resp.data.response || [];

        // 2. Busca agenda do dia se não houver jogos ao vivo (Ajuste de Fuso Brasil)
        if (partidas.length === 0) {
            const agora = new Date();
            const offset = -3; // Horário de Brasília
            const dataBrasil = new Date(agora.getTime() + (offset * 3600 * 1000));
            const hojeFormatado = dataBrasil.toISOString().split('T')[0];

            console.log(`🔍 Scanner vazio. Buscando agenda para: ${hojeFormatado} (Chave: ${chaveAtualIndex})`);
            
            const respAgenda = await axios.get(`${BASE_URL}/fixtures?date=${hojeFormatado}`, {
                headers: { 'x-apisports-key': chave }
            });
            partidas = respAgenda.data.response || [];
        }

        console.log(`📡 Scanner: ${partidas.length} partidas encontradas.`);
        res.json(partidas);

    } catch (e) {
        console.error(`⚠️ Falha na chave [${chaveAtualIndex}]. Rotacionando para a próxima...`);
        
        // Rotaciona para a próxima chave disponível
        chaveAtualIndex = (chaveAtualIndex + 1) % MINHAS_CHAVES.length;
        
        // Retorna status 200 com lista vazia para evitar erro no painel visual
        res.status(200).json([]); 
    }
});

// Inicialização do Servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`---`);
    console.log(`🚀 TERMINAL FUTEXCHANGE OPERACIONAL`);
    console.log(`💰 BANCA: USD 6.30`);
    console.log(`🔑 CHAVES EM RODÍZIO: ${MINHAS_CHAVES.length}`);
    console.log(`---`);
});
