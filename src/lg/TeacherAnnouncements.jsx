import React,{useEffect,useState}from"react";
import {C}from"@/lg/data";
import {supabase}from"@/lg/supabase";
import {Card,Sec}from"@/lg/ui";
import { relativeDate } from "@/lg/dateUtils";
const errText=e=>e instanceof Error?e.message:(e?.message||"Something went wrong. Please try again.");
export function TeacherAnnouncements({teacher}){
 const[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let live=true;(async()=>{setLoading(true);setError("");try{const{data,error}=await supabase.from("announcements").select("id,title,desc,date,target,created_at").order("created_at",{ascending:false});if(error)throw error;if(live)setRows(data||[])}catch(e){if(live)setError(errText(e))}finally{if(live)setLoading(false)}})();return()=>{live=false}},[teacher?.id]);
 return <div><Sec title="Announcements & News 📢"/>{error&&<Card style={{color:C.red,marginBottom:10}}>{error}</Card>}{loading?<Card style={{padding:24,textAlign:"center",color:C.sub}}>Loading announcements…</Card>:rows.length===0?<Card style={{padding:24,textAlign:"center",color:C.sub}}>No announcements yet.</Card>:rows.map(a=>{const d=relativeDate(a.date||a.created_at);return <Card key={a.id} style={{marginBottom:10,borderLeft:d.primary==="Today"?"4px solid #EF4444":"1px solid #EEF2FF"}}><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}><div style={{fontWeight:900,minWidth:0}}>{a.title}</div><span style={{flexShrink:0,padding:"4px 9px",borderRadius:999,background:d.primary==="Today"?"#FEE2E2":"#EEF2FF",color:d.primary==="Today"?"#B91C1C":C.accent,fontSize:10,fontWeight:900}}>{d.primary}</span></div><div style={{fontSize:11,color:C.sub,marginTop:5}}>{d.secondary||"Announcement date"}</div>{a.desc&&<div style={{fontSize:12,color:C.sub,marginTop:6,whiteSpace:"pre-wrap"}}>{a.desc}</div>}</Card>})}</div>;
}
