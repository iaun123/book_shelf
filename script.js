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

/**
 * Checks if a user session exists on page load
 */
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

/**
 * Handles User Login
 */
async function handleLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    if(!email || !password) return alert("Please enter email and password.");
    
    const { error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert("Login failed: " + error.message);
    } else {
        checkUser();
    }
}

/**
 * Handles User Logout
 */
async function handleLogout() {
    await _supabase.auth.signOut();
    checkUser();
}

/**
 * Fetches all books from the Supabase 'book' table
 */
async function fetchAllBooks() {
    const listDiv = document.getElementById('book-list');
    listDiv.innerHTML = "Fetching collection...";
    
    const { data, error } = await _supabase
        .from('book')
        .select('*')
        .order('title', { ascending: true });

    if (!error) {
        myLibrary = data;
        displayLibrary(myLibrary);
    } else {
        console.error("Fetch error:", error);
        listDiv.innerHTML = "Error fetching data.";
    }
}

/**
 * Displays the library as a grid of series cards
 */
function displayLibrary(data) {
    currentDisplayData = data;
    const listDiv = document.getElementById('book-list');
    document.getElementById('back-btn').style.display = 'none';
    document.getElementById('list-title').innerHTML = "<h3>Your Collection</h3>";
    
    let html = '<div class="grid-container">';
    data.forEach((series, index) => {
        html += `
            <div class="series-card" onclick="showDetail(${index})">
                <div class="card-title">${series.title}</div>
                <div class="card-info">${series.category} | ${series.volumes ? series.volumes.length : 0} Vols</div>
            </div>`;
    });
    html += '</div>';
    listDiv.innerHTML = data.length > 0 ? html : '<p style="text-align:center; color:#999;">No books found.</p>';
}

/**
 * Shows the detailed volume list for a specific series
 */
function showDetail(index) {
    const series = currentDisplayData[index];
    if (!series) return;

    const listDiv = document.getElementById('book-list');
    document.getElementById('back-btn').style.display = 'block';
    document.getElementById('list-title').innerHTML = `<h3>${series.title}</h3>`;
    
    const dateStr = series.last_updated ? new Date(series.last_updated).toLocaleDateString('en-GB') : 'N/A';

    listDiv.innerHTML = `
        <div class="detail-view">
            <div class="detail-header">
                <span>Category: <b>${series.category}</b></span>
                <span style="color:#666">Last Updated: ${dateStr}</span>
            </div>
            <div class="inner-search-wrapper">
                <input type="text" id="vol-search" placeholder="🔍 Search volumes in this series..." 
                    oninput="filterVolTable('${series.id}')" class="inner-search">
            </div>
            <div id="vol-table-container">
                ${renderVolTable(series.volumes)}
            </div>
            <button onclick="deleteSeries(${series.id})" class="del-btn">Delete This Series</button>
        </div>
    `;
}

/**
 * Renders the HTML table for volumes
 */
function renderVolTable(volumes, filter = '') {
    if (!volumes) return '<p>No volumes found.</p>';
    
    const filtered = volumes
        .filter(v => v.includes(filter))
        .sort((a, b) => parseFloat(a) - parseFloat(b));

    if (filtered.length === 0) return '<p style="text-align:center; padding: 10px;">No matching volumes.</p>';

    let html = '<table class="vol-table"><thead><tr><th>Volume Number</th><th>Status</th></tr></thead><tbody>';
    filtered.forEach(v => {
        html += `<tr><td>Volume ${v}</td><td class="status-ok">✅ Owned</td></tr>`;
    });
    return html + '</tbody></table>';
}

/**
 * Filters the volume table in real-time
 */
function filterVolTable(id) {
    const q = document.getElementById('vol-search').value;
    const series = myLibrary.find(s => s.id.toString() === id);
    if (series) {
        document.getElementById('vol-table-container').innerHTML = renderVolTable(series.volumes, q);
    }
}

/**
 * Adds a new book or updates an existing series with a new volume
 */
async function addBook() {
    const title = document.getElementById('new-title').value.trim();
    const vol = document.getElementById('new-vol').value.trim();
    const cat = document.getElementById('new-category').value;
    
    if(!title || !vol) return alert("Please enter a title and volume number.");

    const now = new Date().toISOString();
    let exist = myLibrary.find(s => s.title.toLowerCase() === title.toLowerCase());

    if(exist) {
        if(!exist.volumes.includes(vol)) {
            const updatedVols = [...exist.volumes, vol];
            await _supabase
                .from('book')
                .update({ volumes: updatedVols, last_updated: now })
                .eq('id', exist.id);
        } else {
            alert("This volume is already in your collection.");
        }
    } else {
        await _supabase
            .from('book')
            .insert([{ title, category: cat, volumes: [vol], last_updated: now }]);
    }

    // Reset inputs and refresh
    document.getElementById('new-title').value = '';
    document.getElementById('new-vol').value = '';
    fetchAllBooks();
}

/**
 * Deletes an entire series from the database
 */
async function deleteSeries(id) {
    if(confirm("Are you sure you want to delete this entire series? This cannot be undone.")) {
        const { error } = await _supabase.from('book').delete().eq('id', id);
        if(error) {
            alert("Error deleting: " + error.message);
        } else {
            fetchAllBooks();
        }
    }
}

/**
 * Filters the display by category
 */
function filterBooks(cat) {
    displayLibrary(myLibrary.filter(s => s.category === cat));
}

/**
 * Search the main library list
 */
function searchBook() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const filtered = myLibrary.filter(s => s.title.toLowerCase().includes(q));
    displayLibrary(filtered);
}

// Initial session check
checkUser();