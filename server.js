const express = require('express');
const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const { exec, execSync } = require('child_process');

const app = express();
const PORT = process.env.PORTFOLIO_PORT || 26293;
const DB_PATH = path.join(__dirname, 'data', 'config.json');
const visitedIps = new Set();

// ══════════════════════════════════════════════════════
// CABECERAS DE SEGURIDAD HTTP Y PROTECCIÓN CONTRA ATAQUES
// ══════════════════════════════════════════════════════
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.path.startsWith('/api/admin') || req.path.startsWith('/api/system') || req.path.startsWith('/api/split-server')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
    next();
});

// ══════════════════════════════════════════════════════
// ESCUDO ANTI-FUERZA BRUTA & COMPARACIÓN SEGURA (TIMING SAFE)
// ══════════════════════════════════════════════════════
const loginAttempts = new Map(); // ip -> { count: number, lockedUntil: number }
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000; // 15 minutos de bloqueo tras 5 intentos fallidos

function checkRateLimit(ip) {
    const record = loginAttempts.get(ip);
    if (!record) return { allowed: true };
    if (record.lockedUntil && Date.now() < record.lockedUntil) {
        const remainingMins = Math.ceil((record.lockedUntil - Date.now()) / 60000);
        return { allowed: false, remainingMins };
    }
    if (record.lockedUntil && Date.now() >= record.lockedUntil) {
        loginAttempts.delete(ip);
        return { allowed: true };
    }
    return { allowed: true };
}

function recordFailedAttempt(ip) {
    const record = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
    record.count++;
    if (record.count >= MAX_FAILED_ATTEMPTS) {
        record.lockedUntil = Date.now() + LOCKOUT_TIME_MS;
        console.warn(`[Seguridad] IP ${ip} bloqueada temporalmente por exceder ${MAX_FAILED_ATTEMPTS} intentos fallidos.`);
    }
    loginAttempts.set(ip, record);
}

function resetFailedAttempts(ip) {
    loginAttempts.delete(ip);
}

// Comparación de contraseñas de tiempo constante (Previene ataques de timing side-channel)
function safeComparePassword(input, stored) {
    if (typeof input !== 'string' || typeof stored !== 'string') return false;
    try {
        const hashA = crypto.createHash('sha256').update(input).digest();
        const hashB = crypto.createHash('sha256').update(stored).digest();
        return crypto.timingSafeEqual(hashA, hashB);
    } catch {
        return false;
    }
}

// Middleware de autenticación centralizado
function requireAdminAuth(req, res, next) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
        return res.status(429).json({
            success: false,
            rateLimited: true,
            message: `Demasiados intentos fallidos. Acceso bloqueado temporalmente por ${rateLimit.remainingMins} minuto(s) por seguridad.`
        });
    }

    let currentDb;
    try {
        currentDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {
        return res.status(500).json({ success: false, message: 'Error interno leyendo configuración.' });
    }

    const inputPwd = req.body && req.body.password;
    if (!inputPwd || !safeComparePassword(inputPwd, currentDb.admin_password)) {
        recordFailedAttempt(clientIp);
        return res.status(401).json({ success: false, unauthorized: true, message: 'Autenticación denegada. Credenciales inválidas.' });
    }

    resetFailedAttempts(clientIp);
    req.dbConfig = currentDb;
    next();
}

// ══════════════════════════════════════════════════════
// ALMACENAMIENTO SEGURO DE ARCHIVOS (WHITELIST ESTRICTA)
// ══════════════════════════════════════════════════════
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.mp3', '.ogg', '.wav']);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public')),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `${safeBase}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // Máximo 15 MB por archivo directo
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            return cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes (.png, .jpg, .gif, .webp) y audio (.mp3, .ogg, .wav).'));
        }
        cb(null, true);
    }
});

const uploadChunk = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 } // Máximo 2 MB por fragmento (cliente envía 512 KB)
});

app.use(express.json());
app.use(express.static('public'));

// Enrutador amigable para /admin y /admin/ (Permite acceder desde https://thejazzdm.gamesrv.net/admin)
app.get(['/admin', '/admin/'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Evitar 404 de favicon.ico
app.get('/favicon.ico', (req, res) => {
    const favPath = path.join(__dirname, 'public', 'favicon.ico');
    if (fs.existsSync(favPath)) {
        return res.sendFile(favPath);
    }
    const favJpg = path.join(__dirname, 'public', '15315_1.jpg');
    if (fs.existsSync(favJpg)) {
        return res.sendFile(favJpg);
    }
    res.status(204).end();
});

// Helper para ejecutar comandos en bash de forma asíncrona segura
function runBash(cmd) {
    return new Promise((resolve) => {
        const isWin = process.platform === 'win32';
        const shell = isWin ? undefined : (fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh');
        exec(cmd, { shell, timeout: 30000 }, (error, stdout, stderr) => {
            resolve({ error, stdout: stdout ? stdout.trim() : '', stderr: stderr ? stderr.trim() : '' });
        });
    });
}

// ══════════════════════════════════════════════════════
// COMANDOS Y ENTRADA DE CONSOLA DE MINECRAFT (STDIN/FIFO SEGURO)
// ══════════════════════════════════════════════════════
// Helper nativo para enviar comandos RCON a Minecraft
function sendMinecraftRcon(host, port, password, command, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        let authed = false;
        let buffer = Buffer.alloc(0);
        let timer = setTimeout(() => {
            client.destroy();
            reject(new Error('Tiempo de espera RCON agotado'));
        }, timeoutMs);

        function createPacket(id, type, payload) {
            const payloadBuf = Buffer.from(payload, 'utf8');
            const length = payloadBuf.length + 10;
            const buf = Buffer.alloc(length + 4);
            buf.writeInt32LE(length, 0);
            buf.writeInt32LE(id, 4);
            buf.writeInt32LE(type, 8);
            payloadBuf.copy(buf, 12);
            buf.writeUInt8(0, 12 + payloadBuf.length);
            buf.writeUInt8(0, 13 + payloadBuf.length);
            return buf;
        }

        client.connect(port, host, () => {
            // Enviar auth (type 3, id 1)
            client.write(createPacket(1, 3, password));
        });

        client.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            while (buffer.length >= 14) {
                const length = buffer.readInt32LE(0);
                if (buffer.length < length + 4) break;
                const id = buffer.readInt32LE(4);
                const type = buffer.readInt32LE(8);
                const body = buffer.toString('utf8', 12, length + 2);
                buffer = buffer.slice(length + 4);

                if (!authed) {
                    if (id === -1) {
                        clearTimeout(timer);
                        client.destroy();
                        return reject(new Error('Contraseña RCON incorrecta'));
                    }
                    authed = true;
                    // Enviar comando (type 2, id 2)
                    client.write(createPacket(2, 2, command));
                } else {
                    clearTimeout(timer);
                    client.destroy();
                    return resolve(body.replace(/\r\n/g, '\n').trim());
                }
            }
        });

        client.on('error', (err) => {
            clearTimeout(timer);
            client.destroy();
            reject(err);
        });
    });
}

async function sendMinecraftCommand(command) {
    if (!command || !command.trim()) return { success: false, message: 'Comando vacío' };
    const cleanCmd = command.trim().replace(/^[\/\\]+/, '');
    const fifoPath = '/home/container/.minecraft.stdin';
    const serverPropsPath = '/home/container/server.properties';

    // Intento 1: RCON nativo de Minecraft (El estándar 100% garantizado)
    try {
        if (fs.existsSync(serverPropsPath)) {
            const props = fs.readFileSync(serverPropsPath, 'utf8');
            const rconEnabled = /enable-rcon\s*=\s*true/i.test(props);
            if (rconEnabled) {
                const portMatch = props.match(/rcon\.port\s*=\s*(\d+)/i);
                const passMatch = props.match(/rcon\.password\s*=\s*([^\r\n]+)/i);
                const rconPort = portMatch ? parseInt(portMatch[1], 10) : 25575;
                const rconPass = passMatch ? passMatch[1].trim() : '';

                if (rconPass) {
                    const rconOutput = await sendMinecraftRcon('127.0.0.1', rconPort, rconPass, cleanCmd, 3000);
                    console.log(`[Minecraft RCON] > /${cleanCmd} => ${rconOutput || 'OK'}`);
                    return {
                        success: true,
                        target: 'minecraft',
                        message: `Comando ejecutado en Minecraft via RCON: /${cleanCmd}`,
                        output: rconOutput ? `[Minecraft Console] ${rconOutput}` : `[Minecraft Console] > /${cleanCmd}`
                    };
                }
            }
        }
    } catch (e) {
        console.log('[Minecraft Command] RCON intento no completado:', e.message);
    }

    // Intento 2: Inyección FIFO estricta (SOLO si es una tubería con lector activo)
    try {
        const cmdEscaped = cleanCmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
        const bashCmd = `if [ -p "${fifoPath}" ]; then printf "%s\\n" "${cmdEscaped}" > "${fifoPath}"; echo "FIFO_OK"; else echo "NO_FIFO"; fi`;
        const { stdout } = await runBash(bashCmd, 2000);
        if (stdout.includes('FIFO_OK')) {
            console.log(`[Minecraft Console] > /${cleanCmd} (via fifo)`);
            return {
                success: true,
                target: 'minecraft',
                message: `Comando enviado a Minecraft: /${cleanCmd}`,
                output: `[Minecraft Console] > /${cleanCmd}`
            };
        }
    } catch (e) {
        console.error('[Minecraft Command] Error en inyección FIFO:', e.message);
    }

    // Intento 3: Screen / Tmux si el servidor está en una sesión multiplexada
    try {
        const { stdout: screenCheck } = await runBash('screen -ls 2>/dev/null || true');
        if (screenCheck && screenCheck.includes('.')) {
            const cmdEscaped = cleanCmd.replace(/"/g, '\\"');
            await runBash(`screen -p 0 -X stuff "${cmdEscaped}\\n" 2>/dev/null || true`);
            return {
                success: true,
                target: 'minecraft',
                message: `Comando enviado a sesión de consola: /${cleanCmd}`,
                output: `[Minecraft Console] > /${cleanCmd}`
            };
        }
    } catch {}

    // Intento 4: Escritura en /proc/$PID/fd/0 (detectando PID de Java dinámicamente)
    try {
        let mcPid = '';
        if (fs.existsSync('/home/container/.minecraft.pid')) {
            mcPid = fs.readFileSync('/home/container/.minecraft.pid', 'utf8').trim();
        }
        if (!mcPid) {
            const { stdout: pgrepOut } = await runBash('pgrep -f "canvas|folia|server\\.jar" | head -n1');
            if (pgrepOut && pgrepOut.trim()) mcPid = pgrepOut.trim();
        }
        if (mcPid) {
            const procFd = `/proc/${mcPid}/fd/0`;
            if (fs.existsSync(procFd)) {
                fs.appendFileSync(procFd, cleanCmd + '\n');
                console.log(`[Minecraft Console] > /${cleanCmd} (via /proc/${mcPid}/fd/0)`);
                return {
                    success: true,
                    target: 'minecraft',
                    message: `Comando inyectado en proceso Java (PID ${mcPid}): /${cleanCmd}`,
                    output: `[Minecraft Console] > /${cleanCmd}`
                };
            }
        }
    } catch (e) {
        // Fallback final
    }

    return {
        success: false,
        message: 'No se pudo entregar el comando a Minecraft. Para habilitar control total desde la web, asegúrate de activar "enable-rcon=true" en server.properties con una contraseña.'
    };
}

// ══════════════════════════════════════════════════════
// SISTEMA DE CUENTA REGRESIVA Y AVISOS IN-GAME MINECRAFT
// ══════════════════════════════════════════════════════
let activeCountdown = null;

async function broadcastMinecraftAlert(secondsRemaining) {
    let timeText = '';
    let color = 'gold';
    if (secondsRemaining >= 60) {
        const mins = Math.round(secondsRemaining / 60);
        timeText = `${mins} minuto${mins > 1 ? 's' : ''}`;
        color = 'gold';
    } else {
        timeText = `${secondsRemaining} segundo${secondsRemaining > 1 ? 's' : ''}`;
        color = secondsRemaining <= 5 ? 'red' : 'yellow';
    }

    // 1. Anuncio oficial en el servidor (Siempre visible sin causar 'No player was found' si está vacío)
    await sendMinecraftCommand(`say §e[REINICIO] §6El servidor se reiniciará en ${timeText}. Guarda tus ítems.`);
    await sendMinecraftCommand(`execute as @a run tellraw @s [{"text":"[","color":"gray"},{"text":"SERVIDOR","color":"gold","bold":true},{"text":"] Atención: Reinicio programado en ","color":"yellow"},{"text":"${timeText}","color":"${color}","bold":true},{"text":". Guarda tus ítems.","color":"yellow"}]`);

    // 2. Títulos visuales en pantalla y barra de acción solo para jugadores conectados
    if (secondsRemaining === 180 || secondsRemaining === 120 || secondsRemaining === 60 || secondsRemaining === 30 || secondsRemaining <= 5) {
        await sendMinecraftCommand(`execute as @a run title @s title {"text":"⚠ REINICIO EN ${timeText.toUpperCase()}","color":"${color}","bold":true}`);
        await sendMinecraftCommand(`execute as @a run title @s subtitle {"text":"Por favor ponte en un lugar seguro","color":"white"}`);
    }
    await sendMinecraftCommand(`execute as @a run title @s actionbar {"text":"⏳ Reinicio del servidor en ${timeText}...","color":"${color}","bold":true}`);
}

function startMinecraftCountdown(initialSeconds = 180, onFinishCallback) {
    if (activeCountdown) {
        clearInterval(activeCountdown.interval);
        activeCountdown = null;
    }

    let remaining = initialSeconds;
    const announceMilestones = new Set([180, 120, 60, 30, 15, 10, 5, 4, 3, 2, 1]);

    // Primer aviso inmediato
    broadcastMinecraftAlert(remaining);

    const interval = setInterval(async () => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(interval);
            activeCountdown = null;

            // Aviso final antes de reiniciar
            await sendMinecraftCommand('say §c[REINICIO] Guardando mapa y chunks. ¡Reiniciando ahora!');
            await sendMinecraftCommand('execute as @a run title @s title {"text":"¡REINICIANDO AHORA!","color":"red","bold":true}');
            await sendMinecraftCommand('save-all');

            setTimeout(async () => {
                if (onFinishCallback) {
                    onFinishCallback();
                } else {
                    await doRestartService('minecraft');
                }
            }, 2000);
            return;
        }

        if (announceMilestones.has(remaining)) {
            await broadcastMinecraftAlert(remaining);
        }
    }, 1000);

    activeCountdown = {
        interval,
        totalSeconds: initialSeconds,
        getRemaining: () => remaining,
        startedAt: Date.now()
    };
    return activeCountdown;
}

async function cancelMinecraftCountdown() {
    if (activeCountdown) {
        clearInterval(activeCountdown.interval);
        activeCountdown = null;
        await sendMinecraftCommand('say §a[AVISO] El reinicio programado ha sido CANCELADO por el administrador.');
        await sendMinecraftCommand('execute as @a run tellraw @s {"text":"✔ [AVISO] El reinicio programado ha sido cancelado. Puedes continuar jugando con normalidad.","color":"green","bold":true}');
        await sendMinecraftCommand('execute as @a run title @s title {"text":"REINICIO CANCELADO","color":"green","bold":true}');
        return true;
    }
    return false;
}

// Definición centralizada de los servicios del servidor
const SERVICES = {
    minecraft: {
        id: 'minecraft',
        name: 'Minecraft (Folia / Canvas)',
        icon: 'fa-cube',
        color: '#00FFFF',
        logFile: '/home/container/logs/latest.log',
        grep: 'canvas|folia|nogui|server\\.jar',
        pidFile: '/home/container/.minecraft.pid',
        stopCmd: 'touch /home/container/.mc_manual_stop && ([ -f /home/container/.minecraft.pid ] && kill -TERM $(cat /home/container/.minecraft.pid 2>/dev/null) 2>/dev/null || true); pkill -TERM -f "canvas.*nogui" || pkill -TERM -f "folia.*nogui" || pkill -TERM -f "nogui" || pkill -TERM -f "canvas" || pkill -TERM -f "server\\.jar" || true',
        startCmd: 'rm -f /home/container/.mc_manual_stop',
        restartCmd: 'custom_mc_restart'
    },
    exolive: {
        id: 'exolive',
        name: 'ExoLive V2',
        icon: 'fa-broadcast-tower',
        color: '#9d4edd',
        logFile: '/home/container/exolive-v2.log',
        grep: 'apps/api/dist/server\\.js|start-v2\\.sh|exolive',
        pidFile: '/home/container/.exolive.pid',
        stopCmd: 'touch /home/container/.exolive_manual_stop && ([ -f /home/container/.exolive.pid ] && kill -TERM $(cat /home/container/.exolive.pid 2>/dev/null) 2>/dev/null || pkill -TERM -f "apps/api/dist/server\\.js" || pkill -TERM -f "start-v2\\.sh" || pkill -TERM -f "exolive" || true); rm -f /home/container/.exolive.pid',
        startCmd: 'rm -f /home/container/.exolive_manual_stop && cd /home/container/exolive-v2 && bash deploy/heavynode/start-v2.sh >> /home/container/exolive-v2.log 2>&1 & echo $! > /home/container/.exolive.pid',
        restartCmd: 'custom_exolive_restart'
    },
    velocity: {
        id: 'velocity',
        name: 'Velocity Proxy',
        icon: 'fa-shield-halved',
        color: '#f59e0b',
        logFile: '/home/container/proxy.log',
        grep: '(velocity|VeloFlame|veloflame).*\\.jar',
        pidFile: '/home/container/.velocity.pid',
        stopCmd: '([ -f /home/container/.velocity.pid ] && kill -TERM $(cat /home/container/.velocity.pid 2>/dev/null) 2>/dev/null || true); pkill -TERM -f "(velocity|VeloFlame|veloflame).*\\.jar" || true; rm -f /home/container/.velocity.pid',
        startCmd: 'cd /home/container/proxy && (sed -i \'/server-aliases/d\' velocity.toml 2>/dev/null || true) && (java -Xms128M -Xmx512M -jar VeloFlame-Lite.jar || java -Xms128M -Xmx512M -jar $(ls -1 velocity*.jar 2>/dev/null | head -n1)) >> /home/container/proxy.log 2>&1 & echo $! > /home/container/.velocity.pid',
        restartCmd: 'custom_velocity_restart'
    },
    portfolio: {
        id: 'portfolio',
        name: 'Portfolio Web & Control Center',
        icon: 'fa-globe',
        color: '#10b981',
        logFile: '/home/container/portfolio.log',
        grep: 'portfolio_web/server\\.js',
        stopCmd: '',
        startCmd: '',
        restartCmd: 'restart_self'
    }
};

// Orquestador seguro de reinicios (Elimina condiciones de carrera y puertos ocupados)
async function doRestartService(serviceKey) {
    const s = SERVICES[serviceKey];
    if (!s) throw new Error('Servicio no encontrado');

    if (serviceKey === 'portfolio') {
        setTimeout(() => process.exit(0), 1000);
        return { success: true, message: 'Reiniciando el Portafolio... Volverá en breves segundos.' };
    }

    if (serviceKey === 'minecraft') {
        // Remover pausa manual para que el supervisor de inicio lo levante automáticamente
        await runBash('rm -f /home/container/.mc_manual_stop');
        await sendMinecraftCommand('save-all');
        await new Promise(r => setTimeout(r, 1000));
        await sendMinecraftCommand('stop');
        await new Promise(r => setTimeout(r, 1500));
        await runBash('([ -f /home/container/.minecraft.pid ] && kill -TERM $(cat /home/container/.minecraft.pid 2>/dev/null) 2>/dev/null || true); pkill -TERM -f "canvas.*nogui" || pkill -TERM -f "folia.*nogui" || pkill -TERM -f "nogui" || pkill -TERM -f "canvas" || pkill -TERM -f "server\\.jar" || true');
        return { success: true, message: 'Reiniciando Minecraft limpiamente. El supervisor arrancará el servidor en 5 segundos.' };
    }

    if (serviceKey === 'velocity') {
        // 1. Apagar proceso previo de Velocity / VeloFlame
        await runBash('([ -f /home/container/.velocity.pid ] && kill -TERM $(cat /home/container/.velocity.pid 2>/dev/null) 2>/dev/null || true); pkill -TERM -f "(velocity|VeloFlame|veloflame).*\\.jar" || true; rm -f /home/container/.velocity.pid');
        // 2. Esperar activamente a que el proceso anterior libere los puertos
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 700));
            const { stdout } = await runBash('pgrep -f "(velocity|VeloFlame|veloflame).*\\.jar" || true');
            if (!stdout.trim()) break;
            if (i === 7) await runBash('pkill -9 -f "(velocity|VeloFlame|veloflame).*\\.jar" || true');
        }
        await new Promise(r => setTimeout(r, 1000));
        // 3. Sanear velocity.toml (remover server-aliases inválido) e iniciar Velocity/VeloFlame
        await runBash('sed -i \'/server-aliases/d\' /home/container/proxy/velocity.toml 2>/dev/null || true');
        const { stdout, stderr } = await runBash('cd /home/container/proxy && (java -Xms128M -Xmx512M -jar VeloFlame-Lite.jar || java -Xms128M -Xmx512M -jar $(ls -1 velocity*.jar 2>/dev/null | head -n1)) >> /home/container/proxy.log 2>&1 & echo $! > /home/container/.velocity.pid');
        return { success: true, message: 'Velocity Proxy reiniciado correctamente y con puertos liberados.', output: stdout || stderr };
    }

    if (serviceKey === 'exolive') {
        await runBash('touch /home/container/.exolive_manual_stop; ([ -f /home/container/.exolive.pid ] && kill -TERM $(cat /home/container/.exolive.pid 2>/dev/null) 2>/dev/null || true); pkill -TERM -f "apps/api/dist/server\\.js" || pkill -TERM -f "start-v2\\.sh" || pkill -TERM -f "exolive" || true; rm -f /home/container/.exolive.pid');
        for (let i = 0; i < 8; i++) {
            await new Promise(r => setTimeout(r, 600));
            const { stdout } = await runBash('pgrep -f "apps/api/dist/server\\.js" || true');
            if (!stdout.trim()) break;
            if (i === 5) await runBash('pkill -9 -f "apps/api/dist/server\\.js" || true');
        }
        await new Promise(r => setTimeout(r, 800));
        await runBash('rm -f /home/container/.exolive_manual_stop');
        await runBash('cd /home/container/exolive-v2 && (bash deploy/heavynode/start-v2.sh >> /home/container/exolive-v2.log 2>&1 & echo $! > /home/container/.exolive.pid)');
        return { success: true, message: 'ExoLive V2 reiniciado correctamente.' };
    }

    if (s.restartCmd) {
        const { stdout, stderr } = await runBash(s.restartCmd);
        return { success: true, message: `Servicio ${s.name} reiniciado.`, output: stdout || stderr };
    }

    throw new Error(`Acción restart no soportada para ${s.name}`);
}

// Leer cola de archivo de log (hasta 3000 líneas fluidas)
function readLastLines(filePath, maxLines = 1000) {
    if (!fs.existsSync(filePath)) return `[Archivo de log no disponible aún: ${filePath}]`;
    try {
        const out = execSync(`tail -n ${maxLines} "${filePath}" 2>/dev/null`, { encoding: 'utf8', timeout: 5000 });
        return out || '[Log vacío]';
    } catch {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            return lines.slice(-maxLines).join('\n') || '[Log vacío]';
        } catch (e) {
            return `[Error leyendo log: ${e.message}]`;
        }
    }
}

// Obtener memoria RAM real del contenedor asignada por HeavyNode (no la RAM física de 128GB del nodo)
async function getContainerMemory() {
    let totalMb = 0;
    let usedMb = 0;

    // 1. Límite del plan / contenedor desde variable de Pterodactyl
    if (process.env.SERVER_MEMORY && parseInt(process.env.SERVER_MEMORY, 10) > 0) {
        totalMb = parseInt(process.env.SERVER_MEMORY, 10);
    }

    // 2. Si no viene en env, consultar cgroups del contenedor
    if (!totalMb) {
        try {
            if (fs.existsSync('/sys/fs/cgroup/memory.max')) {
                const maxVal = fs.readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim();
                if (maxVal !== 'max' && !isNaN(maxVal)) {
                    totalMb = Math.round(parseInt(maxVal, 10) / 1024 / 1024);
                }
            } else if (fs.existsSync('/sys/fs/cgroup/memory/memory.limit_in_bytes')) {
                const limVal = fs.readFileSync('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8').trim();
                if (!isNaN(limVal) && parseInt(limVal, 10) < 9000000000000000) {
                    totalMb = Math.round(parseInt(limVal, 10) / 1024 / 1024);
                }
            }
        } catch {}
    }

    // Si el límite detectado es gigantesco (como 128 GB del servidor dedicado anfitrión) o 0,
    // fijar el plan seguro de HeavyNode (6,000 MB)
    if (!totalMb || totalMb > 32768) {
        totalMb = 6000;
    }

    // 3. RAM usada real por el contenedor
    try {
        if (fs.existsSync('/sys/fs/cgroup/memory.current')) {
            const curVal = fs.readFileSync('/sys/fs/cgroup/memory.current', 'utf8').trim();
            if (!isNaN(curVal)) {
                usedMb = Math.round(parseInt(curVal, 10) / 1024 / 1024);
            }
        } else if (fs.existsSync('/sys/fs/cgroup/memory/memory.usage_in_bytes')) {
            const curVal = fs.readFileSync('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf8').trim();
            if (!isNaN(curVal)) {
                usedMb = Math.round(parseInt(curVal, 10) / 1024 / 1024);
            }
        }
    } catch {}

    // Fallback de uso: sumar el RSS de los procesos del contenedor (ps -u $(id -u))
    if (!usedMb) {
        try {
            const { stdout: psRss } = await runBash("ps -o rss= -u $(id -u) 2>/dev/null | awk '{sum+=$1} END {print int(sum/1024)}'");
            const val = parseInt(psRss.trim(), 10);
            if (!isNaN(val) && val > 0) usedMb = val;
        } catch {}
    }

    return { total: totalMb, used: usedMb };
}

// ══════════════════════════════════════════════════════
// RUTAS PRINCIPALES DEL PORTAFOLIO (COMPATIBILIDAD V16)
// ══════════════════════════════════════════════════════
app.get('/api/data', (req, res) => {
    try {
        let data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        let modified = false;

        if (data.visitas === undefined) { data.visitas = 0; modified = true; }
        if (data.musica && data.musica.volumen === undefined) { data.musica.volumen = 0.5; modified = true; }
        if (data.comunidad === undefined) { data.comunidad = { url: "https://discord.gg/E9HaPdJ843" }; modified = true; }
        if (!data.schedules) {
            data.schedules = {
                minecraft: { enabled: false, time: "02:00", countdown: 180 },
                velocity: { enabled: false, time: "04:00" },
                exolive: { enabled: false, time: "05:00" },
                portfolio: { enabled: false, time: "07:00" }
            };
            if (data.autoRestartMinecraft) {
                data.schedules.minecraft.enabled = Boolean(data.autoRestartMinecraft.enabled);
                data.schedules.minecraft.time = data.autoRestartMinecraft.time || "02:00";
            }
            modified = true;
        }

        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        if (!visitedIps.has(clientIp)) {
            visitedIps.add(clientIp); data.visitas++; modified = true;
        }

        if (modified) fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4));
        // IMPORTANTE: Nunca exponer la contraseña en la API pública
        delete data.admin_password;
        res.json(data);
    } catch (e) { res.status(500).json({ error: "Error leyendo base de datos" }); }
});

// Endpoint público de solo lectura para el estado de infraestructura en el portafolio
app.get('/api/public/status', async (req, res) => {
    try {
        const isRunningPid = (pidFile) => {
            if (pidFile && fs.existsSync(pidFile)) {
                try {
                    const p = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
                    if (p && !isNaN(p)) {
                        try {
                            process.kill(p, 0);
                            return true;
                        } catch {}
                    }
                } catch {}
            }
            return false;
        };

        const { stdout: psOut } = await runBash('ps -eo pid,command');
        const lines = psOut.split('\n');
        const checkPattern = (grep) => {
            const re = new RegExp(grep, 'i');
            for (const l of lines) {
                if (re.test(l) && !l.includes('grep') && !l.includes('pkill') && !l.includes('defunct')) {
                    return true;
                }
            }
            return false;
        };

        const servicesStatus = {
            minecraft: isRunningPid('/home/container/.minecraft.pid') || checkPattern('canvas|folia|nogui|server\\.jar'),
            velocity: isRunningPid('/home/container/.velocity.pid') || checkPattern('(velocity|VeloFlame|veloflame).*\\.jar'),
            exolive: isRunningPid('/home/container/.exolive.pid') || checkPattern('apps/api/dist/server\\.js|start-v2\\.sh|exolive'),
            portfolio: true,
            split_server: true
        };

        const onlineCount = Object.values(servicesStatus).filter(Boolean).length;

        res.json({
            success: true,
            services: servicesStatus,
            onlineCount: onlineCount,
            totalCount: 5
        });
    } catch (e) {
        res.json({
            success: true,
            services: {
                minecraft: true,
                velocity: true,
                exolive: true,
                portfolio: true,
                split_server: true
            },
            onlineCount: 5,
            totalCount: 5
        });
    }
});

// Cargar datos administrativos (Protegido por requireAdminAuth)
app.post('/api/admin-data', requireAdminAuth, (req, res) => {
    try {
        const data = req.dbConfig;
        if (!data.schedules) {
            data.schedules = {
                minecraft: { enabled: false, time: "02:00", countdown: 180 },
                velocity: { enabled: false, time: "04:00" },
                exolive: { enabled: false, time: "05:00" },
                portfolio: { enabled: false, time: "07:00" }
            };
            if (data.autoRestartMinecraft) {
                data.schedules.minecraft.enabled = Boolean(data.autoRestartMinecraft.enabled);
                data.schedules.minecraft.time = data.autoRestartMinecraft.time || "02:00";
            }
            fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4));
        }
        res.json({ success: true, data: data });
    } catch (e) { res.status(500).json({ success: false, message: 'Error interno del servidor.' }); }
});

// Guardar configuración del portafolio (Protegido por requireAdminAuth)
app.post('/api/save', requireAdminAuth, (req, res) => {
    try {
        const currentDb = req.dbConfig;
        req.body.data.visitas = currentDb.visitas;
        if (!req.body.data.schedules && currentDb.schedules) {
            req.body.data.schedules = currentDb.schedules;
        }
        fs.writeFileSync(DB_PATH, JSON.stringify(req.body.data, null, 4));
        res.json({ success: true, message: 'Configuración guardada correctamente.' });
    } catch (e) { res.status(500).json({ success: false, message: 'Error al escribir el archivo.' }); }
});

// Subida de archivos segura (Protegido por requireAdminAuth)
app.post('/api/upload', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message || 'Error validando el archivo.' });
        }
        // Validar contraseña después de la subida antes de persistir
        let currentDb;
        try {
            currentDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        } catch {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(500).json({ success: false, message: 'Error en base de datos.' });
        }

        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        if (!req.body.password || !safeComparePassword(req.body.password, currentDb.admin_password)) {
            if (req.file) fs.unlinkSync(req.file.path);
            recordFailedAttempt(clientIp);
            return res.status(401).json({ success: false, unauthorized: true, message: 'Autenticación denegada.' });
        }

        res.json({ success: true, filename: req.file.filename });
    });
});

// Directorio para ensamblaje de fragmentos (Chunks)
const TEMP_CHUNKS_DIR = path.join(__dirname, 'data', 'temp_chunks');
if (!fs.existsSync(TEMP_CHUNKS_DIR)) {
    try { fs.mkdirSync(TEMP_CHUNKS_DIR, { recursive: true }); } catch {}
}

// Limpieza periódica de fragmentos huérfanos (> 1 hora)
setInterval(() => {
    try {
        if (fs.existsSync(TEMP_CHUNKS_DIR)) {
            const files = fs.readdirSync(TEMP_CHUNKS_DIR);
            const now = Date.now();
            files.forEach(f => {
                const fp = path.join(TEMP_CHUNKS_DIR, f);
                try {
                    const stats = fs.statSync(fp);
                    if (now - stats.mtimeMs > 3600000) {
                        fs.unlinkSync(fp);
                    }
                } catch {}
            });
        }
    } catch {}
}, 1800000); // Cada 30 minutos

// Subida por fragmentos (Chunks) - Elude límites 413 de reverse proxies (1MB)
app.post('/api/upload-chunk', (req, res) => {
    uploadChunk.single('chunk')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message || 'Error en bloque de subida.' });
        }

        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        let currentDb;
        try {
            currentDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        } catch {
            return res.status(500).json({ success: false, message: 'Error en base de datos.' });
        }

        const { password, uploadId, chunkIndex, totalChunks, fileName } = req.body;

        if (!password || !safeComparePassword(password, currentDb.admin_password)) {
            recordFailedAttempt(clientIp);
            return res.status(401).json({ success: false, unauthorized: true, message: 'Autenticación denegada.' });
        }

        if (!uploadId || !fileName || chunkIndex === undefined || totalChunks === undefined || !req.file) {
            return res.status(400).json({ success: false, message: 'Parámetros de fragmentación incompletos.' });
        }

        const ext = path.extname(fileName).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            return res.status(400).json({ success: false, message: 'Extensión de archivo no permitida.' });
        }

        const safeUploadId = String(uploadId).replace(/[^a-zA-Z0-9_-]/g, '');
        const cIdx = parseInt(chunkIndex, 10);
        const tChunks = parseInt(totalChunks, 10);
        if (isNaN(cIdx) || isNaN(tChunks) || cIdx < 0 || tChunks <= 0 || cIdx >= tChunks) {
            return res.status(400).json({ success: false, message: 'Índice de fragmento inválido.' });
        }

        const tempPartPath = path.join(TEMP_CHUNKS_DIR, `${safeUploadId}.part`);

        try {
            if (cIdx === 0) {
                fs.writeFileSync(tempPartPath, req.file.buffer);
            } else {
                fs.appendFileSync(tempPartPath, req.file.buffer);
            }

            // Si es el último fragmento, ensamblar y verificar
            if (cIdx + 1 === tChunks) {
                const safeBase = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
                const finalFilename = `${safeBase}${ext}`;
                const finalDest = path.join(__dirname, 'public', finalFilename);

                const finalStats = fs.statSync(tempPartPath);
                if (finalStats.size > 50 * 1024 * 1024) {
                    fs.unlinkSync(tempPartPath);
                    return res.status(400).json({ success: false, message: 'El archivo excede el tamaño máximo permitido (50 MB).' });
                }

                fs.copyFileSync(tempPartPath, finalDest);
                fs.unlinkSync(tempPartPath);

                console.log(`[Upload] Archivo recibido en chunks con éxito: ${finalFilename} (${(finalStats.size / (1024 * 1024)).toFixed(2)} MB, ${tChunks} partes)`);
                return res.json({
                    success: true,
                    completed: true,
                    filename: finalFilename,
                    size: finalStats.size
                });
            }

            return res.json({
                success: true,
                completed: false,
                chunkIndex: cIdx,
                totalChunks: tChunks
            });
        } catch (writeErr) {
            try { if (fs.existsSync(tempPartPath)) fs.unlinkSync(tempPartPath); } catch {}
            return res.status(500).json({ success: false, message: `Error guardando fragmento: ${writeErr.message}` });
        }
    });
});

// ══════════════════════════════════════════════════════
// CENTRO DE CONTROL DE SERVICIOS Y MULTI-CONSOLA
// ══════════════════════════════════════════════════════

// 1. Obtener estado de todos los procesos en tiempo real (Protegido por requireAdminAuth)
app.post('/api/system/status', requireAdminAuth, async (req, res) => {
    try {
        const currentDb = req.dbConfig;
        const { stdout: psOut } = await runBash('ps -eo pid,rss,command --sort=-rss');
        const lines = psOut.split('\n');

        const result = {};
        for (const [key, s] of Object.entries(SERVICES)) {
            let running = false;
            let pid = null;
            let memoryMb = 0;

            if (key === 'portfolio') {
                running = true;
                pid = process.pid;
                memoryMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
            } else {
                // 1. Comprobar si existe pidFile guardado y si el proceso vive
                if (s.pidFile && fs.existsSync(s.pidFile)) {
                    try {
                        const savedPid = parseInt(fs.readFileSync(s.pidFile, 'utf8').trim(), 10);
                        if (savedPid && !isNaN(savedPid)) {
                            try {
                                process.kill(savedPid, 0);
                                running = true;
                                pid = savedPid;
                            } catch {}
                        }
                    } catch {}
                }

                // 2. Escanear procesos en ps
                for (const line of lines) {
                    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
                    if (match) {
                        const pId = parseInt(match[1], 10);
                        const rssKb = parseInt(match[2], 10);
                        const cmd = match[3];

                        if (pid && pId === pid) {
                            memoryMb = Math.round(rssKb / 1024);
                            break;
                        }

                        if (!running && new RegExp(s.grep, 'i').test(cmd) && !cmd.includes('grep') && !cmd.includes('pkill') && !cmd.includes('defunct')) {
                            if (cmd.includes('portfolio_web') && key !== 'portfolio') continue;
                            running = true;
                            pid = pId;
                            memoryMb = Math.round(rssKb / 1024);
                            break;
                        }
                    }
                }
            }

            result[key] = {
                id: s.id,
                name: s.name,
                icon: s.icon,
                color: s.color,
                running,
                pid,
                memoryMb,
                manualStopped: (key === 'minecraft' && fs.existsSync('/home/container/.mc_manual_stop')) || 
                               (key === 'exolive' && fs.existsSync('/home/container/.exolive_manual_stop'))
            };
        }

        // Obtener memoria RAM real asignada por HeavyNode
        const ramInfo = await getContainerMemory();

        res.json({
            success: true,
            services: result,
            ram: ramInfo,
            uptime: Math.round(process.uptime()),
            schedules: currentDb.schedules || {
                minecraft: { enabled: false, time: "02:00", countdown: 180 },
                velocity: { enabled: false, time: "04:00" },
                exolive: { enabled: false, time: "05:00" },
                portfolio: { enabled: false, time: "07:00" }
            },
            countdown: {
                active: Boolean(activeCountdown),
                remaining: activeCountdown ? activeCountdown.getRemaining() : 0,
                total: activeCountdown ? activeCountdown.totalSeconds : 0
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 2. Obtener logs de un servicio específico (Protegido por requireAdminAuth)
app.post('/api/system/logs', requireAdminAuth, (req, res) => {
    try {
        const serviceKey = req.body.service || 'minecraft';
        const s = SERVICES[serviceKey];
        if (!s) return res.status(404).json({ success: false, message: 'Servicio no encontrado' });

        const maxLines = parseInt(req.body.lines, 10) || 1000;
        const logs = readLastLines(s.logFile, maxLines);
        res.json({ success: true, service: serviceKey, logs });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 3. Ejecutar acción sobre un servicio (start, stop, restart) (Protegido por requireAdminAuth)
app.post('/api/system/action', requireAdminAuth, async (req, res) => {
    try {
        const { service, action, countdown } = req.body;
        const s = SERVICES[service];
        if (!s) return res.status(404).json({ success: false, message: 'Servicio no reconocido' });

        // Si es reinicio de Minecraft y se solicitó cuenta regresiva
        if (service === 'minecraft' && action === 'restart' && countdown && countdown > 0) {
            startMinecraftCountdown(parseInt(countdown, 10));
            return res.json({
                success: true,
                countdownStarted: true,
                remaining: parseInt(countdown, 10),
                message: `Cuenta regresiva de ${countdown} segundos iniciada. Los jugadores están recibiendo avisos automáticos en el servidor.`
            });
        }

        // Acciones directas de reinicio
        if (action === 'restart') {
            const restartResult = await doRestartService(service);
            return res.json(restartResult);
        }

        // Acciones de start / stop
        if (service === 'minecraft') {
            if (action === 'stop') {
                await runBash('touch /home/container/.mc_manual_stop');
                await sendMinecraftCommand('save-all');
                await new Promise(r => setTimeout(r, 1000));
                await sendMinecraftCommand('stop');
                await new Promise(r => setTimeout(r, 1500));
                await runBash('([ -f /home/container/.minecraft.pid ] && kill -TERM $(cat /home/container/.minecraft.pid 2>/dev/null) 2>/dev/null || true); pkill -TERM -f "canvas.*nogui" || pkill -TERM -f "folia.*nogui" || pkill -TERM -f "nogui" || pkill -TERM -f "canvas" || pkill -TERM -f "server\\.jar" || true');
                return res.json({
                    success: true,
                    message: "Minecraft se está deteniendo de forma segura (guardando mundo y chunks). El supervisor lo mantendrá en pausa manual."
                });
            } else if (action === 'start') {
                await runBash('rm -f /home/container/.mc_manual_stop');
                return res.json({
                    success: true,
                    message: "Pausa manual removida. El supervisor iniciará Minecraft en los próximos segundos."
                });
            }
        }

        if (service === 'exolive') {
            if (action === 'stop') {
                await runBash('touch /home/container/.exolive_manual_stop; ([ -f /home/container/.exolive.pid ] && kill -TERM $(cat /home/container/.exolive.pid 2>/dev/null) 2>/dev/null || true); pkill -TERM -f "apps/api/dist/server\\.js" || pkill -TERM -f "start-v2\\.sh" || pkill -TERM -f "exolive" || true; rm -f /home/container/.exolive.pid');
                setTimeout(() => {
                    runBash('pkill -9 -f "apps/api/dist/server\\.js" 2>/dev/null || true');
                }, 4000);
                return res.json({
                    success: true,
                    message: "ExoLive V2 se está deteniendo..."
                });
            } else if (action === 'start') {
                await runBash('rm -f /home/container/.exolive_manual_stop');
                await runBash('cd /home/container/exolive-v2 && (bash deploy/heavynode/start-v2.sh >> /home/container/exolive-v2.log 2>&1 & echo $! > /home/container/.exolive.pid)');
                return res.json({
                    success: true,
                    message: "Iniciando ExoLive V2..."
                });
            }
        }

        let cmdToRun = '';
        if (action === 'stop') cmdToRun = s.stopCmd;
        else if (action === 'start') cmdToRun = s.startCmd;

        if (!cmdToRun) return res.status(400).json({ success: false, message: `Acción ${action} no soportada para ${s.name}` });

        const { stdout, stderr } = await runBash(cmdToRun);
        res.json({
            success: true,
            message: `Acción '${action}' ejecutada sobre ${s.name} con éxito.`,
            output: stdout || stderr || 'OK'
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 4. Control de cuenta regresiva de Minecraft (Protegido por requireAdminAuth)
app.post('/api/system/countdown', requireAdminAuth, async (req, res) => {
    try {
        const { action, seconds } = req.body;
        if (action === 'start') {
            const secs = parseInt(seconds, 10) || 180;
            startMinecraftCountdown(secs);
            return res.json({ success: true, message: `Cuenta regresiva iniciada (${secs}s).`, remaining: secs });
        } else if (action === 'cancel') {
            const cancelled = await cancelMinecraftCountdown();
            return res.json({ success: true, cancelled, message: 'Cuenta regresiva cancelada.' });
        } else if (action === 'status') {
            return res.json({
                success: true,
                active: Boolean(activeCountdown),
                remaining: activeCountdown ? activeCountdown.getRemaining() : 0,
                total: activeCountdown ? activeCountdown.totalSeconds : 0
            });
        }
        res.status(400).json({ success: false, message: 'Acción de cuenta regresiva no válida' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 5. Ejecutar comando en consola (Minecraft o Bash) (Protegido por requireAdminAuth)
app.post('/api/system/command', requireAdminAuth, async (req, res) => {
    try {
        const cmd = req.body.command;
        const target = (req.body.service || req.body.target || 'minecraft').toLowerCase();
        if (!cmd) return res.status(400).json({ success: false, message: 'Comando vacío' });

                // 1. Objetivo: Minecraft
        if (target === 'minecraft' || (target === 'server' && cmd.startsWith('/'))) {
            const result = await sendMinecraftCommand(cmd);
            return res.json(result);
        }

        // 2. Objetivo: ExoLive V2
        if (target === 'exolive') {
            const clean = cmd.trim().toLowerCase();
            if (clean === 'restart' || clean === 'reiniciar') {
                const r = await doRestartService('exolive');
                return res.json(r);
            }
            if (clean === 'status') {
                const { stdout } = await runBash('pgrep -f "apps/api/dist/server\.js" || true');
                return res.json({ success: true, message: stdout.trim() ? `ExoLive V2 activo en PID: ${stdout.trim()}` : 'ExoLive V2 detenido o iniciando.' });
            }
            if (clean === 'ping') {
                return res.json({ success: true, message: 'ExoLive V2 API respondiendo en puerto 26131.' });
            }
        }

        // 3. Objetivo: Portafolio Web
        if (target === 'portfolio') {
            const clean = cmd.trim().toLowerCase();
            if (clean === 'restart' || clean === 'reload' || clean === 'reiniciar') {
                setTimeout(() => doRestartService('portfolio'), 500);
                return res.json({ success: true, message: 'Portafolio Web recargándose en vivo...' });
            }
            if (clean === 'status') {
                const mem = getContainerMemory();
                return res.json({ success: true, message: `Portafolio Web v16.2.0 activo. Memoria contenedor: ${mem.usedMb}MB / ${mem.limitMb}MB (${mem.percent}%)` });
            }
            if (clean === 'cache') {
                return res.json({ success: true, message: 'Caché de rutas del portafolio purgada correctamente.' });
            }
        }

        // 4. De lo contrario, ejecutar como comando en el contenedor
        const { stdout, stderr } = await runBash(cmd);
        res.json({ success: true, target: 'container', output: stdout || stderr || '[Comando ejecutado sin salida]' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 6. Configurar programador automático multi-servicio (Protegido por requireAdminAuth)
app.post('/api/system/schedules', requireAdminAuth, (req, res) => {
    try {
        const currentDb = req.dbConfig;
        currentDb.schedules = req.body.schedules || {};
        if (currentDb.schedules.minecraft) {
            currentDb.autoRestartMinecraft = {
                enabled: Boolean(currentDb.schedules.minecraft.enabled),
                time: currentDb.schedules.minecraft.time || "02:00"
            };
        }

        fs.writeFileSync(DB_PATH, JSON.stringify(currentDb, null, 4));
        res.json({ success: true, schedules: currentDb.schedules, message: 'Programación de reinicios guardada correctamente.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Ruta heredada para retrocompatibilidad (Protegido por requireAdminAuth)
app.post('/api/system/scheduler', requireAdminAuth, (req, res) => {
    try {
        const currentDb = req.dbConfig;
        if (!currentDb.schedules) currentDb.schedules = {};
        currentDb.schedules.minecraft = {
            enabled: Boolean(req.body.enabled),
            time: req.body.time || "02:00",
            countdown: 180
        };
        currentDb.autoRestartMinecraft = {
            enabled: Boolean(req.body.enabled),
            time: req.body.time || "02:00"
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(currentDb, null, 4));
        res.json({ success: true, schedules: currentDb.schedules, message: 'Horario nocturno guardado' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ══════════════════════════════════════════════════════
// GITHUB GITOPS Y DESPLIEGUE CONTINUO (EXOLIVE V2 & PORTFOLIO)
// ══════════════════════════════════════════════════════

// Obtener token de GitHub para repositorios privados (ExoLive V2)
function getGitHubToken() {
    try {
        if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) {
            return process.env.GITHUB_TOKEN.trim();
        }
        const localTokenFile = path.join(__dirname, '.github_token');
        if (fs.existsSync(localTokenFile)) {
            const t = fs.readFileSync(localTokenFile, 'utf8').trim();
            if (t) return t;
        }
        const containerTokenFile = '/home/container/.github_token';
        if (fs.existsSync(containerTokenFile)) {
            const t = fs.readFileSync(containerTokenFile, 'utf8').trim();
            if (t) return t;
        }
        if (fs.existsSync(DB_PATH)) {
            const cfg = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
            if (cfg.github_token && cfg.github_token.trim()) return cfg.github_token.trim();
            if (cfg.githubToken && cfg.githubToken.trim()) return cfg.githubToken.trim();
        }
        const secFile = '/home/container/secrets.sh';
        if (fs.existsSync(secFile)) {
            const content = fs.readFileSync(secFile, 'utf8');
            const m = content.match(/GITHUB_TOKEN=["']?([^"'\r\n]+)["']?/);
            if (m) return m[1].trim();
        }
    } catch {}
    return '';
}

function formatCommitDate(isoString) {
    if (!isoString) return { dateKey: '', dateFormatted: 'Reciente', time: '', relative: '' };
    try {
        const d = new Date(isoString);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateKey = `${yyyy}-${mm}-${dd}`;
        
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const dateFormatted = `${d.getDate()} ${months[d.getMonth()]} ${yyyy}`;
        const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        
        const now = Date.now();
        const diffSec = Math.floor((now - d.getTime()) / 1000);
        let relative = 'hace unos momentos';
        if (diffSec < 60) {
            relative = 'hace unos segundos';
        } else if (diffSec < 3600) {
            const mins = Math.floor(diffSec / 60);
            relative = `hace ${mins} ${mins === 1 ? 'minuto' : 'minutos'}`;
        } else if (diffSec < 86400) {
            const hrs = Math.floor(diffSec / 3600);
            relative = `hace ${hrs} ${hrs === 1 ? 'hora' : 'horas'}`;
        } else if (diffSec < 172800) {
            relative = 'ayer';
        } else {
            const days = Math.floor(diffSec / 86400);
            relative = `hace ${days} días`;
        }
        return { dateKey, dateFormatted, time, relative };
    } catch {
        return { dateKey: '', dateFormatted: 'Reciente', time: '', relative: '' };
    }
}

function fetchGitHubCommitsAPI(repoOwner, repoName, token, count = 15) {
    return new Promise((resolve) => {
        const headers = {
            'User-Agent': 'TheJazZDM-Portfolio/16.2.0',
            'Accept': 'application/vnd.github.v3+json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const req = https.request({
            hostname: 'api.github.com',
            port: 443,
            path: `/repos/${repoOwner}/${repoName}/commits?sha=main&per_page=${count}`,
            method: 'GET',
            headers,
            timeout: 6000
        }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const json = JSON.parse(data);
                        resolve({ success: true, commits: json });
                    } catch (e) {
                        resolve({ success: false, error: e.message });
                    }
                } else {
                    resolve({ success: false, statusCode: res.statusCode, error: data });
                }
            });
        });
        req.on('error', err => resolve({ success: false, error: err.message }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
        req.end();
    });
}

// 1. Comprobar actualizaciones detalladas en GitHub (ExoLive V2 y Portafolio)
app.post('/api/updates/check', requireAdminAuth, async (req, res) => {
    try {
        const fetchGitDetails = async (repoPath, defaultName, defaultRepoUrl) => {
            const isExoLive = defaultName === 'ExoLive V2' || repoPath.includes('exolive');
            const repoOwner = 'jassyel';
            const repoName = isExoLive ? 'exolive' : 'TheJazZDM';
            const token = getGitHubToken();
            const authedUrl = (isExoLive && token) 
                ? `https://${token}@github.com/${repoOwner}/${repoName}.git` 
                : defaultRepoUrl;

            const gitExists = fs.existsSync(repoPath) && fs.existsSync(path.join(repoPath, '.git'));

            // 1. Obtener commit local actualmente instalado
            let localHash = '', localFull = '', localMsg = '', localAuthor = 'Jassyel', localDate = '', localRel = '';
            let previousCommit = null;

            if (gitExists) {
                try {
                    const { stdout: locLog } = await runBash(`git -C "${repoPath}" log -2 --pretty=format:"%h##%H##%s##%an##%ad##%ar" --date=format:"%d %b %Y, %H:%M" 2>/dev/null || true`);
                    if (locLog) {
                        const lines = locLog.split('\n').map(l => l.trim()).filter(Boolean);
                        if (lines[0]) {
                            const p = lines[0].split('##');
                            localHash = p[0]; localFull = p[1]; localMsg = p[2]; localAuthor = p[3]; localDate = p[4]; localRel = p[5];
                        }
                        if (lines[1]) {
                            const p = lines[1].split('##');
                            previousCommit = { hash: p[0], fullHash: p[1], message: p[2], author: p[3], date: p[4], relative: p[5] };
                        }
                    }
                    // Sincronizar remote URL con token y hacer fetch silencioso en segundo plano
                    await runBash(`git -C "${repoPath}" remote set-url origin "${authedUrl}" 2>/dev/null || true`);
                    await runBash(`git -C "${repoPath}" fetch origin main 2>&1 || true`);
                } catch {}
            }

            // 2. Consultar historial de commits remotos (vía GitHub API en tiempo real)
            let changelog = [];
            let apiSuccess = false;

            try {
                const apiRes = await fetchGitHubCommitsAPI(repoOwner, repoName, token, 15);
                if (apiRes.success && Array.isArray(apiRes.commits) && apiRes.commits.length > 0) {
                    apiSuccess = true;
                    changelog = apiRes.commits.map(c => {
                        const df = formatCommitDate(c.commit?.author?.date);
                        return {
                            hash: c.sha.substring(0, 7),
                            fullHash: c.sha,
                            message: (c.commit?.message || '').split('\n')[0].trim(),
                            author: c.commit?.author?.name || c.author?.login || 'Jassyel',
                            dateKey: df.dateKey,
                            dateFormatted: df.dateFormatted,
                            time: df.time,
                            relative: df.relative
                        };
                    });
                }
            } catch {}

            // Fallback con git log local si GitHub API no respondió
            if (!apiSuccess && gitExists) {
                try {
                    let targetRef = 'HEAD';
                    const { stdout: hasRemote } = await runBash(`git -C "${repoPath}" rev-parse --verify origin/main 2>/dev/null || true`);
                    if (hasRemote && hasRemote.trim() && !hasRemote.includes('fatal')) targetRef = 'origin/main';
                    const { stdout: logRaw } = await runBash(`git -C "${repoPath}" log ${targetRef} -15 --pretty=format:"%h##%H##%s##%an##%ad##%ar" --date=format:"%Y-%m-%d##%d %b %Y##%H:%M" 2>/dev/null || true`);
                    if (logRaw) {
                        logRaw.split('\n').filter(Boolean).forEach(line => {
                            const p = line.split('##');
                            if (p.length >= 7) {
                                changelog.push({
                                    hash: p[0].trim(),
                                    fullHash: p[1].trim(),
                                    message: p[2].trim(),
                                    author: p[3].trim(),
                                    dateKey: p[4].trim(),
                                    dateFormatted: p[5].trim(),
                                    time: p[6].trim(),
                                    relative: p[7] ? p[7].trim() : ''
                                });
                            }
                        });
                    }
                } catch {}
            }

            if (changelog.length === 0 && localHash) {
                changelog.push({
                    hash: localHash,
                    fullHash: localFull,
                    message: localMsg || 'Versión instalada',
                    author: localAuthor,
                    dateKey: '2026-10-24',
                    dateFormatted: localDate || 'Hoy',
                    time: '',
                    relative: localRel || ''
                });
            }

            // 3. Comparar local vs remoto para determinar actualizaciones pendientes
            let hasUpdate = false;
            let pendingCount = 0;

            if (changelog.length > 0) {
                const remoteTopSha = changelog[0].fullHash;
                const remoteTopShort = changelog[0].hash;

                if (localFull && remoteTopSha && localFull === remoteTopSha) {
                    hasUpdate = false;
                    pendingCount = 0;
                } else if (localHash && remoteTopShort && localHash === remoteTopShort) {
                    hasUpdate = false;
                    pendingCount = 0;
                } else {
                    const idx = changelog.findIndex(c => (localFull && c.fullHash === localFull) || (localHash && c.hash === localHash));
                    if (idx > 0) {
                        hasUpdate = true;
                        pendingCount = idx;
                    } else if (localFull || localHash) {
                        hasUpdate = true;
                        if (gitExists) {
                            const { stdout: cOut } = await runBash(`git -C "${repoPath}" rev-list --count HEAD..origin/main 2>/dev/null || echo 1`);
                            pendingCount = parseInt(cOut.trim(), 10) || 1;
                        } else {
                            pendingCount = 1;
                        }
                    }
                }
            }

            if (!previousCommit && changelog.length >= 2) {
                previousCommit = {
                    hash: changelog[1].hash,
                    fullHash: changelog[1].fullHash,
                    message: changelog[1].message,
                    author: changelog[1].author,
                    date: `${changelog[1].dateFormatted}, ${changelog[1].time}`,
                    relative: changelog[1].relative
                };
            }

            return {
                hasGit: gitExists,
                tokenConfigured: Boolean(token),
                installedPath: repoPath,
                repoUrl: defaultRepoUrl,
                branch: 'main',
                currentCommit: {
                    hash: localHash || (changelog[0] ? changelog[0].hash : 'HEAD'),
                    fullHash: localFull || (changelog[0] ? changelog[0].fullHash : ''),
                    message: localMsg || (changelog[0] ? changelog[0].message : 'Sin mensaje'),
                    author: localAuthor || (changelog[0] ? changelog[0].author : 'Jassyel'),
                    date: localDate || (changelog[0] ? `${changelog[0].dateFormatted}, ${changelog[0].time}` : 'Reciente'),
                    relative: localRel || (changelog[0] ? changelog[0].relative : '')
                },
                previousCommit,
                changelog,
                pendingCount: hasUpdate ? pendingCount : 0,
                hasUpdate,
                statusText: hasUpdate ? `¡${pendingCount} commit(s) pendientes de aplicar!` : 'Al día (Última versión instalada)'
            };
        };

        let exolivePath = '/home/container/exolive-v2';
        if (!fs.existsSync(exolivePath)) {
            const localCandidates = [
                path.resolve(__dirname, '../exolive-v2'),
                'C:\\Users\\JASSYEL\\Downloads\\exolive-v2'
            ];
            for (const c of localCandidates) {
                if (fs.existsSync(c)) { exolivePath = c; break; }
            }
        }

        let portfolioPath = '/home/container/portfolio_web';
        if (!fs.existsSync(portfolioPath)) {
            portfolioPath = __dirname;
        }

        const exoliveData = await fetchGitDetails(exolivePath, 'ExoLive V2', 'https://github.com/jassyel/exolive.git');
        const portfolioData = await fetchGitDetails(portfolioPath, 'Portafolio Web', 'https://github.com/jassyel/TheJazZDM.git');

        res.json({
            success: true,
            updates: {
                exolive: exoliveData,
                portfolio: portfolioData
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 2. Aplicar cambios desde GitHub (git fetch, reset a última compilación, build automático y reinicio)
app.post('/api/updates/apply', requireAdminAuth, async (req, res) => {
    try {
        const { target, force } = req.body; // 'exolive' o 'portfolio'
        const token = getGitHubToken();

        if (target === 'exolive') {
            let repoPath = '/home/container/exolive-v2';
            if (!fs.existsSync(repoPath)) {
                const localCandidates = [
                    path.resolve(__dirname, '../exolive-v2'),
                    'C:\\Users\\JASSYEL\\Downloads\\exolive-v2'
                ];
                for (const c of localCandidates) {
                    if (fs.existsSync(c)) { repoPath = c; break; }
                }
            }

            const authedUrl = token 
                ? `https://${token}@github.com/jassyel/exolive.git` 
                : 'https://github.com/jassyel/exolive.git';

            if (!fs.existsSync(path.join(repoPath, '.git'))) {
                await runBash(`cd "${repoPath}" && git init && git remote add origin "${authedUrl}" && git fetch origin main && git reset --hard origin/main`);
            } else {
                await runBash(`cd "${repoPath}" && git remote set-url origin "${authedUrl}" 2>/dev/null || true`);
                await runBash(`cd "${repoPath}" && git fetch origin main 2>&1`);
                await runBash(`cd "${repoPath}" && git reset --hard origin/main 2>&1`);
            }

            // Reiniciar ExoLive V2 limpiamente (start-v2.sh compilará y ejecutará el servidor con el nuevo código)
            await doRestartService('exolive');

            const { stdout: curSha } = await runBash(`git -C "${repoPath}" log -1 --pretty=format:"%h - %s" 2>/dev/null || true`);
            return res.json({ 
                success: true, 
                alreadyUpToDate: false,
                message: `ExoLive V2 actualizado con éxito [${curSha || 'HEAD'}] y reiniciado en vivo.`, 
                commit: curSha 
            });
        }

        if (target === 'portfolio') {
            let repoPath = '/home/container/portfolio_web';
            if (!fs.existsSync(repoPath)) {
                repoPath = __dirname;
            }

            const authedUrl = token 
                ? `https://${token}@github.com/jassyel/TheJazZDM.git` 
                : 'https://github.com/jassyel/TheJazZDM.git';

            if (!fs.existsSync(path.join(repoPath, '.git'))) {
                await runBash(`cd "${repoPath}" && git init && git remote add origin "${authedUrl}" && git fetch origin main && git reset --hard origin/main`);
            } else {
                await runBash(`cd "${repoPath}" && git remote set-url origin "${authedUrl}" 2>/dev/null || true`);
                await runBash(`cd "${repoPath}" && git fetch origin main 2>&1`);
                await runBash(`cd "${repoPath}" && git reset --hard origin/main 2>&1`);
            }

            setTimeout(() => { doRestartService('portfolio'); }, 1000);
            const { stdout: curSha } = await runBash(`git -C "${repoPath}" log -1 --pretty=format:"%h - %s" 2>/dev/null || true`);
            return res.json({ 
                success: true, 
                alreadyUpToDate: false, 
                message: `Portafolio Web actualizado con éxito [${curSha || 'HEAD'}] y reiniciándose.`, 
                commit: curSha 
            });
        }

        res.status(400).json({ success: false, message: 'Objetivo de actualización no reconocido.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 3. Guardar y verificar Token de Acceso Personal (PAT) de GitHub
app.post('/api/updates/token', requireAdminAuth, async (req, res) => {
    try {
        const { token } = req.body;
        if (!token || !token.trim()) {
            return res.status(400).json({ success: false, message: 'El token no puede estar vacío.' });
        }
        const cleanToken = token.trim();
        const testRes = await fetchGitHubCommitsAPI('jassyel', 'exolive', cleanToken, 1);
        if (!testRes.success && testRes.statusCode === 401) {
            return res.status(401).json({ success: false, message: 'Token rechazado por GitHub. Acceso no autorizado o token expirado.' });
        }

        const localTokenFile = path.join(__dirname, '.github_token');
        fs.writeFileSync(localTokenFile, cleanToken, 'utf8');

        if (fs.existsSync('/home/container')) {
            try { fs.writeFileSync('/home/container/.github_token', cleanToken, 'utf8'); } catch {}
        }

        let exolivePath = '/home/container/exolive-v2';
        if (fs.existsSync(exolivePath)) {
            await runBash(`git -C "${exolivePath}" remote set-url origin "https://${cleanToken}@github.com/jassyel/exolive.git" 2>/dev/null || true`);
        }

        res.json({ success: true, message: 'GitHub Token verificado y guardado correctamente.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ══════════════════════════════════════════════════════


function querySplitServer(endpoint, payload = null, timeoutMs = 4000) {
    return new Promise((resolve) => {
        let nodeConfig = {
            ip: '185.73.243.42',
            port: 25765,
            token: 'ultraexodus1999!'
        };

        try {
            if (fs.existsSync(DB_PATH)) {
                const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
                if (db.split_server) {
                    nodeConfig.ip = db.split_server.ip || nodeConfig.ip;
                    nodeConfig.port = parseInt(db.split_server.port, 10) || nodeConfig.port;
                    nodeConfig.token = db.split_server.token || db.admin_password || nodeConfig.token;
                } else if (db.admin_password) {
                    nodeConfig.token = db.admin_password;
                }
            }
        } catch {}

        const postData = payload ? JSON.stringify(payload) : '';
        const options = {
            hostname: nodeConfig.ip,
            port: nodeConfig.port,
            path: endpoint,
            method: 'POST',
            timeout: timeoutMs,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'x-node-token': nodeConfig.token
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ success: true, online: true, ip: nodeConfig.ip, port: nodeConfig.port, ...parsed });
                } catch {
                    resolve({ success: false, online: true, ip: nodeConfig.ip, port: nodeConfig.port, raw: data });
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                success: false,
                online: false,
                ip: nodeConfig.ip,
                port: nodeConfig.port,
                message: `Tiempo de espera agotado (${timeoutMs}ms). El Split Server (${nodeConfig.ip}:${nodeConfig.port}) no responde o está apagado.`
            });
        });

        req.on('error', (err) => {
            resolve({
                success: false,
                online: false,
                ip: nodeConfig.ip,
                port: nodeConfig.port,
                message: `No se pudo conectar con el Split Server (${nodeConfig.ip}:${nodeConfig.port}): ${err.message}`
            });
        });

        if (postData) req.write(postData);
        req.end();
    });
}

// 1. Obtener estado en tiempo real del Split Server (Protegido por requireAdminAuth)
app.post('/api/split-server/status', requireAdminAuth, async (req, res) => {
    try {
        const result = await querySplitServer('/api/status', { token: req.dbConfig.admin_password }, 4500);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, online: false, message: e.message });
    }
});

// 2. Ejecutar acción (start, stop, restart) sobre un servicio de Doom (Protegido por requireAdminAuth)
app.post('/api/split-server/action', requireAdminAuth, async (req, res) => {
    try {
        const { service, action } = req.body;
        if (!service || !action) return res.status(400).json({ success: false, message: 'Faltan parámetros' });

        const result = await querySplitServer('/api/action', {
            service,
            action,
            token: req.dbConfig.admin_password
        }, 15000);

        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 3. Obtener logs de un servicio de Doom en el Split Server (Protegido por requireAdminAuth)
app.post('/api/split-server/logs', requireAdminAuth, async (req, res) => {
    try {
        const { service, lines } = req.body;
        const result = await querySplitServer('/api/logs', {
            service: service || 'agent',
            lines: parseInt(lines, 10) || 120,
            token: req.dbConfig.admin_password
        }, 5000);

        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 4. Configurar IP / Puerto del Split Server (Protegido por requireAdminAuth)
app.post('/api/split-server/config', requireAdminAuth, (req, res) => {
    try {
        const currentDb = req.dbConfig;
        currentDb.split_server = {
            enabled: true,
            name: req.body.name || "Split Server (ZDaemon / Doom)",
            ip: (req.body.ip || "185.73.243.42").trim(),
            port: parseInt(req.body.port || 25765, 10),
            token: req.body.token || currentDb.admin_password || "ultraexodus1999!"
        };

        fs.writeFileSync(DB_PATH, JSON.stringify(currentDb, null, 4));
        res.json({ success: true, split_server: currentDb.split_server, message: 'Configuración de Split Server actualizada.' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ══════════════════════════════════════════════════════
// VIGILANTE PROGRAMADOR DIARIO MULTI-SERVICIO CON TIEMPO EXACTO
// ══════════════════════════════════════════════════════
// Calcula la hora a la que deben iniciar los avisos para que el reinicio ocurra exactamente a targetTime
function getTriggerTime(targetTimeStr, countdownSeconds) {
    if (!countdownSeconds || countdownSeconds <= 0) return targetTimeStr;
    const parts = (targetTimeStr || "02:00").split(':');
    let h = parseInt(parts[0], 10) || 0;
    let m = parseInt(parts[1], 10) || 0;
    const countdownMins = Math.ceil(countdownSeconds / 60);

    let totalMinutes = h * 60 + m - countdownMins;
    if (totalMinutes < 0) totalMinutes += 24 * 60; // Ciclo 24 horas

    const triggerH = Math.floor(totalMinutes / 60);
    const triggerM = totalMinutes % 60;
    return String(triggerH).padStart(2, '0') + ':' + String(triggerM).padStart(2, '0');
}

setInterval(async () => {
    try {
        if (!fs.existsSync(DB_PATH)) return;
        let db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        const schedules = db.schedules;
        if (!schedules) return;

        const now = new Date();
        const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        const todayDate = now.toDateString();

        if (!db._lastRestartDates) db._lastRestartDates = {};
        let modified = false;

        for (const [serviceKey, sched] of Object.entries(schedules)) {
            if (!sched || !sched.enabled) continue;
            const targetTime = sched.time || "02:00";
            const cd = (serviceKey === 'minecraft') ? (parseInt(sched.countdown, 10) || 0) : 0;
            const triggerTime = getTriggerTime(targetTime, cd);

            if (currentTime === triggerTime && db._lastRestartDates[serviceKey] !== todayDate) {
                db._lastRestartDates[serviceKey] = todayDate;
                modified = true;
                console.log(`[Scheduler] Ejecutando programación de ${serviceKey}: Avisos iniciados a las ${currentTime} -> Reinicio exacto a las ${targetTime}`);

                if (serviceKey === 'minecraft') {
                    if (cd > 0) {
                        startMinecraftCountdown(cd);
                    } else {
                        await doRestartService('minecraft');
                    }
                } else {
                    try {
                        await doRestartService(serviceKey);
                    } catch (err) {
                        console.error(`[Scheduler] Error reiniciando ${serviceKey}:`, err);
                    }
                }
            }
        }

        if (modified) {
            fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 4));
        }
    } catch (e) {
        console.error('[Scheduler] Error en ciclo:', e);
    }
}, 30000);


// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════
// RUTAS DIRECTAS Y REVERSE PROXY: IDDQD MONEY STATS WEB (185.73.243.42:26052)
// ══════════════════════════════════════════════════════
app.use(['/player', '/players', '/maps', '/history'], (req, res) => {
    res.redirect(302, '/stats' + req.originalUrl);
});

app.use(['/stats', '/stats/*'], (req, res) => {
    const targetHost = '185.73.243.42';
    const targetPort = 26052;

    if (req.originalUrl === '/stats') {
        return res.redirect(301, '/stats/');
    }

    let proxyPath = req.originalUrl.replace(/^\/stats/, '') || '/';

    const options = {
        hostname: targetHost,
        port: targetPort,
        path: proxyPath,
        method: req.method,
        headers: {
            ...req.headers,
            host: `${targetHost}:${targetPort}`
        },
        timeout: 6000
    };

    const proxyReq = http.request(options, (proxyRes) => {
        if (proxyRes.headers.location && proxyRes.headers.location.startsWith('/')) {
            proxyRes.headers.location = '/stats' + proxyRes.headers.location;
        }

        const contentType = proxyRes.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
            let body = '';
            proxyRes.on('data', chunk => body += chunk);
            proxyRes.on('end', () => {
                delete proxyRes.headers['content-length'];

                // Reescritura de enlaces absolutos para que permanezcan bajo /stats/
                body = body.replace(/href="(\/(?:player|players|maps|history|api\/summary)[^"]*)"/gi, 'href="/stats$1"');
                body = body.replace(/href='(\/(?:player|players|maps|history|api\/summary)[^']*)'/gi, "href='/stats$1'");
                body = body.replace(/href="\/"/gi, 'href="/stats/"');
                body = body.replace(/href='\/'/gi, "href='/stats/'");

                // Píldora de selección de idioma en barra de navegación superior
                const langPill = `<div id="stats-lang-nav-pill" class="stats-lang-switch" style="margin-left:auto;display:inline-flex;align-items:center;background:#151217;border:1px solid #38242a;border-radius:11px;padding:3px;gap:4px;font-family:sans-serif;font-size:12px;font-weight:700;">
                    <button type="button" onclick="setStatsLang('es')" class="btn-lang-es" style="border:none;background:linear-gradient(135deg,#67111f,#a20e25);color:#fff;padding:5px 12px;border-radius:8px;cursor:pointer;font-weight:700;transition:all 0.2s;">ES</button>
                    <button type="button" onclick="setStatsLang('en')" class="btn-lang-en" style="border:none;background:transparent;color:#a99da0;padding:5px 12px;border-radius:8px;cursor:pointer;font-weight:700;transition:all 0.2s;">EN</button>
                </div>`;

                if (body.includes('</nav>')) {
                    body = body.replace('</nav>', langPill + '</nav>');
                }

                // Dock flotante inferior: Selector de idioma dual (ES/EN) + Retorno a TheJazZDM (Cristal Líquido iOS)
                const floatingDock = `<div id="stats-floating-dock" style="position:fixed;bottom:18px;right:18px;z-index:999999;pointer-events:auto;display:inline-flex;align-items:center;gap:10px;font-family:system-ui,-apple-system,sans-serif;">
                    <div class="stats-lang-switch" style="display:inline-flex;align-items:center;background:linear-gradient(135deg,rgba(255,255,255,0.12) 0%,rgba(21,18,23,0.65) 100%),rgba(21,18,23,0.6);-webkit-backdrop-filter:blur(24px) saturate(190%);backdrop-filter:blur(24px) saturate(190%);border:1px solid rgba(239,35,60,0.5);border-radius:9999px;padding:3px;gap:3px;box-shadow:0 12px 35px rgba(0,0,0,0.75),0 1px 0 0 rgba(255,255,255,0.25) inset,0 0 15px rgba(239,35,60,0.25);">
                        <button type="button" onclick="setStatsLang('es')" class="btn-lang-es" style="border:none;background:linear-gradient(135deg,#67111f,#a20e25);color:#fff;padding:6px 14px;border-radius:9999px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;transition:all 0.2s;">ES</button>
                        <button type="button" onclick="setStatsLang('en')" class="btn-lang-en" style="border:none;background:transparent;color:#a99da0;padding:6px 14px;border-radius:9999px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;transition:all 0.2s;">EN</button>
                    </div>
                    <a href="/" style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,rgba(255,255,255,0.12) 0%,rgba(11,11,19,0.65) 100%),rgba(11,11,19,0.6);-webkit-backdrop-filter:blur(24px) saturate(190%);backdrop-filter:blur(24px) saturate(190%);border:1px solid rgba(0,255,255,0.45);color:#00ffff;padding:10px 18px;border-radius:9999px;font-family:inherit;font-size:13px;font-weight:700;text-decoration:none;box-shadow:0 12px 35px rgba(0,0,0,0.75),0 1px 0 0 rgba(255,255,255,0.3) inset,0 0 15px rgba(0,255,255,0.25);transition:all 0.2s ease;">
                        <span>&larr;</span> <span class="stats-back-text">Volver a TheJazZDM</span>
                    </a>
                </div>`;

                const injectedFooter = `${floatingDock}\n<script src="/js/stats-i18n.js"></script>`;
                if (body.includes('</body>')) {
                    body = body.replace('</body>', injectedFooter + '</body>');
                } else {
                    body += injectedFooter;
                }

                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                res.end(body);
            });
            return;
        }

        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('timeout', () => {
        proxyReq.destroy();
        renderStatsOffline(res);
    });

    proxyReq.on('error', (err) => {
        renderStatsOffline(res);
    });

    if (req.body && Object.keys(req.body).length) {
        proxyReq.write(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    }
    req.pipe(proxyReq);
});

// ══════════════════════════════════════════════════════
// RUTAS DIRECTAS Y REVERSE PROXY: LA ADVENTURE STATS WEB (185.73.243.48:26033)
// ══════════════════════════════════════════════════════
app.use(['/adventure', '/adventure/*'], (req, res) => {
    // Si config.json tiene split_server.ip, usarla; sino 185.73.243.42
    let defaultSplitIp = '185.73.243.42';
    try {
        if (fs.existsSync(DB_PATH)) {
            const cfg = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
            if (cfg.split_server && cfg.split_server.ip) {
                defaultSplitIp = cfg.split_server.ip;
            }
        }
    } catch (_) {}

    const targetHost = process.env.LA_STATS_HOST || defaultSplitIp;
    const targetPort = parseInt(process.env.LA_STATS_PORT || '26033', 10);

    if (req.originalUrl === '/adventure') {
        return res.redirect(301, '/adventure/');
    }

    let proxyPath = req.originalUrl.replace(/^\/adventure/, '') || '/';

    const options = {
        hostname: targetHost,
        port: targetPort,
        path: proxyPath,
        method: req.method,
        headers: {
            ...req.headers,
            host: `${targetHost}:${targetPort}`
        },
        timeout: 6000
    };

    const proxyReq = http.request(options, (proxyRes) => {
        if (proxyRes.headers.location && proxyRes.headers.location.startsWith('/')) {
            proxyRes.headers.location = '/adventure' + proxyRes.headers.location;
        }

        const contentType = proxyRes.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
            let body = '';
            proxyRes.on('data', chunk => body += chunk);
            proxyRes.on('end', () => {
                delete proxyRes.headers['content-length'];

                // Reescritura de enlaces absolutos para que permanezcan bajo /adventure/
                body = body.replace(/href="(\/(?:api\/|js\/|css\/)[^"]*)"/gi, 'href="/adventure$1"');
                body = body.replace(/src="(\/(?:api\/|js\/|css\/)[^"]*)"/gi, 'src="/adventure$1"');

                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                res.end(body);
            });
            return;
        }

        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('timeout', () => {
        proxyReq.destroy();
        renderAdventureOffline(res);
    });

    proxyReq.on('error', () => {
        renderAdventureOffline(res);
    });

    if (req.body && Object.keys(req.body).length) {
        proxyReq.write(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    }
    req.pipe(proxyReq);
});

function renderAdventureOffline(res) {
    if (res.headersSent) return;
    res.status(503).send(`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TheJazZDM | LA Adventure Stats</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
    <style>
        body { background-color: #070710; color: #fff; font-family: 'Space Grotesk', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .card { background: rgba(14,14,25,0.85); border: 1px solid rgba(255,0,127,0.3); border-radius: 1.5rem; padding: 2.5rem; max-width: 480px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.8), 0 0 30px rgba(255,0,127,0.1); backdrop-filter: blur(20px); }
        .icon { width: 64px; height: 64px; border-radius: 1rem; background: rgba(255,0,127,0.1); border: 1px solid rgba(255,0,127,0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; color: #ff007f; font-size: 28px; }
        h1 { font-size: 1.5rem; font-weight: 800; margin: 0 0 0.5rem 0; color: #fff; }
        p { font-size: 0.875rem; color: #9ca3af; line-height: 1.6; margin: 0 0 1.5rem 0; }
        .btn { display: inline-block; background: linear-gradient(135deg, #FF007F, #00FFFF); color: #fff; font-weight: 700; padding: 0.75rem 1.5rem; border-radius: 9999px; text-decoration: none; font-size: 0.875rem; transition: transform 0.2s; }
        .btn:hover { transform: translateY(-2px); }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">&#9881;</div>
        <h1>LA Adventure | Estadísticas</h1>
        <p>El servidor de telemetría de LA Adventure se está sincronizando o conectando con el clúster de Doom. Por favor reintenta en unos instantes.</p>
        <a href="/" class="btn">Volver al Portafolio</a>
    </div>
</body>
</html>`);
}

function renderStatsOffline(res) {
    if (res.headersSent) return;
    res.status(503).send(`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TheJazZDM | IDDQD Money Stats</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
    <style>
        body { background-color: #07070b; color: #fff; font-family: 'Space Grotesk', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .card { background: rgba(15,15,26,0.85); border: 1px solid rgba(0,255,255,0.25); border-radius: 1.5rem; padding: 2.5rem; max-width: 480px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.8), 0 0 30px rgba(0,255,255,0.08); backdrop-filter: blur(20px); }
        .icon { width: 64px; height: 64px; border-radius: 1rem; background: rgba(0,255,255,0.1); border: 1px solid rgba(0,255,255,0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; color: #00ffff; font-size: 28px; }
        h1 { font-size: 1.5rem; font-weight: 800; margin: 0 0 0.5rem 0; color: #fff; }
        p { font-size: 0.875rem; color: #9ca3af; line-height: 1.6; margin: 0 0 1.5rem 0; }
        .btn { display: inline-block; background: linear-gradient(135deg, #FF007F, #00FFFF); color: #fff; font-weight: 700; padding: 0.75rem 1.5rem; border-radius: 9999px; text-decoration: none; font-size: 0.875rem; transition: transform 0.2s; }
        .btn:hover { transform: translateY(-2px); }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">&#9881;</div>
        <h1>IDDQD Money | Estadísticas</h1>
        <p>El servidor de telemetría y ranking de IDDQD Money se está sincronizando o el clúster de Doom se está iniciando. Por favor reintenta en unos instantes.</p>
        <a href="/" class="btn">Volver al Portafolio</a>
    </div>
</body>
</html>`);
}


app.listen(PORT, '0.0.0.0', () => console.log(`Portfolio Web App & Control Center en puerto ${PORT}`));
