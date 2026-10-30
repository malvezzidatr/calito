-- These tables are accessed by the backend through the database owner role.
-- Enable RLS so PostgREST roles cannot access rows unless explicit policies are
-- added later. The table owner retains access because FORCE ROW LEVEL SECURITY
-- is intentionally not enabled.
ALTER TABLE public."Meal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WhatsappAuth" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EstimatedFood" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ParsedMessageCache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
