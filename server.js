const express = require("express");
const axios = require("axios");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- CHAVES ATIVAS (Chave suspensa removida) ---
const MINHAS_CHAVES = [
    "436750b6150d5db8d6158516cb2acb40", 
    "d1b404d28502c3e36310dfc09ae249b5", 
    "c8c6ed13166be5f8eb35a14ec614a008"
];

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const BASE_URL = "https://v3.football.api-sports.io";

// Inicialização do Bot com tratamento de erro de polling
const bot = new TelegramBot(TOKEN, { polling: true });
bot.on("polling_error", (err) => { 
    if (!err.message.includes("409")) console.log("Erro Telegram:", err.message); 
});

let chaveAtualIndex = 0;
function getChaveAtiva() { return MINHAS_CHAVES[chaveAtualIndex]; }

// ROTA PRINCIPAL: SCANNER AO VIVO
app.get("/ao-vivo", async (req, res) => {
    const chave = getChaveAtiva();
    
    try {
        // 1. Tenta buscar jogos AO VIVO
        let resp = await axios.get(`${BASE_URL}/fixtures?live=all`, {
            headers: { 
                'x-apisports-key': chave,
                'x-rapidapi-host': 'v3.football.api-sports.io'
            },
            timeout: 10000 // Timeout de 10 segundos para não travar o server
        });

        let partidas = resp.data.response || [];

        // 2. Se não houver jogos ao vivo agora, busca a agenda de HOJE
        if (partidas.length === 0) {
            console.log("🔍 Sem jogos ao vivo. Buscando agenda do dia...");
            const hoje = new Date().toISOString().split('T')[0];
            const respAgenda = await axios.get(`${BASE_URL}/fixtures?date=${hoje}`, {
                headers: { 'x-apisports-key': chave }
            });
            partidas = respAgenda.data.response || [];
        }

        console.log(`📡 Scanner: ${partidas.length} partidas processadas | Chave Index: [${chaveAtualIndex}]`);
        res.json(partidas);

    } catch (e) {
        console.error("⚠️ Falha na chave atual. Rotacionando...");
        
        // Se a chave deu erro (suspensa, limite ou timeout), pula para a próxima
        chaveAtualIndex = (chaveAtualIndex + 1) % MINHAS_CHAVES.length;
        
        // Retorna vazio para o frontend tentar novamente no próximo ciclo
        res.status(200).json([]); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`---`);
    console.log(`🚀 TERMINAL OPERACIONAL ATIVO`);
    console.log(`💰 BANCA ATUAL: USD 6.30`);
    console.log(`🔑 RODÍZIO ATIVO: ${MINHAS_CHAVES.length} chaves disponíveis`);
    console.log(`---`);
});
