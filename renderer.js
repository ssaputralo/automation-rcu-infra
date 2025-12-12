// --- DOM ELEMENTS ---
const fileRawInput = document.getElementById('fileRaw');
const filePatchInput = document.getElementById('filePatch');
const btnSubmit = document.getElementById('btnSubmit');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressLabel = document.getElementById('progressLabel');
const alertArea = document.getElementById('alertArea');

const uploadSection = document.getElementById('uploadSection');
const overviewSection = document.getElementById('overviewSection');
const detailedSection = document.getElementById('detailedSection');

const countMatch = document.getElementById('countMatch');
const countMismatch = document.getElementById('countMismatch');
const findingsTableBody = document.getElementById('findingsTableBody'); 

const btnReset = document.getElementById('btnReset');
const btnToDetail = document.getElementById('btnToDetail');
const btnBackToOverview = document.getElementById('btnBackToOverview');

let comparisonResults = [];

// --- HELPER: Read File Browser-Side ---
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// --- LOGIC 1: EKSTRAK PPT (Per Slide) ---
async function extractSlidesFromPPT(arrayBuffer) {
    const zip = new JSZip();
    const content = await zip.loadAsync(arrayBuffer);
    
    let slidesData = []; 

    // Filter file XML slide
    const slideFiles = Object.keys(content.files).filter(fileName => 
        fileName.startsWith("ppt/slides/slide") && fileName.endsWith(".xml")
    );

    for (const fileName of slideFiles) {
        // Ambil nomor slide
        const matchNumber = fileName.match(/slide(\d+)\.xml/);
        const slideNum = matchNumber ? parseInt(matchNumber[1]) : 0;

        const slideXml = await content.files[fileName].async("string");
        
        let slideText = "";
        // Regex menangkap teks di dalam tag <a:t>
        const matches = slideXml.match(/<a:t>(.*?)<\/a:t>/g);
        if (matches) {
            matches.forEach(m => {
                const text = m.replace(/<\/?a:t>/g, ""); 
                // Kita simpan lowercase untuk searching, tapi data asli slideText biarkan dulu
                slideText += " " + text.toLowerCase(); 
            });
        }

        slidesData.push({
            slideNum: slideNum,
            text: slideText
        });
    }
    return slidesData;
}

// --- LOGIC 2: EKSTRAK EXCEL (SEMUA SHEET & SEMUA CELL) ---
function extractDataFromExcel(arrayBuffer) {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    let allItems = [];

    // LOOP SEMUA SHEET YANG ADA DI EXCEL
    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        
        // Cek range data
        if (!worksheet['!ref']) return; // Skip sheet kosong
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        
        // Loop Baris (R)
        for (let R = range.s.r; R <= range.e.r; ++R) {
            
            // Loop Kolom (C)
            for (let C = range.s.c; C <= range.e.c; ++C) {
                
                const cellAddress = {c:C, r:R}; 
                const cellRef = XLSX.utils.encode_cell(cellAddress); // A1, B2...
                const cell = worksheet[cellRef];

                // Ambil nilai jika cell tidak kosong
                // Kita gunakan String() agar angka/tanggal tetap terbaca sebagai teks
                if (cell && cell.v !== undefined && cell.v !== null) {
                    const rawValue = String(cell.v).trim();
                    
                    if (rawValue !== "") {
                        allItems.push({
                            value: rawValue,
                            sheet: sheetName, // Nama Tab
                            cell: cellRef     // Alamat Cell
                        });
                    }
                }
            }
        }
    });

    return allItems;
}

// --- MAIN PROCESS ---
function checkInputs() {
    if (fileRawInput.files.length > 0 && filePatchInput.files.length > 0) {
        btnSubmit.removeAttribute('disabled');
    } else {
        btnSubmit.setAttribute('disabled', 'true');
    }
}
fileRawInput.addEventListener('change', checkInputs);
filePatchInput.addEventListener('change', checkInputs);

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    alertArea.innerHTML = '';
    btnSubmit.disabled = true;
    
    progressContainer.classList.remove('d-none');
    progressLabel.innerText = "Reading Files...";
    progressBar.style.width = '10%';
    progressText.innerText = '10%';

    try {
        const rawFile = fileRawInput.files[0];
        const patchFile = filePatchInput.files[0];

        // 1. Baca File
        const rawBuffer = await readFileAsArrayBuffer(rawFile);
        const patchBuffer = await readFileAsArrayBuffer(patchFile);

        progressBar.style.width = '40%';
        progressText.innerText = 'Extracting...';

        // 2. Ekstrak Data (Mode Lengkap)
        const excelItems = extractDataFromExcel(rawBuffer);
        const pptSlides = await extractSlidesFromPPT(patchBuffer);

        if (excelItems.length === 0) {
            throw new Error("Tidak ditemukan data apapun di file Excel (Semua Sheet kosong).");
        }

        progressBar.style.width = '70%';
        progressText.innerText = `Checking ${excelItems.length} items...`;
        progressLabel.innerText = "Comparing...";

        await new Promise(r => setTimeout(r, 200)); // Jeda biar UI update

        // 3. Bandingkan
        comparisonResults = [];
        let matchCounter = 0;
        let mismatchCounter = 0;
        
        excelItems.forEach(excelItem => {
            // Gunakan lowercase untuk pencarian agar tidak case-sensitive
            const keyword = excelItem.value.toLowerCase();
            
            // Filter keyword pendek agar tidak terlalu "bising" (Opsional)
            // Jika kata hanya 1 huruf/angka mungkin tidak perlu dicek? 
            // Untuk sekarang kita cek SEMUANYA.

            let foundInSlides = [];

            pptSlides.forEach(slide => {
                if (slide.text.includes(keyword)) {
                    foundInSlides.push(slide.slideNum);
                }
            });

            if (foundInSlides.length > 0) {
                matchCounter++;
                comparisonResults.push({
                    value: excelItem.value,
                    excelLoc: `${excelItem.sheet}!${excelItem.cell}`,
                    pptLoc: `Slide ${foundInSlides.sort((a,b)=>a-b).join(', ')}`,
                    status: 'Match'
                });
            } else {
                mismatchCounter++;
                comparisonResults.push({
                    value: excelItem.value,
                    excelLoc: `${excelItem.sheet}!${excelItem.cell}`,
                    pptLoc: '-',
                    status: 'Mismatch'
                });
            }
        });

        // 4. Update Summary UI
        countMatch.innerText = matchCounter;
        countMismatch.innerText = mismatchCounter;

        progressBar.style.width = '100%';
        progressBar.classList.add('bg-success');
        progressText.innerText = 'Done!';
        
        setTimeout(() => {
            showSummaryPage();
        }, 800);

    } catch (err) {
        console.error(err);
        progressBar.classList.add('bg-danger');
        alertArea.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = 'Submit Files';
    }
});

// --- UI FUNCTIONS ---
function showSummaryPage() {
    uploadSection.classList.add('d-none');
    overviewSection.classList.remove('d-none');
    
    setTimeout(() => {
        progressContainer.classList.add('d-none');
        progressBar.style.width = '0%';
        progressBar.classList.remove('bg-success');
        btnSubmit.innerHTML = 'Submit Files';
        btnSubmit.disabled = false;
    }, 500);
}

function renderDetailedTable() {
    findingsTableBody.innerHTML = ''; 

    if (comparisonResults.length === 0) {
        findingsTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No data found.</td></tr>';
        return;
    }

    comparisonResults.forEach((res, index) => {
        const isMatch = res.status === 'Match';
        const badgeClass = isMatch ? 'bg-success' : 'bg-danger';
        // Warna text value agar lebih jelas
        const textClass = isMatch ? 'text-dark' : 'text-danger fw-bold';
        const icon = isMatch ? '<i class="fa fa-check"></i>' : '<i class="fa fa-times"></i>';

        const row = `
            <tr>
                <td class="px-3 text-secondary text-center small">${index + 1}</td>
                <td class="${textClass} text-break" style="min-width: 200px;">
                    ${res.value}
                </td>
                <td class="text-secondary small" style="white-space: nowrap;">
                    ${res.excelLoc}
                </td>
                <td class="text-secondary small">
                    ${res.pptLoc}
                </td>
                <td class="text-center">
                    <span class="badge ${badgeClass} rounded-pill">
                        ${icon} ${res.status}
                    </span>
                </td>
            </tr>
        `;
        findingsTableBody.insertAdjacentHTML('beforeend', row);
    });
}

// --- NAVIGATION ---
btnReset.addEventListener('click', () => {
    overviewSection.classList.add('d-none');
    uploadSection.classList.remove('d-none');
    uploadSection.classList.add('fade-in');
    
    document.getElementById('uploadForm').reset();
    btnSubmit.disabled = true;
});

btnToDetail.addEventListener('click', () => {
    renderDetailedTable(); 
    overviewSection.classList.add('d-none');
    detailedSection.classList.remove('d-none');
    detailedSection.classList.add('fade-in');
});

btnBackToOverview.addEventListener('click', () => {
    detailedSection.classList.add('d-none');
    overviewSection.classList.remove('d-none');
    overviewSection.classList.add('fade-in');
});