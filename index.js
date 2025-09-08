const express = require('express');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

const app = express();
const port = 3000;

let db;

async function setupDatabase() {
  db = await sqlite.open({
    filename: './database.db',
    driver: sqlite3.Database
  });
  console.log('Conectado ao banco de dados SQLite.');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ativos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      nome_ativo TEXT,
      patrimonio TEXT,
      rfid TEXT,
      serial TEXT,
      marca_modelo TEXT,
      local TEXT,
      setor TEXT,
      ativo_pai_id INTEGER,
      dados_especificos TEXT,
      data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ativo_pai_id) REFERENCES ativos(id) ON DELETE SET NULL
    );
  `);
  console.log('Tabela "ativos" pronta.');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ROTA DE CRIAÇÃO (POST)
app.post('/api/ativos', async (req, res) => {
  const { tipo, dados } = req.body;
  // ... (código existente para criar ativos)
  if (!tipo || !dados) {
    return res.status(400).json({ error: 'Tipo e dados do ativo são obrigatórios.' });
  }

  try {
    await db.exec('BEGIN TRANSACTION');
    let ativoPaiId = null;

    if (tipo === 'Estação de Trabalho') {
      const { computador, monitores, perifericos, localizacao } = dados;
      const result = await db.run(
        `INSERT INTO ativos (tipo, nome_ativo, patrimonio, rfid, serial, marca_modelo, local, setor, dados_especificos)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ 'Estação de Trabalho', computador.nome, computador.patrimonio, computador.rfid, computador.serial, computador.marca, localizacao.local, localizacao.setor, JSON.stringify({ perifericos }) ]
      );
      ativoPaiId = result.lastID;

      if (monitores && monitores.length > 0) {
        const stmt = await db.prepare(`INSERT INTO ativos (tipo, patrimonio, rfid, serial, marca_modelo, ativo_pai_id) VALUES ('Monitor', ?, ?, ?, ?, ?)`);
        for (const monitor of monitores) {
          if (Object.values(monitor).some(val => val && val.trim() !== '')) {
            await stmt.run(monitor.patrimonio, monitor.rfid, monitor.serial, monitor.marca, ativoPaiId);
          }
        }
        await stmt.finalize();
      }
    } else {
      const { nome, patrimonio, rfid, serial, marca_modelo, local, setor, dados_especificos } = dados;
      const result = await db.run(
        `INSERT INTO ativos (tipo, nome_ativo, patrimonio, rfid, serial, marca_modelo, local, setor, dados_especificos)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tipo, nome, patrimonio, rfid, serial, marca_modelo, local, setor, JSON.stringify(dados_especificos || {})]
      );
      ativoPaiId = result.lastID;
    }

    await db.exec('COMMIT');
    res.status(201).json({ id: ativoPaiId, message: `Ativo do tipo "${tipo}" cadastrado com sucesso!` });

  } catch (err) {
    await db.exec('ROLLBACK');
    console.error('Erro no cadastro do ativo:', err.message);
    res.status(500).json({ error: 'Erro ao cadastrar o ativo.' });
  }
});

// --- NOVA ROTA DE ATUALIZAÇÃO (PUT) ---
app.put('/api/ativos/:id', async (req, res) => {
    const { id } = req.params;
    const dados = req.body;

    try {
        // Atualiza os campos principais
        await db.run(
            `UPDATE ativos SET
                nome_ativo = ?,
                patrimonio = ?,
                rfid = ?,
                serial = ?,
                marca_modelo = ?,
                local = ?,
                setor = ?,
                dados_especificos = ?
            WHERE id = ?`,
            [
                dados.nome_ativo,
                dados.patrimonio,
                dados.rfid,
                dados.serial,
                dados.marca_modelo,
                dados.local,
                dados.setor,
                JSON.stringify(dados.dados_especificos || {}),
                id
            ]
        );
        res.status(200).json({ message: 'Ativo atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro na atualização do ativo:', err.message);
        res.status(500).json({ error: 'Erro ao atualizar o ativo.' });
    }
});


// ROTA DE LEITURA (GET)
app.get('/api/ativos', async (req, res) => {
  try {
    const ativos = await db.all('SELECT * FROM ativos ORDER BY data_cadastro DESC');
    res.json(ativos);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar ativos.' });
  }
});

async function startServer() {
  await setupDatabase();
  app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
  });
}

startServer();

