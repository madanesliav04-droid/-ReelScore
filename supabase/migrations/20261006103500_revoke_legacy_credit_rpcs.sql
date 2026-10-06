-- Durable jobs own quota changes; legacy client credit mutation RPCs are closed.

revoke execute on function public.viralplus_consume_credit() from authenticated, anon;
revoke execute on function public.viralplus_refund_credit() from authenticated, anon;
