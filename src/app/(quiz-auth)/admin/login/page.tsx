import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import "@/components/quiz/quiz.css";
export default function Page(){return <div className="quiz-app"><div className="quiz-card" style={{maxWidth:500,margin:"20px auto"}}><p className="quiz-kicker">Organizer access</p><h1 style={{fontSize:44,letterSpacing:-2}}>Behind the scenes.</h1><p className="quiz-muted" style={{marginBottom:24}}>Sign in with your administrator account. Only an existing administrator can access the control room.</p><Suspense fallback={<p>Loading…</p>}><LoginForm admin/></Suspense></div></div>;}
