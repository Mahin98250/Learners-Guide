import React,{useState}from"react";
import {LeaveRequests}from"@/lg/LeaveRequests";

export function LeaveAccess({user,student,canReview=false}){
 const[open,setOpen]=useState(false);
 if(!user)return null;
 return <>
  <button type="button" onClick={()=>setOpen(true)} aria-label={canReview?"Open leave requests":"Open leave"} style={{position:"fixed",right:16,bottom:"calc(76px + env(safe-area-inset-bottom, 0px))",zIndex:1200,border:"1px solid rgba(255,255,255,.28)",borderRadius:999,padding:"11px 15px",background:"rgba(24,32,68,.94)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",color:"#fff",fontWeight:900,boxShadow:"0 10px 28px rgba(15,23,42,.22)",cursor:"pointer"}}>{canReview?"🏖️ Leave Requests":"🏖️ Leave"}</button>
  {open&&<div role="dialog" aria-modal="true" onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:1300,background:"rgba(15,23,42,.52)",backdropFilter:"blur(5px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
   <div onClick={e=>e.stopPropagation()} style={{width:"min(720px,100%)",maxHeight:"90vh",overflowY:"auto",background:"#f8fafc",borderRadius:22,padding:18,boxShadow:"0 24px 70px rgba(15,23,42,.28)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:12}}><div><div style={{fontSize:11,fontWeight:800,color:"#635bdf",letterSpacing:1,textTransform:"uppercase"}}>Attendance & Leave</div><h2 style={{margin:"3px 0 0",fontSize:22,color:"#182044"}}>{canReview?"Leave Requests":"Leave"}</h2></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close leave" style={{border:0,borderRadius:10,padding:"8px 11px",background:"#e9edf5",cursor:"pointer",fontSize:16}}>✕</button></div>
    <LeaveRequests user={user} student={student} canReview={canReview}/>
   </div>
  </div>}
 </>;
}
