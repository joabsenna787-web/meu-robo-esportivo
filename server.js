const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- NOVA CONFIGURAÇÃO (THE-ODDS-API) ---
const API_KEY = "80a70f1d9e5e54c2d8e4bc3ecc04c41a";
const REGION = "eu"; // Focado em ligas europeias e principais
const MARKET = "totals"; // Focado em Over/Under

app.get("/ao-vivo", async (req, res) => {
    try {
        console.log("📡 The-Odds-API: Iniciando varredura de pré-análise...");

        // Buscamos jogos de Futebol que estão para começar
        const url = `https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${API_KEY}&regions=${REGION}&markets=${MARKET}&oddsFormat=decimal`;
        
        const resp = await axios.get(url);
        const eventos = resp.data;

        if (!eventos || eventos.length === 0) {
            console.log("⚠️ Nenhum evento encontrado na região selecionada.");
            return res.json([]);
        }

        const analise = eventos.map(evento => {
            // Pegamos a primeira casa de apostas disponível (geralmente Pinnacle ou Betfair)
            const bookmaker = evento.bookmakers[0];
            let probOver = 50; // Base padrão

            if (bookmaker) {
                const market = bookmaker.markets.find(m => m.key === "totals");
                if (market) {
                    // Procuramos o Over 2.5
                    const over25 = market.outcomes.find(o => o.name === "Over" && o.point === 2.5);
                    if (over25) {
                        // Converte a Odd em probabilidade implícita (1 / odd * 100)
                        // Adicionamos uma margem de "agressividade" do mercado
                        probOver = Math.round((1 / over25.price) * 115); 
                    }
                }
            }

            return {
                id: evento.id,
                hora: new Date(evento.commence_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                liga: evento.sport_title,
                casa: evento.home_team,
                fora: evento.away_team,
                probabilidade: probOver > 95 ? 95 : probOver
            };
        });

        // Filtro: Apenas jogos com tendência real de gols (> 60%)
        const listaFinal = analise
            .filter(j => j.probabilidade >= 60)
            .sort((a, b) => b.probabilidade - a.probabilidade);

        console.log(`✅ Sucesso! ${listaFinal.length} jogos analisados via Odds Reais.`);
        res.json(listaFinal);

    } catch (e) {
        console.error("❌ Erro na The-Odds-API:", e.response ? e.response.data : e.message);
        res.status(200).json([]);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 TERMINAL THE-ODDS-API ATIVO`));
