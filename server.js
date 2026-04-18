app.get("/ao-vivo", async (req, res) => {
    try {
        const nocache = Date.now();
        console.log("📡 Scanner: Executando busca de cobertura total (3 dias)...");

        // Buscamos um intervalo maior para forçar a API a entregar qualquer dado disponível
        const from = "2026-04-17"; 
        const to = "2026-04-19";

        const url = `${BASE_URL}?met=Fixtures&APIkey=${API_KEY}&from=${from}&to=${to}&_=${nocache}`;
        const resp = await axios.get(url);
        
        const partidasOriginal = resp.data.result || [];

        if (partidasOriginal.length === 0) {
            console.log("⚠️ Nenhuma partida disponível para esta chave no plano atual.");
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

        // Ordena para mostrar o que for "LIVE" ou tiver tempo no topo
        partidasFormatadas.sort((a, b) => (b.fixture.status.elapsed > 0) ? 1 : -1);

        console.log(`✅ Sincronizado: ${partidasFormatadas.length} partidas encontradas.`);
        res.json(partidasFormatadas);

    } catch (e) {
        console.error("❌ Erro:", e.message);
        res.status(200).json([]); 
    }
});
