document.addEventListener('DOMContentLoaded', () => {
    const formCadastro = document.getElementById('form-cadastro');
    const listaItens = document.getElementById('lista-de-itens');

    // Função para buscar e exibir os itens
    async function fetchItens() {
        const response = await fetch('/api/itens');
        const itens = await response.json();
        
        listaItens.innerHTML = ''; // Limpa a lista antes de preencher
        itens.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `ID: ${item.id} | Nome: ${item.nome} | Localização: ${item.localizacao} | Status: ${item.status}`;
            listaItens.appendChild(li);
        });
    }

    // Adiciona um listener para o formulário de cadastro
    formCadastro.addEventListener('submit', async (e) => {
        e.preventDefault(); // Impede o envio padrão do formulário
        
        const nome = document.getElementById('nome').value;
        const localizacao = document.getElementById('localizacao').value;
        const status = document.getElementById('status').value;

        // Envia os dados para a API do back-end
        const response = await fetch('/api/itens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nome, localizacao, status })
        });
        
        if (response.ok) {
            alert('Item cadastrado com sucesso!');
            formCadastro.reset(); // Limpa o formulário
            fetchItens(); // Atualiza a lista de itens
        } else {
            alert('Erro ao cadastrar item.');
        }
    });

    // Carrega a lista de itens quando a página é carregada
    fetchItens();
});