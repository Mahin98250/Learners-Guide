import React,{useCallback,useEffect,useMemo,useState}from"react";
import {supabase}from"@/lg/supabase";
import {C}from"@/lg/data";
import { relativeDate } from "@/lg/dateUtils";
import {clearNotificationFeedCache,getCachedNotificationFeed,getInflightNotificationFeed,setCachedNotificationFeed,setInflightNotificationFeed}from"@/lg/notificationFeedCache";

export function ParentNotifications({onClose}){
  const[notifs,setNotifs]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[filter,setFilter]=useState("all");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const{data:{user},error:authError}=await supabase.auth.getUser();
      if(authError||!user)throw new Error("Your session has expired. Please log in again.");
      const cached=getCachedNotificationFeed(user.id);
      if(cached){setNotifs(cached);return}
      const running=getInflightNotificationFeed(user.id);
      if(running){setNotifs(await running);return}
      const request=(async()=>{const{data,error:queryError}=await supabase.from("notifications").select("id,title,desc,time,read,created_at").eq("uid",user.id).order("created_at",{ascending:false});if(queryError)throw queryError;return setCachedNotificationFeed(user.id,Array.isArray(data)?data:[])})();
      setInflightNotificationFeed(user.id,request);
      try{setNotifs(await request)}finally{clearNotificationFeedCache(user.id);setCachedNotificationFeed(user.id,await request)}
    }catch(e){setError(e instanceof Error?e.message:"Unable to load notifications.");setNotifs([])}finally{setLoading(false)}
  },[]);
  useEffect(()=>{void load()},[load]);
  const unread=useMemo(()=>notifs.filter(n=>!n.read).length,[notifs]); const visible=useMemo(()=>notifs.filter(n=>{const d=relativeDate(n.created_at||n.time);return filter==="all"|| (filter==="unread"&&!n.read) || (filter==="today"&&d.primary==="Today")}),[notifs,filter]);
  const markOne=async(id)=>{try{const{error}=await supabase.from("notifications").update({read:true}).eq("id",id);if(error)throw error;setNotifs(rows=>rows.map(n=>n.id===id?{...n,read:true}:n));clearNotificationFeedCache();}catch(e){setError(e instanceof Error?e.message:"Unable to mark notification as read.")}};
  const markAll=async()=>{try{const{data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)throw new Error("Session expired.");const{error}=await supabase.from("notifications").update({read:true}).eq("uid",user.id).eq("read",false);if(error)throw error;setNotifs(rows=>rows.map(n=>({...n,read:true})));clearNotificationFeedCache(user.id);}catch(e){setError(e instanceof Error?e.message:"Unable to mark notifications as read.")}};
  return <div role="dialog" aria-modal="true" aria-label="Notifications" style={{position:"fixed",inset:0,zIndex:5000,display:"flex",justifyContent:"flex-end",pointerEvents:"auto"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{width:330,maxWidth:"100vw",background:"#fff",height:"100vh",overflowY:"auto",boxShadow:"-8px 0 40px rgba(27,16,96,.18)",position:"relative",zIndex:5001}}>
      <div style={{background:"linear-gradient(135deg,#5B4FE8,#7B6FF5)",padding:"52px 20px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:17,fontWeight:800,color:"#fff"}}>🔔 Notifications</div><button type="button" onClick={onClose} aria-label="Close notifications" style={{background:"rgba(255,255,255,.2)",border:0,borderRadius:10,width:32,height:32,color:"#fff",cursor:"pointer"}}>✕</button></div>
        <div style={{display:"flex",gap:6,marginTop:8}}>{[["all","All"],["unread","Unread"],["today","Today"]].map(([k,l])=><button key={k} type="button" onClick={()=>setFilter(k)} style={{border:0,borderRadius:999,padding:"5px 9px",background:filter===k?"rgba(255,255,255,.25)":"rgba(255,255,255,.1)",color:"#fff",fontSize:10,fontWeight:800}}>{l}{k==="unread"?` · ${unread}`:""}</button>)}</div>{unread>0&&<div style={{fontSize:12,color:"rgba(255,255,255,.75)",marginTop:5}}><button type="button" onClick={markAll} style={{border:0,background:"none",padding:0,color:"inherit",textDecoration:"underline",cursor:"pointer",fontSize:12}}>Mark all read</button></div>}
      </div>
      <div style={{padding:"12px 14px"}}>
        {loading&&<div style={{textAlign:"center",padding:40,color:C.sub,fontSize:13}}>Loading notifications…</div>}
        {!loading&&error&&<div style={{padding:14,borderRadius:12,background:"#FEF2F2",color:C.red,fontSize:12,marginBottom:10}}>{error}<button type="button" onClick={()=>void load()} style={{display:"block",marginTop:8,border:0,background:"none",color:C.accent,fontWeight:700,cursor:"pointer",padding:0}}>Try again</button></div>}
        {!loading&&!error&&!visible.length&&<div style={{textAlign:"center",padding:40,color:C.sub,fontSize:13}}>All caught up! 🎉</div>}
        {!loading&&!error&&visible.map(n=><button type="button" key={n.id} onClick={()=>void markOne(n.id)} style={{width:"100%",textAlign:"left",padding:14,borderRadius:14,marginBottom:10,cursor:"pointer",background:n.read?"#fff":"#F0F4FF",border:"1px solid #EEF2FF"}}><div style={{fontSize:13,fontWeight:700,color:C.text}}>{n.title}</div><div style={{fontSize:12,color:C.sub,marginTop:3}}>{n.desc}</div>{(()=>{const d=relativeDate(n.created_at||n.time);return <div style={{fontSize:11,color:C.sub,marginTop:6}}><b style={{color:d.primary==="Today"?C.accent:C.sub}}>{d.primary}</b>{d.secondary?` · ${d.secondary}`:""}</div>})()}</button>)}
      </div>
    </div>
  </div>;
}
