const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- NOVA CHAVE ALLSPORTSAPI ---
const API_KEY = "5d5cb83a4f064d642aff51dcd0fbd466f6f621880b42cfdf4fad77f7a63455d2";
const BASE_URL = "https://allsportsapi.com/api/football/";

app.get("/ao-vivo", async (req, res) => {
    try {
        // Chamada para Livescore (Jogos em tempo real)
        const url = `${BASE_URL}?met=Livescore&APIkey=${API_KEY}`;
        const resp = await axios.get(url);
        
        const partidasOriginal = resp.data.result || [];

        // TRADUTOR: Converte o formato AllSports para o formato que seu Index.html entende
        const partidasFormatadas = partidasOriginal.map(j => {
            // Tratamento do placar (ex: "1 - 0")
            const placar = j.event_final_result && j.event_final_result.includes('-') 
                           ? j.event_final_result.split(' - ') 
                           : [0, 0];

            return {
                fixture: {
                    status: {
                        elapsed: parseInt(j.event_time) || 0, // Converte tempo para número
                        short: j.event_status || 'LIVE'
                    }
                },
                league: { name: j.league_name },
                teams: {
                    home: { name: j.event_home_team },
                    away: { name: j.event_away_team }
                },
                goals: {
                    home: placar[0],
                    away: placar[1]
                }
            };
        });

        console.log(`📡 Scanner: ${partidasFormatadas.length} partidas processadas via AllSportsAPI.`);
        res.json(partidasFormatadas);

    } catch (e) {
        console.error("❌ Erro na requisição AllSports:", e.message);
        res.status(200).json([]); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`---`);
    console.log(`🚀 TERMINAL FUTEXCHANGE ATUALIZADO`);
    console.log(`🔑 CONEXÃO: ALLSPORTSAPI ATIVA`);
    console.log(`💰 BANCA: USD 6.30`);
    console.log(`---`);
});
