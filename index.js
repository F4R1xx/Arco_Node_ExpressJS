const express = require('express');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const ping = require('ping');

const app = express();
const port = 3000;

let db;

async function setupDatabase() {
  db = await sqlite.open({
    filename: './database.db',
    driver: sqlite3.Database
  });
  console.log('Conectado ao banco de dados SQLite.');

  // Habilita as chaves estrangeiras para garantir a integridade dos dados
  await db.exec('PRAGMA foreign_keys = ON;');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ativos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT NOT NULL, nome_ativo TEXT,
      patrimonio TEXT, rfid TEXT, serial TEXT, marca_modelo TEXT, local TEXT,
      setor TEXT, ativo_pai_id INTEGER, dados_especificos TEXT,
      coords_json TEXT, status_online TEXT, ultimo_ping TIMESTAMP,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ativo_pai_id) REFERENCES ativos(id) ON DELETE CASCADE
    );
  `);
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS locais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      coords_json TEXT
    );
  `);

  // Adiciona novas colunas à tabela de ativos se elas não existirem
  const columnsToAdd = [
      { name: 'coords_json', type: 'TEXT' },
      { name: 'status_online', type: 'TEXT' },
      { name: 'ultimo_ping', type: 'TIMESTAMP' }
  ];
  for (const col of columnsToAdd) {
      try {
          await db.exec(`ALTER TABLE ativos ADD COLUMN ${col.name} ${col.type}`);
          console.log(`Coluna "${col.name}" adicionada à tabela "ativos".`);
      } catch (err) {
          if (!err.message.includes('duplicate column name')) {
              console.error(`Erro ao adicionar coluna ${col.name}:`, err);
          }
      }
  }
  
  console.log('Tabelas "ativos" e "locais" prontas.');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- ROTAS DE API PARA LOCAIS ---
app.get('/api/locais', async (req, res) => { /* ... (código existente, sem alterações) ... */ });
app.post('/api/locais', async (req, res) => { /* ... (código existente, sem alterações) ... */ });
app.delete('/api/locais/:id', async (req, res) => { /* ... (código existente, sem alterações) ... */ });

// --- ROTAS DE API PARA ATIVOS ---

// ROTA DE PING
app.post('/api/ping', async (req, res) => {
    const { hostname } = req.body;
    if (!hostname) {
        return res.status(400).json({ error: 'O nome do host é obrigatório.' });
    }

    try {
        const result = await ping.promise.probe(hostname);
        const status = result.alive ? 'Online' : 'Offline';
        const timestamp = new Date().toISOString();

        await db.run('UPDATE ativos SET status_online = ?, ultimo_ping = ? WHERE nome_ativo = ?', [status, timestamp, hostname]);
        
        res.json({ status, timestamp });
    } catch (error) {
        console.error(`Erro ao pingar ${hostname}:`, error);
        res.status(500).json({ error: `Falha ao executar o ping para ${hostname}.` });
    }
});


app.get('/api/ativos', async (req, res) => {
    try {
        const ativos = await db.all('SELECT * FROM ativos ORDER BY nome_ativo');
        res.json(ativos);
    } catch (err) {
        res.status(500).json({ error: 'Falha ao buscar dados dos ativos.' });
    }
});

app.post('/api/ativos', async (req, res) => {
    const { tipo, dados } = req.body;
    if (!tipo || !dados) return res.status(400).json({ error: 'Dados inválidos.' });

    try {
        await db.run('BEGIN TRANSACTION');
        if (tipo === 'Estação de Trabalho') {
            const { computador, monitores, localizacao, coords_json } = dados;
            const result = await db.run(
                'INSERT INTO ativos (tipo, nome_ativo, patrimonio, rfid, serial, marca_modelo, local, setor, coords_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [tipo, computador.nome, computador.patrimonio, computador.rfid, computador.serial, computador.marca, localizacao.local, localizacao.setor, coords_json]
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
                'INSERT INTO ativos (tipo, nome_ativo, patrimonio, rfid, serial, marca_modelo, local, setor, dados_especificos, coords_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [tipo, dados.nome, dados.patrimonio, dados.rfid, dados.serial, dados.marca_modelo, dados.local, dados.setor, dadosEspecificos, dados.coords_json]
            );
        }
        await db.run('COMMIT');
        res.status(201).json({ message: 'Ativo cadastrado com sucesso!' });
    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ error: 'Erro interno ao salvar o ativo.' });
    }
});

app.put('/api/ativos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome_ativo, patrimonio, serial, rfid, marca_modelo, local, setor, dados_especificos } = req.body;
    try {
        const result = await db.run(
            `UPDATE ativos SET nome_ativo = ?, patrimonio = ?, serial = ?, rfid = ?, marca_modelo = ?, local = ?, setor = ?, dados_especificos = ? WHERE id = ?`,
            [nome_ativo, patrimonio, serial, rfid, marca_modelo, local, setor, JSON.stringify(dados_especificos), id]
        );
        if (result.changes === 0) return res.status(404).json({ error: 'Ativo não encontrado.' });
        res.status(200).json({ message: 'Ativo atualizado com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro interno ao atualizar o ativo.' });
    }
});

app.delete('/api/ativos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const asset = await db.get('SELECT tipo FROM ativos WHERE id = ?', id);
        if (!asset) {
            return res.status(404).json({ error: 'Ativo não encontrado.' });
        }
        // Se for Estação de Trabalho, a exclusão em cascata (ON DELETE CASCADE) cuidará dos monitores.
        const result = await db.run('DELETE FROM ativos WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Ativo não encontrado para exclusão.' });
        }
        res.status(200).json({ message: 'Ativo e seus componentes foram excluídos com sucesso!' });
    } catch (err) {
        console.error("Erro ao excluir ativo:", err.message);
        res.status(500).json({ error: 'Erro interno ao excluir o ativo.' });
    }
});

async function startServer() {
  await setupDatabase();
  app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
  });
}

startServer();

