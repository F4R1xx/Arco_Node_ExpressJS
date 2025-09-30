document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO FORMULÁRIO ---
    const form = document.getElementById('form-cadastro-ativo');
    const tipoAtivoSelect = document.getElementById('tipo-ativo');
    const localSelect = document.getElementById('local');
    const setorInput = document.getElementById('setor');
    const secoes = {
        estacao: document.getElementById('form-estacao-trabalho'),
        outro: document.getElementById('form-outro-ativo'),
        localizacao: document.getElementById('form-localizacao'),
        extraTelefone: document.getElementById('secao-extra-telefone')
    };
    const monitoresContainer = document.getElementById('monitores-container');
    const addMonitorBtn = document.getElementById('add-monitor-btn');
    let monitorCount = 0;
    
    // --- ELEMENTOS DO MAPA ---
    const mapModal = document.getElementById('map-selection-modal');
    const openMapModalBtn = document.getElementById('open-map-modal-btn');
    const closeMapModalBtn = document.getElementById('close-map-modal-btn');
    const mapBackground = document.getElementById('map-background');
    const mapModalBody = document.getElementById('map-modal-body');
    const mapMessage = document.getElementById('map-modal-message');
    const coordsStatus = document.getElementById('coords-status');
    const coordXInput = document.getElementById('coord-x');
    const coordYInput = document.getElementById('coord-y');
    const freePlacementToggle = document.getElementById('free-placement-toggle');

    // --- VARIÁVEIS DE ESTADO ---
    let allLocationsData = [];
    let selectedLocationArea = null;
    let transform = { scale: 1, translateX: 0, translateY: 0 };
    let isPanning = false;
    let startPan = { x: 0, y: 0 };

    // --- FUNÇÕES ---

    const loadLocations = async () => {
        try {
            const response = await fetch('/api/locais');
            allLocationsData = await response.json();
            localSelect.innerHTML = '<option value="" selected disabled>-- Selecione um local --</option>';
            allLocationsData.forEach(location => {
                const option = document.createElement('option');
                option.value = location.id;
                option.textContent = location.nome;
                localSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Falha ao carregar locais:', error);
        }
    };

    const toggleFormSections = () => {
        const tipo = tipoAtivoSelect.value;
        Object.values(secoes).forEach(sec => sec.hidden = true);
        if (tipo === 'Estação de Trabalho') {
            secoes.estacao.hidden = false;
            secoes.localizacao.hidden = false;
            if (monitoresContainer.childElementCount === 0) addMonitorField();
        } else if (tipo) {
            secoes.outro.hidden = false;
            secoes.localizacao.hidden = false;
            secoes.extraTelefone.hidden = (tipo !== 'Telefone');
        }
        resetCoordinates();
    };

    const addMonitorField = () => {
        const monitorId = ++monitorCount;
        const monitorEntry = document.createElement('div');
        monitorEntry.classList.add('monitor-entry');
        monitorEntry.innerHTML = `<button type="button" class="remove-monitor-btn"><i data-lucide="x"></i></button><div class="fields-grid two-columns"><div class="form-group"><label for="monitor-patrimonio-${monitorId}">Patrimônio</label><input type="text" class="monitor-patrimonio"></div><div class="form-group"><label for="monitor-serial-${monitorId}">Serial</label><input type="text" class="monitor-serial"></div><div class="form-group full-width"><label for="monitor-marca-${monitorId}">Marca/Modelo</label><input type="text" class="monitor-marca"></div><div class="form-group full-width"><label for="monitor-rfid-${monitorId}">RFID</label><input type="text" class="monitor-rfid"></div></div>`;
        monitoresContainer.appendChild(monitorEntry);
        lucide.createIcons();
    };
    
    const resetCoordinates = () => {
        coordXInput.value = '';
        coordYInput.value = '';
        coordsStatus.textContent = 'Nenhuma posição definida.';
        coordsStatus.classList.remove('success');
    };
    
    const applyTransform = () => {
        mapBackground.style.transform = `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`;
    };

    // --- EVENT LISTENERS ---

    tipoAtivoSelect.addEventListener('change', toggleFormSections);
    if (addMonitorBtn) addMonitorBtn.addEventListener('click', addMonitorField);
    monitoresContainer.addEventListener('click', e => e.target.closest('.remove-monitor-btn')?.closest('.monitor-entry')?.remove());

    freePlacementToggle.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        localSelect.disabled = isChecked;
        setorInput.disabled = isChecked;
        if (isChecked) {
            localSelect.value = '';
            setorInput.value = '';
            resetCoordinates();
        }
    });

    openMapModalBtn.addEventListener('click', () => {
        const isFreePlacement = freePlacementToggle.checked;
        mapBackground.innerHTML = ''; 
        selectedLocationArea = null;

        if (isFreePlacement) {
            mapMessage.textContent = 'Clique em qualquer lugar no mapa para posicionar o ativo.';
            mapMessage.classList.remove('error');
            transform = { scale: 0.5, translateX: (mapModalBody.clientWidth - mapBackground.clientWidth * 0.5) / 2, translateY: (mapModalBody.clientHeight - mapBackground.clientHeight * 0.5) / 2 };
            applyTransform();
            mapModal.hidden = false;
        } else {
            const selectedId = localSelect.value;
            if (!selectedId) return alert('Para posicionamento restrito, selecione um Prédio / Unidade primeiro.');
            
            const location = allLocationsData.find(loc => loc.id == selectedId);
            if (!location?.coords_json) return alert('O local selecionado não tem uma área definida. Use "Posicionamento Livre" ou defina a área em "Gerenciar Locais".');
            
            selectedLocationArea = JSON.parse(location.coords_json);
            const areaEl = document.createElement('div');
            areaEl.className = 'location-area-highlight';
            Object.assign(areaEl.style, { left: `${selectedLocationArea.x}px`, top: `${selectedLocationArea.y}px`, width: `${selectedLocationArea.width}px`, height: `${selectedLocationArea.height}px` });
            mapBackground.appendChild(areaEl);
            
            transform.scale = 1.5;
            transform.translateX = (mapModalBody.clientWidth / 2) - (selectedLocationArea.x + selectedLocationArea.width / 2) * transform.scale;
            transform.translateY = (mapModalBody.clientHeight / 2) - (selectedLocationArea.y + selectedLocationArea.height / 2) * transform.scale;
            applyTransform();
            mapMessage.textContent = 'Clique na área azul para posicionar o ativo.';
            mapMessage.classList.remove('error');
            mapModal.hidden = false;
        }
        lucide.createIcons();
    });

    closeMapModalBtn.addEventListener('click', () => mapModal.hidden = true);
    
    mapBackground.addEventListener('click', (e) => {
        const rect = mapBackground.getBoundingClientRect();
        const mapX = (e.clientX - rect.left) / transform.scale;
        const mapY = (e.clientY - rect.top) / transform.scale;

        const isFreePlacement = freePlacementToggle.checked;
        const isInArea = selectedLocationArea && (mapX >= selectedLocationArea.x && mapX <= selectedLocationArea.x + selectedLocationArea.width && mapY >= selectedLocationArea.y && mapY <= selectedLocationArea.y + selectedLocationArea.height);

        if (isFreePlacement || isInArea) {
            coordXInput.value = mapX;
            coordYInput.value = mapY;
            
            mapBackground.querySelector('.asset-marker-temp')?.remove();
            const marker = document.createElement('div');
            marker.className = 'asset-marker-temp';
            Object.assign(marker.style, { left: `${mapX}px`, top: `${mapY}px` });
            mapBackground.appendChild(marker);

            coordsStatus.textContent = 'Posição definida com sucesso!';
            coordsStatus.classList.add('success');
            setTimeout(() => mapModal.hidden = true, 500);
        } else {
            mapMessage.textContent = 'Posição inválida. Clique DENTRO da área destacada.';
            mapMessage.classList.add('error');
        }
    });

    mapModalBody.addEventListener('mousedown', (e) => { isPanning = true; startPan = { x: e.clientX - transform.translateX, y: e.clientY - transform.translateY }; mapModalBody.style.cursor = 'grabbing'; });
    window.addEventListener('mouseup', () => { isPanning = false; if(mapModalBody) mapModalBody.style.cursor = 'default'; });
    window.addEventListener('mousemove', (e) => { if (isPanning) { transform.translateX = e.clientX - startPan.x; transform.translateY = e.clientY - startPan.y; applyTransform(); }});

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tipo = tipoAtivoSelect.value;
        const isFreePlacement = freePlacementToggle.checked;
        if (!tipo) return alert('Por favor, selecione um tipo de ativo.');

        if (!isFreePlacement && !localSelect.value) {
            return alert('Selecione um Prédio / Unidade ou marque "Posicionamento Livre".');
        }
        const localNome = isFreePlacement ? '' : localSelect.options[localSelect.selectedIndex].text;
        const setorNome = setorInput.value;

        const localizacao = {
            local: localNome,
            setor: setorNome,
            coords_json: (coordXInput.value && coordYInput.value) ? JSON.stringify({ x: parseFloat(coordXInput.value), y: parseFloat(coordYInput.value) }) : null
        };

        let payload;
        if (tipo === 'Estação de Trabalho') {
            const monitores = Array.from(monitoresContainer.querySelectorAll('.monitor-entry')).map(entry => ({ patrimonio: entry.querySelector('.monitor-patrimonio').value, rfid: entry.querySelector('.monitor-rfid').value, serial: entry.querySelector('.monitor-serial').value, marca: entry.querySelector('.monitor-marca').value }));
            payload = { tipo, dados: { computador: { nome: document.getElementById('comp-nome').value, patrimonio: document.getElementById('comp-patrimonio').value, rfid: document.getElementById('comp-rfid').value, serial: document.getElementById('comp-serial').value, marca: document.getElementById('comp-marca').value }, monitores, perifericos: { teclado: document.getElementById('teclado').checked, mouse: document.getElementById('mouse').checked, headset: document.getElementById('headset').checked, mousepad: document.getElementById('mousepad').checked, suporte_headset: document.getElementById('suporte-headset').checked, webcam: document.getElementById('webcam').checked }, localizacao }};
        } else {
            const dados_especificos = (tipo === 'Telefone') ? { imei: document.getElementById('telefone-imei').value, ramal: document.getElementById('telefone-ramal').value } : {};
            payload = { tipo, dados: { nome: document.getElementById('ativo-nome').value, patrimonio: document.getElementById('ativo-patrimonio').value, serial: document.getElementById('ativo-serial').value, rfid: document.getElementById('ativo-rfid').value, marca_modelo: document.getElementById('ativo-marca').value, local: localNome, setor: setorNome, localizacao, dados_especificos }};
        }

        try {
            const response = await fetch('/api/ativos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Falha ao cadastrar.');
            alert(result.message);
            form.reset();
            freePlacementToggle.checked = false;
            localSelect.disabled = false;
            setorInput.disabled = false;
            toggleFormSections();
        } catch (error) {
            alert(`Erro ao cadastrar: ${error.message}`);
        }
    });

    loadLocations();
    lucide.createIcons();
});

