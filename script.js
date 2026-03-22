const SUPABASE_URL = 'https://iesaxrdexywsegppjbxo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9Rxgo8i46-CxS5-vRHmIUQ_fiqTQn1T';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let myLibrary = [];
let currentDisplayData = [];

// Events
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
        let label = 'ONGOING', cls = 'status-yellow';
        if (series.status === 'green' || series.status === 'end') { label = 'DONE'; cls = 'status-green'; }
        else if (series.status === 'red') { label = 'STOP'; cls = 'status-red'; }

        html += `
            <div class="series-card" onclick="showDetail(${index})">
                <div class="card-title">${series.title}</div>
                <div class="card-info">${series.category} | ${series.volumes ? series.volumes.length : 0} Vols</div>
                <div class="status-badge ${cls}">${label}</div>
            </div>`;
    });
    html += '</div>';
    listDiv.innerHTML = data.length > 0 ? html : '<p>No books found.</p>';
}

function showDetail(index) {
    const series = currentDisplayData[index];
    const listDiv = document.getElementById('book-list');
    document.getElementById('back-btn').style.display = 'block';
    
    const curStatus = series.status || 'yellow';

    listDiv.innerHTML = `
        <div style="background:#fff; padding:30px; border-radius:15px; border:1px solid #ddd; max-width: 800px;">
            <h2 style="color:var(--accent); margin-top:0;">${series.title}</h2>
            <p style="color:#666;">Category: ${series.category}</p>

            <div class="status-toggle-container">
                <div class="st-btn ${curStatus==='yellow'?'active':''}" data-val="yellow" onclick="updateStatus(${series.id}, 'yellow')">ONGOING</div>
                <div class="st-btn ${curStatus==='green'||curStatus==='end'?'active':''}" data-val="green" onclick="updateStatus(${series.id}, 'green')">DONE</div>
                <div class="st-btn ${curStatus==='red'?'active':''}" data-val="red" onclick="updateStatus(${series.id}, 'red')">STOP</div>
            </div>

            <input type="text" id="vol-search" class="vol-search-bar" placeholder="🔍 Find volume number (e.g. 5)..." oninput="filterVolTable('${series.id}')">

            <div id="vol-table-container">
                ${renderVolTable(series.volumes)}
            </div>

            <button onclick="deleteSeries(${series.id})" style="margin-top:30px; background:none; color:#d93025; border:none; cursor:pointer; font-size:0.8rem; text-decoration:underline;">Delete Entire Series</button>
        </div>
    `;
}

function renderVolTable(volumes, filter = '') {
    const vList = volumes || [];
    const filtered = vList.filter(v => v.toString().includes(filter)).sort((a,b) => parseFloat(a)-parseFloat(b));
    if(filtered.length === 0) return '<p style="color:#999; padding:20px; text-align:center;">No volumes found.</p>';

    let html = '<table class="vol-table"><thead><tr><th>Volume Name / No.</th><th>Status</th></tr></thead><tbody>';
    filtered.forEach(v => {
        html += `<tr><td>Volume ${v}</td><td style="color:#1e8e3e; font-weight:bold; text-align:right;">✅ Owned</td></tr>`;
    });
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
        const idx = myLibrary.findIndex(s => s.id === id);
        myLibrary[idx].status = newStatus;
        showDetail(currentDisplayData.findIndex(s => s.id === id));
    }
}

async function addBook() {
    const title = document.getElementById('new-title').value.trim();
    const vol = document.getElementById('new-vol').value.trim();
    const cat = document.getElementById('new-category').value;
    if(!title || !vol) return alert("Title and Volume are required!");

    let exist = myLibrary.find(s => s.title.toLowerCase() === title.toLowerCase());
    const now = new Date().toISOString();

    if(exist) {
        let vList = exist.volumes || [];
        if(!vList.includes(vol)) vList.push(vol);
        await _supabase.from('book').update({ volumes: vList, last_updated: now }).eq('id', exist.id);
    } else {
        await _supabase.from('book').insert([{ title, category: cat, volumes: [vol], status: 'yellow', last_updated: now }]);
    }
    fetchAllBooks();
    document.getElementById('new-title').value = '';
    document.getElementById('new-vol').value = '';
}

async function deleteSeries(id) {
    if(confirm("Confirm to delete this series?")) {
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