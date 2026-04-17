const express = require("express");
const axios = require("axios");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- SUAS 4 CHAVES ---
const MINHAS_CHAVES = [
    "436750b6150d5db8d6158516cb2acb40", 
    "d1b404d28502c3e36310dfc09ae249b5", 
    "c8c6ed13166be5f8eb35a14ec614a008",
    "436750b6150d5db8d6158516cb2acb40"
];

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const BASE_URL = "https://v3.football.api-sports.io";

const bot = new TelegramBot(TOKEN, { polling: true });

// Silenciador de erro 409 (Conflito da Render)
bot.on("polling_error", (err) => { if (!err.message.includes("409")) console.log(err.message); });

let chaveAtualIndex = 0;
function getChaveAtiva() { return MINHAS_CHAVES[chaveAtualIndex]; }

// ROTA QUE FORÇA OS JOGOS A APARECEREM
app.get("/ao-vivo", async (req, res) => {
    try {
        // 1. Tenta buscar AO VIVO
        let resp = await axios.get(`${BASE_URL}/fixtures?live=all&timezone=America/Sao_Paulo`, {
            headers: { 'x-apisports-key': getChaveAtiva() }
        });

        // 2. Se estiver vazio (como agora), busca os jogos de HOJE para testar o painel
        if (!resp.data.response || resp.data.response.length === 0) {
            console.log("🔍 Sem jogos ao vivo. Buscando agenda do dia para testar painel...");
            const hoje = new Date().toISOString().split('T')[0];
            resp = await axios.get(`${BASE_URL}/fixtures?date=${hoje}&timezone=America/Sao_Paulo`, {
                headers: { 'x-apisports-key': getChaveAtiva() }
            });
        }

        console.log(`📡 Scanner: ${resp.data.results} partidas processadas.`);
        res.json(resp.data.response || []);
    } catch (e) {
        chaveAtualIndex = (chaveAtualIndex + 1) % MINHAS_CHAVES.length;
        res.status(500).json([]);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 TERMINAL OPERACIONAL | BANCA: USD 6.30`));
