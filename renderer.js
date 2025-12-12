// Mengambil elemen DOM
const fileRawInput = document.getElementById('fileRaw');
const filePatchInput = document.getElementById('filePatch');
const btnSubmit = document.getElementById('btnSubmit');
const btnTheme = document.getElementById('btnTheme');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const alertArea = document.getElementById('alertArea');

// State sederhana
let files = {
    raw: null,
    patch: null
};

// Fungsi helper: Menampilkan Alert Bootstrap
function showAlert(message, type = 'success') {
    alertArea.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
}

// Fungsi helper: Membaca file sebagai ArrayBuffer (diperlukan oleh main.js)
function readFileAsBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve({
                name: file.name,
                data: reader.result, // Ini adalah ArrayBuffer
                mime: file.type
            });
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Event Listener: Cek validasi saat file dipilih
function checkInputs() {
    if (fileRawInput.files.length > 0 && filePatchInput.files.length > 0) {
        btnSubmit.removeAttribute('disabled');
    } else {
        btnSubmit.setAttribute('disabled', 'true');
    }
}

fileRawInput.addEventListener('change', checkInputs);
filePatchInput.addEventListener('change', checkInputs);

// Event Listener: Submit Form
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // UI Updates
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa fa-spinner fa-spin me-1"></i> Sending...';
    progressContainer.classList.remove('d-none');
    progressBar.style.width = '50%';
    progressBar.textContent = '50%';
    alertArea.innerHTML = ''; // Clear alerts

    try {
        // 1. Persiapkan data file
        const rawFileObj = await readFileAsBuffer(fileRawInput.files[0]);
        const patchFileObj = await readFileAsBuffer(filePatchInput.files[0]);

        // Berikan field name sesuai kebutuhan backend, contoh: 'file1', 'file2'
        rawFileObj.field = 'fileRaw'; 
        patchFileObj.field = 'filePatch';

        // 2. Kirim via IPC (sesuai preload.js & main.js)
        // URL Upload HARUS disesuaikan. Karena tidak ada di kode asli, saya pakai localhost contoh.
        const uploadUrl = "http://localhost:3000/upload"; 

        const result = await window.electronAPI.invoke('upload-files', {
            files: [rawFileObj, patchFileObj],
            uploadUrl: uploadUrl
        });

        progressBar.style.width = '100%';
        progressBar.textContent = '100%';

        if (result.ok) {
            showAlert('File berhasil diunggah!', 'success');
        } else {
            throw new Error(result.error || 'Upload failed with unknown error');
        }

    } catch (err) {
        console.error(err);
        progressBar.classList.add('bg-danger');
        showAlert(`Error: ${err.message}. (Pastikan URL Upload benar)`, 'danger');
    } finally {
        // Reset button state
        btnSubmit.innerHTML = '<i class="fa fa-paper-plane me-1"></i> Submit Files';
        // Biarkan tombol disabled sampai user memilih file baru/mereset jika perlu logic reset
        // btnSubmit.disabled = false; 
    }
});

// Fitur Dark Mode Toggle
btnTheme.addEventListener('click', () => {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-bs-theme');
    const icon = btnTheme.querySelector('i');

    if (currentTheme === 'dark') {
        html.setAttribute('data-bs-theme', 'light');
        icon.className = 'fa fa-moon';
        document.body.classList.add('bg-light');
    } else {
        html.setAttribute('data-bs-theme', 'dark');
        icon.className = 'fa fa-sun';
        document.body.classList.remove('bg-light');
    }
});