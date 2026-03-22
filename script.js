const SUPABASE_URL = 'https://iesaxrdexywsegppjbxo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9Rxgo8i46-CxS5-vRHmIUQ_fiqTQn1T';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let myLibrary = [];
let currentDisplayData = [];
let selectedStatus = 'yellow'; // Default Status

// --- Status Picker Logic ---
document.querySelectorAll('.status-opt').forEach(opt => {
    opt.addEventListener('click', function() {
        document.querySelectorAll('.status-opt').forEach(el => el.classList.remove('active'));
        this.classList.add('active');
        selectedStatus = this.getAttribute('data-val');
    });
});

// --- Event Listeners ---
document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('logout-btn').addEventListener('click', () => { _supabase.auth.signOut(); checkUser(); });
document.getElementById('save-btn').addEventListener('click', addBook);
document.getElementById('back-btn').addEventListener('click', fetchAllBooks);
document.getElementById('nav-all').addEventListener('click', fetchAllBooks);
document.getElementById('nav-comic').addEventListener('click', () => filterBooks('Comic'));
document.getElementById('nav-novel').addEventListener('click', () => filterBooks('Novel'));
document.getElementById('nav-ebook').addEventListener('click', () => filterBooks('E-Book'));
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
    listDiv.innerHTML = data.length > 0 ? html : '<p>No series found.</p>';
}

function showDetail(index) {
    const series = currentDisplayData[index];
    const listDiv = document.getElementById('book-list');
    document.getElementById('back-btn').style.display = 'block';
    
    listDiv.innerHTML = `
        <div style="background:#fff; padding:30px; border-radius:12px; border:1px solid #ddd;">
            <h2>${series.title}</h2>
            <p>Category: ${series.category} | Status: ${series.status || 'Ongoing'}</p>
            <table class="vol-table">
                <thead><tr><th>Volume</th><th>Status</th></tr></thead>
                <tbody>${series.volumes.map(v => `<tr><td>Volume ${v}</td><td>✅ Owned</td></tr>`).join('')}</tbody>
            </table>
            <button onclick="deleteSeries(${series.id})" style="margin-top:20px; background:#dc3545; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; width:100%;">Delete Series</button>
        </div>
    `;
}

async function addBook() {
    const title = document.getElementById('new-title').value.trim();
    const vol = document.getElementById('new-vol').value.trim();
    const cat = document.getElementById('new-category').value;
    if(!title || !vol) return alert("Title and Volume required");

    let exist = myLibrary.find(s => s.title.toLowerCase() === title.toLowerCase());
    const now = new Date().toISOString();

    if(exist) {
        let updatedVols = exist.volumes || [];
        if(!updatedVols.includes(vol)) updatedVols.push(vol);
        await _supabase.from('book').update({ volumes: updatedVols, status: selectedStatus, last_updated: now }).eq('id', exist.id);
    } else {
        await _supabase.from('book').insert([{ title, category: cat, volumes: [vol], status: selectedStatus, last_updated: now }]);
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