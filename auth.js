const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    
    // O token é enviado no formato: "Bearer <seu_token_aqui>"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            erro: 'Acesso negado. Token de autenticação não fornecido.' 
        });
    }

    try {
        const secreto = process.env.JWT_SECRET;
        
        // Valida o token usando a secret do .env
        const payload = jwt.verify(token, secreto);
        
        // Guarda os dados do utilizador na requisição para uso futuro
        req.usuario = payload;
        
        next(); // Permite que a requisição continue para a rota
    } catch (erro) {
        return res.status(403).json({ 
            erro: 'Token inválido ou expirado.' 
        });
    }
}

module.exports = verificarToken;