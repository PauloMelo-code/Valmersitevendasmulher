// Demonstração local com dados de exemplo: `npm run demo`.
// Sobe o Postgres do docker-compose, liga o site em http://localhost:3100 e gera 60 dias de visitas fictícias.
// Só fala com o banco local (porta 5441): nunca toca na produção.
import { execSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(import.meta.dirname, '..');
const PORTA = 3100;
const BANCO = 'postgres://dev:dev@localhost:5441/pagina_vendas_dev';
const CONTAINER = 'pagina-vendas-db-1';
const ARQ_ACESSO = path.join(RAIZ, '.env.demo');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Acesso da demo: criado uma vez em .env.demo (fora do git) e reaproveitado.
if (!fs.existsSync(ARQ_ACESSO)) {
  fs.writeFileSync(ARQ_ACESSO, `PAINEL_USUARIO=valmer\nPAINEL_SENHA=${crypto.randomBytes(12).toString('base64url')}\n`);
}
const acesso = Object.fromEntries(fs.readFileSync(ARQ_ACESSO, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));

console.log('1/3 Subindo o banco local...');
execSync('docker compose -p pagina-vendas up -d', { cwd: RAIZ, stdio: 'inherit' });
for (let i = 0; ; i++) {
  try { execSync(`docker exec ${CONTAINER} pg_isready -U dev -d pagina_vendas_dev`, { stdio: 'ignore' }); break; }
  catch { if (i > 30) throw new Error('O banco não respondeu. O Docker Desktop está aberto?'); await esperar(1000); }
}

console.log('2/3 Ligando o site (aplica as migrações)...');
const site = spawn(process.execPath, ['src/server.ts'], {
  cwd: RAIZ, stdio: 'inherit',
  env: { ...process.env, PORT: String(PORTA), SITE_URL: `http://localhost:${PORTA}`, DATABASE_URL: BANCO, ...acesso },
});
process.on('SIGINT', () => { site.kill(); process.exit(0); });
for (let i = 0; ; i++) {
  try { if ((await fetch(`http://localhost:${PORTA}/saude`)).ok) break; } catch { /* ainda subindo */ }
  if (i > 30) { site.kill(); throw new Error('O site não subiu. Veja o erro acima.'); }
  await esperar(500);
}

console.log('3/3 Gerando 60 dias de visitas de exemplo...');
execSync(`docker exec -i ${CONTAINER} psql -q -U dev -d pagina_vendas_dev`, { input: fs.readFileSync(path.join(RAIZ, 'scripts', 'demo-dados.sql')) });

console.log(`
  Pronto! Demonstração no ar (dados fictícios):
    Painel:  http://localhost:${PORTA}/painel
    Página:  http://localhost:${PORTA}/
    Usuário: ${acesso.PAINEL_USUARIO}
    Senha:   ${acesso.PAINEL_SENHA}   (fica em .env.demo)

  Para encerrar: Ctrl+C
`);
