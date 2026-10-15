-- SERVICIOS VILLABLANCA | ESQUEMA DE PRUEBA ENTRE DOS TELÉFONOS
-- Ejecutar una sola vez en el SQL Editor de un proyecto SUPABASE del propietario.
-- NO hay pagos, boletas, ni cuentas de trabajadoras. SOLO DATOS FICTICIOS.
-- NO poner service_role key en Android, GitHub ni en navegador.
create extension if not exists pgcrypto;

create table if not exists public.vb_demo_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.vb_demo_workers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 3 and 70),
  specialty text not null default 'Aseo hogar' check (length(specialty) <= 100),
  commune text not null default 'San Felipe' check (length(commune) <= 80),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.vb_demo_orders (
  id uuid primary key default gen_random_uuid(),
  display_code text not null unique,
  client_reference text not null unique,
  customer_name text not null check (length(customer_name) between 3 and 90),
  phone text not null default '' check (length(phone) <= 30),
  address text not null check (length(address) between 5 and 180),
  commune text not null check (length(commune) between 2 and 80),
  service_date date not null,
  slot text not null check (slot in ('Mañana · 08:00','Tarde · 13:00')),
  notes text not null default '' check (length(notes) <= 500),
  estimated_total integer not null default 0 check (estimated_total between 0 and 20000000),
  payment_status text not null default 'No cobrado · DEMO'
    check (payment_status='No cobrado · DEMO'),
  payment_method text not null default 'demo'
    check (payment_method in ('credit','debit','transfer','demo')),
  created_at timestamptz not null default now()
);
create table if not exists public.vb_demo_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.vb_demo_orders(id) on delete cascade,
  service_id text not null check (length(service_id) between 2 and 80),
  name text not null check (length(name) between 3 and 150),
  category text not null check (length(category) <= 60),
  quantity integer not null check (quantity between 1 and 25),
  extras jsonb not null default '[]'::jsonb
    check (jsonb_typeof(extras) = 'array'),
  duration_hours numeric(5,2) check (duration_hours > 0 and duration_hours <= 10),
  assigned_worker_id uuid references public.vb_demo_workers(id),
  start_hour integer check (start_hour between 8 and 17),
  status text not null default 'Recibido'
    check (status in ('Recibido','Confirmado','Asignado','En camino','En servicio','Finalizado','Cancelado')),
  updated_at timestamptz not null default now()
);
create index if not exists vb_demo_orders_date_idx on public.vb_demo_orders(service_date);
create index if not exists vb_demo_tasks_order_idx on public.vb_demo_tasks(order_id);
create index if not exists vb_demo_tasks_worker_idx on public.vb_demo_tasks(assigned_worker_id);

alter table public.vb_demo_admins enable row level security;
alter table public.vb_demo_workers enable row level security;
alter table public.vb_demo_orders enable row level security;
alter table public.vb_demo_tasks enable row level security;

-- Solo el propietario designa administradores tras crear su cuenta Supabase Auth.
-- Nadie puede auto-otorgarse el rol desde la app.
create or replace function public.vb_is_demo_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.vb_demo_admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.vb_is_demo_admin() from public, anon;
grant execute on function public.vb_is_demo_admin() to authenticated;

drop policy if exists vb_admins_self on public.vb_demo_admins;
create policy vb_admins_self on public.vb_demo_admins for select to authenticated
using (user_id=(select auth.uid()));
drop policy if exists vb_orders_admin_read on public.vb_demo_orders;
create policy vb_orders_admin_read on public.vb_demo_orders for select to authenticated
using ((select public.vb_is_demo_admin()));
drop policy if exists vb_tasks_admin_read on public.vb_demo_tasks;
create policy vb_tasks_admin_read on public.vb_demo_tasks for select to authenticated
using ((select public.vb_is_demo_admin()));
drop policy if exists vb_workers_admin_read on public.vb_demo_workers;
create policy vb_workers_admin_read on public.vb_demo_workers for select to authenticated
using ((select public.vb_is_demo_admin()));

-- Restricción explícita: anon NO puede consultar nombres, teléfonos, domicilios,
-- órdenes, personal, ni cambiar la agenda. La única puerta pública es una RPC validada.
revoke all on public.vb_demo_admins,public.vb_demo_workers,
 public.vb_demo_orders,public.vb_demo_tasks from anon;
grant select on public.vb_demo_orders,public.vb_demo_tasks,
 public.vb_demo_workers,public.vb_demo_admins to authenticated;

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
  if v_slot not in ('Mañana · 08:00','Tarde · 13:00') then
    raise exception 'Horario incorrecto';
  end if;
  v_start := case when v_slot = 'Mañana · 08:00' then 8 else 13 end;
  if (v_day + make_interval(hours=>v_start)) at time zone 'America/Santiago'
      < now() + interval '24 hours' then
    raise exception 'Debes reservar con 24 horas de anticipación';
  end if;
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
  v_code:='VB-'+upper(substring(replace(v_id::text,'-',''),1,10));
  insert into public.vb_demo_orders(id,display_code,client_reference,
     customer_name,phone,address,commune,service_date,slot,notes,estimated_total,payment_method)
  values(v_id,v_code,v_ref,trim(p_request->>'customer'),coalesce(p_request->>'phone',''),
   trim(p_request->>'address'),trim(p_request->>'commune'),v_day,v_slot,
   coalesce(p_request->>'notes',''),(p_request->>'total')::integer,p_request->>'paymentMethod');
  for v_line in select value from jsonb_array_elements(v_lines)
  loop
    insert into public.vb_demo_tasks(order_id,service_id,name,category,quantity,extras,duration_hours)
    values(v_id,v_line->>'id',v_line->>'name',coalesce(v_line->>'category',''),
      (v_line->>'qty')::integer,v_line->'extras',
      nullif(v_line->>'durationHours','')::numeric);
  end loop;
  return jsonb_build_object('id',v_id,'code',v_code,'demo',true);
exception when unique_violation then
  select id,display_code into v_id,v_code from public.vb_demo_orders where client_reference=v_ref;
  if found then return jsonb_build_object('id',v_id,'code',v_code,'demo',true); end if;
  raise;
end;
$$;
revoke all on function public.vb_submit_demo_order(jsonb) from public;
grant execute on function public.vb_submit_demo_order(jsonb) to anon,authenticated;

create or replace function public.vb_admin_update_task(
  p_task_id uuid,
  p_worker_id uuid,
  p_status text
) returns void language plpgsql security definer set search_path = ''
as $$
declare
 v_task public.vb_demo_tasks%rowtype;
 v_order public.vb_demo_orders%rowtype;
 v_start integer;
begin
 if not public.vb_is_demo_admin() then raise exception 'No autorizado'; end if;
 if p_status not in ('Recibido','Confirmado','Asignado','En camino','En servicio','Finalizado','Cancelado') then
   raise exception 'Estado inválido';
 end if;
 select * into v_task from public.vb_demo_tasks where id=p_task_id for update;
 if not found then raise exception 'Tarea inexistente'; end if;
 select * into v_order from public.vb_demo_orders where id=v_task.order_id;
 if p_worker_id is not null and not exists
   (select 1 from public.vb_demo_workers where id=p_worker_id and enabled) then
     raise exception 'Trabajadora inexistente o desactivada';
 end if;
 if p_worker_id is null and p_status in ('Asignado','En camino','En servicio','Finalizado') then
   raise exception 'Primero asigna una trabajadora';
 end if;
 v_start := case when v_order.slot='Mañana · 08:00' then 8 else 13 end;
 if p_worker_id is not null and v_task.duration_hours is not null then
   -- Evita dobles asignaciones concurrentes: candado por empleada para esta transacción.
   perform pg_advisory_xact_lock(hashtext(p_worker_id::text));
   if exists (
     select 1 from public.vb_demo_tasks t
     join public.vb_demo_orders o on o.id=t.order_id
     where t.assigned_worker_id=p_worker_id
       and t.id<>p_task_id and o.service_date=v_order.service_date
       and t.status<>'Cancelado' and t.duration_hours is not null
       and v_start < coalesce(t.start_hour,case when o.slot='Mañana · 08:00' then 8 else 13 end)+t.duration_hours
       and coalesce(t.start_hour,case when o.slot='Mañana · 08:00' then 8 else 13 end)
           < v_start+v_task.duration_hours
   ) then
     raise exception 'La trabajadora tiene otro servicio que se superpone';
   end if;
 end if;
 update public.vb_demo_tasks
 set assigned_worker_id=p_worker_id,
     start_hour=case when p_worker_id is not null then v_start else null end,
     status=p_status,updated_at=now()
 where id=p_task_id;
end;
$$;
revoke all on function public.vb_admin_update_task(uuid,uuid,text) from public,anon;
grant execute on function public.vb_admin_update_task(uuid,uuid,text) to authenticated;

create or replace function public.vb_admin_add_worker(
 p_name text,p_specialty text,p_commune text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
 if not public.vb_is_demo_admin() then raise exception 'No autorizado'; end if;
 if length(trim(coalesce(p_name,''))) not between 3 and 70 then raise exception 'Nombre inválido'; end if;
 insert into public.vb_demo_workers(name,specialty,commune)
 values (trim(p_name),left(coalesce(p_specialty,'Aseo hogar'),100),
         left(coalesce(p_commune,'San Felipe'),80)) returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.vb_admin_add_worker(text,text,text) from public,anon;
grant execute on function public.vb_admin_add_worker(text,text,text) to authenticated;

-- Personal completamente ficticio para demos. No insertar trabajadores reales aquí.
insert into public.vb_demo_workers(name,specialty,commune)
select seed.name,seed.specialty,seed.commune from (values
 ('Camila Torres (demo)','Aseo hogar y planchado','San Felipe'),
 ('Valentina Soto (demo)','Aseo hogar y tapices','Santa María'),
 ('Fernanda Morales (demo)','Vidrios y limpieza detallada','Los Andes'),
 ('Javiera Muñoz (demo)','Vehículos y tapices','San Felipe')
) as seed(name,specialty,commune)
where not exists (select 1 from public.vb_demo_workers w where w.name=seed.name);

-- Desbloqueo admin DESPUÉS de crear el usuario en Supabase Auth:
-- insert into public.vb_demo_admins(user_id)
-- select id from auth.users where email='correo@empresa.cl'
-- on conflict (user_id) do nothing;
-- El correo es un EJEMPLO. No se crea automáticamente ninguna cuenta privilegiada.
