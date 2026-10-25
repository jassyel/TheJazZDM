/**
 * TheJazZDM Master Control Center - Controller Logic
 * Totalmente desacoplado, bilingüe (ES/EN) y libre de emojis.
 */

let db = {};
let currentPass = sessionStorage.getItem('jazz_admin_pwd') || '';
let activeConsole = 'minecraft';
let autoScrollEnabled = false;
let consolePollInterval = null;
let cmdHistory = [];
let cmdHistoryIndex = -1;
let terminalLogLines = 1000;

function sanitizeCmdInput() {
    const inp = document.getElementById('cmd-input');
    if (inp && (inp.value.includes('@') || inp.value === 'jassye1321@hotmail.com')) {
        inp.value = '';
    }
}

function setLogLines(num) {
    terminalLogLines = num;
    document.querySelectorAll('.log-lines-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.classList.remove('text-[#00FFFF]', 'bg-[#00FFFF]/10', 'border-[#00FFFF]/30', 'font-bold');
        btn.classList.add('text-gray-400');
    });
    const activeBtn = document.getElementById('lines-btn-' + num);
    if (activeBtn) {
        activeBtn.classList.add('active', 'text-[#00FFFF]', 'bg-[#00FFFF]/10', 'border-[#00FFFF]/30', 'font-bold');
        activeBtn.classList.remove('text-gray-400');
    }
    refreshActiveLogs(true);
}

let serviceTransitions = {};
let systemPoller = null;

let activeZDaemonLog = 'money';
let zdaemonTransitions = {};
let zdaemonStatusPoller = null;
let zdaemonLogsPoller = null;
let lastZDaemonData = null;

const ZDAEMON_DEFAULT_SERVICIOS = {
    money: { name: 'IDDQD Money', engine: 'ZDaemon', port: 25602, icon: 'fa-crosshairs', color: '#ef4444' },
    delta: { name: 'Delta Invasion', engine: 'ZDaemon', port: 25756, icon: 'fa-shield-halved', color: '#3b82f6' },
    la: { name: 'LA Adventure', engine: 'ZDaemon', port: 26453, icon: 'fa-location-crosshairs', color: '#10b981' },
    ctf: { name: 'ZDaemon CTF', engine: 'ZDaemon', port: 25977, icon: 'fa-flag', color: '#a855f7' }
};

// Helper i18n interno
function _t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
        return window.i18n.t(key, fallback);
    }
    return fallback !== undefined ? fallback : key;
}

// Reloj en vivo
setInterval(() => {
    const clockEl = document.getElementById('live-clock');
    if (clockEl) {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString();
    }
}, 1000);

// Auto-login si la contraseña está guardada en sessionStorage
window.addEventListener('DOMContentLoaded', () => {
    sanitizeCmdInput();
    const cmdInp = document.getElementById('cmd-input');
    if (cmdInp) {
        cmdInp.value = '';
        cmdInp.addEventListener('focus', sanitizeCmdInput);
        cmdInp.addEventListener('input', sanitizeCmdInput);
    }
    if (currentPass) {
        const pwdInput = document.getElementById('pwd');
        if (pwdInput) pwdInput.value = currentPass;
        login();
    }
});

// Listener para slider de volumen
const volSlider = document.getElementById('m-vol');
if (volSlider) {
    volSlider.addEventListener('input', function() {
        const valElem = document.getElementById('m-vol-val');
        if (valElem) valElem.innerText = this.value + "%";
    });
}

function togglePasswordVisibility(inputId, iconId) {
    const inp = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!inp || !icon) return;
    if (inp.type === 'password') {
        inp.type = 'text';
        icon.className = 'fa-regular fa-eye-slash';
    } else {
        inp.type = 'password';
        icon.className = 'fa-regular fa-eye';
    }
}

// ══════════════════════════════════════════════════
// SISTEMA DE TOASTS FLOTANTES ULTRA-MODERNO
// ══════════════════════════════════════════════════
function showToast(title, message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    
    const borderColors = {
        success: 'border-emerald-500/50 bg-[#071710]/95 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.25)]',
        error: 'border-red-500/50 bg-[#1c080d]/95 text-red-300 shadow-[0_0_25px_rgba(239,68,68,0.25)]',
        info: 'border-cyan-500/50 bg-[#07131a]/95 text-cyan-300 shadow-[0_0_25px_rgba(0,255,255,0.25)]',
        warning: 'border-amber-500/50 bg-[#1a1407]/95 text-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.25)]'
    };
    const iconMap = {
        success: 'fa-circle-check text-emerald-400',
        error: 'fa-triangle-exclamation text-red-400',
        info: 'fa-terminal text-cyan-400',
        warning: 'fa-circle-exclamation text-amber-400'
    };

    toast.className = 'toast-item pointer-events-auto p-4 rounded-xl border backdrop-blur-xl flex items-start gap-3 text-xs relative overflow-hidden ' + (borderColors[type] || borderColors.info);
    toast.innerHTML = 
        '<i class="fa-solid ' + (iconMap[type] || iconMap.info) + ' text-lg mt-0.5 shrink-0"></i>' +
        '<div class="flex-1 pr-2">' +
            '<div class="font-bold text-sm text-white">' + title + '</div>' +
            '<div class="text-gray-300 mt-0.5 leading-snug break-words">' + message + '</div>' +
        '</div>' +
        '<button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-white transition-all text-sm shrink-0"><i class="fa-solid fa-xmark"></i></button>' +
        '<div class="absolute bottom-0 left-0 h-0.5 bg-current opacity-40 transition-all duration-3000 ease-linear w-full toast-progress"></div>';

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3800);
}

// ══════════════════════════════════════════════════
// MODAL PROMETEDOR PERSONALIZADO
// ══════════════════════════════════════════════════
const Modal = {
    callback: null,
    isOpen: false,

    confirm: function(options) {
        return new Promise((resolve) => {
            this.callback = resolve;
            this.isOpen = true;

            const title = options.title || _t('confirm', '¿Confirmar Acción?');
            const subtitle = options.subtitle || 'Esta orden se ejecutará directamente en el servidor.';
            const message = options.message || '¿Deseas continuar?';
            const icon = options.icon || 'fa-triangle-exclamation';
            const confirmText = options.confirmText || _t('confirm', 'Confirmar');
            const cancelText = options.cancelText || _t('cancel', 'Cancelar');
            const isDanger = Boolean(options.danger);
            const scopeText = options.scopeText || '';

            document.getElementById('modalTitle').innerText = title;
            document.getElementById('modalSubtitle').innerText = subtitle;
            document.getElementById('modalMessage').innerHTML = message;
            document.getElementById('modalIcon').className = 'fa-solid ' + icon;
            document.getElementById('modalConfirmBtn').innerText = confirmText;
            document.getElementById('modalCancelBtn').innerText = cancelText;

            const iconWrap = document.getElementById('modalIconWrap');
            const confirmBtn = document.getElementById('modalConfirmBtn');
            const topAccent = document.getElementById('modalTopAccent');

            if (isDanger) {
                iconWrap.className = 'w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]';
                confirmBtn.className = 'btn-neon-danger text-xs py-2.5 px-5';
                topAccent.className = 'absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 to-pink-600';
            } else {
                iconWrap.className = 'w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border bg-cyan-500/10 border-cyan-500/30 text-[#00FFFF] shadow-[0_0_20px_rgba(0,255,255,0.2)]';
                confirmBtn.className = 'btn-neon text-xs py-2.5 px-5';
                topAccent.className = 'absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FF007F] via-[#00FFFF] to-[#9d4edd]';
            }

            const scopeBox = document.getElementById('modalScopeBox');
            if (scopeText) {
                scopeBox.classList.remove('hidden');
                document.getElementById('modalScopeText').innerHTML = scopeText;
            } else {
                scopeBox.classList.add('hidden');
            }

            document.getElementById('customModal').classList.remove('hidden');
        });
    },

    alert: function(title, message, icon = 'fa-circle-info') {
        return this.confirm({
            title: title,
            subtitle: 'Información del Sistema',
            message: message,
            icon: icon,
            confirmText: _t('understand', 'Entendido'),
            cancelText: _t('close', 'Cerrar')
        });
    },

    resolve: function(val) {
        document.getElementById('customModal').classList.add('hidden');
        this.isOpen = false;
        if (this.callback) {
            this.callback(val);
            this.callback = null;
        }
    },

    dismiss: function() {
        this.resolve(false);
    }
};

window.addEventListener('keydown', (e) => {
    if (!Modal.isOpen) return;
    if (e.key === 'Escape') Modal.dismiss();
    else if (e.key === 'Enter') Modal.resolve(true);
});

// ══════════════════════════════════════════════════
// AUTENTICACIÓN
// ══════════════════════════════════════════════════
async function login() {
    const pwdInput = document.getElementById('pwd');
    const loginCard = document.getElementById('loginCard');
    const loginBtn = document.getElementById('loginBtn');
    currentPass = pwdInput.value.trim();
    const msg = document.getElementById('loginMsg');
    msg.classList.add('hidden');

    if (!currentPass) {
        msg.innerText = _t('admin_login_empty', "Por favor ingresa la contraseña.");
        msg.classList.remove('hidden');
        return;
    }

    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + _t('admin_login_verifying', 'Verificando...');

    try {
        const res = await fetch('/api/admin-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPass })
        });
        const result = await res.json();
        
        if (result.success) {
            sessionStorage.setItem('jazz_admin_pwd', currentPass);
            db = result.data;
            populateForms();
            document.getElementById('loginSection').classList.add('hidden');
            document.getElementById('dashboardSection').classList.remove('hidden');
            sanitizeCmdInput();
            const cmdInp = document.getElementById('cmd-input');
            if (cmdInp) cmdInp.value = '';
            switchNavTab('services');
            checkGitHubUpdates(false);
            if (!githubCheckInterval) {
                githubCheckInterval = setInterval(() => checkGitHubUpdates(false), 60000);
            }
            showToast('TheJazZDM Master Hub', 'Sesión autenticada y centro de control listo.', 'success');
        } else {
            msg.innerText = result.message || _t('admin_login_failed', "Contraseña incorrecta. Inténtalo de nuevo.");
            msg.classList.remove('hidden');
            sessionStorage.removeItem('jazz_admin_pwd');
            loginCard.classList.remove('shake');
            void loginCard.offsetWidth;
            loginCard.classList.add('shake');
        }
    } catch (e) {
        msg.innerText = _t('admin_login_conn_err', "Error de conexión con el backend de HeavyNode.");
        msg.classList.remove('hidden');
    } finally {
        loginBtn.innerHTML = '<i class="fa-solid fa-key"></i> ' + _t('admin_login_btn', 'Entrar al Panel');
    }
}

function logout() {
    sessionStorage.removeItem('jazz_admin_pwd');
    currentPass = '';
    stopSplitServerPolling();
    stopConsolePolling();
    if (systemPoller) clearInterval(systemPoller);
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('pwd').value = '';
    showToast('Sesión Cerrada', 'Has salido del panel de control de forma segura.', 'info');
}

// ══════════════════════════════════════════════════
// NAVEGACIÓN EN PÍLDORAS
// ══════════════════════════════════════════════════
function switchNavTab(tab) {
    const btnServices = document.getElementById('nav-btn-services');
    const btnZdaemon = document.getElementById('nav-btn-zdaemon');
    const btnContent = document.getElementById('nav-btn-content');
    const viewServices = document.getElementById('view-services');
    const viewZdaemon = document.getElementById('view-zdaemon');
    const viewContent = document.getElementById('view-content');

    // Reset styles
    [btnServices, btnZdaemon, btnContent].forEach(btn => {
        if (btn) btn.className = 'tab-nav px-3 sm:px-4 md:px-5 py-2 rounded-full text-xs font-bold text-gray-400 hover:text-white transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 whitespace-nowrap';
    });

    [viewServices, viewZdaemon, viewContent].forEach(view => {
        if (view) view.classList.add('hidden');
    });

    if (tab === 'services') {
        if (btnServices) btnServices.className = 'tab-nav active px-3 sm:px-4 md:px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 whitespace-nowrap';
        if (viewServices) viewServices.classList.remove('hidden');
        stopSplitServerPolling();
        fetchSystemStatus();
        startConsolePolling();
    } else if (tab === 'zdaemon') {
        if (btnZdaemon) btnZdaemon.className = 'tab-nav active px-3 sm:px-4 md:px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer text-[#fca5a5] border-[#ef4444]/60 bg-[#ef4444]/20 shadow-[0_0_20px_rgba(239,68,68,0.25)] shrink-0 whitespace-nowrap';
        if (viewZdaemon) viewZdaemon.classList.remove('hidden');
        stopConsolePolling();
        fetchSplitServerStatus();
        fetchSplitServerLogs(activeZDaemonLog);
        startSplitServerPolling();
    } else {
        if (btnContent) btnContent.className = 'tab-nav active px-3 sm:px-4 md:px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 whitespace-nowrap';
        if (viewContent) viewContent.classList.remove('hidden');
        stopConsolePolling();
        stopSplitServerPolling();
    }
}

// ══════════════════════════════════════════════════
// GESTIÓN DEL SPLIT SERVER (ZDAEMON / DOOM)
// ══════════════════════════════════════════════════
function selectZDaemonLogTab(serviceKey) {
    activeZDaemonLog = serviceKey;
    document.querySelectorAll('.zd-log-tab').forEach(tab => {
        tab.className = 'zd-log-tab px-3 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition-all flex items-center gap-1.5';
    });
    const currentBtn = document.getElementById(`zd-tab-${serviceKey}`);
    if (currentBtn) {
        currentBtn.className = 'zd-log-tab active px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5';
    }
    fetchSplitServerLogs(serviceKey);
}

function startSplitServerPolling() {
    stopSplitServerPolling();
    zdaemonStatusPoller = setInterval(() => {
        fetchSplitServerStatus();
    }, 4000);
    zdaemonLogsPoller = setInterval(() => {
        const autoRefresh = document.getElementById('zd-autorefresh');
        if (autoRefresh && autoRefresh.checked) {
            fetchSplitServerLogs(activeZDaemonLog);
        }
    }, 3000);
}

function stopSplitServerPolling() {
    if (zdaemonStatusPoller) clearInterval(zdaemonStatusPoller);
    if (zdaemonLogsPoller) clearInterval(zdaemonLogsPoller);
    zdaemonStatusPoller = null;
    zdaemonLogsPoller = null;
}

async function checkSplitServerBackgroundStatus() {
    try {
        const res = await fetch('/api/split-server/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPass })
        });
        const data = await res.json();
        const tabBadge = document.getElementById('zdaemon-tab-badge');
        if (tabBadge) {
            tabBadge.className = data.online ? 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse' : 'w-2 h-2 rounded-full bg-red-500';
        }
    } catch {}
}

async function fetchSplitServerStatus(showToastFlag = false) {
    try {
        const res = await fetch('/api/split-server/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPass })
        });
        const data = await res.json();
        lastZDaemonData = data;

        const connBadge = document.getElementById('zd-conn-badge');
        const tabBadge = document.getElementById('zdaemon-tab-badge');
        const offlineAlert = document.getElementById('zd-offline-alert');

        if (data.online) {
            if (connBadge) {
                connBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 flex items-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.25)]';
                connBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> ' + _t('admin_zd_connected', 'CONECTADO');
            }
            if (tabBadge) {
                tabBadge.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
            }
            if (offlineAlert) offlineAlert.classList.add('hidden');

            if (data.ram) {
                const used = data.ram.used || 0;
                const total = data.ram.total || 6144;
                const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
                const usedElem = document.getElementById('zd-ram-used');
                const totalElem = document.getElementById('zd-ram-total');
                const pctElem = document.getElementById('zd-ram-pct');
                const barElem = document.getElementById('zd-ram-bar');
                if (usedElem) usedElem.innerText = used;
                if (totalElem) totalElem.innerText = total;
                if (pctElem) pctElem.innerText = pct + '%';
                if (barElem) barElem.style.width = pct + '%';
            }

            if (data.cpu) {
                const cpuElem = document.getElementById('zd-cpu-used');
                if (cpuElem) cpuElem.innerText = data.cpu;
            }

            if (data.uptime !== undefined) {
                const h = Math.floor(data.uptime / 3600);
                const m = Math.floor((data.uptime % 3600) / 60);
                const upElem = document.getElementById('zd-uptime');
                if (upElem) upElem.innerText = 'Uptime: ' + h + 'h ' + m + 'm';
            }

            if (data.services) {
                renderZDaemonGrid(data.services);
            }

            if (showToastFlag) {
                showToast('Split Server Sincronizado', 'Métricas y estados actualizados desde 185.73.243.42:25765', 'success');
            }
        } else {
            if (connBadge) {
                connBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-500/15 text-red-400 border-red-500/30 flex items-center gap-1';
                connBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-red-400"></span> ' + _t('admin_zd_disconnected', 'DESCONECTADO');
            }
            if (tabBadge) {
                tabBadge.className = 'w-2 h-2 rounded-full bg-red-500';
            }
            if (offlineAlert) offlineAlert.classList.remove('hidden');

            renderZDaemonGrid(null);

            if (showToastFlag) {
                showToast('Split Server Desconectado', data.message || 'No se pudo contactar el agente en 185.73.243.42:25765', 'warning');
            }
        }
    } catch (e) {
        console.error('Error consultando Split Server:', e);
    }
}

function renderZDaemonGrid(services) {
    const grid = document.getElementById('zdaemon-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (const [key, def] of Object.entries(ZDAEMON_DEFAULT_SERVICIOS)) {
        const s = (services && services[key]) ? services[key] : { ...def, running: false, pid: null, memoryMb: 0 };
        const trans = zdaemonTransitions[key];
        const isTransitioning = Boolean(trans);

        let badgeHtml = '';
        if (isTransitioning) {
            badgeHtml = `<span class="animate-pulse bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                <i class="fa-solid fa-spinner fa-spin text-[9px]"></i> ${trans.text}
            </span>`;
        } else if (s.running) {
            badgeHtml = `<span class="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> ${_t('admin_status_running', 'En Línea')}
            </span>`;
        } else {
            badgeHtml = `<span class="bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span> ${_t('admin_status_stopped', 'Apagado')}
            </span>`;
        }

        let subText = '';
        if (s.running) {
            subText = `RAM: <span class="text-white font-bold">${s.memoryMb}</span> MB ${s.pid ? '| PID: ' + s.pid : ''}`;
        } else {
            subText = `<span class="text-gray-500 font-sans">Inactivo (0 MB)</span>`;
        }

        let buttonsHtml = '';
        if (isTransitioning) {
            buttonsHtml = `
                <button disabled class="btn-action flex-1 py-2.5 text-xs font-bold text-amber-300 bg-amber-500/10 border-amber-500/30 btn-disabled flex items-center justify-center gap-2">
                    <i class="fa-solid fa-spinner fa-spin"></i> ${trans.text}
                </button>
            `;
        } else if (s.running) {
            buttonsHtml = `
                <button onclick="actionSplitServer('${key}', 'stop')" class="btn-action btn-action-danger flex-1 py-2.5 text-xs font-bold" title="Detener ${def.name}">
                    <i class="fa-solid fa-power-off"></i> ${_t('admin_btn_stop', 'Detener')}
                </button>
                <button onclick="actionSplitServer('${key}', 'restart')" class="btn-action btn-restart flex-1 py-2.5 text-xs font-bold" title="Reiniciar ${def.name}">
                    <i class="fa-solid fa-rotate"></i> ${_t('admin_btn_restart', 'Reiniciar')}
                </button>
            `;
        } else {
            buttonsHtml = `
                <button onclick="actionSplitServer('${key}', 'start')" class="btn-action btn-start flex-1 py-2.5 text-xs font-bold" title="Encender ${def.name}">
                    <i class="fa-solid fa-play"></i> ${_t('admin_btn_start', 'ENCENDER')}
                </button>
            `;
        }

        const card = document.createElement('div');
        card.className = `glass-panel p-4 flex flex-col justify-between border transition-all duration-300 relative overflow-hidden group ${isTransitioning ? 'border-amber-500/40 bg-[#16120e]' : s.running ? 'border-white/10 hover:border-[#ef4444]/40 hover:shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-white/5 opacity-80'}`;

        card.innerHTML = `
            <div class="flex items-start justify-between gap-3 mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border"
                         style="background: ${def.color}15; border-color: ${def.color}40; color: ${def.color}">
                        <i class="fa-solid ${def.icon}"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="font-bold text-sm text-white group-hover:text-[#f87171] transition-colors">${def.name}</h3>
                            <span class="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 uppercase">${def.engine}</span>
                        </div>
                        <div class="text-[11px] font-mono text-gray-400 mt-0.5">
                            ${subText}
                        </div>
                    </div>
                </div>
                <div>${badgeHtml}</div>
            </div>

            <div class="flex items-center justify-between text-[11px] font-mono text-gray-400 border-t border-white/5 pt-2.5 mb-3">
                <span>Puerto: <strong class="text-white">UDP ${def.port}</strong></span>
                <div class="flex items-center gap-2.5">
                    ${key === 'money' ? `<a href="/stats/" target="_blank" class="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline text-[10px]" title="Ver Web de Estadísticas IDDQD"><i class="fa-solid fa-chart-simple text-[10px]"></i> Stats Web</a>` : ''}
                    <button onclick="selectZDaemonLogTab('${key}'); document.getElementById('zd-terminal-content').scrollIntoView({behavior:'smooth'});" class="text-gray-400 hover:text-white flex items-center gap-1 hover:underline text-[10px]">
                        <i class="fa-solid fa-terminal text-[10px]"></i> ${_t('admin_btn_console', 'Ver Consola')}
                    </button>
                </div>
            </div>

            <div class="flex items-center gap-2">
                ${buttonsHtml}
            </div>
        `;
        grid.appendChild(card);
    }
}

async function actionSplitServer(serviceKey, action) {
    const actionNames = {
        start: _t('admin_status_starting', 'Iniciando...'),
        stop: _t('admin_status_stopping', 'Deteniendo...'),
        restart: _t('admin_status_restarting', 'Reiniciando...')
    };

    if (serviceKey === 'all') {
        const confirm = await Modal.confirm({
            title: `¿${action.toUpperCase()} todos los servidores Doom?`,
            subtitle: 'Split Server (185.73.243.42:25765)',
            message: `Esta orden afectará a los 4 servidores ZDaemon. El servidor principal de Minecraft NO se tocará.`,
            danger: action === 'stop',
            icon: action === 'stop' ? 'fa-power-off' : 'fa-play'
        });
        if (!confirm) return;

        Object.keys(ZDAEMON_DEFAULT_SERVICIOS).forEach(k => {
            zdaemonTransitions[k] = { action, text: actionNames[action] || 'Procesando...' };
        });
        renderZDaemonGrid(lastZDaemonData ? lastZDaemonData.services : null);
    } else {
        zdaemonTransitions[serviceKey] = { action, text: actionNames[action] || 'Procesando...' };
        renderZDaemonGrid(lastZDaemonData ? lastZDaemonData.services : null);
    }

    try {
        const res = await fetch('/api/split-server/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: currentPass,
                service: serviceKey,
                action: action
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Orden Ejecutada', data.message || 'La acción se ejecutó con éxito en el Split Server.', 'success');
            
            // Actualización optimista inmediata en memoria
            if (lastZDaemonData && lastZDaemonData.services) {
                if (data.service) {
                    lastZDaemonData.services[serviceKey] = data.service;
                } else if (action === 'stop' && lastZDaemonData.services[serviceKey]) {
                    lastZDaemonData.services[serviceKey].running = false;
                    lastZDaemonData.services[serviceKey].pid = null;
                    lastZDaemonData.services[serviceKey].memoryMb = 0;
                    lastZDaemonData.services[serviceKey].desired = false;
                }
            }
        } else {
            showToast('Aviso', data.message || 'El Split Server respondió con advertencia.', 'warning');
        }
    } catch {
        showToast('Error', 'Fallo de conexión enviando orden al Split Server.', 'error');
    } finally {
        if (serviceKey === 'all') {
            zdaemonTransitions = {};
        } else {
            delete zdaemonTransitions[serviceKey];
        }
        if (lastZDaemonData && lastZDaemonData.services) {
            renderZDaemonGrid(lastZDaemonData.services);
        }
        setTimeout(async () => {
            await fetchSplitServerStatus();
        }, 1200);
    }
}

async function fetchSplitServerLogs(serviceKey = activeZDaemonLog) {
    try {
        const res = await fetch('/api/split-server/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: currentPass,
                service: serviceKey,
                lines: 150
            })
        });
        const data = await res.json();
        const pre = document.getElementById('zd-terminal-content');
        if (pre) {
            if (data.success && data.logs) {
                pre.textContent = data.logs;
                const autoScroll = document.getElementById('zd-autoscroll');
                if (autoScroll && autoScroll.checked) {
                    pre.scrollTop = pre.scrollHeight;
                }
            } else {
                pre.textContent = data.message || '[No hay registros disponibles para este servicio]';
            }
        }
    } catch (e) {
        console.error('Error obteniendo logs del Split Server:', e);
    }
}

function copyZDaemonLogs() {
    const pre = document.getElementById('zd-terminal-content');
    if (pre && pre.textContent) {
        copyToClipboard(pre.textContent);
        showToast('Logs Copiados', 'El registro de consola ZDaemon se ha copiado al portapapeles.', 'info');
    }
}

function clearZDaemonTerminal() {
    const pre = document.getElementById('zd-terminal-content');
    if (pre) {
        pre.textContent = '[Terminal limpiado por el usuario]';
    }
}

// ══════════════════════════════════════════════════
// ESTADO GENERAL & SERVICIOS DE HEAVYNODE
// ══════════════════════════════════════════════════
function updateSystemStatsUI(data) {
    if (data.ram) {
        const used = data.ram.used || 0;
        const total = data.ram.total || 6000;
        const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
        
        document.getElementById('ram-used').innerText = used;
        document.getElementById('ram-total').innerText = total;
        document.getElementById('ram-pct').innerText = pct + '%';
        document.getElementById('ram-bar').style.width = pct + '%';
        
        const ramMax = document.getElementById('ram-max-display');
        if (ramMax) ramMax.innerText = total + ' MB';
    }

    if (data.uptime !== undefined) {
        const uptimeEl = document.getElementById('uptime-display');
        if (uptimeEl) {
            const h = Math.floor(data.uptime / 3600);
            const m = Math.floor((data.uptime % 3600) / 60);
            uptimeEl.innerText = `${_t('admin_uptime', 'Tiempo Activo')}: ${h}h ${m}m`;
        }
    }

    if (data.visitas !== undefined) {
        const vEl = document.getElementById('dash-visitas');
        if (vEl) vEl.innerText = data.visitas;
    }

    // Banner de reinicio con cuenta regresiva activa
    const cdBanner = document.getElementById('countdown-banner');
    const cdTimerText = document.getElementById('countdown-timer-text');
    if (data.activeCountdown && data.activeCountdown.remainingSeconds > 0) {
        if (cdBanner) cdBanner.classList.remove('hidden');
        if (cdTimerText) {
            const remSec = data.activeCountdown.remainingSeconds;
            const m = Math.floor(remSec / 60);
            const s = remSec % 60;
            cdTimerText.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
    } else {
        if (cdBanner) cdBanner.classList.add('hidden');
    }
}

async function fetchSystemStatus(showNotification = false) {
    if (!currentPass) return;
    try {
        const res = await fetch('/api/system/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPass })
        });
        const data = await res.json();
        if (data.success) {
            updateSystemStatsUI(data);
            if (data.services) {
                renderServicesGrid(data.services);
            }
            if (data.schedules) {
                populateSchedules(data.schedules);
            }
            if (showNotification) {
                showToast('Estados Sincronizados', 'Información en vivo actualizada.', 'success');
            }
        }
    } catch (e) {
        console.error('Error fetching system status:', e);
    }
}

function startStatePolling(service, action, serviceName) {
    const targetRunning = action === 'start';
    let attempts = 0;
    const maxAttempts = 15;

    const interval = setInterval(async () => {
        attempts++;
        try {
            const res = await fetch('/api/system/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: currentPass })
            });
            const data = await res.json();
            if (data.success && data.services) {
                const s = data.services[service];
                if (action === 'restart') {
                    if (s && s.running && attempts > 2) {
                        delete serviceTransitions[service];
                        renderServicesGrid(data.services);
                        clearInterval(interval);
                        showToast('Servicio Reiniciado', `${serviceName} está en línea y operando con normalidad.`, 'success');
                        return;
                    }
                } else if (s && s.running === targetRunning) {
                    delete serviceTransitions[service];
                    renderServicesGrid(data.services);
                    clearInterval(interval);
                    showToast(
                        targetRunning ? 'Servicio Iniciado' : 'Servicio Apagado',
                        `${serviceName} ahora está ${targetRunning ? 'en línea' : 'apagado'}.`,
                        'success'
                    );
                    return;
                }
            }
        } catch {}

        if (attempts >= maxAttempts) {
            delete serviceTransitions[service];
            clearInterval(interval);
            fetchSystemStatus();
            showToast('Aviso de Transición', `Se completó la orden para ${serviceName}. Verifica el estado en consola si tarda en responder.`, 'info');
        }
    }, 2000);
}

function renderServicesGrid(services) {
    const grid = document.getElementById('services-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (const [key, s] of Object.entries(services)) {
        const trans = serviceTransitions[key];
        const isTransitioning = Boolean(trans);

        let badgeHtml = '';
        if (isTransitioning) {
            const badgeStyles = {
                stop: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                start: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                restart: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
            };
            const style = badgeStyles[trans.action] || badgeStyles.restart;
            badgeHtml = `<span class="animate-pulse ${style} text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 shadow-sm">
                <i class="fa-solid fa-spinner fa-spin text-[9px]"></i> ${trans.text}
            </span>`;
        } else if (s.running) {
            badgeHtml = `<span class="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> ${_t('admin_status_running', 'En Línea')}
            </span>`;
        } else {
            if (s.manualStopped) {
                badgeHtml = `<span class="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    <i class="fa-solid fa-pause text-[9px]"></i> Pausado
                </span>`;
            } else {
                badgeHtml = `<span class="bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span> ${_t('admin_status_stopped', 'Apagado')}
                </span>`;
            }
        }

        let subText = '';
        if (s.running) {
            subText = `RAM: <span class="text-white font-bold">${s.memoryMb}</span> MB ${s.pid ? '| PID: ' + s.pid : ''}`;
        } else {
            subText = `<span class="text-gray-500 font-sans">Inactivo (0 MB)</span>`;
        }

        let buttonsHtml = '';
        if (key === 'portfolio') {
            if (isTransitioning) {
                buttonsHtml = `
                    <button disabled class="btn-action flex-1 py-2.5 text-xs text-emerald-400/60 btn-disabled">
                        <i class="fa-solid fa-spinner fa-spin"></i> ${_t('admin_status_restarting', 'Reiniciando...')}
                    </button>
                `;
            } else {
                buttonsHtml = `
                    <button onclick="serviceAction('portfolio', 'restart', 'Portafolio Web')" class="btn-action btn-restart flex-1 py-2.5 text-xs font-bold">
                        <i class="fa-solid fa-rotate-right"></i> ${_t('admin_btn_restart', 'Reiniciar')}
                    </button>
                `;
            }
        } else {
            if (isTransitioning) {
                buttonsHtml = `
                    <button disabled class="btn-action flex-1 py-2.5 text-xs font-bold text-amber-300 bg-amber-500/10 border-amber-500/30 btn-disabled flex items-center justify-center gap-2">
                        <i class="fa-solid fa-spinner fa-spin"></i> ${trans.text}
                    </button>
                `;
            } else if (!s.running) {
                buttonsHtml = `
                    <button onclick="serviceAction('${key}', 'start', '${s.name}')" class="btn-action btn-start flex-1 py-2.5 text-xs font-extrabold tracking-wider uppercase flex items-center justify-center gap-2" title="Encender ${s.name}">
                        <i class="fa-solid fa-play text-[11px]"></i> ${_t('admin_btn_start', 'Encender')}
                    </button>
                `;
            } else {
                buttonsHtml = `
                    <button onclick="serviceAction('${key}', 'restart', '${s.name}')" class="btn-action btn-restart flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 truncate" title="Reiniciar proceso limpiamente">
                        <i class="fa-solid fa-rotate-right text-[11px] shrink-0"></i> <span class="truncate">${_t('admin_btn_restart', 'Reiniciar')}</span>
                    </button>
                    <button onclick="serviceAction('${key}', 'stop', '${s.name}')" class="btn-action btn-action-danger text-red-400 border border-red-500/30 hover:bg-red-500/20 px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5 shrink-0" title="Apagar proceso">
                        <i class="fa-solid fa-stop text-[11px]"></i> <span class="hidden sm:inline">${_t('admin_btn_stop', 'Apagar')}</span>
                    </button>
                `;
            }
        }

        buttonsHtml += `
            <button onclick="selectConsole('${key}')" class="btn-action text-xs px-3 py-2 hover:border-[#00FFFF]/50 hover:text-[#00FFFF] shrink-0" title="Ver log en consola">
                <i class="fa-solid fa-terminal text-[11px]"></i>
            </button>
        `;

        const card = document.createElement('div');
        card.className = 'glass-panel p-3.5 sm:p-5 flex flex-col justify-between gap-3 sm:gap-4 border border-white/5 relative group hover:border-[#00FFFF]/30 transition-all rounded-xl';

        card.innerHTML = `
            <div class="flex justify-between items-start gap-2.5 sm:gap-3">
                <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-base sm:text-lg shrink-0" style="background: ${s.color}15; color: ${s.color}; border: 1px solid ${s.color}40">
                        <i class="fa-solid ${s.icon}"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="font-bold text-xs sm:text-sm text-white truncate">${s.name}</div>
                        <div class="text-[10px] sm:text-[11px] text-gray-400 font-mono mt-0.5 truncate">${subText}</div>
                    </div>
                </div>
                <div class="shrink-0">
                    ${badgeHtml}
                </div>
            </div>
            <div class="flex items-center gap-1.5 sm:gap-2 pt-2.5 sm:pt-3 border-t border-white/5">
                ${buttonsHtml}
            </div>
        `;

        grid.appendChild(card);
    }
}

// ══════════════════════════════════════════════════
// MODAL REINICIO MINECRAFT
// ══════════════════════════════════════════════════
function openMcRestartModal() {
    document.getElementById('mcRestartModal').classList.remove('hidden');
}

function closeMcRestartModal() {
    document.getElementById('mcRestartModal').classList.add('hidden');
}

async function executeMcRestartWithCountdown(seconds) {
    closeMcRestartModal();
    try {
        const res = await fetch('/api/system/countdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPass, action: 'start', seconds: seconds })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Cuenta Regresiva Iniciada', `Minecraft se reiniciará en ${seconds / 60} minuto(s) con avisos automáticos a los jugadores.`, 'info');
            fetchSystemStatus();
        } else {
            showToast('Error', data.message || 'No se pudo iniciar la cuenta regresiva.', 'error');
        }
    } catch {
        showToast('Error', 'Fallo de conexión al programar reinicio.', 'error');
    }
}

async function executeMcRestartDirect() {
    closeMcRestartModal();
    controlService('minecraft', 'restart', 'Minecraft (Folia / Canvas)');
}

async function cancelActiveCountdown() {
    const confirm = await Modal.confirm({
        title: '¿Cancelar Cuenta Regresiva de Minecraft?',
        subtitle: 'Servidor Folia / Canvas',
        message: 'Se detendrá la secuencia de reinicio y se enviará un anuncio al chat avisando que el reinicio fue abortado.',
        confirmText: 'Sí, Cancelar',
        cancelText: 'Volver',
        danger: true
    });
    if (!confirm) return;

    try {
        const res = await fetch('/api/system/countdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPass, action: 'cancel' })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Reinicio Cancelado', 'La cuenta regresiva ha sido abortada con éxito.', 'success');
            fetchSystemStatus();
        } else {
            showToast('Aviso', data.message || 'No se pudo cancelar el reinicio.', 'warning');
        }
    } catch {
        showToast('Error', 'Fallo de conexión cancelando la cuenta regresiva.', 'error');
    }
}

async function serviceAction(service, action, serviceName) {
    if (service === 'minecraft' && action === 'restart') {
        openMcRestartModal();
        return;
    }

    if (action === 'stop') {
        const confirm = await Modal.confirm({
            title: `¿Detener ${serviceName}?`,
            subtitle: 'Aislamiento de Procesos',
            message: `¿Estás seguro de que deseas detener <strong>${serviceName}</strong>? Los demás servicios continuarán en ejecución sin verse afectados.`,
            danger: true,
            icon: 'fa-power-off'
        });
        if (!confirm) return;
    }
    controlService(service, action, serviceName);
}

async function controlService(service, action, serviceName) {
    const actionTexts = {
        stop: _t('admin_status_stopping', 'Deteniendo...'),
        start: _t('admin_status_starting', 'Iniciando...'),
        restart: _t('admin_status_restarting', 'Reiniciando...')
    };
    serviceTransitions[service] = { action, text: actionTexts[action] || 'Procesando...' };

    try {
        const resCurrent = await fetch('/api/system/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPass })
        });
        const dataCurrent = await resCurrent.json();
        if (dataCurrent.services) {
            renderServicesGrid(dataCurrent.services);
        }
    } catch {}

    try {
        const res = await fetch('/api/system/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPass, service: service, action: action })
        });
        const data = await res.json();

        if (data.success) {
            startStatePolling(service, action, serviceName);
        } else {
            delete serviceTransitions[service];
            showToast('Error en Servicio', data.message || 'No se pudo completar la operación.', 'error');
            fetchSystemStatus();
        }
    } catch (e) {
        delete serviceTransitions[service];
        showToast('Error de Red', 'Fallo de conexión enviando orden.', 'error');
        fetchSystemStatus();
    }
}

// ══════════════════════════════════════════════════
// TERMINAL MULTI-CONSOLA EN VIVO
// ══════════════════════════════════════════════════
function selectConsole(service) {
    activeConsole = service;

    const names = {
        minecraft: 'Minecraft (Folia / Canvas)',
        velocity: 'Velocity Proxy',
        exolive: 'ExoLive V2',
        portfolio: 'Portafolio Web'
    };

    const badge = document.getElementById('active-console-badge');
    if (badge) badge.innerText = names[service] || service;

    const placeholders = {
        minecraft: 'Comando Minecraft (ej: list, tps, time set day, save-all, op)...',
        velocity: 'Comando Velocity Proxy (ej: glist, velocity reload, server, alert)...',
        exolive: 'Comando o control de ExoLive V2 (ej: status, reload, ping, restart)...',
        portfolio: 'Comando o control del Portafolio Web (ej: status, reload, cache)...'
    };

    const cmdInput = document.getElementById('cmd-input');
    if (cmdInput) {
        cmdInput.placeholder = placeholders[service] || `Comando para ${names[service] || service}...`;
    }

    const chips = {
        minecraft: `
            <span class="text-emerald-400 font-sans font-bold">Comandos Minecraft:</span>
            <button onclick="runQuickCmd('say ¡Hola a todos!')" class="px-2 py-0.5 rounded bg-[#00FFFF]/10 text-[#00FFFF] hover:bg-[#00FFFF]/20 transition-all">say</button>
            <button onclick="runQuickCmd('list')" class="px-2 py-0.5 rounded bg-white/5 hover:bg-[#00FFFF]/20 hover:text-[#00FFFF] transition-all">list</button>
            <button onclick="runQuickCmd('tps')" class="px-2 py-0.5 rounded bg-white/5 hover:bg-[#00FFFF]/20 hover:text-[#00FFFF] transition-all">tps</button>
            <button onclick="runQuickCmd('time set day')" class="px-2 py-0.5 rounded bg-white/5 hover:bg-[#00FFFF]/20 hover:text-[#00FFFF] transition-all">día</button>
            <button onclick="runQuickCmd('weather clear')" class="px-2 py-0.5 rounded bg-white/5 hover:bg-[#00FFFF]/20 hover:text-[#00FFFF] transition-all">despejar</button>
            <button onclick="runQuickCmd('save-all')" class="px-2 py-0.5 rounded bg-white/5 hover:bg-[#00FFFF]/20 hover:text-[#00FFFF] transition-all">save-all</button>
        `,
        velocity: `
            <span class="text-amber-400 font-sans font-bold">Comandos Velocity:</span>
            <button onclick="runQuickCmd('glist')" class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all">glist</button>
            <button onclick="runQuickCmd('velocity reload')" class="px-2 py-0.5 rounded bg-white/5 hover:bg-amber-500/20 hover:text-amber-400 transition-all">reload</button>
            <button onclick="runQuickCmd('server')" class="px-2 py-0.5 rounded bg-white/5 hover:bg-amber-500/20 hover:text-amber-400 transition-all">server</button>
        `,
        exolive: `
            <span class="text-purple-400 font-sans font-bold">Acciones ExoLive:</span>
            <button onclick="runQuickCmd('status')" class="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-all">status</button>
            <button onclick="runQuickCmd('ping')" class="px-2 py-0.5 rounded bg-white/5 hover:bg-purple-500/20 hover:text-purple-300 transition-all">ping</button>
            <button onclick="runQuickCmd('reload')" class="px-2 py-0.5 rounded bg-white/5 hover:bg-purple-500/20 hover:text-purple-300 transition-all">reload</button>
            <button onclick="runQuickCmd('restart')" class="px-2 py-0.5 rounded bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-all">reiniciar</button>
        `,
        portfolio: `
            <span class="text-cyan-400 font-sans font-bold">Acciones Portafolio:</span>
            <button onclick="runQuickCmd('status')" class="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-all">status</button>
            <button onclick="runQuickCmd('reload')" class="px-2 py-0.5 rounded bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all">reload</button>
            <button onclick="runQuickCmd('cache')" class="px-2 py-0.5 rounded bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all">cache</button>
        `
    };

    const chipsContainer = document.getElementById('cmd-quick-chips');
    if (chipsContainer) {
        chipsContainer.innerHTML = chips[service] || '';
    }

    const promptLabel = document.getElementById('cmd-prompt-label');
    if (promptLabel) {
        const prompts = { minecraft: 'MC >', velocity: 'VEL >', exolive: 'EXO >', portfolio: 'WEB >' };
        const colors = { minecraft: '#00FFFF', velocity: '#f59e0b', exolive: '#a855f7', portfolio: '#06b6d4' };
        promptLabel.innerText = prompts[service] || '>_';
        promptLabel.style.color = colors[service] || '#00FFFF';
    }

    ['minecraft', 'velocity', 'exolive', 'portfolio'].forEach(c => {
        const btn = document.getElementById(`cbtn-${c}`);
        if (btn) {
            if (c === service) {
                btn.className = 'console-tab-btn active flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-lg font-bold transition-all cursor-pointer bg-[#00FFFF]/15 text-[#00FFFF] border border-[#00FFFF]/40 shadow-[0_0_15px_rgba(0,255,255,0.15)]';
            } else {
                btn.className = 'console-tab-btn flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-lg font-semibold transition-all cursor-pointer bg-white/[0.02] text-gray-400 hover:text-white hover:bg-white/[0.05] border border-white/5';
            }
        }
    });

    sanitizeCmdInput();
    refreshActiveLogs(true);
}

function formatLogText(rawText) {
    if (!rawText) return '<span class="text-gray-600">[Log vacío]</span>';
    
    // Escapar HTML
    let escaped = rawText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Destacar palabras clave en terminal
    escaped = escaped
        .replace(/(\[INFO\]|INFO:?)/g, '<span class="text-emerald-400 font-bold">$1</span>')
        .replace(/(\[WARN\]|\[WARNING\]|WARN:?|WARNING:?)/g, '<span class="text-amber-400 font-bold">$1</span>')
        .replace(/(\[ERROR\]|\[FATAL\]|ERROR:?|FATAL:?|Exception|Error:)/g, '<span class="text-red-400 font-bold">$1</span>')
        .replace(/(\[REINICIO\]|\[COUNTDOWN\]|\[Aviso\])/g, '<span class="text-cyan-300 font-extrabold">$1</span>')
        .replace(/(§[0-9a-fk-or])/g, '');

    return escaped;
}

async function refreshActiveLogs(manual = false) {
    if (!currentPass) return;
    try {
        const res = await fetch('/api/system/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPass, service: activeConsole, lines: terminalLogLines })
        });
        const data = await res.json();
        const term = document.getElementById('console-terminal');
        if (term) {
            // Optimización de rendimiento: Si el contenido no cambió, evitar repintar el DOM (CERO LAG)
            if (term.dataset.lastRawLogs === data.logs && !manual) {
                return;
            }
            term.dataset.lastRawLogs = data.logs;
            term.innerHTML = formatLogText(data.logs || '[Sin datos en el stream]');
            if (autoScrollEnabled) {
                term.scrollTop = term.scrollHeight;
            }
        }
        if (manual) {
            showToast('Terminal Actualizado', `Consola ${activeConsole} sincronizada (${terminalLogLines} líneas).`, 'info');
        }
    } catch (e) {
        console.error('Error fetching logs:', e);
    }
}

function toggleAutoScroll() {
    autoScrollEnabled = !autoScrollEnabled;
    const btn = document.getElementById('autoscroll-btn');
    if (btn) {
        if (autoScrollEnabled) {
            btn.innerHTML = '<i class="fa-solid fa-arrow-down"></i> Auto-Scroll: ON';
            btn.className = 'btn-action text-xs text-[#00FFFF] border-[#00FFFF]/40';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-arrow-down"></i> Auto-Scroll: OFF';
            btn.className = 'btn-action text-xs text-gray-500 border-white/10';
        }
    }
}

function clearTerminalView() {
    const term = document.getElementById('console-terminal');
    if (term) term.innerHTML = '<span class="text-gray-500">[Consola limpiada por el usuario]</span>';
}

function copyToClipboard(text) {
    let ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
}

function copyTerminalLogs() {
    const term = document.getElementById('console-terminal');
    if (term) {
        copyToClipboard(term.innerText);
        showToast('Logs Copiados', 'El registro visible de la terminal se ha copiado al portapapeles.', 'info');
    }
}

function downloadTerminalLog() {
    const term = document.getElementById('console-terminal');
    if (!term) return;
    const blob = new Blob([term.innerText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log_${activeConsole}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Descarga Iniciada', `Guardando archivo de registro para ${activeConsole}.`, 'info');
}

function runQuickCmd(cmd) {
    const inp = document.getElementById('cmd-input');
    if (inp) {
        inp.value = cmd;
        sendConsoleCommand();
    }
}

async function sendConsoleCommand() {
    const inp = document.getElementById('cmd-input');
    if (!inp) return;
    const cmd = inp.value.trim();
    if (!cmd) return;

    cmdHistory.push(cmd);
    cmdHistoryIndex = cmdHistory.length;
    inp.value = '';

    try {
        const res = await fetch('/api/system/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPass, service: activeConsole, target: activeConsole, command: cmd })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Comando Enviado', `/${cmd} enviado a ${activeConsole}.`, 'success');
            setTimeout(refreshActiveLogs, 400);
        } else {
            showToast('Aviso', data.message || 'El servicio no pudo procesar la entrada.', 'warning');
        }
    } catch {
        showToast('Error', 'Fallo de comunicación enviando el comando.', 'error');
    }
}

// Historial con flechas arriba/abajo en consola
document.addEventListener('keydown', (e) => {
    const inp = document.getElementById('cmd-input');
    if (document.activeElement === inp) {
        if (e.key === 'Enter') {
            sendConsoleCommand();
        } else if (e.key === 'ArrowUp') {
            if (cmdHistoryIndex > 0) {
                cmdHistoryIndex--;
                inp.value = cmdHistory[cmdHistoryIndex] || '';
            }
        } else if (e.key === 'ArrowDown') {
            if (cmdHistoryIndex < cmdHistory.length - 1) {
                cmdHistoryIndex++;
                inp.value = cmdHistory[cmdHistoryIndex] || '';
            } else {
                cmdHistoryIndex = cmdHistory.length;
                inp.value = '';
            }
        }
    }
});

function startConsolePolling() {
    stopConsolePolling();
    refreshActiveLogs();
    consolePollInterval = setInterval(refreshActiveLogs, 2500);
}

function stopConsolePolling() {
    if (consolePollInterval) clearInterval(consolePollInterval);
    consolePollInterval = null;
}

// ══════════════════════════════════════════════════
// PROGRAMADOR AUTOMÁTICO EXACTO DE REINICIOS
// ══════════════════════════════════════════════════
function updateMcScheduleHint() {
    const timeInp = document.getElementById('sched-time-minecraft');
    const cdSel = document.getElementById('sched-cd-minecraft');
    const hint = document.getElementById('sched-mc-hint');
    if (!timeInp || !cdSel || !hint) return;

    const time = timeInp.value || '02:00';
    const cd = parseInt(cdSel.value, 10) || 0;

    if (cd <= 0) {
        hint.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${_t('admin_sched_hint_exact', 'Reinicio directo a las')} ${time} (Sin avisos previos).`;
        hint.className = 'text-[10px] text-emerald-400 font-mono mt-0.5';
    } else {
        const parts = time.split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        const cdMins = Math.ceil(cd / 60);
        let tot = h * 60 + m - cdMins;
        if (tot < 0) tot += 1440;
        const startH = String(Math.floor(tot / 60)).padStart(2, '0');
        const startM = String(tot % 60).padStart(2, '0');
        hint.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${_t('admin_sched_hint_exact', 'Reinicio exacto a las')} ${time} (${_t('admin_sched_hint_notices', 'Avisos inician a las')} ${startH}:${startM}).`;
        hint.className = 'text-[10px] text-cyan-400 font-mono mt-0.5';
    }
}

function populateSchedules(schedules) {
    if (!schedules) return;
    const services = ['minecraft', 'velocity', 'exolive', 'portfolio'];
    services.forEach(key => {
        const item = schedules[key];
        const toggle = document.getElementById('sched-toggle-' + key);
        const timeInput = document.getElementById('sched-time-' + key);
        if (toggle && item) toggle.checked = Boolean(item.enabled);
        if (timeInput && item && item.time) timeInput.value = item.time;
        if (key === 'minecraft') {
            const cd = document.getElementById('sched-cd-minecraft');
            if (cd && item && item.countdown !== undefined) cd.value = String(item.countdown);
        }
    });
    updateMcScheduleHint();
}

async function saveAllSchedules() {
    const schedules = {
        minecraft: {
            enabled: document.getElementById('sched-toggle-minecraft') ? document.getElementById('sched-toggle-minecraft').checked : false,
            time: document.getElementById('sched-time-minecraft') ? document.getElementById('sched-time-minecraft').value : '02:00',
            countdown: parseInt(document.getElementById('sched-cd-minecraft') ? document.getElementById('sched-cd-minecraft').value : '180', 10)
        },
        velocity: {
            enabled: document.getElementById('sched-toggle-velocity') ? document.getElementById('sched-toggle-velocity').checked : false,
            time: document.getElementById('sched-time-velocity') ? document.getElementById('sched-time-velocity').value : '04:00'
        },
        exolive: {
            enabled: document.getElementById('sched-toggle-exolive') ? document.getElementById('sched-toggle-exolive').checked : false,
            time: document.getElementById('sched-time-exolive') ? document.getElementById('sched-time-exolive').value : '05:00'
        },
        portfolio: {
            enabled: document.getElementById('sched-toggle-portfolio') ? document.getElementById('sched-toggle-portfolio').checked : false,
            time: document.getElementById('sched-time-portfolio') ? document.getElementById('sched-time-portfolio').value : '07:00'
        }
    };

    try {
        const res = await fetch('/api/system/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPass, schedules: schedules })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Programación Guardada', 'Se han actualizado los horarios de reinicio automático.', 'success');
        } else {
            showToast('Error', data.message || 'No se pudo guardar la programación', 'error');
        }
    } catch {
        showToast('Error', 'Fallo de conexión al guardar el programador.', 'error');
    }
}

// ══════════════════════════════════════════════════
// EDITOR DE CONTENIDO DEL PORTAFOLIO
// ══════════════════════════════════════════════════
function populateForms() {
    if (!db) return;
    document.getElementById('p-nombre').value = db.perfil?.nombre || '';
    document.getElementById('p-titulo').value = db.perfil?.titulo || '';
    document.getElementById('p-bio').value = db.perfil?.bio || '';
    document.getElementById('p-img').value = db.perfil?.imagen || '';

    document.getElementById('s-tit').value = db.seo?.titulo || '';
    document.getElementById('s-fav').value = db.seo?.favicon || '';

    document.getElementById('m-tit').value = db.musica?.titulo || '';
    document.getElementById('m-art').value = db.musica?.artista || '';
    document.getElementById('m-file').value = db.musica?.archivo || '';
    document.getElementById('m-vol').value = (db.musica?.volumen !== undefined ? db.musica.volumen : 0.5) * 100;
    document.getElementById('m-vol-val').innerText = document.getElementById('m-vol').value + "%";

    document.getElementById('c-url').value = db.comunidad?.url || 'https://discord.gg/E9HaPdJ843';

    renderRedes();
    renderProyectos();
    renderModpacks();
}

async function uploadFile(inputId, textTargetId) {
    const inputEl = document.getElementById(inputId);
    const file = inputEl.files[0];
    if (!file) return;

    if (!currentPass) {
        showToast('Error', 'Debes iniciar sesión con tu contraseña de administrador para subir archivos.', 'error');
        return;
    }

    const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
    if (file.size > MAX_SIZE) {
        showToast('Archivo Demasiado Grande', 'El tamaño máximo permitido es de 50 MB.', 'warning');
        inputEl.value = '';
        return;
    }

    const CHUNK_SIZE = 512 * 1024; // 512 KB para eludir límites 413 de cualquier reverse proxy
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = 'up_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);

    showToast('Iniciando Subida', `Subiendo ${file.name} (${sizeMb} MB) en ${totalChunks} fragmentos seguros...`, 'info');

    try {
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunkBlob = file.slice(start, end);

            const fd = new FormData();
            fd.append('chunk', chunkBlob);
            fd.append('uploadId', uploadId);
            fd.append('chunkIndex', String(chunkIndex));
            fd.append('totalChunks', String(totalChunks));
            fd.append('fileName', file.name);
            fd.append('password', currentPass);

            const res = await fetch('/api/upload-chunk', {
                method: 'POST',
                body: fd
            });

            if (!res.ok) {
                let errMsg = `Error HTTP ${res.status}`;
                try {
                    const errData = await res.json();
                    if (errData.message) errMsg = errData.message;
                } catch {}
                throw new Error(errMsg);
            }

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.message || 'Error en bloque de subida');
            }

            if (data.completed) {
                document.getElementById(textTargetId).value = data.filename;
                showToast('Archivo Subido', `¡${data.filename} (${sizeMb} MB) guardado exitosamente!`, 'success');
                inputEl.value = '';
                return;
            } else {
                const pct = Math.round(((chunkIndex + 1) / totalChunks) * 100);
                if (chunkIndex % 2 === 0 || chunkIndex === totalChunks - 2) {
                    showToast('Subiendo archivo...', `${pct}% completado (${chunkIndex + 1}/${totalChunks})`, 'info');
                }
            }
        }
    } catch (err) {
        console.error('Error subiendo archivo:', err);
        showToast('Fallo al Subir Archivo', err.message || 'No se pudo completar la subida.', 'error');
        inputEl.value = '';
    }
}

function renderRedes() {
    const c = document.getElementById('redes-container');
    if (!c) return;
    c.innerHTML = '';
    (db.redes || []).forEach((r, i) => {
        c.innerHTML += `
            <div class="bg-[#090914] p-4 rounded-xl border border-white/5 flex flex-col gap-2 relative">
                <button onclick="delRed(${i})" class="absolute top-2 right-2 text-gray-500 hover:text-red-400 text-xs p-1" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                <div class="flex items-center gap-2 mb-1">
                    <i class="fa-brands ${r.icono} text-sm" style="color: ${r.color}"></i>
                    <span class="text-xs font-bold text-white">${r.nombre}</span>
                </div>
                <input type="text" value="${r.nombre}" onchange="db.redes[${i}].nombre=this.value" placeholder="Nombre" class="input-field text-xs py-1">
                <input type="text" value="${r.usuario}" onchange="db.redes[${i}].usuario=this.value" placeholder="Usuario / Tag" class="input-field text-xs py-1">
                <input type="text" value="${r.url}" onchange="db.redes[${i}].url=this.value" placeholder="URL (# para copiar)" class="input-field text-xs py-1">
                <div class="flex gap-2">
                    <input type="text" value="${r.icono}" onchange="db.redes[${i}].icono=this.value" placeholder="Icono fa-..." class="input-field text-xs py-1 flex-1">
                    <input type="color" value="${r.color}" onchange="db.redes[${i}].color=this.value" class="h-8 w-10 bg-transparent cursor-pointer rounded">
                </div>
            </div>
        `;
    });
}

function addRed() {
    if (!db.redes) db.redes = [];
    db.redes.push({ id: "new", nombre: "Nueva Red", usuario: "@user", url: "#", icono: "fa-link", color: "#ffffff" });
    renderRedes();
}

async function delRed(i) {
    const ok = await Modal.confirm({
        title: '¿Eliminar Red Social?',
        message: '¿Estás seguro de que deseas eliminar este enlace?',
        danger: true
    });
    if (ok) {
        db.redes.splice(i, 1);
        renderRedes();
    }
}

function renderProyectos() {
    const c = document.getElementById('proyectos-container');
    if (!c) return;
    c.innerHTML = '';
    (db.proyectos || []).forEach((p, i) => {
        c.innerHTML += `
            <div class="bg-[#090914] p-4 rounded-xl border border-white/5 flex flex-col gap-2 relative">
                <button onclick="delProject(${i})" class="absolute top-2 right-2 text-gray-500 hover:text-red-400 text-xs p-1" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                <div class="font-bold text-xs text-white mb-1">${p.nombre}</div>
                <input type="text" value="${p.nombre}" onchange="db.proyectos[${i}].nombre=this.value" placeholder="Título" class="input-field text-xs py-1">
                <textarea onchange="db.proyectos[${i}].desc=this.value" placeholder="Descripción" class="input-field text-xs py-1 h-14 resize-none">${p.desc}</textarea>
                <input type="text" value="${p.url}" onchange="db.proyectos[${i}].url=this.value" placeholder="URL" class="input-field text-xs py-1">
                <div class="flex gap-2">
                    <input type="text" value="${p.icono}" onchange="db.proyectos[${i}].icono=this.value" placeholder="Icono fa-..." class="input-field text-xs py-1 flex-1">
                    <select onchange="db.proyectos[${i}].estilo=this.value" class="input-field text-xs py-1 w-24">
                        <option value="pink" ${p.estilo==='pink'?'selected':''}>Rosa</option>
                        <option value="cyan" ${p.estilo==='cyan'?'selected':''}>Cian</option>
                    </select>
                </div>
            </div>
        `;
    });
}

function addProject() {
    if (!db.proyectos) db.proyectos = [];
    db.proyectos.push({ nombre: "Nuevo Proyecto", desc: "Descripción...", url: "#", icono: "fa-code", estilo: "pink" });
    renderProyectos();
}

async function delProject(i) {
    const ok = await Modal.confirm({
        title: '¿Eliminar Proyecto?',
        message: '¿Estás seguro de que deseas eliminar este proyecto de la lista?',
        danger: true
    });
    if (ok) {
        db.proyectos.splice(i, 1);
        renderProyectos();
    }
}

function renderModpacks() {
    const c = document.getElementById('modpacks-container');
    if (!c) return;
    c.innerHTML = '';
    (db.modpacks || []).forEach((m, i) => {
        c.innerHTML += `
            <div class="bg-[#090914] p-4 rounded-xl border border-white/5 flex flex-col gap-2 relative">
                <button onclick="delModpack(${i})" class="absolute top-2 right-2 text-gray-500 hover:text-red-400 text-xs p-1" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                <div class="font-bold text-xs text-white mb-1 truncate">${m.nombre}</div>
                <input type="text" value="${m.nombre}" onchange="db.modpacks[${i}].nombre=this.value" placeholder="Nombre" class="input-field text-xs py-1">
                <textarea onchange="db.modpacks[${i}].desc=this.value" placeholder="Descripción corta" class="input-field text-xs py-1 h-14 resize-none">${m.desc}</textarea>
                <input type="text" value="${m.url}" onchange="db.modpacks[${i}].url=this.value" placeholder="Enlace CurseForge" class="input-field text-xs py-1">
                <input type="text" value="${m.imagen}" onchange="db.modpacks[${i}].imagen=this.value" placeholder="Archivo imagen (ej: mod.png)" class="input-field text-xs py-1">
            </div>
        `;
    });
}

function addModpack() {
    if (!db.modpacks) db.modpacks = [];
    db.modpacks.push({ nombre: "Nuevo Modpack", desc: "Descripción corta para CurseForge...", url: "#", imagen: "15315_1.jpg" });
    renderModpacks();
}

async function delModpack(i) {
    const ok = await Modal.confirm({
        title: '¿Eliminar Modpack?',
        message: '¿Estás seguro de que deseas eliminar este modpack?',
        danger: true
    });
    if (ok) {
        db.modpacks.splice(i, 1);
        renderModpacks();
    }
}

async function saveData() {
    db.perfil = {
        nombre: document.getElementById('p-nombre').value,
        titulo: document.getElementById('p-titulo').value,
        bio: document.getElementById('p-bio').value,
        imagen: document.getElementById('p-img').value
    };

    db.seo = {
        titulo: document.getElementById('s-tit').value,
        favicon: document.getElementById('s-fav').value
    };

    db.musica = {
        titulo: document.getElementById('m-tit').value,
        artista: document.getElementById('m-art').value,
        archivo: document.getElementById('m-file').value,
        volumen: parseFloat(document.getElementById('m-vol').value) / 100
    };

    db.comunidad = {
        url: document.getElementById('c-url').value || 'https://discord.gg/E9HaPdJ843'
    };

    const newPwd = document.getElementById('admin-pass').value.trim();
    if (newPwd) {
        db.admin_password = newPwd;
        currentPass = newPwd;
        sessionStorage.setItem('jazz_admin_pwd', newPwd);
        document.getElementById('admin-pass').value = '';
    }

    try {
        const res = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPass, data: db })
        });
        const result = await res.json();
        if (result.success) {
            showToast('Guardado Exitoso', 'Los cambios en el portafolio y configuración han sido persistidos.', 'success');
        } else {
            showToast('Error', result.message || 'No se pudieron guardar los datos.', 'error');
        }
    } catch {
        showToast('Error', 'Fallo de conexión al guardar.', 'error');
    }
}

// Reactividad a cambios de idioma
window.addEventListener('jazz_language_changed', () => {
    fetchSystemStatus();
    if (lastZDaemonData && lastZDaemonData.services) {
        renderZDaemonGrid(lastZDaemonData.services);
    }
});

// ══════════════════════════════════════════════════
// GITHUB GITOPS Y DESPLIEGUE CONTINUO
// ══════════════════════════════════════════════════
let githubCheckInterval = null;

// ==========================================================================
// CONTROL DE VERSIONES & GITHUB GITOPS DRAWER (ESTILO ECLIPSEMC)
// ==========================================================================

function openGitDrawer() {
    const drawer = document.getElementById('git-drawer');
    if (!drawer) return;
    drawer.removeAttribute('hidden');
    void drawer.offsetWidth; // Force reflow
    drawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    checkGitHubUpdates(false);
}

function closeGitDrawer() {
    const drawer = document.getElementById('git-drawer');
    if (!drawer) return;
    drawer.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => {
        if (!drawer.classList.contains('is-open')) {
            drawer.setAttribute('hidden', '');
        }
    }, 320);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const drawer = document.getElementById('git-drawer');
        if (drawer && drawer.classList.contains('is-open')) {
            closeGitDrawer();
        }
    }
});

async function checkGitHubUpdates(manual = false) {
    if (!currentPass) return;
    const spin = document.getElementById('git-drawer-spinner');
    if (manual && spin) {
        spin.classList.add('fa-spin');
    }

    try {
        const res = await fetch('/api/updates/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPass })
        });
        const data = await res.json();
        if (data.success && data.updates) {
            renderGitHubUpdates(data.updates);
            if (manual) {
                const anyPending = data.updates.exolive?.hasUpdate || data.updates.portfolio?.hasUpdate || data.updates.eclipsemc?.hasUpdate;
                if (anyPending) {
                    showToast('¡Actualizaciones Detectadas!', 'Hay nuevos commits en GitHub listos para aplicar.', 'info');
                } else {
                    showToast('Al Día', 'Todos tus repositorios están en la última compilación.', 'success');
                }
            }
        }
    } catch (e) {
        console.error('Error comprobando actualizaciones:', e);
        if (manual) showToast('Error GitHub', 'No se pudo verificar el estado remoto.', 'error');
    } finally {
        if (manual && spin) {
            setTimeout(() => spin.classList.remove('fa-spin'), 500);
        }
    }
}

function renderGitHubUpdates(u) {
    const hasAnyUpdate = Boolean((u.exolive && u.exolive.hasUpdate) || (u.portfolio && u.portfolio.hasUpdate) || (u.eclipsemc && u.eclipsemc.hasUpdate));

    // Indicador en Navbar (Desktop y Móvil)
    const navBadge = document.getElementById('nav-git-badge');
    const navBadgeMob = document.getElementById('nav-git-badge-mobile');
    if (navBadge) {
        if (hasAnyUpdate) navBadge.classList.remove('hidden');
        else navBadge.classList.add('hidden');
    }
    if (navBadgeMob) {
        if (hasAnyUpdate) navBadgeMob.classList.remove('hidden');
        else navBadgeMob.classList.add('hidden');
    }

    // 1. RENDER EXOLIVE V2
    if (u.exolive) {
        const exo = u.exolive;
        const branchEl = document.getElementById('drawer-exolive-branch');
        const repoLinkEl = document.getElementById('drawer-exolive-repo-link');
        const statusPill = document.getElementById('drawer-exolive-status-pill');
        const curHash = document.getElementById('drawer-exolive-current-hash');
        const curMsg = document.getElementById('drawer-exolive-current-msg');
        const curAuthor = document.getElementById('drawer-exolive-current-author');
        const curTime = document.getElementById('drawer-exolive-current-time');
        const prevEl = document.getElementById('drawer-exolive-prev-commit');
        const changelogEl = document.getElementById('drawer-exolive-changelog');
        const applyBtn = document.getElementById('drawer-btn-apply-exolive');

        if (branchEl) branchEl.innerText = exo.branch || 'main';
        if (repoLinkEl && exo.repoUrl) {
            repoLinkEl.href = exo.repoUrl.replace(/\.git$/, '');
            const spanText = repoLinkEl.querySelector('span');
            if (spanText) spanText.innerText = (exo.repoUrl.replace(/https?:\/\//, '').replace(/\.git$/, ''));
        }

        if (curHash) curHash.innerText = exo.currentCommit?.hash ? '#' + exo.currentCommit.hash : '#HEAD';
        if (curMsg) curMsg.innerText = exo.currentCommit?.message || 'Sin mensaje de commit';
        if (curAuthor) curAuthor.innerText = exo.currentCommit?.author || 'Jassyel';
        if (curTime) curTime.innerText = exo.currentCommit?.date ? `${exo.currentCommit.date} (${exo.currentCommit.relative || ''})` : 'Reciente';

        if (prevEl) {
            if (exo.previousCommit) {
                prevEl.innerHTML = `<span class="text-cyan-300 font-bold">#${exo.previousCommit.hash}</span> - ${exo.previousCommit.message} <span class="text-gray-400">(${exo.previousCommit.date || ''} - ${exo.previousCommit.relative || ''})</span>`;
            } else {
                prevEl.innerHTML = '<span class="text-gray-500">No hay commit anterior registrado</span>';
            }
        }

        // Render Changelog grouped by date (Identico a GitHub)
        if (changelogEl) {
            if (exo.changelog && exo.changelog.length > 0) {
                const groups = {};
                exo.changelog.forEach(c => {
                    const dateLabel = c.dateFormatted || c.dateKey || 'Recientes';
                    if (!groups[dateLabel]) groups[dateLabel] = [];
                    groups[dateLabel].push(c);
                });

                let html = '';
                for (const [dateLabel, items] of Object.entries(groups)) {
                    html += `
                        <div class="pt-3 pb-1 flex items-center gap-2">
                            <span class="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded border border-purple-500/30 flex items-center gap-1.5">
                                <i class="fa-regular fa-calendar text-[9px]"></i> Commits del ${dateLabel}
                            </span>
                            <div class="h-[1px] flex-1 bg-white/10"></div>
                        </div>
                    `;
                    items.forEach(c => {
                        const commitUrl = `https://github.com/jassyel/exolive/commit/${c.fullHash || c.hash}`;
                        html += `
                            <div class="group flex items-start justify-between gap-3 p-2.5 rounded-xl bg-black/40 border border-white/5 hover:border-purple-500/40 hover:bg-purple-950/20 transition-all text-xs">
                                <div class="flex-1 min-w-0">
                                    <a href="${commitUrl}" target="_blank" class="text-gray-200 font-semibold text-xs leading-snug hover:text-purple-300 transition-colors block" title="${c.message}">
                                        ${c.message}
                                    </a>
                                    <div class="text-[10px] text-gray-400 flex items-center gap-2 mt-1 font-mono flex-wrap">
                                        <span class="text-purple-300 font-bold">${c.author}</span>
                                        <span class="text-gray-600">&bull;</span>
                                        <span>${c.time || ''}</span>
                                        <span class="text-gray-600">&bull;</span>
                                        <span class="text-gray-400">${c.relative || ''}</span>
                                    </div>
                                </div>
                                <a href="${commitUrl}" target="_blank" class="font-mono text-[11px] font-bold px-2 py-1 rounded bg-[#0b0817] border border-purple-500/30 text-cyan-300 group-hover:border-cyan-400 group-hover:text-white transition-all flex items-center gap-1 shrink-0" title="Ver commit en GitHub">
                                    <span>#${c.hash}</span>
                                    <i class="fa-solid fa-arrow-up-right-from-square text-[8px] text-purple-400"></i>
                                </a>
                            </div>
                        `;
                    });
                }
                changelogEl.innerHTML = html;
            } else {
                changelogEl.innerHTML = '<div class="text-xs text-gray-400 p-3 text-center bg-black/20 rounded-xl border border-white/5">No hay historial disponible</div>';
            }
        }

        if (statusPill) {
            if (exo.hasUpdate) {
                statusPill.className = 'text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-500/50 text-emerald-400 bg-emerald-500/20 animate-pulse shrink-0';
                statusPill.innerText = `¡${exo.pendingCount} pendiente(s)!`;
            } else {
                statusPill.className = 'text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-700 text-gray-400 bg-gray-800/40 shrink-0';
                statusPill.innerText = 'Al día';
            }
        }

        // Validación y Atenuación del Botón de Aplicar Cambios
        if (applyBtn) {
            if (exo.hasUpdate) {
                applyBtn.disabled = false;
                applyBtn.className = 'w-full py-2.5 px-4 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white border border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:brightness-110 cursor-pointer animate-pulse';
                applyBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> <span>¡Aplicar ${exo.pendingCount} cambio(s) pendientes!</span>`;
            } else {
                // ATENUADO (Disabled, Opacidad 40%, Indicador de al día)
                applyBtn.disabled = true;
                applyBtn.className = 'w-full py-2.5 px-4 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all opacity-40 cursor-not-allowed bg-white/[0.03] text-gray-400 border border-white/10 shadow-none';
                applyBtn.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400"></i> <span>Al día (Última versión)</span>';
            }
        }
    }

    // 2. RENDER PORTAFOLIO WEB
    if (u.portfolio) {
        const port = u.portfolio;
        const statusPill = document.getElementById('drawer-portfolio-status-pill');
        const curHash = document.getElementById('drawer-portfolio-current-hash');
        const curMsg = document.getElementById('drawer-portfolio-current-msg');
        const curTime = document.getElementById('drawer-portfolio-current-time');
        const changelogEl = document.getElementById('drawer-portfolio-changelog');
        const applyBtn = document.getElementById('drawer-btn-apply-portfolio');

        if (curHash && port.currentCommit?.hash) curHash.innerText = '#' + port.currentCommit.hash;
        if (curMsg && port.currentCommit?.message) curMsg.innerText = port.currentCommit.message;
        if (curTime && port.currentCommit?.date) curTime.innerText = `${port.currentCommit.date} (${port.currentCommit.relative || 'Activo'})`;

        if (statusPill) {
            if (port.hasUpdate) {
                statusPill.className = 'text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-cyan-500/50 text-cyan-400 bg-cyan-500/20 animate-pulse shrink-0';
                statusPill.innerText = `¡${port.pendingCount} pendiente(s)!`;
            } else {
                statusPill.className = 'text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-700 text-gray-400 bg-gray-800/40 shrink-0';
                statusPill.innerText = 'Al día';
            }
        }

        if (changelogEl && port.changelog && port.changelog.length > 0) {
            let html = '';
            port.changelog.forEach(c => {
                const commitUrl = `https://github.com/jassyel/TheJazZDM/commit/${c.fullHash || c.hash}`;
                html += `
                    <div class="group flex items-start justify-between gap-3 p-2.5 rounded-xl bg-black/40 border border-white/5 hover:border-cyan-500/40 hover:bg-cyan-950/20 transition-all text-xs">
                        <div class="flex-1 min-w-0">
                            <a href="${commitUrl}" target="_blank" class="text-gray-200 font-semibold text-xs leading-snug hover:text-cyan-300 transition-colors block" title="${c.message}">
                                ${c.message}
                            </a>
                            <div class="text-[10px] text-gray-400 flex items-center gap-2 mt-1 font-mono flex-wrap">
                                <span class="text-cyan-300 font-bold">${c.author}</span>
                                <span class="text-gray-600">&bull;</span>
                                <span>${c.dateFormatted || ''}</span>
                                <span class="text-gray-600">&bull;</span>
                                <span class="text-gray-400">${c.relative || ''}</span>
                            </div>
                        </div>
                        <a href="${commitUrl}" target="_blank" class="font-mono text-[11px] font-bold px-2 py-1 rounded bg-[#070b14] border border-cyan-500/30 text-cyan-300 group-hover:border-cyan-400 group-hover:text-white transition-all flex items-center gap-1 shrink-0" title="Ver commit en GitHub">
                            <span>#${c.hash}</span>
                            <i class="fa-solid fa-arrow-up-right-from-square text-[8px] text-cyan-400"></i>
                        </a>
                    </div>
                `;
            });
            changelogEl.innerHTML = html;
        }

        if (applyBtn) {
            if (port.hasUpdate) {
                applyBtn.disabled = false;
                applyBtn.className = 'w-full py-2.5 px-4 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white border border-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.3)] hover:brightness-110 cursor-pointer animate-pulse';
                applyBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> <span>¡Aplicar ${port.pendingCount} cambio(s)!</span>`;
            } else {
                applyBtn.disabled = true;
                applyBtn.className = 'w-full py-2.5 px-4 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all opacity-40 cursor-not-allowed bg-white/[0.03] text-gray-400 border border-white/10 shadow-none';
                applyBtn.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400"></i> <span>Al día (Última versión)</span>';
            }
        }
    }
}

    // 3. RENDER ECLIPSEMC WEB
    if (u.eclipsemc) {
        const ecl = u.eclipsemc;
        const branchEl = document.getElementById('drawer-eclipsemc-branch');
        const repoLinkEl = document.getElementById('drawer-eclipsemc-repo-link');
        const statusPill = document.getElementById('drawer-eclipsemc-status-pill');
        const curHash = document.getElementById('drawer-eclipsemc-current-hash');
        const curMsg = document.getElementById('drawer-eclipsemc-current-msg');
        const curAuthor = document.getElementById('drawer-eclipsemc-current-author');
        const curTime = document.getElementById('drawer-eclipsemc-current-time');
        const prevEl = document.getElementById('drawer-eclipsemc-prev-commit');
        const changelogEl = document.getElementById('drawer-eclipsemc-changelog');
        const applyBtn = document.getElementById('drawer-btn-apply-eclipsemc');

        if (branchEl) branchEl.innerText = ecl.branch || 'main';
        if (repoLinkEl && ecl.repoUrl) {
            repoLinkEl.href = ecl.repoUrl.replace(/\.git$/, '');
            const spanText = repoLinkEl.querySelector('span');
            if (spanText) spanText.innerText = (ecl.repoUrl.replace(/https?:\/\//, '').replace(/\.git$/, ''));
        }

        if (curHash) curHash.innerText = ecl.currentCommit?.hash ? '#' + ecl.currentCommit.hash : '#HEAD';
        if (curMsg) curMsg.innerText = ecl.currentCommit?.message || 'Sin mensaje de commit';
        if (curAuthor) curAuthor.innerText = ecl.currentCommit?.author || 'Jassyel';
        if (curTime) curTime.innerText = ecl.currentCommit?.date ? `${ecl.currentCommit.date} (${ecl.currentCommit.relative || ''})` : 'Reciente';

        if (prevEl) {
            if (ecl.previousCommit) {
                prevEl.innerHTML = `<span class="text-amber-300 font-bold">#${ecl.previousCommit.hash}</span> - ${ecl.previousCommit.message} <span class="text-gray-400">(${ecl.previousCommit.date || ''} - ${ecl.previousCommit.relative || ''})</span>`;
            } else {
                prevEl.innerHTML = '<span class="text-gray-500">No hay commit anterior registrado</span>';
            }
        }

        if (changelogEl) {
            if (ecl.changelog && ecl.changelog.length > 0) {
                const groups = {};
                ecl.changelog.forEach(c => {
                    const dateLabel = c.dateFormatted || c.dateKey || 'Recientes';
                    if (!groups[dateLabel]) groups[dateLabel] = [];
                    groups[dateLabel].push(c);
                });

                let html = '';
                for (const [dateLabel, items] of Object.entries(groups)) {
                    html += `
                        <div class="pt-3 pb-1 flex items-center gap-2">
                            <span class="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1.5">
                                <i class="fa-regular fa-calendar text-[9px]"></i> Commits del ${dateLabel}
                            </span>
                            <div class="h-[1px] flex-1 bg-white/10"></div>
                        </div>
                    `;
                    items.forEach(c => {
                        const commitUrl = `https://github.com/jassyel/eclipsemc-web/commit/${c.fullHash || c.hash}`;
                        html += `
                            <div class="group flex items-start justify-between gap-3 p-2.5 rounded-xl bg-black/40 border border-white/5 hover:border-amber-500/40 hover:bg-amber-950/20 transition-all text-xs">
                                <div class="flex-1 min-w-0">
                                    <a href="${commitUrl}" target="_blank" class="text-gray-200 font-semibold text-xs leading-snug hover:text-amber-300 transition-colors block" title="${c.message}">
                                        ${c.message}
                                    </a>
                                    <div class="text-[10px] text-gray-400 flex items-center gap-2 mt-1 font-mono flex-wrap">
                                        <span class="text-amber-300 font-bold">${c.author}</span>
                                        <span class="text-gray-600">&bull;</span>
                                        <span>${c.time || ''}</span>
                                        <span class="text-gray-600">&bull;</span>
                                        <span class="text-gray-400">${c.relative || ''}</span>
                                    </div>
                                </div>
                                <a href="${commitUrl}" target="_blank" class="font-mono text-[11px] font-bold px-2 py-1 rounded bg-[#150d03] border border-amber-500/30 text-amber-300 group-hover:border-amber-400 group-hover:text-white transition-all flex items-center gap-1 shrink-0" title="Ver commit en GitHub">
                                    <span>#${c.hash}</span>
                                    <i class="fa-solid fa-arrow-up-right-from-square text-[8px] text-amber-400"></i>
                                </a>
                            </div>
                        `;
                    });
                }
                changelogEl.innerHTML = html;
            } else {
                changelogEl.innerHTML = '<div class="text-xs text-gray-400 p-3 text-center bg-black/20 rounded-xl border border-white/5">No hay historial disponible</div>';
            }
        }

        if (statusPill) {
            if (ecl.hasUpdate) {
                statusPill.className = 'text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-500/50 text-emerald-400 bg-emerald-500/20 animate-pulse shrink-0';
                statusPill.innerText = `�${ecl.pendingCount} pendiente(s)!`;
            } else {
                statusPill.className = 'text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-700 text-gray-400 bg-gray-800/40 shrink-0';
                statusPill.innerText = 'Al d�a';
            }
        }

        if (applyBtn) {
            if (ecl.hasUpdate) {
                applyBtn.disabled = false;
                applyBtn.className = 'w-full py-2.5 px-4 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-white border border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:brightness-110 cursor-pointer animate-pulse';
                applyBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> <span>�Aplicar ${ecl.pendingCount} cambio(s) pendientes!</span>`;
            } else {
                applyBtn.disabled = true;
                applyBtn.className = 'w-full py-2.5 px-4 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all opacity-40 cursor-not-allowed bg-white/[0.03] text-gray-400 border border-white/10 shadow-none';
                applyBtn.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400"></i> <span>Al d�a (�ltima versi�n)</span>';
            }
        }
    }

async function applyServiceUpdate(target, serviceName, force = false) {
    if (!currentPass) return;

    if (!force) {
        const btn = target === 'exolive' 
            ? document.getElementById('drawer-btn-apply-exolive') 
            : document.getElementById('drawer-btn-apply-portfolio');
        if (btn && btn.disabled) {
            showToast('Al Día', `${serviceName} ya tiene la última versión instalada.`, 'info');
            return;
        }
    }

    const confirmed = confirm(force 
        ? `¿Deseas forzar la recarga en vivo de ${serviceName}?` 
        : `¿Deseas descargar los últimos cambios de GitHub para ${serviceName} y aplicarlos en vivo? El servicio se actualizará y reiniciará automáticamente.`);
    if (!confirmed) return;

    showToast('Actualizando ' + serviceName, 'Aplicando compilación y reiniciando servicio en HeavyNode...', 'info');

    const btn = target === 'exolive' 
        ? document.getElementById('drawer-btn-apply-exolive') 
        : document.getElementById('drawer-btn-apply-portfolio');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Compilando y aplicando...</span>';
        btn.disabled = true;
    }

    try {
        const res = await fetch('/api/updates/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPass, target: target, force: force })
        });
        const data = await res.json();
        if (data.alreadyUpToDate) {
            showToast('Al Día', data.message || 'Ya tienes la última compilación instalada.', 'info');
        } else if (data.success) {
            showToast('¡Despliegue Completado!', data.message || `${serviceName} actualizado exitosamente.`, 'success');
        } else {
            showToast('Error en Despliegue', data.message || 'No se pudo aplicar la actualización.', 'error');
        }
        setTimeout(() => {
            checkGitHubUpdates(false);
            fetchSystemStatus(false);
        }, 3000);
    } catch (e) {
        showToast('Error de Conexión', 'Fallo al comunicar la orden de actualización a HeavyNode.', 'error');
    }
}
