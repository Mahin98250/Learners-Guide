import React from"react";
import {C}from"@/lg/data";
import {useRipple}from"./interaction";

export function Inp({label,type="text",val,set,ph,icon,right}){
  return(
    <div style={{marginBottom:14}}>
      {label&&<div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.7)",marginBottom:7}}>{label}</div>}
      <div style={{position:"relative"}}>
        {icon&&<span style={{position:"absolute",left:15,top:"50%",transform:"translateY(-50%)",fontSize:17,zIndex:1}}>{icon}</span>}
        <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
          style={{width:"100%",padding:icon?"14px 46px 14px 46px":right?"14px 46px 14px 16px":"14px 16px",
            borderRadius:14,border:"1.5px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.1)",
            color:"#fff",fontSize:15,outline:"none",fontFamily:"'Poppins',sans-serif",backdropFilter:"blur(8px)",
            transition:"border .2s,background .2s"}}
          onFocus={e=>{e.target.style.borderColor="rgba(255,255,255,0.6)";e.target.style.background="rgba(255,255,255,0.16)";}}
          onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.15)";e.target.style.background="rgba(255,255,255,0.1)";}}/>
        {right&&<span className="btn-icon" style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{right}</span>}
      </div>
    </div>
  );
}

export function WBtn({ch,onClick,dis}){
  const [add,el]=useRipple();
  return(
    <button onClick={e=>{if(!dis){add(e);onClick&&onClick();}}} disabled={dis}
      className="btn-white"
      style={{width:"100%",padding:"15px",borderRadius:16,border:"none",
        background:dis?"rgba(255,255,255,0.18)":"#fff",
        color:dis?"rgba(255,255,255,0.4)":"#2d1b8e",
        fontWeight:800,fontSize:16,fontFamily:"'Poppins',sans-serif",
        boxShadow:dis?"none":"0 6px 24px rgba(0,0,0,.22)",
        position:"relative",overflow:"hidden"}}>
      {el}<span style={{position:"relative",zIndex:1}}>{ch}</span>
    </button>
  );
}

export function GBtn({ch,onClick,color,style:sx={}}){
  const [add,el]=useRipple();
  return(
    <button onClick={e=>{add(e);onClick&&onClick();}}
      className="btn-grad"
      style={{width:"100%",padding:"14px",borderRadius:15,border:"none",
        background:color||`linear-gradient(135deg,#5B4FE8,#7B6FF5)`,
        color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",
        fontFamily:"'Poppins',sans-serif",
        boxShadow:"0 6px 20px rgba(91,79,232,.28)",
        position:"relative",overflow:"hidden",...sx}}>
      {el}<span style={{position:"relative",zIndex:1}}>{ch}</span>
    </button>
  );
}

export function SBtn({ch,onClick,color,style:sx={}}){
  const [add,el]=useRipple();
  return(
    <button onClick={e=>{add(e);onClick&&onClick();}}
      className="pressable"
      style={{padding:"9px 18px",borderRadius:13,border:"none",
        background:color||`linear-gradient(135deg,#5B4FE8,#7B6FF5)`,
        color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",
        fontFamily:"'Poppins',sans-serif",
        position:"relative",overflow:"hidden",...sx}}>
      {el}<span style={{position:"relative",zIndex:1}}>{ch}</span>
    </button>
  );
}

export function Card({children,style:sx={},onClick}){
  return(
    <div onClick={onClick} className={onClick?"card-lift":""}
      style={{background:"#fff",borderRadius:20,padding:18,
        boxShadow:"0 3px 16px rgba(27,16,96,.07)",border:"1px solid #EEF2FF",
        cursor:onClick?"pointer":"default",...sx}}>
      {children}
    </div>
  );
}

export function Badge({label}){
  const m={present:"#22C55E",absent:"#EF4444",leave:"#F59E0B",
           paid:"#22C55E",pending:"#F59E0B",overdue:"#EF4444",active:"#22C55E"};
  const c=m[label]||"#64748B";
  return <span style={{display:"inline-block",padding:"3px 11px",borderRadius:20,
    background:c+"18",color:c,fontSize:11,fontWeight:700}}>{label?.toUpperCase()}</span>;
}

export function Sec({title,action,onAction}){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <div style={{fontSize:15,fontWeight:800,color:C.text}}>{title}</div>
      {action&&<span className="pressable" onClick={onAction}
        style={{fontSize:13,color:C.accent,fontWeight:700,padding:"3px 8px",borderRadius:8}}>{action}</span>}
    </div>
  );
}

export const EyeBtn=({open,onClick})=>(
  <span onClick={onClick} className="btn-icon" style={{display:"flex",padding:2}}>
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {open?<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx={12} cy={12} r={3}/></>
           :<><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1={1} y1={1} x2={23} y2={23}/></>}
    </svg>
  </span>
);

export const BackBtn=({onClick})=>{
  const [add,el]=useRipple();
  return(
    <button onClick={e=>{add(e);onClick();}} className="btn-icon"
      style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:12,
        width:42,height:42,display:"flex",alignItems:"center",justifyContent:"center",
        color:"#fff",position:"relative",overflow:"hidden"}}>
      {el}
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
      </svg>
    </button>
  );
};

/* ── BOTTOM NAV ── */