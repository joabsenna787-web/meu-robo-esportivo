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
        const nocache = Date.now();
        // Usamos LET para permitir que a variável seja sobrescrita se o ao-vivo falhar
        let partidasOriginal = [];
        
        console.log("📡 Scanner: Solicitando atualização via AllSports...");

        // 1. Tentativa via Livescore
        const resp = await axios.get(`${BASE_URL}?met=Livescore&APIkey=${API_KEY}&_=${nocache}`, {
            timeout: 12000
        });

        partidasOriginal = resp.data.result || [];

        // 2. Se o Livescore vier vazio (comum em algumas ligas Free), busca via Fixtures do dia
        if (partidasOriginal.length === 0) {
            console.log("🔍 Livescore vazio, buscando agenda do dia...");
            const hoje = new Date().toISOString().split('T')[0];
            const respAlt = await axios.get(`${BASE_URL}?met=Fixtures&APIkey=${API_KEY}&from=${hoje}&to=${hoje}&_=${nocache}`);
            partidasOriginal = respAlt.data.result || [];
        }

        const partidasFormatadas = partidasOriginal.map(j => {
            let homeG = 0; let awayG = 0;
            const placarStr = j.event_final_result || j.event_ft_result || "0 - 0";
            
            if (placarStr.includes('-')) {
                const parts = placarStr.split('-');
                homeG = parts[0].trim();
                awayG = parts[1].trim();
            }

            // Tratamento especial para o tempo: se estiver vazio ou "Finished", tratamos como 0 ou 90
            let tempoAtual = parseInt(j.event_time);
            if (isNaN(tempoAtual)) {
                tempoAtual = (j.event_status === 'Finished') ? 90 : 0;
            }

            return {
                fixture: {
                    status: {
                        elapsed: tempoAtual,
                        short: j.event_status || 'LIVE'
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

        // Ordenação: Jogos com tempo maior (Live) no topo
        partidasFormatadas.sort((a, b) => b.fixture.status.elapsed - a.fixture.status.elapsed);

        res.set('Cache-Control', 'no-store');
        console.log(`✅ Sincronizado: ${partidasFormatadas.length} partidas.`);
        res.json(partidasFormatadas);

    } catch (e) {
        console.error("❌ Erro de Sincronização:", e.message);
        res.status(200).json([]); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 TERMINAL SYNC OPERACIONAL | PORTA ${PORT}`));
