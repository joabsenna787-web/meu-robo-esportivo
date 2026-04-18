const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const API_KEY = "5d5cb83a4f064d642aff51dcd0fbd466f6f621880b42cfdf4fad77f7a63455d2";
const BASE_URL = "https://apiv2.allsportsapi.com/football/";

app.get("/ao-vivo", async (req, res) => {
    try {
        console.log("📡 Scanner: Executando busca de alta cobertura...");

        // 1. Buscamos um range de 3 dias para garantir que a lista venha cheia
        const dataHj = new Date();
        const dataAmanha = new Date(dataHj.getTime() + (24 * 3600 * 1000));
        
        const from = dataHj.toISOString().split('T')[0];
        const to = dataAmanha.toISOString().split('T')[0];

        // Tentamos o método Fixtures que é mais estável que o Livescore no plano Free
        const url = `${BASE_URL}?met=Fixtures&APIkey=${API_KEY}&from=${from}&to=${to}`;
        const resp = await axios.get(url);
        
        const partidasOriginal = resp.data.result || [];

        const partidasFormatadas = partidasOriginal.map(j => {
            // Extração inteligente do placar
            let homeG = 0; let awayG = 0;
            const placarStr = j.event_final_result || j.event_ft_result || "0 - 0";
            if (placarStr.includes('-')) {
                const parts = placarStr.split('-');
                homeG = parts[0].trim();
                awayG = parts[1].trim();
            }

            return {
                fixture: {
                    status: {
                        elapsed: parseInt(j.event_time) || 0,
                        short: j.event_status || 'NS'
                    }
                },
                league: { name: j.league_name || "Competição" },
                teams: {
                    home: { name: j.event_home_team },
                    away: { name: j.event_away_team }
                },
                goals: { home: homeG, away: awayG }
            };
        });

        // Coloca os jogos que têm algum placar ou tempo rolando no topo
        partidasFormatadas.sort((a, b) => (b.fixture.status.elapsed > 0) ? 1 : -1);

        console.log(`✅ Sucesso: ${partidasFormatadas.length} partidas sincronizadas.`);
        res.json(partidasFormatadas);

    } catch (e) {
        console.error("❌ Erro de Sincronização:", e.message);
        res.status(200).json([]); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`---`);
    console.log(`🚀 TERMINAL FUTEXCHANGE V3`);
    console.log(`📡 STATUS: DADOS RECEBIDOS COM SUCESSO`);
    console.log(`---`);
});
