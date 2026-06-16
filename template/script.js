let myLibrary = [];
let currentDisplayData = [];

// --- Event Listeners Setup ---
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleLogin();
});
document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('logout-btn').addEventListener('click', handleLogout);
document.getElementById('save-btn').addEventListener('click', addBook);
document.getElementById('back-btn').addEventListener('click', () => {
    setActiveNav('nav-all');
    fetchAllBooks();
});
document.getElementById('nav-all').addEventListener('click', () => {
    setActiveNav('nav-all');
    fetchAllBooks();
});
document.getElementById('nav-comic').addEventListener('click', () => {
    setActiveNav('nav-comic');
    filterBooks('Comic');
});
document.getElementById('nav-novel').addEventListener('click', () => {
    setActiveNav('nav-novel');
    filterBooks('Novel');
});
document.getElementById('nav-ebook').addEventListener('click', () => {
    setActiveNav('nav-ebook');
    filterBooks('EBook');
});
document.getElementById('search-input').addEventListener('input', searchBook);

// Sync CSV button click handler
document.getElementById('sync-csv-btn').addEventListener('click', () => {
    if (confirm("Are you sure you want to reload all data from book_rows.csv? This will overwrite your current changes in local storage.")) {
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

// --- CSV Parser Helpers ---
function parseCSV(text) {
    const lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                row[row.length - 1] += '"'; // Escaped double quote
                i++;
            } else {
                inQuotes = !inQuotes; // Toggle quote state
            }
        } else if (char === ',' && !inQuotes) {
            row.push(''); // Next cell
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            // End of line
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
        if (row.length < headers.length) continue; // Skip incomplete lines
        
        let title = row[titleIdx];
        if (!title) continue;
        
        let category = row[categoryIdx] || 'Comic';
        // Normalize categories to match navigation filters
        const categoryLower = category.toLowerCase();
        if (categoryLower === 'comic') category = 'Comic';
        else if (categoryLower === 'novel') category = 'Novel';
        else if (categoryLower === 'ebook' || categoryLower === 'e-book') category = 'EBook';
        else category = 'Comic'; // Default fallback
        
        let status = row[statusIdx] || 'yellow';
        // Clean status from newlines and outer quotes
        status = status.replace(/[\r\n\t"]/g, '').trim().toLowerCase();
        if (status === 'green' || status === 'end') status = 'green';
        else if (status === 'red') status = 'red';
        else status = 'yellow';
        
        let volumes = [];
        const rawVolumes = row[volumesIdx];
        if (rawVolumes) {
            try {
                // Parse JSON array string
                volumes = JSON.parse(rawVolumes);
            } catch (e) {
                // Fallback for simple comma-separated lists
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

// Fallback seed data if book_rows.csv fails to fetch
function getFallbackSeedData() {
    return [
        {
            id: 1,
            title: "One Piece",
            category: "Comic",
            volumes: ["1", "2", "3", "99", "100", "101"],
            status: "yellow",
            last_updated: new Date().toISOString(),
            user_id: '6f9750bd-eace-4bf7-92d2-068033cc1bb7'
        },
        {
            id: 2,
            title: "Sherlock Holmes Vol. 1",
            category: "Novel",
            volumes: ["1"],
            status: "green",
            last_updated: new Date().toISOString(),
            user_id: '6f9750bd-eace-4bf7-92d2-068033cc1bb7'
        }
    ];
}

// --- CSV Loader ---
async function loadLibraryFromCSV(silent = false) {
    const listDiv = document.getElementById('book-list');
    if (!silent) {
        listDiv.innerHTML = `
            <div class="connection-status">
                <div class="spinner"></div>
                <span>Parsing book_rows.csv...</span>
            </div>`;
    }
    
    try {
        // Fetch from absolute root path /book_rows.csv to resolve correctly from sub-folders
        const response = await fetch('/book_rows.csv');
        if (!response.ok) throw new Error("Could not fetch book_rows.csv file from workspace.");
        
        const text = await response.text();
        const csvLines = parseCSV(text);
        const library = convertCSVToLibrary(csvLines);
        
        await saveLibrary(library);
        
        if (!silent) {
            alert(`Successfully loaded ${library.length} books from CSV!`);
        }
        displayLibrary(library);
    } catch (error) {
        console.error("Error loading CSV:", error);
        if (!silent) {
            alert("Error loading CSV: " + error.message);
        }
        
        // Fallback seed if local storage is empty
        if (!localStorage.getItem('my_shelf_library')) {
            const seedData = getFallbackSeedData();
            await saveLibrary(seedData);
            displayLibrary(seedData);
        }
    }
}

// --- Combined Storage and Server Writer ---
async function saveLibrary(library) {
    // Save to local cache first
    localStorage.setItem('my_shelf_library', JSON.stringify(library));
    myLibrary = library;
    
    // Save back to backend server if running (which edits book_rows.csv)
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
        console.warn("Could not sync with local server API. Saved offline in browser localStorage.", error);
    }
}

// --- Auth (Local Storage Auth Simulation) ---
function checkUser() {
    const userEmail = localStorage.getItem('my_shelf_user');
    if (userEmail) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        document.getElementById('display-user').innerText = `${userEmail} (Local Dev)`;
        fetchAllBooks();
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
    lucide.createIcons();
}

async function handleLogin() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!email || !password) return;
    
    // Disable inputs and show loading state
    const btn = document.getElementById('login-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Signing in...</span><div class="spinner" style="width:16px; height:16px; border-width:2px; margin:0;"></div>';
    
    // Simulate database delay
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Store user session locally (Accepts any password during development)
    localStorage.setItem('my_shelf_user', email);
    
    // Re-enable button
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
            <span>Fetching collection...</span>
        </div>`;
    
    // Simulate brief storage retrieval delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Try contacting server API first
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
        console.log("Could not reach Server API. Falling back to Local Storage cache.");
    }
    
    // Local storage fallback
    const data = localStorage.getItem('my_shelf_library');
    if (!data) {
        // If local storage is empty, read from the CSV file dynamically!
        await loadLibraryFromCSV(true);
    } else {
        myLibrary = JSON.parse(data);
        displayLibrary(myLibrary);
    }
}

// --- Display Logic ---
function displayLibrary(data) {
    currentDisplayData = data;
    const listDiv = document.getElementById('book-list');
    document.getElementById('back-btn').style.display = 'none';
    
    if (data.length === 0) {
        listDiv.innerHTML = `
            <div class="empty-state">
                <i data-lucide="book-x" style="width:48px; height:48px; color:var(--text-muted); margin-bottom:16px;"></i>
                <p>No books found in this category.</p>
            </div>`;
        lucide.createIcons();
        return;
    }
    
    let html = '<div class="grid-container">';
    data.forEach((series) => {
        let label = 'ONGOING', cls = 'status-yellow';
        if (series.status === 'green' || series.status === 'end') { 
            label = 'DONE'; 
            cls = 'status-green'; 
        } else if (series.status === 'red') { 
            label = 'STOP'; 
            cls = 'status-red'; 
        }

        html += `
            <div class="series-card" onclick="showDetailById(${series.id})">
                <div class="card-top">
                    <div class="card-title" title="${series.title}">${series.title}</div>
                    <div class="card-info">
                        <span>${series.category}</span>
                        <span class="card-info-dot"></span>
                        <span>${series.volumes ? series.volumes.length : 0} Vols</span>
                    </div>
                </div>
                <div class="card-bottom">
                    <span class="status-badge ${cls}">${label}</span>
                </div>
            </div>`;
    });
    html += '</div>';
    listDiv.innerHTML = html;
    lucide.createIcons();
}

function showDetailById(id) {
    const series = myLibrary.find(s => s.id === id);
    if (!series) return;

    const listDiv = document.getElementById('book-list');
    document.getElementById('back-btn').style.display = 'inline-flex';
    
    const curStatus = series.status || 'yellow';
    const updatedDate = new Date(series.last_updated || series.created_at || new Date()).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    listDiv.innerHTML = `
        <div class="glass-card detail-card" style="padding:32px; max-width: 800px; margin: 0 auto;">
            <div class="detail-header">
                <div class="detail-title-section">
                    <h2>${series.title}</h2>
                    <span class="detail-meta-category">${series.category}</span>
                </div>
            </div>

            <div class="status-toggle-container">
                <div class="st-btn ${curStatus==='yellow'?'active':''}" onclick="updateStatus(${series.id}, 'yellow')">ONGOING</div>
                <div class="st-btn ${curStatus==='green'||curStatus==='end'?'active':''}" onclick="updateStatus(${series.id}, 'green')">DONE</div>
                <div class="st-btn ${curStatus==='red'?'active':''}" onclick="updateStatus(${series.id}, 'red')">STOP</div>
            </div>

            <input type="text" id="vol-search" class="vol-search-bar" placeholder="🔍 Search owned volumes..." oninput="filterVolTable(${series.id})">

            <div id="vol-table-container">
                ${renderVolTable(series.id, series.volumes)}
            </div>

            <div class="detail-footer">
                <span class="last-updated-text">Last Sync: ${updatedDate}</span>
                <button onclick="deleteSeries(${series.id})" class="btn btn-danger-outline">
                    <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                    <span>Delete Entire Series</span>
                </button>
            </div>
        </div>
    `;
    lucide.createIcons();
}

function renderVolTable(seriesId, volumes, filter = '') {
    const vList = volumes || [];
    const filtered = vList
        .filter(v => v.toString().includes(filter))
        .sort((a, b) => parseFloat(a) - parseFloat(b));

    if (filtered.length === 0) {
        return '<p style="color:var(--text-secondary); padding:24px; text-align:center;">No volumes found.</p>';
    }

    let html = `
        <div class="vol-table-wrapper">
            <table class="vol-table">
                <thead>
                    <tr>
                        <th>Volume No.</th>
                        <th>Status</th>
                        <th style="text-align:right;">Actions</th>
                    </tr>
                </thead>
                <tbody>`;
    
    filtered.forEach(v => {
        html += `
            <tr>
                <td>Volume ${v}</td>
                <td>
                    <span style="display:inline-flex; align-items:center; gap:6px; color:var(--status-green-color); font-weight:600; font-size:0.85rem;">
                        <i data-lucide="check-circle" style="width:14px; height:14px;"></i>
                        Owned
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

function filterVolTable(id) {
    const q = document.getElementById('vol-search').value;
    const series = myLibrary.find(s => s.id === id);
    if(series) {
        document.getElementById('vol-table-container').innerHTML = renderVolTable(series.id, series.volumes, q);
        lucide.createIcons();
    }
}

// --- Action Logic ---

async function updateStatus(id, newStatus) {
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
    
    if(!title || !vol) return alert("Title and Volume are required!");

    const saveBtn = document.getElementById('save-btn');
    const originalContent = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="spinner" style="width:16px; height:16px; border-width:2px; margin:0;"></div><span>Saving...</span>';

    // Simulate short network delay for modern UI feel
    await new Promise(resolve => setTimeout(resolve, 300));

    const exist = myLibrary.find(s => s.title.toLowerCase() === title.toLowerCase());
    const now = new Date().toISOString();

    if (exist) {
        let vList = exist.volumes || [];
        if (vList.includes(vol)) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalContent;
            return alert("You already own this volume!");
        }
        
        vList.push(vol);
        vList.sort((a, b) => parseFloat(a) - parseFloat(b));
        exist.volumes = vList;
        exist.last_updated = now;
        
        await saveLibrary(myLibrary);
        alert(`Added Volume ${vol} to "${exist.title}" successfully!`);
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
        alert(`Added new series: "${title}" successfully!`);
    }
    
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalContent;
    
    document.getElementById('new-title').value = '';
    document.getElementById('new-vol').value = '';
    fetchAllBooks();
}

async function deleteVolume(seriesId, volToDelete) {
    if(!confirm(`Confirm delete Volume ${volToDelete}?`)) return;

    const series = myLibrary.find(s => s.id === seriesId);
    if(!series) return;

    const updatedVolumes = series.volumes.filter(v => v.toString() !== volToDelete.toString());
    series.volumes = updatedVolumes;
    series.last_updated = new Date().toISOString();
    
    await saveLibrary(myLibrary);
    showDetailById(seriesId);
}

async function deleteSeries(id) {
    if(confirm("Confirm delete this entire series? This action cannot be undone.")) {
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
