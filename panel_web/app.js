/**
 * ============================================================================
 * PANEL DE TELEMETRÍA IOT - EPET N° 20 (G408)
 * Lógica en JavaScript: Conexión MQTT WebSocket, Parser JSON y Simulador
 * ============================================================================
 */

// Configuración por defecto
const DEFAULT_CONFIG = {
  host: '192.168.0.52',
  port: 9001,
  protocol: 'ws',
  path: '/mqtt',
  topic: 'G408/Casa2EmaSeba',
  username: '',
  password: ''
};

// Estado global de la aplicación
const AppState = {
  config: loadConfig(),
  client: null,
  isConnected: false,
  messageCount: 0,
  lastPacketTime: null,
  autoScroll: true,
  simulatorInterval: null,
  isSimulatorActive: false,
  timerInterval: null
};

// Referencias del DOM
const DOM = {
  // Conexión
  connPill: document.getElementById('connPill'),
  statusDot: document.getElementById('statusDot'),
  statusLabel: document.getElementById('statusLabel'),
  displayBroker: document.getElementById('displayBroker'),
  displayTopic: document.getElementById('displayTopic'),
  msgCount: document.getElementById('msgCount'),
  lastSeen: document.getElementById('lastSeen'),

  // Botones
  btnConfig: document.getElementById('btnConfig'),
  btnSimulator: document.getElementById('btnSimulator'),
  btnClearLog: document.getElementById('btnClearLog'),
  btnToggleScroll: document.getElementById('btnToggleScroll'),

  // Métricas
  valTemp: document.getElementById('valTemp'),
  barTemp: document.getElementById('barTemp'),
  tempBadge: document.getElementById('tempBadge'),

  valHumAir: document.getElementById('valHumAir'),
  barHumAir: document.getElementById('barHumAir'),
  humAirBadge: document.getElementById('humAirBadge'),

  valHumSoil: document.getElementById('valHumSoil'),
  barHumSoil: document.getElementById('barHumSoil'),
  humSoilBadge: document.getElementById('humSoilBadge'),

  // Luces Casa
  casaPill: document.getElementById('casaPill'),
  casaFooter: document.getElementById('casaFooter'),
  bulbsCasa: [
    document.getElementById('bulbCasa1'),
    document.getElementById('bulbCasa2'),
    document.getElementById('bulbCasa3')
  ],

  // Luces Invernadero
  inverPill: document.getElementById('inverPill'),
  inverFooter: document.getElementById('inverFooter'),
  bulbsInver: [
    document.getElementById('bulbInver2'),
    document.getElementById('bulbInver3'),
    document.getElementById('bulbInver4'),
    document.getElementById('bulbInver5')
  ],

  // Consola / JSON
  jsonParsed: document.getElementById('jsonParsed'),
  feedLog: document.getElementById('feedLog'),

  // Modal de Configuración
  configModal: document.getElementById('configModal'),
  btnCloseModal: document.getElementById('btnCloseModal'),
  btnSaveConfig: document.getElementById('btnSaveConfig'),
  btnResetConfig: document.getElementById('btnResetConfig'),
  cfgHost: document.getElementById('cfgHost'),
  cfgPort: document.getElementById('cfgPort'),
  cfgProto: document.getElementById('cfgProto'),
  cfgPath: document.getElementById('cfgPath'),
  cfgTopic: document.getElementById('cfgTopic'),
  cfgUser: document.getElementById('cfgUser'),
  cfgPass: document.getElementById('cfgPass')
};

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  setupEventListeners();
  startRelativeTimeTicker();
  connectMQTT();
});

// Cargar configuración guardada en LocalStorage
function loadConfig() {
  try {
    const saved = localStorage.getItem('g408_mqtt_cfg');
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
  } catch (e) {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg) {
  localStorage.setItem('g408_mqtt_cfg', JSON.stringify(cfg));
  AppState.config = cfg;
}

// Inicializar textos y campos de UI
function initUI() {
  updateBrokerInfoBar();
  fillModalForm();
}

function updateBrokerInfoBar() {
  const { protocol, host, port, path, topic } = AppState.config;
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  DOM.displayBroker.textContent = `${protocol}://${host}:${port}${cleanPath}`;
  DOM.displayTopic.textContent = topic;
}

function fillModalForm() {
  const { host, port, protocol, path, topic, username, password } = AppState.config;
  DOM.cfgHost.value = host;
  DOM.cfgPort.value = port;
  DOM.cfgProto.value = protocol;
  DOM.cfgPath.value = path;
  DOM.cfgTopic.value = topic;
  DOM.cfgUser.value = username || '';
  DOM.cfgPass.value = password || '';
}

// ============================================================================
// CONEXIÓN MQTT VÍA WEBSOCKET
// ============================================================================
function connectMQTT() {
  if (AppState.isSimulatorActive) return;

  // Desconectar cliente previo si existe
  if (AppState.client) {
    try {
      AppState.client.end(true);
    } catch (e) {}
  }

  const { protocol, host, port, path, username, password, topic } = AppState.config;
  const cleanPath = path ? (path.startsWith('/') ? path : '/' + path) : '';
  const brokerUrl = `${protocol}://${host}:${port}${cleanPath}`;

  setConnectionStatus('connecting', `Conectando a ${host}:${port}...`);
  logMessage('system', `Iniciando conexión WebSocket a: ${brokerUrl}`);

  const options = {
    clientId: 'WebDashboard_' + Math.random().toString(16).substr(2, 8),
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 4000
  };

  if (username) options.username = username;
  if (password) options.password = password;

  try {
    // Si la librería mqtt.js está cargada
    if (typeof mqtt === 'undefined') {
      logMessage('error', 'Error: La librería MQTT.js no pudo cargarse desde CDN. Verifique su conexión a Internet.');
      setConnectionStatus('disconnected', 'Librería MQTT no disponible');
      return;
    }

    AppState.client = mqtt.connect(brokerUrl, options);

    AppState.client.on('connect', () => {
      AppState.isConnected = true;
      setConnectionStatus('connected', 'Conectado');
      logMessage('system', `✓ ¡Conectado al broker MQTT! Suscribiendo al tópico '${topic}'...`);

      AppState.client.subscribe(topic, (err) => {
        if (err) {
          logMessage('error', `Error al suscribirse a ${topic}: ${err.message}`);
        } else {
          logMessage('system', `✓ Suscripción exitosa a: ${topic}`);
        }
      });
    });

    AppState.client.on('message', (rxTopic, payload) => {
      handleIncomingMessage(rxTopic, payload.toString());
    });

    AppState.client.on('reconnect', () => {
      setConnectionStatus('connecting', 'Reconectando...');
      logMessage('system', 'Intentando reconectar con el broker...');
    });

    AppState.client.on('offline', () => {
      AppState.isConnected = false;
      setConnectionStatus('disconnected', 'Desconectado');
      logMessage('system', 'Conexión perdida (offline).');
    });

    AppState.client.on('error', (err) => {
      AppState.isConnected = false;
      setConnectionStatus('disconnected', 'Error de Conexión');
      logMessage('error', `Fallo de conexión MQTT: ${err.message || 'Verifica que el broker tenga WebSockets habilitado'}`);
    });

  } catch (err) {
    setConnectionStatus('disconnected', 'Error');
    logMessage('error', `Excepción al conectar: ${err.message}`);
  }
}

function setConnectionStatus(status, label) {
  DOM.statusDot.className = `status-dot ${status}`;
  DOM.statusLabel.textContent = label;
}

// ============================================================================
// PROCESAMIENTO DE MENSAJES Y JSON
// ============================================================================
function handleIncomingMessage(topic, rawMessage) {
  AppState.messageCount++;
  AppState.lastPacketTime = new Date();
  DOM.msgCount.textContent = AppState.messageCount;
  updateRelativeTime();

  logMessage('rx', `[${topic}] ${rawMessage}`);

  // Verificar si es el mensaje de inicio
  if (rawMessage.trim().toLowerCase() === 'inicio' || rawMessage.trim().toLowerCase() === 'incio') {
    logMessage('system', '⚡ El microcontrolador Arduino acaba de iniciar su ejecución.');
    DOM.jsonParsed.textContent = `// Mensaje de arranque del sistema Arduino\n"${rawMessage}"`;
    return;
  }

  // Intentar parsear como JSON
  try {
    const data = JSON.parse(rawMessage);
    updateDashboardData(data);
    
    // Mostrar en el visor con formato embellecido
    DOM.jsonParsed.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    // Si no es JSON válido
    DOM.jsonParsed.textContent = `// Mensaje recibido (Texto Plano):\n${rawMessage}`;
  }
}

// Actualiza los elementos del dashboard con el objeto de datos
function updateDashboardData(data) {
  // Normalizar nombres de claves (por si varían mayúsculas/minúsculas)
  const tem = data.Tem ?? data.tem ?? data.temperatura ?? null;
  const humA = data.HumA ?? data.huma ?? data.humedadAire ?? null;
  const humT = data.HumT ?? data.humt ?? data.humedadTierra ?? null;
  const casa = data.Casa ?? data.casa ?? null;
  const inver = data.Inver ?? data.inver ?? null;

  // 1. TEMPERATURA
  if (tem !== null && !isNaN(tem)) {
    const tVal = parseFloat(tem);
    DOM.valTemp.textContent = tVal.toFixed(1);
    
    // Escala 0 a 50°C
    const pctTemp = Math.min(Math.max((tVal / 50) * 100, 0), 100);
    DOM.barTemp.style.width = `${pctTemp}%`;

    // Badge
    if (tVal < 15) {
      setTempBadge('Frío', 'alert');
    } else if (tVal <= 28) {
      setTempBadge('Óptimo', 'optimal');
    } else {
      setTempBadge('Caluroso', 'alert');
    }
  }

  // 2. HUMEDAD DEL AIRE
  if (humA !== null && !isNaN(humA)) {
    const hAir = parseFloat(humA);
    DOM.valHumAir.textContent = Math.round(hAir);
    DOM.barHumAir.style.width = `${Math.min(Math.max(hAir, 0), 100)}%`;

    if (hAir < 35) {
      setAirBadge('Seco', 'alert');
    } else if (hAir <= 75) {
      setAirBadge('Óptimo', 'optimal');
    } else {
      setAirBadge('Húmedo', 'alert');
    }
  }

  // 3. HUMEDAD DE LA TIERRA
  if (humT !== null && !isNaN(humT)) {
    const hSoil = parseFloat(humT);
    DOM.valHumSoil.textContent = Math.round(hSoil);
    DOM.barHumSoil.style.width = `${Math.min(Math.max(hSoil, 0), 100)}%`;

    if (hSoil < 30) {
      setSoilBadge('Suelo Seco (Regar)', 'alert');
    } else if (hSoil <= 80) {
      setSoilBadge('Humedad Óptima', 'optimal');
    } else {
      setSoilBadge('Saturado de Agua', 'alert');
    }
  }

  // 4. LUCES DE LA CASA
  if (casa !== null) {
    const isCasaOn = (casa == 1 || casa === true || casa === '1');
    if (isCasaOn) {
      DOM.casaPill.textContent = 'ENCENDIDAS';
      DOM.casaPill.className = 'state-indicator-pill on';
      DOM.casaFooter.textContent = '3 Lámparas activas (Pines 5, 6, 7)';
      DOM.bulbsCasa.forEach(b => b.classList.add('active-amber'));
    } else {
      DOM.casaPill.textContent = 'APAGADAS';
      DOM.casaPill.className = 'state-indicator-pill off';
      DOM.casaFooter.textContent = 'Todas las lámparas apagadas';
      DOM.bulbsCasa.forEach(b => b.classList.remove('active-amber'));
    }
  }

  // 5. LUCES DEL INVERNADERO
  if (inver !== null) {
    const isInverOn = (inver == 1 || inver === true || inver === '1');
    if (isInverOn) {
      DOM.inverPill.textContent = 'ENCENDIDAS';
      DOM.inverPill.className = 'state-indicator-pill on';
      DOM.inverFooter.textContent = 'Iluminación hortícola activa (4 Lámparas)';
      DOM.bulbsInver.forEach(b => b.classList.add('active-green'));
    } else {
      DOM.inverPill.textContent = 'APAGADAS';
      DOM.inverPill.className = 'state-indicator-pill off';
      DOM.inverFooter.textContent = 'Iluminación de cultivo inactiva';
      DOM.bulbsInver.forEach(b => b.classList.remove('active-green'));
    }
  }
}

function setTempBadge(text, cls) {
  DOM.tempBadge.textContent = text;
  DOM.tempBadge.className = `status-badge ${cls}`;
}
function setAirBadge(text, cls) {
  DOM.humAirBadge.textContent = text;
  DOM.humAirBadge.className = `status-badge ${cls}`;
}
function setSoilBadge(text, cls) {
  DOM.humSoilBadge.textContent = text;
  DOM.humSoilBadge.className = `status-badge ${cls}`;
}

// ============================================================================
// CONSOLA DE LOGS
// ============================================================================
function logMessage(type, message) {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;

  const timeSpan = document.createElement('span');
  timeSpan.className = 'log-time';
  timeSpan.textContent = timeStr;

  const msgSpan = document.createElement('span');
  msgSpan.className = 'log-msg';
  msgSpan.textContent = message;

  entry.appendChild(timeSpan);
  entry.appendChild(msgSpan);

  DOM.feedLog.appendChild(entry);

  // Limitar a los últimos 150 mensajes para mantener el navegador ágil
  if (DOM.feedLog.children.length > 150) {
    DOM.feedLog.removeChild(DOM.feedLog.firstChild);
  }

  if (AppState.autoScroll) {
    DOM.feedLog.scrollTop = DOM.feedLog.scrollHeight;
  }
}

// ============================================================================
// TEMPORIZADOR TIEMPO TRANSCURRIDO ("Hace X seg")
// ============================================================================
function startRelativeTimeTicker() {
  setInterval(updateRelativeTime, 1000);
}

function updateRelativeTime() {
  if (!AppState.lastPacketTime) {
    DOM.lastSeen.textContent = 'Esperando datos...';
    return;
  }

  const seconds = Math.floor((new Date() - AppState.lastPacketTime) / 1000);
  if (seconds < 2) {
    DOM.lastSeen.textContent = 'Ahora mismo';
  } else if (seconds < 60) {
    DOM.lastSeen.textContent = `Hace ${seconds} seg`;
  } else {
    const mins = Math.floor(seconds / 60);
    DOM.lastSeen.textContent = `Hace ${mins} min`;
  }
}

// ============================================================================
// MODO SIMULADOR / DEMO (Para pruebas instantáneas)
// ============================================================================
function toggleSimulator() {
  if (AppState.isSimulatorActive) {
    // Apagar simulador
    clearInterval(AppState.simulatorInterval);
    AppState.simulatorInterval = null;
    AppState.isSimulatorActive = false;
    DOM.btnSimulator.classList.remove('btn-primary');
    DOM.btnSimulator.classList.add('btn-secondary');
    DOM.btnSimulator.querySelector('.btn-text').textContent = 'Modo Demo';
    logMessage('system', 'Simulador desactivado. Conectando al broker real...');
    connectMQTT();
  } else {
    // Encender simulador
    if (AppState.client) {
      try { AppState.client.end(true); } catch (e) {}
    }
    AppState.isSimulatorActive = true;
    DOM.btnSimulator.classList.remove('btn-secondary');
    DOM.btnSimulator.classList.add('btn-primary');
    DOM.btnSimulator.querySelector('.btn-text').textContent = 'Salir de Demo';
    setConnectionStatus('connected', 'Simulador Activo');
    logMessage('system', '🧪 Modo Demo activado: Generando paquetes de prueba cada 3 segundos.');

    // Simular envío de inicio
    handleIncomingMessage(AppState.config.topic, 'inicio');

    let simTemp = 24.5;
    let simHumAir = 55.0;
    let simHumSoil = 60;
    let simCasa = 0;
    let simInver = 1;
    let step = 0;

    AppState.simulatorInterval = setInterval(() => {
      step++;
      // Pequeñas variaciones realistas
      simTemp = +(simTemp + (Math.random() * 0.8 - 0.4)).toFixed(1);
      simHumAir = +(simHumAir + (Math.random() * 2 - 1)).toFixed(1);
      simHumSoil = Math.round(Math.min(Math.max(simHumSoil + (Math.random() * 4 - 2), 20), 95));

      // Alternar luces de vez en cuando
      if (step % 5 === 0) simCasa = simCasa === 1 ? 0 : 1;
      if (step % 7 === 0) simInver = simInver === 1 ? 0 : 1;

      const simulatedJson = JSON.stringify({
        Tem: simTemp,
        HumA: simHumAir,
        HumT: simHumSoil,
        Casa: simCasa,
        Inver: simInver
      });

      handleIncomingMessage(AppState.config.topic, simulatedJson);
    }, 3000);
  }
}

// ============================================================================
// EVENT LISTENERS & MODAL
// ============================================================================
function setupEventListeners() {
  // Botón Demo
  DOM.btnSimulator.addEventListener('click', toggleSimulator);

  // Limpiar Consola
  DOM.btnClearLog.addEventListener('click', () => {
    DOM.feedLog.innerHTML = '';
    logMessage('system', 'Historial de consola limpiado.');
  });

  // Alternar Auto-Scroll
  DOM.btnToggleScroll.addEventListener('click', () => {
    AppState.autoScroll = !AppState.autoScroll;
    DOM.btnToggleScroll.textContent = `Auto-Scroll: ${AppState.autoScroll ? 'ON' : 'OFF'}`;
  });

  // Modal Abrir / Cerrar
  DOM.btnConfig.addEventListener('click', () => {
    fillModalForm();
    DOM.configModal.classList.add('open');
    DOM.configModal.setAttribute('aria-hidden', 'false');
  });

  DOM.btnCloseModal.addEventListener('click', closeModal);
  DOM.configModal.addEventListener('click', (e) => {
    if (e.target === DOM.configModal) closeModal();
  });

  // Guardar Configuración
  DOM.btnSaveConfig.addEventListener('click', () => {
    const newCfg = {
      host: DOM.cfgHost.value.trim() || DEFAULT_CONFIG.host,
      port: parseInt(DOM.cfgPort.value, 10) || DEFAULT_CONFIG.port,
      protocol: DOM.cfgProto.value,
      path: DOM.cfgPath.value.trim(),
      topic: DOM.cfgTopic.value.trim() || DEFAULT_CONFIG.topic,
      username: DOM.cfgUser.value.trim(),
      password: DOM.cfgPass.value.trim()
    };

    saveConfig(newCfg);
    updateBrokerInfoBar();
    closeModal();

    if (AppState.isSimulatorActive) {
      toggleSimulator(); // Salir de demo si estaba activo
    } else {
      connectMQTT();
    }
  });

  // Resetear Valores
  DOM.btnResetConfig.addEventListener('click', () => {
    saveConfig(DEFAULT_CONFIG);
    fillModalForm();
    updateBrokerInfoBar();
  });
}

function closeModal() {
  DOM.configModal.classList.remove('open');
  DOM.configModal.setAttribute('aria-hidden', 'true');
}
