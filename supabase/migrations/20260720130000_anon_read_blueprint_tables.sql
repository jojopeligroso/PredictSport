-- Anon read access to tournament blueprint tables.
--
-- Public hub pages (/hundred, /ligas-invernales) render blueprint metadata
-- (names, dates, stages, bracket teams) without auth. The existing SELECT
-- policies are granted to `authenticated` only, so anon queries silently
-- return zero rows and the hubs render empty for logged-out visitors.
--
-- Blueprint tables are non-sensitive, read-only reference data (real-world
-- tournament facts). Additive policies only — no existing policy is touched.

CREATE POLICY "Anyone can view tournaments"
  ON public.sporting_tournaments FOR SELECT
  TO anon USING (true);

CREATE POLICY "Anyone can view stages"
  ON public.sporting_stages FOR SELECT
  TO anon USING (true);

CREATE POLICY "Anyone can view bracket templates"
  ON public.bracket_templates FOR SELECT
  TO anon USING (true);
