const express = require('express');
const { conectarBanco, getDb } = require('./db');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt'); // Criptografia de senhas
const jwt = require('jsonwebtoken'); // Geração de tokens
const verificarToken = require('./auth'); // Middleware de autenticação na mesma pasta

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ==========================================
// ROTAS DE AUTENTICAÇÃO (PÚBLICAS)
// ==========================================

// Rota para Registar um Novo Utilizador
app.post('/usuarios/registrar', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Preencha todos os campos: nome, email e senha.' });
        }

        const colecaoUsuarios = getDb().collection('usuarios');

        // Verifica se o email já está registado
        const usuarioExistente = await colecaoUsuarios.findOne({ email });
        if (usuarioExistente) {
            return res.status(400).json({ erro: 'Este email já está registado.' });
        }

        // Criptografa a senha usando bcrypt
        const senhaCriptografada = await bcrypt.hash(senha, 10);

        // Insere o utilizador na collection 'usuarios'
        const resultado = await colecaoUsuarios.insertOne({
            nome,
            email,
            senha: senhaCriptografada,
            criadoEm: new Date()
        });

        console.log(`✅ Novo utilizador registado: ${email}`);

        res.status(201).json({
            mensagem: 'Utilizador registado com sucesso!',
            id: resultado.insertedId
        });
    } catch (erro) {
        console.error('❌ Erro ao registar utilizador:', erro);
        res.status(500).json({ erro: 'Não foi possível registar o utilizador.' });
    }
});

// Rota para Login do Utilizador
app.post('/usuarios/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ erro: 'Informe o email e a senha.' });
        }

        const colecaoUsuarios = getDb().collection('usuarios');
        const usuario = await colecaoUsuarios.findOne({ email });

        if (!usuario) {
            return res.status(401).json({ erro: 'Email ou senha incorretos.' });
        }

        // Compara a senha informada com o hash guardado no banco
        const senhaValida = await bcrypt.compare(senha, usuario.senha);

        if (!senhaValida) {
            return res.status(401).json({ erro: 'Email ou senha incorretos.' });
        }

        // Gera o Token JWT usando a secret do .env
        const token = jwt.sign(
            { id: usuario._id, email: usuario.email },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        console.log(`🔑 Login efetuado com sucesso para: ${email}`);

        res.status(200).json({
            mensagem: 'Login efetuado com sucesso!',
            token
        });
    } catch (erro) {
        console.error('❌ Erro ao fazer login:', erro);
        res.status(500).json({ erro: 'Erro interno ao tentar fazer login.' });
    }
});

// ==========================================
// ROTAS GERAIS / PÚBLICAS
// ==========================================

app.get('/', (req, res) => {
    res.send('🎵 API de Música Gospel funcionando com Autenticação!');
});

// Listar músicas é público
app.get('/musicas', async (req, res) => {
    try {
        const colecao = getDb().collection('lista_musicas');
        const musicas = await colecao.find({}).toArray();

        console.log('\n📋 Músicas cadastradas no MongoDB:');
        console.table(musicas.map(musica => ({
            id: musica._id.toString(),
            titulo: musica.titulo,
            artista: musica.artista,
            album: musica.album,
            ano: musica.ano
        })));

        res.status(200).json(musicas);
    } catch (erro) {
        console.error('❌ Erro ao buscar músicas:', erro);
        res.status(500).json({ erro: 'Não foi possível buscar as músicas.' });
    }
});

// Pesquisar no Deezer é público
app.get('/deezer/pesquisar/:termo', async (req, res) => {
    try {
        const termo = req.params.termo;
        const resposta = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(termo)}`);

        if (!resposta.ok) {
            return res.status(502).json({ erro: 'O Deezer retornou uma resposta inválida.' });
        }

        const dados = await resposta.json();
        res.status(200).json(dados.data || []);
    } catch (erro) {
        console.error('❌ Erro ao pesquisar no Deezer:', erro);
        res.status(500).json({ erro: 'Não foi possível consultar o Deezer.' });
    }
});

// ==========================================
// ROTAS PROTEGIDAS (EXIGEM TOKEN JWT)
// ==========================================

// Adicionar música manualmente (Protegido por verificarToken)
app.post('/musicas', verificarToken, async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return res.status(400).json({ erro: 'Envie os dados da música em formato JSON.' });
        }

        const novaMusica = { ...req.body };
        delete novaMusica._id;

        if (!novaMusica.titulo || !novaMusica.artista) {
            return res.status(400).json({ erro: 'Informe o título e o artista da música.' });
        }

        const colecao = getDb().collection('lista_musicas');
        const resultado = await colecao.insertOne(novaMusica);

        console.log('✅ Música adicionada:', novaMusica);

        res.status(201).json({
            mensagem: 'Música adicionada com sucesso!',
            id: resultado.insertedId
        });
    } catch (erro) {
        console.error('❌ Erro ao adicionar música:', erro);
        res.status(500).json({ erro: 'Não foi possível salvar a música.' });
    }
});

// Salvar música do Deezer (Protegido por verificarToken)
app.post('/deezer/salvar/:id', verificarToken, async (req, res) => {
    try {
        const id = req.params.id;

        if (!/^\d+$/.test(id)) {
            return res.status(400).json({ erro: 'O ID da música deve ser numérico.' });
        }

        const resposta = await fetch(`https://api.deezer.com/track/${id}`);
        if (!resposta.ok) {
            return res.status(502).json({ erro: 'Não foi possível consultar a música no Deezer.' });
        }

        const faixa = await resposta.json();
        if (faixa.error || !faixa.id) {
            return res.status(404).json({ erro: 'Música não encontrada no Deezer.' });
        }

        const dataLancamento = faixa.release_date || faixa.album?.release_date || '';

        const musica = {
            deezerId: faixa.id,
            titulo: faixa.title,
            artista: faixa.artist?.name || 'Artista desconhecido',
            album: faixa.album?.title || '',
            ano: dataLancamento ? Number(dataLancamento.slice(0, 4)) || null : null,
            link: faixa.link || null,
            preview: faixa.preview || null,
            origem: 'Deezer'
        };

        const colecao = getDb().collection('lista_musicas');
        const resultado = await colecao.updateOne(
            { deezerId: faixa.id },
            { $set: musica },
            { upsert: true }
        );

        const foiInserida = resultado.upsertedCount > 0;
        console.log('🎵 Música do Deezer salva no MongoDB:', musica);

        res.status(foiInserida ? 201 : 200).json({
            mensagem: foiInserida ? 'Música salva com sucesso!' : 'Música já cadastrada; dados atualizados!',
            musica
        });
    } catch (erro) {
        console.error('❌ Erro ao salvar música do Deezer:', erro);
        res.status(500).json({ erro: 'Não foi possível salvar a música no banco.' });
    }
});

// Atualizar música (Protegido por verificarToken)
app.put('/musicas/:id', verificarToken, async (req, res) => {
    try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ erro: 'ID da música inválido.' });
        }

        const dadosAtualizados = { ...req.body };
        delete dadosAtualizados._id;

        const colecao = getDb().collection('lista_musicas');
        const resultado = await colecao.updateOne(
            { _id: new ObjectId(id) },
            { $set: dadosAtualizados }
        );

        if (resultado.matchedCount === 0) {
            return res.status(404).json({ erro: 'Música não encontrada.' });
        }

        res.status(200).json({ mensagem: 'Música atualizada com sucesso!' });
    } catch (erro) {
        console.error('❌ Erro ao atualizar música:', erro);
        res.status(500).json({ erro: 'Não foi possível atualizar a música.' });
    }
});

// Apagar música (Protegido por verificarToken)
app.delete('/musicas/:id', verificarToken, async (req, res) => {
    try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ erro: 'ID da música inválido.' });
        }

        const colecao = getDb().collection('lista_musicas');
        const resultado = await colecao.deleteOne({ _id: new ObjectId(id) });

        if (resultado.deletedCount === 0) {
            return res.status(404).json({ erro: 'Música não encontrada.' });
        }

        res.status(200).json({ mensagem: 'Música apagada com sucesso!' });
    } catch (erro) {
        console.error('❌ Erro ao excluir música:', erro);
        res.status(500).json({ erro: 'Não foi possível excluir a música.' });
    }
});

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR
// ==========================================

async function iniciarServidor() {
    try {
        await conectarBanco();
        console.log('✅ Banco de dados conectado!');

        const db = getDb();

        // Garante que a collection 'usuarios' e 'lista_musicas' existam no MongoDB
        const collections = await db.listCollections().toArray();
        const nomesCollections = collections.map(c => c.name);

        if (!nomesCollections.includes('usuarios')) {
            await db.createCollection('usuarios');
            console.log('📁 Collection "usuarios" criada automaticamente no MongoDB!');
        }

        const colecaoMusicas = db.collection('lista_musicas');
        const musicaInicial = {
            titulo: 'Um Novo Dia',
            artista: 'Get Worship',
            album: '',
            ano: 2026
        };

        const existente = await colecaoMusicas.findOne({
            titulo: musicaInicial.titulo,
            artista: musicaInicial.artista
        });

        if (!existente) {
            await colecaoMusicas.insertOne(musicaInicial);
            console.log('✅ Música inicial adicionada ao banco!');
        }

        app.listen(PORT, '127.0.0.1', () => {
            console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
            console.log(`🔗 Acesse: http://127.0.0.1:${PORT}`);
        });
    } catch (erro) {
        console.error('❌ Erro ao conectar ao banco de dados:', erro);
        process.exit(1);
    }
}

iniciarServidor();