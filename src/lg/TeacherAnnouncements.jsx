import React,{useEffect,useState}from"react";
import {C}from"@/lg/data";
import {supabase}from"@/lg/supabase";
import {Card,Sec}from"@/lg/ui";
const errText=e=>e instanceof Error?e.message:(e?.message||"Something went wrong. Please try again.");
export function TeacherAnnouncements({teacher}){
 const[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let live=true;(async()=>{setLoading(true);setError("");try{const{data,error}=await supabase.from("announcements").select("id,title,desc,date,target,created_at").order("created_at",{ascending:false});if(error)throw error;if(live)setRows(data||[])}catch(e){if(live)setError(errText(e))}finally{if(live)setLoading(false)}})();return()=>{live=false}},[teacher?.id]);
 return <div><Sec title="Announcements & News 📢"/>{error&&<Card style={{color:C.red,marginBottom:10}}>{error}</Card>}{loading?<Card style={{padding:24,textAlign:"center",color:C.sub}}>Loading announcements…</Card>:rows.length===0?<Card style={{padding:24,textAlign:"center",color:C.sub}}>No announcements yet.</Card>:rows.map(a=><Card key={a.id} style={{marginBottom:10}}><div style={{fontWeight:900}}>{a.title}</div>{a.desc&&<div style={{fontSize:12,color:C.sub,marginTop:6,whiteSpace:"pre-wrap"}}>{a.desc}</div>}<div style={{fontSize:10,color:C.sub,marginTop:8}}>{a.date||String(a.created_at||"").slice(0,10)}</div></Card>)}</div>;
}
