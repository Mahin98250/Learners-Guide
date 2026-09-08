import { useEffect, useMemo, useState } from "react";
import { C } from "@/lg/data";
import { supabase } from "@/lg/supabase";
import { Card, Sec } from "@/lg/ui";

const text = (v) => (v == null ? "" : String(v));
const norm = (v) => text(v).trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const dateKey = (v) => text(v).trim().slice(0, 10);
const todayKey = () => new Date().toISOString().slice(0, 10);
const assessmentKey = (row) => `${norm(row?.title)}|${norm(row?.subject)}|${dateKey(row?.date || row?.test_date)}`;
const STUDENT_CACHE_TTL = 30000;
const studentBatchCache = new Map();
const studentExamCache = new Map();
const studentResultCache = new Map();

async function loadStudentBatchIds(student) {
  const key = String(student?.id || "");
  const cached = studentBatchCache.get(key);
  if (cached && Date.now() - cached.time < STUDENT_CACHE_TTL) return cached.value;
  const ids = new Set();
  const directIds = [student?.batchId, student?.batch_id, ...(Array.isArray(student?.batchIds) ? student.batchIds : [])];
  directIds.filter(Boolean).forEach((id) => ids.add(String(id)));
  if (ids.size === 0 && student?.id) {
    const { data, error } = await supabase.from("batch_students").select("batch_id").eq("student_id", String(student.id)).eq("status", "active");
    if (error) throw error;
    (data || []).forEach((row) => row.batch_id && ids.add(String(row.batch_id)));
  }
  const value = [...ids];
  studentBatchCache.set(key, { time: Date.now(), value });
  return value;
}

export function STExams({ student }) {
  const [schedule, setSchedule] = useState([]), [tests, setTests] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { let live = true; (async () => { setLoading(true); setError(""); try { const cls=text(student?.cls),sec=text(student?.sec),batchIds=await loadStudentBatchIds(student); const cacheKey=`${student?.id||""}|${cls}|${sec}|${[...batchIds].sort().join(",")}`; const cached=studentExamCache.get(cacheKey); if(cached&&Date.now()-cached.time<STUDENT_CACHE_TTL){if(live){setSchedule(cached.value.schedule);setTests(cached.value.tests)}return} const [sr,tr]=await Promise.all([supabase.from("examschedule").select("id,title,subject,cls,sec,date,starttime,endtime,venue,syllabus,totalmarks,createdby,startTime,endTime,totalMarks").eq("cls",cls).order("date",{ascending:true}),batchIds.length?supabase.from("tests").select("id,title,description,batch_id,subject,test_date,total_marks,status,created_at").in("batch_id",batchIds).order("test_date",{ascending:true}):Promise.resolve({data:[],error:null})]); if(sr.error)throw sr.error;if(tr.error)throw tr.error;const fs=(sr.data||[]).filter(r=>!r.sec||String(r.sec)===sec||String(r.sec)==="All"); const value={schedule:fs,tests:tr.data||[]}; studentExamCache.set(cacheKey,{time:Date.now(),value}); if(live){setSchedule(fs);setTests(tr.data||[])}}catch(e){if(live)setError(e instanceof Error?e.message:"Unable to load exams and tests")}finally{if(live)setLoading(false)}})();return()=>{live=false}},[student?.id,student?.sid,student?.batchId,student?.batch_id,student?.batchIds,student?.cls,student?.sec]);
  const testKeys=new Set(tests.map(t=>assessmentKey(t))); const uniqueSchedule=[]; const seenSchedule=new Set(); for(const exam of schedule){const key=assessmentKey(exam);if(testKeys.has(key)||seenSchedule.has(key))continue;seenSchedule.add(key);uniqueSchedule.push(exam)} const uniqueTests=[]; const seenTests=new Set(); for(const test of tests){const key=assessmentKey(test);if(seenTests.has(key))continue;seenTests.add(key);uniqueTests.push(test)}
  const rows=[...uniqueSchedule.map(e=>({kind:"schedule",id:`schedule-${e.id}`,title:e.title||"Exam",subject:e.subject,date:e.date,total:e.totalMarks??e.totalmarks,time:`${e.startTime||e.starttime||"—"}${e.endTime||e.endtime?` – ${e.endTime||e.endtime}`:""}`,venue:e.venue,syllabus:e.syllabus,status:"scheduled"})),...uniqueTests.map(t=>({kind:"test",id:`test-${t.id}`,title:t.title||"Test",subject:t.subject,date:t.test_date,total:t.total_marks,time:"",venue:"",syllabus:t.description,status:t.status}))];
  const upcoming=rows.filter(r=>dateKey(r.date)>=todayKey()).sort((a,b)=>dateKey(a.date).localeCompare(dateKey(b.date))); const previous=rows.filter(r=>dateKey(r.date)<todayKey()).sort((a,b)=>dateKey(b.date).localeCompare(dateKey(a.date)));
  const render=(items,empty)=>items.length?items.map(r=><Card key={r.id} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}><div><div style={{fontWeight:900}}>{r.title}</div><div style={{fontSize:12,color:C.sub,marginTop:3}}>{r.subject||"—"} · {r.kind==="test"?"Test":"Exam"}{r.kind==="test"&&r.status?` · ${r.status}`:""}</div></div><div style={{fontWeight:900,color:C.accent,whiteSpace:"nowrap"}}>{r.date||"—"}</div></div><div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:12,fontSize:11,color:C.sub}}>{r.time&&<span>🕒 {r.time}</span>}{r.venue&&<span>📍 {r.venue}</span>}<span>💯 Total {r.total??"—"}</span></div>{r.syllabus&&<div style={{marginTop:10,padding:10,borderRadius:10,background:C.light,fontSize:12,overflowWrap:"anywhere"}}>{r.syllabus}</div>}</Card>):<Card style={{padding:24,textAlign:"center",color:C.sub}}>{empty}</Card>;
  return <div>{error&&<Card style={{color:C.red,marginBottom:12,background:"#FEF2F2"}}>{error}</Card>}<div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,marginBottom:14}}>{[[upcoming.length,"Upcoming"],[previous.length,"Previous"],[rows.length,"Total"]].map(([n,l])=><Card key={l} style={{padding:12,textAlign:"center"}}><div style={{fontSize:20,fontWeight:900}}>{n}</div><div style={{fontSize:10,color:C.sub}}>{l}</div></Card>)}</div><Sec title="Upcoming Tests & Exams"/>{loading?<Card style={{padding:28,textAlign:"center",color:C.sub}}>Loading exams and tests…</Card>:render(upcoming,"No upcoming tests or exams.")}<Sec title="Previous Tests & Exams"/>{!loading&&render(previous,"No previous tests or exams.")}</div>;
}

export function STResults({ student }) {
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{let live=true;(async()=>{setLoading(true);setError("");try{if(!student?.id){if(live)setRows([]);return}const studentId=String(student.id);const cached=studentResultCache.get(studentId);if(cached&&Date.now()-cached.time<STUDENT_CACHE_TTL){if(live)setRows(cached.value);return}const{data:results,error:re}=await supabase.from("test_results").select("id,test_id,student_id,marks,remarks,created_at,updated_at").eq("student_id",studentId).order("created_at",{ascending:false});if(re)throw re;const testIds=[...new Set((results||[]).map(r=>String(r.test_id)).filter(Boolean))];let tests=[];if(testIds.length){const{data,error:te}=await supabase.from("tests").select("id,title,subject,test_date,total_marks,status").in("id",testIds);if(te)throw te;tests=data||[]}const byTest=new Map(tests.map(t=>[String(t.id),t]));const mapped=(results||[]).map(r=>{const test=byTest.get(String(r.test_id));const marks=Number(r.marks),total=Number(test?.total_marks);return{...r,test,percentage:Number.isFinite(marks)&&Number.isFinite(total)&&total>0?(marks/total)*100:null}}).filter(r=>r.test);studentResultCache.set(studentId,{time:Date.now(),value:mapped});if(live)setRows(mapped)}catch(e){if(live){setError(e instanceof Error?e.message:"Unable to load results.");setRows([])}}finally{if(live)setLoading(false)}})();return()=>{live=false}},[student?.id]);
  const valid=rows.filter(r=>r.percentage!=null),average=valid.length?valid.reduce((sum,r)=>sum+Number(r.percentage),0)/valid.length:null;
  const previous=useMemo(()=>rows.filter(r=>dateKey(r.test?.test_date)<todayKey()).sort((a,b)=>dateKey(b.test?.test_date).localeCompare(dateKey(a.test?.test_date))),[rows]); const upcomingResults=rows.filter(r=>dateKey(r.test?.test_date)>=todayKey());
  const render=(items,empty)=>items.length?items.map(r=><Card key={r.id} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}><div><div style={{fontWeight:900}}>{r.test?.title||"Test"}</div><div style={{fontSize:12,color:C.sub,marginTop:3}}>{r.test?.subject||"—"} · {r.test?.test_date||"—"}</div></div><div style={{fontSize:22,fontWeight:900,color:C.accent}}>{r.percentage==null?"—":`${r.percentage.toFixed(2)}%`}</div></div><div style={{marginTop:10,fontWeight:800}}>Score: {r.marks??"—"} / {r.test?.total_marks??"—"}</div>{r.remarks&&<div style={{fontSize:12,color:C.sub,marginTop:6}}>Remarks: {r.remarks}</div>}</Card>):<Card style={{padding:22,textAlign:"center",color:C.sub}}>{empty}</Card>;
  return <div>{error&&<Card style={{color:C.red,marginBottom:12,background:"#FEF2F2"}}>{error}</Card>}<Card style={{textAlign:"center",padding:22,marginBottom:16,background:"linear-gradient(135deg,#4361EE,#7B6FF5)",border:0,color:"#fff"}}><div style={{fontSize:12,opacity:.8}}>Average Score</div><div style={{fontSize:44,fontWeight:900}}>{average==null?"—":`${average.toFixed(2)}%`}</div><div style={{fontSize:11,opacity:.8}}>{rows.length} published result{rows.length===1?"":"s"}</div></Card><Sec title="My Results 📊"/>{loading?<Card style={{padding:28,textAlign:"center",color:C.sub}}>Loading results…</Card>:<>{upcomingResults.length>0&&<><div style={{fontSize:12,fontWeight:900,color:C.sub,margin:"0 0 7px"}}>Upcoming</div>{render(upcomingResults,"No upcoming results.")}</>}<div style={{fontSize:12,fontWeight:900,color:C.sub,margin:"10px 0 7px"}}>Previous Results</div>{render(previous,"No published results are available for you yet.")}</>}</div>;
}
