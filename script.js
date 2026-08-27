let myLibrary = [];
let currentDisplayData = [];
let currentSortMode = 'recent';
let currentVolViewMode = localStorage.getItem('pixel_shelf_vol_view') || 'grid'; // default grid slot view

// ==========================================================================
// 8-BIT AUDIO SYNTHESIZER (WEB AUDIO API)
// ==========================================================================
let audioCtx = null;
let soundEnabled = localStorage.getItem('pixel_shelf_sound') !== 'false';
let crtEnabled = localStorage.getItem('pixel_shelf_crt') !== 'false';

// Console Themes
const themes = [
    { id: 'arcade', name: 'THEME: ARCADE' },
    { id: 'gameboy', name: 'THEME: GAMEBOY' },
    { id: 'cyber', name: 'THEME: CYBER' },
    { id: 'snes', name: 'THEME: SNES' }
];
let currentThemeIndex = Math.max(0, themes.findIndex(t => t.id === localStorage.getItem('pixel_shelf_theme')));

function initAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!soundEnabled) return;
    try {
        initAudioContext();
        if (!audioCtx) return;
        
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'click' || type === 'select') {
            // Crisp 8-bit blip
            osc.type = 'square';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(783.99, now + 0.04);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'powerup' || type === 'success') {
            // Retro Level-Up Fanfare: C5 -> E5 -> G5 -> C6
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, idx) => {
                const noteOsc = audioCtx.createOscillator();
                const noteGain = audioCtx.createGain();
                noteOsc.type = 'square';
                noteOsc.frequency.setValueAtTime(freq, now + idx * 0.07);
                noteGain.gain.setValueAtTime(0.12, now + idx * 0.07);
                noteGain.gain.linearRampToValueAtTime(0.01, now + idx * 0.07 + 0.09);
                noteOsc.connect(noteGain);
                noteGain.connect(audioCtx.destination);
                noteOsc.start(now + idx * 0.07);
                noteOsc.stop(now + idx * 0.07 + 0.09);
            });
        } else if (type === 'toggle') {
            // Arcade switch tick
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(659.25, now + 0.05);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'delete') {
            // 8-bit hit / explosion sound
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.18);
            osc.start(now);
            osc.stop(now + 0.18);
        }
    } catch (e) {
        // Silent catch
    }
}

// ==========================================================================
// TOGGLES, THEMES & HUD CONTROLS
// ==========================================================================

function applyTheme(index) {
    const theme = themes[index];
    document.documentElement.setAttribute('data-theme', theme.id);
    localStorage.setItem('pixel_shelf_theme', theme.id);
    const themeText = document.getElementById('theme-text');
    if (themeText) themeText.innerText = theme.name;
}

function cycleTheme() {
    initAudioContext();
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    applyTheme(currentThemeIndex);
    playSound('toggle');
}

function updateSoundButtonUI() {
    const btn = document.getElementById('sound-btn');
    const text = document.getElementById('sound-text');
    const icon = document.getElementById('sound-icon');
    if (!btn || !text) return;
    
    if (soundEnabled) {
        text.innerText = 'SFX: ON';
        icon.setAttribute('data-lucide', 'volume-2');
        btn.classList.remove('btn-danger-outline');
    } else {
        text.innerText = 'SFX: OFF';
        icon.setAttribute('data-lucide', 'volume-x');
        btn.classList.add('btn-danger-outline');
    }
    lucide.createIcons();
}

function updateCRTUI() {
    const text = document.getElementById('crt-text');
    if (crtEnabled) {
        document.body.classList.remove('crt-disabled');
        if (text) text.innerText = 'CRT: ON';
    } else {
        document.body.classList.add('crt-disabled');
        if (text) text.innerText = 'CRT: OFF';
    }
}

function toggleSound() {
    initAudioContext();
    soundEnabled = !soundEnabled;
    localStorage.setItem('pixel_shelf_sound', soundEnabled);
    updateSoundButtonUI();
    if (soundEnabled) playSound('click');
}

function toggleCRT() {
    crtEnabled = !crtEnabled;
    localStorage.setItem('pixel_shelf_crt', crtEnabled);
    updateCRTUI();
    playSound('toggle');
}

// Real-Time HUD Stats & RPG EXP Bar Update
function updateHUD(library) {
    const totalEl = document.getElementById('hud-total');
    const ongoingEl = document.getElementById('hud-ongoing');
    const clearedEl = document.getElementById('hud-cleared');
    const droppedEl = document.getElementById('hud-dropped');
    const volumesEl = document.getElementById('hud-volumes');
    const expText = document.getElementById('exp-percent-text');
    const expFill = document.getElementById('exp-bar-fill');

    if (!totalEl) return;

    const list = library || myLibrary;
    let ongoing = 0, cleared = 0, dropped = 0, totalVols = 0;

    list.forEach(book => {
        const st = (book.status || 'yellow').toLowerCase();
        if (st === 'green' || st === 'end') cleared++;
        else if (st === 'red') dropped++;
        else ongoing++;

        if (book.volumes && Array.isArray(book.volumes)) {
            totalVols += book.volumes.length;
        }
    });

    totalEl.innerText = list.length;
    ongoingEl.innerText = ongoing;
    clearedEl.innerText = cleared;
    droppedEl.innerText = dropped;
    volumesEl.innerText = totalVols;

    // Calculate Completion Rate %
    const rate = list.length > 0 ? Math.round((cleared / list.length) * 100) : 0;
    if (expText) expText.innerText = `${rate}%`;
    if (expFill) expFill.style.width = `${rate}%`;
}

// ==========================================================================
// SORTING LOGIC
// ==========================================================================

function setSortMode(mode) {
    playSound('select');
    currentSortMode = mode;
    
    // Update sort button active classes
    const btnMap = { 'recent': 'sort-recent', 'az': 'sort-az', 'vols': 'sort-vols' };
    Object.keys(btnMap).forEach(k => {
        const el = document.getElementById(btnMap[k]);
        if (el) {
            if (k === mode) el.classList.add('active');
            else el.classList.remove('active');
        }
    });

    displayLibrary(currentDisplayData);
}

function applySort(data) {
    const copy = [...data];
    if (currentSortMode === 'az') {
        return copy.sort((a, b) => a.title.localeCompare(b.title));
    } else if (currentSortMode === 'vols') {
        return copy.sort((a, b) => ((b.volumes?.length || 0) - (a.volumes?.length || 0)));
    } else {
        // 'recent' by last_updated or ID
        return copy.sort((a, b) => new Date(b.last_updated || 0) - new Date(a.last_updated || 0));
    }
}

// ==========================================================================
// LIVE CRAFTING MINI PREVIEW HANDLER
// ==========================================================================

function initCraftPreview() {
    const titleInput = document.getElementById('new-title');
    const volInput = document.getElementById('new-vol');
    const catInput = document.getElementById('new-category');
    const previewTitle = document.getElementById('preview-title');
    const previewMeta = document.getElementById('preview-meta');

    function update() {
        const title = titleInput.value.trim() || 'Series Name';
        const vol = volInput.value.trim() || '1';
        const cat = catInput.value;

        let catIcon = '📜';
        if (cat === 'Novel') catIcon = '📖';
        else if (cat === 'EBook') catIcon = '🔮';

        if (previewTitle) previewTitle.innerText = title;
        if (previewMeta) previewMeta.innerText = `${catIcon} ${cat} • Vol ${vol}`;
    }

    if (titleInput) titleInput.addEventListener('input', update);
    if (volInput) volInput.addEventListener('input', update);
    if (catInput) catInput.addEventListener('change', update);
}

// ==========================================================================
// EVENT LISTENERS SETUP
// ==========================================================================

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleLogin();
});
document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('logout-btn').addEventListener('click', () => {
    playSound('delete');
    handleLogout();
});
document.getElementById('save-btn').addEventListener('click', addBook);

const themeBtn = document.getElementById('theme-btn');
if (themeBtn) themeBtn.addEventListener('click', cycleTheme);

const soundBtn = document.getElementById('sound-btn');
if (soundBtn) soundBtn.addEventListener('click', toggleSound);

const crtBtn = document.getElementById('crt-btn');
if (crtBtn) crtBtn.addEventListener('click', toggleCRT);

document.getElementById('back-btn').addEventListener('click', () => {
    playSound('select');
    setActiveNav('nav-all');
    fetchAllBooks();
});
document.getElementById('nav-all').addEventListener('click', () => {
    playSound('select');
    setActiveNav('nav-all');
    fetchAllBooks();
});
document.getElementById('nav-comic').addEventListener('click', () => {
    playSound('select');
    setActiveNav('nav-comic');
    filterBooks('Comic');
});
document.getElementById('nav-novel').addEventListener('click', () => {
    playSound('select');
    setActiveNav('nav-novel');
    filterBooks('Novel');
});
document.getElementById('nav-ebook').addEventListener('click', () => {
    playSound('select');
    setActiveNav('nav-ebook');
    filterBooks('EBook');
});
document.getElementById('search-input').addEventListener('input', searchBook);

// Sync CSV button click handler
document.getElementById('sync-csv-btn').addEventListener('click', () => {
    playSound('select');
    if (confirm("⚡ Confirm reload all data from book_rows.csv? Local cached unsaved edits will be replaced.")) {
        loadLibraryFromCSV(false);
    }
});

// Helper to update sidebar active navigation item
function setActiveNav(activeId) {
    const navIds = ['nav-all', 'nav-comic', 'nav-novel', 'nav-ebook'];
    navIds.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            if (id === activeId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

// ==========================================================================
// CSV PARSER HELPERS
// ==========================================================================

function parseCSV(text) {
    const lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                row[row.length - 1] += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push('');
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            lines.push(row);
            row = [''];
        } else {
            row[row.length - 1] += char;
        }
    }
    if (row.length > 1 || row[0] !== '') {
        lines.push(row);
    }
    return lines;
}

function convertCSVToLibrary(csvLines) {
    if (csvLines.length === 0) return [];
    
    const headers = csvLines[0].map(h => h.trim().toLowerCase());
    const titleIdx = headers.indexOf('title');
    const categoryIdx = headers.indexOf('category');
    const volumesIdx = headers.indexOf('volumes');
    const idIdx = headers.indexOf('id');
    const lastUpdatedIdx = headers.indexOf('last_updated');
    const statusIdx = headers.indexOf('status');
    const userIdIdx = headers.indexOf('user_id');
    
    const library = [];
    
    for (let i = 1; i < csvLines.length; i++) {
        const row = csvLines[i];
        if (row.length < headers.length) continue;
        
        let title = row[titleIdx];
        if (!title) continue;
        
        let category = row[categoryIdx] || 'Comic';
        const categoryLower = category.toLowerCase();
        if (categoryLower === 'comic') category = 'Comic';
        else if (categoryLower === 'novel') category = 'Novel';
        else if (categoryLower === 'ebook' || categoryLower === 'e-book') category = 'EBook';
        else category = 'Comic';
        
        let status = row[statusIdx] || 'yellow';
        status = status.replace(/[\r\n\t"]/g, '').trim().toLowerCase();
        if (status === 'green' || status === 'end') status = 'green';
        else if (status === 'red') status = 'red';
        else status = 'yellow';
        
        let volumes = [];
        const rawVolumes = row[volumesIdx];
        if (rawVolumes) {
            try {
                volumes = JSON.parse(rawVolumes);
            } catch (e) {
                volumes = rawVolumes.replace(/[\[\]"'\s]/g, '').split(',').filter(Boolean);
            }
        }
        
        const id = parseInt(row[idIdx]) || Date.now() + i;
        const last_updated = row[lastUpdatedIdx] || new Date().toISOString();
        const user_id = row[userIdIdx] || '6f9750bd-eace-4bf7-92d2-068033cc1bb7';
        
        library.push({
            id,
            title,
            category,
            volumes,
            status,
            last_updated,
            user_id
        });
    }
    
    return library;
}

// Fallback seed data
function getFallbackSeedData() {
    return [
        {
            id: 1,
            title: "One Piece (วันพีซ)",
            category: "Comic",
            volumes: ["1", "2", "3", "99", "100", "101"],
            status: "yellow",
            last_updated: new Date().toISOString(),
            user_id: '6f9750bd-eace-4bf7-92d2-068033cc1bb7'
        },
        {
            id: 2,
            title: "Solo Leveling",
            category: "Novel",
            volumes: ["1", "2", "3"],
            status: "green",
            last_updated: new Date().toISOString(),
            user_id: '6f9750bd-eace-4bf7-92d2-068033cc1bb7'
        }
    ];
}

// ==========================================================================
// CSV LOADER
// ==========================================================================

async function loadLibraryFromCSV(silent = false) {
    const listDiv = document.getElementById('book-list');
    if (!silent) {
        listDiv.innerHTML = `
            <div class="connection-status">
                <div class="spinner"></div>
                <span class="pixel-blink">PARSING BOOK_ROWS.CSV...</span>
            </div>`;
    }
    
    try {
        const response = await fetch('./book_rows.csv');
        if (!response.ok) throw new Error("Could not fetch book_rows.csv from workspace.");
        
        const text = await response.text();
        const csvLines = parseCSV(text);
        const library = convertCSVToLibrary(csvLines);
        
        await saveLibrary(library);
        
        if (!silent) {
            playSound('powerup');
            alert(`⚔️ LOADED ${library.length} QUESTS FROM CSV ARCHIVE!`);
        }
        displayLibrary(library);
    } catch (error) {
        console.error("Error loading CSV:", error);
        if (!silent) {
            alert("Error loading CSV: " + error.message);
        }
        
        if (!localStorage.getItem('my_shelf_library')) {
            const seedData = getFallbackSeedData();
            await saveLibrary(seedData);
            displayLibrary(seedData);
        }
    }
}

// ==========================================================================
// COMBINED STORAGE & SERVER WRITER
// ==========================================================================

async function saveLibrary(library) {
    localStorage.setItem('my_shelf_library', JSON.stringify(library));
    myLibrary = library;
    updateHUD(library);
    
    try {
        const response = await fetch('/api/books', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(library)
        });
        if (!response.ok) {
            console.error("Failed to write to server database API.");
        }
    } catch (error) {
        console.warn("Server API offline. Saved to browser localStorage.", error);
    }
}

// ==========================================================================
// AUTHENTICATION (ARCADE ACCESS SIMULATION)
// ==========================================================================

function checkUser() {
    applyTheme(currentThemeIndex);
    updateSoundButtonUI();
    updateCRTUI();
    initCraftPreview();
    
    const userEmail = localStorage.getItem('my_shelf_user');
    if (userEmail) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        document.getElementById('display-user').innerText = `[LV.99] ${userEmail}`;
        fetchAllBooks();
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
    lucide.createIcons();
}

async function handleLogin() {
    initAudioContext();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!email || !password) return;
    
    const btn = document.getElementById('login-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>LOADING...</span><div class="spinner" style="width:16px; height:16px; border-width:2px; margin:0;"></div>';
    
    playSound('powerup');
    await new Promise(resolve => setTimeout(resolve, 350));
    
    localStorage.setItem('my_shelf_user', email);
    
    btn.disabled = false;
    btn.innerHTML = originalText;
    
    checkUser();
}

function handleLogout() {
    localStorage.removeItem('my_shelf_user');
    checkUser();
}

async function fetchAllBooks() {
    const listDiv = document.getElementById('book-list');
    listDiv.innerHTML = `
        <div class="connection-status">
            <div class="spinner"></div>
            <span class="pixel-blink">RETRIEVING QUEST ARCHIVE...</span>
        </div>`;
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    try {
        const response = await fetch('/api/books');
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('my_shelf_library', JSON.stringify(data));
            myLibrary = data;
            displayLibrary(data);
            return;
        }
    } catch (e) {
        console.log("Using Local Storage cache fallback.");
    }
    
    const data = localStorage.getItem('my_shelf_library');
    if (!data) {
        await loadLibraryFromCSV(true);
    } else {
        myLibrary = JSON.parse(data);
        displayLibrary(myLibrary);
    }
}

// ==========================================================================
// DISPLAY LOGIC (PIXEL RPG CARDS)
// ==========================================================================

function displayLibrary(data) {
    currentDisplayData = data;
    updateHUD(data);
    
    const listDiv = document.getElementById('book-list');
    const backBtn = document.getElementById('back-btn');
    const gridControls = document.getElementById('grid-controls-bar');
    
    if (backBtn) backBtn.style.display = 'none';
    if (gridControls) gridControls.style.display = 'flex';
    
    if (data.length === 0) {
        listDiv.innerHTML = `
            <div class="empty-state">
                <i data-lucide="ghost" style="width:48px; height:48px; color:var(--pixel-border-highlight); margin-bottom:16px;"></i>
                <p>NO QUEST ENTRIES FOUND IN THIS ARCHIVE.</p>
            </div>`;
        lucide.createIcons();
        return;
    }
    
    const sortedData = applySort(data);
    let html = '<div class="grid-container">';
    
    sortedData.forEach((series) => {
        let label = '🔥 ONGOING', cls = 'status-yellow';
        if (series.status === 'green' || series.status === 'end') { 
            label = '★ CLEARED'; 
            cls = 'status-green'; 
        } else if (series.status === 'red') { 
            label = '💀 DROPPED'; 
            cls = 'status-red'; 
        }

        let catIcon = '📜';
        if (series.category === 'Novel') catIcon = '📖';
        else if (series.category === 'EBook') catIcon = '🔮';

        const volCount = series.volumes ? series.volumes.length : 0;

        html += `
            <div class="series-card" onclick="showDetailById(${series.id})">
                <div class="card-top">
                    <div class="card-title" title="${series.title}">${series.title}</div>
                    <div class="card-info">
                        <span>${catIcon} ${series.category}</span>
                        <span class="card-info-dot"></span>
                        <span>🎒 <span class="num-highlight">${volCount}</span> VOLS</span>
                    </div>
                </div>
                <div class="card-bottom">
                    <span class="status-badge ${cls}">${label}</span>
                    <span style="font-family:var(--font-thai-gaming); font-weight:700; font-size:0.85rem; color:var(--pixel-text-gold);">OPEN &gt;</span>
                </div>
            </div>`;
    });
    
    html += '</div>';
    listDiv.innerHTML = html;
    lucide.createIcons();
}

// ==========================================================================
// DETAIL VIEW (RPG QUEST INSPECTOR)
// ==========================================================================

function getNPCMessage(series) {
    const st = (series.status || 'yellow').toLowerCase();
    const vols = series.volumes ? series.volumes.length : 0;
    
    if (st === 'green' || st === 'end') {
        return `★ <strong>QUEST COMPLETED!</strong> You have archived all <strong>${vols}</strong> volumes of this sacred tome!`;
    } else if (st === 'red') {
        return `💀 <strong>PAUSED / DROPPED:</strong> This series rests in deep storage with <strong>${vols}</strong> volumes preserved.`;
    } else {
        return `⚔️ <strong>ONGOING QUEST:</strong> Currently holding <strong>${vols}</strong> volumes. Forge next volumes to level up!`;
    }
}

function showDetailById(id) {
    playSound('select');
    const series = myLibrary.find(s => s.id === id);
    if (!series) return;

    const listDiv = document.getElementById('book-list');
    const backBtn = document.getElementById('back-btn');
    const gridControls = document.getElementById('grid-controls-bar');
    
    if (backBtn) backBtn.style.display = 'inline-flex';
    if (gridControls) gridControls.style.display = 'none';
    
    const curStatus = series.status || 'yellow';
    const updatedDate = new Date(series.last_updated || series.created_at || new Date()).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    let catIcon = '📜';
    if (series.category === 'Novel') catIcon = '📖';
    else if (series.category === 'EBook') catIcon = '🔮';

    listDiv.innerHTML = `
        <div class="detail-card" style="max-width: 840px; margin: 0 auto;">
            <div class="detail-header">
                <div class="detail-title-section">
                    <h2>${series.title}</h2>
                    <span class="detail-meta-category">${catIcon} TYPE: ${series.category.toUpperCase()}</span>
                </div>
            </div>

            <!-- Librarian NPC Dialogue -->
            <div class="npc-dialog-box">
                <div class="npc-avatar">🧙‍♂️</div>
                <div class="npc-text">${getNPCMessage(series)}</div>
            </div>

            <!-- Status Segmented Picker -->
            <div class="status-toggle-container">
                <div class="st-btn ${curStatus==='yellow'?'active':''}" onclick="updateStatus(${series.id}, 'yellow')">🔥 ONGOING</div>
                <div class="st-btn ${curStatus==='green'||curStatus==='end'?'active':''}" onclick="updateStatus(${series.id}, 'green')">★ CLEARED</div>
                <div class="st-btn ${curStatus==='red'?'active':''}" onclick="updateStatus(${series.id}, 'red')">💀 DROPPED</div>
            </div>

            <!-- Inline Quick Add Volume Form -->
            <div class="quick-add-volume-bar">
                <span class="quick-add-title">⚡ QUICK ADD VOLUME:</span>
                <input type="text" id="quick-vol-input" class="quick-add-input" placeholder="Vol #" onkeydown="if(event.key==='Enter') quickAddVolume(${series.id})">
                <button class="btn btn-primary btn-sm" onclick="quickAddVolume(${series.id})">
                    <i data-lucide="plus"></i>
                    <span>ADD VOL</span>
                </button>
                <button class="btn btn-secondary btn-sm" onclick="quickAddNextVolume(${series.id})" title="Auto increment and add next volume number">
                    <i data-lucide="chevrons-up"></i>
                    <span>+1 NEXT VOL</span>
                </button>
            </div>

            <!-- Volume Controls Row -->
            <div class="vol-controls-row">
                <input type="text" id="vol-search" class="vol-search-bar" placeholder="🔍 > FILTER VOLUMES..." oninput="filterVolView(${series.id})">
                <div class="view-mode-toggles">
                    <button class="view-mode-btn ${currentVolViewMode==='grid'?'active':''}" onclick="setVolViewMode(${series.id}, 'grid')">
                        <i data-lucide="layout-grid" style="width:14px; height:14px;"></i>
                        <span>GRID</span>
                    </button>
                    <button class="view-mode-btn ${currentVolViewMode==='table'?'active':''}" onclick="setVolViewMode(${series.id}, 'table')">
                        <i data-lucide="list" style="width:14px; height:14px;"></i>
                        <span>LIST</span>
                    </button>
                </div>
            </div>

            <!-- Dynamic Volume Container -->
            <div id="vol-container">
                ${renderVolumeView(series.id, series.volumes)}
            </div>

            <div class="detail-footer">
                <span class="last-updated-text">🕒 LAST SAVE: ${updatedDate}</span>
                <button onclick="deleteSeries(${series.id})" class="btn btn-danger-outline">
                    <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                    <span>DISCARD SERIES</span>
                </button>
            </div>
        </div>
    `;
    lucide.createIcons();
}

function setVolViewMode(seriesId, mode) {
    playSound('select');
    currentVolViewMode = mode;
    localStorage.setItem('pixel_shelf_vol_view', mode);
    showDetailById(seriesId);
}

function renderVolumeView(seriesId, volumes, filter = '') {
    const vList = volumes || [];
    const filtered = vList
        .filter(v => v.toString().includes(filter))
        .sort((a, b) => parseFloat(a) - parseFloat(b));

    if (filtered.length === 0) {
        return '<p style="color:var(--pixel-text-muted); padding:24px; text-align:center; font-family:var(--font-thai-gaming); font-size:1.1rem;">No volume items found in inventory.</p>';
    }

    if (currentVolViewMode === 'grid') {
        // RPG Inventory Grid Slot View
        let html = '<div class="inventory-grid-wrapper">';
        filtered.forEach(v => {
            html += `
                <div class="inventory-slot">
                    <div class="slot-icon">📘</div>
                    <div class="slot-vol-text">VOL ${v}</div>
                    <button class="slot-delete-btn" onclick="deleteVolume(${seriesId}, '${v}')" title="Delete volume ${v}">✕</button>
                </div>`;
        });
        html += '</div>';
        return html;
    } else {
        // Classic Table List View
        let html = `
            <div class="vol-table-wrapper">
                <table class="vol-table">
                    <thead>
                        <tr>
                            <th>ITEM / VOLUME NO.</th>
                            <th>STATUS</th>
                            <th style="text-align:right;">ACTION</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        filtered.forEach(v => {
            html += `
                <tr>
                    <td>📘 <span class="vol-num-highlight">Volume ${v}</span></td>
                    <td>
                        <span style="display:inline-flex; align-items:center; gap:6px; color:var(--pixel-green); font-weight:bold; font-size:0.95rem;">
                            <i data-lucide="check-square" style="width:14px; height:14px;"></i>
                            COLLECTED
                        </span>
                    </td>
                    <td style="text-align:right;">
                        <button class="btn-delete-vol" onclick="deleteVolume(${seriesId}, '${v}')" title="Delete volume ${v}">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </td>
                </tr>`;
        });
        
        html += '</tbody></table></div>';
        return html;
    }
}

function filterVolView(id) {
    const q = document.getElementById('vol-search').value;
    const series = myLibrary.find(s => s.id === id);
    if (series) {
        document.getElementById('vol-container').innerHTML = renderVolumeView(series.id, series.volumes, q);
        lucide.createIcons();
    }
}

// ==========================================================================
// ACTION LOGIC & QUICK VOLUME ADDERS
// ==========================================================================

async function quickAddVolume(seriesId) {
    const input = document.getElementById('quick-vol-input');
    if (!input) return;
    const vol = input.value.trim();
    if (!vol) {
        playSound('delete');
        return alert("⚠️ Please enter a volume number!");
    }

    const series = myLibrary.find(s => s.id === seriesId);
    if (!series) return;

    let vList = series.volumes || [];
    if (vList.includes(vol)) {
        playSound('delete');
        return alert("⚠️ Volume already in your collection!");
    }

    vList.push(vol);
    vList.sort((a, b) => parseFloat(a) - parseFloat(b));
    series.volumes = vList;
    series.last_updated = new Date().toISOString();

    await saveLibrary(myLibrary);
    playSound('powerup');
    showDetailById(seriesId);
}

async function quickAddNextVolume(seriesId) {
    const series = myLibrary.find(s => s.id === seriesId);
    if (!series) return;

    let vList = series.volumes || [];
    let nextNum = 1;
    if (vList.length > 0) {
        const nums = vList.map(v => parseFloat(v)).filter(n => !isNaN(n));
        if (nums.length > 0) {
            nextNum = Math.max(...nums) + 1;
        }
    }

    const nextVolStr = nextNum.toString();
    if (vList.includes(nextVolStr)) {
        playSound('delete');
        return alert(`⚠️ Volume ${nextVolStr} already exists!`);
    }

    vList.push(nextVolStr);
    vList.sort((a, b) => parseFloat(a) - parseFloat(b));
    series.volumes = vList;
    series.last_updated = new Date().toISOString();

    await saveLibrary(myLibrary);
    playSound('powerup');
    showDetailById(seriesId);
}

async function updateStatus(id, newStatus) {
    playSound('toggle');
    const idx = myLibrary.findIndex(s => s.id === id);
    if (idx !== -1) {
        myLibrary[idx].status = newStatus;
        myLibrary[idx].last_updated = new Date().toISOString();
        await saveLibrary(myLibrary);
        showDetailById(id);
    }
}

async function addBook() {
    const title = document.getElementById('new-title').value.trim();
    const vol = document.getElementById('new-vol').value.trim();
    const cat = document.getElementById('new-category').value;
    
    if(!title || !vol) {
        playSound('delete');
        return alert("⚠️ Title and Volume are required to forge an entry!");
    }

    const saveBtn = document.getElementById('save-btn');
    const originalContent = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="spinner" style="width:16px; height:16px; border-width:2px; margin:0;"></div><span>FORGING...</span>';

    await new Promise(resolve => setTimeout(resolve, 250));

    const exist = myLibrary.find(s => s.title.toLowerCase() === title.toLowerCase());
    const now = new Date().toISOString();

    if (exist) {
        let vList = exist.volumes || [];
        if (vList.includes(vol)) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalContent;
            playSound('delete');
            return alert("⚠️ Volume already registered in your inventory!");
        }
        
        vList.push(vol);
        vList.sort((a, b) => parseFloat(a) - parseFloat(b));
        exist.volumes = vList;
        exist.last_updated = now;
        
        await saveLibrary(myLibrary);
        playSound('powerup');
        alert(`✨ Added Volume ${vol} to "${exist.title}" successfully!`);
    } else {
        const newSeries = {
            id: Date.now(),
            title: title,
            category: cat,
            volumes: [vol],
            status: 'yellow',
            last_updated: now,
            user_id: '6f9750bd-eace-4bf7-92d2-068033cc1bb7'
        };
        myLibrary.push(newSeries);
        await saveLibrary(myLibrary);
        playSound('powerup');
        alert(`🎉 Forged new series: "${title}" into shelf!`);
    }
    
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalContent;
    
    document.getElementById('new-title').value = '';
    document.getElementById('new-vol').value = '';
    initCraftPreview();
    fetchAllBooks();
}

async function deleteVolume(seriesId, volToDelete) {
    playSound('delete');
    if(!confirm(`⚠️ Confirm discard Volume ${volToDelete}?`)) return;

    const series = myLibrary.find(s => s.id === seriesId);
    if(!series) return;

    const updatedVolumes = series.volumes.filter(v => v.toString() !== volToDelete.toString());
    series.volumes = updatedVolumes;
    series.last_updated = new Date().toISOString();
    
    await saveLibrary(myLibrary);
    showDetailById(seriesId);
}

async function deleteSeries(id) {
    playSound('delete');
    if(confirm("⚠️ Confirm discard this entire series quest? This action cannot be undone.")) {
        const updatedLibrary = myLibrary.filter(s => s.id !== id);
        await saveLibrary(updatedLibrary);
        fetchAllBooks();
    }
}

function filterBooks(cat) { 
    displayLibrary(myLibrary.filter(s => s.category.toLowerCase() === cat.toLowerCase())); 
}

function searchBook() {
    const q = document.getElementById('search-input').value.toLowerCase();
    displayLibrary(myLibrary.filter(s => 
        s.title.toLowerCase().includes(q) || 
        s.category.toLowerCase().includes(q)
    ));
}

// Start App
checkUser();
