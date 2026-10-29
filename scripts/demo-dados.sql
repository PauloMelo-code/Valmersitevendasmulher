-- Dados de EXEMPLO para demonstração local (npm run demo). Nunca rodar em produção.
-- Arquiva (soft delete) a demonstração anterior antes de gerar a nova.
update pagina_vendas_eventos set is_deleted = true, deleted_at = now(), updated_at = now(), modified_by = 'demo' where is_deleted = false;
with v as (
  select 'tst' || lpad(i::text, 6, '0') as visitante,
    now() - random() * interval '60 days' as t,
    (array['facebook','facebook','facebook','instagram.com','google.com','direto','whatsapp'])[1 + floor(random()*7)::int] as origem,
    (array['mulheres-lideranca','mulheres-lideranca','remarketing-75','lookalike-1pct'])[1 + floor(random()*4)::int] as campanha,
    (array['video-valmer-01','carrossel-bonus','depoimento-ana','estatico-preco'])[1 + floor(random()*4)::int] as conteudo,
    (array['mulheres','mulheres','geral'])[1 + floor(random()*3)::int] as pag,
    random() as r1, random() as r2, random() as r3
  from generate_series(1, 4000) i
), base as (
  select *, case when r3 < .72 then 'celular' when r3 < .78 then 'tablet' else 'computador' end as disp,
    case when r3 < .40 then 'iOS' when r3 < .78 then 'Android' when r3 < .93 then 'Windows' else 'macOS' end as so,
    case when r1 < .35 then 0 when r1 < .55 then 25 when r1 < .7 then 50 when r1 < .85 then 75 else 100 end as sc,
    origem = 'facebook' as fb
  from v
)
insert into pagina_vendas_eventos (tipo, visitante, valor, detalhe, origem, campanha, midia, conteudo, dispositivo, sistema, pagina, created_at)
select 'view', visitante, null, null, origem, case when fb then campanha end, case when fb then 'cpc' end, case when fb then conteudo end, disp, so, pag, t from base
union all
select 'scroll', visitante, s, null, origem, case when fb then campanha end, case when fb then 'cpc' end, case when fb then conteudo end, disp, so, pag, t + s * interval '1 second'
  from base, unnest(array[25,50,75,100]) s where s <= sc
union all
select 'click', visitante, null, (array['QUERO GARANTIR TODO O CONTEÚDO POR R$ 97','QUERO GARANTIR POR R$ 97','QUERO COMEÇAR MINHA JORNADA COMO LÍDER','QUERO O LIVRO COM TODOS OS BÔNUS'])[1+floor(r2*4)::int],
  origem, case when fb then campanha end, case when fb then 'cpc' end, case when fb then conteudo end, disp, so, pag, t + interval '3 minutes'
  from base where sc >= 50 and r2 < (case when campanha = 'remarketing-75' then .35 else .14 end)
union all
select 'sair', visitante, (8 + sc * 2.4 + r2 * 120)::int, null, origem, case when fb then campanha end, case when fb then 'cpc' end, case when fb then conteudo end, disp, so, pag, t + interval '5 minutes' from base;
-- 3 pessoas "agora no site" para o indicador ao vivo
insert into pagina_vendas_eventos (tipo, visitante, origem, campanha, midia, conteudo, dispositivo, sistema, created_at)
select 'view', 'vivo' || i || 'abc', 'facebook', 'mulheres-lideranca', 'cpc', 'video-valmer-01', 'celular', 'iOS', now() - (i * interval '40 seconds')
from generate_series(1, 3) i;
