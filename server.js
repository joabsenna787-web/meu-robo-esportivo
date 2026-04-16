const express = require("express");
const axios = require("axios");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// As chaves serão puxadas das configurações da Render por segurança
const TOKEN = process.env.TELEGRAM_TOKEN;
const API_KEY = process.env.API_KEY;
const CHAT_ID = process.env.CHAT_ID;
const BASE_URL = "https://v3.football.api-sports.io";

const bot = new TelegramBot(TOKEN, { polling: true });
let enviados = new Set();

function calcularPressao(stats) {
    if (!stats) return 0;
    const get = n => parseInt(stats.find(s => s.type === n)?.value) || 0;
    return (get("Shots on Goal") * 5) + (get("Dangerous Attacks") * 0.7) + (get("Corner Kicks") * 3);
}

// Rota para o Painel buscar os jogos ao vivo
app.get("/ao-vivo", async (req, res) => {
    try {
        const resp = await axios.get(`${BASE_URL}/fixtures`, {
            headers: { "x-apisports-key": API_KEY },
            params: { live: "all" }
        });
        res.json(resp.data.response || []);
    } catch (e) {
        res.status(500).json({ erro: "Erro na API" });
    }
});

// Lógica do Robô que roda sozinho no fundo
async function verificarJogos() {
    console.log("🔄 Verificando rodada...");
    try {
        const resp = await axios.get(`${BASE_URL}/fixtures`, {
            headers: { "x-apisports-key": API_KEY },
            params: { live: "all" }
        });
        const jogos = resp.data.response;

        for (let j of jogos) {
            if (enviados.has(j.fixture.id)) continue;

            const stResp = await axios.get(`${BASE_URL}/fixtures/statistics`, {
                headers: { "x-apisports-key": API_KEY },
                params: { fixture: j.fixture.id }
            });
            const stats = stResp.data.response;

            if (stats && stats.length >= 2) {
                const pCasa = calcularPressao(stats[0].statistics);
                const pFora = calcularPressao(stats[1].statistics);
                const tempo = j.fixture.status.elapsed;

                // Alerta se pressão > 45 entre 15' e 85' minutos
                if ((pCasa > 45 || pFora > 45) && tempo > 15 && tempo < 85) {
                    const msg = `🚀 GOL IMINENTE!\n🏟 ${j.teams.home.name} x ${j.teams.away.name}\n⚽ Placar: ${j.goals.home}-${j.goals.away}\n🔥 Pressão: ${Math.max(pCasa, pFora).toFixed(0)} APPI`;
                    bot.sendMessage(CHAT_ID, msg);
                    enviados.add(j.fixture.id);
                }
            }
        }
    } catch (e) { console.log("Erro no Bot:", e.message); }
}

// Verifica jogos a cada 3 minutos para não gastar sua cota Free rápido demais
setInterval(verificarJogos, 180000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));