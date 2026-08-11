-- RF-013: Cron diario para recordatorios de pagos (7:00 AM Bogotá = 12:00 UTC)
-- Extensiones (también se pueden activar en Dashboard > Database > Extensions)
create extension if not exists pg_cron;
create extension if not exists pg_net;   -- la extensión es "pg_net"; sus funciones viven en el schema "net"

-- La función valida un secreto dedicado (CRON_SECRET, configurado como secret de la
-- Edge Function). cron.job solo es legible por postgres, así que el secreto embebido
-- aquí no queda expuesto a usuarios de la app.
select cron.schedule(
  'send-payment-reminders-daily',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://ybaswzwdjgptlxxjlcrt.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer Zb5Qu6PUIsTH611jZ3IlG3W_Qgx_m0irVnx__2Q4Pvs'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);

-- Monitoreo:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 5;
--   select status_code, content from net._http_response order by id desc limit 5;
-- Eliminar el job:
--   select cron.unschedule('send-payment-reminders-daily');
