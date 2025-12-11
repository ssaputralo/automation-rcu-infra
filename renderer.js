// Legacy renderer stub — replaced by modular renderer in `renderer/`.
// This file is intentionally left as a small stub to avoid accidental global bootstrapping.
// Use `renderer/main.js` and `renderer/app.js` (ESM) instead.

console.warn('renderer.js is deprecated — use renderer/main.js and renderer/app.js');
            invalid1: false,
            invalid2: false,
            notifications: [],
            uploadUrl: 'http://localhost:3000/upload',
            submitting: false,
            progressPercent: 0,
            currentXhr: null,
            // keep File objects here to avoid relying on programmatic assignment to input.files
            fileObjs: { file1: null, file2: null }
        };
    },
    computed: {
        canSubmit() {
            try {
                const has1 = this.fileObjs.file1 != null;
                const has2 = this.fileObjs.file2 != null;
                return !this.invalid1 && !this.invalid2 && has1 && has2;
            } catch (e) {
                return false;
            }
        }
    },
    methods: {
        openFile(slot) {
            if (slot === 'file1') this.$refs.fileInput1.click();
            else this.$refs.fileInput2.click();
        },
        onFileChange(e, slot) {
            const input = e.target;
            const file = input.files && input.files[0];
            if (!file) { this.clear(slot); return; }

            const allowed = slot === 'file1' ? allowedMap.file1 : allowedMap.file2;
            if (!this.isValidFile(file, allowed)) {
                try { input.value = ''; } catch (err) {}
                this.setInvalid(slot, 'Tipe file tidak didukung');
                return;
            }

            this.clear(slot);
            if (slot === 'file1') {
                this.file1Name = file.name;
                this.fileObjs.file1 = file;
            } else {
                this.file2Name = file.name;
                this.fileObjs.file2 = file;
            }
        },
        onDragOver(e, slot) {
            if (slot === 'file1') this.$refs.uploadBox1.style.borderColor = '#007acc';
            else this.$refs.uploadBox2.style.borderColor = '#007acc';
        },
        onDragLeave(slot) {
            if (slot === 'file1') this.$refs.uploadBox1.style.borderColor = ''; else this.$refs.uploadBox2.style.borderColor = '';
        },
        onDrop(e, slot) {
            const files = e.dataTransfer && e.dataTransfer.files;
            if (!files || !files.length) return;
            const file = files[0];
            const allowed = slot === 'file1' ? allowedMap.file1 : allowedMap.file2;
            if (!this.isValidFile(file, allowed)) {
                this.setInvalid(slot, 'Tipe file tidak didukung');
                try { if (slot === 'file1') this.$refs.fileInput1.value = ''; else this.$refs.fileInput2.value = ''; } catch (err) {}
                return;
            }

            // store File object in reactive state (don't rely on programmatic input.files assignment)
            if (slot === 'file1') {
                this.file1Name = file.name;
                this.fileObjs.file1 = file;
            } else {
                this.file2Name = file.name;
                this.fileObjs.file2 = file;
            }
        },
        isValidFile(file, allowed) {
            if (!file) return false;
            const name = file.name || '';
            const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
            if (allowed.exts.includes(ext)) return true;
            if (file.type && allowed.mimes.includes(file.type)) return true;
            return false;
        },
        setInvalid(slot, message) {
            if (slot === 'file1') { this.invalid1 = true; this.file1Name = message; }
            else { this.invalid2 = true; this.file2Name = message; }
        },
        clear(slot) {
            if (slot === 'file1') {
                this.invalid1 = false;
                this.file1Name = 'Belum ada file dipilih';
                this.$refs.uploadBox1.style.borderColor = '';
                this.fileObjs.file1 = null;
                try { if (this.$refs.fileInput1) this.$refs.fileInput1.value = ''; } catch (e) {}
            } else {
                this.invalid2 = false;
                this.file2Name = 'Belum ada file dipilih';
                this.$refs.uploadBox2.style.borderColor = '';
                this.fileObjs.file2 = null;
                try { if (this.$refs.fileInput2) this.$refs.fileInput2.value = ''; } catch (e) {}
            }
        },
        
        notify(message, type = 'info', timeout = 4000) {
            const id = Date.now() + Math.random();
            this.notifications.push({ id, message, type });
            setTimeout(() => {
                const idx = this.notifications.findIndex(n => n.id === id);
                if (idx !== -1) this.notifications.splice(idx, 1);
            }, timeout);
        },
        async submitFiles() {
            if (!this.canSubmit) {
                this.notify('Pilih kedua file yang valid sebelum submit', 'error');
                return;
            }
            const f1 = this.fileObjs.file1;
            const f2 = this.fileObjs.file2;

            // If online, send files to backend via main process (IPC) so backend can process without saving locally
            if (window.navigator && window.navigator.onLine) {
                this.submitting = true;
                this.progressPercent = 0;
                try {
                    const ab1 = await f1.arrayBuffer();
                    const ab2 = await f2.arrayBuffer();

                    const payload = {
                        uploadUrl: this.uploadUrl,
                        files: [
                            { field: 'file1', name: f1.name, mime: f1.type || 'application/octet-stream', data: ab1 },
                            { field: 'file2', name: f2.name, mime: f2.type || 'application/octet-stream', data: ab2 }
                        ]
                    };

                    const res = await window.electronAPI.invoke('upload-files', payload);
                    if (res && res.ok) {
                        this.progressPercent = 100;
                        this.notify('Upload berhasil (backend memproses tanpa menyimpan)', 'success');
                    } else {
                        const msg = (res && (res.error || res.body)) ? (res.error || res.body) : 'Upload gagal';
                        this.notify(`Upload gagal: ${msg}`, 'error');
                    }
                } catch (err) {
                    console.error('submitFiles (upload via IPC) error', err);
                    this.notify(`Upload gagal: ${err.message}`, 'error');
                } finally {
                    setTimeout(() => { this.progressPercent = 0; }, 800);
                    this.submitting = false;
                    this.currentXhr = null;
                }
                return;
            }

            // Offline fallback: save files locally
            this.submitting = true;
            this.progressPercent = 0;
            try {
                const ab1 = await f1.arrayBuffer();
                const res1 = await window.electronAPI.invoke('save-file', { data: ab1, defaultPath: f1.name, autoSave: true });
                if (!res1 || !res1.ok) throw new Error((res1 && res1.error) || 'Gagal menyimpan file 1');
                const ab2 = await f2.arrayBuffer();
                const res2 = await window.electronAPI.invoke('save-file', { data: ab2, defaultPath: f2.name, autoSave: true });
                if (!res2 || !res2.ok) throw new Error((res2 && res2.error) || 'Gagal menyimpan file 2');
                this.progressPercent = 100;
                this.notify('File tersimpan lokal (offline)', 'success');
            } catch (err) {
                console.error('submitFiles (local save) error', err);
                this.notify(`Simpan lokal gagal: ${err.message}`, 'error');
            } finally {
                setTimeout(() => { this.progressPercent = 0; }, 800);
                this.submitting = false;
                this.currentXhr = null;
            }
        }
        ,
        cancelUpload() {
            if (this.currentXhr) {
                try {
                    this.currentXhr.abort();
                } catch (e) { /* ignore */ }
                this.currentXhr = null;
            }
            this.submitting = false;
            this.progressPercent = 0;
            this.notify('Upload dibatalkan', 'info');
        }
    }
};

Vue.createApp(App).mount('#app');
