document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-cadastro-ativo');
    const tipoAtivoSelect = document.getElementById('tipo-ativo');
    const localSelect = document.getElementById('local');
    
    const secoes = {
        estacao: document.getElementById('form-estacao-trabalho'),
        outro: document.getElementById('form-outro-ativo'),
        localizacao: document.getElementById('form-localizacao'),
        extraTelefone: document.getElementById('secao-extra-telefone')
    };

    const monitoresContainer = document.getElementById('monitores-container');
    const addMonitorBtn = document.getElementById('add-monitor-btn');
    let monitorCount = 0;

    // --- FUNÇÃO PARA CARREGAR LOCAIS ---
    const loadLocations = async () => {
        try {
            const response = await fetch('/api/locais');
            const locations = await response.json();
            localSelect.innerHTML = '<option value="" selected disabled>-- Selecione um local --</option>';
            locations.forEach(location => {
                const option = document.createElement('option');
                option.value = location.nome;
                option.textContent = location.nome;
                localSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Falha ao carregar locais:', error);
            localSelect.innerHTML = '<option value="">Erro ao carregar locais</option>';
        }
    };

    // --- LÓGICA PARA EXIBIR FORMULÁRIO CORRETO ---
    tipoAtivoSelect.addEventListener('change', (e) => {
        const tipo = e.target.value;
        Object.values(secoes).forEach(sec => sec.hidden = true);

        if (tipo === 'Estação de Trabalho') {
            secoes.estacao.hidden = false;
            secoes.localizacao.hidden = false;
            if (monitoresContainer.childElementCount === 0) {
                addMonitorField();
            }
        } else if (tipo) {
            secoes.outro.hidden = false;
            secoes.localizacao.hidden = false;
            secoes.extraTelefone.hidden = (tipo !== 'Telefone');
        }
    });

    // --- LÓGICA PARA ADICIONAR/REMOVER MONITORES ---
    const addMonitorField = () => {
        monitorCount++;
        const monitorId = monitorCount;
        const monitorEntry = document.createElement('div');
        monitorEntry.classList.add('monitor-entry');
        monitorEntry.setAttribute('id', `monitor-entry-${monitorId}`);
        monitorEntry.innerHTML = `
            <button type="button" class="remove-monitor-btn" data-monitor-id="${monitorId}"><i data-lucide="x"></i></button>
            <div class="fields-grid two-columns">
                <div class="form-group"><label for="monitor-patrimonio-${monitorId}">Patrimônio</label><input type="text" id="monitor-patrimonio-${monitorId}" class="monitor-patrimonio"></div>
                <div class="form-group"><label for="monitor-serial-${monitorId}">Serial</label><input type="text" id="monitor-serial-${monitorId}" class="monitor-serial"></div>
                <div class="form-group full-width"><label for="monitor-marca-${monitorId}">Marca/Modelo</label><input type="text" id="monitor-marca-${monitorId}" class="monitor-marca"></div>
                <div class="form-group full-width"><label for="monitor-rfid-${monitorId}">RFID</label><input type="text" id="monitor-rfid-${monitorId}" class="monitor-rfid"></div>
            </div>
        `;
        monitoresContainer.appendChild(monitorEntry);
        lucide.createIcons();
    };

    if (addMonitorBtn) {
      addMonitorBtn.addEventListener('click', addMonitorField);
    }

    monitoresContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-monitor-btn');
        if (removeBtn) {
            document.getElementById(`monitor-entry-${removeBtn.dataset.monitorId}`).remove();
        }
    });

    // --- LÓGICA DE SUBMISSÃO DO FORMULÁRIO ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tipo = tipoAtivoSelect.value;
        if (!tipo) {
            alert('Por favor, selecione um tipo de ativo.');
            return;
        }

        let payload;

        if (tipo === 'Estação de Trabalho') {
            const monitores = [];
            monitoresContainer.querySelectorAll('.monitor-entry').forEach(entry => {
                monitores.push({
                    patrimonio: entry.querySelector('.monitor-patrimonio').value,
                    rfid: entry.querySelector('.monitor-rfid').value,
                    serial: entry.querySelector('.monitor-serial').value,
                    marca: entry.querySelector('.monitor-marca').value,
                });
            });
            payload = {
                tipo,
                dados: {
                    computador: {
                        nome: document.getElementById('comp-nome').value,
                        patrimonio: document.getElementById('comp-patrimonio').value,
                        rfid: document.getElementById('comp-rfid').value,
                        serial: document.getElementById('comp-serial').value,
                        marca: document.getElementById('comp-marca').value,
                    },
                    monitores,
                    perifericos: {
                        teclado: document.getElementById('teclado').checked,
                        mouse: document.getElementById('mouse').checked,
                        headset: document.getElementById('headset').checked,
                        mousepad: document.getElementById('mousepad').checked,
                        suporte_headset: document.getElementById('suporte-headset').checked,
                        webcam: document.getElementById('webcam').checked,
                    },
                    localizacao: {
                        local: document.getElementById('local').value,
                        setor: document.getElementById('setor').value,
                    }
                }
            };
        } else {
            const dados_especificos = {};
            if (tipo === 'Telefone') {
                dados_especificos.imei = document.getElementById('telefone-imei').value;
                dados_especificos.ramal = document.getElementById('telefone-ramal').value;
            }

            payload = {
                tipo,
                dados: {
                    nome: document.getElementById('ativo-nome').value,
                    patrimonio: document.getElementById('ativo-patrimonio').value,
                    serial: document.getElementById('ativo-serial').value,
                    rfid: document.getElementById('ativo-rfid').value,
                    marca_modelo: document.getElementById('ativo-marca').value,
                    local: document.getElementById('local').value,
                    setor: document.getElementById('setor').value,
                    dados_especificos,
                }
            };
        }

        try {
            const response = await fetch('/api/ativos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (response.ok) {
                alert(result.message);
                form.reset();
                tipoAtivoSelect.dispatchEvent(new Event('change'));
            } else {
                throw new Error(result.error || 'Falha ao cadastrar o ativo.');
            }
        } catch (error) {
            console.error('Erro:', error);
            alert(`Erro ao cadastrar: ${error.message}`);
        }
    });

    // Inicia o carregamento dos locais
    loadLocations();
    lucide.createIcons();
});