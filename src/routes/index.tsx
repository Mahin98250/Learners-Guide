import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lg/auth";
import { RoleSelect, type Role } from "@/lg/authscreens";
import { resolveInstituteForCurrentHostname, type InstituteTenant } from "@/lg/tenant";

const title="Mahin — Education Platform for Institutes";
const description="Mahin provides a multi-institute education platform for students, teachers, parents and administrators.";

export const Route=createFileRoute("/")({
  head:()=>({meta:[
    {title},
    {name:"description",content:description},
    {property:"og:title",content:title},
    {property:"og:description",content:description}
  ]}),
  component:Index
});

function Index(){
  const navigate=useNavigate();
  const[checkingSession,setCheckingSession]=useState(true);
  const[tenant,setTenant]=useState<InstituteTenant|null>(null);

  useEffect(()=>{
    let mounted=true;
    const restoreSession=async()=>{
      const tenantPromise=resolveInstituteForCurrentHostname()
        .then((resolved)=>{ if(mounted) setTenant(resolved); })
        .catch((error)=>console.warn("Unable to resolve institute domain:",error));

      try{
        const current=await getCurrentUser();
        if(!mounted)return;
        if(current?.role==="admin"){navigate({to:"/admin",replace:true});return}
        if(current?.role==="student"||current?.role==="teacher"||current?.role==="parent"){navigate({to:"/app",replace:true});return}
      }catch(error){
        console.warn("Unable to restore saved login session:",error);
      }finally{
        await tenantPromise;
        if(mounted)setCheckingSession(false);
      }
    };
    void restoreSession();
    return()=>{mounted=false};
  },[navigate]);

  if(checkingSession){
    return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",fontFamily:"Poppins,sans-serif",color:"#1a1060",padding:24}}>Restoring your saved login…</div>;
  }

  return <RoleSelect
    tenant={tenant}
    onNext={(role:Role)=>navigate({to:"/auth",search:{role}})}
  />;
}
