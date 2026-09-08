import React,{useEffect,useState}from"react";
import {C}from"@/lg/data";
import {supabase}from"@/lg/supabase";
import {Card,Sec}from"@/lg/ui";

const today=()=>new Date().toISOString().slice(0,10);
const errText=e=>e instanceof Error?e.message:(e?.message||"Something went wrong. Please try again.");
async function loadTeacherScope(teacherId){
  const {data:entries,error}=await supabase.from("timetable_entries").select("batch_id,subject_name").eq("teacher_id",teacherId).eq("status","active");
  if(error)throw error;
  const ids=[...new Set((entries||[]).map(x=>x?.batch_id).filter(Boolean))];
  const subjects={};
  for(const e of entries||[]){const k=String(e.batch_id);(subjects[k]||(subjects[k]=new Set())).add(String(e.subject_name||""));}
  return {ids,subjects};
}
export function TeacherAnalytics({teacher}){
  const [stats,setStats]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{let live=true;(async()=>{if(!teacher?.id)return;setLoading(true);setError("");try{
    const {ids,subjects}=await loadTeacherScope(teacher.id);
    if(!ids.length){if(live)setStats({students:0,attendance:0,present:0,homework:0,tests:0,materials:0});return;}
    const [{data:members,error:me},{data:att,error:ae},{data:hw,error:he},{data:tests,error:te},{data:materials,error:mte}]=await Promise.all([
      supabase.from("batch_students").select("student_id").in("batch_id",ids).eq("status","active").is("left_at",null),
      supabase.from("attendance").select("sid,status,date").eq("date",today()),
      supabase.from("homework").select("id,batch_id,subject,due").in("batch_id",ids).eq("tid",teacher.id),
      supabase.from("tests").select("id,batch_id,subject,test_date,status").in("batch_id",ids),
      supabase.from("materials").select("id,batch_id,subject").in("batch_id",ids).eq("tid",teacher.id),
    ]);
    if(me)throw me;if(ae)throw ae;if(he)throw he;if(te)throw te;if(mte)throw mte;
    const studentIds=new Set((members||[]).map(x=>String(x.student_id)));
    const scopedAttendance=(att||[]).filter(x=>studentIds.has(String(x.sid)));
    const scopedHw=(hw||[]).filter(x=>{const set=subjects[String(x.batch_id)];return !set||set.has(String(x.subject||""))}).filter(x=>!x.due||String(x.due)>=today());
    const scopedTests=(tests||[]).filter(x=>{const set=subjects[String(x.batch_id)];return !set||set.has(String(x.subject||""))});
    const scopedMaterials=(materials||[]).filter(x=>{const set=subjects[String(x.batch_id)];return !set||set.has(String(x.subject||""))});
    const present=scopedAttendance.filter(x=>String(x.status)==="present").length;
    if(live)setStats({students:studentIds.size,attendance:scopedAttendance.length,present,homework:scopedHw.length,tests:scopedTests.length,materials:scopedMaterials.length});
  }catch(e){if(live){setError(errText(e));setStats(null)}}finally{if(live)setLoading(false)}})();return()=>{live=false}},[teacher?.id]);
  const cards=stats?[ [stats.students,"My Students","🎓"],[stats.attendance?`${stats.present}/${stats.attendance}`:"0","Today Attendance","✅"],[stats.homework,"Active Homework","📝"],[stats.tests,"Tests","📋"],[stats.materials,"Materials","📚"] ]:[];
  return <div><Sec title="Teacher Analytics 📊"/>{error&&<Card style={{color:C.red,marginBottom:10}}>{error}</Card>}{loading?<Card style={{padding:24,textAlign:"center",color:C.sub}}>Loading analytics…</Card>:stats&&!stats.students&&!stats.tests&&!stats.homework&&!stats.materials?<Card style={{padding:24,textAlign:"center",color:C.sub}}>No analytics data is available for your assigned classes yet.</Card>:<div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:10}}>{cards.map(([v,l,i])=><Card key={l} style={{padding:14,textAlign:"center"}}><div style={{fontSize:20}}>{i}</div><div style={{fontSize:24,fontWeight:900,color:C.accent}}>{v}</div><div style={{fontSize:11,color:C.sub}}>{l}</div></Card>)}</div>}</div>;
}
