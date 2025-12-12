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

// --- HELPER: Read File ---
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// --- LOGIC 1: EKSTRAK PPT + OCR ---
async function extractSlidesWithOCR(arrayBuffer) {
    const zip = new JSZip();
    const content = await zip.loadAsync(arrayBuffer);
    
    let slidesData = []; 

    const slideFiles = Object.keys(content.files).filter(fileName => 
        fileName.startsWith("ppt/slides/slide") && fileName.endsWith(".xml")
    );

    const totalSlides = slideFiles.length;
    let processedSlides = 0;

    for (const fileName of slideFiles) {
        const matchNumber = fileName.match(/slide(\d+)\.xml/);
        const slideNum = matchNumber ? parseInt(matchNumber[1]) : 0;
        
        processedSlides++;
        const percent = 30 + Math.floor((processedSlides / totalSlides) * 40); 
        progressBar.style.width = `${percent}%`;
        progressText.innerText = `${percent}%`;
        progressLabel.innerText = `Scanning Slide ${slideNum}/${totalSlides} (OCR)...`;

        // 1. Ambil Text XML
        const slideXml = await content.files[fileName].async("string");
        let combinedText = "";
        
        const matches = slideXml.match(/<a:t>(.*?)<\/a:t>/g);
        if (matches) {
            matches.forEach(m => {
                const text = m.replace(/<\/?a:t>/g, ""); 
                combinedText += " " + text.toLowerCase(); 
            });
        }

        // 2. OCR Gambar (Jika ada)
        const relsFileName = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
        const relsFile = content.files[relsFileName];

        if (relsFile) {
            const relsXml = await relsFile.async("string");
            const imageMatches = relsXml.match(/Target="\.\.\/media\/(.*?)"/g);
            
            if (imageMatches) {
                for (const imgTag of imageMatches) {
                    const imgName = imgTag.replace('Target="../media/', '').replace('"', '');
                    const imgPath = `ppt/media/${imgName}`;
                    
                    if (content.files[imgPath]) {
                        try {
                            const imgBlob = await content.files[imgPath].async("blob");
                            // OCR (English)
                            const { data: { text } } = await Tesseract.recognize(imgBlob, 'eng');
                            combinedText += " " + text.toLowerCase();
                        } catch (err) {
                            console.warn(`OCR Failed for ${imgName}`, err);
                        }
                    }
                }
            }
        }

        slidesData.push({
            slideNum: slideNum,
            text: combinedText
        });
    }
    return slidesData;
}

// --- LOGIC 2: EKSTRAK EXCEL ---
function extractDataFromExcel(arrayBuffer) {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let cellItems = [];

    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet['!ref']) return;
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
            // Kita baca Header juga agar tidak ada kata yang terlewat
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({c:C, r:R});
                const cell = worksheet[cellRef];

                if (cell && cell.v !== undefined && cell.v !== null) {
                    const rawValue = String(cell.v).trim();
                    if (rawValue !== "") {
                        cellItems.push({
                            value: rawValue,
                            sheet: sheetName,
                            cell: cellRef
                        });
                    }
                }
            }
        }
    });
    return cellItems;
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
    progressLabel.innerText = "Reading Excel...";
    progressBar.style.width = '5%';
    progressText.innerText = '5%';

    try {
        const rawFile = fileRawInput.files[0];
        const patchFile = filePatchInput.files[0];

        const rawBuffer = await readFileAsArrayBuffer(rawFile);
        const patchBuffer = await readFileAsArrayBuffer(patchFile);

        progressBar.style.width = '15%';
        progressText.innerText = 'Extracting Excel...';
        
        // 1. Ekstrak Data Mentah dari Excel
        const excelCells = extractDataFromExcel(rawBuffer);

        if (excelCells.length === 0) throw new Error("File Excel kosong.");

        // --- NEW LOGIC: PECAH JADI KATA ---
        progressBar.style.width = '20%';
        progressLabel.innerText = "Splitting sentences into words...";
        
        let allWords = [];
        excelCells.forEach(item => {
            // Pecah berdasarkan spasi, enter, atau tanda baca umum (- / _ , .)
            // Kita ganti tanda baca dengan spasi dulu agar pemisahan bersih
            const cleanString = item.value.replace(/[\/\-_,.;:()\[\]"']/g, " ");
            const words = cleanString.split(/\s+/);

            words.forEach(w => {
                // Hapus karakter non-alphanumeric di ujung kata (misal: "Patch." -> "Patch")
                const cleanWord = w.replace(/^[^\w]+|[^\w]+$/g, '');
                
                // Filter kata kosong atau terlalu pendek (opsional, disini kita ambil > 1 char)
                if (cleanWord.length > 1) {
                    allWords.push({
                        word: cleanWord,
                        sheet: item.sheet,
                        cell: item.cell,
                        origin: item.value // Simpan asal kalimatnya jika butuh info
                    });
                }
            });
        });

        // 2. Ekstrak PPT + OCR
        progressBar.style.width = '30%';
        progressLabel.innerText = "Scanning PPT & OCR Images...";
        const pptSlides = await extractSlidesWithOCR(patchBuffer);

        progressBar.style.width = '80%';
        progressLabel.innerText = `Comparing ${allWords.length} words...`;
        progressText.innerText = '80%';
        
        await new Promise(r => setTimeout(r, 100));

        // 3. Bandingkan Per KATA
        comparisonResults = [];
        let matchCounter = 0;
        let mismatchCounter = 0;
        
        allWords.forEach(item => {
            const keyword = item.word.toLowerCase();
            let foundInSlides = [];

            pptSlides.forEach(slide => {
                // Gunakan RegExp untuk pencocokan kata utuh (Whole Word Match)
                // agar "Patch" tidak match dengan "Dispatch".
                // Namun jika ingin loose match, .includes() cukup.
                // Disini kita pakai .includes() agar lebih toleran pada hasil OCR yang kadang tidak sempurna.
                if (slide.text.includes(keyword)) {
                    foundInSlides.push(slide.slideNum);
                }
            });

            if (foundInSlides.length > 0) {
                matchCounter++;
                comparisonResults.push({
                    value: item.word, // Tampilkan KATA-nya
                    excelLoc: `${item.sheet}!${item.cell}`,
                    pptLoc: `Slide ${foundInSlides.sort((a,b)=>a-b).join(', ')}`,
                    status: 'Match'
                });
            } else {
                mismatchCounter++;
                comparisonResults.push({
                    value: item.word,
                    excelLoc: `${item.sheet}!${item.cell}`,
                    pptLoc: '-',
                    status: 'Mismatch'
                });
            }
        });

        // 4. Update Summary
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
        const textClass = isMatch ? 'text-dark' : 'text-danger fw-bold';
        const icon = isMatch ? '<i class="fa fa-check"></i>' : '<i class="fa fa-times"></i>';

        const row = `
            <tr>
                <td class="px-3 text-secondary text-center small">${index + 1}</td>
                <td class="${textClass}" style="font-weight: 500;">
                    ${res.value}
                </td>
                <td class="text-secondary small">
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