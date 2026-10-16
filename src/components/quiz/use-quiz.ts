"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { QuizState, AdminState } from "@/lib/quiz/types";
export const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export function useQuiz(admin = false, membership = false) {
 const client = useMemo(() => configured ? createClient() as unknown as SupabaseClient : null, []);
 const [data,setData] = useState<QuizState | AdminState>({event:null,teams:[]});
 const [error,setError] = useState(""); const [loading,setLoading] = useState(configured);
 const [eventId,setEventId] = useState<string | null>(null);
 const refresh = useCallback(async () => {
  if (!client) return;
  let selected = eventId;
  if (membership && !selected) {const session = await client.auth.getSession();if(session.data.session){const membership=await client.rpc("quiz_my_event");selected=membership.data;}}
  const {data:next,error:err} = await client.rpc(admin ? "quiz_admin_state" : "quiz_state", {p_event:selected});
  if (err) setError(err.message); else {setData(next);setError("");} setLoading(false);
 },[client,admin,eventId,membership]);
 useEffect(() => {
  let active = true;
  const load = () => {if(active) void refresh();}; load();
  if(!client) return;
  const channel = client.channel(`quiz-${admin}-${eventId ?? "latest"}`).on("postgres_changes",{event:"*",schema:"public",table:"quiz_signal"},load).subscribe();
  const timer = window.setInterval(load,5000);
  const auth = client.auth.onAuthStateChange(() => {window.setTimeout(load,0);});
  return () => {active=false;window.clearInterval(timer);void client.removeChannel(channel);auth.data.subscription.unsubscribe();};
 },[client,refresh,admin,eventId]);
 return {client,data,error,loading,refresh,setEventId};
}
