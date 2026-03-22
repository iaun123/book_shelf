const SUPABASE_URL = 'https://iesaxrdexywsegppjbxo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9Rxgo8i46-CxS5-vRHmIUQ_fiqTQn1T';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let myLibrary = [];
let currentDisplayData = [];

// Event Listeners
document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('logout-btn').addEventListener('click', () => { _supabase.auth.signOut(); checkUser(); });
document.getElementById('save-btn').addEventListener('click', addBook);
document.getElementById('back-btn').addEventListener('click', fetchAllBooks);
document.getElementById('nav-all').addEventListener('click', fetchAllBooks);
document.getElementById('nav-comic').addEventListener('click', () => filterBooks('Comic'));
document.getElementById('nav-novel').addEventListener('click', () => filterBooks('Novel'));
document.getElementById('nav-ebook').addEventListener('click', () => filterBooks('EBook'));
document.getElementById('search-input').addEventListener('input', searchBook);

async function checkUser() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        document.getElementById('display-user').innerText = user.email;
        fetchAllBooks();
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
}

async function handleLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const { error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message); else checkUser();
}

async function fetchAllBooks() {
    const { data, error } = await _supabase.from('book').select('*').order('title', { ascending: true });
    if (!error) { myLibrary = data; displayLibrary(myLibrary); }
}

function displayLibrary(data) {
    currentDisplayData = data;
    const listDiv = document.getElementById('book-list');
    document.getElementById('back-btn').style.display = 'none';
    
    let html = '<div class="grid-container">';
    data.forEach((series, index) => {
        let statusLabel = 'ONGOING', statusClass = 'status-yellow';
        if (series.status === 'green' || series.status === 'end') { statusLabel = 'DONE'; statusClass = 'status-green'; }
        else if (series.status === 'red') { statusLabel = 'STOP'; statusClass = 'status-red'; }

        html += `
            <div class="series-card" onclick="showDetail(${index})">
                <div class="card-title">${series.title}</div>
                <div class="card-info">${series.category} | ${series.volumes ? series.volumes.length : 0} Vols</div>
                <div class="status-badge ${statusClass}">${statusLabel}</div>
            </div>`;
    });
    html += '</div>';
    listDiv.innerHTML = data.length > 0 ? html : '<p>Empty Collection</p>';
}

function showDetail(index) {
    const series = currentDisplayData[index];
    const listDiv = document.getElementById('book-list');
    document.getElementById('back-btn').style.display = 'block';
    
    // Status Logic for Detail View
    const currentStatus = series.status || 'yellow';

    listDiv.innerHTML = `
        <div style="background:#fff; padding:25px; border-radius:12px; border:1px solid #ddd;">
            <h2>${series.title}</h2>
            <p style="color:#666;">Category: ${series.category}</p>

            <div class="status-toggle-container">
                <div class="st-btn ${currentStatus==='yellow'?'active':''}" data-val="yellow" onclick="updateStatus(${series.id}, 'yellow')">ONGOING</div>
                <div class="st-btn ${currentStatus==='green'||currentStatus==='end'?'active':''}" data-val="green" onclick="updateStatus(${series.id}, 'green')">DONE</div>
                <div class="st-btn ${currentStatus==='red'?'active':''}" data-val="red" onclick="updateStatus(${series.id}, 'red')">STOP</div>
            </div>

            <input type="text" id="vol-search" class="vol-search-input" placeholder="🔍 Find volume number..." oninput="filterVolTable('${series.id}')">

            <div id="vol-table-container">
                ${renderVolTable(series.volumes)}
            </div>

            <button onclick="deleteSeries(${series.id})" style="margin-top:30px; background:#fce8e6; color:#d93025; border:1px solid #d93025; padding:10px; width:100%; border-radius:6px; cursor:pointer;">Delete Entire Series</button>
        </div>
    `;
}

function renderVolTable(volumes, filter = '') {
    const filtered = (volumes || []).filter(v => v.includes(filter)).sort((a,b) => parseFloat(a)-parseFloat(b));
    if (filtered.length === 0) return '<p style="text-align:center; padding:20px; color:#999;">No volumes match your search.</p>';
    
    let html = '<table class="vol-table"><thead><tr><th>Volume</th><th>Status</th></tr></thead><tbody>';
    filtered.forEach(v => { html += `<tr><td>Volume ${v}</td><td style="color:#28a745; font-weight:bold; text-align:right;">✅ Owned</td></tr>`; });
    return html + '</tbody></table>';
}

function filterVolTable(id) {
    const q = document.getElementById('vol-search').value;
    const series = myLibrary.find(s => s.id.toString() === id);
    document.getElementById('vol-table-container').innerHTML = renderVolTable(series.volumes, q);
}

async function updateStatus(id, newStatus) {
    const { error } = await _supabase.from('book').update({ status: newStatus }).eq('id', id);
    if (!error) {
        // Find in local array and update UI instantly
        const idx = myLibrary.findIndex(s => s.id === id);
        myLibrary[idx].status = newStatus;
        showDetail(currentDisplayData.findIndex(s => s.id === id)); 
    }
}

async function addBook() {
    const title = document.getElementById('new-title').value.trim();
    const vol = document.getElementById('new-vol').value.trim();
    const cat = document.getElementById('new-category').value;
    if(!title || !vol) return alert("Fill in title and volume");

    let exist = myLibrary.find(s => s.title.toLowerCase() === title.toLowerCase());
    const now = new Date().toISOString();

    if(exist) {
        let updatedVols = exist.volumes || [];
        if(!updatedVols.includes(vol)) updatedVols.push(vol);
        await _supabase.from('book').update({ volumes: updatedVols, last_updated: now }).eq('id', exist.id);
    } else {
        await _supabase.from('book').insert([{ title, category: cat, volumes: [vol], status: 'yellow', last_updated: now }]);
    }
    fetchAllBooks();
}

async function deleteSeries(id) {
    if(confirm("Are you sure? This will remove the whole series.")) {
        await _supabase.from('book').delete().eq('id', id);
        fetchAllBooks();
    }
}

function filterBooks(cat) { displayLibrary(myLibrary.filter(s => s.category === cat)); }
function searchBook() {
    const q = document.getElementById('search-input').value.toLowerCase();
    displayLibrary(myLibrary.filter(s => s.title.toLowerCase().includes(q)));
}

checkUser();