-- "Mi página" (D-057): el negocio personaliza su página de reservas.
-- Portada, título, texto, dirección, redes, horarios a la vista, foto y frase de cada
-- profesional y descripción de cada servicio. Las imágenes van al bucket público
-- `logos` dentro de la carpeta del negocio (mismas policies que el logo).

alter table booking.settings
  add column headline   text check (char_length(headline) <= 60),
  add column about      text check (char_length(about) <= 600),
  add column cover_path text check (char_length(cover_path) <= 200),
  add column address    text check (char_length(address) <= 120),
  add column instagram  text check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add column whatsapp   text check (whatsapp ~ '^\+?[0-9]{8,15}$'),
  add column show_hours boolean not null default true;

alter table booking.staff
  add column photo_path text check (char_length(photo_path) <= 200),
  add column bio        text check (char_length(bio) <= 80);

alter table booking.services
  add column description text check (char_length(description) <= 140);

create or replace function booking.get_public_page(p_slug text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business core.businesses;
  v_settings booking.settings;
begin
  v_business := booking.business_by_slug(p_slug);
  if v_business.id is null then
    return null;
  end if;
  select * into v_settings from booking.settings where business_id = v_business.id;
  return jsonb_build_object(
    'name', v_business.name,
    'logoPath', v_business.logo_path,
    'color', v_business.primary_color,
    'timezone', v_business.timezone,
    'message', v_settings.message,
    'maxDaysAhead', v_settings.max_days_ahead,
    'headline', v_settings.headline,
    'about', v_settings.about,
    'coverPath', v_settings.cover_path,
    'address', v_settings.address,
    'instagram', v_settings.instagram,
    'whatsapp', v_settings.whatsapp,
    -- Horario del local: de la primera apertura al último cierre de cada día.
    'hours', case when coalesce(v_settings.show_hours, true) then coalesce((
      select jsonb_agg(jsonb_build_object('weekday', d.weekday, 'opens', d.opens, 'closes', d.closes)
                       order by d.weekday)
        from (select h.weekday, to_char(min(h.start_time), 'HH24:MI') as opens,
                     to_char(max(h.end_time), 'HH24:MI') as closes
                from booking.hours h
                join booking.staff st on st.id = h.staff_id and st.active
               where h.business_id = v_business.id
               group by h.weekday) d), '[]'::jsonb)
      else '[]'::jsonb end,
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'durationMinutes', duration_minutes,
                                          'priceMinor', price_minor, 'description', description)
                       order by sort, name)
        from booking.services where business_id = v_business.id and active), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'photoPath', photo_path, 'bio', bio)
                       order by sort, name)
        from booking.staff where business_id = v_business.id and active), '[]'::jsonb));
end;
$$;

revoke execute on function booking.get_public_page(text) from public;
grant execute on function booking.get_public_page(text) to anon, authenticated;
revoke execute on all functions in schema core from public, anon;
