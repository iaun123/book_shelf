const SUPABASE_URL = 'https://iesaxrdexywsegppjbxo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9Rxgo8i46-CxS5-vRHmIUQ_fiqTQn1T';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let myLibrary = [];
let currentDisplayData = [];

// Event Listeners
document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('logout-btn').addEventListener('click', handleLogout);
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

async function handleLogout() { await _supabase.auth.signOut(); checkUser(); }

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
        // Handle Status Badge
        const statusLabel = series.status === 'end' ? 'COMPLETED' : 'ONGOING';
        const statusClass = series.status === 'end' ? 'status-end' : 'status-ongoing';

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
    
    const dateStr = series.last_updated ? new Date(series.last_updated).toLocaleDateString('en-GB') : 'N/A';
    const statusText = series.status === 'end' ? 'Completed Collection' : 'Still Collecting';

    listDiv.innerHTML = `
        <div class="detail-view">
            <div class="detail-header">
                <div>
                    <b>Category:</b> ${series.category} | <b>Status:</b> ${statusText}
                </div>
                <div style="color:#666; font-size: 0.8rem;">Last Updated: ${dateStr}</div>
            </div>
            <input type="text" id="vol-search" placeholder="🔍 Search volumes..." oninput="filterVolTable('${series.id}')" class="inner-search" style="width:100%; padding:10px; margin: 15px 0; border: 1px solid #ddd; border-radius: 8px;">
            <div id="vol-table-container">${renderVolTable(series.volumes)}</div>
            <button onclick="deleteSeries(${series.id})" class="del-btn" style="background:#dc3545; color:white; border:none; padding:10px; width:100%; border-radius:8px; margin-top:20px; cursor:pointer;">Delete Series</button>
        </div>
    `;
}

function renderVolTable(volumes, filter = '') {
    const filtered = volumes.filter(v => v.includes(filter)).sort((a,b) => parseFloat(a)-parseFloat(b));
    let html = '<table class="vol-table"><thead><tr><th>Volume</th><th>Status</th></tr></thead><tbody>';
    filtered.forEach(v => { html += `<tr><td>Volume ${v}</td><td class="status-ok">✅ Owned</td></tr>`; });
    return html + '</tbody></table>';
}

function filterVolTable(id) {
    const q = document.getElementById('vol-search').value;
    const series = myLibrary.find(s => s.id.toString() === id);
    document.getElementById('vol-table-container').innerHTML = renderVolTable(series.volumes, q);
}

async function addBook() {
    const title = document.getElementById('new-title').value.trim();
    const vol = document.getElementById('new-vol').value.trim();
    const cat = document.getElementById('new-category').value;
    const status = document.getElementById('new-status').value; // Get status value
    
    if(!title || !vol) return alert("Enter title and volume");

    const now = new Date().toISOString();
    let exist = myLibrary.find(s => s.title.toLowerCase() === title.toLowerCase());

    if(exist) {
        if(!exist.volumes.includes(vol)) {
            const updatedVols = [...exist.volumes, vol];
            // Update volumes and also update status
            await _supabase.from('book').update({ volumes: updatedVols, last_updated: now, status: status }).eq('id', exist.id);
        } else {
            // Even if volume exists, user might want to update status
            await _supabase.from('book').update({ last_updated: now, status: status }).eq('id', exist.id);
        }
    } else {
        await _supabase.from('book').insert([{ title, category: cat, volumes: [vol], last_updated: now, status: status }]);
    }
    fetchAllBooks();
}

async function deleteSeries(id) {
    if(confirm("Delete this series?")) {
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