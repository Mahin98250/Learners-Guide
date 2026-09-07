-- Keep one notification per parent for each result record.
-- Re-publishing/editing a result updates the same notification instead of creating duplicates.
create or replace function public.notify_parents_of_test_result()
returns trigger
language plpgsql
security definer
set search_path to public, pg_temp
as $$
declare
  test_row public.tests%rowtype;
  student_name text;
  pct numeric;
  parent_row record;
  notification_id text;
  notification_desc text;
begin
  if tg_op = 'UPDATE' and old.marks is not distinct from new.marks and old.remarks is not distinct from new.remarks then
    return new;
  end if;

  select * into test_row from public.tests where id = new.test_id limit 1;
  select name into student_name from public.students where id = new.student_id limit 1;
  pct := case when coalesce(test_row.total_marks,0) > 0 then round((new.marks / test_row.total_marks) * 100, 2) else null end;
  notification_desc := 'Result published for ' || coalesce(student_name,'your student') || ': ' || coalesce(test_row.subject,'Test') || ' — ' || new.marks::text || '/' || coalesce(test_row.total_marks,0)::text || ' (' || coalesce(pct::text,'—') || '%).' || case when nullif(trim(coalesce(new.remarks,'')),'') is not null then ' Remarks: ' || trim(new.remarks) else '' end;

  for parent_row in
    select distinct parent_auth_id
    from public.parent_student_links
    where student_id = new.student_id
      and lower(coalesce(status,'')) = 'active'
      and parent_auth_id is not null
  loop
    notification_id := 'result-' || new.id || '-' || parent_row.parent_auth_id::text;
    insert into public.notifications (id,title,"desc",time,type,read,uid,created_at)
    values (notification_id,'📊 Result Published: ' || coalesce(test_row.title, test_row.subject, 'Test'),notification_desc,to_char(now(),'DD Mon YYYY, HH12:MI AM'),'test_result',false,parent_row.parent_auth_id::text,now())
    on conflict (id) do update set title=excluded.title,"desc"=excluded."desc",time=excluded.time,read=false,created_at=excluded.created_at;
  end loop;
  return new;
end;
$$;
