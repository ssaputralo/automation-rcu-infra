// ... (Bagian atas sama seperti sebelumnya: Definisi variable) ...
const fileRawInput = document.getElementById('fileRaw');
const filePatchInput = document.getElementById('filePatch');
const btnSubmit = document.getElementById('btnSubmit');
const btnTheme = document.getElementById('btnTheme');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText'); // New Element
const alertArea = document.getElementById('alertArea');

const uploadSection = document.getElementById('uploadSection');
const overviewSection = document.getElementById('overviewSection');
const displayRawName = document.getElementById('displayRawName');
const displayRawSize = document.getElementById('displayRawSize');
const displayPatchName = document.getElementById('displayPatchName');
const displayPatchSize = document.getElementById('displayPatchSize');
const btnReset = document.getElementById('btnReset');

// Helper: Format Bytes
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Helper: Read File
function readFileAsBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
            name: file.name,
            data: reader.result,
            mime: file.type,
            size: file.size
        });
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function checkInputs() {
    if (fileRawInput.files.length > 0 && filePatchInput.files.length > 0) {
        btnSubmit.removeAttribute('disabled');
    } else {
        btnSubmit.setAttribute('disabled', 'true');
    }
}
fileRawInput.addEventListener('change', checkInputs);
filePatchInput.addEventListener('change', checkInputs);

// --- SUBMIT LOGIC ---
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // UI Start Loading
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa fa-spinner fa-spin me-1"></i> Sending...';
    progressContainer.classList.remove('d-none');
    progressBar.style.width = '30%';
    progressText.innerText = '30%';
    alertArea.innerHTML = '';

    try {
        const rawFile = fileRawInput.files[0];
        const patchFile = filePatchInput.files[0];

        const rawFileObj = await readFileAsBuffer(rawFile);
        const patchFileObj = await readFileAsBuffer(patchFile);

        progressBar.style.width = '60%';
        progressText.innerText = '60%';

        // Kirim ke Main Process
        const result = await window.electronAPI.invoke('upload-files', {
            files: [rawFileObj, patchFileObj]
        });

        if (result.ok) {
            progressBar.style.width = '100%';
            progressText.innerText = '100%';

            setTimeout(() => {
                showOverviewPage(rawFile, patchFile);
            }, 600);
        } else {
            throw new Error(result.error);
        }

    } catch (err) {
        console.error(err);
        progressBar.classList.add('bg-danger');
        alertArea.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = 'Submit Files';
    }
});

// --- SWITCH PAGE LOGIC ---
function showOverviewPage(file1, file2) {
    displayRawName.textContent = file1.name;
    displayRawName.title = file1.name; // Tooltip jika nama kepanjangan
    displayRawSize.textContent = formatBytes(file1.size);
    
    displayPatchName.textContent = file2.name;
    displayPatchName.title = file2.name;
    displayPatchSize.textContent = formatBytes(file2.size);

    // Animasi Switch
    uploadSection.classList.add('d-none');
    overviewSection.classList.remove('d-none');
    overviewSection.querySelector('.card').classList.add('fade-in'); // Trigger animasi ulang
}

// Reset
btnReset.addEventListener('click', () => {
    overviewSection.classList.add('d-none');
    uploadSection.classList.remove('d-none');
    uploadSection.classList.add('fade-in');

    // Reset Form UI
    document.getElementById('uploadForm').reset();
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa fa-paper-plane me-1"></i> Submit Files';
    progressContainer.classList.add('d-none');
    progressBar.style.width = '0%';
});

// Dark Mode
btnTheme.addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-bs-theme') === 'dark';
    html.setAttribute('data-bs-theme', isDark ? 'light' : 'dark');
    btnTheme.querySelector('i').className = isDark ? 'fa fa-moon' : 'fa fa-sun';
});