const express = require("express");
const axios = require("axios");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- CONFIGURAÇÕES DO SISTEMA ---
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

function calcularPressao(stats) {
    if (!stats || stats.length === 0) return 0;
    const get = n => parseInt(stats.find(s => s.type === n)?.value) || 0;
    return (get("Shots on Goal") * 5) + (get("Dangerous Attacks") * 0.7) + (get("Corner Kicks") * 3);
}

// ROTA DO PAINEL - AJUSTADA PARA FORÇAR RESULTADOS
app.get("/ao-vivo", async (req, res) => {
    try {
        const config = {
            method: 'get',
            url: `${BASE_URL}/fixtures?live=all`,
            headers: { 'x-apisports-key': getChaveAtiva() }
        };
        
        const resp = await axios(config);
        
        // Se a API retornar erro de permissão ou chave, tentamos rotacionar
        if (resp.data.errors && Object.keys(resp.data.errors).length > 0) {
            console.log("Erro na API:", resp.data.errors);
            rotacionarChave();
            return res.json([]);
        }

        console.log(`Jogos encontrados: ${resp.data.results}`);
        res.json(resp.data.response || []);
    } catch (e) {
        rotacionarChave();
        res.status(500).json({ erro: "Sincronizando..." });
    }
});

// LÓGICA TELEGRAM 15'-30'
async function verificarJogos() {
    try {
        const resp = await axios.get(`${BASE_URL}/fixtures?live=all`, {
            headers: { 'x-apisports-key': getChaveAtiva() }
        });

        const jogos = resp.data.response;
        if (!jogos) return;

        for (let j of jogos) {
            const tempo = j.fixture.status.elapsed;
            // FILTRO HT 15-30
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
                        const msg = `🔥 **GOL HT IMINENTE!**\n\n🏟 ${j.teams.home.name} x ${j.teams.away.name}\n⏱ Tempo: ${tempo}' min\n⚡ Pressão: ${Math.max(pCasa, pFora).toFixed(0)} APPI`;
                        bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' });
                        enviados.add(j.fixture.id);
                    }
                }
            }
        }
    } catch (e) { rotacionarChave(); }
}

setInterval(verificarJogos, 120000);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 TERMINAL ONLINE`));
