/**
 * =============================================================================
 * JAAK LOGIN FORM INTEGRATION
 * =============================================================================
 * Sistema de autenticación con estilo JAAK corporate
 * Validación de formularios y integración con backend KYC
 * =============================================================================
 */

// =============================================================================
// VARIABLES GLOBALES
// =============================================================================

let formState = {
    isValid: false,
    isLoading: false,
    fields: {
        username: { valid: false, touched: false },
        password: { valid: false, touched: false },
        phone: { valid: false, touched: false }
    }
};

// =============================================================================
// INICIALIZACIÓN
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
    initializeForm();
    setupEventListeners();
    console.log('📱 JAAK Login Form initialized');
});

/**
 * Inicializa el formulario y sus componentes
 */
function initializeForm() {
    // Resetear estado del formulario
    formState.isValid = false;
    formState.isLoading = false;

    // Configurar país por defecto (México)
    const countrySelect = document.getElementById('countryCode');
    countrySelect.value = '+52';

    // Validar campos existentes al inicializar
    const inputs = document.querySelectorAll('.form-input');
    inputs.forEach(input => {
        if (input.value.trim()) {
            validateField(input);
        }
    });

    // Actualizar estado inicial del botón
    validateForm();
}

/**
 * Configura todos los event listeners del formulario
 */
function setupEventListeners() {
    const form = document.getElementById('loginForm');
    const inputs = document.querySelectorAll('.form-input');
    const passwordToggle = document.getElementById('passwordToggle');

    // Evento de submit del formulario
    form.addEventListener('submit', handleFormSubmit);

    // Event listeners para validación en tiempo real
    inputs.forEach(input => {
        input.addEventListener('input', () => handleInputChange(input));
        input.addEventListener('blur', () => handleInputBlur(input));
        input.addEventListener('focus', () => handleInputFocus(input));
    });

    // Toggle de contraseña
    passwordToggle.addEventListener('click', togglePasswordVisibility);

    // Validación del selector de país
    document.getElementById('countryCode').addEventListener('change', validateForm);

    console.log('🎛️ Event listeners configurados');
}

// =============================================================================
// MANEJO DE EVENTOS DEL FORMULARIO
// =============================================================================

/**
 * Maneja el envío del formulario
 */
async function handleFormSubmit(event) {
    event.preventDefault();

    if (!formState.isValid || formState.isLoading) {
        console.log('⚠️ Formulario inválido o cargando');
        return;
    }

    try {
        setLoadingState(true);
        await processFormSubmission();
    } catch (error) {
        console.error('❌ Error en envío del formulario:', error);
        showToast('error', 'Error de Conexión', 'No se pudo procesar la solicitud');
        setLoadingState(false);
    }
}

/**
 * Procesa el envío del formulario y crea la sesión KYC
 */
async function processFormSubmission() {
    const formData = getFormData();

    showToast('info', '🔄 Procesando...', 'Creando sesión de verificación');
    showVerificationSteps();

    // Simular progreso de pasos
    await simulateVerificationSteps();

    try {
        // Llamada al backend para crear sesión KYC
        const response = await fetch('/api/kyc/flow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: formData.username,
                flow: "JAAK_DEMO_FLOW",
                countryDocument: getCountryFromPhone(formData.countryCode),
                flowType: "KYC",
                verification: {
                    SMS: formData.fullPhone
                }
            })
        });

        const result = await response.json();

        if (result.success && result.extractedShortKey) {
            showToast('success', '✅ Sesión Creada', 'Redirigiendo al portal de verificación...');

            setTimeout(() => {
                // Redirigir a la página principal con el short key
                const url = new URL(window.location.origin);
                url.searchParams.set('shortKey', result.extractedShortKey);
                url.pathname = '/';

                window.location.href = url.toString();
            }, 2000);

        } else {
            throw new Error(result.message || 'Error desconocido');
        }

    } catch (error) {
        console.error('❌ Error creando sesión KYC:', error);
        showToast('error', 'Error de Sesión', error.message || 'No se pudo crear la sesión KYC');
        setLoadingState(false);
        hideVerificationSteps();
    }
}

/**
 * Simula el progreso de los pasos de verificación
 */
async function simulateVerificationSteps() {
    const steps = document.querySelectorAll('.verification-steps .step');

    for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));

        // Marcar paso anterior como completado
        if (i > 0) {
            steps[i - 1].classList.remove('active');
            steps[i - 1].classList.add('completed');
        }

        // Activar paso actual
        steps[i].classList.add('active');
    }
}

/**
 * Maneja cambios en los inputs
 */
function handleInputChange(input) {
    const fieldName = input.name;

    // Marcar el campo como touched si tiene contenido
    if (input.value.trim().length > 0) {
        formState.fields[fieldName].touched = true;
    }

    validateField(input);
    validateForm();
}

/**
 * Maneja cuando un input pierde el foco
 */
function handleInputBlur(input) {
    const fieldName = input.name;
    formState.fields[fieldName].touched = true;

    validateField(input);
    updateFieldErrorDisplay(input);
}

/**
 * Maneja cuando un input recibe el foco
 */
function handleInputFocus(input) {
    clearFieldError(input);
}

// =============================================================================
// VALIDACIÓN DE FORMULARIO
// =============================================================================

/**
 * Valida un campo específico
 */
function validateField(input) {
    const fieldName = input.name;
    const value = input.value.trim();
    let isValid = false;
    let errorMessage = '';

    switch (fieldName) {
        case 'username':
            isValid = value.length >= 3;
            errorMessage = isValid ? '' : 'Usuario debe tener al menos 3 caracteres';
            break;

        case 'password':
            isValid = value.length >= 6;
            errorMessage = isValid ? '' : 'Contraseña debe tener al menos 6 caracteres';
            break;

        case 'phone':
            isValid = validatePhoneNumber(value);
            errorMessage = isValid ? '' : 'Número de teléfono inválido';
            break;
    }

    formState.fields[fieldName].valid = isValid;
    formState.fields[fieldName].errorMessage = errorMessage;

    // Debug logging para validación de campo
    console.log(`🔍 Field validation - ${fieldName}:`, {
        value: value,
        isValid: isValid,
        touched: formState.fields[fieldName].touched,
        errorMessage: errorMessage
    });

    // Actualizar clases CSS
    if (isValid) {
        input.classList.remove('error');
    } else if (formState.fields[fieldName].touched) {
        input.classList.add('error');
    }

    return isValid;
}

/**
 * Valida el número de teléfono
 */
function validatePhoneNumber(phone) {
    // Validación básica: solo números, espacios, guiones y paréntesis
    const phoneRegex = /^[\d\s\-\(\)\+]{8,15}$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 8;
}

/**
 * Valida todo el formulario
 */
function validateForm() {
    const allFieldsValid = Object.values(formState.fields).every(field => field.valid);
    formState.isValid = allFieldsValid;

    // Debug logging para verificar validación
    console.log('📝 Form validation:', {
        allFieldsValid,
        formIsValid: formState.isValid,
        fieldsState: formState.fields
    });

    updateSubmitButton();
    return allFieldsValid;
}

// =============================================================================
// MANEJO DE ERRORES Y MENSAJES
// =============================================================================

/**
 * Actualiza la visualización de errores de un campo
 */
function updateFieldErrorDisplay(input) {
    const fieldName = input.name;
    const errorElement = document.getElementById(`${fieldName}-error`);
    const errorText = errorElement.querySelector('.error-text');

    if (!formState.fields[fieldName].valid && formState.fields[fieldName].touched) {
        errorText.textContent = formState.fields[fieldName].errorMessage;
        errorElement.classList.add('show');
    } else {
        errorElement.classList.remove('show');
    }
}

/**
 * Limpia el error de un campo
 */
function clearFieldError(input) {
    const fieldName = input.name;
    const errorElement = document.getElementById(`${fieldName}-error`);
    errorElement.classList.remove('show');
    input.classList.remove('error');
}

// =============================================================================
// UTILIDADES DE INTERFAZ
// =============================================================================

/**
 * Actualiza el estado del botón de submit
 */
function updateSubmitButton() {
    const button = document.getElementById('submitButton');

    if (formState.isLoading) {
        button.disabled = true;
        button.classList.add('loading');
        button.textContent = '⏳ Creando sesión de verificación...';
    } else if (formState.isValid) {
        button.disabled = false;
        button.classList.remove('loading');
        button.textContent = 'Iniciar Demo';
    } else {
        button.disabled = true;
        button.classList.remove('loading');
        button.textContent = 'Iniciar Demo';
    }

    // Debug logging para verificar el estado
    console.log('🔍 Button state updated:', {
        isValid: formState.isValid,
        isLoading: formState.isLoading,
        disabled: button.disabled,
        fieldsState: formState.fields
    });
}

/**
 * Establece el estado de carga del formulario
 */
function setLoadingState(loading) {
    formState.isLoading = loading;

    const form = document.getElementById('loginForm');
    const inputs = form.querySelectorAll('.form-input, select');

    inputs.forEach(input => {
        input.disabled = loading;
    });

    updateSubmitButton();
}

/**
 * Toggle de visibilidad de contraseña
 */
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.querySelector('.toggle-icon');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.textContent = '🙈';
    } else {
        passwordInput.type = 'password';
        toggleIcon.textContent = '👁️';
    }
}

/**
 * Muestra los pasos de verificación
 */
function showVerificationSteps() {
    const verificationInfo = document.getElementById('verificationInfo');
    verificationInfo.style.display = 'block';

    // Reset de pasos
    const steps = document.querySelectorAll('.verification-steps .step');
    steps.forEach(step => {
        step.classList.remove('active', 'completed');
    });
}

/**
 * Oculta los pasos de verificación
 */
function hideVerificationSteps() {
    const verificationInfo = document.getElementById('verificationInfo');
    verificationInfo.style.display = 'none';
}

// =============================================================================
// SISTEMA DE NOTIFICACIONES (TOASTS)
// =============================================================================

/**
 * Muestra un toast de notificación
 */
function showToast(type, title, message, duration = 4000) {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="removeToast(this)">×</button>
    `;

    container.appendChild(toast);

    // Auto-remove después del tiempo especificado
    setTimeout(() => {
        removeToast(toast.querySelector('.toast-close'));
    }, duration);

    console.log(`📢 Toast ${type}: ${title} - ${message}`);
}

/**
 * Remueve un toast específico
 */
function removeToast(closeButton) {
    const toast = closeButton.closest('.toast');
    if (toast) {
        toast.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

// =============================================================================
// UTILIDADES DE DATOS
// =============================================================================

/**
 * Obtiene los datos del formulario
 */
function getFormData() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const countryCode = document.getElementById('countryCode').value;

    return {
        username,
        password,
        phone,
        countryCode,
        fullPhone: countryCode + phone.replace(/\D/g, '')
    };
}

/**
 * Obtiene el código de país basado en el código de teléfono
 */
function getCountryFromPhone(phoneCode) {
    const countryMap = {
        '+52': 'MEX',
        '+1': 'USA',
        '+34': 'ESP',
        '+33': 'FRA',
        '+49': 'DEU'
    };

    return countryMap[phoneCode] || 'MEX';
}

// =============================================================================
// INICIALIZACIÓN AUTOMÁTICA
// =============================================================================

// Log de inicialización
console.log('🚀 JAAK Login Form Script Loaded');
console.log('🎨 Using JAAK Corporate Branding');
console.log('🔐 Ready for KYC Authentication');