document.addEventListener('DOMContentLoaded', () => {
    // --- (declarações de variáveis existentes) ---
    const assetList = document.getElementById('asset-list');
    const loadingSpinner = document.getElementById('loading-spinner');
    const noResults = document.getElementById('no-results');
    const searchInput = document.getElementById('search-input');
    const filterTipo = document.getElementById('filter-tipo');
    const modalContainer = document.getElementById('modal-container');
    const modalBody = document.getElementById('modal-body');
    const modalActions = document.getElementById('modal-actions');
    const closeModalBtn = document.getElementById('close-modal');

    let allAssets = [];
    let currentAssetId = null;

    const typeTagClasses = {
        'Estação de Trabalho': 'tag-estacao',
        'Monitor': 'tag-monitor',
        'Telefone': 'tag-telefone',
        'Câmera': 'tag-camera',
        'Switch': 'tag-switch'
    };
    
    // --- (função renderAssets existente) ---
    const renderAssets = (assets) => {
        assetList.innerHTML = '';
        if (assets.length === 0) {
            noResults.hidden = false;
            return;
        }
        noResults.hidden = true;
        assets.forEach(asset => {
            if (asset.ativo_pai_id) return;
            const item = document.createElement('div');
            item.className = 'asset-list-item';
            item.innerHTML = `<div class="col-tipo"><span class="type-tag ${typeTagClasses[asset.tipo] || 'tag-default'}">${asset.tipo}</span></div><div class="col-nome">${asset.nome_ativo || 'N/A'}</div><div class="col-local">${asset.setor ? `${asset.local} / ${asset.setor}` : asset.local || 'N/A'}</div><div class="col-patrimonio">${asset.patrimonio || 'N/A'}</div><div class="col-actions"><button class="view-details-btn" data-id="${asset.id}" title="Ver detalhes"><i data-lucide="more-horizontal"></i></button></div>`;
            assetList.appendChild(item);
        });
        lucide.createIcons();
    };

    // --- FUNÇÕES DE VISUALIZAÇÃO E EDIÇÃO NO MODAL ---

    // Gera o HTML para o modo de VISUALIZAÇÃO
    const createViewModeHtml = (asset) => {
        const childMonitors = allAssets.filter(a => a.ativo_pai_id === asset.id);
        const dados = JSON.parse(asset.dados_especificos || '{}');
        
        let detailsHtml = `<div class="modal-header"><h2>${asset.nome_ativo || 'Ativo sem nome'}</h2><span class="type-tag ${typeTagClasses[asset.tipo] || 'tag-default'}">${asset.tipo}</span></div><div class="detail-grid">${asset.patrimonio ? `<div class="detail-item"><strong>Patrimônio</strong><span>${asset.patrimonio}</span></div>` : ''}${asset.serial ? `<div class="detail-item"><strong>Serial</strong><span>${asset.serial}</span></div>` : ''}${asset.marca_modelo ? `<div class="detail-item"><strong>Marca/Modelo</strong><span>${asset.marca_modelo}</span></div>` : ''}${asset.rfid ? `<div class="detail-item"><strong>RFID</strong><span>${asset.rfid}</span></div>` : ''}${asset.local ? `<div class="detail-item"><strong>Local</strong><span>${asset.local}</span></div>` : ''}${asset.setor ? `<div class="detail-item"><strong>Setor</strong><span>${asset.setor}</span></div>` : ''}</div>`;

        let specificDataHtml = '';
        if (dados.imei) specificDataHtml += `<div class="detail-item"><strong>IMEI</strong><span>${dados.imei}</span></div>`;
        if (dados.ramal) specificDataHtml += `<div class="detail-item"><strong>Ramal</strong><span>${dados.ramal}</span></div>`;
        if(specificDataHtml) detailsHtml += `<h3 class="detail-section-title">Dados Específicos</h3><div class="detail-grid">${specificDataHtml}</div>`;

        if (dados.perifericos) {
            const perifericosHtml = Object.entries(dados.perifericos).filter(([, value]) => value).map(([key]) => `<li>${key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}</li>`).join('');
            if(perifericosHtml) detailsHtml += `<h3 class="detail-section-title">Periféricos</h3><ul>${perifericosHtml}</ul>`;
        }
        
        if (childMonitors.length > 0) {
            detailsHtml += `<h3 class="detail-section-title">Monitores Vinculados</h3>`;
            childMonitors.forEach(monitor => {
                detailsHtml += `<div class="detail-grid monitor-child">${monitor.patrimonio ? `<div class="detail-item"><strong>Patrimônio</strong><span>${monitor.patrimonio}</span></div>` : ''}${monitor.serial ? `<div class="detail-item"><strong>Serial</strong><span>${monitor.serial}</span></div>` : ''}${monitor.marca_modelo ? `<div class="detail-item"><strong>Marca/Modelo</strong><span>${monitor.marca_modelo}</span></div>` : ''}</div>`;
            });
        }
        return detailsHtml;
    };

    // Gera o HTML para o modo de EDIÇÃO (formulário)
    const createEditModeHtml = (asset) => {
        const dados = JSON.parse(asset.dados_especificos || '{}');
        // A função (val || '') garante que campos nulos se tornem strings vazias nos inputs
        const v = (val) => val || '';
        
        return `
            <div class="modal-header"><h2>Editando: ${v(asset.nome_ativo)}</h2></div>
            <form id="edit-asset-form">
                <div class="detail-grid">
                    <div class="form-group"><label for="edit-nome">Nome / Identificador</label><input type="text" id="edit-nome" value="${v(asset.nome_ativo)}"></div>
                    <div class="form-group"><label for="edit-patrimonio">Patrimônio</label><input type="text" id="edit-patrimonio" value="${v(asset.patrimonio)}"></div>
                    <div class="form-group"><label for="edit-serial">Serial</label><input type="text" id="edit-serial" value="${v(asset.serial)}"></div>
                    <div class="form-group"><label for="edit-rfid">RFID</label><input type="text" id="edit-rfid" value="${v(asset.rfid)}"></div>
                    <div class="form-group"><label for="edit-marca">Marca/Modelo</label><input type="text" id="edit-marca" value="${v(asset.marca_modelo)}"></div>
                    <div class="form-group"><label for="edit-setor">Setor</label><input type="text" id="edit-setor" value="${v(asset.setor)}"></div>
                </div>
                ${asset.tipo === 'Telefone' ? `
                <h3 class="detail-section-title">Dados Específicos</h3>
                <div class="detail-grid">
                    <div class="form-group"><label for="edit-imei">IMEI</label><input type="text" id="edit-imei" value="${v(dados.imei)}"></div>
                    <div class="form-group"><label for="edit-ramal">Ramal</label><input type="text" id="edit-ramal" value="${v(dados.ramal)}"></div>
                </div>
                ` : ''}
            </form>
        `;
    };

    // Abre o modal e define o modo (visualização ou edição)
    const openModal = (assetId, mode = 'view') => {
        currentAssetId = assetId;
        const asset = allAssets.find(a => a.id === assetId);
        if (!asset) return;

        if (mode === 'view') {
            modalBody.innerHTML = createViewModeHtml(asset);
            modalActions.innerHTML = `<button id="edit-btn" class="btn btn-primary">Editar</button>`;
            document.getElementById('edit-btn').addEventListener('click', () => openModal(assetId, 'edit'));
        } else {
            modalBody.innerHTML = createEditModeHtml(asset);
            modalActions.innerHTML = `<button id="cancel-btn" class="btn btn-secondary">Cancelar</button><button id="save-btn" class="btn btn-primary">Salvar Alterações</button>`;
            document.getElementById('cancel-btn').addEventListener('click', () => openModal(assetId, 'view'));
            document.getElementById('save-btn').addEventListener('click', handleSave);
        }
        modalContainer.hidden = false;
        lucide.createIcons();
    };

    // Coleta os dados do formulário de edição e envia para a API
    const handleSave = async () => {
        if (!currentAssetId) return;
        const asset = allAssets.find(a => a.id === currentAssetId);
        const dados = JSON.parse(asset.dados_especificos || '{}');

        const updatedData = {
            nome_ativo: document.getElementById('edit-nome').value,
            patrimonio: document.getElementById('edit-patrimonio').value,
            serial: document.getElementById('edit-serial').value,
            rfid: document.getElementById('edit-rfid').value,
            marca_modelo: document.getElementById('edit-marca').value,
            local: document.getElementById('edit-local').value,
            setor: document.getElementById('edit-setor').value,
            dados_especificos: {
                ...dados,
                imei: asset.tipo === 'Telefone' ? document.getElementById('edit-imei').value : dados.imei,
                ramal: asset.tipo === 'Telefone' ? document.getElementById('edit-ramal').value : dados.ramal,
            }
        };

        try {
            const response = await fetch(`/api/ativos/${currentAssetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            
            alert(result.message);
            modalContainer.hidden = true;
            await fetchAssets(); // Re-busca todos os ativos para atualizar a lista
            
        } catch (error) {
            alert(`Erro ao salvar: ${error.message}`);
        }
    };
    
    // --- (funções fetchAssets e filterAndSearch existentes) ---
    const fetchAssets = async () => {
        loadingSpinner.hidden = false;
        try {
            const response = await fetch('/api/ativos');
            if (!response.ok) throw new Error('Falha ao carregar os dados.');
            allAssets = await response.json();
            filterAndSearch();
        } catch (error) {
            assetList.innerHTML = `<p class="no-results-message">Erro ao carregar ativos. Tente novamente.</p>`;
            console.error(error);
        } finally {
            loadingSpinner.hidden = true;
        }
    };

    const filterAndSearch = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const tipo = filterTipo.value;
        const filteredAssets = allAssets.filter(asset => {
            const matchesSearch = searchTerm === '' || ['nome_ativo', 'patrimonio', 'serial'].some(field => asset[field] && asset[field].toLowerCase().includes(searchTerm));
            const matchesType = tipo === 'todos' || asset.tipo === tipo;
            return matchesSearch && matchesType;
        });
        renderAssets(filteredAssets);
    };

    // --- Event Listeners ---
    searchInput.addEventListener('input', filterAndSearch);
    filterTipo.addEventListener('change', filterAndSearch);

    assetList.addEventListener('click', (e) => {
        const button = e.target.closest('.view-details-btn');
        if (button) {
            openModal(parseInt(button.dataset.id, 10), 'view');
        }
    });

    closeModalBtn.addEventListener('click', () => modalContainer.hidden = true);
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer) modalContainer.hidden = true;
    });

    fetchAssets();
});

