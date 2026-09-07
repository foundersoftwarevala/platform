-- The public FAQ and trust policies ask "or is this an operator?", so anon has
-- to be able to call that check. It reads the caller's own JWT role and returns
-- false for a visitor, which is exactly the answer a visitor should get; being
-- unable to call it at all turned an honest "no" into a permission error and
-- broke the storefront read.
grant execute on function public.mm_is_operator() to anon;
grant execute on function public.sf_faqs() to anon, authenticated;
grant execute on function public.trust_evaluate(uuid, text) to anon, authenticated;
