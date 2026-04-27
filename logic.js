const AHA_CATEGORIES = {
    NORMAL: { id: 'aha-normal', class: 'status-normal' },
    ELEVATED: { id: 'aha-elevated', class: 'status-elevated' },
    STAGE1: { id: 'aha-stage1', class: 'status-stage1' },
    STAGE2: { id: 'aha-stage2', class: 'status-stage2' },
    CRISIS: { id: 'aha-crisis', class: 'status-crisis' }
};

/**
 * Interpreta los valores de presión arterial según la AHA
 * @param {number} sys - Sistólica
 * @param {number} dia - Diastólica
 * @returns {object} Categoría, clase CSS y ID de traducción
 */
function interpretBP(sys, dia) {
    if (sys >= 180 || dia >= 120) return AHA_CATEGORIES.CRISIS;
    if (sys >= 140 || dia >= 90) return AHA_CATEGORIES.STAGE2;
    if ((sys >= 130 && sys <= 139) || (dia >= 80 && dia <= 89)) return AHA_CATEGORIES.STAGE1;
    if (sys >= 120 && sys <= 129 && dia < 80) return AHA_CATEGORIES.ELEVATED;
    if (sys < 120 && dia < 80) return AHA_CATEGORIES.NORMAL;
    
    // Fallback para casos mixtos no cubiertos explícitamente (se asume el más alto)
    if (sys >= 130 || dia >= 80) return AHA_CATEGORIES.STAGE1;
    return AHA_CATEGORIES.NORMAL;
}

/**
 * Interpreta el pulso cardíaco (BPM)
 */
function interpretPulse(bpm) {
    if (bpm < 60) return { id: 'pulse-brady', class: 'pulse-brady' };
    if (bpm > 100) return { id: 'pulse-tachy', class: 'pulse-tachy' };
    return { id: 'pulse-normal', class: 'pulse-normal' };
}

/**
 * Devuelve un consejo de salud basado en la categoría de la AHA
 */
function getHealthTip(categoryId) {
    const map = {
        'aha-normal': 'tip-normal',
        'aha-elevated': 'tip-elevated',
        'aha-stage1': 'tip-stage1',
        'aha-stage2': 'tip-stage2',
        'aha-crisis': 'tip-crisis'
    };
    return map[categoryId] || 'tip-normal';
}

/**
 * Calcula el Índice de Masa Corporal
 * @param {number} weight - Peso en kg
 * @param {number} height - Altura en cm
 * @returns {object} BMI y categoría
 */
function calculateBMI(weight, height) {
    const heightInMeters = height / 100;
    const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);
    
    let category = 'bmi-normal';
    if (bmi < 18.5) category = 'bmi-underweight';
    else if (bmi >= 25 && bmi < 30) category = 'bmi-overweight';
    else if (bmi >= 30) category = 'bmi-obesity';
    
    return { bmi, category };
}

/**
 * Gestión de almacenamiento (LocalStorage)
 */
const Storage = {
    getUsers() {
        return JSON.parse(localStorage.getItem('users_list')) || [];
    },
    getCurrentUserId() {
        return localStorage.getItem('current_user_id');
    },
    setCurrentUserId(id) {
        localStorage.setItem('current_user_id', id);
    },
    getProfile() {
        const id = this.getCurrentUserId();
        if (!id) return null;
        return this.getUsers().find(u => u.id === id) || null;
    },
    saveProfile(profileData) {
        const users = this.getUsers();
        const currentId = this.getCurrentUserId();
        
        if (currentId) {
            // Actualizar existente
            const index = users.findIndex(u => u.id === currentId);
            users[index] = { ...users[index], ...profileData };
            localStorage.setItem('users_list', JSON.stringify(users));
        } else {
            // Crear nuevo
            const newId = 'user_' + Date.now();
            const newUser = { id: newId, ...profileData };
            users.push(newUser);
            localStorage.setItem('users_list', JSON.stringify(users));
            this.setCurrentUserId(newId);
        }
    },
    getHistory() {
        const id = this.getCurrentUserId();
        if (!id) return [];
        return JSON.parse(localStorage.getItem(`history_${id}`)) || [];
    },
    saveRecord(record) {
        const id = this.getCurrentUserId();
        if (!id) return;
        const history = this.getHistory();
        history.unshift(record);
        localStorage.setItem(`history_${id}`, JSON.stringify(history));
    },
    logout() {
        localStorage.removeItem('current_user_id');
    },
    exportCSV() {
        const profile = this.getProfile();
        const history = this.getHistory();
        if (history.length === 0) return;

        let csv = 'Fecha,Sistólica(SYS),Diastólica(DIA),Pulso(BPM),Medicación\n';
        history.forEach(r => {
            csv += `${r.date},${r.sys},${r.dia},${r.pulse},${r.meds ? 'SÍ' : 'NO'}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const name = profile ? profile.name.replace(/\s+/g, '_') : 'usuario';
        link.setAttribute('download', `reporte_${name}_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
