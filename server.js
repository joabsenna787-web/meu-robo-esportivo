const express = require("express");
const axios = require("axios");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- CONFIGURAÇÕES DO SISTEMA MULTI-CHAVES (CONFIGURADAS) ---
const MINHAS_CHAVES = [
    "436750b6150d5db8d6158516cb2acb40", // Sua chave principal
    "d1b404d28502c3e36310dfc09ae249b5", // Reserva 1
    "436750b6150d5db8d6158516cb2acb40", // Reserva 2
    "c8c6ed13166be5f8eb35a14ec614a008"  // Reserva 3
];

// Configurações vindas do ambiente da Render
const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const BASE_URL = "https://v3.football.api-sports.io";

const bot = new TelegramBot(TOKEN, { polling: true });
let chaveAtualIndex = 0;
let enviados = new Set();

function getChaveAtiva() { 
    return MINHAS_CHAVES[chaveAtualIndex]; 
}

function rotacionarChave() {
    chaveAtualIndex = (chaveAtualIndex + 1) % MINHAS_CHAVES.length;
    console.log(`⚠️ ROTATION: Chave reserva ${chaveAtualIndex + 1} ativada.`);
}

function calcularPressao(stats) {
    if (!stats) return 0;
    const get = n => parseInt(stats.find(s => s.type === n)?.value) || 0;
    // Fórmula APPI: (Chutes no gol * 5) + (Ataques Perigosos * 0.7) + (Escanteios * 3)
    return (get("Shots on Goal") * 5) + (get("Dangerous Attacks") * 0.7) + (get("Corner Kicks") * 3);
}

// ROTA DO PAINEL (Mostra todos os jogos ao vivo no seu site)
app.get("/ao-vivo", async (req, res) => {
    try {
        const resp = await axios.get(`${BASE_URL}/fixtures`, {
            headers: { "x-apisports-key": getChaveAtiva() },
            params: { live: "all" }
        });
        
        // Se a chave atual atingir o limite, troca para a próxima
        if (resp.headers['x-ratelimit-requests-remaining'] === "0") rotacionarChave();
        
        res.json(resp.data.response || []);
    } catch (e) {
        rotacionarChave();
        res.status(500).json({ erro: "Reconectando satélite..." });
    }
});

// LÓGICA DE ALERTA NO TELEGRAM (15 a 30 minutos)
async function verificarJogos() {
    console.log(`📡 Scanner Profissional HT | Chave ativa: ${chaveAtualIndex + 1}`);
    try {
        const resp = await axios.get(`${BASE_URL}/fixtures`, {
            headers: { "x-apisports-key": getChaveAtiva() },
            params: { live: "all" }
        });

        const jogos = resp.data.response;
        if (!jogos || jogos.length === 0) return;

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

                // --- CRITÉRIO PARA OVER 0.5 HT ---
                // Se pressão for alta e o jogo estiver entre 15' e 30'
                if ((pCasa > 45 || pFora > 45) && tempo >= 15 && tempo <= 30) {
                    const msg = `🔥 **ALERTA: GOL HT IMINENTE!**\n\n🏟 ${j.teams.home.name} x ${j.teams.away.name}\n⚽ Placar: ${j.goals.home}-${j.goals.away}\n⏱ Tempo: ${tempo}' min\n⚡ Pressão: ${Math.max(pCasa, pFora).toFixed(0)} APPI\n\n🎯 *Estratégia: Over 0.5 HT*`;
                    
                    bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' });
                    enviados.add(j.fixture.id);
                }
            }
        }
    } catch (e) { 
        rotacionarChave(); 
    }
}

// Verifica sinais a cada 2 minutos
setInterval(verificarJogos, 120000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 TERMINAL FUTEXCHANGE OPERACIONAL`));
