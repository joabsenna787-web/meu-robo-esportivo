const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const API_KEY = "80a70f1d9e5e54c2d8e4bc3ecc04c41a";

app.get("/analise-completa", async (req, res) => {
    try {
        console.log("📡 Scanner: Executando Varredura Multi-Mercado...");

        // Buscamos os jogos com TODOS os mercados disponíveis de uma vez
        // Isso evita o erro 422 pois a API gerencia o que pode entregar
        const response = await axios.get(`https://api.the-odds-api.com/v4/sports/soccer/odds/`, {
            params: {
                apiKey: API_KEY,
                regions: 'eu',
                markets: 'totals,btts', // Pedimos os dois mercados aqui
                oddsFormat: 'decimal'
            }
        });

        const eventos = response.data || [];
        
        const listaOver = [];
        const listaBtts = [];

        eventos.forEach(evento => {
            const bookmaker = evento.bookmakers[0];
            if (!bookmaker) return;

            const horaFormatada = new Date(evento.commence_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            // Processar Over 2.5
            const marketTotals = bookmaker.markets.find(m => m.key === 'totals');
            if (marketTotals) {
                const over25 = marketTotals.outcomes.find(o => o.name === 'Over' && o.point === 2.5);
                if (over25) {
                    const prob = Math.round((1 / over25.price) * 114);
                    if (prob >= 60) {
                        listaOver.push({
                            id: evento.id,
                            hora: horaFormatada,
                            liga: evento.sport_title,
                            casa: evento.home_team,
                            fora: evento.away_team,
                            odd: over25.price,
                            probabilidade: prob > 98 ? 98 : prob
                        });
                    }
                }
            }

            // Processar Ambas Marcam (BTTS)
            const marketBtts = bookmaker.markets.find(m => m.key === 'btts');
            if (marketBtts) {
                const bttsYes = marketBtts.outcomes.find(o => o.name === 'Yes');
                if (bttsYes) {
                    const prob = Math.round((1 / bttsYes.price) * 114);
                    if (prob >= 60) {
                        listaBtts.push({
                            id: evento.id,
                            hora: horaFormatada,
                            liga: evento.sport_title,
                            casa: evento.home_team,
                            fora: evento.away_team,
                            odd: bttsYes.price,
                            probabilidade: prob > 98 ? 98 : prob
                        });
                    }
                }
            }
        });

        // Ordenar as listas por probabilidade
        listaOver.sort((a, b) => b.probabilidade - a.probabilidade);
        listaBtts.sort((a, b) => b.probabilidade - a.probabilidade);

        console.log(`✅ Sincronizado: ${listaOver.length} Over | ${listaBtts.length} BTTS`);
        res.json({ over: listaOver, btts: listaBtts });

    } catch (e) {
        console.error("❌ Erro na varredura:", e.message);
        res.status(200).json({ over: [], btts: [] });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 TERMINAL DUAL-STRAT V3 ATIVO`));
