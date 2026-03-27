const SUPABASE_URL = 'https://iesaxrdexywsegppjbxo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9Rxgo8i46-CxS5-vRHmIUQ_fiqTQn1T';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let myLibrary = [];
let currentDisplayData = [];

// --- Events ---
document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('logout-btn').addEventListener('click', () => { _supabase.auth.signOut(); checkUser(); });
document.getElementById('save-btn').addEventListener('click', addBook);
document.getElementById('back-btn').addEventListener('click', fetchAllBooks);
document.getElementById('nav-all').addEventListener('click', fetchAllBooks);
document.getElementById('nav-comic').addEventListener('click', () => filterBooks('Comic'));
document.getElementById('nav-novel').addEventListener('click', () => filterBooks('Novel'));
document.getElementById('nav-ebook').addEventListener('click', () => filterBooks('EBook'));
document.getElementById('search-input').addEventListener('input', searchBook);

// --- Auth & Initial Fetch ---
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
    if (!error) { 
        myLibrary = data; 
        displayLibrary(myLibrary); 
    }
}

// --- Display Logic ---
function displayLibrary(data) {
    currentDisplayData = data;
    const listDiv = document.getElementById('book-list');
    document.getElementById('back-btn').style.display = 'none';
    
    let html = '<div class="grid-container">';
    data.forEach((series) => {
        let label = 'ONGOING', cls = 'status-yellow';
        if (series.status === 'green' || series.status === 'end') { label = 'DONE'; cls = 'status-green'; }
        else if (series.status === 'red') { label = 'STOP'; cls = 'status-red'; }

        // ส่ง ID เข้าไปแทน Index เพื่อความแม่นยำ
        html += `
            <div class="series-card" onclick="showDetailById(${series.id})">
                <div class="card-title">${series.title}</div>
                <div class="card-info">${series.category} | ${series.volumes ? series.volumes.length : 0} Vols</div>
                <div class="status-badge ${cls}">${label}</div>
            </div>`;
    });
    html += '</div>';
    listDiv.innerHTML = data.length > 0 ? html : '<p>No books found.</p>';
}

function showDetailById(id) {
    const series = myLibrary.find(s => s.id === id);
    if (!series) return;

    const listDiv = document.getElementById('book-list');
    document.getElementById('back-btn').style.display = 'block';
    
    const curStatus = series.status || 'yellow';

    listDiv.innerHTML = `
        <div style="background:#fff; padding:30px; border-radius:15px; border:1px solid #ddd; max-width: 800px; margin: 0 auto;">
            <h2 style="color:var(--accent); margin-top:0;">${series.title}</h2>
            <p style="color:#666;">หมวดหมู่: ${series.category}</p>

            <div class="status-toggle-container">
                <div class="st-btn ${curStatus==='yellow'?'active':''}" onclick="updateStatus(${series.id}, 'yellow')">ONGOING</div>
                <div class="st-btn ${curStatus==='green'||curStatus==='end'?'active':''}" onclick="updateStatus(${series.id}, 'green')">DONE</div>
                <div class="st-btn ${curStatus==='red'?'active':''}" onclick="updateStatus(${series.id}, 'red')">STOP</div>
            </div>

            <input type="text" id="vol-search" class="vol-search-bar" placeholder="🔍 ค้นหาเลขเล่ม..." oninput="filterVolTable(${series.id})">

            <div id="vol-table-container">
                ${renderVolTable(series.id, series.volumes)}
            </div>

            <hr style="margin-top:30px; border:0; border-top:1px solid #eee;">
            <button onclick="deleteSeries(${series.id})" style="margin-top:10px; background:none; color:#d93025; border:none; cursor:pointer; font-size:0.85rem; text-decoration:underline;">
                ❌ ลบทั้งซีรีส์ (Delete Entire Series)
            </button>
        </div>
    `;
}

function renderVolTable(seriesId, volumes, filter = '') {
    const vList = volumes || [];
    const filtered = vList
        .filter(v => v.toString().includes(filter))
        .sort((a, b) => parseFloat(a) - parseFloat(b));

    if(filtered.length === 0) return '<p style="color:#999; padding:20px; text-align:center;">ไม่พบเล่มที่ระบุ</p>';

    let html = '<table class="vol-table"><thead><tr><th>เล่มที่</th><th>สถานะ</th><th style="text-align:right;">จัดการ</th></tr></thead><tbody>';
    filtered.forEach(v => {
        html += `
            <tr>
                <td>Volume ${v}</td>
                <td style="color:#1e8e3e; font-weight:bold;">✅ Owned</td>
                <td style="text-align:right;">
                    <button onclick="deleteVolume(${seriesId}, '${v}')" style="background:none; border:none; color:#d93025; cursor:pointer; font-size:1.1rem;">🗑️</button>
                </td>
            </tr>`;
    });
    return html + '</tbody></table>';
}

function filterVolTable(id) {
    const q = document.getElementById('vol-search').value;
    const series = myLibrary.find(s => s.id === id);
    if(series) {
        document.getElementById('vol-table-container').innerHTML = renderVolTable(series.id, series.volumes, q);
    }
}

// --- Action Logic ---

async function updateStatus(id, newStatus) {
    const { error } = await _supabase.from('book').update({ status: newStatus }).eq('id', id);
    if (!error) {
        const idx = myLibrary.findIndex(s => s.id === id);
        myLibrary[idx].status = newStatus;
        showDetailById(id);
    }
}

async function addBook() {
    const title = document.getElementById('new-title').value.trim();
    const vol = document.getElementById('new-vol').value.trim();
    const cat = document.getElementById('new-category').value;
    
    if(!title || !vol) return alert("กรุณาใส่ชื่อและเล่ม!");

    // 1. ดึงข้อมูลล่าสุดจาก DB โดยตรงเพื่อความแม่นยำ (ป้องกัน ID ซ้ำ)
    const { data: exist } = await _supabase
        .from('book')
        .select('*')
        .ilike('title', title) // ค้นหาชื่อแบบไม่สนใจตัวพิมพ์เล็ก/ใหญ่
        .single();

    const now = new Date().toISOString();

    if(exist) {
        // --- กรณีมีหนังสือเรื่องนี้อยู่แล้ว (UPDATE) ---
        let vList = exist.volumes || [];
        if(vList.includes(vol)) return alert("คุณมีเล่มนี้อยู่แล้ว!");
        
        vList.push(vol);
        vList.sort((a, b) => parseFloat(a) - parseFloat(b));
        
        const { error } = await _supabase
            .from('book')
            .update({ volumes: vList, last_updated: now })
            .eq('id', exist.id); // ระบุ ID ให้ชัดเจน

        if(error) return alert("Update Error: " + error.message);
    } else {
        // --- กรณีเป็นเรื่องใหม่ (INSERT) ---
        // ไม่ต้องส่งค่า id ไป ให้ Supabase เจนให้เอง
        const { error } = await _supabase
            .from('book')
            .insert([{ 
                title: title, 
                category: cat, 
                volumes: [vol], 
                status: 'yellow', 
                last_updated: now 
            }]);

        if(error) return alert("Insert Error: " + error.message);
    }
    
    alert("บันทึกเรียบร้อย!");
    document.getElementById('new-title').value = '';
    document.getElementById('new-vol').value = '';
    fetchAllBooks();
}

async function deleteVolume(seriesId, volToDelete) {
    if(!confirm(`ยืนยันการลบเล่มที่ ${volToDelete}?`)) return;

    const series = myLibrary.find(s => s.id === seriesId);
    if(!series) return;

    const updatedVolumes = series.volumes.filter(v => v.toString() !== volToDelete.toString());

    const { error } = await _supabase.from('book').update({ volumes: updatedVolumes }).eq('id', seriesId);
    
    if(!error) {
        series.volumes = updatedVolumes; 
        showDetailById(seriesId);
    }
}

async function deleteSeries(id) {
    if(confirm("ยืนยันการลบทั้งซีรีส์? ข้อมูลทั้งหมดจะหายไปและกู้คืนไม่ได้")) {
        const { error } = await _supabase.from('book').delete().eq('id', id);
        if(!error) fetchAllBooks();
    }
}

function filterBooks(cat) { 
    displayLibrary(myLibrary.filter(s => s.category.toLowerCase() === cat.toLowerCase())); 
}

function searchBook() {
    const q = document.getElementById('search-input').value.toLowerCase();
    displayLibrary(myLibrary.filter(s => s.title.toLowerCase().includes(q)));
}

// Start App
checkUser();