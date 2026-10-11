-- Local development data
-- Development seed users receive random passwords; use Supabase admin tooling to set local credentials.

INSERT INTO public.juntas (id, name, slug, address, comuna, region, invite_code, subscription_status, subscription_price)
VALUES (
    'd5089e9f-9694-4d87-8d26-384196c80000',
    'Junta de Vecinos Villa Los Jardines',
    'villa-los-jardines-demo',
    'Sede Comunitaria 10',
    'Viña del Mar',
    'Valparaíso',
    'DEMO26',
    'authorized',
    14990
);

-- Creating auth users fires handle_new_user(), which validates DEMO26 and creates profiles.
INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, role,
    created_at, updated_at, last_sign_in_at
)
VALUES
(
    'd5089e9f-9694-4d87-8d26-384196c80001',
    '00000000-0000-0000-0000-000000000000',
    'admin@juntapp.cl',
    extensions.crypt(encode(gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Vecina Presidenta (Admin)","rut":"12.345.678-9","address":"Pasaje Los Aromos 110","phone":"+56 9 1111 1111","junta_action":"join","invite_code":"DEMO26","manual_invite":true}',
    false, 'authenticated', now(), now(), now()
),
(
    'd5089e9f-9694-4d87-8d26-384196c80002',
    '00000000-0000-0000-0000-000000000000',
    'luis.munoz@correo.cl',
    extensions.crypt(encode(gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Luis Humberto Muñoz Henríquez","rut":"8.122.904-7","address":"Calle Principal 1024","phone":"+56 9 5432 1098","junta_action":"join","invite_code":"DEMO26","manual_invite":true}',
    false, 'authenticated', now(), now(), now()
),
(
    'd5089e9f-9694-4d87-8d26-384196c80003',
    '00000000-0000-0000-0000-000000000000',
    'maria.ramirez@correo.cl',
    extensions.crypt(encode(gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"María José Ramírez Valdés","rut":"14.341.203-K","address":"Pasaje Los Aromos 345","phone":"+56 9 8765 4321","junta_action":"join","invite_code":"DEMO26","manual_invite":true}',
    false, 'authenticated', now(), now(), now()
),
(
    'd5089e9f-9694-4d87-8d26-384196c80004',
    '00000000-0000-0000-0000-000000000000',
    'pedro.soto@correo.cl',
    extensions.crypt(encode(gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Pedro Ignacio Soto Contreras","rut":"9.403.220-4","address":"Avenida Los Girasoles 120","phone":"+56 9 7654 3210","junta_action":"join","invite_code":"DEMO26","manual_invite":true}',
    false, 'authenticated', now(), now(), now()
);

-- Eight neighbors represented by four households. Each pair intentionally uses
-- a different textual spelling of the same address to exercise normalization.
INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, role,
    created_at, updated_at, last_sign_in_at
)
VALUES
(
    'd5089e9f-9694-4d87-8d26-384196c80010', '00000000-0000-0000-0000-000000000000',
    'vecino.demo@juntapp.cl', extensions.crypt(encode(gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Camila Rojas Fuentes","rut":"171234565","address":"Avenida Los Pinos 123, Depto 4","phone":"+56 9 2100 1001","junta_action":"join","invite_code":"DEMO26","manual_invite":true}',
    false, 'authenticated', now(), now(), now()
),
(
    'd5089e9f-9694-4d87-8d26-384196c80011', '00000000-0000-0000-0000-000000000000',
    'tomas.demo@juntapp.cl', extensions.crypt(encode(gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Tomás Rojas Fuentes","rut":"182345679","address":"Av. Los Pinos #123 Dpto. 4","phone":"+56 9 2100 1002","junta_action":"join","invite_code":"DEMO26","manual_invite":true}',
    false, 'authenticated', now(), now(), now()
),
(
    'd5089e9f-9694-4d87-8d26-384196c80012', '00000000-0000-0000-0000-000000000000',
    'ana.demo@juntapp.cl', extensions.crypt(encode(gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Ana Morales Díaz","rut":"193456782","address":"Pasaje Los Aromos 345","phone":"+56 9 2100 1003","junta_action":"join","invite_code":"DEMO26","manual_invite":true}',
    false, 'authenticated', now(), now(), now()
),
(
    'd5089e9f-9694-4d87-8d26-384196c80013', '00000000-0000-0000-0000-000000000000',
    'juan.demo@juntapp.cl', extensions.crypt(encode(gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Juan Morales Díaz","rut":"204567891","address":"Pje. Los Aromos Nro. 345","phone":"+56 9 2100 1004","junta_action":"join","invite_code":"DEMO26","manual_invite":true}',
    false, 'authenticated', now(), now(), now()
),
(
    'd5089e9f-9694-4d87-8d26-384196c80014', '00000000-0000-0000-0000-000000000000',
    'carolina.demo@juntapp.cl', extensions.crypt(encode(gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Carolina Pérez Soto","rut":"155678909","address":"Calle Las Acacias 880","phone":"+56 9 2100 1005","junta_action":"join","invite_code":"DEMO26","manual_invite":true}',
    false, 'authenticated', now(), now(), now()
),
(
    'd5089e9f-9694-4d87-8d26-384196c80015', '00000000-0000-0000-0000-000000000000',
    'diego.demo@juntapp.cl', extensions.crypt(encode(gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Diego Pérez Soto","rut":"16678901K","address":"Calle Las Acacias #880","phone":"+56 9 2100 1006","junta_action":"join","invite_code":"DEMO26","manual_invite":true}',
    false, 'authenticated', now(), now(), now()
),
(
    'd5089e9f-9694-4d87-8d26-384196c80016', '00000000-0000-0000-0000-000000000000',
    'elena.demo@juntapp.cl', extensions.crypt(encode(gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Elena Contreras Silva","rut":"137890127","address":"Camino El Sol 72","phone":"+56 9 2100 1007","junta_action":"join","invite_code":"DEMO26","manual_invite":true}',
    false, 'authenticated', now(), now(), now()
),
(
    'd5089e9f-9694-4d87-8d26-384196c80017', '00000000-0000-0000-0000-000000000000',
    'roberto.demo@juntapp.cl', extensions.crypt(encode(gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Roberto Contreras Silva","rut":"148901236","address":"Cno. El Sol N° 72","phone":"+56 9 2100 1008","junta_action":"join","invite_code":"DEMO26","manual_invite":true}',
    false, 'authenticated', now(), now(), now()
),
(
    'd5089e9f-9694-4d87-8d26-384196c80018', '00000000-0000-0000-0000-000000000000',
    'directiva.demo@juntapp.cl', extensions.crypt(encode(gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Administración Demo","rut":"126543212","address":"Sede Vecinal 10","phone":"+56 9 2100 1099","junta_action":"join","invite_code":"DEMO26","manual_invite":true}',
    false, 'authenticated', now(), now(), now()
);

UPDATE public.profiles
SET role = 'dirigente', board_position = 'presidente', cuota_status = 'al_dia'
WHERE id = 'd5089e9f-9694-4d87-8d26-384196c80001';

UPDATE public.profiles
SET cuota_status = 'al_dia'
WHERE id IN (
    'd5089e9f-9694-4d87-8d26-384196c80003',
    'd5089e9f-9694-4d87-8d26-384196c80004'
);

UPDATE public.profiles
SET role = 'dirigente', board_position = 'dirigente', cuota_status = 'al_dia'
WHERE id = 'd5089e9f-9694-4d87-8d26-384196c80018';

-- One current-period charge for the shared Los Pinos household. Both demo
-- neighbors become current through the same address-level payment.
SELECT public.set_manual_household_due(
    (SELECT household_id FROM public.profiles WHERE email = 'vecino.demo@juntapp.cl'),
    'd5089e9f-9694-4d87-8d26-384196c80000',
    'paid',
    'transfer'
);

INSERT INTO public.transactions (junta_id, type, description, amount, date, created_by)
VALUES
('d5089e9f-9694-4d87-8d26-384196c80000', 'ingreso', 'Subsidio Municipal FONDEVE 2025', 300000, '2026-05-02', 'd5089e9f-9694-4d87-8d26-384196c80001'),
('d5089e9f-9694-4d87-8d26-384196c80000', 'egreso', 'Compra de ampolletas LED para plaza', 15000, '2026-05-05', 'd5089e9f-9694-4d87-8d26-384196c80001'),
('d5089e9f-9694-4d87-8d26-384196c80000', 'egreso', 'Cerradura nueva y copias de llaves', 25000, '2026-05-10', 'd5089e9f-9694-4d87-8d26-384196c80001'),
('d5089e9f-9694-4d87-8d26-384196c80000', 'ingreso', 'Aporte extraordinario bingo municipal', 120000, '2026-05-12', 'd5089e9f-9694-4d87-8d26-384196c80001'),
('d5089e9f-9694-4d87-8d26-384196c80000', 'egreso', 'Servicio de limpieza y jardines', 25000, '2026-05-20', 'd5089e9f-9694-4d87-8d26-384196c80001'),
('d5089e9f-9694-4d87-8d26-384196c80000', 'ingreso', 'Recaudación de cuotas sociales', 65500, '2026-05-25', 'd5089e9f-9694-4d87-8d26-384196c80001');

INSERT INTO public.polls (id, junta_id, title, description, active, options)
VALUES (
    'd5089e9f-9694-4d87-8d26-384196c80009',
    'd5089e9f-9694-4d87-8d26-384196c80000',
    'Consulta: Prioridad de Inversión FONDEVE 2026',
    '¿Cuál de las propuestas considera prioritaria para el fondo vecinal?',
    true,
    '[{"id":"opt-1","text":"Cámaras de seguridad vecinal"},{"id":"opt-2","text":"Repavimentación de pasajes"},{"id":"opt-3","text":"Luminarias LED para la plaza"}]'
);

INSERT INTO public.votes (user_id, poll_id, option_id)
VALUES
('d5089e9f-9694-4d87-8d26-384196c80003', 'd5089e9f-9694-4d87-8d26-384196c80009', 'opt-1'),
('d5089e9f-9694-4d87-8d26-384196c80004', 'd5089e9f-9694-4d87-8d26-384196c80009', 'opt-3');

INSERT INTO public.announcements (junta_id, category, title, content, date, author)
VALUES
('d5089e9f-9694-4d87-8d26-384196c80000', 'urgente', 'Corte de agua programado', 'Esval informa un corte de agua programado entre las 14:00 y 18:00 horas.', '2026-05-28', 'Directiva JuntAPP'),
('d5089e9f-9694-4d87-8d26-384196c80000', 'asamblea', 'Reunión ordinaria mensual', 'Asamblea presencial en la sede comunitaria el sábado 14 de junio a las 18:00 horas.', '2026-05-25', 'Directiva JuntAPP'),
('d5089e9f-9694-4d87-8d26-384196c80000', 'beneficio', 'Taller gratuito de alfabetización digital', 'Taller municipal para aprender a usar smartphones, BancoEstado y JuntAPP.', '2026-05-20', 'Comisión Social');

INSERT INTO public.notifications (user_id, type, title, message, read, action, target_socio_id)
VALUES
('d5089e9f-9694-4d87-8d26-384196c80002', 'cuota', 'Cobro de cuota pendiente', 'Tu cuota de mayo está disponible para pago.', false, '/tesoreria', 4),
('d5089e9f-9694-4d87-8d26-384196c80002', 'asamblea', 'Asamblea mensual', 'Reunión el sábado 14 de junio a las 18:00 horas.', false, '/comunicaciones', NULL);
