const express = require("express");
const axios = require("axios");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- CONFIGURAÇÕES DO SISTEMA MULTI-CHAVES ---
const MINHAS_CHAVES = [
    process.env.API_KEY, 
    "d1b404d28502c3e36310dfc09ae249b5", 
    "436750b6150d5db8d6158516cb2acb40", 
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
    console.log(`⚠️ SISTEMA: Trocando para a chave reserva ${chaveAtualIndex + 1}`);
}

function calcularPressao(stats) {
    if (!stats) return 0;
    const get = n => parseInt(stats.find(s => s.type === n)?.value) || 0;
    return (get("Shots on Goal") * 5) + (get("Dangerous Attacks") * 0.7) + (get("Corner Kicks") * 3);
}

app.get("/ao-vivo", async (req, res) => {
    try {
        const resp = await axios.get(`${BASE_URL}/fixtures`, {
            headers: { "x-apisports-key": getChaveAtiva() },
            params: { live: "all" }
        });
        if (resp.headers['x-ratelimit-requests-remaining'] === "0") rotacionarChave();
        res.json(resp.data.response || []);
    } catch (e) {
        rotacionarChave();
        res.status(500).json({ erro: "API em rotação..." });
    }
});

async function verificarJogos() {
    console.log(`📡 Analisando HT (15'-30') com Chave ${chaveAtualIndex + 1}...`);
    try {
        const resp = await axios.get(`${BASE_URL}/fixtures`, {
            headers: { "x-apisports-key": getChaveAtiva() },
            params: { live: "all" }
        });

        const jogos = resp.data.response;
        if (!jogos) return;

        for (let j of jogos) {
            if (enviados.has(j.fixture.id)) continue;

            const stResp = await axios.get(`${BASE_URL}/fixtures/statistics`, {
                headers: { "x-apisports-key": getChaveAtiva() },
                params: { fixture: j.fixture.id }
            });

            const stats = stResp.data.response;
            if (stats && stats.length >= 2) {
                const pCasa = calcularPressao(stats[0].statistics);
                const pFora = calcularPressao(stats[1].statistics);
                const tempo = j.fixture.status.elapsed;

                // NOVA REGRA: Pressão > 45 E tempo entre 15 e 30 minutos
                if ((pCasa > 45 || pFora > 45) && tempo >= 15 && tempo <= 30) {
                    const timeForte = pCasa > pFora ? j.teams.home.name : j.teams.away.name;
                    const msg = `🔥 **OPORTUNIDADE GOL HT!**\n\n🏟 ${j.teams.home.name} x ${j.teams.away.name}\n⚽ Placar: ${j.goals.home}-${j.goals.away}\n⏱ Tempo: ${tempo}' min\n⚡ Pressão: ${Math.max(pCasa, pFora).toFixed(0)} APPI\n\n🎯 *Foco: Gol antes do intervalo!*`;
                    
                    bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' });
                    enviados.add(j.fixture.id);
                }
            }
        }
    } catch (e) { rotacionarChave(); }
}

setInterval(verificarJogos, 120000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Scanner HT Ativado!`));
