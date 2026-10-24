// ==============================================================
// TRADUCTOR MULTI-IDIOMA ULTRA ROBUSTO PARA IDDQD MONEY STATS
// TheJazZDM - Full Bilingual Support (ES / EN)
// ==============================================================
(function() {
    const DICT = {
        // Navegación principal
        "Inicio": "Home",
        "Jugadores": "Players",
        "Mapas": "Maps",
        "Historial": "History",
        "API": "API",
        "Estadísticas del servidor": "Server Statistics",
        "Estadísticas del servidor · WEB v222 · refresco automático cada 30 s": "Server Statistics · WEB v222 · auto-refresh every 30s",
        "refresco automático cada 30 s": "auto-refresh every 30s",

        // Métricas home y etiquetas
        "Jugadores": "Players",
        "Online ahora": "Online now",
        "BANK total": "Total BANK",
        "DAMAGE total": "Total DAMAGE",
        "Mapas ganados": "Maps won",
        "Goldens registrados": "Registered Goldens",
        "Mapa actual": "Current map",
        "Participantes registrados": "Registered participants",
        "Todavía nadie registrado.": "No participants registered yet.",
        "Todavía no hay mapas que coincidan.": "No matching maps yet.",
        "Todavía no hay mapas registrados para este jugador.": "No maps recorded for this player yet.",

        // Líderes y categorías
        "Rankings": "Leaderboards",
        "Los líderes actuales por categoría.": "Current leaders by category.",
        "Ver todos →": "View all →",
        "Ver historial →": "View history →",
        "Historial completo →": "Full history →",
        "💰 Top BANK": "💰 Top BANK",
        "⚔ Top DAMAGE": "⚔ Top DAMAGE",
        "🏆 Mapas ganados": "🏆 Maps won",
        "🌟 Golden kills": "🌟 Golden kills",

        // Filtros y formulario de Jugadores (/players)
        "Busca perfiles y ordena el ranking por cualquier métrica.": "Search profiles and sort rankings by any metric.",
        "Buscar jugador…": "Search player…",
        "Buscar jugador": "Search player",
        "Buscar jugador por nombre…": "Search player by name…",
        "Mayor → menor": "Highest → lowest",
        "Menor → mayor": "Lowest → highest",
        "Todos": "All",
        "Online": "Online",
        "Offline": "Offline",
        "offline": "offline",
        "online": "online",
        "Aplicar": "Apply",
        "Filtrar": "Filter",
        "Jugador": "Player",
        "Estado": "Status",
        "Goldens": "Goldens",
        "Muertes": "Deaths",
        "Tiempo": "Time",
        "Tiempo jugado": "Time played",
        "Tiempo registrado": "Time logged",
        "Última vez": "Last seen",
        "Entradas": "Joins",
        "Nombre": "Name",

        // Perfil de jugador (/player?name=...)
        "Resumen del jugador": "Player Summary",
        "Damage / hora": "Damage / hr",
        "Muertes / hora": "Deaths / hr",
        "Goldens / mapa": "Goldens / map",
        "Actividad": "Activity",
        "Primera vez registrada": "First recorded",
        "Última vez registrada": "Last recorded",
        "Récords en mapas": "Map Records",
        "Partidas registradas": "Recorded Matches",
        "Sin partidas registradas": "No matches recorded",
        "Sin récords registrados": "No records registered",
        "Mapas, Goldens, muertes, joins y tiempo se contabilizan desde la activación del sistema v219.": "Maps, Goldens, deaths, joins, and time are tracked since system activation v219.",

        // Mapas (/maps)
        "Estadísticas por mapa": "Map Statistics",
        "Victorias, failsafes, récords y equipos.": "Victories, failsafes, records, and teams.",
        "Buscar MAP, título o jugador récord…": "Search MAP, title, or record player…",
        "Victorias": "Victories",
        "Finales forzados": "Forced exits",
        "Forzados": "Forced",
        "Mejor tiempo": "Best time",
        "Última duración": "Last duration",
        "Última partida": "Last match",
        "Últimas waves": "Last waves",
        "Extra waves": "Extra waves",
        "Mapa": "Map",
        "Título": "Title",
        "Récord": "Record",
        "Tiempo récord": "Record time",
        "Equipo récord": "Record team",

        // Historial (/history)
        "Historial de partidas": "Match History",
        "Filtra por mapa, título, equipo o jugador.": "Filter by map, title, team, or player.",
        "Buscar mapa, título o equipo…": "Search map, title, or team…",
        "Jugador exacto…": "Exact player…",
        "Cualquier estado": "Any status",
        "Fecha": "Date",
        "Duración": "Duration",
        "Waves": "Waves",
        "Victoria": "Victory",
        "Final forzado": "Forced exit",
        "Equipo": "Team",
        "Partidas más recientes registradas.": "Most recent recorded matches.",

        // Pie de página y dock
        "IDDQD MONEY · Datos persistentes del servidor · BANK/DAMAGE incluyen historial previo; stats nuevas desde v219.": "IDDQD MONEY · Persistent server data · BANK/DAMAGE include previous history; new stats since v219.",
        "Volver a TheJazZDM": "Back to TheJazZDM"
    };

    window.setStatsLang = function(lang) {
        localStorage.setItem('jazz_lang', lang);
        applyStatsTranslation(lang);
    };

    function updateLangButtons(lang) {
        document.querySelectorAll('.btn-lang-es').forEach(btn => {
            if (lang === 'en') {
                btn.style.background = 'transparent';
                btn.style.color = '#a99da0';
            } else {
                btn.style.background = 'linear-gradient(135deg, #67111f, #a20e25)';
                btn.style.color = '#fff';
            }
        });

        document.querySelectorAll('.btn-lang-en').forEach(btn => {
            if (lang === 'en') {
                btn.style.background = 'linear-gradient(135deg, #67111f, #a20e25)';
                btn.style.color = '#fff';
            } else {
                btn.style.background = 'transparent';
                btn.style.color = '#a99da0';
            }
        });

        document.querySelectorAll('.stats-back-text').forEach(el => {
            el.textContent = lang === 'en' ? 'Back to TheJazZDM' : 'Volver a TheJazZDM';
        });
    }

    function mountTopNavLangSwitch() {
        const nav = document.querySelector('.nav');
        if (nav && !document.getElementById('stats-lang-nav-pill')) {
            const div = document.createElement('div');
            div.id = 'stats-lang-nav-pill';
            div.className = 'stats-lang-switch';
            div.style.cssText = 'margin-left:auto;display:inline-flex;align-items:center;background:#151217;border:1px solid #38242a;border-radius:11px;padding:3px;gap:4px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:700;';
            div.innerHTML = `
                <button type="button" onclick="setStatsLang('es')" class="btn-lang-es" style="border:none;background:linear-gradient(135deg,#67111f,#a20e25);color:#fff;padding:5px 12px;border-radius:8px;cursor:pointer;font-weight:700;transition:all 0.2s;">ES</button>
                <button type="button" onclick="setStatsLang('en')" class="btn-lang-en" style="border:none;background:transparent;color:#a99da0;padding:5px 12px;border-radius:8px;cursor:pointer;font-weight:700;transition:all 0.2s;">EN</button>
            `;
            nav.appendChild(div);
        }
    }

    let isTranslating = false;

    function applyStatsTranslation(lang) {
        updateLangButtons(lang);

        if (lang === 'es') {
            if (window._hasBeenTranslatedToEn) {
                location.reload();
            }
            return;
        }

        if (isTranslating) return;
        isTranslating = true;
        window._hasBeenTranslatedToEn = true;

        try {
            // 1. Reemplazo en nodos de texto visibles
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
                if (node.parentElement && (node.parentElement.classList.contains('stats-lang-switch') || node.parentElement.closest('.stats-lang-switch') || node.parentElement.id === 'stats-floating-dock')) {
                    continue;
                }

                const val = node.nodeValue;
                const trimmed = val.trim();
                if (!trimmed) continue;

                if (DICT[trimmed]) {
                    node.nodeValue = val.replace(trimmed, DICT[trimmed]);
                } else {
                    let s = val;
                    if (s.includes('mostrados')) s = s.replace(/(\d+)\s+mostrados\s*\/\s*(\d+)/g, '$1 shown / $2');
                    if (s.includes('resultados')) s = s.replace(/(\d+)\s+resultados/g, '$1 results');
                    if (s.includes('última vez')) s = s.replace(/última vez/gi, 'last seen');
                    if (s.includes('Últimos mapas con')) s = s.replace(/Últimos mapas con/g, 'Latest maps with');
                    if (s.includes('Últimos mapas')) s = s.replace(/Últimos mapas/g, 'Latest maps');
                    if (s.includes('refresco automático cada')) s = s.replace('refresco automático cada', 'auto-refresh every');
                    if (s.includes('Estadísticas del servidor')) s = s.replace('Estadísticas del servidor', 'Server Statistics');
                    if (s.includes('Volver a TheJazZDM')) s = s.replace('Volver a TheJazZDM', 'Back to TheJazZDM');
                    if (s.includes('Victoria')) s = s.replace('Victoria', 'Victory');
                    if (s.includes('Final forzado')) s = s.replace('Final forzado', 'Forced exit');
                    if (s.includes('extra')) s = s.replace(/(\d+)\s+extra/g, '$1 extra');
                    if (s !== val) {
                        node.nodeValue = s;
                    }
                }
            }

            // 2. Placeholders de inputs
            document.querySelectorAll('input[placeholder]').forEach(inp => {
                const ph = inp.getAttribute('placeholder');
                if (DICT[ph]) inp.setAttribute('placeholder', DICT[ph]);
            });

            // 3. Botones y controles
            document.querySelectorAll('button, input[type="submit"]').forEach(btn => {
                if (btn.classList.contains('btn-lang-es') || btn.classList.contains('btn-lang-en')) return;
                const t = (btn.textContent || btn.value || '').trim();
                if (DICT[t]) {
                    if (btn.textContent) btn.textContent = DICT[t];
                    if (btn.value) btn.value = DICT[t];
                }
            });

            // 4. Select dropdown options
            document.querySelectorAll('select option').forEach(opt => {
                const t = opt.textContent.trim();
                if (DICT[t]) opt.textContent = DICT[t];
            });
        } finally {
            isTranslating = false;
        }
    }

    function initStatsTranslation() {
        mountTopNavLangSwitch();
        const savedLang = localStorage.getItem('jazz_lang') || 'es';
        applyStatsTranslation(savedLang);

        // Observer para re-aplicar si hay actualizaciones dinámicas en el DOM
        const targetNode = document.querySelector('.wrap') || document.body;
        if (targetNode) {
            const observer = new MutationObserver(() => {
                if (isTranslating) return;
                const currentLang = localStorage.getItem('jazz_lang') || 'es';
                if (currentLang === 'en') {
                    applyStatsTranslation('en');
                }
            });
            observer.observe(targetNode, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStatsTranslation);
    } else {
        initStatsTranslation();
    }
})();
