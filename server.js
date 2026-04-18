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
        console.log("📡 Scanner: Iniciando tentativa de resgate de dados...");

        // TENTATIVA 1: Busca direta pelo Livescore (Sem filtros de data)
        const urlLive = `${BASE_URL}?met=Livescore&APIkey=${API_KEY}`;
        const resp = await axios.get(urlLive);
        
        let partidasOriginal = resp.data.result || [];

        // TENTATIVA 2: Se falhar, busca por Ligas Ativas (para forçar a conexão)
        if (partidasOriginal.length === 0) {
            console.log("⚠️ Livescore vazio. Verificando se há qualquer jogo no sistema...");
            // Busca jogos de um range maior para garantir que a API responda
            const urlAlt = `${BASE_URL}?met=Fixtures&APIkey=${API_KEY}&from=2026-04-17&to=2026-04-19`;
            const respAlt = await axios.get(urlAlt);
            partidasOriginal = respAlt.data.result || [];
        }

        // Se mesmo assim for 0, a API pode estar bloqueando por IP ou falta de Ligas no plano
        if (partidasOriginal.length === 0) {
            console.log("❌ API retornou VAZIO. Verifique se o plano FREE possui ligas ativas no dashboard.");
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

        console.log(`✅ Resultado: ${partidasFormatadas.length} jogos processados.`);
        res.json(partidasFormatadas);

    } catch (e) {
        console.error("❌ Erro de Conexão:", e.message);
        res.status(200).json([]); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 TERMINAL ON | PORTA ${PORT}`));
