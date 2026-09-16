import React,{useState}from"react";
import {C,ROLES,lsG}from"@/lg/data";
import {LGIcon}from"./branding";
import {Bubbles,useRipple}from"./interaction";

export function BottomNav({tabs,active,set}){
  return(
    <div style={{position:"sticky",bottom:0,background:"#fff",
      borderTop:"1px solid #EEF2FF",display:"flex",zIndex:50,
      boxShadow:"0 -4px 20px rgba(27,16,96,.07)"}}>
      {tabs.map(t=>(
        <button key={t.key} onClick={()=>set(t.key)}
          className={`nav-tab${active===t.key?" act-tab":""}`}
          style={{flex:1,padding:"9px 4px 6px",border:"none",
            background:"transparent",display:"flex",flexDirection:"column",
            alignItems:"center",gap:2}}>
          <span style={{fontSize:20,display:"block",
            transition:"transform .2s",
            transform:active===t.key?"scale(1.2)":"scale(1)"}}>{t.icon}</span>
          <span style={{fontSize:10,fontWeight:active===t.key?800:500,
            color:active===t.key?C.accent:C.sub,
            transition:"color .2s"}}>{t.label}</span>
          <div style={{width:active===t.key?18:0,height:3,borderRadius:2,
            background:C.accent,
            transition:"width .25s cubic-bezier(.34,1.56,.64,1)"}}/>
        </button>
      ))}
    </div>
  );
}
/* ── APP BAR with real logo + notifications, AI, messaging ── */

export function AppBar({name,role,userId,onLogout,onNotif,onMsg}){
  const [add,el]=useRipple();
  const unread=lsG("notifications").filter(n=>n.uid===userId&&!n.read).length;
  const rc=ROLES.find(r=>r.key===role);
  const roleEmoji={teacher:"👨‍🏫",student:"🎓",parent:"👨‍👩‍👧"};
  return(
    <div style={{background:C.bg,padding:"44px 18px 18px",position:"relative",overflow:"hidden"}}>
      <Bubbles/>
      <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div className="fu" style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:46,height:46,borderRadius:14,background:"rgba(255,255,255,.15)",
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 6px 18px rgba(0,0,0,.2)",backdropFilter:"blur(10px)"}}>
            <LGIcon size={30}/>
          </div>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.5)",fontWeight:600,letterSpacing:1}}>LEARNER'S GUIDE</div>
            <div style={{fontSize:15,fontWeight:800,color:"#fff"}}>{name} 👋</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {/* Messaging */}
          <button onClick={onMsg} title="Messages" className="btn-icon"
            style={{width:36,height:36,borderRadius:11,background:"rgba(255,255,255,.12)",
              border:"none",color:"#fff",fontSize:17,display:"flex",alignItems:"center",
              justifyContent:"center",cursor:"pointer"}}>
            💬
          </button>
          {/* Notifications */}
          <div style={{position:"relative"}}>
            <button onClick={onNotif} title="Notifications" className="btn-icon"
              style={{width:36,height:36,borderRadius:11,background:"rgba(255,255,255,.12)",
                border:"none",color:"#fff",fontSize:17,display:"flex",alignItems:"center",
                justifyContent:"center",cursor:"pointer"}}>
              🔔
            </button>
            {unread>0&&<div style={{position:"absolute",top:-4,right:-4,width:18,height:18,
              borderRadius:"50%",background:C.red,color:"#fff",fontSize:10,fontWeight:800,
              display:"flex",alignItems:"center",justifyContent:"center",
              border:"2px solid #1a1060",animation:"checkPop .4s cubic-bezier(.34,1.56,.64,1) both"}}>
              {unread>9?"9+":unread}
            </div>}
          </div>
          {/* Logout */}
          <button onClick={e=>{add(e);onLogout();}} className="logout-btn"
            style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:11,
              padding:"7px 12px",color:"rgba(255,255,255,.75)",fontSize:11,fontWeight:600,
              position:"relative",overflow:"hidden",cursor:"pointer"}}>
            {el}Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export function Shell({children,header,tabs,activeTab,setTab}){
  return(
    <div style={{maxWidth:430,margin:"0 auto",minHeight:"100vh",
      background:C.light,display:"flex",flexDirection:"column",
      fontFamily:"'Poppins',sans-serif"}}>
      {header}
      <div style={{flex:1,overflowY:"auto",padding:"14px 14px 8px"}}>{children}</div>
      {tabs&&<BottomNav tabs={tabs} active={activeTab} set={setTab}/>}
    </div>
  );
}