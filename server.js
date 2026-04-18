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
        // Pegamos a data de hoje no formato YYYY-MM-DD
        const hoje = new Date().toISOString().split('T')[0];
        
        console.log(`📡 Scanner: Buscando todos os jogos de hoje (${hoje})...`);

        // Usamos o método Fixtures com range de hoje para garantir que pegamos TUDO
        const url = `${BASE_URL}?met=Fixtures&APIkey=${API_KEY}&from=${hoje}&to=${hoje}`;
        
        const resp = await axios.get(url);
        const partidasOriginal = resp.data.result || [];

        // Tradução para o formato que seu index.html já reconhece
        const partidasFormatadas = partidasOriginal.map(j => {
            let homeG = 0; 
            let awayG = 0;
            
            // Tratamento de placar para diferentes estados de jogo
            if (j.event_final_result && j.event_final_result.includes('-')) {
                const parts = j.event_final_result.split('-');
                homeG = parts[0].trim();
                awayG = parts[1].trim();
            } else if (j.event_ft_result && j.event_ft_result.includes('-')) {
                const parts = j.event_ft_result.split('-');
                homeG = parts[0].trim();
                awayG = parts[1].trim();
            }

            return {
                fixture: {
                    status: {
                        // AllSports entrega o tempo em event_time (ex: "45" ou "Finished")
                        elapsed: parseInt(j.event_time) || 0,
                        short: j.event_status || 'NS'
                    }
                },
                league: { name: j.league_name },
                teams: {
                    home: { name: j.event_home_team },
                    away: { name: j.event_away_team }
                },
                goals: {
                    home: homeG,
                    away: awayG
                }
            };
        });

        // Ordenar: Colocar os jogos que estão rolando (LIVE) no topo
        partidasFormatadas.sort((a, b) => {
            if (a.fixture.status.short === 'LIVE' && b.fixture.status.short !== 'LIVE') return -1;
            if (a.fixture.status.short !== 'LIVE' && b.fixture.status.short === 'LIVE') return 1;
            return 0;
        });

        console.log(`✅ Sucesso! ${partidasFormatadas.length} partidas encontradas.`);
        res.json(partidasFormatadas);

    } catch (e) {
        console.error("❌ Erro na requisição:", e.message);
        res.status(200).json([]); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`---`);
    console.log(`🚀 TERMINAL OPERACIONAL ATIVO`);
    console.log(`💰 BANCA: USD 6.30`);
    console.log(`---`);
});
