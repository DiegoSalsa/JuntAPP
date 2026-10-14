\set ON_ERROR_STOP on
-- Seed the reported stale-current-month bug before applying the new migration.
SELECT set_config('request.jwt.claim.role','service_role',false);
ALTER TABLE auth.users DISABLE TRIGGER USER;
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role,created_at,updated_at)
VALUES('71111111-1111-4111-8111-111111111111','rates-upgrade@example.invalid','{}','{}','authenticated','authenticated',now(),now());
ALTER TABLE auth.users ENABLE TRIGGER USER;
INSERT INTO public.juntas(id,name,slug,region,invite_code,monthly_due_amount,subscription_status)
VALUES('70000000-0000-4000-8000-000000000000','Cuotas antes de actualizar','rates-upgrade','Metropolitana','UPG026',10000,'authorized');
INSERT INTO public.households(id,junta_id,address,normalized_address,created_at)
VALUES('75111111-1111-4111-8111-111111111111','70000000-0000-4000-8000-000000000000','Calle Actualización 1','calle actualizacion 1',now()-interval '4 months');
INSERT INTO public.profiles(id,name,rut,address,email,role,junta_id,household_id,membership_status,board_position)
VALUES('71111111-1111-4111-8111-111111111111','Prueba actualización','99.555.555-5','Calle Actualización 1','rates-upgrade@example.invalid','dirigente','70000000-0000-4000-8000-000000000000','75111111-1111-4111-8111-111111111111','active','presidente');
INSERT INTO public.member_dues(junta_id,household_id,profile_id,period,amount)
SELECT '70000000-0000-4000-8000-000000000000','75111111-1111-4111-8111-111111111111','71111111-1111-4111-8111-111111111111',period,amount FROM (VALUES
((date_trunc('month',public.current_chile_date())-interval '1 month')::date,6000),
(date_trunc('month',public.current_chile_date())::date,5000),
((date_trunc('month',public.current_chile_date())+interval '3 months')::date,5000)) d(period,amount);
