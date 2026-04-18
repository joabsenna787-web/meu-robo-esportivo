const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- SUA CHAVE ALLSPORTS ---
const API_KEY = "5d5cb83a4f064d642aff51dcd0fbd466f6f621880b42cfdf4fad77f7a63455d2";

// URL UNIVERSAL DA API V2
const BASE_URL = "https://apiv2.allsportsapi.com/football/";

app.get("/ao-vivo", async (req, res) => {
    try {
        console.log("📡 Scanner AllSports: Tentando nova rota...");

        // A estrutura correta para Livescore na AllSportsAPI V2
        const url = `${BASE_URL}?met=Livescore&APIkey=${API_KEY}`;
        
        const resp = await axios.get(url, { timeout: 15000 });

        // Se a API retornar erro dentro do JSON (mesmo com status 200)
        if (resp.data.error) {
            console.log("⚠️ Erro da API:", resp.data.error);
            return res.json([]);
        }

        const partidasOriginal = resp.data.result || [];

        // TRADUTOR PARA O SEU INDEX.HTML
        const partidasFormatadas = partidasOriginal.map(j => {
            // Tratamento do placar (ex: "2 - 1")
            let homeG = 0;
            let awayG = 0;
            if (j.event_final_result && j.event_final_result.includes('-')) {
                const parts = j.event_final_result.split('-');
                homeG = parts[0].trim();
                awayG = parts[1].trim();
            }

            return {
                fixture: {
                    status: {
                        elapsed: parseInt(j.event_time) || 0,
                        short: j.event_status || 'LIVE'
                    }
                },
                league: { name: j.league_name || "Liga" },
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

        console.log(`✅ Sucesso! ${partidasFormatadas.length} jogos processados.`);
        res.json(partidasFormatadas);

    } catch (e) {
        // Se der 404 de novo, ele vai avisar aqui
        console.error("❌ Falha crítica na conexão:", e.message);
        res.status(200).json([]); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`---`);
    console.log(`🚀 TERMINAL FUTEXCHANGE ATUALIZADO`);
    console.log(`🌐 ENDPOINT: AllSports V2`);
    console.log(`💰 BANCA: USD 6.30`);
    console.log(`---`);
});
