const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración middleware
app.use(cors());
app.use(express.json());

// Headers de seguridad para permisos de cámara y micrófono
app.use((req, res, next) => {
    // Permissions Policy para permitir acceso a cámara, micrófono y geolocalización
    res.setHeader('Permissions-Policy', 'camera=(*), microphone=(*), geolocation=(*)');

    // Feature Policy (para compatibilidad con navegadores antiguos)
    res.setHeader('Feature-Policy', 'camera \'*\'; microphone \'*\'; geolocation \'*\'');

    // Permitir embebido en iframes
    res.setHeader('X-Frame-Options', 'ALLOWALL');

    // Content Security Policy que permite el acceso a medios
    res.setHeader('Content-Security-Policy',
        "default-src 'self' https:; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; " +
        "style-src 'self' 'unsafe-inline' https:; " +
        "img-src 'self' data: blob: https:; " +
        "media-src 'self' blob: https:; " +
        "frame-src 'self' https://mosaic.sandbox.jaak.ai; " +
        "connect-src 'self' https://mosaic.sandbox.jaak.ai https://sandbox.api.jaak.ai;"
    );

    next();
});

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// 📋 Funciones de gestión de configuración
// Obtiene la configuración de pasos para el flujo KYC desde config.json esto simula la persistencia en una base de datos real
function readConfig() {
    try {
        const configPath = path.join(__dirname, 'config.json');

        // Verificar si el archivo existe
        if (!fs.existsSync(configPath)) {
            console.log('📋 config.json no existe, creando archivo por defecto...');
            const defaultConfig = {
                shortKey: "",
                steps: [
                    { key: "DOCUMENT_EXTRACT" },
                    { key: "DOCUMENT_VERIFY" },
                    { key: "IVERIFICATION" }
                ]
            };
            saveConfig(defaultConfig);
            return defaultConfig;
        }

        const data = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(data);
        console.log(`📋 Configuración cargada: ${config.steps?.length || 0} pasos`);
        return config;
    } catch (error) {
        console.error('❌ Error leyendo config.json:', error);
        const fallbackConfig = { shortKey: "", steps: [] };
        return fallbackConfig;
    }
}

// Guarda la configuración en config.json (simula persistencia en base de datos real)
function saveConfig(config) {
    try {
        const configPath = path.join(__dirname, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('✅ Config guardado exitosamente');
        return true;
    } catch (error) {
        console.error('❌ Error guardando config.json:', error);
        return false;
    }
}

function extractShortKeyFromUrl(sessionUrl) {
    // Extrae shortKey de URL como: https://kyc.qa.jaak.ai/session/dz7fZH1
    const urlParts = sessionUrl.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    return lastPart.length >= 7 ? lastPart.slice(-7) : lastPart;
}

// 🔗 API Endpoints

// GET /api/config - Obtener configuración actual
app.get('/api/config', (req, res) => {
    const config = readConfig();
    res.json(config);
});

// POST /api/config - Guardar configuración
app.post('/api/config', (req, res) => {
    try {
        const { steps } = req.body;

        if (!steps || !Array.isArray(steps)) {
            return res.status(400).json({
                success: false,
                message: 'El parámetro steps es requerido y debe ser un array'
            });
        }

        const currentConfig = readConfig();
        const updatedConfig = {
            ...currentConfig,
            steps: steps.map(step => ({ key: step }))
        };

        if (saveConfig(updatedConfig)) {
            console.log(`💾 Configuración actualizada: ${steps.length} pasos`);
            res.json({
                success: true,
                message: 'Configuración guardada exitosamente',
                config: updatedConfig
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Error al guardar la configuración'
            });
        }
    } catch (error) {
        console.error('❌ Error guardando configuración:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// POST /api/kyc/flow - Crear nuevo flujo KYC (middleware principal)
app.post('/api/kyc/flow', async (req, res) => {
    try {
        console.log('🔄 Creando nuevo flujo KYC...');

        const config = readConfig();

        const requestBody = {
            name: req.body.name || "Demo KYC Embebido",
            flow: req.body.flow || "DEMO_FLOW",
            redirectUrl: req.body.redirectUrl || "",
            countryDocument: req.body.countryDocument || "MEX",
            flowType: req.body.flowType || "KYC",
            verificationType: req.body.verificationType || "",
            verification: req.body.verification || {
                EMAIL: "",
                SMS: "",
                WHATSAPP: ""
            }
        };

        console.log('📤 Enviando a JAAK API:', requestBody);

        // 🌐 Llamada a JAAK API
        const response = await axios.post(process.env.JAAK_API_URL, requestBody, {
            headers: {
                'Authorization': `Bearer ${process.env.JAAK_BEARER_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log('✅ Respuesta exitosa de JAAK API');

        // 🔑 Extraer y guardar shortKey automáticamente
        if (response.data && response.data.sessionUrl) {
            const newShortKey = extractShortKeyFromUrl(response.data.sessionUrl);
            console.log(`🔑 Nuevo shortKey extraído: ${newShortKey}`);

            // Actualizar config.json automáticamente
            const updatedConfig = {
                ...config,
                shortKey: newShortKey
            };

            if (saveConfig(updatedConfig)) {
                console.log(`💾 ShortKey actualizado en config: ${newShortKey}`);
            }
        }

        res.json({
            success: true,
            data: response.data,
            extractedShortKey: response.data?.sessionUrl ? extractShortKeyFromUrl(response.data.sessionUrl) : null
        });

    } catch (error) {
        console.error('❌ Error en JAAK API:', error.response?.data || error.message);

        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data || 'Error interno del servidor',
            message: 'Error al consumir JAAK API',
            statusCode: error.response?.status,
            details: error.message
        });
    }
});

// 🏠 Rutas principales
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 🔐 Ruta de login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// 🚀 Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor KYC ejecutándose en http://localhost:${PORT}`);
    console.log(`🔐 Página de login: http://localhost:${PORT}/login`);
    console.log(`📱 Demo embebido: http://localhost:${PORT}/index.html`);
    console.log(`🔗 API endpoint: http://localhost:${PORT}/api/kyc/flow`);
});