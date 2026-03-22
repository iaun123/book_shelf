const SUPABASE_URL = 'https://iesaxrdexywsegppjbxo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9Rxgo8i46-CxS5-vRHmIUQ_fiqTQn1T';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let myLibrary = [];
let currentDisplayData = [];

// --- Event Listeners ---
document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('logout-btn').addEventListener('click', handleLogout);
document.getElementById('save-btn').addEventListener('click', addBook);
document.getElementById('back-btn').addEventListener('click', fetchAllBooks);
document.getElementById('nav-all').addEventListener('click', fetchAllBooks);
document.getElementById('nav-comic').addEventListener('click', () => filterBooks('Comic'));
document.getElementById('nav-novel').addEventListener('click', () => filterBooks('Novel'));
document.getElementById('nav-ebook').addEventListener('click', () => filterBooks('EBook'));
document.getElementById('search-input').addEventListener('input', searchBook);

// --- Functions ---
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
    if(!email || !password) return alert("Please fill info");
    
    const { error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message); else checkUser();
}

async function handleLogout() {
    await _supabase.auth.signOut();
    checkUser();
}

async function fetchAllBooks() {
    const listDiv = document.getElementById('book-list');
    listDiv.innerHTML = "Fetching...";
    const { data, error } = await _supabase.from('book').select('*').order('title', { ascending: true });
    if (!error) { myLibrary = data; displayLibrary(myLibrary); }
}

function displayLibrary(data) {
    currentDisplayData = data;
    const listDiv = document.getElementById('book-list');
    document.getElementById('back-btn').style.display = 'none';
    
    let html = '<div class="grid-container">';
    data.forEach((series, index) => {
        html += `
            <div class="series-card" onclick="showDetail(${index})">
                <div class="card-title">${series.title}</div>
                <div class="card-info">${series.category} | ${series.volumes ? series.volumes.length : 0} Vols</div>
            </div>`;
    });
    html += '</div>';
    listDiv.innerHTML = data.length > 0 ? html : '<p>Empty Collection</p>';
}

function showDetail(index) {
    const series = currentDisplayData[index];
    const listDiv = document.getElementById('book-list');
    document.getElementById('back-btn').style.display = 'block';
    
    const dateStr = series.last_updated ? new Date(series.last_updated).toLocaleDateString('th-TH') : 'N/A';

    listDiv.innerHTML = `
        <div class="detail-view">
            <div class="detail-header">
                <span>Category: <b>${series.category}</b></span>
                <span style="color:#666">Updated: ${dateStr}</span>
            </div>
            <input type="text" id="vol-search" placeholder="🔍 ค้นหาเล่ม..." 
                oninput="filterVolTable('${series.id}')" class="inner-search">
            <div id="vol-table-container">${renderVolTable(series.volumes)}</div>
            <button onclick="deleteSeries(${series.id})" class="del-btn">Delete Series</button>
        </div>
    `;
}

function renderVolTable(volumes, filter = '') {
    const filtered = volumes.filter(v => v.includes(filter)).sort((a,b) => a-b);
    let html = '<table class="vol-table"><thead><tr><th>Volume</th><th>Status</th></tr></thead><tbody>';
    filtered.forEach(v => {
        html += `<tr><td>เล่มที่ ${v}</td><td class="status-ok">✅ มีแล้ว</td></tr>`;
    });
    return html + '</tbody></table>';
}

function filterVolTable(id) {
    const q = document.getElementById('vol-search').value;
    const series = myLibrary.find(s => s.id.toString() === id);
    document.getElementById('vol-table-container').innerHTML = renderVolTable(series.volumes, q);
}

async function addBook() {
    const title = document.getElementById('new-title').value;
    const vol = document.getElementById('new-vol').value;
    const cat = document.getElementById('new-category').value;
    if(!title || !vol) return;

    const now = new Date().toISOString();
    let exist = myLibrary.find(s => s.title.toLowerCase() === title.toLowerCase());

    if(exist) {
        if(!exist.volumes.includes(vol)) {
            await _supabase.from('book').update({ volumes: [...exist.volumes, vol], last_updated: now }).eq('id', exist.id);
        }
    } else {
        await _supabase.from('book').insert([{ title, category: cat, volumes: [vol], last_updated: now }]);
    }
    fetchAllBooks();
}

async function deleteSeries(id) {
    if(confirm("Delete?")) {
        await _supabase.from('book').delete().eq('id', id);
        fetchAllBooks();
    }
}

function filterBooks(cat) { displayLibrary(myLibrary.filter(s => s.category === cat)); }

function searchBook() {
    const q = document.getElementById('search-input').value.toLowerCase();
    displayLibrary(myLibrary.filter(s => s.title.toLowerCase().includes(q)));
}

// Start
checkUser();