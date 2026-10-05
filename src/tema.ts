// Tema do painel por cookie: o servidor já entrega <html data-theme> certo, sem a tela piscar.
export const TEMAS = ['sistema', 'escuro', 'claro'] as const;
export type Tema = (typeof TEMAS)[number];
export const COOKIE_TEMA = 'tema';
export const lerTema = (v?: string): Tema => (TEMAS.includes(v as Tema) ? (v as Tema) : 'sistema');
