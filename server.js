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
        console.log("📡 Scanner: Executando filtragem Dual-Market (Over 2.5 + BTTS)...");

        // Buscamos Totais (Over 2.5) e Ambas Marcam (BTTS)
        const [respTotals, respBtts] = await Promise.all([
            axios.get(`https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${API_KEY}&regions=eu&markets=totals&oddsFormat=decimal`),
            axios.get(`https://api.the-odds-api.com/v4/sports/soccer/odds/?apiKey=${API_KEY}&regions=eu&markets=btts&oddsFormat=decimal`)
        ]);

        const formatarJogo = (evento, mercadoKey, alvo) => {
            const bookmaker = evento.bookmakers[0];
            let prob = 50;
            let odd = "N/A";

            if (bookmaker) {
                const market = bookmaker.markets.find(m => m.key === mercadoKey);
                if (market) {
                    const outcome = market.outcomes.find(o => o.name === alvo || (mercadoKey === 'totals' && o.name === 'Over' && o.point === 2.5));
                    if (outcome) {
                        odd = outcome.price;
                        prob = Math.round((1 / odd) * 114);
                    }
                }
            }
            return {
                id: evento.id,
                hora: new Date(evento.commence_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                liga: evento.sport_title,
                casa: evento.home_team,
                fora: evento.away_team,
                odd: odd,
                probabilidade: prob > 98 ? 98 : prob
            };
        };

        const listaOver = respTotals.data.map(e => formatarJogo(e, 'totals', 'Over')).filter(j => j.probabilidade >= 65);
        const listaBtts = respBtts.data.map(e => formatarJogo(e, 'btts', 'Yes')).filter(j => j.probabilidade >= 65);

        res.json({ over: listaOver, btts: listaBtts });
    } catch (e) {
        console.error("Erro na API:", e.message);
        res.status(200).json({ over: [], btts: [] });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 TERMINAL DUAL-STRAT ATIVO`));
