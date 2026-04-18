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
        console.log("📡 Scanner: Executando filtragem Dual-Market...");

        // Função auxiliar para buscar mercados com segurança
        const buscarMercado = async (marketKey) => {
            try {
                const response = await axios.get(`https://api.the-odds-api.com/v4/sports/soccer/odds/`, {
                    params: {
                        apiKey: API_KEY,
                        regions: 'eu',
                        markets: marketKey,
                        oddsFormat: 'decimal'
                    }
                });
                return response.data;
            } catch (err) {
                console.error(`⚠️ Erro ao buscar ${marketKey}:`, err.message);
                return [];
            }
        };

        // Buscamos os dados separadamente para evitar erro 422 em lote
        const dataTotals = await buscarMercado('totals');
        const dataBtts = await buscarMercado('btts');

        const formatar = (lista, mercadoKey, alvo) => {
            return lista.map(evento => {
                const bookmaker = evento.bookmakers[0];
                let prob = 0;
                let odd = "N/A";

                if (bookmaker) {
                    const market = bookmaker.markets.find(m => m.key === mercadoKey);
                    if (market) {
                        const outcome = market.outcomes.find(o => 
                            (mercadoKey === 'totals' && o.name === 'Over' && o.point === 2.5) ||
                            (mercadoKey === 'btts' && o.name === 'Yes')
                        );
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
            }).filter(j => j.probabilidade >= 60); // Filtro de 60% para popular o painel
        };

        res.json({
            over: formatar(dataTotals, 'totals'),
            btts: formatar(dataBtts, 'btts')
        });

    } catch (e) {
        console.error("❌ Erro Crítico:", e.message);
        res.status(200).json({ over: [], btts: [] });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 TERMINAL DUAL-STRAT CORRIGIDO`));
