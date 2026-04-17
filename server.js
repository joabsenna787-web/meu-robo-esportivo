const express = require("express");
const axios = require("axios");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const MINHAS_CHAVES = [
    "436750b6150d5db8d6158516cb2acb40", 
    "d1b404d28502c3e36310dfc09ae249b5", 
    "c8c6ed13166be5f8eb35a14ec614a008"
];

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const BASE_URL = "https://v3.football.api-sports.io";

const bot = new TelegramBot(TOKEN, { polling: true });
let chaveAtualIndex = 0;
let enviados = new Set();

function getChaveAtiva() { return MINHAS_CHAVES[chaveAtualIndex]; }

function rotacionarChave() {
    chaveAtualIndex = (chaveAtualIndex + 1) % MINHAS_CHAVES.length;
}

app.get("/ao-vivo", async (req, res) => {
    try {
        // Adicionamos o timezone para garantir que ele pegue jogos do nosso horário
        const resp = await axios.get(`${BASE_URL}/fixtures?live=all&timezone=America/Sao_Paulo`, {
            headers: { 'x-apisports-key': getChaveAtiva() }
        });
        
        console.log(`[RADAR] Jogos detectados: ${resp.data.results}`);
        res.json(resp.data.response || []);
    } catch (e) {
        rotacionarChave();
        res.status(500).json([]);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 TERMINAL OPERACIONAL`));
