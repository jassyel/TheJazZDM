/**
 * TheJazZDM Portfolio Client Application
 * Modular, multilingüe y reactivo a estados de infraestructura en tiempo real.
 */

let globalData = null;
let liveServicesStatus = {
    minecraft: true,
    velocity: true,
    exolive: true,
    '2b2t': true,
    split_server: true
};

// Configuración de Sistemas (100% visual, sin IPs, sin botones 'Copiar IP')
const SYSTEMS_CONFIG = [
    {
        id: 'minecraft',
        nameKey: 'sys_mc_name',
        tagKey: 'sys_mc_tag',
        descKey: 'sys_mc_desc',
        badgeKey: 'sys_mc_badge',
        icon: 'fa-cube',
        color: '#00FFFF',
        accentBorder: 'hover:border-[#00FFFF]/40',
        glow: 'hover:shadow-[0_0_25px_rgba(0,255,255,0.15)]',
        actionType: 'none'
    },
    {
        id: 'velocity',
        nameKey: 'sys_velocity_name',
        tagKey: 'sys_velocity_tag',
        descKey: 'sys_velocity_desc',
        badgeKey: 'sys_velocity_badge',
        icon: 'fa-shield-halved',
        color: '#f59e0b',
        accentBorder: 'hover:border-amber-400/40',
        glow: 'hover:shadow-[0_0_25px_rgba(245,158,11,0.15)]',
        actionType: 'none'
    },
    {
        id: 'exolive',
        nameKey: 'sys_exolive_name',
        tagKey: 'sys_exolive_tag',
        descKey: 'sys_exolive_desc',
        badgeKey: 'sys_exolive_badge',
        icon: 'fa-tower-broadcast',
        color: '#9d4edd',
        accentBorder: 'hover:border-purple-500/40',
        glow: 'hover:shadow-[0_0_25px_rgba(157,78,221,0.15)]',
        actionType: 'link',
        actionTarget: 'https://exolive.gamesrv.net'
    },
    {
        id: '2b2t',
        nameKey: 'sys_2b2t_name',
        tagKey: 'sys_2b2t_tag',
        descKey: 'sys_2b2t_desc',
        badgeKey: 'sys_2b2t_badge',
        icon: 'fa-hourglass-half',
        color: '#FF007F',
        accentBorder: 'hover:border-pink-500/40',
        glow: 'hover:shadow-[0_0_25px_rgba(255,0,127,0.15)]',
        actionType: 'none'
    },
    {
        id: 'split_server',
        nameKey: 'sys_doom_name',
        tagKey: 'sys_doom_tag',
        descKey: 'sys_doom_desc',
        badgeKey: 'sys_doom_badge',
        icon: 'fa-crosshairs',
        color: '#ef4444',
        accentBorder: 'hover:border-red-500/40',
        glow: 'hover:shadow-[0_0_25px_rgba(239,68,68,0.15)]',
        actionType: 'link',
        actionTarget: '/stats/',
        actionKey: 'btn_stats_web',
        actionIcon: 'fa-chart-simple'
    }
];

// Helper para i18n
function _t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
        return window.i18n.t(key, fallback);
    }
    return fallback !== undefined ? fallback : key;
}

// Inicialización de datos del portafolio
function initPortfolio() {
    fetch('/api/data')
        .then(res => res.json())
        .then(data => {
            globalData = data;
            renderAllData();
            fetchPublicStatus();
            document.getElementById('main-body').classList.remove('hidden');
        })
        .catch(err => {
            console.error('Error cargando /api/data:', err);
            document.getElementById('main-body').classList.remove('hidden');
        });
}

// Consultar estado público de infraestructura
function fetchPublicStatus() {
    fetch('/api/public/status')
        .then(res => res.json())
        .then(res => {
            if (res && res.services) {
                liveServicesStatus = res.services;
                renderSystemsSection();
            }
        })
        .catch(() => {
            renderSystemsSection();
        });
}

// Renderizado reactivo de todos los componentes
function renderAllData() {
    if (!globalData) return;
    const data = globalData;
    const currentLang = (window.i18n && typeof window.i18n.getLanguage === 'function')
        ? window.i18n.getLanguage()
        : (localStorage.getItem('jazz_lang') || 'es');

    document.getElementById('head-title').innerText = data.seo?.titulo || 'TheJazZDM';
    if (data.seo?.favicon) {
        document.getElementById('head-favicon').href = '/' + data.seo.favicon;
    }
    if (data.perfil?.imagen) {
        document.getElementById('ui-avatar').src = '/' + data.perfil.imagen;
    }

    document.getElementById('ui-nombre').innerText = data.perfil?.nombre || 'TheJazZDM';
    
    // Traducción dinámica de Título Profesional
    if (currentLang === 'en') {
        document.getElementById('ui-titulo').innerText = "Infrastructure Specialist | Support & Dev";
    } else {
        document.getElementById('ui-titulo').innerText = data.perfil?.titulo || "Especialista en Infraestructura | Support & Dev";
    }

    // Traducción dinámica de Bio
    if (currentLang === 'en') {
        document.getElementById('ui-bio').innerText = "Passionate about technology and content creation. Building high-performance server ecosystems, infrastructure, and live tools for gaming communities.";
    } else {
        document.getElementById('ui-bio').innerText = data.perfil?.bio || "Apasionado por la tecnología y la creación de contenido. Construyendo ecosistemas, servidores de alto rendimiento y herramientas para potenciar comunidades en vivo.";
    }

    document.getElementById('ui-footer-name').innerText = data.perfil?.nombre || 'TheJazZDM';
    document.getElementById('ui-visitas').innerText = data.visitas || '0';

    if (data.musica) {
        document.getElementById('ui-musica-titulo').innerText = data.musica.titulo || '';
        document.getElementById('ui-musica-artista').innerText = data.musica.artista || '';
        const audio = document.getElementById('bg-music');
        if (data.musica.archivo && !audio.src.includes(data.musica.archivo)) {
            audio.src = '/' + data.musica.archivo;
        }
        audio.volume = data.musica.volumen !== undefined ? data.musica.volumen : 0.5;

        // Disparar intento de autoreproducción inmediato y en eventos de carga
        if (data.musica.archivo) {
            attemptAutoplay();
            audio.addEventListener('canplay', () => {
                if (!audioUnlocked && audio.paused) {
                    attemptAutoplay();
                }
            }, { once: true });
        }
    }

    if (data.comunidad?.url) {
        document.getElementById('ui-comunidad-link').href = data.comunidad.url;
    }

    renderSystemsSection();
    renderRedes();
    renderProyectos(currentLang);
    renderModpacks();
}

// Renderizar Sección de Mi Infraestructura (Puro visual, sin IPs)
function renderSystemsSection() {
    const container = document.getElementById('ui-systems-container');
    if (!container) return;

    let onlineCount = 0;
    let cardsHtml = '';

    SYSTEMS_CONFIG.forEach(sys => {
        const isOnline = liveServicesStatus[sys.id] !== false;
        if (isOnline) onlineCount++;

        const statusText = isOnline ? _t('online', 'En línea') : _t('offline', 'Apagado');
        const statusBadgeClass = isOnline
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : 'bg-red-500/10 text-red-400 border-red-500/30';
        const dotPulseClass = isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400';

        const actionBtn = sys.actionType === 'link'
            ? `<a href="${sys.actionTarget}" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer"><i class="fa-solid ${sys.actionIcon || 'fa-arrow-up-right-from-square'} text-[10px]"></i> ${_t(sys.actionKey || 'btn_explore_platform', 'Explorar')}</a>`
            : '';

        cardsHtml += `
            <div class="glass-card p-6 flex flex-col justify-between border border-white/5 ${sys.accentBorder} ${sys.glow} transition-all duration-300 group relative overflow-hidden bg-gradient-to-b from-white/[0.03] to-[#07070C]">
                <div class="flex items-start justify-between gap-3 mb-4">
                    <div class="flex items-center gap-3.5">
                        <div class="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-110 shadow-lg" style="background-color: ${sys.color}15; color: ${sys.color}; border: 1px solid ${sys.color}30">
                            <i class="fa-solid ${sys.icon}"></i>
                        </div>
                        <div>
                            <h4 class="text-base font-extrabold text-white group-hover:text-white transition-colors leading-tight">${_t(sys.nameKey)}</h4>
                            <span class="text-xs text-gray-400 font-medium">${_t(sys.tagKey)}</span>
                        </div>
                    </div>
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border shrink-0 ${statusBadgeClass}">
                        <span class="w-1.5 h-1.5 rounded-full ${dotPulseClass}"></span> ${statusText}
                    </span>
                </div>

                <p class="text-xs md:text-sm text-gray-300/90 leading-relaxed mb-4 flex-1">
                    ${_t(sys.descKey)}
                </p>

                <div class="pt-3 border-t border-white/5 flex items-center justify-between mt-auto">
                    <span class="text-[11px] text-gray-400 font-mono flex items-center gap-1.5">
                        <i class="fa-solid fa-layer-group text-[10px] text-gray-500"></i> ${_t(sys.badgeKey)}
                    </span>
                    ${actionBtn}
                </div>
            </div>
        `;
    });

    container.innerHTML = cardsHtml;

    const summaryEl = document.getElementById('hero-systems-summary');
    if (summaryEl) {
        summaryEl.innerText = `${onlineCount}/${SYSTEMS_CONFIG.length} ${_t('operational_count', 'Sistemas Operativos')}`;
    }
}

// Renderizar Redes Sociales
function renderRedes() {
    const redesContainer = document.getElementById('ui-redes-container');
    if (!redesContainer || !globalData?.redes) return;

    redesContainer.innerHTML = '';
    globalData.redes.forEach(red => {
        const isCopy = red.url === "#" || red.url === "";
        const action = isCopy ? `onclick="copyText('${red.usuario}')"` : `href="${red.url}" target="_blank"`;
        const tag = isCopy ? 'button' : 'a';
        const displayUser = isCopy ? `${red.usuario} (${_t('copy_click', 'Click p/ copiar')})` : red.usuario;

        redesContainer.innerHTML += `
            <${tag} ${action} class="w-full flex items-center gap-4 p-4 rounded-xl bg-[#0B0B13] border border-white/5 hover:-translate-y-1 transition-all duration-300 group text-left shadow-md hover:shadow-xl z-20" style="--hover-color: ${red.color}" onmouseover="this.style.borderColor='${red.color}80'; this.style.boxShadow='0 8px 20px ${red.color}30'" onmouseout="this.style.borderColor='rgba(255,255,255,0.05)'; this.style.boxShadow='none'">
                <div class="w-10 h-10 rounded-md flex items-center justify-center transition-transform group-hover:scale-110 shrink-0" style="background-color: ${red.color}15; color: ${red.color}">
                    <i class="fa-brands ${red.icono} text-xl transition-transform group-hover:animate-wiggle"></i>
                </div>
                <div class="overflow-hidden">
                    <p class="font-bold text-white transition-colors truncate" style="--hover-color: ${red.color}" onmouseover="this.style.color='${red.color}'" onmouseout="this.style.color='white'">${red.nombre}</p>
                    <p class="text-xs text-gray-400 truncate">${displayUser}</p>
                </div>
            </${tag}>
        `;
    });
}

// Renderizar Proyectos Principales (con soporte bilingüe)
function renderProyectos(currentLang) {
    const proyectosContainer = document.getElementById('ui-proyectos-container');
    if (!proyectosContainer || !globalData?.proyectos) return;

    proyectosContainer.innerHTML = '';
    globalData.proyectos.forEach(proj => {
        const btnClass = proj.estilo === 'pink' ? 'btn-neon' : 'btn-neon-cyan';
        
        let projName = proj.nombre;
        let projDesc = proj.desc;

        if (currentLang === 'en') {
            if (proj.nombre.toLowerCase().includes('iddqd')) {
                projName = "IDDQD Money | Stats & Ranking";
                projDesc = "Live telemetry dashboard and real-time leaderboard featuring player economies, records, and rankings from IDDQD Money.";
            } else if (proj.nombre.toLowerCase().includes('exolive')) {
                projDesc = "The definitive control panel for streamers and moderators. Manage live interactive content directly inside OBS.";
            } else if (proj.nombre.toLowerCase().includes('adventure') || proj.nombre.toLowerCase().includes('hall of fame')) {
                projName = "LA Adventure | Hall of Fame";
                projDesc = "Real-time telemetry for 649 Hardcore Adventure maps with live camera synchronizer, winners podium, and country leaderboard.";
            } else if (proj.nombre.toLowerCase().includes('eclipse')) {
                projName = "EclipseMC | Survival Server";
                projDesc = "Optimized Minecraft server. Smooth and responsive gameplay running on custom high-performance infrastructure.";
            }
        } else {
            if (proj.nombre.toLowerCase().includes('adventure') || proj.nombre.toLowerCase().includes('hall of fame')) {
                projName = "LA Adventure | Hall of Fame";
                projDesc = "Telemetría en tiempo real de los 649 mapas de Hardcore Adventure con cámara interactiva, podio de ganadores y ranking de países.";
            } else if (proj.nombre.toLowerCase().includes('eclipse')) {
                projName = "EclipseMC | Servidor Survival";
                projDesc = "Servidor de Minecraft optimizado. Experiencia fluida sobre infraestructura de alto rendimiento.";
            }
        }

        proyectosContainer.innerHTML += `
            <div class="glass-card z-20 ${proj.estilo === 'pink' ? 'card-pink-glow' : 'card-cyan-glow'} p-6 bg-gradient-to-b ${proj.estilo === 'pink' ? 'from-neon-pink/5' : 'from-neon-cyan/5'} to-[#07070B] flex flex-col h-full group">
                <div class="flex-1">
                    <div class="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${proj.estilo === 'pink' ? 'bg-neon-pink/20 text-neon-pink shadow-[0_0_15px_rgba(255,0,127,0.3)]' : 'bg-neon-cyan/20 text-neon-cyan shadow-[0_0_15px_rgba(0,255,255,0.3)]'}">
                        <i class="fa-solid ${proj.icono} text-2xl group-hover:animate-float"></i>
                    </div>
                    <h3 class="text-2xl font-extrabold mb-2 text-white">${projName}</h3>
                    <p class="text-gray-400 text-sm mb-4 leading-relaxed">${projDesc}</p>
                </div>
                <a href="${proj.url}" target="${proj.url !== '#' ? '_blank' : '_self'}" class="${btnClass} px-6 py-3 font-bold text-sm text-center uppercase tracking-wider mt-auto rounded-lg">
                    ${_t('btn_view_project', 'Ver Proyecto')}
                </a>
            </div>
        `;
    });
}

// Renderizar Modpacks
function renderModpacks() {
    const modpacksContainer = document.getElementById('ui-modpacks-container');
    if (!modpacksContainer || !globalData?.modpacks) return;

    modpacksContainer.innerHTML = '';
    globalData.modpacks.forEach(mod => {
        const imgSrc = mod.imagen.startsWith('http') ? mod.imagen : '/' + mod.imagen;
        modpacksContainer.innerHTML += `
            <div class="glass-card flex flex-col overflow-hidden group border border-white/5 hover:border-neon-cyan/30 transition-colors h-full">
                <div class="h-32 overflow-hidden relative">
                    <img src="${imgSrc}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="${mod.nombre}">
                    <div class="absolute inset-0 bg-[#07070B]/50 group-hover:bg-transparent transition-colors duration-300"></div>
                </div>
                <div class="p-4 flex flex-col flex-1 bg-[#0B0B13]">
                    <h4 class="text-sm font-bold text-white mb-1 truncate" title="${mod.nombre}">${mod.nombre}</h4>
                    <p class="text-xs text-gray-400 line-clamp-2 mb-4 flex-1 h-8 leading-snug">${mod.desc}</p>
                    <a href="${mod.url}" target="_blank" class="bg-white/5 hover:bg-neon-cyan/20 text-gray-300 hover:text-neon-cyan border border-transparent hover:border-neon-cyan text-xs font-bold py-2 px-3 rounded-lg uppercase tracking-wider text-center transition-all duration-300 w-full flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-cube text-[10px]"></i> ${_t('btn_view_modpack', 'Ver Modpack')}
                    </a>
                </div>
            </div>
        `;
    });
}

// Escuchar cambios de idioma reactivos para actualizar contenido dinámico
window.addEventListener('jazz_language_changed', () => {
    renderAllData();
});

// MOTOR FÍSICO AVATAR
const avatarBorder = document.getElementById('avatar-border');
const avatarContainer = document.getElementById('avatar-container');
if (avatarBorder && avatarContainer) {
    let currentAngle = 0; let currentSpeed = 1; let targetSpeed = 1;  
    avatarContainer.addEventListener('mouseenter', () => targetSpeed = 9);
    avatarContainer.addEventListener('mouseleave', () => targetSpeed = 1);
    function animateAvatar() {
        currentSpeed += (targetSpeed - currentSpeed) * 0.05;
        currentAngle = (currentAngle + currentSpeed) % 360;
        avatarBorder.style.transform = `rotate(${currentAngle}deg)`;
        requestAnimationFrame(animateAvatar);
    }
    animateAvatar();
}

// BURBUJAS DE INTERACCIÓN
let lastBubble = 0;
document.addEventListener('mousemove', (e) => {
    if (window.innerWidth >= 768) {
        const now = Date.now();
        if (now - lastBubble > 50) { 
            lastBubble = now;
            const container = document.getElementById('bubbles-container');
            if (!container) return;
            const bubble = document.createElement('div');
            const size = Math.random() * 8 + 4; 
            const isCyan = Math.random() > 0.5;
            bubble.className = 'absolute rounded-full animate-bubble pointer-events-none z-50';
            bubble.style.width = size + 'px'; 
            bubble.style.height = size + 'px';
            bubble.style.left = e.clientX + 'px'; 
            bubble.style.top = e.clientY + 'px';
            bubble.style.boxShadow = isCyan ? '0 0 8px #00FFFF, inset 0 0 4px #00FFFF' : '0 0 8px #FF007F, inset 0 0 4px #FF007F';
            bubble.style.border = `1px solid ${isCyan ? '#00FFFF' : '#FF007F'}`;
            container.appendChild(bubble);
            setTimeout(() => bubble.remove(), 1000); 
        }
    }
});

// ==========================================
// MOTOR DE AUDIO, VISUALIZADOR Y AUTOPLAY
// ==========================================
let audioUnlocked = false;

function setMusicUIState(isPlaying) {
    const playBtn = document.getElementById('play-btn');
    const discIcon = document.getElementById('music-disc-icon');
    const bars = document.querySelectorAll('#audio-visualizer .wave-bar');

    if (playBtn) {
        const icon = playBtn.querySelector('i');
        if (icon) {
            if (isPlaying) {
                icon.classList.remove('fa-play');
                icon.classList.add('fa-pause');
                playBtn.classList.add('text-[#00FFFF]', 'shadow-[0_0_10px_rgba(0,255,255,0.4)]');
            } else {
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play');
                playBtn.classList.remove('text-[#00FFFF]', 'shadow-[0_0_10px_rgba(0,255,255,0.4)]');
            }
        }
    }

    if (discIcon) {
        if (isPlaying) {
            discIcon.classList.add('animate-spin');
        } else {
            discIcon.classList.remove('animate-spin');
        }
    }

    if (bars) {
        bars.forEach(bar => {
            if (isPlaying) {
                bar.classList.add('playing');
            } else {
                bar.classList.remove('playing');
            }
        });
    }
}

function startVisualizer() {
    setMusicUIState(true);
    const bars = document.querySelectorAll('#audio-visualizer .wave-bar');
    if (bars) {
        bars.forEach(bar => {
            bar.style.height = ''; // Permite que los keyframes CSS animen con aceleración GPU fluida
        });
    }
}

function stopVisualizer() {
    setMusicUIState(false);
    const restingHeights = [6, 12, 18, 10, 6];
    const bars = document.querySelectorAll('#audio-visualizer .wave-bar');
    if (bars) {
        bars.forEach((bar, i) => {
            bar.style.height = `${restingHeights[i] || 6}px`;
        });
    }
}

const GESTURE_EVENTS = [
    'pointerdown', 'mousedown', 'touchstart', 'touchend', 'click',
    'scroll', 'wheel', 'keydown', 'mousemove', 'pointermove'
];

function cleanupGestureListeners() {
    GESTURE_EVENTS.forEach(evt => {
        window.removeEventListener(evt, onFirstGestureAudioUnlock, true);
        document.removeEventListener(evt, onFirstGestureAudioUnlock, true);
    });
}

let lastAutoplayTrigger = 0;

function onFirstGestureAudioUnlock(e) {
    if (audioUnlocked) {
        cleanupGestureListeners();
        return;
    }

    // Si el usuario hizo clic directamente sobre la tarjeta de música,
    // dejamos que toggleMusic() lo gestione exclusivamente para evitar doble disparo
    if (e && e.target && e.target.closest && e.target.closest('.group\\/music, [onclick*="toggleMusic"]')) {
        audioUnlocked = true;
        cleanupGestureListeners();
        return;
    }

    const audio = document.getElementById('bg-music');
    if (audio && audio.paused) {
        audio.play().then(() => {
            audioUnlocked = true;
            lastAutoplayTrigger = Date.now();
            setMusicUIState(true);
            startVisualizer();
            cleanupGestureListeners();
        }).catch(() => {
            // Continúa escuchando hasta que el navegador apruebe el gesto
        });
    } else if (audio && !audio.paused) {
        audioUnlocked = true;
        setMusicUIState(true);
        startVisualizer();
        cleanupGestureListeners();
    }
}

function setupFirstGestureAudioUnlock() {
    if (audioUnlocked) return;
    GESTURE_EVENTS.forEach(evt => {
        window.addEventListener(evt, onFirstGestureAudioUnlock, { passive: true, capture: true });
        document.addEventListener(evt, onFirstGestureAudioUnlock, { passive: true, capture: true });
    });
}

function attemptAutoplay() {
    const audio = document.getElementById('bg-music');
    if (!audio || !audio.src) return;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            audioUnlocked = true;
            setMusicUIState(true);
            startVisualizer();
            cleanupGestureListeners();
        }).catch(() => {
            setupFirstGestureAudioUnlock();
        });
    } else {
        setupFirstGestureAudioUnlock();
    }
}

function toggleMusic() {
    const audio = document.getElementById('bg-music');
    if (!audio) return;

    audioUnlocked = true;
    cleanupGestureListeners();

    // Protección anti doble-clic: si el audio arrancó hace menos de 450ms por el gesto,
    // asegurarse de que permanezca en reproducción y no se pause por rebote
    if (Date.now() - lastAutoplayTrigger < 450) {
        if (audio.paused) {
            audio.play().catch(() => {});
        }
        setMusicUIState(true);
        startVisualizer();
        return;
    }

    if (audio.paused) {
        audio.play().then(() => {
            setMusicUIState(true);
            startVisualizer();
        }).catch(err => {
            console.warn('Error al reproducir audio:', err);
        });
    } else {
        audio.pause();
        setMusicUIState(false);
        stopVisualizer();
    }
}

// UTILIDAD DE COPIADO
function copyText(text) {
    let ta = document.createElement("textarea"); 
    ta.value = text; 
    document.body.appendChild(ta); 
    ta.select(); 
    document.execCommand('copy'); 
    ta.remove();
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    if (toast && toastMsg) {
        toastMsg.innerText = `${text} ${_t('copied', 'copiado!')}`;
        toast.classList.add('show'); 
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

// Iniciar al cargar página
document.addEventListener('DOMContentLoaded', initPortfolio);
