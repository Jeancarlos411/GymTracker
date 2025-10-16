// IIFE para encapsular el código y no contaminar el scope global
(function() {
    // State
    let documents = [];
    let fileObjects = [];
    let fileToProcess = null;

    // DOM Elements
    const dom = {
        uploadArea: document.getElementById('uploadArea'),
        fileInput: document.getElementById('fileInput'),
        filesList: document.getElementById('filesList'),
        processBtn: document.getElementById('processBtn'),
        progressBar: document.getElementById('progressBar'),
        progressFill: document.getElementById('progressFill'),
        searchInput: document.getElementById('searchInput'),
        clearSearchBtn: document.getElementById('clearSearchBtn'),
        resultsBody: document.getElementById('resultsBody'),
        logContainer: document.getElementById('logContainer'),
        navButtons: document.getElementById('navButtons'),
        explorerSearch: document.getElementById('explorerSearch'),
        explorerContent: document.getElementById('explorerContent'),
        modal: document.getElementById('documentModal'),
        modalTitle: document.getElementById('modalTitle'),
        modalBody: document.getElementById('modalBody'),
        modalCloseBtn: document.getElementById('modalCloseBtn'),
    };

    // Templates
    const templates = {
        fileItem: document.getElementById('fileItemTemplate'),
        resultRow: document.getElementById('resultRowTemplate'),
    };

    // --- EVENT LISTENERS ---

    function initializeEventListeners() {
        dom.uploadArea.addEventListener('click', () => dom.fileInput.click());
        dom.uploadArea.addEventListener('dragover', handleDragOver);
        dom.uploadArea.addEventListener('dragleave', handleDragLeave);
        dom.uploadArea.addEventListener('drop', handleDrop);
        dom.fileInput.addEventListener('change', handleFileSelect);

        dom.processBtn.addEventListener('click', processDocuments);
        dom.clearSearchBtn.addEventListener('click', () => {
            dom.searchInput.value = '';
            filterResults();
        });

        dom.searchInput.addEventListener('keyup', filterResults);
        dom.explorerSearch.addEventListener('keyup', filterExplorer);

        dom.navButtons.addEventListener('click', handleTabSwitch);
        dom.filesList.addEventListener('click', handleFilesListClick);
        dom.resultsBody.addEventListener('click', handleResultsTableClick);

        dom.modal.addEventListener('click', (e) => {
            if (e.target === dom.modal) closeModal();
        });
        dom.modalCloseBtn.addEventListener('click', closeModal);
        dom.modalBody.addEventListener('click', handleModalBodyClick);
    }

    // --- EVENT HANDLERS ---

    function handleDragOver(e) {
        e.preventDefault();
        dom.uploadArea.classList.add('dragover');
    }

    function handleDragLeave() {
        dom.uploadArea.classList.remove('dragover');
    }

    function handleDrop(e) {
        e.preventDefault();
        dom.uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length) {
            fileObjects = Array.from(files);
            updateFilesList();
        }
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        if (files.length) {
            fileObjects = Array.from(files);
            updateFilesList();
        }
    }

    function handleTabSwitch(e) {
        const button = e.target.closest('.nav-btn');
        if (!button) return;

        const tab = button.dataset.tab;
        if (tab) {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById(tab).classList.add('active');

            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            button.classList.add('active');

            if (tab === 'explorer') {
                filterExplorer();
            }
        }
    }

    function handleFilesListClick(e) {
        if (e.target.dataset.action === 'remove-file') {
            const fileItem = e.target.closest('.file-item');
            const index = Array.from(dom.filesList.children).indexOf(fileItem);
            removeFile(index);
        }
    }

    function handleResultsTableClick(e) {
        const button = e.target.closest('[data-action="view-doc"]');
        if (button) {
            const row = button.closest('tr');
            const docId = parseInt(row.dataset.docId, 10);
            viewDocument(docId);
        }
    }

    function handleModalBodyClick(e) {
        const action = e.target.dataset.action;
        if (action === 'save-classification') {
            saveClassification();
        } else if (action === 'cancel-classification') {
            closeClassificationModal();
        }
    }

    // --- UI UPDATE FUNCTIONS ---

    function updateFilesList() {
        dom.filesList.innerHTML = '';
        dom.processBtn.disabled = fileObjects.length === 0;

        if (fileObjects.length === 0) return;

        const fragment = document.createDocumentFragment();
        fileObjects.forEach(file => {
            const clone = templates.fileItem.content.cloneNode(true);
            clone.querySelector('[data-file-name]').textContent = file.name;
            clone.querySelector('[data-file-size]').textContent = `${(file.size / 1024).toFixed(2)} KB`;
            fragment.appendChild(clone);
        });
        dom.filesList.appendChild(fragment);
    }

    function removeFile(index) {
        fileObjects.splice(index, 1);
        updateFilesList();
    }

    function filterResults() {
        const query = dom.searchInput.value.toLowerCase();
        dom.resultsBody.innerHTML = '';

        const filtered = documents.filter(doc =>
            !query || doc.nombre.toLowerCase().includes(query) ||
            doc.colaborador.toLowerCase().includes(query) ||
            doc.texto.toLowerCase().includes(query)
        );

        if (filtered.length === 0) {
            dom.resultsBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999;">Sin resultados</td></tr>';
            return;
        }

        const fragment = document.createDocumentFragment();
        const badges = {
            activos: 'badge-green', perifericos: 'badge-blue', laptops: 'badge-yellow',
            tablets: 'badge-purple', monitores: 'badge-blue', otros: 'badge-green'
        };

        filtered.forEach(doc => {
            const clone = templates.resultRow.content.cloneNode(true);
            const row = clone.querySelector('tr');
            row.dataset.docId = doc.id;
            row.querySelector('[data-doc-name]').textContent = doc.nombre;
            const categoryBadge = row.querySelector('[data-doc-category]');
            categoryBadge.textContent = doc.categoria;
            categoryBadge.classList.add(badges[doc.categoria] || 'badge-green');
            row.querySelector('[data-doc-collaborator]').textContent = doc.colaborador.replace(/_/g, ' ');
            row.querySelector('[data-doc-date]').textContent = doc.fecha;
            fragment.appendChild(clone);
        });
        dom.resultsBody.appendChild(fragment);
    }

    function filterExplorer() {
        // La lógica de filterExplorer es compleja para generar HTML,
        // por lo que se mantiene similar, pero se podría refactorizar más.
        const query = dom.explorerSearch.value.toLowerCase();
        const filtered = documents.filter(doc =>
            !query || doc.nombre.toLowerCase().includes(query) ||
            doc.colaborador.toLowerCase().includes(query)
        );

        if (filtered.length === 0) {
            dom.explorerContent.innerHTML = '<p style="text-align: center; color: #999;">Sin documentos</p>';
            return;
        }

        const organized = {};
        filtered.forEach(doc => {
            if (!organized[doc.fecha]) organized[doc.fecha] = {};
            if (!organized[doc.fecha][doc.categoria]) organized[doc.fecha][doc.categoria] = [];
            organized[doc.fecha][doc.categoria].push(doc);
        });

        let html = '';
        Object.entries(organized).sort().reverse().forEach(([fecha, categories]) => {
            html += `<div style="margin-bottom: 20px; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;"><div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; font-weight: 600;">📅 ${fecha}</div><div style="padding: 15px;">`;
            Object.entries(categories).forEach(([categoria, docs]) => {
                const badges = { activos: 'badge-green', perifericos: 'badge-blue', laptops: 'badge-yellow', tablets: 'badge-purple', monitores: 'badge-blue', otros: 'badge-green' };
                html += `<div style="margin-bottom: 15px;"><div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;"><span class="badge ${badges[categoria] || 'badge-green'}">${categoria}</span><span style="color: #999; font-size: 0.9em;">${docs.length} documento(s)</span></div>`;
                docs.forEach(doc => {
                    html += `<div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;"><div><div style="font-weight: 600; color: #333;">👤 ${doc.colaborador.replace(/_/g, ' ')}</div><div style="font-size: 0.9em; color: #999;">${doc.nombre}</div></div><button class="btn-secondary btn-view" data-doc-id="${doc.id}" onclick="document.dispatchEvent(new CustomEvent('view-doc', {detail: ${doc.id}}))" style="padding: 6px 12px; font-size: 0.9em;">Ver</button></div>`;
                });
                html += `</div>`;
            });
            html += `</div></div>`;
        });
        dom.explorerContent.innerHTML = html;
        dom.explorerContent.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => viewDocument(parseInt(e.target.dataset.docId, 10)));
        });
    }

    // --- MODAL FUNCTIONS ---

    function showClassificationModal(file, imageUrl) {
        fileToProcess = { file, imageUrl };
        const modalHtml = `
            <img src="${imageUrl}" style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-bottom: 20px;">
            <div style="margin-bottom: 20px;">
                <label style="display: block; color: #333; font-weight: 600; margin-bottom: 10px;">Nombre del Colaborador:</label>
                <input type="text" id="colabName" placeholder="Ej: Jean Carlos Icabalzeta" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1em;">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; color: #333; font-weight: 600; margin-bottom: 10px;">Categoría:</label>
                <select id="categorySelect" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1em;">
                    <option value="monitores">📺 Monitores</option> <option value="laptops">💻 Laptops</option> <option value="tablets">📱 Tablets</option> <option value="perifericos">🖱️ Periféricos</option> <option value="activos">📦 Activos</option> <option value="otros">📄 Otros</option>
                </select>
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; color: #333; font-weight: 600; margin-bottom: 10px;">Información adicional:</label>
                <textarea id="docInfo" placeholder="Ej: Monitor Dell P2419H" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1em; min-height: 80px;"></textarea>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn-primary" data-action="save-classification" style="flex: 1;">✅ Guardar</button>
                <button class="btn-secondary" data-action="cancel-classification" style="flex: 1;">❌ Cancelar</button>
            </div>`;
        dom.modalTitle.textContent = 'Clasificar Documento';
        dom.modalBody.innerHTML = modalHtml;
        dom.modal.classList.add('active');
    }

    function closeClassificationModal() {
        dom.modal.classList.remove('active');
        fileToProcess = null;
    }

    function viewDocument(id) {
        const doc = documents.find(d => d.id === id);
        if (!doc) return;

        const infoHtml = `
            <div class="info-grid">
                <div class="info-card"><label>👤 Colaborador</label><div class="value">${doc.colaborador.replace(/_/g, ' ')}</div></div>
                <div class="info-card"><label>📁 Categoría</label><div class="value">${doc.categoria}</div></div>
                <div class="info-card"><label>📅 Fecha</label><div class="value">${doc.fecha}</div></div>
                <div class="info-card"><label>📄 Archivo</label><div class="value">${doc.nombre}</div></div>
            </div>
            <div style="margin-top: 20px;"><label style="display: block; color: #667eea; font-weight: 600; margin-bottom: 10px;">📂 Ruta guardada</label><div style="background: #f8f9fa; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 0.9em; color: #666; word-break: break-all;">${doc.rutaArchivo}</div></div>
            <div style="margin-top: 20px;"><label style="display: block; color: #667eea; font-weight: 600; margin-bottom: 10px;">📝 Texto extraído</label><div style="background: #1e1e1e; color: #00ff00; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 0.9em; max-height: 300px; overflow-y: auto;">${doc.texto.replace(/\n/g, '<br>')}</div></div>
            ${doc.url ? `<div style="margin-top: 20px;"><img src="${doc.url}" style="max-width: 100%; border-radius: 8px;"></div>` : ''}`;

        dom.modalTitle.textContent = doc.nombre;
        dom.modalBody.innerHTML = infoHtml;
        dom.modal.classList.add('active');
    }

    function closeModal() {
        dom.modal.classList.remove('active');
    }

    // --- CORE LOGIC ---

    function saveClassification() {
        if (!fileToProcess) return;

        const colaborador = document.getElementById('colabName').value.trim();
        const categoria = document.getElementById('categorySelect').value;
        const info = document.getElementById('docInfo').value.trim();

        if (!colaborador) {
            alert('Por favor ingresa el nombre del colaborador');
            return;
        }

        addLog(`✅ Clasificando: ${fileToProcess.file.name}`);
        addLog(`   Colaborador: ${colaborador}`);
        addLog(`   Categoría: ${categoria}`);

        const doc = {
            id: Date.now(),
            nombre: fileToProcess.file.name,
            colaborador: colaborador.replace(/ /g, '_'),
            categoria: categoria,
            fecha: new Date().toLocaleDateString('es-ES'),
            texto: `Documento: ${fileToProcess.file.name}\nColaborador: ${colaborador}\nCategoría: ${categoria}\nInformación: ${info}`,
            url: fileToProcess.imageUrl,
            rutaArchivo: `Activos GV/${new Date().toLocaleDateString('es-ES')}/${categoria}/${colaborador.replace(/ /g, '_')}/`
        };

        documents.push(doc);
        addLog(`✅ Guardado en: ${doc.rutaArchivo}`);

        closeClassificationModal();
        filterResults();
    }

    function processDocuments() {
        if (fileObjects.length === 0) return;

        addLog('🚀 Iniciando procesamiento...');
        dom.progressBar.classList.add('active');

        let processedCount = 0;
        const totalFiles = fileObjects.length;

        function updateProgress() {
            processedCount++;
            const progress = (processedCount / totalFiles) * 100;
            dom.progressFill.style.width = `${progress}%`;
            dom.progressFill.textContent = `${Math.round(progress)}%`;

            if (processedCount === totalFiles) {
                setTimeout(() => {
                    addLog(`✅ Completado: ${documents.length} documentos procesados`);
                    fileObjects = [];
                    dom.fileInput.value = '';
                    updateFilesList();
                    dom.progressBar.classList.remove('active');
                }, 1000);
            }
        }

        fileObjects.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                // Simula un pequeño retraso para cada archivo
                setTimeout(() => {
                    addLog(`📄 ${file.name} - Pendiente de clasificación`);
                    // Solo muestra un modal a la vez
                    if (!fileToProcess) {
                        showClassificationModal(file, e.target.result);
                    }
                    updateProgress();
                }, 300 * processedCount);
            };
            reader.readAsDataURL(file);
        });
    }

    // --- UTILITY FUNCTIONS ---

    function addLog(message) {
        const time = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
        dom.logContainer.appendChild(entry);
        dom.logContainer.scrollTop = dom.logContainer.scrollHeight;
    }

    // --- INITIALIZATION ---

    initializeEventListeners();

})();