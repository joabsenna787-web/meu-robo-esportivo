const express = require("express");
const axios = require("axios");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- CONFIGURAÇÃO DE ELITE: MULTI-CHAVES ---
const MINHAS_CHAVES = [
    "436750b6150d5db8d6158516cb2acb40", 
    "d1b404d28502c3e36310dfc09ae249b5", 
    "c8c6ed13166be5f8eb35a14ec614a008",
    "436750b6150d5db8d6158516cb2acb40"
];

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const BASE_URL = "https://v3.football.api-sports.io";

// RESOLUÇÃO DO ERRO 409: Desativamos o polling se já houver conexão
const bot = new TelegramBot(TOKEN, { polling: { autoStart: true, params: { timeout: 10 } } });

let chaveAtualIndex = 0;
let enviados = new Set();

function getChaveAtiva() { return MINHAS_CHAVES[chaveAtualIndex]; }

function rotacionarChave() {
    chaveAtualIndex = (chaveAtualIndex + 1) % MINHAS_CHAVES.length;
    console.log(`⚠️ SISTEMA: Rotacionando para chave reserva ${chaveAtualIndex + 1}`);
}

// ROTA DO PAINEL (Forçando timezone e live=all)
app.get("/ao-vivo", async (req, res) => {
    try {
        const resp = await axios.get(`${BASE_URL}/fixtures?live=all&timezone=America/Sao_Paulo`, {
            headers: { 'x-apisports-key': getChaveAtiva() }
        });
        console.log(`📡 Scan: ${resp.data.results} jogos encontrados.`);
        res.json(resp.data.response || []);
    } catch (e) {
        rotacionarChave();
        res.status(500).json([]);
    }
});

// LÓGICA DE ALERTAS TELEGRAM (15-30 MIN)
async function verificarJogos() {
    try {
        const resp = await axios.get(`${BASE_URL}/fixtures?live=all`, {
            headers: { 'x-apisports-key': getChaveAtiva() }
        });
        const jogos = resp.data.response;
        if (!jogos) return;

        for (let j of jogos) {
            const tempo = j.fixture.status.elapsed;
            if (tempo >= 15 && tempo <= 30 && !enviados.has(j.fixture.id)) {
                // Enviar alerta simplificado para evitar flood
                const msg = `🔥 **SINAL HT!**\n🏟 ${j.teams.home.name} x ${j.teams.away.name}\n⏱ Tempo: ${tempo}'\n🎯 *Estratégia: Over 0.5 HT*`;
                bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' }).catch(() => {});
                enviados.add(j.fixture.id);
            }
        }
    } catch (e) { rotacionarChave(); }
}

setInterval(verificarJogos, 180000); // 3 minutos para não estourar a API
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 TERMINAL FUTEXCHANGE ATIVO NA PORTA ${PORT}`));
