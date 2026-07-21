-- PROCUREMENT KNOWLEDGE DISCOVERY V1
-- STATUS: PROPOSED FOR REVIEW; DO NOT APPLY WITHOUT PROJECT ORCHESTRATOR APPROVAL.
-- This migration creates a separate knowledge layer and does not modify
-- public.state_contract_opportunities or activate an AOIE taxonomy.

begin;

create table if not exists public.piee_extraction_runs (
  id uuid primary key default gen_random_uuid(),
  run_version text not null,
  taxonomy_version text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  records_considered integer not null default 0 check (records_considered >= 0),
  records_processed integer not null default 0 check (records_processed >= 0),
  records_skipped integer not null default 0 check (records_skipped >= 0),
  records_failed integer not null default 0 check (records_failed >= 0),
  terms_discovered integer not null default 0 check (terms_discovered >= 0),
  capabilities_discovered integer not null default 0 check (capabilities_discovered >= 0),
  relationships_discovered integer not null default 0 check (relationships_discovered >= 0),
  recommendations_created integer not null default 0 check (recommendations_created >= 0),
  runtime_ms bigint check (runtime_ms is null or runtime_ms >= 0),
  error_summary jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.piee_opportunity_extractions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.state_contract_opportunities(id) on delete restrict,
  extraction_version text not null,
  taxonomy_version text not null,
  extraction_status text not null check (extraction_status in ('pending','auto_extracted','review_required','approved','rejected','failed')),
  primary_procurement_type text,
  primary_capability text,
  secondary_capabilities jsonb not null default '[]'::jsonb,
  services jsonb not null default '[]'::jsonb,
  products jsonb not null default '[]'::jsonb,
  technologies jsonb not null default '[]'::jsonb,
  deliverables jsonb not null default '[]'::jsonb,
  requirements jsonb not null default '[]'::jsonb,
  licenses jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  business_roles jsonb not null default '[]'::jsonb,
  buyer_terms jsonb not null default '[]'::jsonb,
  classification_codes jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  confidence_band text not null check (confidence_band in ('HIGHLY VERIFIED','HIGH CONFIDENCE','MODERATE CONFIDENCE','LOW CONFIDENCE','REVIEW REQUIRED')),
  source_provenance jsonb not null,
  extraction_fingerprint text not null,
  extracted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, extraction_version, taxonomy_version),
  unique (extraction_fingerprint)
);

create table if not exists public.piee_procurement_terms (
  id uuid primary key default gen_random_uuid(),
  original_term text not null,
  normalized_term text not null,
  term_type text not null,
  language text not null default 'en',
  jurisdiction text,
  publisher_id text references public.pdas_publishers(publisher_id) on delete set null,
  distinct_opportunity_frequency integer not null default 0 check (distinct_opportunity_frequency >= 0),
  first_observed_at timestamptz,
  last_observed_at timestamptz,
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  review_status text not null default 'review_required'
    check (review_status in ('review_required','approved','rejected','retired')),
  supporting_opportunity_ids uuid[] not null default '{}'::uuid[],
  taxonomy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lower(original_term), lower(normalized_term), term_type, taxonomy_version)
);

create table if not exists public.piee_capability_relationships (
  id uuid primary key default gen_random_uuid(),
  source_capability_id text not null,
  target_capability_id text not null,
  relationship_type text not null,
  distinct_opportunity_frequency integer not null default 0 check (distinct_opportunity_frequency >= 0),
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  geographic_scope jsonb not null default '[]'::jsonb,
  publisher_scope jsonb not null default '[]'::jsonb,
  source_opportunity_ids uuid[] not null default '{}'::uuid[],
  taxonomy_version text not null,
  first_observed_at timestamptz,
  last_observed_at timestamptz,
  active boolean not null default false,
  review_status text not null default 'review_required'
    check (review_status in ('review_required','approved','rejected','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_capability_id <> target_capability_id),
  unique (source_capability_id, target_capability_id, relationship_type, taxonomy_version)
);

create table if not exists public.piee_taxonomy_recommendations (
  id uuid primary key default gen_random_uuid(),
  recommendation_type text not null
    check (recommendation_type in ('create','merge','split','rename','retire','replace','reclassify','synonym','code_mapping','confidence_change')),
  proposed_domain text,
  proposed_category text,
  proposed_group text,
  proposed_capability text,
  proposed_procurement_type text,
  proposed_synonyms jsonb not null default '[]'::jsonb,
  proposed_code_mappings jsonb not null default '[]'::jsonb,
  supporting_opportunity_ids uuid[] not null default '{}'::uuid[],
  corpus_frequency integer not null default 0 check (corpus_frequency >= 0),
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  rationale text not null,
  source_provenance jsonb not null,
  taxonomy_version text not null,
  review_status text not null default 'review_required'
    check (review_status in ('review_required','approved','rejected','implemented','retired')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists piee_extractions_opportunity_idx
  on public.piee_opportunity_extractions (opportunity_id, extraction_version, taxonomy_version);

create index if not exists piee_extractions_review_idx
  on public.piee_opportunity_extractions (extraction_status, confidence);

create index if not exists piee_terms_normalized_idx
  on public.piee_procurement_terms (lower(normalized_term), term_type);

create index if not exists piee_terms_supporting_opportunities_gin
  on public.piee_procurement_terms using gin (supporting_opportunity_ids);

create index if not exists piee_relationships_capability_idx
  on public.piee_capability_relationships (source_capability_id, target_capability_id, relationship_type);

create index if not exists piee_relationships_supporting_opportunities_gin
  on public.piee_capability_relationships using gin (source_opportunity_ids);

create index if not exists piee_taxonomy_review_idx
  on public.piee_taxonomy_recommendations (review_status, taxonomy_version, confidence desc);

alter table public.piee_extraction_runs enable row level security;
alter table public.piee_opportunity_extractions enable row level security;
alter table public.piee_procurement_terms enable row level security;
alter table public.piee_capability_relationships enable row level security;
alter table public.piee_taxonomy_recommendations enable row level security;

revoke all on table public.piee_extraction_runs from anon, authenticated;
revoke all on table public.piee_opportunity_extractions from anon, authenticated;
revoke all on table public.piee_procurement_terms from anon, authenticated;
revoke all on table public.piee_capability_relationships from anon, authenticated;
revoke all on table public.piee_taxonomy_recommendations from anon, authenticated;

grant select, insert, update, delete on table public.piee_extraction_runs to service_role;
grant select, insert, update, delete on table public.piee_opportunity_extractions to service_role;
grant select, insert, update, delete on table public.piee_procurement_terms to service_role;
grant select, insert, update, delete on table public.piee_capability_relationships to service_role;
grant select, insert, update, delete on table public.piee_taxonomy_recommendations to service_role;

comment on table public.piee_opportunity_extractions is
  'Versioned procurement knowledge extraction output. Does not replace the authoritative opportunity inventory.';
comment on table public.piee_taxonomy_recommendations is
  'Evidence-backed taxonomy proposals. Rows are non-operational until approved through AOIE taxonomy governance.';

commit;
