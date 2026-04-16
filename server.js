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
    process.env.API_KEY, // Mantém a chave que você já colocou na Render
    "d1b404d28502c3e36310dfc09ae249b5", // Chave Nova 1
    "436750b6150d5db8d6158516cb2acb40", // Chave Nova 2
    "c8c6ed13166be5f8eb35a14ec614a008"  // Chave Nova 3
];

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const BASE_URL = "https://v3.football.api-sports.io";

const bot = new TelegramBot(TOKEN, { polling: true });
let chaveAtualIndex = 0;
let enviados = new Set();

// Função para pegar a chave ativa
function getChaveAtiva() {
    return MINHAS_CHAVES[chaveAtualIndex];
}

// Função para rotacionar a chave se o limite acabar ou der erro
function rotacionarChave() {
    chaveAtualIndex = (chaveAtualIndex + 1) % MINHAS_CHAVES.length;
    console.log(`⚠️ SISTEMA: Trocando para a chave reserva ${chaveAtualIndex + 1}`);
}

function calcularPressao(stats) {
    if (!stats) return 0;
    const get = n => parseInt(stats.find(s => s.type === n)?.value) || 0;
    // Fórmula de Pressão APPI
    return (get("Shots on Goal") * 5) + (get("Dangerous Attacks") * 0.7) + (get("Corner Kicks") * 3);
}

// Rota para o Painel Web
app.get("/ao-vivo", async (req, res) => {
    try {
        const resp = await axios.get(`${BASE_URL}/fixtures`, {
            headers: { "x-apisports-key": getChaveAtiva() },
            params: { live: "all" }
        });

        // Se os créditos dessa chave acabarem, avisa para trocar na próxima
        if (resp.headers['x-ratelimit-requests-remaining'] === "0") {
            rotacionarChave();
        }

        res.json(resp.data.response || []);
    } catch (e) {
        rotacionarChave();
        res.status(500).json({ erro: "API em rotação..." });
    }
});

// Lógica de Monitoramento do Robô
async function verificarJogos() {
    console.log(`📡 Verificando oportunidades com a Chave ${chaveAtualIndex + 1}...`);
    try {
        const resp = await axios.get(`${BASE_URL}/fixtures`, {
            headers: { "x-apisports-key": getChaveAtiva() },
            params: { live: "all" }
        });

        const jogos = resp.data.response;
        if (!jogos || jogos.length === 0) return;

        for (let j of jogos) {
            // Se já enviou alerta desse jogo, pula
            if (enviados.has(j.fixture.id)) continue;

            // Busca estatísticas detalhadas do jogo
            const stResp = await axios.get(`${BASE_URL}/fixtures/statistics`, {
                headers: { "x-apisports-key": getChaveAtiva() },
                params: { fixture: j.fixture.id }
            });

            const stats = stResp.data.response;
            if (stats && stats.length >= 2) {
                const pCasa = calcularPressao(stats[0].statistics);
                const pFora = calcularPressao(stats[1].statistics);
                const tempo = j.fixture.status.elapsed;

                // CRITÉRIO: Pressão > 45 APPI e tempo entre 15 e 85 minutos
                if ((pCasa > 45 || pFora > 45) && tempo > 15 && tempo < 85) {
                    const timeForte = pCasa > pFora ? j.teams.home.name : j.teams.away.name;
                    const msg = `🚀 **GOL IMINENTE!**\n\n🏟 ${j.teams.home.name} x ${j.teams.away.name}\n⚽ Placar: ${j.goals.home}-${j.goals.away}\n⏱ Tempo: ${tempo}'\n🔥 Pressão: ${Math.max(pCasa, pFora).toFixed(0)} APPI no ${timeForte}`;
                    
                    bot.sendMessage(CHAT_ID, msg, { parse_mode: 'Markdown' });
                    enviados.add(j.fixture.id);
                }
            }
        }
    } catch (e) {
        console.log("Erro no bot, tentando nova chave...");
        rotacionarChave();
    }
}

// Com 4 chaves, podemos verificar a cada 2 minutos (120000ms) com segurança
setInterval(verificarJogos, 120000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 FutExchange Multi-Key Ativo!`);
    console.log(`Monitorando com ${MINHAS_CHAVES.length} chaves.`);
});
