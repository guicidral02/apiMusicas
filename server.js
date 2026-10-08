
const express = require('express');
const { conectarBanco, getDb } = require('./db');
const { ObjectId } = require('mongodb');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());


app.get('/', (req, res) => {
    res.send('🎵 API de Música Gospel funcionando!');
});


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

        res.status(500).json({
            erro: 'Não foi possível buscar as músicas.'
        });
    }
});


app.post('/musicas', async (req, res) => {
    try {
        if (
            !req.body ||
            typeof req.body !== 'object' ||
            Array.isArray(req.body)
        ) {
            return res.status(400).json({
                erro: 'Envie os dados da música em formato JSON.'
            });
        }

        const novaMusica = { ...req.body };
        delete novaMusica._id;

        if (!novaMusica.titulo || !novaMusica.artista) {
            return res.status(400).json({
                erro: 'Informe o título e o artista da música.'
            });
        }

        const colecao = getDb().collection('lista_musicas');
        const resultado = await colecao.insertOne(novaMusica);

        console.log('✅ Música adicionada:', novaMusica);
        console.log('ID gerado:', resultado.insertedId.toString());

        res.status(201).json({
            mensagem: 'Música adicionada com sucesso!',
            id: resultado.insertedId
        });
    } catch (erro) {
        console.error('❌ Erro ao adicionar música:', erro);

        res.status(500).json({
            erro: 'Não foi possível salvar a música.'
        });
    }
});


app.get('/deezer/pesquisar/:termo', async (req, res) => {
    try {
        const termo = req.params.termo;

        const resposta = await fetch(
            `https://api.deezer.com/search?q=${encodeURIComponent(termo)}`
        );

        if (!resposta.ok) {
            return res.status(502).json({
                erro: 'O Deezer retornou uma resposta inválida.'
            });
        }

        const dados = await resposta.json();

        if (dados.error) {
            return res.status(502).json({
                erro: 'O Deezer retornou um erro.',
                detalhe: dados.error.message
            });
        }

        res.status(200).json(dados.data || []);
    } catch (erro) {
        console.error('❌ Erro ao pesquisar no Deezer:', erro);

        res.status(500).json({
            erro: 'Não foi possível consultar o Deezer.'
        });
    }
});


app.post('/deezer/salvar/:id', async (req, res) => {
    try {
        const id = req.params.id;

        if (!/^\d+$/.test(id)) {
            return res.status(400).json({
                erro: 'O ID da música deve ser numérico.'
            });
        }

        const resposta = await fetch(
            `https://api.deezer.com/track/${id}`
        );

        if (!resposta.ok) {
            return res.status(502).json({
                erro: 'Não foi possível consultar a música no Deezer.'
            });
        }

        const faixa = await resposta.json();

        if (faixa.error || !faixa.id) {
            return res.status(404).json({
                erro: 'Música não encontrada no Deezer.'
            });
        }

        const dataLancamento =
            faixa.release_date || faixa.album?.release_date || '';

        const musica = {
            deezerId: faixa.id,
            titulo: faixa.title,
            artista: faixa.artist?.name || 'Artista desconhecido',
            album: faixa.album?.title || '',
            ano: dataLancamento
                ? Number(dataLancamento.slice(0, 4)) || null
                : null,
            link: faixa.link || null,
            preview: faixa.preview || null,
            origem: 'Deezer'
        };

        const colecao = getDb().collection('lista_musicas');

        // Insere a faixa ou atualiza os dados caso já esteja cadastrada
        const resultado = await colecao.updateOne(
            { deezerId: faixa.id },
            { $set: musica },
            { upsert: true }
        );

        const foiInserida = resultado.upsertedCount > 0;

        console.log('🎵 Música do Deezer salva no MongoDB:', musica);

        res.status(foiInserida ? 201 : 200).json({
            mensagem: foiInserida
                ? 'Música salva com sucesso!'
                : 'Música já cadastrada; dados atualizados!',
            musica
        });
    } catch (erro) {
        console.error('❌ Erro ao salvar música do Deezer:', erro);

        res.status(500).json({
            erro: 'Não foi possível salvar a música no banco.'
        });
    }
});


app.put('/musicas/:id', async (req, res) => {
    try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                erro: 'ID da música inválido.'
            });
        }

        const dadosAtualizados = { ...req.body };
        delete dadosAtualizados._id;

        const colecao = getDb().collection('lista_musicas');

        const resultado = await colecao.updateOne(
            { _id: new ObjectId(id) },
            { $set: dadosAtualizados }
        );

        if (resultado.matchedCount === 0) {
            return res.status(404).json({
                erro: 'Música não encontrada.'
            });
        }

        res.status(200).json({
            mensagem: 'Música atualizada com sucesso!'
        });
    } catch (erro) {
        console.error('❌ Erro ao atualizar música:', erro);

        res.status(500).json({
            erro: 'Não foi possível atualizar a música.'
        });
    }
});



app.delete('/musicas/:id', async (req, res) => {
    try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                erro: 'ID da música inválido.'
            });
        }

        const colecao = getDb().collection('lista_musicas');

        const resultado = await colecao.deleteOne({
            _id: new ObjectId(id)
        });

        if (resultado.deletedCount === 0) {
            return res.status(404).json({
                erro: 'Música não encontrada.'
            });
        }

        res.status(200).json({
            mensagem: 'Música apagada com sucesso!'
        });
    } catch (erro) {
        console.error('❌ Erro ao excluir música:', erro);

        res.status(500).json({
            erro: 'Não foi possível excluir a música.'
        });
    }
});


async function iniciarServidor() {
    try {
        await conectarBanco();

        console.log('✅ Banco de dados conectado!');

        const colecao = getDb().collection('lista_musicas');

        // ✏️ ALTERE OS DADOS ABAIXO PARA CADASTRAR OUTRA MÚSICA
        const musicaInicial = {
            titulo: 'É Tudo Sobre Você',
            artista: 'Morada',
            album: 'Ele É',
            ano: 2021
        };

        try {
            // Verifica se a música já existe para evitar duplicação
            const existente = await colecao.findOne({
                titulo: musicaInicial.titulo,
                artista: musicaInicial.artista
            });

            if (!existente) {
                const resultado = await colecao.insertOne(musicaInicial);

                console.log('\n✅ Música adicionada pelo código!');
                console.log('ID:', resultado.insertedId.toString());
            } else {
                console.log(
                    '\nℹ️ A música inicial já está cadastrada. Não foi duplicada.'
                );
            }

            // Busca e mostra todas as músicas no terminal
            const musicas = await colecao.find({}).toArray();

            console.log('\n📋 Lista completa de músicas do MongoDB:');

            console.table(musicas.map(musica => ({
                id: musica._id.toString(),
                titulo: musica.titulo,
                artista: musica.artista,
                album: musica.album,
                ano: musica.ano
            })));
        } catch (erro) {
            console.error(
                '❌ Erro ao cadastrar ou listar a música inicial:',
                erro
            );
        }

        app.listen(PORT, () => {
            console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
            console.log(`🔗 Acesse: http://localhost:${PORT}`);
        });
    } catch (erro) {
        console.error('❌ Erro ao conectar ao banco de dados:', erro);
        process.exit(1);
    }
}

iniciarServidor();