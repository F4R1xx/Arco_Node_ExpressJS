const express = require('express');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

const app = express();
const port = 3000;

let db;

// Função para configurar o banco de dados
async function setupDatabase() {
  db = await sqlite.open({
    filename: './database.db',
    driver: sqlite3.Database
  });
  console.log('Conectado ao banco de dados SQLite.');

  // Cria a tabela de ativos (sem alterações)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ativos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT NOT NULL, nome_ativo TEXT,
      patrimonio TEXT, rfid TEXT, serial TEXT, marca_modelo TEXT, local TEXT,
      setor TEXT, ativo_pai_id INTEGER, dados_especificos TEXT,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ativo_pai_id) REFERENCES ativos(id) ON DELETE SET NULL
    );
  `);
  
  // ATUALIZADO: Tabela de locais agora armazena as coordenadas da área
  await db.exec(`
    CREATE TABLE IF NOT EXISTS locais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      coords_json TEXT
    );
  `);

  // Garante que bancos de dados antigos tenham a nova coluna
  try {
    await db.exec('ALTER TABLE locais ADD COLUMN coords_json TEXT');
    console.log('Coluna "coords_json" adicionada à tabela "locais".');
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.error('Erro ao alterar tabela "locais":', err);
    }
  }
  
  console.log('Tabelas "ativos" e "locais" prontas.');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- ROTAS DE API PARA LOCAIS ---

// GET para buscar todos os locais (agora retorna coordenadas também)
app.get('/api/locais', async (req, res) => {
    try {
        const locais = await db.all('SELECT * FROM locais ORDER BY nome');
        res.json(locais);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar locais.' });
    }
});

// POST para adicionar um novo local (agora aceita coordenadas)
app.post('/api/locais', async (req, res) => {
    const { nome, coords_json } = req.body;
    if (!nome) {
        return res.status(400).json({ error: 'O nome do local é obrigatório.' });
    }
    try {
        const result = await db.run('INSERT INTO locais (nome, coords_json) VALUES (?, ?)', [nome, coords_json]);
        res.status(201).json({ id: result.lastID, nome, coords_json });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ error: 'Este local já existe.' });
        }
        res.status(500).json({ error: 'Erro ao adicionar o local.' });
    }
});

// DELETE para apagar um local
app.delete('/api/locais/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const local = await db.get('SELECT nome FROM locais WHERE id = ?', [id]);
        if (!local) {
            return res.status(404).json({ error: 'Local não encontrado.' });
        }

        const ativoUsando = await db.get('SELECT id FROM ativos WHERE local = ? OR setor = ?', [local.nome, local.nome]);
        if (ativoUsando) {
            return res.status(400).json({ error: 'Este local não pode ser apagado pois está em uso por um ou mais ativos.' });
        }

        await db.run('DELETE FROM locais WHERE id = ?', [id]);
        res.status(200).json({ message: 'Local apagado com sucesso!' });

    } catch (err) {
        console.error("Erro ao apagar local:", err.message);
        res.status(500).json({ error: 'Erro ao apagar o local.' });
    }
});


// --- ROTAS DE API PARA ATIVOS ---

app.get('/api/ativos', async (req, res) => {
    try {
        const ativos = await db.all('SELECT * FROM ativos ORDER BY nome_ativo');
        res.json(ativos);
    } catch (err) {
        console.error("Erro ao buscar ativos:", err.message);
        res.status(500).json({ error: 'Falha ao buscar dados dos ativos.' });
    }
});

app.post('/api/ativos', async (req, res) => {
    const { tipo, dados } = req.body;
    if (!tipo || !dados) {
        return res.status(400).json({ error: 'Dados inválidos.' });
    }

    try {
        await db.run('BEGIN TRANSACTION');

        if (tipo === 'Estação de Trabalho') {
            const { computador, monitores, perifericos, localizacao } = dados;
            const dadosComputador = JSON.stringify({ perifericos });
            
            const result = await db.run(
                'INSERT INTO ativos (tipo, nome_ativo, patrimonio, rfid, serial, marca_modelo, local, setor, dados_especificos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                ['Estação de Trabalho', computador.nome, computador.patrimonio, computador.rfid, computador.serial, computador.marca, localizacao.local, localizacao.setor, dadosComputador]
            );
            const computadorId = result.lastID;

            for (const monitor of monitores) {
                await db.run(
                    'INSERT INTO ativos (tipo, patrimonio, rfid, serial, marca_modelo, ativo_pai_id, local, setor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    ['Monitor', monitor.patrimonio, monitor.rfid, monitor.serial, monitor.marca, computadorId, localizacao.local, localizacao.setor]
                );
            }
        } else {
            const dadosEspecificos = JSON.stringify(dados.dados_especificos || {});
            await db.run(
                'INSERT INTO ativos (tipo, nome_ativo, patrimonio, rfid, serial, marca_modelo, local, setor, dados_especificos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [tipo, dados.nome, dados.patrimonio, dados.rfid, dados.serial, dados.marca_modelo, dados.local, dados.setor, dadosEspecificos]
            );
        }

        await db.run('COMMIT');
        res.status(201).json({ message: 'Ativo cadastrado com sucesso!' });
    } catch (err) {
        await db.run('ROLLBACK');
        console.error("Erro ao cadastrar ativo:", err.message);
        res.status(500).json({ error: 'Erro interno ao salvar o ativo.' });
    }
});


app.put('/api/ativos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome_ativo, patrimonio, serial, rfid, marca_modelo, local, setor, dados_especificos } = req.body;

    try {
        const result = await db.run(
            `UPDATE ativos SET 
                nome_ativo = ?, patrimonio = ?, serial = ?, rfid = ?, 
                marca_modelo = ?, local = ?, setor = ?, dados_especificos = ?
            WHERE id = ?`,
            [nome_ativo, patrimonio, serial, rfid, marca_modelo, local, setor, JSON.stringify(dados_especificos), id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Ativo não encontrado.' });
        }
        res.status(200).json({ message: 'Ativo atualizado com sucesso!' });
    } catch (err) {
        console.error("Erro ao atualizar ativo:", err.message);
        res.status(500).json({ error: 'Erro interno ao atualizar o ativo.' });
    }
});


async function startServer() {
  await setupDatabase();
  app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
  });
}

startServer();
