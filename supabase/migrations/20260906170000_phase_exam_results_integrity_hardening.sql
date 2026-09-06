create or replace function public.validate_test_result_integrity() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric;
  v_batch_id text;
  v_active boolean;
begin
  select total_marks, batch_id into v_total, v_batch_id
  from public.tests
  where id = new.test_id;

  if v_total is null then
    raise exception 'Test does not exist';
  end if;

  if new.marks is null or new.marks < 0 or new.marks > v_total then
    raise exception 'Marks must be between 0 and the test total marks';
  end if;

  select exists (
    select 1
    from public.batch_students bs
    where bs.student_id = new.student_id
      and bs.batch_id = v_batch_id
      and bs.status = 'active'
      and bs.left_at is null
  ) into v_active;

  if not v_active then
    raise exception 'Student is not an active member of the test batch';
  end if;

  return new;
end;
$$;

drop trigger if exists test_results_integrity on public.test_results;
create trigger test_results_integrity
before insert or update of test_id, student_id, marks on public.test_results
for each row execute function public.validate_test_result_integrity();

revoke all on function public.validate_test_result_integrity() from public, anon, authenticated;
grant execute on function public.validate_test_result_integrity() to authenticated;
