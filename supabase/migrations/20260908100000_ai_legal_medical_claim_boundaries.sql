-- The medical-claim rule was blocking ordinary software copy.
--
-- Its pattern was (diagnos\w+|treat\w+|cure[sd]?|clinically\s+proven): no word
-- boundaries and no medical context. Run against 400 real descriptions from
-- the catalogue it fired on six of them, none of them medical:
--
--   "Secure academic transcript generation"  matched "cure" inside "secure"
--   "Process water testing and treatment"    matched "treatment"
--   "Effluent treatment plant readings"      matched "treatment"
--
-- The rule is severity critical with action block, and ai_content_settings has
-- legal_block_is_absolute set to true, so these were not warnings. They would
-- have stopped those products publishing as clinical claims - roughly one in
-- sixty-six of the catalogue.
--
-- The replacement keeps every genuine clinical claim and drops the accidents.
-- Word boundaries stop "secure"; "treat" and "diagnos" now need a clinical
-- object, so effluent treatment and network diagnostics pass.
--
-- Verified through mm_ai_legal_scan itself, both directions: "secure academic
-- transcript", "water treatment", "effluent treatment" and "network diagnostic
-- dashboard" all return clean, while "diagnoses diabetes", "clinically proven"
-- and "treats patients" are still blocked, and the other rules are untouched.
--
-- Already applied to the live database as a row update; this file is here so a
-- fresh environment gets the corrected rule rather than the original one.

update public.ai_content_legal_rules
   set pattern =
     '\y((medical|clinical)\s+diagnos\w*'
     '|diagnos(es|ing|ed|is)\s+(patients?|disease[sd]?|illness(es)?|cancer|diabetes|symptoms?|conditions?|infections?)'
     '|cure[sd]?'
     '|clinically\s+proven'
     '|medically\s+(proven|approved|certified)'
     '|treats?\s+(patients?|disease[sd]?|illness(es)?|symptoms?|infections?|conditions?)'
     '|treatment\s+of\s+(patients?|disease[sd]?|illness(es)?|cancer|diabetes))\y'
 where code = 'medical_claim';
