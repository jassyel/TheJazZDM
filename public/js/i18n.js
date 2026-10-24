/**
 * TheJazZDM Internationalization (i18n) Engine
 * Soporte bilingüe completo Español (ES) / Inglés (EN)
 * Diseñado para entornos móviles y de escritorio. Sin emojis.
 */

(function (window) {
    const translations = {
        es: {
            // General
            lang_es: "ES",
            lang_en: "EN",
            brand_node: "Nodo Activo",
            online: "En línea",
            offline: "Apagado",
            operational: "Operativo",
            loading: "Cargando...",
            copied: "Copiado al portapapeles",
            save_all: "Guardar Todo",
            saved_success: "Cambios guardados con éxito",
            cancel: "Cancelar",
            confirm: "Confirmar",
            close: "Cerrar",
            understand: "Entendido",
            error: "Error",
            success: "Éxito",

            // Portfolio Public Navbar
            nav_home: "Inicio",
            nav_projects: "Proyectos",
            nav_modpacks: "Modpacks",
            nav_systems: "Infraestructura",
            nav_systems_short: "Infra",
            nav_socials: "Redes",
            nav_systems_online: "Sistemas Activos",

            // Portfolio Public Hero
            hero_greeting_prefix: "Hola, soy",
            community_title: "Mi Comunidad",
            community_desc: "Únete a mi servidor de Discord para charlar, compartir ideas y estar al tanto de todos mis proyectos y servidores.",
            community_join: "Unirse ahora",
            copy_click: "Click para copiar",

            // Portfolio Public Systems Section (Mi Infraestructura)
            sec_systems_title: "Mi Infraestructura",
            sec_systems_subtitle: "Servidores dedicados, plataformas y microservicios que he construido y mantengo en funcionamiento continuo 24/7.",
            sys_mc_name: "EclipseMC",
            sys_mc_tag: "Servidor de Supervivencia",
            sys_mc_desc: "Servidor de supervivencia personalizado con arquitectura multi-hilo optimizada para soportar altas cargas de jugadores de forma fluida y sin lag.",
            sys_mc_badge: "NeoForge & Folia Engine",

            sys_velocity_name: "Velocity Network Proxy",
            sys_velocity_tag: "Enrutador de Red & Seguridad",
            sys_velocity_desc: "Infraestructura de proxy ultrarrápida que conecta y distribuye el tráfico entre mis diferentes nodos de juego con protección integrada y latencia mínima.",
            sys_velocity_badge: "Velocity & Anti-DDoS",

            sys_exolive_name: "ExoLive V2 Platform",
            sys_exolive_tag: "Plataforma Web Interactiva",
            sys_exolive_desc: "Plataforma interactiva que creé para creadores de contenido, permitiendo controlar dinámicas y eventos en vivo directamente en OBS mediante webhooks.",
            sys_exolive_badge: "Node.js & WebSockets",

            sys_2b2t_name: "2Bored2Tolerate (2b2t)",
            sys_2b2t_tag: "Microservicio Autónomo",
            sys_2b2t_desc: "Sistema automatizado que desarrollé para monitorear estados de colas de conexión persistentes y telemetría de red en tiempo real.",
            sys_2b2t_badge: "Queue Telemetry Worker",

            sys_doom_name: "Doom / ZDaemon Cluster",
            sys_doom_tag: "Clúster Multijugador Dedicado",
            sys_doom_desc: "Clúster dedicado de 6 instancias simultáneas para partidas competitivas multijugador de Doom clásico en servidores dedicados.",
            sys_doom_badge: "6 Nodos Dedicados",

            // Portfolio Sections
            sec_projects_title: "Mis Proyectos",
            sec_modpacks_title: "Mis Modpacks",
            sec_socials_title: "Mis Redes",
            btn_view_project: "Ver Proyecto",
            btn_view_modpack: "Ver Modpack",
            btn_explore_platform: "Explorar Plataforma",
            btn_stats_web: "Estadísticas",
            footer_dev_by: "Diseñado y desarrollado por",
            footer_views: "visualizaciones",
            operational_count: "Sistemas en Línea",

            // Admin Login
            admin_login_title: "Centro de Control",
            admin_login_subtitle: "Panel Maestro de Infraestructura",
            admin_login_placeholder: "Ingresa contraseña de acceso...",
            admin_login_btn: "Entrar al Panel",
            admin_login_verifying: "Verificando...",
            admin_login_empty: "Por favor ingresa la contraseña.",
            admin_login_failed: "Contraseña incorrecta. Inténtalo de nuevo.",
            admin_login_conn_err: "Error de conexión con el backend de HeavyNode.",

            // Admin Header Pills
            admin_badge_node: "Nodo HeavyNode Activo",
            admin_tab_services: "Consolas y Servicios",
            admin_tab_zdaemon: "Split Server (Doom)",
            admin_tab_content: "Editar Portafolio",
            admin_btn_save: "Guardar Todo",
            admin_btn_logout: "Cerrar Sesión",
            admin_views: "visitas",

            // Admin Services Tab
            admin_ram_title: "Memoria RAM del Servidor",
            admin_uptime: "Tiempo Activo",
            admin_calculating: "Calculando...",
            admin_btn_refresh: "Actualizar Estados",
            admin_modules_title: "Módulos de Procesos en Ejecución",
            admin_modules_subtitle: "Contenedor HeavyNode 100% persistente",
            admin_status_running: "En línea",
            admin_status_stopped: "Apagado",
            admin_status_starting: "Iniciando...",
            admin_status_stopping: "Deteniendo...",
            admin_status_restarting: "Reiniciando...",
            admin_btn_start: "Encender",
            admin_btn_stop: "Detener",
            admin_btn_restart: "Reiniciar",
            admin_btn_console: "Ver Consola",

            // Admin Countdown Banner
            admin_cd_active: "Reinicio en Curso",
            admin_cd_title: "Cuenta Regresiva Activa: Minecraft",
            admin_cd_remaining: "Tiempo restante:",
            admin_cd_notice: "(Avisos periódicos en chat y pantalla a los jugadores)",
            admin_cd_cancel: "Cancelar Reinicio",

            // Admin Terminal
            admin_term_title: "Consola Activa",
            admin_term_autoscroll_on: "Auto-Scroll: ON",
            admin_term_autoscroll_off: "Auto-Scroll: OFF",
            admin_term_autoscroll_off: "Auto-Scroll: OFF",
            admin_term_copy: "Copiar log",
            admin_term_download: "Descargar log",
            admin_term_clear: "Limpiar pantalla",
            admin_term_refresh: "Refrescar",
            admin_term_placeholder: "Comando (ej: list, tps, time set day, save-all, op)...",
            admin_term_send: "Enviar",
            admin_quick_label: "Comandos rápidos:",

            // Admin Scheduler
            admin_sched_title: "Programador de Reinicios Multi-Servicio",
            admin_sched_badge: "",
            admin_sched_desc: "Configura horarios automáticos individuales para cada servicio. Ningún proceso afectará a los demás.",
            admin_sched_btn_save: "Guardar Programación",
            admin_sched_hour: "Hora",
            admin_sched_notice: "Aviso",
            admin_sched_opt_3m: "3 Minutos (Recomendado)",
            admin_sched_opt_1m: "1 Minuto (Rápido)",
            admin_sched_opt_0m: "Directo (Sin Aviso)",
            admin_sched_hint_exact: "Reinicio exacto a las",
            admin_sched_hint_notices: "Avisos inician a las",

            // Admin Split Server Tab
            admin_zd_title: "ZDaemon & Doom Engine",
            admin_zd_subtitle: "Split Server",
            admin_zd_connected: "Conectado",
            admin_zd_disconnected: "Desconectado",
            admin_zd_verifying: "Verificando...",
            admin_zd_mem: "Uso de Memoria",
            admin_zd_btn_startall: "Encender Todo",
            admin_zd_btn_stopall: "Detener Todo",
            admin_zd_btn_restartall: "Reiniciar Todo",
            admin_zd_sec_title: "Servidores ZDaemon & Zandronum Aislados",
            admin_zd_sec_sub: "Control independiente 100% individual",
            admin_zd_console_title: "Consola ZDaemon / Doom",
            admin_zd_console_sub: "Salida de consola y registro en vivo del Split Server",
            admin_zd_autoscroll: "Auto-scroll",
            admin_zd_autorefresh: "Auto-refresco (3s)",

            // Admin Content Editor
            admin_ed_profile: "Perfil Personal",
            admin_ed_name: "Nombre",
            admin_ed_role: "Título / Cargo",
            admin_ed_bio: "Biografía",
            admin_ed_files: "Archivos y SEO",
            admin_ed_photo: "Foto de Perfil",
            admin_ed_favicon: "Favicon (Pestaña)",
            admin_ed_tab_title: "Título de Pestaña",
            admin_ed_upload: "Subir",
            admin_ed_music: "Música y Comunidad",
            admin_ed_song: "Nombre Canción",
            admin_ed_artist: "Artista",
            admin_ed_vol: "Volumen de inicio",
            admin_ed_audio: "Archivo MP3",
            admin_ed_discord: "Enlace Servidor Discord",
            admin_ed_asset_mgr: "Gestor de Archivos (Para Modpacks)",
            admin_ed_asset_desc: "Sube fotos o assets aquí para usarlos en tus tarjetas de modpacks.",
            admin_ed_security: "Seguridad del Panel",
            admin_ed_password: "Contraseña de Administrador",
            admin_ed_modpacks: "Módulos de Modpacks (CurseForge)",
            admin_ed_add_modpack: "Añadir Modpack",
            admin_ed_projects: "Tarjetas de Proyectos Destacados",
            admin_ed_add_project: "Añadir Proyecto",
            admin_ed_socials: "Módulos de Redes y Contacto",
            admin_ed_add_social: "Añadir Red",

            // MC Restart Modal
            admin_modal_mc_title: "Reiniciar Minecraft (Folia / Canvas)",
            admin_modal_mc_badge: "Aislamiento Seguro",
            admin_modal_mc_sub: "Selecciona el protocolo de aviso para los jugadores conectados",
            admin_modal_mc_opt1_title: "Aviso Gradual de 3 Minutos",
            admin_modal_mc_opt1_badge: "Recomendado",
            admin_modal_mc_opt1_desc: "Envía anuncios en chat, títulos y barra de acción a 3m, 2m, 1m, 30s, 15s y cuenta final. Guarda con save-all.",
            admin_modal_mc_opt2_title: "Aviso Rápido de 1 Minuto",
            admin_modal_mc_opt2_badge: "Rápido",
            admin_modal_mc_opt2_desc: "Avisos de urgencia a 60s, 30s, 15s y cuenta final. Guarda con save-all antes de reiniciar.",
            admin_modal_mc_opt3_title: "Reinicio Inmediato (Sin Avisos)",
            admin_modal_mc_opt3_badge: "Directo",
            admin_modal_mc_opt3_desc: "Guarda chunks y apaga el proceso Java. El supervisor lo levanta en 5 segundos."
        },
        en: {
            // General
            lang_es: "ES",
            lang_en: "EN",
            brand_node: "Active Node",
            online: "Online",
            offline: "Stopped",
            operational: "Operational",
            loading: "Loading...",
            copied: "Copied to clipboard",
            save_all: "Save All",
            saved_success: "Changes saved successfully",
            cancel: "Cancel",
            confirm: "Confirm",
            close: "Close",
            understand: "Got it",
            error: "Error",
            success: "Success",

            // Portfolio Public Navbar
            nav_home: "Home",
            nav_projects: "Projects",
            nav_modpacks: "Modpacks",
            nav_systems: "Infrastructure",
            nav_systems_short: "Infra",
            nav_socials: "Socials",
            nav_systems_online: "Systems Active",

            // Portfolio Public Hero
            hero_greeting_prefix: "Hello, I'm",
            community_title: "My Community",
            community_desc: "Join my Discord server to chat, share ideas, and stay up to date with my latest projects and servers.",
            community_join: "Join Now",
            copy_click: "Click to copy",

            // Portfolio Public Systems Section (My Infrastructure)
            sec_systems_title: "My Infrastructure",
            sec_systems_subtitle: "Dedicated high-performance servers, custom platforms, and microservices I have built and maintain 24/7.",
            sys_mc_name: "EclipseMC",
            sys_mc_tag: "Survival Server",
            sys_mc_desc: "Custom survival server engineered with multi-threaded architecture to handle heavy player loads smoothly with zero lag.",
            sys_mc_badge: "NeoForge & Folia Engine",

            sys_velocity_name: "Velocity Network Proxy",
            sys_velocity_tag: "Network Router & Security",
            sys_velocity_desc: "Ultra-fast routing proxy infrastructure connecting and balancing traffic across my game server cluster with built-in protection and ultra-low latency.",
            sys_velocity_badge: "Velocity & Anti-DDoS",

            sys_exolive_name: "ExoLive V2 Platform",
            sys_exolive_tag: "Interactive Web Platform",
            sys_exolive_desc: "Interactive streaming platform I built for content creators, enabling real-time live event control directly inside OBS via webhooks.",
            sys_exolive_badge: "Node.js & WebSockets",

            sys_2b2t_name: "2Bored2Tolerate (2b2t)",
            sys_2b2t_tag: "Autonomous Microservice",
            sys_2b2t_desc: "Autonomous worker system I developed to monitor persistent queue states and network telemetry in real time.",
            sys_2b2t_badge: "Queue Telemetry Worker",

            sys_doom_name: "Doom / ZDaemon Cluster",
            sys_doom_tag: "Dedicated Multiplayer Cluster",
            sys_doom_desc: "Dedicated 6-instance server cluster hosting competitive classic Doom multiplayer game modes on dedicated servers.",
            sys_doom_badge: "6 Dedicated Nodes",

            // Portfolio Sections
            sec_projects_title: "My Projects",
            sec_modpacks_title: "My Modpacks",
            sec_socials_title: "My Socials",
            btn_view_project: "View Project",
            btn_view_modpack: "View Modpack",
            btn_explore_platform: "Explore Platform",
            btn_stats_web: "Statistics",
            footer_dev_by: "Designed and developed by",
            footer_views: "views",
            operational_count: "Systems Online",

            // Admin Login
            admin_login_title: "Master Control Hub",
            admin_login_subtitle: "Infrastructure Management Center",
            admin_login_placeholder: "Enter access password...",
            admin_login_btn: "Access Dashboard",
            admin_login_verifying: "Verifying...",
            admin_login_empty: "Please enter your password.",
            admin_login_failed: "Incorrect password. Please try again.",
            admin_login_conn_err: "Connection error with HeavyNode backend.",

            // Admin Header Pills
            admin_badge_node: "HeavyNode Active Node",
            admin_tab_services: "Consoles & Services",
            admin_tab_zdaemon: "Split Server (Doom)",
            admin_tab_content: "Edit Portfolio",
            admin_btn_save: "Save Changes",
            admin_btn_logout: "Log Out",
            admin_views: "views",

            // Admin Services Tab
            admin_ram_title: "Server RAM Usage",
            admin_uptime: "Uptime",
            admin_calculating: "Calculating...",
            admin_btn_refresh: "Refresh Status",
            admin_modules_title: "Running Process Modules",
            admin_modules_subtitle: "HeavyNode container 100% persistent",
            admin_status_running: "Online",
            admin_status_stopped: "Stopped",
            admin_status_starting: "Starting...",
            admin_status_stopping: "Stopping...",
            admin_status_restarting: "Restarting...",
            admin_btn_start: "Start",
            admin_btn_stop: "Stop",
            admin_btn_restart: "Restart",
            admin_btn_console: "View Console",

            // Admin Countdown Banner
            admin_cd_active: "Restart In Progress",
            admin_cd_title: "Active Countdown: Minecraft",
            admin_cd_remaining: "Time remaining:",
            admin_cd_notice: "(Periodic broadcast announcements and titles sent to players)",
            admin_cd_cancel: "Cancel Restart",

            // Admin Terminal
            admin_term_title: "Active Console",
            admin_term_autoscroll_on: "Auto-Scroll: ON",
            admin_term_autoscroll_off: "Auto-Scroll: OFF",
            admin_term_autoscroll_off: "Auto-Scroll: OFF",
            admin_term_copy: "Copy log",
            admin_term_download: "Download log",
            admin_term_clear: "Clear screen",
            admin_term_refresh: "Refresh",
            admin_term_placeholder: "Command (e.g., list, tps, time set day, save-all, op)...",
            admin_term_send: "Send",
            admin_quick_label: "Quick commands:",

            // Admin Scheduler
            admin_sched_title: "Multi-Service Restart Scheduler",
            admin_sched_badge: "",
            admin_sched_desc: "Configure independent automatic restart schedules per service. Isolated processes prevent cascading restarts.",
            admin_sched_btn_save: "Save Schedule",
            admin_sched_hour: "Time",
            admin_sched_notice: "Notice",
            admin_sched_opt_3m: "3 Minutes (Recommended)",
            admin_sched_opt_1m: "1 Minute (Fast)",
            admin_sched_opt_0m: "Direct (No Notice)",
            admin_sched_hint_exact: "Exact restart at",
            admin_sched_hint_notices: "Notices start at",

            // Admin Split Server Tab
            admin_zd_title: "ZDaemon & Doom Engine",
            admin_zd_subtitle: "Split Server",
            admin_zd_connected: "Connected",
            admin_zd_disconnected: "Disconnected",
            admin_zd_verifying: "Verifying...",
            admin_zd_mem: "Memory Usage",
            admin_zd_btn_startall: "Start All",
            admin_zd_btn_stopall: "Stop All",
            admin_zd_btn_restartall: "Restart All",
            admin_zd_sec_title: "Isolated ZDaemon & Zandronum Servers",
            admin_zd_sec_sub: "100% individual isolated control",
            admin_zd_console_title: "ZDaemon / Doom Console",
            admin_zd_console_sub: "Live console and split server stream logs",
            admin_zd_autoscroll: "Auto-scroll",
            admin_zd_autorefresh: "Auto-refresh (3s)",

            // Admin Content Editor
            admin_ed_profile: "Personal Profile",
            admin_ed_name: "Name",
            admin_ed_role: "Title / Role",
            admin_ed_bio: "Biography",
            admin_ed_files: "Files & SEO",
            admin_ed_photo: "Profile Picture",
            admin_ed_favicon: "Favicon (Browser Tab)",
            admin_ed_tab_title: "Browser Tab Title",
            admin_ed_upload: "Upload",
            admin_ed_music: "Music & Community",
            admin_ed_song: "Song Name",
            admin_ed_artist: "Artist",
            admin_ed_vol: "Starting Volume",
            admin_ed_audio: "MP3 Audio File",
            admin_ed_discord: "Discord Server Link",
            admin_ed_asset_mgr: "Asset & File Manager (For Modpacks)",
            admin_ed_asset_desc: "Upload images or assets here to link them directly in your modpack cards.",
            admin_ed_security: "Dashboard Security",
            admin_ed_password: "Administrator Password",
            admin_ed_modpacks: "Modpack Modules (CurseForge)",
            admin_ed_add_modpack: "Add Modpack",
            admin_ed_projects: "Featured Project Cards",
            admin_ed_add_project: "Add Project",
            admin_ed_socials: "Social & Contact Modules",
            admin_ed_add_social: "Add Social",

            // MC Restart Modal
            admin_modal_mc_title: "Restart Minecraft (Folia / Canvas)",
            admin_modal_mc_badge: "Process Isolation",
            admin_modal_mc_sub: "Select notification protocol for connected players",
            admin_modal_mc_opt1_title: "Gradual 3-Minute Notice",
            admin_modal_mc_opt1_badge: "Recommended",
            admin_modal_mc_opt1_desc: "Broadcasts chat announcements, titles, and action bars at 3m, 2m, 1m, 30s, 15s, and 5-4-3-2-1. Runs save-all.",
            admin_modal_mc_opt2_title: "Quick 1-Minute Notice",
            admin_modal_mc_opt2_badge: "Quick",
            admin_modal_mc_opt2_desc: "Urgent announcements at 60s, 30s, 15s, and countdown. Runs save-all before restarting.",
            admin_modal_mc_opt3_title: "Immediate Restart (No Notice)",
            admin_modal_mc_opt3_badge: "Direct",
            admin_modal_mc_opt3_desc: "Saves chunks instantly and halts the Java process. The supervisor relaunches it in 5 seconds."
        }
    };

    let currentLang = localStorage.getItem('jazz_lang') || 'es';

    function getLanguage() {
        return currentLang;
    }

    function t(key, fallback) {
        if (!translations[currentLang]) return fallback !== undefined ? fallback : key;
        const val = translations[currentLang][key];
        return val !== undefined ? val : (fallback !== undefined ? fallback : key);
    }

    function updateDOM() {
        document.documentElement.lang = currentLang;

        // Traducir todos los elementos con atributo data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = t(key);
            if (translation) {
                el.innerText = translation;
            }
        });

        // Traducir placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = t(key);
            if (translation) {
                el.setAttribute('placeholder', translation);
            }
        });

        // Traducir titles/tooltips
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translation = t(key);
            if (translation) {
                el.setAttribute('title', translation);
            }
        });

        // Notificar a listeners dinámicos
        try {
            window.dispatchEvent(new CustomEvent('jazz_language_changed', { detail: { lang: currentLang } }));
        } catch (_) {}

        // Estilos para toggles de idioma en la página
        const esBtns = document.querySelectorAll('.lang-btn-es, #nav-lang-es, #lang-btn-es');
        const enBtns = document.querySelectorAll('.lang-btn-en, #nav-lang-en, #lang-btn-en');

        esBtns.forEach(btn => {
            if (currentLang === 'es') {
                btn.classList.add('bg-neon-cyan/20', 'text-neon-cyan', 'border-neon-cyan/40', 'font-extrabold');
                btn.classList.remove('text-gray-400');
            } else {
                btn.classList.remove('bg-neon-cyan/20', 'text-neon-cyan', 'border-neon-cyan/40', 'font-extrabold');
                btn.classList.add('text-gray-400');
            }
        });

        enBtns.forEach(btn => {
            if (currentLang === 'en') {
                btn.classList.add('bg-neon-cyan/20', 'text-neon-cyan', 'border-neon-cyan/40', 'font-extrabold');
                btn.classList.remove('text-gray-400');
            } else {
                btn.classList.remove('bg-neon-cyan/20', 'text-neon-cyan', 'border-neon-cyan/40', 'font-extrabold');
                btn.classList.add('text-gray-400');
            }
        });
    }

    function setLanguage(lang) {
        if (lang !== 'es' && lang !== 'en') return;
        currentLang = lang;
        localStorage.setItem('jazz_lang', lang);
        updateDOM();
    }

    // Inicializar al cargar el DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateDOM);
    } else {
        updateDOM();
    }

    // Exponer API global
    window.i18n = {
        t,
        getLanguage,
        setLanguage,
        updateDOM
    };
    window.setLanguage = setLanguage;
    window.switchLanguage = setLanguage;

})(window);
