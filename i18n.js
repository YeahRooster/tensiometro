const translations = {
    es: {
        "app-title": "Tensiometro",
        "greeting": "Hola",
        "status-summary": "Este es tu resumen de salud.",
        "latest-measurement": "Última Medición",
        "no-data": "Sin Datos",
        "add-reading": "Nueva Medición",
        "history": "Historial",
        "nav-home": "Inicio",
        "nav-history": "Historial",
        "nav-profile": "Ajustes",
        "new-record-title": "Nueva Medición",
        "label-sys": "Sistólica (SYS)",
        "label-dia": "Diastólica (DIA)",
        "label-pulse": "Pulso (BPM)",
        "cancel": "Cancelar",
        "save": "Guardar",
        "full-history": "Historial Completo",
        "profile-title": "Mi Perfil",
        "profile-name": "Nombre",
        "profile-age": "Edad",
        "profile-weight": "Peso (kg)",
        "profile-height": "Altura (cm)",
        "save-profile": "Guardar Perfil",
        "your-bmi": "Tu IMC:",
        "bmi-underweight": "Bajo peso",
        "bmi-normal": "Peso saludable",
        "bmi-overweight": "Sobrepeso",
        "bmi-obesity": "Obesidad",
        "aha-normal": "Normal",
        "aha-elevated": "Elevada",
        "aha-stage1": "Hipertensión Nivel 1",
        "aha-stage2": "Hipertensión Nivel 2",
        "aha-crisis": "CRISIS",
        "welcome-back": "¡Hola de nuevo, {name}!",
        "time-ago": "Hace poco",
        "status-unknown": "Desconocido",
        "nav-stats": "Gráficos",
        "stats-avg": "Promedios",
        "label-meds": "Tomé mi medicación hoy",
        "meds-taken": "Medicada",
        "health-tip-title": "Consejo Médico",
        "tip-normal": "¡Excelente! Mantén una dieta equilibrada y ejercicio regular para conservar estos niveles.",
        "tip-elevated": "Tu presión está un poco alta. Intenta reducir la sal y asegúrate de descansar bien.",
        "tip-stage1": "Atención: Tu presión ha subido. Considera consultar a tu médico y revisar tus hábitos diarios.",
        "tip-stage2": "Importante: Estos niveles son altos. Te recomendamos contactar a tu médico pronto para seguimiento.",
        "tip-crisis": "URGENTE: Dirígete a un centro médico si presentas dolor de pecho o falta de aire.",
        "logout": "Cambiar de Usuario / Salir",
        "who-is-using": "¿Quién va a usar la app?",
        "create-new": "Crear nuevo perfil",
        "label-notes": "Notas (Opcional)",
        "placeholder-notes": "Ej: Me sentía mareado, post-ejercicio...",
        "pulse-brady": "BRADICARDIA (Lento)",
        "pulse-normal": "Normal",
        "pulse-tachy": "TAQUICARDIA (Rápido)",
        "alerts-title": "Alertas y Recordatorios",
        "reminder-time": "Hora del recordatorio (Diario)",
        "set-reminder": "Programar",
        "reminder-desc": "Abre tu calendario para programar una alarma diaria.",
        "import-title": "Importar Datos",
        "import-desc": "Restaurar historial desde archivo CSV:",
    },
    en: {
        "app-title": "BP Tracker",
        "greeting": "Hello",
        "status-summary": "Here is your health summary.",
        "latest-measurement": "Latest Reading",
        "no-data": "No Data",
        "add-reading": "New Reading",
        "history": "History",
        "nav-home": "Home",
        "nav-history": "History",
        "nav-profile": "Profile",
        "new-record-title": "Add New Reading",
        "label-sys": "Systolic (SYS)",
        "label-dia": "Diastolic (DIA)",
        "label-pulse": "Pulse (BPM)",
        "cancel": "Cancel",
        "save": "Save",
        "full-history": "Full History",
        "profile-title": "My Profile",
        "profile-name": "Name",
        "profile-age": "Age",
        "profile-weight": "Weight (kg)",
        "profile-height": "Height (cm)",
        "save-profile": "Save Profile",
        "your-bmi": "Your BMI:",
        "bmi-underweight": "Underweight",
        "bmi-normal": "Normal weight",
        "bmi-overweight": "Overweight",
        "bmi-obesity": "Obesity",
        "aha-normal": "Normal",
        "aha-elevated": "Elevated",
        "aha-stage1": "Hypertension Stage 1",
        "aha-stage2": "Hypertension Stage 2",
        "aha-crisis": "CRISIS",
        "welcome-back": "Welcome back, {name}!",
        "time-ago": "Just now",
        "status-unknown": "Unknown",
        "nav-stats": "Stats",
        "stats-avg": "Averages",
        "label-meds": "Took my medication today",
        "meds-taken": "Medicated",
        "health-tip-title": "Health Tip",
        "tip-normal": "Excellent! Keep up a balanced diet and regular exercise to maintain these levels.",
        "tip-elevated": "Your pressure is slightly high. Try reducing salt intake and ensuring proper rest.",
        "tip-stage1": "Attention: Your pressure has risen. Consider consulting your doctor and reviewing daily habits.",
        "tip-stage2": "Important: These levels are high. We recommend contacting your doctor soon for follow-up.",
        "tip-crisis": "URGENT: Go to a medical center if you experience chest pain or shortness of breath.",
        "logout": "Logout / Switch User",
        "who-is-using": "Who's using the app?",
        "create-new": "Create new profile",
        "label-notes": "Notes (Optional)",
        "placeholder-notes": "e.g. Felt dizzy, post-exercise...",
        "pulse-brady": "BRADYCARDIA (Slow)",
        "pulse-normal": "Normal",
        "pulse-tachy": "TACHYCARDIA (Fast)",
        "alerts-title": "Alerts & Reminders",
        "reminder-time": "Reminder time (Daily)",
        "set-reminder": "Setup",
        "reminder-desc": "Open your calendar to schedule a daily alarm.",
        "import-title": "Import Data",
        "import-desc": "Restore history from CSV file:",
    }
};

let currentLang = localStorage.getItem('lang') || 'es';

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    updateUIStrings();
}

function updateUIStrings() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        let text = translations[currentLang][key] || key;
        
        // Soporte para placeholders tipo {name}
        if (el.hasAttribute('data-i18n-name')) {
            text = text.replace('{name}', el.getAttribute('data-i18n-name'));
        }
        
        el.innerText = text;
    });
    
    // Actualizar placeholders de inputs
    const inputs = document.querySelectorAll('input[data-i18n-placeholder]');
    inputs.forEach(input => {
        const key = input.getAttribute('data-i18n-placeholder');
        input.placeholder = translations[currentLang][key] || key;
    });
}

function t(key, replacements = {}) {
    let text = translations[currentLang][key] || key;
    Object.keys(replacements).forEach(r => {
        text = text.replace(`{${r}}`, replacements[r]);
    });
    return text;
}
