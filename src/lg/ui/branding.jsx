export const LOGO_IMG_SRC=`${import.meta.env.BASE_URL || "/"}mahin-original-logo.png`;

export function LGLogo({ size=80, showText=true, light=false }){
  const tc = light ? "#fff" : "#2d1b8e";
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:showText?12:0}}>
      <div style={{
        width:size, height:size, borderRadius:size*0.22,
        background:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:"0 8px 32px rgba(0,0,0,0.22)", overflow:"hidden", padding:size*0.05,
      }}>
        <img src={LOGO_IMG_SRC} alt="Mahin"
          style={{width:"100%",height:"100%",objectFit:"contain"}}/>
      </div>
      {showText&&(
        <div style={{fontSize:size*0.19,fontWeight:900,letterSpacing:1.5,
          color:tc,fontFamily:"'Poppins',sans-serif",textTransform:"uppercase",
          textAlign:"center",lineHeight:1.1}}>
          MAHIN
        </div>
      )}
    </div>
  );
}

export function LGIcon({ size=36 }){
  return (
    <div style={{
      width:size, height:size, borderRadius:size*0.22,
      background:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
      overflow:"hidden", padding:size*0.05, boxShadow:"0 4px 14px rgba(0,0,0,0.15)"
    }}>
      <img src={LOGO_IMG_SRC} alt="LG" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
    </div>
  );
}