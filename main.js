document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Iconos
    lucide.createIcons();

    // Registrar Service Worker (PWA) de inmediato para máxima compatibilidad con PWABuilder
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .then(reg => {
                console.log('Service Worker registrado con éxito:', reg.scope);
            })
            .catch(err => {
                console.log('Error al registrar Service Worker:', err);
            });
    }

    // Referencias DOM
    const views = {
        dashboard: document.getElementById('view-dashboard'),
        form: document.getElementById('view-form'),
        history: document.getElementById('view-history'),
        stats: document.getElementById('view-stats'),
        profile: document.getElementById('view-profile'),
        profileSelect: document.getElementById('view-profile-select')
    };

    const navItems = document.querySelectorAll('.nav-item');
    const langSelector = document.getElementById('lang-selector');
    const profileForm = document.getElementById('profile-form');
    const bpForm = document.getElementById('bp-form');
    let bpChart = null;
    let currentActiveView = 'dashboard';

    // Estado inicial
    const profile = Storage.getProfile();

    // Redirigir a selección de perfil si no hay usuario activo
    if (!profile) {
        showProfileSelect();
    } else {
        updateDashboard();
        updateProfileView(profile);
    }

    // Inicializar idioma
    langSelector.value = currentLang;
    updateUIStrings();

    // Event Listeners: Navegación
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const viewKey = item.getAttribute('data-view');
            switchView(viewKey);
        });
    });

    langSelector.addEventListener('change', (e) => {
        setLanguage(e.target.value);
    });

    document.getElementById('btn-profile').addEventListener('click', () => switchView('profile'));
    document.getElementById('btn-add-record').addEventListener('click', () => switchView('form'));
    document.getElementById('btn-view-history').addEventListener('click', () => switchView('history'));
    document.getElementById('btn-view-stats').addEventListener('click', () => switchView('stats'));
    document.getElementById('btn-cancel-form').addEventListener('click', () => switchView('dashboard'));
    document.getElementById('btn-back-to-dash-hist').addEventListener('click', () => switchView('dashboard'));
    document.getElementById('btn-back-to-dash-stats').addEventListener('click', () => switchView('dashboard'));
    document.getElementById('btn-export-csv').addEventListener('click', () => Storage.exportCSV());

    // --- Escaneo con Cámara / OCR ---
    const btnScanCamera = document.getElementById('btn-scan-camera');
    const inputCamera = document.getElementById('input-camera');
    const ocrStatusCard = document.getElementById('ocr-status-card');
    const ocrStatusText = document.getElementById('ocr-status-text');
    const ocrSpinner = document.getElementById('ocr-spinner');
    const ocrIconSuccess = document.getElementById('ocr-icon-success');
    const ocrIconError = document.getElementById('ocr-icon-error');
    const ocrProgressBar = document.getElementById('ocr-progress-bar');
    const ocrProgressBg = document.getElementById('ocr-progress-bg');

    if (btnScanCamera && inputCamera) {
        btnScanCamera.addEventListener('click', () => {
            inputCamera.click();
        });

        inputCamera.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            // Mostrar tarjeta de estado y reiniciar barra
            ocrStatusCard.classList.remove('hidden');
            ocrSpinner.classList.remove('hidden');
            ocrIconSuccess.classList.add('hidden');
            ocrIconError.classList.add('hidden');
            ocrProgressBg.classList.remove('hidden');
            ocrProgressBar.style.width = '10%';
            ocrStatusText.innerText = t('scan-status-loading');

            try {
                // Crear objeto de imagen temporal en memoria RAM (no en almacenamiento permanente)
                const tempUrl = URL.createObjectURL(file);
                const img = new Image();
                
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = tempUrl;
                });

                // Liberar inmediatamente el blob URL de memoria
                URL.revokeObjectURL(tempUrl);

                ocrProgressBar.style.width = '30%';
                ocrStatusText.innerText = t('scan-status-processing');

                // Preprocesar imagen en canvas optimizado
                const processedCanvas = preprocessImageForOCR(img);

                // Ejecutar reconocimiento Tesseract local
                if (typeof Tesseract === 'undefined') {
                    throw new Error('Tesseract library not loaded');
                }

                const worker = await Tesseract.recognize(processedCanvas, 'eng', {
                    logger: (m) => {
                        if (m.status === 'recognizing text' && m.progress) {
                            const percent = Math.min(95, 30 + Math.round(m.progress * 65));
                            ocrProgressBar.style.width = percent + '%';
                        }
                    }
                });

                const rawText = (worker && worker.data && worker.data.text) ? worker.data.text : '';
                console.log('Texto reconocido por OCR:', rawText);

                // Extraer Sistólica, Diastólica y Pulso
                const { sys, dia, pulse } = extractBPFromOCRText(rawText);

                // Destruir canvas para asegurar liberación de memoria RAM
                processedCanvas.width = 1;
                processedCanvas.height = 1;

                // Limpiar el input para no conservar ninguna copia en memoria del navegador
                inputCamera.value = '';

                let detectedCount = 0;
                const sysInput = document.getElementById('input-sys');
                const diaInput = document.getElementById('input-dia');
                const pulseInput = document.getElementById('input-pulse');

                if (sys) {
                    sysInput.value = sys;
                    highlightField(sysInput);
                    detectedCount++;
                }
                if (dia) {
                    diaInput.value = dia;
                    highlightField(diaInput);
                    detectedCount++;
                }
                if (pulse) {
                    pulseInput.value = pulse;
                    highlightField(pulseInput);
                    detectedCount++;
                }

                ocrSpinner.classList.add('hidden');
                ocrProgressBg.classList.add('hidden');

                if (detectedCount >= 2) {
                    ocrIconSuccess.classList.remove('hidden');
                    ocrStatusText.innerText = (detectedCount === 3) 
                        ? t('scan-status-success') 
                        : t('scan-status-partial');
                    
                    // Ocultar notificación tras 4.5 segundos si fue exitoso
                    setTimeout(() => {
                        ocrStatusCard.classList.add('hidden');
                    }, 4500);
                } else {
                    ocrIconError.classList.remove('hidden');
                    ocrStatusText.innerText = t('scan-status-error');
                }
            } catch (err) {
                console.error('Error durante el escaneo OCR:', err);
                inputCamera.value = '';
                ocrSpinner.classList.add('hidden');
                ocrProgressBg.classList.add('hidden');
                ocrIconError.classList.remove('hidden');
                ocrStatusText.innerText = t('scan-status-error');
            }
        });
    }

    function highlightField(inputEl) {
        inputEl.classList.remove('ocr-field-detected');
        void inputEl.offsetWidth; // Forzar reflow para reiniciar animación
        inputEl.classList.add('ocr-field-detected');
    }

    document.getElementById('btn-set-reminder').addEventListener('click', () => {
        const timeVal = document.getElementById('input-reminder-time').value;
        if (timeVal) {
            Storage.generateCalendarReminder(timeVal);
            alert(currentLang === 'es' ? 'Se descargó la invitación del calendario. Ábrela para guardar tu recordatorio.' : 'Calendar invite downloaded. Open it to save your reminder.');
        }
    });

    document.getElementById('input-import-csv').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            Storage.importCSV(file, (count) => {
                alert(currentLang === 'es' ? `Se importaron ${count} registros nuevos.` : `Imported ${count} new records.`);
                updateDashboard();
                if (currentActiveView === 'history') updateHistoryList();
                e.target.value = ''; // Limpiar input
            });
        }
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        Storage.logout();
        showProfileSelect();
    });

    document.getElementById('btn-create-new-profile').addEventListener('click', () => {
        profileForm.reset();
        document.getElementById('bmi-info').classList.add('hidden');
        switchView('profile');
    });

    // Registro de Perfil
    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newProfile = {
            name: document.getElementById('input-name').value,
            age: document.getElementById('input-age').value,
            weight: document.getElementById('input-weight').value,
            height: document.getElementById('input-height').value
        };
        Storage.saveProfile(newProfile);
        updateProfileView(newProfile);
        
        // Efecto visual y cambio a dashboard
        alert(currentLang === 'es' ? 'Perfil guardado con éxito' : 'Profile saved successfully');
        switchView('dashboard');
        updateDashboard();
    });

    // Registro de Medición
    bpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const record = {
            id: Date.now(),
            sys: parseInt(document.getElementById('input-sys').value),
            dia: parseInt(document.getElementById('input-dia').value),
            pulse: parseInt(document.getElementById('input-pulse').value),
            meds: document.getElementById('input-meds').checked,
            notes: document.getElementById('input-notes').value,
            date: new Date().toLocaleString()
        };
        
        Storage.saveRecord(record);
        bpForm.reset();
        
        switchView('dashboard');
        updateDashboard();
        updateHistoryList();
    });

    // Funciones de UI
    function switchView(viewKey) {
        // En selección de perfil no hay nav
        const isProfileSelect = viewKey === 'profileSelect';
        document.querySelector('.app-nav').style.display = isProfileSelect ? 'none' : 'flex';
        document.querySelector('.app-header').style.display = isProfileSelect ? 'none' : 'flex';

        // Ocultar todas
        Object.values(views).forEach(v => v.classList.add('hidden'));
        // Mostrar seleccionada
        views[viewKey].classList.remove('hidden');
        
        // Actualizar Nav
        navItems.forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-view') === viewKey);
        });
        
        currentActiveView = viewKey;
        
        if (viewKey === 'history') updateHistoryList();
        if (viewKey === 'stats') updateStatsView();
        
        window.scrollTo(0, 0);
    }

    function updateDashboard() {
        const history = Storage.getHistory();
        const profile = Storage.getProfile();

        // Saludo personalizado
        const greeting = document.getElementById('app-greeting');
        if (profile) {
            greeting.setAttribute('data-i18n', 'welcome-back');
            greeting.setAttribute('data-i18n-name', profile.name);
        }
        
        if (history.length > 0) {
            const latest = history[0];
            const interpretation = interpretBP(latest.sys, latest.dia);
            
            document.getElementById('val-sys').innerText = latest.sys;
            document.getElementById('val-dia').innerText = latest.dia;
            document.getElementById('val-pulse').innerText = latest.pulse;
            
            // Estado del pulso
            const pulseInter = interpretPulse(latest.pulse);
            const pulseStatus = document.getElementById('pulse-status');
            pulseStatus.setAttribute('data-i18n', pulseInter.id);
            pulseStatus.className = 'pulse-tag ' + pulseInter.class;
            
            const statusTag = document.getElementById('status-tag');
            statusTag.setAttribute('data-i18n', interpretation.id);
            
            const latestCard = document.getElementById('latest-card');
            latestCard.className = 'reading-card main-reading glass ' + interpretation.class;

            // Consejos de salud
            const tipContainer = document.getElementById('health-tip-container');
            const tipText = document.getElementById('health-tip-text');
            const tipKey = getHealthTip(interpretation.id);
            
            tipContainer.classList.remove('hidden');
            tipText.setAttribute('data-i18n', tipKey);
        } else {
            // Estado vacío
            document.getElementById('val-sys').innerText = '--';
            document.getElementById('val-dia').innerText = '--';
            document.getElementById('val-pulse').innerText = '--';
            document.getElementById('status-tag').setAttribute('data-i18n', 'no-data');
            document.getElementById('latest-card').className = 'reading-card main-reading glass';
            document.getElementById('health-tip-container').classList.add('hidden');
        }
        
        updateUIStrings();
    }

    function updateProfileView(profile) {
        document.getElementById('input-name').value = profile.name;
        document.getElementById('input-age').value = profile.age;
        document.getElementById('input-weight').value = profile.weight;
        document.getElementById('input-height').value = profile.height;

        const bmiData = calculateBMI(profile.weight, profile.height);
        const bmiInfo = document.getElementById('bmi-info');
        const valBmi = document.getElementById('val-bmi');
        const bmiStatus = document.getElementById('bmi-status');

        bmiInfo.classList.remove('hidden');
        valBmi.innerText = bmiData.bmi;
        bmiStatus.setAttribute('data-i18n', bmiData.category);
        
        updateUIStrings();
    }

    function updateHistoryList() {
        const history = Storage.getHistory();
        const listContainer = document.getElementById('history-list');
        listContainer.innerHTML = '';

        if (history.length === 0) {
            listContainer.innerHTML = `<p style="text-align:center; color:var(--text-secondary); margin-top:40px;">No hay registros aún.</p>`;
            return;
        }

        history.forEach(item => {
            const inter = interpretBP(item.sys, item.dia);
            const pulseInter = interpretPulse(item.pulse);
            const card = document.createElement('div');
            card.className = `history-item glass ${inter.class}`;
            card.innerHTML = `
                <div class="history-info">
                    <div class="history-date">${item.date}</div>
                    <div class="history-bp">${item.sys}<span>/</span>${item.dia}</div>
                    <div class="history-pulse">
                        <i data-lucide="activity" style="width:12px; vertical-align:middle"></i> ${item.pulse} bpm 
                        <small class="pulse-tag ${pulseInter.class}" data-i18n="${pulseInter.id}">${t(pulseInter.id)}</small>
                    </div>
                    ${item.meds ? `<div class="meds-indicator" data-i18n="meds-taken">${t('meds-taken')}</div>` : ''}
                </div>
                <div class="status-tag">${t(inter.id)}</div>
                ${item.notes ? `<div class="history-notes">"${item.notes}"</div>` : ''}
            `;
            listContainer.appendChild(card);
        });
        
        lucide.createIcons();
        updateUIStrings();
    }

    function updateStatsView() {
        const history = [...Storage.getHistory()].reverse(); // Orden cronológico para gráfico
        if (history.length === 0) return;

        // Calcular Promedios
        const avgSys = Math.round(history.reduce((a, b) => a + b.sys, 0) / history.length);
        const avgDia = Math.round(history.reduce((a, b) => a + b.dia, 0) / history.length);
        document.getElementById('avg-sys').innerText = avgSys;
        document.getElementById('avg-dia').innerText = avgDia;

        // Preparar Gráfico
        const ctx = document.getElementById('bp-chart').getContext('2d');
        if (bpChart) bpChart.destroy();

        bpChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: history.map(r => r.date.split(',')[0]), // Solo fecha, sin hora
                datasets: [
                    {
                        label: 'SYS',
                        data: history.map(r => r.sys),
                        borderColor: '#38bdf8',
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'DIA',
                        data: history.map(r => r.dia),
                        borderColor: '#818cf8',
                        backgroundColor: 'rgba(129, 140, 248, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#f8fafc' } }
                },
                scales: {
                    y: {
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    x: {
                        ticks: { color: '#94a3b8' },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function showProfileSelect() {
        const users = Storage.getUsers();
        const list = document.getElementById('profile-list');
        list.innerHTML = '';

        if (users.length === 0) {
            switchView('profile'); // Ir directo a crear si no hay ninguno
            return;
        }

        users.forEach(user => {
            const card = document.createElement('div');
            card.className = 'profile-item-card glass';
            card.innerHTML = `
                <div class="profile-avatar"><i data-lucide="user"></i></div>
                <h4>${user.name}</h4>
            `;
            card.addEventListener('click', () => {
                Storage.setCurrentUserId(user.id);
                switchView('dashboard');
                updateDashboard();
                updateProfileView(user);
            });
            list.appendChild(card);
        });

        switchView('profileSelect');
        lucide.createIcons();
    }
});
