-- ============================================================================
-- MIGRATION 006D: Design persistence (soft delete, feeder matrix, child RLS)
-- Date: 2026-09-26
--
-- Why: designs were saved only to browser localStorage. Moving them to the
-- database needs:
--   1. designs.archived_at - soft delete for master data (CLAUDE.md rule 8);
--      designsService already filtered on it, so the Designs list failed with
--      42703 "column designs.archived_at does not exist".
--   2. feeders.feeder_number / pick / card - the design editor requires a
--      positive Pick and Card per feeder row; the table could not store them.
--   3. RLS on beam_colours / feeders was USING (true) WITH CHECK (true) for
--      every signed-in user, so a viewer could change any design's feeder
--      matrix. Child rows now follow the parent design's permissions
--      (read: design:read; write: design:create/design:update on a design the
--      user created, or any design for admins - same rule as designs).
--   4. save_design(): writes a design and its whole beam colour x feeder
--      matrix in one transaction (SECURITY INVOKER, so the RLS here applies);
--      the app no longer saves header and children in separate requests.
--
-- Safe to re-run. Rollback:
--   ALTER TABLE public.designs DROP COLUMN IF EXISTS archived_at;
--   ALTER TABLE public.feeders DROP COLUMN IF EXISTS feeder_number,
--     DROP COLUMN IF EXISTS pick, DROP COLUMN IF EXISTS card;
--   (and restore the previous beam_colours_* / feeders_* policies)
-- ============================================================================

ALTER TABLE public.designs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_designs_archived_at ON public.designs (archived_at);

ALTER TABLE public.feeders
  ADD COLUMN IF NOT EXISTS feeder_number TEXT,
  ADD COLUMN IF NOT EXISTS pick DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS card DECIMAL(10, 2);

ALTER TABLE public.feeders DROP CONSTRAINT IF EXISTS feeders_pick_positive;
ALTER TABLE public.feeders
  ADD CONSTRAINT feeders_pick_positive CHECK (pick IS NULL OR pick > 0);
ALTER TABLE public.feeders DROP CONSTRAINT IF EXISTS feeders_card_positive;
ALTER TABLE public.feeders
  ADD CONSTRAINT feeders_card_positive CHECK (card IS NULL OR card > 0);

-- ---------------------------------------------------------------------------
-- Child-table RLS follows the parent design
-- ---------------------------------------------------------------------------
ALTER TABLE public.beam_colours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feeders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS beam_colours_all ON public.beam_colours;
DROP POLICY IF EXISTS beam_colours_select ON public.beam_colours;
DROP POLICY IF EXISTS feeders_all ON public.feeders;
DROP POLICY IF EXISTS feeders_select ON public.feeders;
DROP POLICY IF EXISTS beam_colours_read ON public.beam_colours;
DROP POLICY IF EXISTS beam_colours_write ON public.beam_colours;
DROP POLICY IF EXISTS feeders_read ON public.feeders;
DROP POLICY IF EXISTS feeders_write ON public.feeders;

CREATE POLICY beam_colours_read ON public.beam_colours
  FOR SELECT TO authenticated
  USING (public.user_has_permission(auth.uid(), 'design:read'));

CREATE POLICY beam_colours_write ON public.beam_colours
  FOR ALL TO authenticated
  USING (
    (public.user_has_permission(auth.uid(), 'design:create')
      OR public.user_has_permission(auth.uid(), 'design:update'))
    AND EXISTS (
      SELECT 1 FROM public.designs d
      WHERE d.id = beam_colours.design_id
        AND (d.created_by = auth.uid() OR public.is_admin(auth.uid()))
    )
  )
  WITH CHECK (
    (public.user_has_permission(auth.uid(), 'design:create')
      OR public.user_has_permission(auth.uid(), 'design:update'))
    AND EXISTS (
      SELECT 1 FROM public.designs d
      WHERE d.id = beam_colours.design_id
        AND (d.created_by = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY feeders_read ON public.feeders
  FOR SELECT TO authenticated
  USING (public.user_has_permission(auth.uid(), 'design:read'));

CREATE POLICY feeders_write ON public.feeders
  FOR ALL TO authenticated
  USING (
    (public.user_has_permission(auth.uid(), 'design:create')
      OR public.user_has_permission(auth.uid(), 'design:update'))
    AND EXISTS (
      SELECT 1 FROM public.beam_colours bc
      JOIN public.designs d ON d.id = bc.design_id
      WHERE bc.id = feeders.beam_colour_id
        AND (d.created_by = auth.uid() OR public.is_admin(auth.uid()))
    )
  )
  WITH CHECK (
    (public.user_has_permission(auth.uid(), 'design:create')
      OR public.user_has_permission(auth.uid(), 'design:update'))
    AND EXISTS (
      SELECT 1 FROM public.beam_colours bc
      JOIN public.designs d ON d.id = bc.design_id
      WHERE bc.id = feeders.beam_colour_id
        AND (d.created_by = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- save_design(p_design_id, p_design, p_beam_colours) -> design id
--   p_design_id    NULL to create, else the design to update
--   p_design       {"design_number", "design_name", "dn", "dn_code", "reed", "pick",
--                   "cards", "patti", "total_dc", "total_cut", "work", "blue_apt",
--                   "description", "remarks", "image"}
--   p_beam_colours [{"beam_colour", "display_order",
--                    "feeders": [{"feeder_number", "color_name", "old_number",
--                                 "pick", "card", "display_order"}]}]
-- The matrix is replaced on update. Duplicate design numbers raise 23505.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_design(
  p_design_id UUID,
  p_design JSONB,
  p_beam_colours JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id UUID := p_design_id;
  v_colour JSONB;
  v_colour_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(trim(p_design ->> 'design_number'), '') = '' THEN
    RAISE EXCEPTION 'Design number is required' USING ERRCODE = '23514';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.designs (
      design_number, design_name, dn, dn_code, reed, pick, cards, patti,
      total_dc, total_cut, work, blue_apt, description, remarks, image,
      created_by, updated_by
    ) VALUES (
      upper(trim(p_design ->> 'design_number')),
      NULLIF(trim(p_design ->> 'design_name'), ''),
      NULLIF(p_design ->> 'dn', ''),
      NULLIF(p_design ->> 'dn_code', ''),
      (p_design ->> 'reed')::NUMERIC,
      (p_design ->> 'pick')::NUMERIC,
      (p_design ->> 'cards')::NUMERIC,
      (p_design ->> 'patti')::NUMERIC,
      (p_design ->> 'total_dc')::NUMERIC,
      (p_design ->> 'total_cut')::NUMERIC,
      NULLIF(p_design ->> 'work', ''),
      NULLIF(p_design ->> 'blue_apt', ''),
      NULLIF(p_design ->> 'description', ''),
      NULLIF(p_design ->> 'remarks', ''),
      NULLIF(p_design ->> 'image', ''),
      auth.uid(),
      auth.uid()
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.designs SET
      design_number = upper(trim(p_design ->> 'design_number')),
      design_name = NULLIF(trim(p_design ->> 'design_name'), ''),
      dn = NULLIF(p_design ->> 'dn', ''),
      dn_code = NULLIF(p_design ->> 'dn_code', ''),
      reed = (p_design ->> 'reed')::NUMERIC,
      pick = (p_design ->> 'pick')::NUMERIC,
      cards = (p_design ->> 'cards')::NUMERIC,
      patti = (p_design ->> 'patti')::NUMERIC,
      total_dc = (p_design ->> 'total_dc')::NUMERIC,
      total_cut = (p_design ->> 'total_cut')::NUMERIC,
      work = NULLIF(p_design ->> 'work', ''),
      blue_apt = NULLIF(p_design ->> 'blue_apt', ''),
      description = NULLIF(p_design ->> 'description', ''),
      remarks = NULLIF(p_design ->> 'remarks', ''),
      image = NULLIF(p_design ->> 'image', ''),
      updated_by = auth.uid(),
      updated_at = NOW()
    WHERE id = v_id AND archived_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Design not found, archived, or you do not have permission to edit it'
        USING ERRCODE = '42501';
    END IF;
    DELETE FROM public.beam_colours WHERE design_id = v_id;
  END IF;

  FOR v_colour IN SELECT value FROM jsonb_array_elements(COALESCE(p_beam_colours, '[]'::JSONB))
  LOOP
    INSERT INTO public.beam_colours (design_id, beam_colour, display_order)
    VALUES (
      v_id,
      trim(v_colour ->> 'beam_colour'),
      COALESCE((v_colour ->> 'display_order')::INTEGER, 1)
    )
    RETURNING id INTO v_colour_id;

    INSERT INTO public.feeders (
      beam_colour_id, feeder_number, color_name, old_number, pick, card, display_order
    )
    SELECT
      v_colour_id,
      f ->> 'feeder_number',
      COALESCE(f ->> 'color_name', ''),
      NULLIF(f ->> 'old_number', ''),
      (f ->> 'pick')::NUMERIC,
      (f ->> 'card')::NUMERIC,
      COALESCE((f ->> 'display_order')::INTEGER, 1)
    FROM jsonb_array_elements(COALESCE(v_colour -> 'feeders', '[]'::JSONB)) AS f;
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_design(UUID, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_design(UUID, JSONB, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
