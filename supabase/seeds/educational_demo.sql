-- AEX 5.4: conteúdo fictício, sem usuários, organizações ou participantes.
-- Backend/local only: contém gabaritos que nunca devem integrar bundles públicos.
-- IDs fixos e ON CONFLICT DO NOTHING permitem repetir sem sobrescrever conteúdo.
begin;

insert into public.learning_modules (id, title, description, sort_order, status) values
('a5400000-0000-4000-8000-000000000001', 'Mensagens e contatos digitais',
 'Três situações fictícias para praticar decisões no dia a dia.', 0, 'published')
on conflict (id) do nothing;

insert into public.exercises (id, module_id, title, scenario, question, sort_order, status) values
('a5400000-0000-4000-8000-000000000101', 'a5400000-0000-4000-8000-000000000001',
 'SMS suspeito',
 'Mensagem fictícia da Entrega Nuvem: Sua encomenda será cancelada em 10 minutos! Confirme seus dados em https://entrega-nuvem.invalid/confirmar para liberar a entrega.',
 'Qual é a atitude mais segura diante desta mensagem?', 0, 'published'),
('a5400000-0000-4000-8000-000000000102', 'a5400000-0000-4000-8000-000000000001',
 'Links fraudulentos',
 'A Loja Jardim é fictícia e seu endereço conhecido neste exemplo é loja-jardim.invalid. Uma mensagem de promoção diz: Você ganhou um desconto! Acesse https://loja-jardim.premio-falso.invalid/resgatar.',
 'O que merece atenção neste endereço?', 1, 'published'),
('a5400000-0000-4000-8000-000000000103', 'a5400000-0000-4000-8000-000000000001',
 'Falsa central bancária',
 'Ligação fictícia de alguém que diz representar o Banco Aurora: Detectamos um problema na sua conta. Para cancelar agora, diga sua senha e o código recebido por mensagem. Não desligue: precisamos resolver imediatamente.',
 'Qual é a ação mais segura nesta situação?', 2, 'published')
on conflict (id) do nothing;

insert into public.exercise_options (id, exercise_id, option_text, is_correct, explanation, sort_order) values
('a5400000-0000-4000-8000-000000000201', 'a5400000-0000-4000-8000-000000000101',
 'Abrir o endereço logo para não perder a entrega.', false,
 'A ameaça de cancelamento e o prazo curto tentam fazer você agir sem conferir.', 0),
('a5400000-0000-4000-8000-000000000202', 'a5400000-0000-4000-8000-000000000101',
 'Não abrir o endereço e conferir a entrega pelo aplicativo ou canal oficial que já conheço.', true,
 'Você evita seguir o caminho indicado pela mensagem inesperada e verifica a situação por um canal conhecido.', 1),
('a5400000-0000-4000-8000-000000000203', 'a5400000-0000-4000-8000-000000000101',
 'Responder à mensagem com meus dados para confirmar.', false,
 'Enviar dados em resposta a uma mensagem inesperada pode expor suas informações.', 2),
('a5400000-0000-4000-8000-000000000204', 'a5400000-0000-4000-8000-000000000102',
 'Começar com HTTPS garante que a promoção é verdadeira.', false,
 'HTTPS protege a conexão, mas não garante que o site ou a promoção sejam legítimos.', 0),
('a5400000-0000-4000-8000-000000000205', 'a5400000-0000-4000-8000-000000000102',
 'Ter o nome da loja em alguma parte do endereço é suficiente para confiar.', false,
 'O nome da loja pode ser colocado em um endereço diferente para confundir.', 1),
('a5400000-0000-4000-8000-000000000206', 'a5400000-0000-4000-8000-000000000102',
 'O endereço é diferente do conhecido. Devo conferir a promoção por um canal oficial.', true,
 'loja-jardim.premio-falso.invalid não é loja-jardim.invalid. Confira por um canal conhecido.', 2),
('a5400000-0000-4000-8000-000000000207', 'a5400000-0000-4000-8000-000000000103',
 'Informar a senha porque a pessoa diz trabalhar no banco.', false,
 'Dizer que trabalha no banco não comprova a identidade de quem ligou.', 0),
('a5400000-0000-4000-8000-000000000208', 'a5400000-0000-4000-8000-000000000103',
 'Encerrar a ligação sem informar dados e procurar o banco por um canal oficial que já conheço.', true,
 'Você interrompe a pressão e verifica a situação por um canal conhecido.', 1),
('a5400000-0000-4000-8000-000000000209', 'a5400000-0000-4000-8000-000000000103',
 'Informar apenas o código recebido, sem contar a senha.', false,
 'Um código de confirmação também pode permitir acesso à conta ou autorizar ações.', 2)
on conflict (id) do nothing;

-- Fill only the previously absent classification of these controlled demo IDs.
update public.exercises set category = 'phishing'
where id in ('a5400000-0000-4000-8000-000000000101', 'a5400000-0000-4000-8000-000000000102') and category is null;
update public.exercises set category = 'social-engineering'
where id = 'a5400000-0000-4000-8000-000000000103' and category is null;

commit;
