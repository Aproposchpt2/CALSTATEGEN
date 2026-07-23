create extension if not exists pgcrypto;

create table if not exists public.natcorp_daily_runs (
  run_id uuid primary key default gen_random_uuid(),
  status text not null default 'queued' check (status in ('queued','running','completed','completed_with_failures','failed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  triggered_by text not null default 'command_center',
  current_stage text,
  total_jobs integer not null default 0 check (total_jobs >= 0),
  completed_jobs integer not null default 0 check (completed_jobs >= 0),
  failed_jobs integer not null default 0 check (failed_jobs >= 0),
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create unique index if not exists natcorp_one_active_daily_run
  on public.natcorp_daily_runs ((true))
  where status in ('queued','running');
create index if not exists natcorp_daily_runs_created_idx
  on public.natcorp_daily_runs (created_at desc);

create table if not exists public.natcorp_agent_jobs (
  job_id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.natcorp_daily_runs(run_id) on delete cascade,
  agent_type text not null check (agent_type in ('acquisition','intelligence_processing','release_eligibility_aoie','dashboard_delivery','executive_reporting')),
  entity_type text not null,
  entity_id text,
  status text not null default 'queued' check (status in ('queued','running','retry_scheduled','completed','failed','skipped')),
  priority integer not null default 100,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  error_message text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);
create index if not exists natcorp_agent_jobs_run_status_idx
  on public.natcorp_agent_jobs (run_id, status, priority, available_at);

create table if not exists public.natcorp_workflow_events (
  event_id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.natcorp_daily_runs(run_id) on delete cascade,
  event_type text not null,
  source_agent text not null,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists natcorp_workflow_events_run_idx
  on public.natcorp_workflow_events (run_id, created_at);

create table if not exists public.natcorp_daily_briefs (
  brief_id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.natcorp_daily_runs(run_id) on delete cascade,
  report_date date not null default current_date,
  enterprise_status text not null,
  executive_summary text not null,
  metrics jsonb not null default '{}'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  customer_intelligence jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);
create index if not exists natcorp_daily_briefs_report_date_idx
  on public.natcorp_daily_briefs (report_date desc, generated_at desc);

create table if not exists public.natcorp_customer_feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  session_id text not null check (char_length(session_id) between 8 and 200),
  relevance_rating text not null check (relevance_rating in ('very_relevant','somewhat_relevant','not_relevant')),
  experience_rating text not null check (experience_rating in ('excellent','good','fair','poor')),
  improvement_comment text check (char_length(coalesce(improvement_comment,'')) <= 2000),
  opportunities_viewed integer not null default 0 check (opportunities_viewed between 0 and 10000),
  analyze_fit_count integer not null default 0 check (analyze_fit_count between 0 and 10000),
  completed_stage text check (char_length(coalesce(completed_stage,'')) <= 100),
  submitted_at timestamptz not null default now()
);
create index if not exists natcorp_customer_feedback_submitted_idx
  on public.natcorp_customer_feedback (submitted_at desc);

alter table public.state_contract_opportunities
  add column if not exists natcorp_release_status text not null default 'not_evaluated',
  add column if not exists natcorp_release_reasons jsonb not null default '[]'::jsonb,
  add column if not exists natcorp_release_evaluated_at timestamptz,
  add column if not exists natcorp_released_at timestamptz,
  add column if not exists natcorp_contract_dna_status text not null default 'not_started',
  add column if not exists natcorp_contract_dna_updated_at timestamptz;

create index if not exists state_contract_natcorp_release_idx
  on public.state_contract_opportunities (natcorp_release_status, response_deadline);

alter table public.natcorp_daily_runs enable row level security;
alter table public.natcorp_agent_jobs enable row level security;
alter table public.natcorp_workflow_events enable row level security;
alter table public.natcorp_daily_briefs enable row level security;
alter table public.natcorp_customer_feedback enable row level security;

revoke all on public.natcorp_daily_runs from anon, authenticated;
revoke all on public.natcorp_agent_jobs from anon, authenticated;
revoke all on public.natcorp_workflow_events from anon, authenticated;
revoke all on public.natcorp_daily_briefs from anon, authenticated;
revoke all on public.natcorp_customer_feedback from anon, authenticated;
grant insert on public.natcorp_customer_feedback to anon, authenticated;
grant all on public.natcorp_daily_runs, public.natcorp_agent_jobs,
  public.natcorp_workflow_events, public.natcorp_daily_briefs,
  public.natcorp_customer_feedback to service_role;

drop policy if exists natcorp_feedback_public_insert on public.natcorp_customer_feedback;
create policy natcorp_feedback_public_insert
on public.natcorp_customer_feedback
for insert
to anon, authenticated
with check (
  relevance_rating in ('very_relevant','somewhat_relevant','not_relevant')
  and experience_rating in ('excellent','good','fair','poor')
  and opportunities_viewed between 0 and 10000
  and analyze_fit_count between 0 and 10000
  and char_length(session_id) between 8 and 200
  and char_length(coalesce(improvement_comment,'')) <= 2000
);

create or replace function public.natcorp_register_documents(p_opportunity_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, piee, pg_temp
as $$
declare
  r record;
  d jsonb;
  v_url text;
  v_name text;
  v_registered integer := 0;
begin
  for r in
    select id, pdas_record_id, title, document_urls
    from public.state_contract_opportunities
    where id = any(p_opportunity_ids)
  loop
    for d in select value from jsonb_array_elements(coalesce(r.document_urls, '[]'::jsonb))
    loop
      v_url := case when jsonb_typeof(d) = 'string' then trim(both '"' from d::text)
                    else coalesce(d->>'url', d->>'href', d->>'source_url') end;
      v_name := case when jsonb_typeof(d) = 'object' then coalesce(d->>'name', d->>'filename', d->>'title') else null end;
      if nullif(v_url, '') is not null then
        insert into piee.document_sources(opportunity_id, source_url, document_name, document_type, source_kind)
        values (r.id, v_url, coalesce(v_name, r.title), 'procurement_document', 'attachment')
        on conflict (opportunity_id, source_url) do update
          set document_name = coalesce(excluded.document_name, piee.document_sources.document_name),
              updated_at = now();
        v_registered := v_registered + 1;
      end if;
    end loop;

    insert into public.solicitation_documents(opportunity_id, sow_summary, requirements_matrix, ingestion_status, ingested_at)
    values (r.pdas_record_id, null, '[]'::jsonb, 'registered', now())
    on conflict (opportunity_id) do update
      set ingestion_status = case when public.solicitation_documents.ingestion_status = 'complete' then 'complete' else 'registered' end,
          ingested_at = coalesce(public.solicitation_documents.ingested_at, now());
  end loop;
  return jsonb_build_object('documents_registered', v_registered, 'opportunities_processed', coalesce(array_length(p_opportunity_ids,1),0));
end;
$$;
revoke all on function public.natcorp_register_documents(uuid[]) from public, anon, authenticated;
grant execute on function public.natcorp_register_documents(uuid[]) to service_role;

create or replace function public.natcorp_build_contract_dna(p_opportunity_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, piee, pg_temp
as $$
declare
  r record;
  v_complete integer := 0;
  v_enrichment integer := 0;
  v_status text;
  v_summary text;
begin
  for r in
    select * from public.state_contract_opportunities where id = any(p_opportunity_ids)
  loop
    v_summary := nullif(coalesce(r.description, r.title), '');
    v_status := case
      when v_summary is not null
       and (jsonb_array_length(coalesce(r.document_urls,'[]'::jsonb)) > 0 or coalesce(r.requirements,'{}'::jsonb) <> '{}'::jsonb)
      then 'complete' else 'enrichment_required' end;

    insert into piee.solicitation_profiles(
      opportunity_id, source_content_fingerprint, title, solicitation_number,
      agency, department, state_code, county, city, procurement_platform,
      procurement_method, due_date, estimated_value_min, estimated_value_max,
      buying_summary, required_capability_summary, extraction_method,
      extraction_confidence, extracted_at, updated_at
    ) values (
      r.id, r.content_fingerprint, r.title, r.solicitation_number,
      r.issuing_organization, r.issuing_department, r.state_code,
      r.place_of_performance_county, r.place_of_performance_city, r.source_platform,
      r.procurement_type, r.response_deadline, r.estimated_value_min, r.estimated_value_max,
      v_summary, case when coalesce(r.requirements,'{}'::jsonb) <> '{}'::jsonb then r.requirements::text else null end,
      'natcorp_deterministic_v1', coalesce(r.extraction_confidence, 0.55), now(), now()
    )
    on conflict (opportunity_id) do update set
      source_content_fingerprint = excluded.source_content_fingerprint,
      title = excluded.title,
      solicitation_number = excluded.solicitation_number,
      agency = excluded.agency,
      department = excluded.department,
      state_code = excluded.state_code,
      county = excluded.county,
      city = excluded.city,
      procurement_platform = excluded.procurement_platform,
      procurement_method = excluded.procurement_method,
      due_date = excluded.due_date,
      estimated_value_min = excluded.estimated_value_min,
      estimated_value_max = excluded.estimated_value_max,
      buying_summary = excluded.buying_summary,
      required_capability_summary = excluded.required_capability_summary,
      extraction_method = excluded.extraction_method,
      extraction_confidence = excluded.extraction_confidence,
      extracted_at = now(), updated_at = now();

    update public.state_contract_opportunities
      set natcorp_contract_dna_status = v_status,
          natcorp_contract_dna_updated_at = now(),
          qa_status = case when v_status='enrichment_required' and qa_status not in ('verified','rejected') then 'enrichment_required' else qa_status end,
          updated_at = now()
      where id = r.id;
    if v_status='complete' then v_complete := v_complete + 1; else v_enrichment := v_enrichment + 1; end if;
  end loop;
  return jsonb_build_object('contract_dna_completed',v_complete,'enrichment_required',v_enrichment);
end;
$$;
revoke all on function public.natcorp_build_contract_dna(uuid[]) from public, anon, authenticated;
grant execute on function public.natcorp_build_contract_dna(uuid[]) to service_role;

create or replace function public.natcorp_apply_release_gates(p_opportunity_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_reasons jsonb;
  v_status text;
  v_eligible integer := 0;
  v_enrichment integer := 0;
  v_rejected integer := 0;
begin
  for r in
    select * from public.state_contract_opportunities
    where p_opportunity_ids is null or id = any(p_opportunity_ids)
  loop
    v_reasons := '[]'::jsonb;
    if lower(coalesce(r.status,'')) not in ('open','active','posted','upcoming','open_continuous') then v_reasons := v_reasons || '"not_current"'::jsonb; end if;
    if r.response_deadline is null or r.response_deadline < now() then v_reasons := v_reasons || '"invalid_deadline"'::jsonb; end if;
    if nullif(coalesce(r.official_source_url,r.source_url),'') is null then v_reasons := v_reasons || '"missing_official_source"'::jsonb; end if;
    if nullif(r.issuing_organization,'') is null then v_reasons := v_reasons || '"missing_issuer"'::jsonb; end if;
    if nullif(r.description,'') is null and jsonb_array_length(coalesce(r.document_urls,'[]'::jsonb))=0 then v_reasons := v_reasons || '"missing_scope_or_documents"'::jsonb; end if;
    if coalesce(r.requirements,'{}'::jsonb)='{}'::jsonb and coalesce(r.natcorp_contract_dna_status,'') <> 'complete' then v_reasons := v_reasons || '"missing_requirements"'::jsonb; end if;
    if r.duplicate_of is not null then v_reasons := v_reasons || '"duplicate"'::jsonb; end if;
    if not r.is_latest_version then v_reasons := v_reasons || '"superseded"'::jsonb; end if;
    if lower(coalesce(r.qa_status,'')) in ('rejected','failed') then v_reasons := v_reasons || '"qa_rejected"'::jsonb; end if;

    v_status := case
      when v_reasons='[]'::jsonb then 'eligible'
      when v_reasons ?| array['not_current','invalid_deadline','duplicate','superseded','qa_rejected'] then 'rejected'
      else 'enrichment_required' end;

    update public.state_contract_opportunities set
      natcorp_release_status=v_status,
      natcorp_release_reasons=v_reasons,
      natcorp_release_evaluated_at=now(),
      natcorp_released_at=case when v_status='eligible' then coalesce(natcorp_released_at,now()) else null end,
      updated_at=now()
    where id=r.id;
    if v_status='eligible' then v_eligible:=v_eligible+1;
    elsif v_status='enrichment_required' then v_enrichment:=v_enrichment+1;
    else v_rejected:=v_rejected+1; end if;
  end loop;
  return jsonb_build_object('eligible',v_eligible,'enrichment_required',v_enrichment,'rejected',v_rejected);
end;
$$;
revoke all on function public.natcorp_apply_release_gates(uuid[]) from public, anon, authenticated;
grant execute on function public.natcorp_apply_release_gates(uuid[]) to service_role;

create or replace function public.natcorp_touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists natcorp_agent_jobs_updated_at on public.natcorp_agent_jobs;
create trigger natcorp_agent_jobs_updated_at before update on public.natcorp_agent_jobs
for each row execute function public.natcorp_touch_updated_at();
