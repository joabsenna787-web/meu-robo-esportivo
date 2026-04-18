const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- SUA CHAVE ALLSPORTS ---
const API_KEY = "5d5cb83a4f064d642aff51dcd0fbd466f6f621880b42cfdf4fad77f7a63455d2";
const BASE_URL = "https://apiv2.allsportsapi.com/football/";

app.get("/ao-vivo", async (req, res) => {
    try {
        const nocache = Date.now();
        console.log("📡 Scanner: Executando busca de cobertura total (Pente Fino)...");

        // Buscamos um intervalo de 3 dias para garantir que a API entregue QUALQUER jogo liberado
        const from = "2026-04-17"; 
        const to = "2026-04-19";

        const url = `${BASE_URL}?met=Fixtures&APIkey=${API_KEY}&from=${from}&to=${to}&_=${nocache}`;
        
        const resp = await axios.get(url, { timeout: 15000 });
        
        let partidasOriginal = resp.data.result || [];

        if (partidasOriginal.length === 0) {
            console.log("⚠️ Nenhuma partida disponível para esta chave no plano atual.");
        }

        const partidasFormatadas = partidasOriginal.map(j => {
            let homeG = 0; let awayG = 0;
            const placarStr = j.event_final_result || j.event_ft_result || "0 - 0";
            
            if (placarStr && placarStr.includes('-')) {
                const parts = placarStr.split('-');
                homeG = parts[0] ? parts[0].trim() : 0;
                awayG = parts[1] ? parts[1].trim() : 0;
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

        // Ordena: Jogos em andamento (LIVE) ou com tempo rolando aparecem primeiro
        partidasFormatadas.sort((a, b) => {
            const aLive = a.fixture.status.elapsed > 0 ? 1 : 0;
            const bLive = b.fixture.status.elapsed > 0 ? 1 : 0;
            return bLive - aLive;
        });

        res.set('Cache-Control', 'no-store');
        console.log(`✅ Sincronizado: ${partidasFormatadas.length} partidas encontradas.`);
        res.json(partidasFormatadas);

    } catch (e) {
        console.error("❌ Erro de Sincronização:", e.message);
        res.status(200).json([]); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`---`);
    console.log(`🚀 TERMINAL FUTEXCHANGE V3 OPERACIONAL`);
    console.log(`📊 PORTA: ${PORT}`);
    console.log(`---`);
});
