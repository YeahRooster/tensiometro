document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Iconos
    lucide.createIcons();

    // Registrar Service Worker (PWA)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then(reg => {
                console.log('Service Worker registrado con éxito:', reg.scope);
            }).catch(err => {
                console.log('Error al registrar Service Worker:', err);
            });
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
            const card = document.createElement('div');
            card.className = `history-item glass ${inter.class}`;
            card.innerHTML = `
                <div class="history-info">
                    <div class="history-date">${item.date}</div>
                    <div class="history-bp">${item.sys}<span>/</span>${item.dia}</div>
                    <div class="history-pulse"><i data-lucide="activity" style="width:12px; vertical-align:middle"></i> ${item.pulse} bpm</div>
                    ${item.meds ? `<div class="meds-indicator" data-i18n="meds-taken">Medicada</div>` : ''}
                </div>
                <div class="status-tag">${t(inter.id)}</div>
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
