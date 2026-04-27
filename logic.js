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

        let csv = 'Fecha,Sistólica(SYS),Diastólica(DIA),Pulso(BPM),Medicación,Notas\n';
        history.forEach(r => {
            // Limpiar comas de las notas para no romper el CSV
            const safeNotes = r.notes ? r.notes.replace(/,/g, ';') : '';
            csv += `${r.date},${r.sys},${r.dia},${r.pulse},${r.meds ? 'SÍ' : 'NO'},${safeNotes}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const name = profile ? profile.name.replace(/\s+/g, '_') : 'usuario';
        link.setAttribute('download', `reporte_${name}_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },
    importCSV(file, callback) {
        const id = this.getCurrentUserId();
        if (!id) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split('\n');
            const history = this.getHistory();
            let importedCount = 0;
            
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const cols = lines[i].split(',');
                if (cols.length >= 4) {
                    const date = cols[0];
                    const sys = parseInt(cols[1]);
                    const dia = parseInt(cols[2]);
                    const pulse = parseInt(cols[3]);
                    const meds = cols[4] ? cols[4].trim() === 'SÍ' : false;
                    const notes = cols[5] ? cols[5].trim() : '';
                    
                    // Evitar duplicados exactos
                    const exists = history.some(r => r.date === date && r.sys === sys && r.dia === dia);
                    if (!exists && !isNaN(sys) && !isNaN(dia)) {
                        history.push({ id: Date.now() + i, date, sys, dia, pulse, meds, notes });
                        importedCount++;
                    }
                }
            }
            
            // Ordenar por fecha rudimentariamente (asumiendo que las más nuevas deberían ir primero)
            history.reverse();
            
            localStorage.setItem(`history_${id}`, JSON.stringify(history));
            if(callback) callback(importedCount);
        };
        reader.readAsText(file);
    },
    generateCalendarReminder(timeStr) {
        const [hours, minutes] = timeStr.split(':');
        const now = new Date();
        let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes), 0);
        
        if (start < now) {
            start.setDate(start.getDate() + 1); // Mañana
        }
        
        const formatICSDate = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };
        
        const end = new Date(start.getTime() + 15 * 60000); // 15 mins después
        
        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Tensiometro Premium//ES',
            'BEGIN:VEVENT',
            `UID:${Date.now()}@tensiometro`,
            `DTSTAMP:${formatICSDate(now)}`,
            `DTSTART:${formatICSDate(start)}`,
            `DTEND:${formatICSDate(end)}`,
            'RRULE:FREQ=DAILY',
            'SUMMARY:Control de Presión Arterial',
            'DESCRIPTION:Recordatorio diario para tomarte la presión arterial en Tensiometro Premium.',
            'BEGIN:VALARM',
            'TRIGGER:-PT0M',
            'ACTION:DISPLAY',
            'DESCRIPTION:Control de Presión Arterial',
            'END:VALARM',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');
        
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'recordatorio_presion.ics');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
