/**
 * =============================================================================
 * JAAK MOSAIC KYC INTEGRATION
 * =============================================================================
 * Sistema de integración con JAAK Mosaic KYC via iframe
 * Permite configurar, iniciar y monitorear flujos KYC personalizados
 *
 * Funcionalidades principales:
 * - Configuración de pasos del flujo KYC
 * - Comunicación bidireccional con iframe JAAK Mosaic
 * - Gestión de estado del flujo y resultados
 * - Interfaz de administración y monitoreo
 * =============================================================================
 */

// =============================================================================
// VARIABLES GLOBALES
// =============================================================================

// Estado del flujo KYC
let kycResults = {};              // Datos capturados durante el flujo
let currentSteps = [];            // Pasos configurados para el flujo actual
let completedSteps = [];          // Pasos completados exitosamente

// Control de configuración
let configurationSent = false;    // Evita envío duplicado de configuración
let currentSessionConfig = null;  // Configuración de la sesión actual
let currentConfigId = null;       // ID único de la configuración actual
let pendingConfigTimeouts = [];   // Timeouts pendientes para cancelar

// =============================================================================
// CONFIGURACIÓN DE PASOS KYC
// =============================================================================

// Pasos disponibles para configurar en el flujo KYC
const availableSteps = [
    { key: 'WELCOME', name: '👋 Bienvenida', description: 'Página de bienvenida al flujo' },
    { key: 'DOCUMENT_EXTRACT', name: '📄 Extracción', description: 'Extracción de datos del documento' },
    { key: 'DOCUMENT_VERIFY', name: '✅ Verificación', description: 'Verificación de documento de identidad' },
    { key: 'BLACKLIST', name: '🚫 Lista Negra', description: 'Verificación en listas negras' },
    { key: 'IVERIFICATION', name: '🤳 Verificación Facial', description: 'Verificación de identidad en vivo' },
    { key: 'LOCATION_PERMISSIONS', name: '📍 Ubicación', description: 'Permisos de geolocalización' },
    { key: 'OTO', name: '👤 One-To-One', description: 'Verificación facial One-To-One' },
    { key: 'FINISH', name: '🏁 Finalizar', description: 'Finalización explícita del flujo' }
];

// =============================================================================
// FUNCIONES PRINCIPALES DEL FLUJO KYC
// =============================================================================

/**
 * Inicializa un nuevo flujo KYC con la configuración especificada
 * @param {Object} config - Configuración del flujo KYC
 * @param {string} config.shortKey - Clave de acceso al flujo JAAK
 * @param {Array} config.steps - Lista de pasos del flujo KYC
 */
function initKYC(config) {
    const iframe = document.getElementById('kycIframe');

    // Validar configuración requerida
    if (!config.shortKey) {
        showNotification('❌ Short Key es requerido', 'error');
        addLog('error', '❌ Configuración inválida: falta Short Key');
        return;
    }

    if (!config.steps || config.steps.length === 0) {
        showNotification('❌ Selecciona al menos un paso del flujo KYC', 'error');
        addLog('error', '❌ Configuración inválida: no hay pasos definidos');
        return;
    }

    // Resetear estado para nueva sesión
    resetKYCState(config);

    // Recargar iframe con estado limpio
    reloadIframe(iframe);

    // Configurar comunicación con iframe
    setupPostMessageListener();

    addLog('info', `🚀 Iniciando flujo KYC con ${config.steps.length} pasos`);
    addLog('info', `🔗 Pasos: ${currentSteps.join(' → ')}`);
    updateProgress(0);
}

/**
 * Resetea el estado del sistema para una nueva sesión KYC
 * @param {Object} config - Nueva configuración de sesión
 */
function resetKYCState(config) {
    // Limpiar datos de sesión anterior
    configurationSent = false;
    kycResults = {};
    completedSteps = [];
    currentSteps = config.steps.map(step => step.key || step);

    // Cancelar timeouts pendientes
    pendingConfigTimeouts.forEach(timeout => clearTimeout(timeout));
    pendingConfigTimeouts = [];
    currentConfigId = null;
    currentSessionConfig = config;

    addLog('info', `🎯 Pasos configurados: ${currentSteps.join(' → ')}`);
}

/**
 * Recarga el iframe con timestamp para evitar cache
 * @param {HTMLElement} iframe - Elemento iframe a recargar
 */
function reloadIframe(iframe) {
    addLog('info', '🔄 Reiniciando iframe...');
    iframe.src = 'about:blank';

    setTimeout(() => {
        const timestamp = new Date().getTime();
        iframe.src = `https://mosaic.sandbox.jaak.ai/embed?t=${timestamp}`;
        addLog('success', '✅ Iframe recargado');
    }, 500);
}

/**
 * Configura el listener de PostMessage para comunicación con iframe
 * Solo se ejecuta una vez para evitar listeners duplicados
 */
function setupPostMessageListener() {
    if (window.kycMessageListenerAdded) return;

    window.addEventListener('message', function(event) {
        // Verificar origen por seguridad
        if (event.origin !== 'https://mosaic.sandbox.jaak.ai') {
            return;
        }

        if (event.source === document.getElementById('kycIframe').contentWindow) {
            handleKYCMessage(event.data, currentSessionConfig);
        }
    });

    window.kycMessageListenerAdded = true;
    addLog('info', '📡 Listener de mensajes configurado');
}

// =============================================================================
// MANEJO DE MENSAJES DEL IFRAME
// =============================================================================

/**
 * Procesa los mensajes recibidos del iframe JAAK Mosaic
 * @param {Object} message - Mensaje del iframe
 * @param {Object} config - Configuración actual de la sesión
 */
function handleKYCMessage(message, config) {
    addLog('info', `📨 Evento recibido: ${message.type}`);

    switch(message.type) {
        case 'READY':
            handleReadyMessage();
            break;

        case 'CONFIG_RECEIVED':
            handleConfigReceivedMessage(message);
            break;

        case 'STEP_COMPLETE':
            handleStepCompleteMessage(message);
            break;

        case 'FLOW_COMPLETE':
            handleFlowCompleteMessage(message);
            break;

        case 'ERROR':
            handleErrorMessage(message);
            break;

        case 'STEP_FAILED':
            handleStepFailedMessage(message);
            break;

        case 'RESIZE':
            handleResizeMessage(message);
            break;

        default:
            addLog('info', `📨 Evento no manejado: ${message.type}`);
            break;
    }
}

/**
 * Maneja el mensaje READY del iframe
 */
function handleReadyMessage() {
    addLog('success', '✅ JAAK Mosaic listo para configuración');

    // Enviar configuración solo una vez por sesión
    if (!configurationSent && currentSessionConfig) {
        addLog('info', '📤 Enviando configuración al iframe...');
        sendKYCConfiguration(currentSessionConfig);
        configurationSent = true;
    } else if (configurationSent) {
        addLog('warning', '⚠️ Configuración ya enviada, ignorando READY adicional');
    } else {
        addLog('warning', '⚠️ READY recibido pero no hay configuración activa');
    }
}

/**
 * Maneja confirmación de recepción de configuración
 * @param {Object} message - Mensaje del iframe
 */
function handleConfigReceivedMessage(message) {
    addLog('success', '✅ Iframe confirmó recepción de configuración');
    if (message.data) {
        addLog('info', `📋 Iframe procesó: ${message.data.steps?.length || 0} pasos`);
    }
}

/**
 * Maneja la finalización de un paso del flujo
 * @param {Object} message - Mensaje del iframe con datos del paso
 */
function handleStepCompleteMessage(message) {
    const stepData = message.data;
    addLog('success', `✅ Paso completado: ${stepData.stepKey}`);

    // Almacenar datos del paso
    kycResults[stepData.stepKey] = stepData.data;

    // Agregar a pasos completados
    if (!completedSteps.includes(stepData.stepKey)) {
        completedSteps.push(stepData.stepKey);
    }

    // Actualizar interfaz
    updateProgress();
    updateDataDisplay();
    showStepSpecificInfo(stepData);
}

/**
 * Maneja la finalización completa del flujo KYC
 * @param {Object} message - Mensaje del iframe con resultados finales
 */
function handleFlowCompleteMessage(message) {
    addLog('success', '🎉 Flujo KYC completado exitosamente');

    // Almacenar resultados finales
    if (message.data) {
        kycResults = { ...kycResults, ...message.data };
    }

    updateDataDisplay();
    updateProgress(100);
    showNotification('🎉 Verificación KYC completada exitosamente', 'success');
}

/**
 * Maneja errores del flujo KYC
 * @param {Object} message - Mensaje de error del iframe
 */
function handleErrorMessage(message) {
    if (message.data.error === 'CANCELLED') {
        addLog('warning', '❌ KYC cancelado por el usuario');
        showNotification('Proceso KYC cancelado', 'warning');
    } else {
        addLog('error', `❌ Error: ${message.data.error || message.data.message}`);
        showNotification(`❌ Error: ${message.data.error || message.data.message}`, 'error');
    }
}

/**
 * Maneja fallos en pasos específicos
 * @param {Object} message - Mensaje de fallo del iframe
 */
function handleStepFailedMessage(message) {
    const failedStep = message.data?.stepKey || 'Desconocido';
    const errorMsg = message.data?.message || 'Sin detalles';
    addLog('error', `❌ Paso falló: ${failedStep} - ${errorMsg}`);
}

/**
 * Maneja redimensionamiento del iframe
 * @param {Object} message - Mensaje con nueva altura
 */
function handleResizeMessage(message) {
    if (message.data && message.data.height) {
        const iframe = document.getElementById('kycIframe');
        iframe.style.height = `${message.data.height}px`;
        addLog('info', `📐 Iframe redimensionado: ${message.data.height}px`);
    }
}

// =============================================================================
// ENVÍO DE CONFIGURACIÓN AL IFRAME
// =============================================================================

/**
 * Envía la configuración KYC al iframe JAAK Mosaic
 * @param {Object} config - Configuración a enviar
 */
function sendKYCConfiguration(config) {
    const iframe = document.getElementById('kycIframe');

    // Crear ID único para tracking
    const configId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    currentConfigId = configId;

    // Cancelar timeouts pendientes
    pendingConfigTimeouts.forEach(timeout => clearTimeout(timeout));
    pendingConfigTimeouts = [];

    // Preparar configuración
    const steps = config.steps.map(step => {
        return typeof step === 'string' ? { key: step } : step;
    });

    const kycConfig = {
        steps: steps,
        shortKey: config.shortKey,
        configId: configId
    };

    addLog('info', `⏳ Enviando configuración: ${steps.length} pasos`);

    // Enviar configuración con delay
    const timeout = setTimeout(() => {
        if (currentConfigId !== configId) return; // Verificar si sigue siendo actual

        try {
            if (iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    type: 'CONFIG',
                    data: kycConfig
                }, 'https://mosaic.sandbox.jaak.ai');

                addLog('success', `📤 Configuración enviada: ${steps.length} pasos`);
                addLog('info', `🔑 Short Key: ${config.shortKey}`);
                addLog('info', `📋 Pasos: ${steps.map(s => s.key).join(' → ')}`);
            } else {
                addLog('error', '❌ No se puede acceder al iframe');
            }
        } catch (error) {
            addLog('error', `❌ Error enviando configuración: ${error.message}`);
        }
    }, 1500);

    pendingConfigTimeouts.push(timeout);
}

// =============================================================================
// FUNCIONES DE INFORMACIÓN ESPECÍFICA POR PASO
// =============================================================================

/**
 * Muestra información específica según el tipo de paso completado
 * @param {Object} stepData - Datos del paso completado
 */
function showStepSpecificInfo(stepData) {
    if (!stepData.data) return;

    switch(stepData.stepKey) {
        case 'LOCATION_PERMISSIONS':
            const location = stepData.data;
            if (location.latitude && location.longitude) {
                addLog('info', `📍 Ubicación: ${location.latitude}, ${location.longitude}`);
            }
            break;

        case 'DOCUMENT_EXTRACT':
        case 'DOCUMENT_VERIFY':
            if (stepData.data.face || stepData.data.document) {
                addLog('info', '📷 Imagen del documento capturada');
            }
            if (stepData.data.extractedText) {
                addLog('info', '📝 Texto extraído del documento');
            }
            break;

        case 'IVERIFICATION':
            if (stepData.data.bestFrame || stepData.data.selfie) {
                addLog('info', '🤳 Selfie de verificación capturado');
            }
            break;

        case 'OTO':
            if (stepData.data.similarity) {
                addLog('info', `👤 Similitud facial: ${stepData.data.similarity}%`);
            }
            break;
    }
}

// =============================================================================
// FUNCIONES DE COMUNICACIÓN CON EL SERVIDOR
// =============================================================================

/**
 * Obtiene un nuevo Short Key del servidor JAAK
 * @returns {Promise<string|null>} Short Key o null si hay error
 */
async function fetchKYCFlowAndGetShortKey() {
    try {
        addLog('info', '🔄 Obteniendo shortKey del backend...');

        const response = await fetch('/api/kyc/flow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: "Demo KYC Embebido",
                flow: "DEMO_FLOW",
                countryDocument: "MEX",
                flowType: "KYC"
            })
        });

        const result = await response.json();

        if (result.success && result.extractedShortKey) {
            const shortKey = result.extractedShortKey;
            document.getElementById('shortKey').value = shortKey;
            addLog('success', `🔑 ShortKey obtenido: ${shortKey}`);
            showNotification(`✅ ShortKey obtenido: ${shortKey}`, 'success');
            return shortKey;
        } else {
            addLog('error', `❌ Error obteniendo shortKey: ${result.message}`);
            showNotification(`❌ Error: ${result.message}`, 'error');
            return null;
        }
    } catch (error) {
        addLog('error', `❌ Error de conexión: ${error.message}`);
        showNotification(`❌ Error de conexión: ${error.message}`, 'error');
        return null;
    }
}

/**
 * Carga la configuración desde el servidor
 * @returns {Promise<Object>} Configuración del servidor
 */
async function loadConfigFromServer() {
    try {
        addLog('info', '🔄 Solicitando configuración del servidor...');
        const response = await fetch('/api/config');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const config = await response.json();
        addLog('success', '📥 Configuración recibida del servidor');

        // Actualizar Short Key
        if (config.shortKey) {
            document.getElementById('shortKey').value = config.shortKey;
            addLog('info', `🔑 Short Key actualizado: ${config.shortKey}`);
        } else {
            document.getElementById('shortKey').value = '';
            addLog('warning', '⚠️ No se encontró Short Key en la configuración');
        }

        // Actualizar pasos seleccionados
        if (config.steps && config.steps.length > 0) {
            const stepKeys = config.steps.map(step => step.key || step);
            setSelectedSteps(stepKeys);
            addLog('success', `📋 Pasos actualizados: ${stepKeys.length} pasos`);
            addLog('info', `🎯 Pasos seleccionados: ${stepKeys.join(' → ')}`);
        } else {
            setSelectedSteps([]);
            addLog('warning', '⚠️ No hay pasos configurados en el servidor');
        }

        return config;
    } catch (error) {
        addLog('error', `❌ Error cargando configuración: ${error.message}`);
        throw error;
    }
}

// =============================================================================
// FUNCIONES DE GESTIÓN DE PASOS
// =============================================================================

/**
 * Obtiene los pasos seleccionados en la interfaz
 * @returns {Array} Lista de pasos seleccionados
 */
function getSelectedSteps() {
    const checkboxes = document.querySelectorAll('.step-card input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

/**
 * Establece los pasos seleccionados en la interfaz
 * @param {Array} stepKeys - Lista de claves de pasos a seleccionar
 */
function setSelectedSteps(stepKeys) {
    // Limpiar selecciones actuales
    document.querySelectorAll('.step-card input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        cb.closest('.step-card').classList.remove('selected');
    });

    // Seleccionar pasos especificados
    stepKeys.forEach(stepKey => {
        const checkbox = document.querySelector(`input[value="${stepKey}"]`);
        if (checkbox) {
            checkbox.checked = true;
            checkbox.closest('.step-card').classList.add('selected');
        }
    });
}

// =============================================================================
// FUNCIONES DE INTERFAZ DE USUARIO
// =============================================================================

/**
 * Actualiza la barra de progreso visual
 * @param {number|null} percentage - Porcentaje específico o null para calcular automáticamente
 */
function updateProgress(percentage = null) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    if (percentage !== null) {
        progressFill.style.width = `${percentage}%`;
    } else if (currentSteps.length > 0) {
        const completed = completedSteps.length;
        const total = currentSteps.length;
        const percent = (completed / total) * 100;
        progressFill.style.width = `${percent}%`;
    }

    if (completedSteps.length > 0) {
        progressText.innerHTML = `
            Progreso: ${completedSteps.length}/${currentSteps.length} pasos completados<br>
            <small>Últimos: ${completedSteps.slice(-3).join(', ')}</small>
        `;
    } else {
        progressText.textContent = 'Esperando inicio del flujo...';
    }
}

/**
 * Actualiza la visualización de datos capturados
 */
function updateDataDisplay() {
    const dataContent = document.getElementById('dataContent');
    const exportBtn = document.getElementById('exportDataBtn');
    const copyBtn = document.getElementById('copyDataBtn');

    if (Object.keys(kycResults).length === 0) {
        dataContent.innerHTML = '<p class="no-data">No hay datos disponibles</p>';
        if (exportBtn) exportBtn.disabled = true;
        if (copyBtn) copyBtn.disabled = true;
    } else {
        dataContent.innerHTML = `<pre>${JSON.stringify(kycResults, null, 2)}</pre>`;
        if (exportBtn) exportBtn.disabled = false;
        if (copyBtn) copyBtn.disabled = false;
    }
}

/**
 * Agrega una entrada al log del sistema
 * @param {string} type - Tipo de log (info, success, error, warning)
 * @param {string} message - Mensaje a mostrar
 */
function addLog(type, message) {
    const logsContent = document.getElementById('logsContent');
    const time = new Date().toLocaleTimeString();

    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-message">${message}</span>
    `;

    logsContent.appendChild(logEntry);
    logsContent.scrollTop = logsContent.scrollHeight;
}

/**
 * Muestra una notificación temporal
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de notificación (info, success, error, warning)
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

/**
 * Crea la interfaz de selección de pasos dinámicamente
 */
function createStepsUI() {
    const stepsContainer = document.getElementById('stepsContainer');
    stepsContainer.innerHTML = '';

    availableSteps.forEach(step => {
        const stepCard = document.createElement('div');
        stepCard.className = 'step-card';
        stepCard.innerHTML = `
            <input type="checkbox" value="${step.key}" id="step-${step.key}">
            <label for="step-${step.key}">
                <strong>${step.name}</strong><br>
                <small>${step.description}</small>
            </label>
        `;

        const checkbox = stepCard.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                stepCard.classList.add('selected');
            } else {
                stepCard.classList.remove('selected');
            }
        });

        stepsContainer.appendChild(stepCard);
    });
}

// =============================================================================
// INICIALIZACIÓN Y EVENT LISTENERS
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
    // Crear interfaz de pasos
    createStepsUI();

    // Iniciar flujo KYC
    document.getElementById('startKycBtn').addEventListener('click', async function() {
        try {
            addLog('info', '🔄 Preparando inicio del flujo KYC...');

            // Cargar configuración más reciente del servidor
            const serverConfig = await loadConfigFromServer();
            const shortKey = document.getElementById('shortKey').value.trim();

            if (!shortKey) {
                showNotification('❌ El Short Key es requerido', 'error');
                addLog('error', '❌ No hay Short Key disponible');
                return;
            }

            // Usar pasos del servidor o fallback a UI
            let selectedSteps;
            if (serverConfig.steps && serverConfig.steps.length > 0) {
                selectedSteps = serverConfig.steps.map(step => step.key || step);
                addLog('success', `📋 Usando pasos del servidor: ${selectedSteps.join(' → ')}`);
            } else {
                selectedSteps = getSelectedSteps();
                addLog('warning', '⚠️ No hay pasos en el servidor, usando selección de UI');
            }

            if (selectedSteps.length === 0) {
                showNotification('❌ No hay pasos configurados para el flujo KYC', 'error');
                return;
            }

            const config = { shortKey: shortKey, steps: selectedSteps };
            initKYC(config);

        } catch (error) {
            addLog('error', `❌ Error preparando flujo KYC: ${error.message}`);
            showNotification(`❌ Error: ${error.message}`, 'error');
        }
    });

    // Obtener nuevo Short Key
    document.getElementById('getShortKeyBtn').addEventListener('click', async function() {
        await fetchKYCFlowAndGetShortKey();
    });

    // Copiar Short Key
    document.getElementById('copyShortKeyBtn').addEventListener('click', function() {
        const shortKey = document.getElementById('shortKey').value.trim();

        if (!shortKey) {
            showNotification('No hay Short Key para copiar', 'warning');
            return;
        }

        navigator.clipboard.writeText(shortKey).then(() => {
            showNotification('🔑 Short Key copiado al portapapeles', 'success');
            addLog('success', 'Short Key copiado al portapapeles');
        }).catch(err => {
            showNotification('❌ Error al copiar al portapapeles', 'error');
        });
    });

    // Guardar configuración
    document.getElementById('saveConfigBtn').addEventListener('click', async function() {
        const selectedSteps = getSelectedSteps();

        if (selectedSteps.length === 0) {
            showNotification('❌ Selecciona al menos un paso para guardar', 'error');
            return;
        }

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ steps: selectedSteps })
            });

            const result = await response.json();

            if (result.success) {
                showNotification('✅ Configuración guardada exitosamente', 'success');
                addLog('success', `Configuración guardada: ${selectedSteps.length} pasos`);
                addLog('info', `Pasos: ${selectedSteps.join(', ')}`);
            } else {
                showNotification(`❌ Error: ${result.message}`, 'error');
                addLog('error', `Error guardando configuración: ${result.message}`);
            }
        } catch (error) {
            showNotification(`❌ Error de conexión: ${error.message}`, 'error');
            addLog('error', `Error de conexión: ${error.message}`);
        }
    });

    // Reiniciar sistema
    document.getElementById('restartKycBtn').addEventListener('click', async function() {
        addLog('info', '🔄 Iniciando reinicio completo del sistema...');

        // Resetear estado
        kycResults = {};
        completedSteps = [];
        currentSteps = [];
        configurationSent = false;

        // Limpiar configuraciones pendientes
        pendingConfigTimeouts.forEach(timeout => clearTimeout(timeout));
        pendingConfigTimeouts = [];
        currentConfigId = null;
        currentSessionConfig = null;

        // Limpiar iframe
        document.getElementById('kycIframe').src = 'about:blank';

        // Resetear interfaz
        updateDataDisplay();
        updateProgress(0);

        try {
            // Recargar configuración del servidor
            addLog('info', '📋 Recargando configuración desde el servidor...');
            await loadConfigFromServer();

            // Obtener Short Key si no existe
            const currentShortKey = document.getElementById('shortKey').value.trim();
            if (!currentShortKey) {
                addLog('info', '🔑 No hay Short Key, obteniendo uno nuevo...');
                await fetchKYCFlowAndGetShortKey();
            }

            addLog('success', '✅ Reinicio completo finalizado - Sistema listo');
            showNotification('✅ Sistema reiniciado y configuración actualizada', 'success');

        } catch (error) {
            addLog('error', `❌ Error durante el reinicio: ${error.message}`);
            showNotification(`❌ Error en reinicio: ${error.message}`, 'error');
        }
    });

    // Limpiar logs
    document.getElementById('clearLogsBtn').addEventListener('click', function() {
        const logsContent = document.getElementById('logsContent');
        logsContent.innerHTML = '<div class="log-entry info"><span class="log-time">--:--:--</span><span class="log-message">Logs limpiados</span></div>';
    });

    // Exportar datos
    document.getElementById('exportDataBtn').addEventListener('click', function() {
        if (Object.keys(kycResults).length === 0) {
            showNotification('No hay datos para exportar', 'warning');
            return;
        }

        const dataStr = JSON.stringify(kycResults, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `kyc-results-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
        showNotification('📤 Datos exportados exitosamente', 'success');
        addLog('success', 'Datos exportados a archivo JSON');
    });

    // Copiar datos
    document.getElementById('copyDataBtn').addEventListener('click', function() {
        if (Object.keys(kycResults).length === 0) {
            showNotification('No hay datos para copiar', 'warning');
            return;
        }

        const dataStr = JSON.stringify(kycResults, null, 2);
        navigator.clipboard.writeText(dataStr).then(() => {
            showNotification('📋 Datos copiados al portapapeles', 'success');
            addLog('success', 'Datos copiados al portapapeles');
        }).catch(err => {
            showNotification('❌ Error al copiar al portapapeles', 'error');
        });
    });

    // Función de inicialización del sistema
    async function initializeSystem() {
        try {
            addLog('info', '🚀 Inicializando sistema KYC...');

            // Cargar configuración del servidor
            await loadConfigFromServer();

            // Obtener Short Key si no existe
            const currentShortKey = document.getElementById('shortKey').value.trim();
            if (!currentShortKey) {
                addLog('info', '🔑 No hay Short Key configurado, obteniendo uno nuevo...');
                await fetchKYCFlowAndGetShortKey();
            }

            addLog('success', '🎉 Sistema inicializado correctamente');
            showNotification('🚀 Sistema KYC listo para usar', 'info');

        } catch (error) {
            addLog('error', `❌ Error en inicialización: ${error.message}`);
            showNotification(`❌ Error de inicialización: ${error.message}`, 'error');
        }
    }

    // Inicializar sistema después de cargar DOM
    setTimeout(initializeSystem, 1000);
});