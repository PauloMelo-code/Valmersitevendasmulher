import crypto from 'node:crypto';

// Sessão do painel: cookie assinado "expira.assinatura" (sem tabela).
// A chave deriva de usuário+senha: trocar a PAINEL_SENHA derruba todas as sessões abertas.

const DURACAO_MS = 7 * 24 * 60 * 60 * 1000;
export const COOKIE = 'painel_sessao';

const sha = (s: string) => crypto.createHash('sha256').update(s).digest();
const iguais = (a: string, b: string) => crypto.timingSafeEqual(sha(a), sha(b));

export const chaveDe = (usuario: string, senha: string) => sha(`painel-sessao|${usuario}|${senha}`);
const assinar = (chave: Buffer, exp: number) => crypto.createHmac('sha256', chave).update(`painel|${exp}`).digest('base64url');

export function credenciaisOk(usuario: string, senha: string, usuarioCerto: string, senhaCerta: string): boolean {
  const okU = iguais(usuario, usuarioCerto);
  const okS = iguais(senha, senhaCerta);
  return okU && okS && senhaCerta.length >= 12;
}

export function criarSessao(chave: Buffer, agora = Date.now()): string {
  const exp = agora + DURACAO_MS;
  return `${exp}.${assinar(chave, exp)}`;
}

export function sessaoValida(valor: string | undefined, chave: Buffer, agora = Date.now()): boolean {
  const m = /^(\d{13})\.([\w-]{43})$/.exec(valor ?? '');
  if (!m) return false;
  const exp = Number(m[1]);
  return exp > agora && iguais(m[2], assinar(chave, exp));
}

export function lerCookie(cabecalho: string | undefined, nome: string): string | undefined {
  for (const parte of (cabecalho ?? '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return v.join('=');
  }
}

// ponytail: limite global em memória (1 container); zera no restart. Com senha forte de 12+ caracteres
// 10 tentativas a cada 15 min tornam força bruta inviável. Se o painel ganhar mais usuários, persistir no Postgres.
const JANELA_MS = 15 * 60 * 1000, MAX_FALHAS = 10;
let falhas: number[] = [];
export function bloqueado(agora = Date.now()): boolean {
  falhas = falhas.filter((t) => agora - t < JANELA_MS);
  return falhas.length >= MAX_FALHAS;
}
export function registrarFalha(agora = Date.now()): void { falhas.push(agora); }
