import React,{useState,useCallback}from"react";

export function useRipple() {
  const [rp,setRp]=useState([]);
  const add=useCallback(e=>{
    const r=e.currentTarget.getBoundingClientRect();
    const x=(e.clientX||r.left+r.width/2)-r.left;
    const y=(e.clientY||r.top+r.height/2)-r.top;
    const sz=Math.max(r.width,r.height)*2.4;
    const id=Date.now()+Math.random();
    setRp(p=>[...p,{id,x,y,sz}]);
    setTimeout(()=>setRp(p=>p.filter(v=>v.id!==id)),580);
  },[]);
  const el=rp.map(r=>(
    <span key={r.id} className="ripple-el"
      style={{width:r.sz,height:r.sz,left:r.x-r.sz/2,top:r.y-r.sz/2}}/>
  ));
  return [add,el];
}

/* ═══════════════════════════════════════════════════════
   SHARED BUBBLES BG
═══════════════════════════════════════════════════════ */

export const Bubbles = () => (
  <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
    <div style={{position:"absolute",top:-90,right:-60,width:280,height:280,borderRadius:"50%",background:"rgba(255,255,255,0.05)"}}/>
    <div style={{position:"absolute",bottom:-110,left:-70,width:320,height:320,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}}/>
    <div style={{position:"absolute",top:"35%",right:28,width:16,height:16,borderRadius:"50%",background:"rgba(255,255,255,0.1)"}}/>
    <div style={{position:"absolute",top:"18%",left:20,width:9,height:9,borderRadius:"50%",background:"rgba(255,255,255,0.08)"}}/>
  </div>
);

/* ═══════════════════════════════════════════════════════
   SHARED ATOMS
═══════════════════════════════════════════════════════ */