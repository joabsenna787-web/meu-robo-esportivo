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
        // Adicionamos um timestamp para evitar cache do servidor da API
        const nocache = Date.now();
        const url = `${BASE_URL}?met=Livescore&APIkey=${API_KEY}&_=${nocache}`;
        
        console.log("📡 Scanner: Solicitando atualização em tempo real...");

        const resp = await axios.get(url, {
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
            timeout: 15000
        });

        const partidasOriginal = resp.data.result || [];

        // Se o Livescore vier vazio ou travado, tentamos buscar via Fixtures do dia
        if (partidasOriginal.length === 0) {
            const hoje = new Date().toISOString().split('T')[0];
            const urlAlt = `${BASE_URL}?met=Fixtures&APIkey=${API_KEY}&from=${hoje}&to=${hoje}&_=${nocache}`;
            const respAlt = await axios.get(urlAlt);
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

            return {
                fixture: {
                    status: {
                        // Se event_time for "Finished" ou vazio, marcamos como encerrado
                        elapsed: parseInt(j.event_time) || 0,
                        short: j.event_status || 'LIVE'
                    }
                },
                league: { name: j.league_name },
                teams: {
                    home: { name: j.event_home_team },
                    away: { name: j.event_away_team }
                },
                goals: { home: homeG, away: awayG }
            };
        });

        // Ordenação: Jogos com tempo maior que 0 primeiro
        partidasFormatadas.sort((a, b) => b.fixture.status.elapsed - a.fixture.status.elapsed);

        res.set('Cache-Control', 'no-store'); // Garante que o navegador não cacheie o 0-0
        console.log(`✅ Update: ${partidasFormatadas.length} jogos sincronizados.`);
        res.json(partidasFormatadas);

    } catch (e) {
        console.error("❌ Erro de Sincronização:", e.message);
        res.status(200).json([]); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 TERMINAL SYNC ACTIVE | PORTA ${PORT}`));
