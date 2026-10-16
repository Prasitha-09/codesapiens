import { mkdtemp,readFile,readdir,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve,sep } from "node:path";
import net from "node:net";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import assert from "node:assert/strict";
const directory=await mkdtemp(join(tmpdir(),"quiz-races-"));
const port=await new Promise((r,j)=>{const s=net.createServer();s.on("error",j);s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>r(p));});});
const server=new EmbeddedPostgres({databaseDir:directory,user:"postgres",password:"postgres",port,persistent:false,initdbFlags:["--encoding=UTF8","--no-locale"],onLog:()=>{},onError:console.error});
const clients=[];
async function connect(){const c=new pg.Client({host:"127.0.0.1",port,user:"postgres",password:"postgres",database:"postgres"});await c.connect();clients.push(c);return c;}
async function rpc(c,user,name,args,hold=0){await c.query("begin");try{await c.query("set local role authenticated");await c.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);const result=await c.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) v`,args);if(hold)await new Promise(r=>setTimeout(r,hold));await c.query("commit");return result.rows[0].v;}catch(e){await c.query("rollback");throw e;}}
try{
 console.log("Initializing PostgreSQL…");await server.initialise();console.log("Starting PostgreSQL…");await server.start();const setup=await connect();
 await setup.query(await readFile("tests/db/supabase-stub.sql","utf8"));
 for(const f of (await readdir("supabase/migrations")).filter(f=>f.endsWith(".sql")).sort())await setup.query(await readFile(`supabase/migrations/${f}`,"utf8"));
 const admin=crypto.randomUUID(),a=crypto.randomUUID(),b=crypto.randomUUID();for(const id of [admin,a,b])await setup.query("insert into auth.users(id) values($1)",[id]);
 await setup.query("update public.profiles set role='admin' where id=$1",[admin]);
 const event=await rpc(setup,admin,"quiz_admin",["create_event",null,JSON.stringify({name:"Race",join_code:"RACE26"})]);
 const cmd=(name,data={},c=setup,hold=0)=>rpc(c,admin,"quiz_admin",[name,event,JSON.stringify(data)],hold);
 const team=await cmd("team",{name:"Only team",color:"#FFD95A",capacity:1});
 const c1=await connect(),c2=await connect();
 let result=await Promise.allSettled([rpc(c1,a,"quiz_join",["RACE26","A",team],150),rpc(c2,b,"quiz_join",["RACE26","B",team])]);
 assert.equal(result.filter(r=>r.status==="fulfilled").length,1);console.log("PASS Concurrent registrations cannot exceed team capacity");
 const user=result[0].status==="fulfilled"?a:b;
 const state=await rpc(setup,admin,"quiz_admin_state",[event]);const round=state.rounds[0].id;
 const mcq=await cmd("question",{round_id:round,prompt:"Answer?",kind:"mcq",options:["yes","no"],answer_key:"yes",position:1});
 const short=await cmd("question",{round_id:round,prompt:"Short?",kind:"short",options:[],answer_key:"answer",position:2});
 await cmd("status",{status:"live"});await cmd("publish",{id:mcq});await cmd("window",{open:true});
 result=await Promise.allSettled([rpc(c1,user,"quiz_submit",[event,mcq,"yes"],150),rpc(c2,user,"quiz_submit",[event,mcq,"yes"])]);
 assert.equal(result.filter(r=>r.status==="fulfilled").length,1);
 assert.equal(Number((await setup.query("select sum(points) total from public.quiz_scores where event_id=$1",[event])).rows[0].total),5);console.log("PASS Simultaneous correct answers earn exactly one reward");
 await cmd("publish",{id:short});await cmd("window",{open:true});const submission=await rpc(setup,user,"quiz_submit",[event,short,"answer"]);
 result=await Promise.allSettled([cmd("evaluate",{id:submission,verdict:"correct"},c1,150),cmd("evaluate",{id:submission,verdict:"correct"},c2)]);
 assert.equal(result.filter(r=>r.status==="fulfilled").length,1);assert.equal(Number((await setup.query("select sum(points) total from public.quiz_scores where event_id=$1",[event])).rows[0].total),10);console.log("PASS Simultaneous reviews earn exactly one reward");
 await cmd("window",{open:true});const closing=cmd("window",{open:false},c1,200);await new Promise(r=>setTimeout(r,50));
 result=await Promise.allSettled([closing,rpc(c2,user,"quiz_submit",[event,short,"answer"])]);
 assert.equal(result[0].status,"fulfilled");assert.equal(result[1].status,"rejected");assert.match(result[1].reason.message,/closed/);console.log("PASS Closing submissions serializes with waiting answer requests");
 console.log("4 real PostgreSQL quiz concurrency checks passed.");
}finally{
 for(const c of clients)await c.end().catch(()=>{});
 if(server.process && server.process.exitCode!==null)server.process=undefined;
 await server.stop().catch(()=>{});
 const parent=resolve(tmpdir());if(resolve(directory).startsWith(parent+sep)&&directory.includes("quiz-races-"))await rm(directory,{recursive:true,force:true});
}
