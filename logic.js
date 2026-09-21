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

        // Formato CSV estándar con comillas para evitar que comas en fechas o notas rompan las columnas
        let csv = 'Fecha,Sistólica(SYS),Diastólica(DIA),Pulso(BPM),Medicación,Notas\r\n';
        history.forEach(r => {
            const safeDate = (r.date || '').replace(/"/g, '""');
            const safeNotes = (r.notes || '').replace(/"/g, '""');
            const medsStr = r.meds ? 'SÍ' : 'NO';
            csv += `"${safeDate}",${r.sys},${r.dia},${r.pulse},"${medsStr}","${safeNotes}"\r\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const name = profile ? profile.name.replace(/\s+/g, '_') : 'usuario';
        link.setAttribute('download', `reporte_${name}_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },
    importCSV(file, callback) {
        const id = this.getCurrentUserId();
        if (!id) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result || '';
            const rawLines = text.split(/\r?\n/);
            const history = this.getHistory();
            let importedCount = 0;
            
            for (let i = 0; i < rawLines.length; i++) {
                const line = rawLines[i].trim();
                if (!line) continue;
                
                // Parser de línea CSV compatible con comillas, comas y punto y coma
                const cols = parseCSVLine(line);
                
                // Saltar línea de encabezados si empieza con "Fecha" o similar
                if (cols[0] && cols[0].toLowerCase().includes('fecha')) continue;
                
                let date = '';
                let sys = NaN;
                let dia = NaN;
                let pulse = NaN;
                let meds = false;
                let notes = '';
                
                // Detectar si la fecha vino separada en dos columnas (por ej en CSVs viejos: col[0]=21/9/2026, col[1]=18:45:10)
                if (cols.length >= 5 && cols[1] && (cols[1].includes(':') || cols[1].toLowerCase().includes('m'))) {
                    date = cols[0] + ', ' + cols[1];
                    sys = parseInt(cols[2], 10);
                    dia = parseInt(cols[3], 10);
                    pulse = parseInt(cols[4], 10);
                    meds = cols[5] ? (cols[5].trim().toUpperCase() === 'SÍ' || cols[5].trim().toUpperCase() === 'SI' || cols[5].trim() === 'YES') : false;
                    notes = cols[6] ? cols[6].trim() : '';
                } else if (cols.length >= 4) {
                    date = cols[0];
                    sys = parseInt(cols[1], 10);
                    dia = parseInt(cols[2], 10);
                    pulse = parseInt(cols[3], 10);
                    meds = cols[4] ? (cols[4].trim().toUpperCase() === 'SÍ' || cols[4].trim().toUpperCase() === 'SI' || cols[4].trim() === 'YES') : false;
                    notes = cols[5] ? cols[5].trim() : '';
                }
                
                if (!isNaN(sys) && !isNaN(dia) && date) {
                    // Evitar duplicados exactos
                    const exists = history.some(r => r.date === date && r.sys === sys && r.dia === dia);
                    if (!exists) {
                        history.push({
                            id: Date.now() + Math.floor(Math.random() * 10000) + i,
                            date,
                            sys,
                            dia,
                            pulse: isNaN(pulse) ? 70 : pulse,
                            meds,
                            notes
                        });
                        importedCount++;
                    }
                }
            }
            
            // Ordenar de forma cronológica estricta (más recientes primero)
            history.sort((a, b) => parseDateToTimestamp(b.date) - parseDateToTimestamp(a.date));
            
            localStorage.setItem(`history_${id}`, JSON.stringify(history));
            if (callback) callback(importedCount);
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

/**
 * Parser para líneas CSV respetando comillas y separadores coma o punto y coma
 */
function parseCSVLine(line) {
    const delimiter = (line.includes(';') && !line.includes(',')) ? ';' : ',';
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === delimiter && !inQuotes) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += c;
        }
    }
    result.push(cur.trim());
    return result;
}

/**
 * Convierte strings de fecha en timestamps numéricos para orden cronológico fiable
 */
function parseDateToTimestamp(dateStr) {
    if (!dateStr) return 0;
    try {
        const clean = dateStr.replace(/"/g, '').trim();
        const parts = clean.split(/[,\s]+/);
        const datePart = parts[0];
        const timePart = parts[1] || '00:00:00';
        const isPM = clean.toLowerCase().includes('p');
        const isAM = clean.toLowerCase().includes('a');
        
        let d = 1, m = 0, y = 2020;
        if (datePart.includes('/')) {
            const dmy = datePart.split('/');
            d = parseInt(dmy[0], 10) || 1;
            m = (parseInt(dmy[1], 10) || 1) - 1;
            y = parseInt(dmy[2], 10) || 2020;
            if (y < 100) y += 2000;
        } else if (datePart.includes('-')) {
            const ymd = datePart.split('-');
            y = parseInt(ymd[0], 10) || 2020;
            m = (parseInt(ymd[1], 10) || 1) - 1;
            d = parseInt(ymd[2], 10) || 1;
        }
        
        let [hh, mm, ss] = timePart.split(':').map(n => parseInt(n, 10) || 0);
        if (isPM && hh < 12) hh += 12;
        if (isAM && hh === 12) hh = 0;
        
        const dateObj = new Date(y, m, d, hh, mm, ss);
        return isNaN(dateObj.getTime()) ? 0 : dateObj.getTime();
    } catch (e) {
        return 0;
    }
}

/**
 * Preprocesa una imagen para lectura óptima de pantallas LCD de tensiómetros:
 * - Opcional recorte del centro de la pantalla
 * - Binarización adaptativa blanco y negro
 * - Dilatación morfológica que une las rayitas separadas de los dígitos de 7 segmentos
 * @param {HTMLImageElement} img - Imagen cargada
 * @param {boolean} cropCenter - Si es true, recorta el área central de la pantalla
 * @returns {HTMLCanvasElement} Canvas preparado para Tesseract
 */
function preprocessImageForOCR(img, cropCenter = true) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    const origWidth = img.naturalWidth || img.width;
    const origHeight = img.naturalHeight || img.height;
    
    // Si se recorta el centro, enfocamos el 75% central donde se encuentra la pantalla
    let srcX = 0, srcY = 0, srcW = origWidth, srcH = origHeight;
    if (cropCenter && origWidth > 400 && origHeight > 400) {
        srcW = Math.round(origWidth * 0.75);
        srcH = Math.round(origHeight * 0.75);
        srcX = Math.round((origWidth - srcW) / 2);
        srcY = Math.round((origHeight - srcH) / 2);
    }
    
    // Escalar para procesamiento rápido y óptimo en móvil (ancho ideal ~800px)
    const targetWidth = 800;
    const scale = targetWidth / srcW;
    const targetHeight = Math.round(srcH * scale);
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    // Dibujar área seleccionada
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetWidth, targetHeight);
    
    try {
        const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imgData.data;
        const totalPixels = targetWidth * targetHeight;
        
        // Paso 1: Convertir a escala de grises y calcular histograma
        const grayValues = new Uint8Array(totalPixels);
        let sumLum = 0;
        for (let i = 0; i < totalPixels; i++) {
            const idx = i * 4;
            const lum = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
            grayValues[i] = lum;
            sumLum += lum;
        }
        const meanLum = sumLum / totalPixels;
        
        // Paso 2: Binarización adaptativa
        // En pantallas LCD típicas, los dígitos son más oscuros que el fondo medio
        const threshold = Math.max(50, Math.min(200, meanLum - 15));
        
        let darkPixelCount = 0;
        const binaryMask = new Uint8Array(totalPixels);
        for (let i = 0; i < totalPixels; i++) {
            if (grayValues[i] < threshold) {
                binaryMask[i] = 1; // Segmento de dígito oscuro
                darkPixelCount++;
            } else {
                binaryMask[i] = 0; // Fondo
            }
        }
        
        // Si más del 60% de los píxeles son oscuros, la pantalla es invertida (números blancos sobre fondo negro)
        const isInvertedScreen = (darkPixelCount / totalPixels) > 0.60;
        if (isInvertedScreen) {
            for (let i = 0; i < totalPixels; i++) {
                binaryMask[i] = binaryMask[i] ? 0 : 1;
            }
        }
        
        // Paso 3: Dilatación morfológica (Cierre de segmentos LCD)
        // Engrosa los segmentos 2 píxeles en cruz para cerrar las separaciones entre rayitas
        const dilatedMask = new Uint8Array(totalPixels);
        dilatedMask.set(binaryMask);
        
        const radius = 2;
        for (let y = radius; y < targetHeight - radius; y++) {
            for (let x = radius; x < targetWidth - radius; x++) {
                const idx = y * targetWidth + x;
                if (binaryMask[idx] === 1) {
                    for (let dy = -radius; dy <= radius; dy++) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            dilatedMask[(y + dy) * targetWidth + (x + dx)] = 1;
                        }
                    }
                }
            }
        }
        
        // Paso 4: Escribir resultado a canvas (Dígitos en negro puro, fondo en blanco puro)
        // Tesseract requiere texto oscuro sobre fondo blanco
        for (let i = 0; i < totalPixels; i++) {
            const idx = i * 4;
            const isDigit = dilatedMask[i] === 1;
            const color = isDigit ? 0 : 255;
            data[idx] = color;
            data[idx + 1] = color;
            data[idx + 2] = color;
            data[idx + 3] = 255;
        }
        
        ctx.putImageData(imgData, 0, 0);
    } catch (e) {
        console.warn('Filtro avanzado no disponible, usando canvas estándar:', e);
    }
    
    return canvas;
}

/**
 * Analiza el texto reconocido por OCR y extrae Sistólica, Diastólica y Pulso
 * Incluye reemplazo inteligente de caracteres comúnmente confundidos con números
 * @param {string} text - Texto en bruto devuelto por Tesseract
 * @returns {object} { sys: number|null, dia: number|null, pulse: number|null }
 */
function extractBPFromOCRText(text) {
    if (!text) return { sys: null, dia: null, pulse: null };

    let sys = null;
    let dia = null;
    let pulse = null;

    // Normalizar texto y separar por líneas
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Estrategia 1: Búsqueda con etiquetas explícitas (SYS, DIA, PUL / PULSE)
    for (const line of lines) {
        if (sys === null) {
            const mSys = line.match(/(?:sys|sist|max|pas|ps)[\s:.-]*([0-9OIlZABSTbq]{2,3})/i);
            if (mSys) {
                const val = parseCleanDigitToken(mSys[1]);
                if (val >= 70 && val <= 250) sys = val;
            }
        }
        if (dia === null) {
            const mDia = line.match(/(?:dia|diast|min|pad|pd)[\s:.-]*([0-9OIlZABSTbq]{2,3})/i);
            if (mDia) {
                const val = parseCleanDigitToken(mDia[1]);
                if (val >= 40 && val <= 140) dia = val;
            }
        }
        if (pulse === null) {
            const mPul = line.match(/(?:pul|pulse|bpm|lat|pr|hr)[\s:.-]*([0-9OIlZABSTbq]{2,3})/i);
            if (mPul) {
                const val = parseCleanDigitToken(mPul[1]);
                if (val >= 35 && val <= 220) pulse = val;
            }
        }
    }

    // Estrategia 2: Extraer todos los números candidatos encontrados en el orden visual de arriba a abajo
    const allNumbers = [];
    for (const line of lines) {
        // Encontrar tokens que contengan de 2 a 3 caracteres numéricos o letras confundibles
        const tokens = line.split(/[\s/\\|,-]+/);
        for (const token of tokens) {
            if (token.length >= 2 && token.length <= 3) {
                const num = parseCleanDigitToken(token);
                if (!isNaN(num) && num >= 35 && num <= 260) {
                    allNumbers.push(num);
                }
            }
        }
    }

    // Si aún nos faltan valores de presión y tenemos números candidatos:
    if (sys === null || dia === null) {
        if (allNumbers.length >= 2) {
            let n1 = allNumbers[0];
            let n2 = allNumbers[1];
            // En tensiómetros la sistólica siempre es mayor que la diastólica
            if (n1 < n2) {
                const temp = n1;
                n1 = n2;
                n2 = temp;
            }
            if (sys === null && n1 >= 70 && n1 <= 260) sys = n1;
            if (dia === null && n2 >= 35 && n2 <= 140) dia = n2;

            if (pulse === null && allNumbers.length >= 3) {
                const n3 = allNumbers[2];
                if (n3 >= 35 && n3 <= 220) pulse = n3;
            }
        }
    }

    // Verificación final de consistencia
    if (sys !== null && dia !== null && dia >= sys) {
        const temp = sys;
        sys = dia;
        dia = temp;
    }

    return { sys, dia, pulse };
}

/**
 * Limpia y convierte letras confundidas por el OCR en números reales
 */
function parseCleanDigitToken(token) {
    if (!token) return NaN;
    const mapped = token
        .replace(/[OoD]/g, '0')
        .replace(/[Il|/!\\]/g, '1')
        .replace(/[Zz]/g, '2')
        .replace(/[E]/g, '3')
        .replace(/[A]/g, '4')
        .replace(/[Ss]/g, '5')
        .replace(/[b]/g, '6')
        .replace(/[Tt]/g, '7')
        .replace(/[B]/g, '8')
        .replace(/[gq]/g, '9');
    
    const num = parseInt(mapped, 10);
    return isNaN(num) ? NaN : num;
}


