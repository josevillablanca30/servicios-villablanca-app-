alter table public.vb_demo_orders add column if not exists customer_email text, add column if not exists deposit_amount integer, add column if not exists mp_preference_id text, add column if not exists mp_payment_id text, add column if not exists paid_at timestamptz, add column if not exists assignment_notified_at timestamptz;
alter table public.vb_demo_tasks add column if not exists base_hours numeric(5,2), add column if not exists work_details jsonb not null default '{}'::jsonb;
alter table public.vb_demo_orders drop constraint if exists vb_demo_orders_payment_status_check;
alter table public.vb_demo_orders add constraint vb_demo_orders_payment_status_check check(payment_status in ('No cobrado · DEMO','Pendiente de abono','Abono aprobado','Abono pendiente','Abono rechazado'));
create unique index if not exists vb_demo_orders_mp_payment_uidx on public.vb_demo_orders(mp_payment_id) where mp_payment_id is not null;
create table if not exists public.vb_demo_email_outbox(id uuid primary key default gen_random_uuid(), order_id uuid not null references public.vb_demo_orders(id) on delete cascade, event text not null check(event in ('assigned')), recipient text not null, status text not null default 'pending' check(status in ('pending','sending','sent','failed')), attempts integer not null default 0, last_error text, sent_at timestamptz, created_at timestamptz not null default now(),unique(order_id,event));
alter table public.vb_demo_email_outbox enable row level security;
revoke all on public.vb_demo_email_outbox from anon,authenticated;
create or replace function public.vb_enqueue_assigned_email() returns trigger language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
select o.id into v_id from public.vb_demo_orders o where o.id=new.order_id and nullif(o.customer_email,'') is not null and not exists(select 1 from public.vb_demo_tasks t where t.order_id=o.id and t.assigned_worker_id is null and t.status<>'Cancelado');
if v_id is not null then insert into public.vb_demo_email_outbox(order_id,event,recipient) select o.id,'assigned',o.customer_email from public.vb_demo_orders o where o.id=v_id on conflict(order_id,event) do nothing; end if;
return new;
end; $$;
drop trigger if exists vb_assigned_email_enqueue on public.vb_demo_tasks;
create trigger vb_assigned_email_enqueue after update of assigned_worker_id,status on public.vb_demo_tasks for each row execute function public.vb_enqueue_assigned_email();
create or replace function public.vb_submit_demo_order(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_code text;
  v_ref text;
  v_day date;
  v_slot text;
  v_start integer;
  v_lines jsonb;
  v_line jsonb;
  v_duration numeric;
  v_count integer;
begin
  if jsonb_typeof(p_request) <> 'object' then raise exception 'Solicitud inválida'; end if;
  v_ref := p_request->>'clientReference';
  if v_ref is null or v_ref !~ '^[A-Za-z0-9-]{18,80}$' then
    raise exception 'Identificador de solicitud inválido';
  end if;
  -- Reenvío de la misma solicitud = mismo pedido (idempotencia por UUID cliente).
  select id,display_code into v_id,v_code from public.vb_demo_orders where client_reference=v_ref;
  if found then return jsonb_build_object('id',v_id,'code',v_code,'demo',true); end if;
  if length(trim(coalesce(p_request->>'customer',''))) not between 3 and 90 or
     length(trim(coalesce(p_request->>'address',''))) not between 5 and 180 or
     length(trim(coalesce(p_request->>'commune',''))) not between 2 and 80 or
     length(coalesce(p_request->>'phone','')) > 30 or
     length(coalesce(p_request->>'notes','')) > 500 then
    raise exception 'Revisa los datos del pedido';
  end if;
  if (p_request->>'date') !~ '^20[0-9]{2}-[01][0-9]-[0-3][0-9]$' then
    raise exception 'Fecha incorrecta';
  end if;
  v_day := (p_request->>'date')::date;
  v_slot := p_request->>'slot';
  if extract(isodow from v_day) in (6,7) then raise exception 'Solo se atienden solicitudes de lunes a viernes'; end if;
  if v_slot not in ('Mañana · 08:00','Tarde · 13:00') then
    raise exception 'Horario incorrecto';
  end if;
  v_start := case when v_slot = 'Mañana · 08:00' then 8 else 13 end;
  if (v_day + make_interval(hours=>v_start)) at time zone 'America/Santiago'
      < now() + interval '24 hours' then
    raise exception 'Debes reservar con 24 horas de anticipación';
  end if;
  if nullif(trim(coalesce(p_request->>'email','')),'') is not null and (length(p_request->>'email')>254 or p_request->>'email' !~* '^[^ @]+@[^ @]+\.[^ @]+$') then raise exception 'Correo de cliente no válido'; end if;
  v_lines := p_request->'lines';
  if jsonb_typeof(v_lines) <> 'array' or jsonb_array_length(v_lines) not between 1 and 15 then
    raise exception 'Se requiere de 1 a 15 servicios';
  end if;
  if length(coalesce(p_request->>'paymentMethod','')) > 10 or
     (p_request->>'paymentMethod') not in ('credit','debit','transfer','demo') then
    raise exception 'Método de pago de prueba inválido';
  end if;
  if coalesce((p_request->>'total')::numeric,0) not between 0 and 20000000 then
    raise exception 'Total fuera de rango';
  end if;
  for v_line in select value from jsonb_array_elements(v_lines)
  loop
    if length(trim(coalesce(v_line->>'name',''))) not between 3 and 150 or
       length(trim(coalesce(v_line->>'id',''))) not between 2 and 80 or
       coalesce((v_line->>'qty')::integer,0) not between 1 and 25 or
       jsonb_typeof(v_line->'extras') <> 'array' or
       jsonb_array_length(v_line->'extras') > 25 then
       raise exception 'Servicio incompleto o inválido';
    end if;
    if v_line->>'durationHours' is not null then
      v_duration := (v_line->>'durationHours')::numeric;
      if v_duration <= 0 or v_duration > 10 or v_start+v_duration > 18 then
        raise exception 'La duración de la jornada supera las 18:00';
      end if;
    end if;
  end loop;
  v_id:=gen_random_uuid();
  v_code:='VB-' || upper(substring(replace(v_id::text,'-',''),1,10));
  insert into public.vb_demo_orders(id,display_code,client_reference,
     customer_name,phone,address,commune,service_date,slot,notes,estimated_total,payment_method,customer_email)
  values(v_id,v_code,v_ref,trim(p_request->>'customer'),coalesce(p_request->>'phone',''),
   trim(p_request->>'address'),trim(p_request->>'commune'),v_day,v_slot,
   coalesce(p_request->>'notes',''),(p_request->>'total')::integer,p_request->>'paymentMethod',nullif(trim(coalesce(p_request->>'email','')),''));
  for v_line in select value from jsonb_array_elements(v_lines)
  loop
    insert into public.vb_demo_tasks(order_id,service_id,name,category,quantity,extras,duration_hours,base_hours,work_details)
    values(v_id,v_line->>'id',v_line->>'name',coalesce(v_line->>'category',''),
      (v_line->>'qty')::integer,v_line->'extras',
      nullif(v_line->>'durationHours','')::numeric, nullif(v_line->>'baseHours','')::numeric,coalesce(v_line->'details','{}'::jsonb));
  end loop;
  return jsonb_build_object('id',v_id,'code',v_code,'demo',true);
exception when unique_violation then
  select id,display_code into v_id,v_code from public.vb_demo_orders where client_reference=v_ref;
  if found then return jsonb_build_object('id',v_id,'code',v_code,'demo',true); end if;
  raise;
end;
$$;