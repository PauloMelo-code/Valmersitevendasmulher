// Filtros do painel vindos da URL (?p=7d&origem=facebook...). Tudo validado: vem do navegador.

export const DIMENSOES = ['origem', 'midia', 'campanha', 'conteudo', 'dispositivo', 'sistema'] as const;
export type Dimensao = (typeof DIMENSOES)[number];
export const ROTULOS: Record<Dimensao, string> = {
  origem: 'Origem', midia: 'Mídia', campanha: 'Campanha', conteudo: 'Anúncio', dispositivo: 'Dispositivo', sistema: 'Sistema',
};

// preset -> [dias atrás do início, dias atrás do fim]
export const PRESETS = { hoje: [0, 0], ontem: [1, 1], '7d': [6, 0], '30d': [29, 0], '90d': [89, 0] } as const;
export const NOMES_PRESET: Record<string, string> = { hoje: 'Hoje', ontem: 'Ontem', '7d': '7 dias', '30d': '30 dias', '90d': '90 dias' };
type Preset = keyof typeof PRESETS | 'custom';

export type Filtro = { preset: Preset; de: string; ate: string; dias: number; dims: Partial<Record<Dimensao, string>> };

const DATA = /^\d{4}-\d{2}-\d{2}$/;
export const hojeSP = (agora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
export function somarDias(d: string, n: number): string {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86400000) + 1;
const dataValida = (s: string | null): s is string => !!s && DATA.test(s) && !Number.isNaN(Date.parse(s));

export function lerFiltro(q: URLSearchParams, agora = new Date()): Filtro {
  const hoje = hojeSP(agora);
  let preset = (q.get('p') ?? '7d') as Preset;
  let de: string, ate: string;
  const qDe = q.get('de'), qAte = q.get('ate');
  if (preset === 'custom' && dataValida(qDe) && dataValida(qAte)) {
    [de, ate] = qDe <= qAte ? [qDe, qAte] : [qAte, qDe];
    if (ate > hoje) ate = hoje;
    if (de > ate) de = ate;
    if (diasEntre(de, ate) > 366) de = somarDias(ate, -365);
  } else {
    if (!(preset in PRESETS)) preset = '7d';
    const [a, b] = PRESETS[preset as keyof typeof PRESETS];
    de = somarDias(hoje, -a);
    ate = somarDias(hoje, -b);
  }
  const dims: Filtro['dims'] = {};
  for (const d of DIMENSOES) {
    const v = q.get(d)?.trim().slice(0, 120);
    if (v) dims[d] = v;
  }
  return { preset, de, ate, dias: diasEntre(de, ate), dims };
}

export const periodoAnterior = (f: Filtro): Filtro => ({ ...f, de: somarDias(f.de, -f.dias), ate: somarDias(f.de, -1) });

// Monta a query string do filtro atual com alterações (null remove a chave).
export function urlCom(f: Filtro, mudar: Record<string, string | null> = {}): string {
  const p: Record<string, string> = { p: f.preset };
  if (f.preset === 'custom') { p.de = f.de; p.ate = f.ate; }
  Object.assign(p, f.dims);
  for (const [k, v] of Object.entries(mudar)) {
    if (v === null) delete p[k];
    else p[k] = v;
  }
  if (p.p !== 'custom') { delete p.de; delete p.ate; }
  return '?' + new URLSearchParams(p).toString();
}
