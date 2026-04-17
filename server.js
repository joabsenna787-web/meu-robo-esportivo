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
    console.log(`⚠️ SISTEMA: Chave reserva ${chaveAtualIndex + 1} ativada.`);
}

function calcularPressao(stats) {
    if (!stats) return 0;
    const get = n => parseInt(stats.find(s => s.type === n)?.value) || 0;
    // Fórmula APPI Profissional
    return (get("Shots on Goal") * 5) + (get("Dangerous Attacks") * 0.7) + (get("Corner Kicks") * 3);
}

// ROTA DO PAINEL (Dados Reais com Fuso Horário de SP)
app.get("/ao-vivo", async (req, res) => {
    try {
        const resp = await axios.get(`${BASE_URL}/fixtures?live=all&timezone=America/Sao_Paulo`, {
            headers: { 'x-apisports-key': getChaveAtiva() }
        });
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
                const stResp = await axios.get(`${BASE_URL}/fixtures/statistics`, {
                    headers: { 'x-apisports-key': getChaveAtiva() },
                    params: { fixture: j.fixture.id }
                });
                const stats = stResp.data.response;
                if (stats && stats.length >= 2) {
                    const pCasa = calcularPressao(stats[0].statistics);
                    const pFora = calcularPressao(stats[1].statistics);
                    if (pCasa > 45 || pFora > 45) {
                        const msg = `🔥 **SINAL HT CONFIRMADO!**\n\n🏟 ${j.teams.home.name} x ${j.teams.away.name}\n⚡ Pressão Max: ${Math.max(pCasa, pFora).toFixed(0)} APPI\n⏱ Tempo: ${tempo}' min\n🎯 *Sugestão: Over 0.5 HT*`;
                        bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' });
                        enviados.add(j.fixture.id);
                    }
                }
            }
        }
    } catch (e) { rotacionarChave(); }
}

setInterval(verificarJogos, 120000);
app.listen(process.env.PORT || 3000);
