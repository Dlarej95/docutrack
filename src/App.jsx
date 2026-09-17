import { useState, useEffect, useCallback } from "react";
import { loadCollection, saveItem, deleteItem, loadSingleton, saveSingleton, subscribeCollection, uploadIdPhoto } from "./firebase.js";

// ── COLORS ────────────────────────────────────────────────────────────────────
const C = {
  navy:"#0D2B6B", navyL:"#1A3D8F", navyD:"#081B47",
  gold:"#C59B2C",
  blue:"#2563EB", blueBg:"#EFF6FF",
  green:"#16A34A", greenBg:"#F0FDF4", greenBd:"#BBF7D0",
  red:"#DC2626", redBg:"#FEF2F2",
  amber:"#D97706", amberBg:"#FFFBEB", amberBd:"#FDE68A",
  purple:"#7C3AED", purpleBg:"#F5F3FF",
  g50:"#F8F9FC", g100:"#F1F3F7", g200:"#E5E7EB",
  g300:"#D1D5DB", g400:"#9CA3AF", g500:"#6B7280",
  g600:"#4B5563", g700:"#374151", g800:"#1F2937", g900:"#111827",
  white:"#FFFFFF",
};

// ── DOCUMENT TYPES ────────────────────────────────────────────────────────────
const DOC_TYPES = [
  {id:"tor",name:"Transcript of Records",fee:100,days:"3-5 working days",estDays:4},
  {id:"gmc",name:"Good Moral Certificate",fee:50,days:"1-2 working days",estDays:1.5},
  {id:"coe",name:"Certificate of Enrollment",fee:50,days:"Same day",estDays:0.5},
  {id:"dip",name:"Diploma Replacement",fee:500,days:"2-4 weeks",estDays:21},
  {id:"cd",name:"Course Description",fee:50,days:"2-3 working days",estDays:2.5},
  {id:"hd",name:"Honorable Dismissal",fee:100,days:"3-5 working days",estDays:4},
];

// ── STATUS STAGES ─────────────────────────────────────────────────────────────
const STAGES = [
  {id:"received",label:"Received",icon:"ti-inbox",color:C.amber,bg:C.amberBg},
  {id:"verified",label:"Verified",icon:"ti-user-check",color:C.blue,bg:C.blueBg},
  {id:"processing",label:"Processing",icon:"ti-settings",color:C.purple,bg:C.purpleBg},
  {id:"ready",label:"Ready for Pickup",icon:"ti-package",color:C.green,bg:C.greenBg},
  {id:"released",label:"Released",icon:"ti-circle-check",color:C.g600,bg:C.g100},
];
const stageIndex = (id)=>STAGES.findIndex(s=>s.id===id);

// ── DEFAULT SUPER ADMIN ────────────────────────────────────────────────────────
const SUPER_ADMIN = {username:"admin",password:"admin123",name:"Head Registrar",role:"Super Admin"};

// ── UTILS ─────────────────────────────────────────────────────────────────────
const genRef = ()=>{
  const y=new Date().getFullYear();
  const rand=Math.floor(1000+Math.random()*9000);
  return `DT-${y}-${rand}`;
};
const uid = ()=>Math.random().toString(36).slice(2,9);
const timeAgo = (iso)=>{
  const d=Date.now()-new Date(iso).getTime();
  if(d<60000)return"just now";
  if(d<3600000)return Math.floor(d/60000)+"m ago";
  if(d<86400000)return Math.floor(d/3600000)+"h ago";
  return new Date(iso).toLocaleDateString();
};
const isEmail = (contact)=>contact.includes("@");

// ── EMAILJS LOADER (real email sending, no backend needed) ───────────────────
let emailjsLoaded=false;
const loadEmailJS = ()=>new Promise((resolve,reject)=>{
  if(window.emailjs){emailjsLoaded=true;resolve(window.emailjs);return;}
  const script=document.createElement("script");
  script.src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
  script.onload=()=>{emailjsLoaded=true;resolve(window.emailjs);};
  script.onerror=reject;
  document.head.appendChild(script);
});

// ── SMS BACKEND SENDER (calls your deployed backend, see README) ─────────────
const sendRealSMS = async(to,message,backendUrl,secret)=>{
  const res=await fetch(`${backendUrl.replace(/\/$/,"")}/send-sms`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({secret,to,message}),
  });
  const data=await res.json();
  if(!res.ok||!data.ok)throw new Error(data.error||"SMS send failed");
  return data;
};

// ── NOTIFICATION MESSAGE TEMPLATES ────────────────────────────────────────────
const notifMessage = (req,stage)=>{
  const base=`Hi ${req.name}, DocuTrack update for ${req.ref} (${req.docName}):`;
  switch(stage.id){
    case "received": return `${base} We've received your request. We'll notify you as it moves through processing.`;
    case "verified": return `${base} Your student record has been verified. Your request is now in the queue for processing.`;
    case "processing": return `${base} Your document is now being prepared and signed.`;
    case "ready": return `${base} Your document is READY FOR PICKUP at the Registrar's Office, Window 2. Please bring a valid ID.`;
    case "released": return `${base} Your document has been released. Thank you for using DocuTrack!`;
    default: return `${base} Status updated to ${stage.label}.`;
  }
};

// ── LOGO ─────────────────────────────────────────────────────────────────────
function Logo({size=64}){
  return(
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{filter:"drop-shadow(0 4px 14px rgba(0,0,0,.3))"}}>
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#dt-grad-${size})`}/>
      <defs>
        <linearGradient id={`dt-grad-${size}`} x1="2" y1="2" x2="62" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor={C.navyD}/>
          <stop offset="1" stopColor={C.navyL}/>
        </linearGradient>
      </defs>
      {/* Document */}
      <path d="M20 14h16l8 8v28a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V16a2 2 0 0 1 2-2Z" fill="rgba(255,255,255,0.12)" stroke={C.gold} strokeWidth="2"/>
      <path d="M36 14v8h8" stroke={C.gold} strokeWidth="2" strokeLinejoin="round"/>
      {/* Tracking checkmark badge */}
      <circle cx="41" cy="42" r="11" fill={C.gold}/>
      <path d="M36 42l3.2 3.2L47 37.5" stroke={C.navyD} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── LANDING ───────────────────────────────────────────────────────────────────
function LandingView({onGo}){
  return(
    <div style={{height:"100%",overflowY:"auto",background:`linear-gradient(155deg,${C.navyD},${C.navyL})`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem 1.5rem"}}>
      <div style={{marginBottom:16}}>
        <Logo size={68}/>
      </div>
      <h1 style={{fontSize:32,fontWeight:700,color:C.white,margin:"0 0 4px",letterSpacing:"-.5px"}}>DocuTrack</h1>
      <p style={{fontSize:13,color:"rgba(255,255,255,.65)",margin:"0 0 1.75rem"}}>Request and track your documents in real time</p>
      <div style={{display:"flex",flexDirection:"column",gap:8,width:"100%",maxWidth:300}}>
        <button onClick={()=>onGo("request")} style={{padding:14,borderRadius:10,background:C.gold,border:"none",color:C.navy,fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <i className="ti ti-file-plus"/> Request a document
        </button>
        <button onClick={()=>onGo("track")} style={{padding:14,borderRadius:10,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:C.white,fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <i className="ti ti-search"/> Track my request
        </button>
        <button onClick={()=>onGo("adminlogin")} style={{padding:11,borderRadius:10,background:"none",border:"1px solid rgba(255,255,255,.12)",color:"rgba(255,255,255,.6)",fontSize:13,cursor:"pointer",marginTop:6}}>
          Staff login
        </button>
      </div>
    </div>
  );
}

// ── REQUEST FORM ──────────────────────────────────────────────────────────────
function RequestView({onSubmit,notifyConfig,onBack}){
  const [name,setName]=useState("");
  const [studentId,setStudentId]=useState("");
  const [docType,setDocType]=useState(DOC_TYPES[0].id);
  const [copies,setCopies]=useState(1);
  const [purpose,setPurpose]=useState("");
  const [contact,setContact]=useState("");
  const [idPhotoFile,setIdPhotoFile]=useState(null);
  const [idPhotoPreview,setIdPhotoPreview]=useState(null);
  const [done,setDone]=useState(null);

  // Verification step state
  const [step,setStep]=useState("form"); // form | sending | verify | submitting
  const [sentCode,setSentCode]=useState(null);
  const [codeDelivery,setCodeDelivery]=useState(null); // "real" | "simulated" | "failed"
  const [enteredCode,setEnteredCode]=useState("");
  const [verifyErr,setVerifyErr]=useState("");
  const [resendCooldown,setResendCooldown]=useState(0);

  const doc=DOC_TYPES.find(d=>d.id===docType);
  const inp={width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.g300}`,fontSize:13,color:C.g900,outline:"none",fontFamily:"inherit",boxSizing:"border-box"};
  const lbl={fontSize:12,fontWeight:500,color:C.g700,marginBottom:5,display:"block"};
  const formValid=name.trim()&&studentId.trim()&&contact.trim();

  useEffect(()=>{
    if(resendCooldown<=0)return;
    const t=setTimeout(()=>setResendCooldown(c=>c-1),1000);
    return()=>clearTimeout(t);
  },[resendCooldown]);

  const onPhotoChange=(e)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    setIdPhotoFile(file);
    const reader=new FileReader();
    reader.onload=()=>setIdPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const sendCode=async()=>{
    if(!formValid)return;
    setStep("sending");
    const code=String(Math.floor(100000+Math.random()*900000));
    setSentCode(code);
    let delivered="simulated";
    try{
      if(isEmail(contact)&&notifyConfig?.serviceId&&notifyConfig?.templateId&&notifyConfig?.publicKey){
        const emailjs=await loadEmailJS();
        await emailjs.send(notifyConfig.serviceId,notifyConfig.templateId,{
          to_email:contact,ref_number:"Verification",student_name:name,status_label:"Verification code",
          message:`Your DocuTrack verification code is ${code}. Enter it to confirm your document request. This code expires once you leave this page.`,
        },{publicKey:notifyConfig.publicKey});
        delivered="real";
      } else if(!isEmail(contact)&&notifyConfig?.smsBackendUrl&&notifyConfig?.smsSecret){
        await sendRealSMS(contact,`Your DocuTrack verification code is ${code}. Enter it to confirm your document request.`,notifyConfig.smsBackendUrl,notifyConfig.smsSecret);
        delivered="real";
      }
    }catch{
      delivered="failed";
    }
    setCodeDelivery(delivered);
    setEnteredCode("");setVerifyErr("");
    setResendCooldown(30);
    setStep("verify");
  };

  const verifyAndSubmit=async()=>{
    if(enteredCode.trim()!==sentCode){setVerifyErr("That code doesn't match. Check and try again.");return;}
    setStep("submitting");
    const ref=genRef();
    let idPhotoUrl=null;
    if(idPhotoFile){
      try{idPhotoUrl=await uploadIdPhoto(idPhotoFile,ref);}catch{idPhotoUrl=null;}
    }
    const req={
      ref,name:name.trim(),studentId:studentId.trim(),docType,docName:doc.name,fee:doc.fee*copies,
      copies,purpose:purpose.trim()||"Not specified",contact:contact.trim(),idPhotoUrl,
      status:"received",createdAt:new Date().toISOString(),
      history:[{status:"received",at:new Date().toISOString()}],
    };
    onSubmit(req);
    setDone(ref);
  };

  if(done){
    return(
      <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem 1.5rem",background:C.g50}}>
        <div style={{width:64,height:64,borderRadius:"50%",background:C.greenBg,border:`2px solid ${C.greenBd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,color:C.green,marginBottom:16}}><i className="ti ti-circle-check"/></div>
        <div style={{fontSize:17,fontWeight:700,color:C.g900,marginBottom:6}}>Request submitted!</div>
        <div style={{fontSize:13,color:C.g500,marginBottom:18,textAlign:"center"}}>Save this reference number to track your request</div>
        <div style={{background:C.white,border:`2px dashed ${C.navy}`,borderRadius:12,padding:"16px 24px",marginBottom:20}}>
          <div style={{fontSize:11,color:C.g400,textAlign:"center",marginBottom:4}}>REFERENCE NUMBER</div>
          <div style={{fontSize:22,fontWeight:700,color:C.navy,letterSpacing:1,textAlign:"center"}}>{done}</div>
        </div>
        <button onClick={onBack} style={{padding:"11px 24px",borderRadius:9,background:C.navy,border:"none",color:C.white,fontSize:14,fontWeight:600,cursor:"pointer"}}>Done</button>
      </div>
    );
  }

  // ── Verification step screen ──
  if(step==="verify"||step==="submitting"){
    return(
      <div style={{height:"100%",display:"flex",flexDirection:"column",background:C.g50}}>
        <div style={{padding:"10px 14px",background:C.navy,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <button onClick={()=>setStep("form")} style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,.08)",border:"none",color:"rgba(255,255,255,.7)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><i className="ti ti-arrow-left"/></button>
          <div style={{fontSize:14,fontWeight:600,color:C.white}}>Verify It's You</div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:56,height:56,borderRadius:"50%",background:C.blueBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,color:C.blue,marginBottom:14}}>
            <i className={`ti ${isEmail(contact)?"ti-mail":"ti-message"}`}/>
          </div>
          <div style={{fontSize:15,fontWeight:600,color:C.g900,marginBottom:4,textAlign:"center"}}>Enter the code we sent</div>
          <div style={{fontSize:12,color:C.g500,marginBottom:16,textAlign:"center"}}>
            {codeDelivery==="real"?<>A 6-digit code was sent to <b>{contact}</b>.</>:<>We couldn't confirm delivery to <b>{contact}</b> — see the code below for this demo/pilot session.</>}
          </div>

          {codeDelivery!=="real"&&(
            <div style={{background:C.amberBg,border:`1px solid ${C.amberBd}`,borderRadius:9,padding:"10px 14px",marginBottom:16,textAlign:"center"}}>
              <div style={{fontSize:10,color:C.amber,fontWeight:600,marginBottom:3}}>{codeDelivery==="failed"?"DELIVERY FAILED — SHOWING CODE":"SIMULATED — NOT ACTUALLY SENT"}</div>
              <div style={{fontSize:20,fontWeight:700,color:C.g900,letterSpacing:2}}>{sentCode}</div>
            </div>
          )}

          <input value={enteredCode} onChange={e=>{setEnteredCode(e.target.value.replace(/\D/g,"").slice(0,6));setVerifyErr("");}} placeholder="000000" maxLength={6} style={{...inp,textAlign:"center",fontSize:22,letterSpacing:6,fontWeight:700,maxWidth:200,marginBottom:10}}/>
          {verifyErr&&<p style={{fontSize:12,color:C.red,margin:"0 0 10px"}}>{verifyErr}</p>}

          <button onClick={verifyAndSubmit} disabled={enteredCode.length!==6||step==="submitting"} style={{width:"100%",maxWidth:280,padding:13,borderRadius:9,background:enteredCode.length===6?C.navy:C.g300,border:"none",color:C.white,fontSize:14,fontWeight:700,cursor:enteredCode.length===6?"pointer":"not-allowed",marginBottom:10}}>
            {step==="submitting"?"Submitting...":"Verify & Submit Request"}
          </button>
          <button onClick={sendCode} disabled={resendCooldown>0} style={{fontSize:12,color:resendCooldown>0?C.g400:C.blue,background:"none",border:"none",cursor:resendCooldown>0?"default":"pointer"}}>
            {resendCooldown>0?`Resend code in ${resendCooldown}s`:"Resend code"}
          </button>
        </div>
      </div>
    );
  }

  return(
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:C.g50}}>
      <div style={{padding:"10px 14px",background:C.navy,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <button onClick={onBack} style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,.08)",border:"none",color:"rgba(255,255,255,.7)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><i className="ti ti-arrow-left"/></button>
        <div style={{fontSize:14,fontWeight:600,color:C.white}}>Request a Document</div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:16}}>
        <div className="dt-content">
        <div style={{marginBottom:12}}><label style={lbl}>Full Name *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Juan dela Cruz" style={inp}/></div>
        <div style={{marginBottom:12}}><label style={lbl}>Student ID *</label><input value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="2021-BSIT-001" style={inp}/></div>
        <div style={{marginBottom:12}}>
          <label style={lbl}>Document Type *</label>
          <select value={docType} onChange={e=>setDocType(e.target.value)} style={{...inp,cursor:"pointer"}}>
            {DOC_TYPES.map(d=><option key={d.id} value={d.id}>{d.name} — ₱{d.fee}</option>)}
          </select>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div><label style={lbl}>Number of Copies</label><input type="number" min="1" value={copies} onChange={e=>setCopies(Math.max(1,parseInt(e.target.value)||1))} style={inp}/></div>
          <div><label style={lbl}>Total Fee</label><div style={{...inp,background:C.g100,display:"flex",alignItems:"center",fontWeight:600,color:C.navy}}>₱{doc.fee*copies}</div></div>
        </div>
        <div style={{marginBottom:12}}><label style={lbl}>Purpose (optional)</label><input value={purpose} onChange={e=>setPurpose(e.target.value)} placeholder="e.g. Scholarship application" style={inp}/></div>
        <div style={{marginBottom:12}}><label style={lbl}>Contact Number or Email *</label><input value={contact} onChange={e=>setContact(e.target.value)} placeholder="09171234567 or email@example.com" style={inp}/></div>

        <div style={{marginBottom:16}}>
          <label style={lbl}>Valid PH ID Photo (optional but speeds up verification)</label>
          {idPhotoPreview?(
            <div style={{position:"relative",marginBottom:6}}>
              <img src={idPhotoPreview} alt="ID preview" style={{width:"100%",maxHeight:160,objectFit:"cover",borderRadius:8,border:`1px solid ${C.g300}`}}/>
              <button onClick={()=>{setIdPhotoFile(null);setIdPhotoPreview(null);}} style={{position:"absolute",top:6,right:6,width:24,height:24,borderRadius:"50%",background:"rgba(0,0,0,.6)",border:"none",color:C.white,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><i className="ti ti-x" style={{fontSize:12}}/></button>
            </div>
          ):(
            <label style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,padding:"20px 12px",borderRadius:8,border:`1.5px dashed ${C.g300}`,cursor:"pointer",background:C.white}}>
              <i className="ti ti-id" style={{fontSize:22,color:C.g400}}/>
              <span style={{fontSize:12,color:C.g500}}>Tap to upload a photo of your school ID, UMID, PhilID, driver's license, or passport</span>
              <input type="file" accept="image/*" capture="environment" onChange={onPhotoChange} style={{display:"none"}}/>
            </label>
          )}
        </div>

        <div style={{background:C.amberBg,border:`1px solid ${C.amberBd}`,borderRadius:9,padding:"10px 13px",marginBottom:16,fontSize:12,color:C.g700,display:"flex",gap:8}}>
          <i className="ti ti-info-circle" style={{color:C.amber,fontSize:15,flexShrink:0,marginTop:1}}/>
          <span>Estimated processing time: <b>{doc.days}</b>. You'll get a notification when your status changes.</span>
        </div>
        <div style={{background:C.blueBg,border:"1px solid #BFDBFE",borderRadius:9,padding:"10px 13px",marginBottom:16,fontSize:12,color:C.g700,display:"flex",gap:8}}>
          <i className="ti ti-shield-check" style={{color:C.blue,fontSize:15,flexShrink:0,marginTop:1}}/>
          <span>To confirm it's really you, we'll send a 6-digit code to your contact before this request is created.</span>
        </div>
        <button onClick={sendCode} disabled={!formValid||step==="sending"} style={{width:"100%",padding:13,borderRadius:9,background:formValid?C.navy:C.g300,border:"none",color:C.white,fontSize:14,fontWeight:700,cursor:formValid?"pointer":"not-allowed"}}>
          {step==="sending"?"Sending code...":"Send Verification Code"}
        </button>
        </div>
      </div>
    </div>
  );
}

// ── TRACK VIEW ────────────────────────────────────────────────────────────────
function TrackView({requests,notifications,onSubmitSurvey,onBack}){
  const [ref,setRef]=useState("");
  const [found,setFound]=useState(null);
  const [searched,setSearched]=useState(false);

  const search=()=>{
    const r=requests.find(x=>x.ref.toLowerCase()===ref.trim().toLowerCase());
    setFound(r||null);
    setSearched(true);
  };

  return(
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:C.g50}}>
      <div style={{padding:"10px 14px",background:C.navy,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <button onClick={onBack} style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,.08)",border:"none",color:"rgba(255,255,255,.7)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><i className="ti ti-arrow-left"/></button>
        <div style={{fontSize:14,fontWeight:600,color:C.white}}>Track My Request</div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:16}}>
        <div className="dt-content">
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <input value={ref} onChange={e=>setRef(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder="Enter reference number e.g. DT-2026-1234" style={{flex:1,padding:"10px 13px",borderRadius:8,border:`1px solid ${C.g300}`,fontSize:13,color:C.g900,outline:"none",fontFamily:"inherit"}}/>
          <button onClick={search} style={{padding:"0 16px",borderRadius:8,background:C.navy,border:"none",color:C.white,fontSize:13,fontWeight:600,cursor:"pointer"}}>Track</button>
        </div>

        {searched&&!found&&(
          <div style={{background:C.redBg,border:`1px solid #FECACA`,borderRadius:10,padding:"14px",textAlign:"center",color:C.red,fontSize:13}}>
            <i className="ti ti-alert-circle" style={{fontSize:20,display:"block",marginBottom:6}}/>
            No request found with that reference number.
          </div>
        )}

        {found&&(
          <div>
            <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.g200}`,padding:16,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <div style={{fontSize:11,color:C.g400}}>Reference Number</div>
                  <div style={{fontSize:16,fontWeight:700,color:C.navy}}>{found.ref}</div>
                </div>
                <span style={{fontSize:11,padding:"4px 10px",borderRadius:99,background:STAGES.find(s=>s.id===found.status).bg,color:STAGES.find(s=>s.id===found.status).color,fontWeight:600}}>{STAGES.find(s=>s.id===found.status).label}</span>
              </div>
              <div style={{fontSize:13,color:C.g700,marginBottom:2}}><b>{found.docName}</b> × {found.copies}</div>
              <div style={{fontSize:12,color:C.g500}}>{found.name} · {found.studentId}</div>
              <div style={{fontSize:12,color:C.g500,marginTop:2}}>Submitted {timeAgo(found.createdAt)}</div>
            </div>

            {(()=>{
              const lastNotif=notifications.filter(n=>n.ref===found.ref).slice(-1)[0];
              return lastNotif?(
                <div style={{background:C.blueBg,border:`1px solid #BFDBFE`,borderRadius:10,padding:"11px 13px",marginBottom:16,display:"flex",gap:9}}>
                  <i className={`ti ${lastNotif.method==="Email"?"ti-mail":"ti-message"}`} style={{color:C.blue,fontSize:16,flexShrink:0,marginTop:1}}/>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:C.blue}}>{lastNotif.method} sent to {lastNotif.contact}</div>
                    <div style={{fontSize:11,color:C.g600,marginTop:2}}>{lastNotif.message}</div>
                    <div style={{fontSize:10,color:C.g400,marginTop:3}}>{timeAgo(lastNotif.sentAt)}</div>
                  </div>
                </div>
              ):null;
            })()}

            <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.g200}`,padding:16,marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:600,color:C.g700,marginBottom:12}}>Progress</div>
              {STAGES.map((s,i)=>{
                const currentIdx=stageIndex(found.status);
                const done=i<=currentIdx;
                const active=i===currentIdx;
                return(
                  <div key={s.id} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:done?s.bg:C.g100,color:done?s.color:C.g300,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,border:active?`2px solid ${s.color}`:"none",flexShrink:0}}>
                        <i className={`ti ${done?s.icon:"ti-circle"}`}/>
                      </div>
                      {i<STAGES.length-1&&<div style={{width:2,height:28,background:i<currentIdx?s.color:C.g200}}/>}
                    </div>
                    <div style={{paddingTop:4,paddingBottom:i<STAGES.length-1?14:0}}>
                      <div style={{fontSize:13,fontWeight:active?600:500,color:done?C.g800:C.g400}}>{s.label}</div>
                      {found.history?.find(h=>h.status===s.id)&&<div style={{fontSize:11,color:C.g400}}>{timeAgo(found.history.find(h=>h.status===s.id).at)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {found.status==="released"&&<SurveyCard reqRef={found.ref} onSubmit={onSubmitSurvey}/>}
          </div>
        )}

        {!searched&&(
          <div style={{textAlign:"center",padding:"3rem 1rem",color:C.g400}}>
            <div style={{fontSize:36,marginBottom:10}}><i className="ti ti-search"/></div>
            <div style={{fontSize:13}}>Enter your reference number to see live status</div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

// ── SATISFACTION SURVEY (System Usability Scale, 10 items) ───────────────────
const SUS_ITEMS=[
  "I think I would like to use DocuTrack frequently.",
  "I found DocuTrack unnecessarily complex.",
  "I thought DocuTrack was easy to use.",
  "I think I would need help to use DocuTrack.",
  "I found the features of DocuTrack well integrated.",
  "I thought there was too much inconsistency in DocuTrack.",
  "I would imagine most people would learn to use DocuTrack quickly.",
  "I found DocuTrack very cumbersome (awkward) to use.",
  "I felt very confident using DocuTrack.",
  "I needed to learn a lot before I could get going with DocuTrack.",
];
function SurveyCard({reqRef,onSubmit}){
  const doneKey=`docutrack:survey:${reqRef}`;
  const [dismissed,setDismissed]=useState(()=>{try{return !!localStorage.getItem(doneKey);}catch{return false;}});
  const [answers,setAnswers]=useState(Array(10).fill(0));
  const [submitted,setSubmitted]=useState(false);
  const [err,setErr]=useState("");

  if(dismissed||submitted)return submitted?(
    <div style={{background:C.greenBg,border:`1px solid ${C.greenBd}`,borderRadius:12,padding:16,textAlign:"center"}}>
      <i className="ti ti-circle-check" style={{fontSize:22,color:C.green}}/>
      <div style={{fontSize:13,fontWeight:600,color:C.green,marginTop:4}}>Thanks for your feedback!</div>
    </div>
  ):null;

  const submit=()=>{
    if(answers.some(a=>a===0)){setErr("Please answer every question before submitting.");return;}
    // Standard SUS scoring: odd items (1,3,5,7,9) score (value-1); even items score (5-value); sum ×2.5
    let total=0;
    SUS_ITEMS.forEach((_,i)=>{
      total+= (i%2===0) ? (answers[i]-1) : (5-answers[i]);
    });
    const score=total*2.5;
    onSubmit({ref:reqRef,answers,score,submittedAt:new Date().toISOString()});
    try{localStorage.setItem(doneKey,"1");}catch{}
    setSubmitted(true);
  };

  return(
    <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.g200}`,padding:16}}>
      <div style={{fontSize:13,fontWeight:600,color:C.g800,marginBottom:2}}>Quick feedback</div>
      <div style={{fontSize:11,color:C.g500,marginBottom:12}}>Your request is complete — mind rating your experience? Takes about a minute.</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {SUS_ITEMS.map((q,i)=>(
          <div key={i}>
            <div style={{fontSize:12,color:C.g700,marginBottom:6}}>{i+1}. {q}</div>
            <div style={{display:"flex",gap:4,justifyContent:"space-between"}}>
              {[1,2,3,4,5].map(v=>(
                <button key={v} onClick={()=>setAnswers(a=>{const u=[...a];u[i]=v;return u;})} style={{flex:1,padding:"7px 0",borderRadius:6,border:`1px solid ${answers[i]===v?C.navy:C.g300}`,background:answers[i]===v?C.navy:C.white,color:answers[i]===v?C.white:C.g600,fontSize:12,fontWeight:500,cursor:"pointer"}}>{v}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.g400,margin:"6px 0 0"}}><span>Strongly disagree</span><span>Strongly agree</span></div>
      {err&&<p style={{fontSize:12,color:C.red,margin:"10px 0 0"}}>{err}</p>}
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <button onClick={submit} style={{flex:1,padding:11,borderRadius:8,background:C.navy,border:"none",color:C.white,fontSize:13,fontWeight:600,cursor:"pointer"}}>Submit feedback</button>
        <button onClick={()=>{try{localStorage.setItem(doneKey,"1");}catch{}setDismissed(true);}} style={{padding:"0 14px",borderRadius:8,background:C.g100,border:"none",color:C.g500,fontSize:12,cursor:"pointer"}}>Skip</button>
      </div>
    </div>
  );
}

// ── ADMIN LOGIN (checks super admin + staff accounts) ─────────────────────────
function AdminLoginView({staff,owner,onLogin,onBack}){
  const [username,setUsername]=useState("");
  const [pwd,setPwd]=useState("");
  const [err,setErr]=useState("");

  const submit=()=>{
    if(username.trim()===owner.username&&pwd===owner.password){
      onLogin(owner);return;
    }
    const match=staff.find(s=>s.username.toLowerCase()===username.trim().toLowerCase()&&s.password===pwd);
    if(!match){setErr("Incorrect username or password.");return;}
    if(!match.active){setErr("This staff account has been deactivated.");return;}
    onLogin(match);
  };

  return(
    <div style={{height:"100%",background:`linear-gradient(155deg,${C.navyD},${C.navyL})`,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
      <div style={{background:C.white,borderRadius:16,padding:"2rem",width:"100%",maxWidth:320,boxShadow:"0 24px 60px rgba(0,0,0,.3)"}}>
        <div style={{textAlign:"center",marginBottom:"1.5rem"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Logo size={44}/></div>
          <h2 style={{fontSize:18,fontWeight:700,color:C.g900,margin:"0 0 3px"}}>Staff Login</h2>
          <p style={{fontSize:12,color:C.g400,margin:0}}>DocuTrack admin panel</p>
        </div>
        <label style={{fontSize:12,fontWeight:500,color:C.g700,marginBottom:5,display:"block"}}>Username</label>
        <input value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Enter username" style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.g300}`,fontSize:13,color:C.g900,outline:"none",fontFamily:"inherit",boxSizing:"border-box",marginBottom:10}}/>
        <label style={{fontSize:12,fontWeight:500,color:C.g700,marginBottom:5,display:"block"}}>Password</label>
        <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Enter password" style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.g300}`,fontSize:13,color:C.g900,outline:"none",fontFamily:"inherit",boxSizing:"border-box",marginBottom:14}}/>
        {err&&<p style={{fontSize:12,color:C.red,margin:"0 0 10px"}}>{err}</p>}
        <button onClick={submit} style={{width:"100%",padding:12,borderRadius:8,background:C.navy,border:"none",color:C.white,fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:8}}>Login →</button>
        <button onClick={onBack} style={{width:"100%",padding:10,borderRadius:8,background:"none",border:`1px solid ${C.g200}`,color:C.g500,fontSize:13,cursor:"pointer"}}>← Back</button>
      </div>
    </div>
  );
}

// ── DURATION FORMATTER ─────────────────────────────────────────────────────────
function formatDuration(ms){
  const hours=ms/3600000;
  if(hours<1)return `${Math.max(1,Math.round(ms/60000))} min`;
  if(hours<24)return `${hours.toFixed(1)} hr${hours>=2?"s":""}`;
  const days=hours/24;
  return `${days.toFixed(1)} day${days>=2?"s":""}`;
}

// ── CSV EXPORT HELPER ──────────────────────────────────────────────────────────
function downloadCSV(filename,rows){
  const csv=rows.map(row=>row.map(cell=>{
    const s=String(cell??"");
    return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
  }).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── ADMIN DASHBOARD ───────────────────────────────────────────────────────────
// ── FRAUD / ABUSE PATTERN DETECTION ────────────────────────────────────────────
function getRequestFlags(req,allRequests){
  const flags=[];
  const sameStudent=allRequests.filter(r=>r.studentId.toLowerCase()===req.studentId.toLowerCase());
  const last24h=sameStudent.filter(r=>Date.now()-new Date(r.createdAt).getTime()<86400000);
  if(last24h.length>=3)flags.push({label:"Frequent requests",detail:`${last24h.length} requests from this Student ID in the last 24 hours`});
  const sameContact=allRequests.filter(r=>r.contact.toLowerCase()===req.contact.toLowerCase());
  const distinctIds=new Set(sameContact.map(r=>r.studentId.toLowerCase()));
  if(distinctIds.size>1)flags.push({label:"Shared contact",detail:`This contact is used by ${distinctIds.size} different Student IDs`});
  const distinctNames=new Set(sameStudent.map(r=>r.name.toLowerCase().trim()));
  if(distinctNames.size>1)flags.push({label:"Name mismatch",detail:`This Student ID has been used with ${distinctNames.size} different names`});
  return flags;
}

function AdminView({currentUser,requests,staff,notifications,emailConfig,owner,auditLog,surveys,dataErrors,onUpdateStatus,onDeleteRequest,onClearQueue,onSaveStaff,onSaveEmailConfig,onSaveOwner,onLogout}){
  const [tab,setTab]=useState("queue");
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState(null);
  const [toast,setToast]=useState(null);
  const isSuperAdmin=currentUser.role==="Super Admin";
  // "Admin" staff accounts get the same full access as the Super Admin
  // owner — only the owner account itself can't be edited/removed by anyone.
  const canManage=isSuperAdmin||currentUser.role==="Admin";

  const tabs=[
    {id:"queue",l:"Queue",ic:"ti-list"},
    {id:"notifications",l:"Notifications",ic:"ti-bell"},
    {id:"stats",l:"Stats",ic:"ti-chart-bar"},
    ...(canManage?[{id:"staff",l:"Staff",ic:"ti-users"},{id:"settings",l:"Notification setup",ic:"ti-mail-cog"}]:[]),
    ...(isSuperAdmin?[{id:"account",l:"My Account",ic:"ti-user-circle"},{id:"auditlog",l:"Audit Log",ic:"ti-history"}]:[]),
  ];

  const stageFiltered=filter==="all"?requests:requests.filter(r=>r.status===filter);
  const filtered=search.trim()
    ?stageFiltered.filter(r=>r.name.toLowerCase().includes(search.trim().toLowerCase())||r.studentId.toLowerCase().includes(search.trim().toLowerCase())||r.ref.toLowerCase().includes(search.trim().toLowerCase()))
    :stageFiltered;
  const stats=STAGES.map(s=>({...s,count:requests.filter(r=>r.status===s.id).length}));

  const advance=(req)=>{
    const idx=stageIndex(req.status);
    if(idx>=STAGES.length-1)return;
    const nextStage=STAGES[idx+1];
    onUpdateStatus(req,nextStage,currentUser.username);
    if(selected?.ref===req.ref)setSelected({...req,status:nextStage.id,history:[...req.history,{status:nextStage.id,at:new Date().toISOString()}]});
    const method=isEmail(req.contact)?"Email":"SMS";
    setToast(`${method} sent to ${req.contact}`);
    setTimeout(()=>setToast(null),3000);
  };

  return(
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:C.g50,position:"relative"}}>
      {toast&&(
        <div style={{position:"absolute",top:60,left:"50%",transform:"translateX(-50%)",zIndex:20,background:C.g900,color:C.white,padding:"9px 16px",borderRadius:99,fontSize:12,display:"flex",alignItems:"center",gap:7,boxShadow:"0 4px 16px rgba(0,0,0,.25)"}}>
          <i className="ti ti-bell-ringing" style={{color:C.gold}}/>{toast}
        </div>
      )}
      <div style={{padding:"10px 14px",background:C.navy,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <div style={{flexShrink:0}}><Logo size={32}/></div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:600,color:C.white}}>DocuTrack Admin</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>{currentUser.name} · {currentUser.role}</div>
        </div>
        <button onClick={onLogout} style={{padding:"5px 10px",borderRadius:6,background:"rgba(255,255,255,.08)",border:"none",color:"rgba(255,255,255,.65)",fontSize:12,cursor:"pointer"}}>Logout</button>
      </div>
      <div className="dt-tabscroll" style={{display:"flex",background:C.white,borderBottom:`1px solid ${C.g200}`,flexShrink:0,overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
        <div className="dt-content" style={{display:"flex",width:"max-content",minWidth:"100%"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 14px",border:"none",background:"none",cursor:"pointer",fontSize:12,fontWeight:tab===t.id?600:400,color:tab===t.id?C.navy:C.g500,borderBottom:tab===t.id?`2px solid ${C.navy}`:"2px solid transparent",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap",flexShrink:0}}>
            <i className={`ti ${t.ic}`} style={{fontSize:13}}/>{t.l}
          </button>
        ))}
        </div>
      </div>

      <div className="dt-content" style={{width:"100%",flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      {tab==="stats"&&(
        <div style={{padding:14,overflowY:"auto"}}>
          {dataErrors?.surveys&&(
            <div style={{background:C.redBg,border:"1px solid #FECACA",borderRadius:10,padding:"11px 13px",marginBottom:12,fontSize:12,color:C.red,display:"flex",gap:8}}>
              <i className="ti ti-alert-circle" style={{fontSize:15,flexShrink:0,marginTop:1}}/>
              <span>Couldn't load survey data ({dataErrors.surveys}). This usually means Firestore Rules don't allow access to <code>docutrack_surveys</code> yet — add that collection to your Rules in Firebase Console.</span>
            </div>
          )}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <h2 style={{fontSize:15,fontWeight:600,color:C.g800,margin:0}}>Stats</h2>
            {canManage&&(
              <button onClick={()=>{
                const rows=[["Reference","Student Name","Student ID","Document","Copies","Fee","Status","Purpose","Contact","Submitted"]];
                requests.forEach(r=>rows.push([r.ref,r.name,r.studentId,r.docName,r.copies,r.fee,STAGES.find(s=>s.id===r.status)?.label||r.status,r.purpose,r.contact,r.createdAt]));
                downloadCSV(`docutrack-requests-${new Date().toISOString().slice(0,10)}.csv`,rows);
              }} style={{fontSize:12,padding:"7px 13px",borderRadius:8,background:C.navy,border:"none",color:C.white,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                <i className="ti ti-download" style={{fontSize:13}}/>Export CSV
              </button>
            )}
          </div>
          <div className="dt-stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:14}}>
            {stats.map(s=>(
              <div key={s.id} style={{background:C.white,borderRadius:10,padding:12,border:`1px solid ${C.g200}`}}>
                <div style={{fontSize:18,color:s.color,marginBottom:5}}><i className={`ti ${s.icon}`}/></div>
                <div style={{fontSize:22,fontWeight:700,color:C.g900}}>{s.count}</div>
                <div style={{fontSize:11,color:C.g500}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.g200}`,padding:"12px 14px",marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:600,color:C.g700,marginBottom:8}}>Requests by document type</div>
            {DOC_TYPES.map(d=>{
              const n=requests.filter(r=>r.docType===d.id).length;
              return(
                <div key={d.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                  <span style={{fontSize:12,color:C.g600,flex:1}}>{d.name}</span>
                  <div style={{height:5,background:C.navy,borderRadius:3,width:Math.min(n*20,90)}}/>
                  <span style={{fontSize:11,color:C.g400,minWidth:14}}>{n}</span>
                </div>
              );
            })}
          </div>
          <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.g200}`,padding:"12px 14px"}}>
            <div style={{fontSize:12,fontWeight:600,color:C.g700,marginBottom:2}}>Average processing time</div>
            <div style={{fontSize:11,color:C.g400,marginBottom:10}}>Received to released, completed requests only</div>
            {(()=>{
              const completed=requests.filter(r=>r.status==="released"&&r.history?.length>1);
              if(completed.length===0)return <div style={{fontSize:12,color:C.g400,textAlign:"center",padding:"10px 0"}}>No completed requests yet</div>;
              const durationsByType={};
              completed.forEach(r=>{
                const start=new Date(r.history[0].at).getTime();
                const end=new Date(r.history[r.history.length-1].at).getTime();
                if(!durationsByType[r.docType])durationsByType[r.docType]=[];
                durationsByType[r.docType].push(end-start);
              });
              const overallAvg=completed.reduce((sum,r)=>{
                const start=new Date(r.history[0].at).getTime();
                const end=new Date(r.history[r.history.length-1].at).getTime();
                return sum+(end-start);
              },0)/completed.length;
              return(
                <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.g100}`,marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:600,color:C.g800}}>Overall average ({completed.length} completed)</span>
                    <span style={{fontSize:13,fontWeight:600,color:C.navy}}>{formatDuration(overallAvg)}</span>
                  </div>
                  {DOC_TYPES.filter(d=>durationsByType[d.id]).map(d=>{
                    const durs=durationsByType[d.id];
                    const avg=durs.reduce((a,b)=>a+b,0)/durs.length;
                    return(
                      <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0"}}>
                        <span style={{fontSize:12,color:C.g600}}>{d.name} <span style={{color:C.g400}}>({durs.length})</span></span>
                        <span style={{fontSize:12,color:C.g700}}>{formatDuration(avg)}</span>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>

          <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.g200}`,padding:"12px 14px",marginTop:12}}>
            <div style={{fontSize:12,fontWeight:600,color:C.g700,marginBottom:2}}>Student satisfaction (SUS score)</div>
            <div style={{fontSize:11,color:C.g400,marginBottom:10}}>From the feedback survey shown after a request is released</div>
            {!surveys||surveys.length===0?(
              <div style={{fontSize:12,color:C.g400,textAlign:"center",padding:"10px 0"}}>No survey responses yet</div>
            ):(()=>{
              const avgScore=surveys.reduce((s,v)=>s+v.score,0)/surveys.length;
              const label=avgScore>=80.3?"Excellent":avgScore>=68?"Good":avgScore>=51?"OK":"Needs improvement";
              const labelColor=avgScore>=68?C.green:avgScore>=51?C.amber:C.red;
              return(
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <div style={{fontSize:28,fontWeight:700,color:C.navy}}>{avgScore.toFixed(1)}</div>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:labelColor}}>{label}</div>
                    <div style={{fontSize:11,color:C.g400}}>{surveys.length} response{surveys.length===1?"":"s"} · SUS scale out of 100</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {tab==="queue"&&!selected&&(
        <div style={{flex:1,overflowY:"auto",padding:14}}>
          <div style={{position:"relative",marginBottom:10}}>
            <i className="ti ti-search" style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:14,color:C.g400}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by student name, ID, or reference number..." style={{width:"100%",padding:"8px 12px 8px 32px",borderRadius:8,border:`1px solid ${C.g300}`,fontSize:13,color:C.g800,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.g400,cursor:"pointer",fontSize:14,display:"flex"}}><i className="ti ti-x"/></button>}
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <button onClick={()=>setFilter("all")} style={{fontSize:11,padding:"5px 11px",borderRadius:99,border:`1px solid ${filter==="all"?C.navy:C.g300}`,background:filter==="all"?C.navy:C.white,color:filter==="all"?C.white:C.g600,cursor:"pointer"}}>All ({requests.length})</button>
              {STAGES.map(s=>(
                <button key={s.id} onClick={()=>setFilter(s.id)} style={{fontSize:11,padding:"5px 11px",borderRadius:99,border:`1px solid ${filter===s.id?s.color:C.g300}`,background:filter===s.id?s.color:C.white,color:filter===s.id?C.white:C.g600,cursor:"pointer"}}>{s.label} ({requests.filter(r=>r.status===s.id).length})</button>
              ))}
            </div>
            {canManage&&requests.length>0&&(
              <button onClick={()=>{
                if(window.confirm(`Delete ALL ${filtered.length} request(s) currently shown (${filter==="all"?"every request":STAGES.find(s=>s.id===filter)?.label})? This cannot be undone.`)){
                  onClearQueue(filtered.map(r=>r.ref),currentUser.username);
                }
              }} style={{fontSize:11,padding:"6px 12px",borderRadius:8,border:`1px solid ${C.redBg}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:500,display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                <i className="ti ti-trash" style={{fontSize:12}}/>Clear {filter==="all"?"queue":"filtered"}
              </button>
            )}
          </div>
          {filtered.length===0?(
            <div style={{textAlign:"center",padding:"3rem",color:C.g400}}>
              <div style={{fontSize:36,marginBottom:10}}><i className="ti ti-inbox"/></div>
              <div style={{fontSize:13}}>{search?"No requests match your search":"No requests in this category"}</div>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filtered.slice().reverse().map(r=>{
                const stage=STAGES.find(s=>s.id===r.status);
                const flags=getRequestFlags(r,requests);
                return(
                  <div key={r.ref} style={{background:C.white,borderRadius:10,border:`1px solid ${flags.length?C.amberBd:C.g200}`,padding:"12px 14px",display:"flex",gap:8,alignItems:"flex-start"}}>
                    <div onClick={()=>setSelected(r)} style={{flex:1,cursor:"pointer",minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5,gap:8}}>
                        <div style={{fontSize:13,fontWeight:600,color:C.navy}}>{r.ref}</div>
                        <span style={{fontSize:10,padding:"3px 8px",borderRadius:99,background:stage.bg,color:stage.color,fontWeight:600,flexShrink:0}}>{stage.label}</span>
                      </div>
                      <div style={{fontSize:12,color:C.g700}}>{r.name} · {r.studentId}</div>
                      <div style={{fontSize:11,color:C.g400,marginTop:2}}>{r.docName} × {r.copies} · {timeAgo(r.createdAt)}</div>
                      {flags.length>0&&(
                        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>
                          {flags.map(f=>(
                            <span key={f.label} title={f.detail} style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:C.amberBg,color:C.amber,fontWeight:600,display:"inline-flex",alignItems:"center",gap:3}}>
                              <i className="ti ti-alert-triangle" style={{fontSize:10}}/>{f.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {canManage&&(
                      <button onClick={(e)=>{e.stopPropagation();if(window.confirm(`Delete request ${r.ref}? This cannot be undone.`))onDeleteRequest(r.ref,currentUser.username);}} style={{width:28,height:28,borderRadius:6,background:C.redBg,border:"none",color:C.red,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><i className="ti ti-trash"/></button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab==="queue"&&selected&&(()=>{
        const stage=STAGES.find(s=>s.id===selected.status);
        const idx=stageIndex(selected.status);
        const flags=getRequestFlags(selected,requests);
        return(
          <div style={{flex:1,overflowY:"auto",padding:14}}>
            <button onClick={()=>setSelected(null)} style={{padding:"6px 12px",borderRadius:7,background:C.g100,border:"none",color:C.g600,fontSize:12,cursor:"pointer",marginBottom:12,display:"flex",alignItems:"center",gap:4}}><i className="ti ti-arrow-left"/>Back to queue</button>
            {flags.length>0&&(
              <div style={{background:C.amberBg,border:`1px solid ${C.amberBd}`,borderRadius:10,padding:"11px 13px",marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:600,color:C.amber,marginBottom:5,display:"flex",alignItems:"center",gap:5}}><i className="ti ti-alert-triangle"/>Flagged for review</div>
                {flags.map(f=><div key={f.label} style={{fontSize:12,color:C.g700,marginBottom:2}}>• {f.detail}</div>)}
              </div>
            )}
            <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.g200}`,padding:16,marginBottom:12}}>
              <div style={{fontSize:11,color:C.g400}}>Reference Number</div>
              <div style={{fontSize:18,fontWeight:700,color:C.navy,marginBottom:10}}>{selected.ref}</div>
              <div style={{fontSize:13,color:C.g700,marginBottom:3}}><b>{selected.name}</b> ({selected.studentId})</div>
              <div style={{fontSize:12,color:C.g500,marginBottom:3}}>{selected.docName} × {selected.copies} — ₱{selected.fee}</div>
              <div style={{fontSize:12,color:C.g500,marginBottom:3}}>Purpose: {selected.purpose}</div>
              <div style={{fontSize:12,color:C.g500,marginBottom:selected.idPhotoUrl?10:0}}>Contact: {selected.contact}</div>
              {selected.idPhotoUrl&&(
                <div>
                  <div style={{fontSize:11,color:C.g400,marginBottom:5}}>Uploaded ID</div>
                  <a href={selected.idPhotoUrl} target="_blank" rel="noreferrer">
                    <img src={selected.idPhotoUrl} alt="Student ID" style={{width:"100%",maxHeight:220,objectFit:"cover",borderRadius:8,border:`1px solid ${C.g200}`}}/>
                  </a>
                </div>
              )}
            </div>
            <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.g200}`,padding:16,marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:600,color:C.g700,marginBottom:10}}>Current status</div>
              <span style={{fontSize:13,padding:"6px 14px",borderRadius:99,background:stage.bg,color:stage.color,fontWeight:600,display:"inline-flex",alignItems:"center",gap:6}}><i className={`ti ${stage.icon}`}/>{stage.label}</span>
              {idx<STAGES.length-1?(
                <button onClick={()=>advance(selected)} style={{display:"block",width:"100%",marginTop:14,padding:12,borderRadius:9,background:C.navy,border:"none",color:C.white,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  Advance to "{STAGES[idx+1].label}" →
                </button>
              ):(
                <div style={{marginTop:14,fontSize:12,color:C.green,textAlign:"center"}}><i className="ti ti-circle-check"/> Request fully processed</div>
              )}
              <div style={{fontSize:11,color:C.g400,textAlign:"center",marginTop:8}}>{isEmail(selected.contact)?"An email":"An SMS"} will be sent to {selected.contact} on advance</div>
            </div>
            {notifications.filter(n=>n.ref===selected.ref).length>0&&(
              <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.g200}`,padding:16,marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:600,color:C.g700,marginBottom:10}}>Notifications sent</div>
                {notifications.filter(n=>n.ref===selected.ref).map(n=>(
                  <div key={n.id} style={{display:"flex",gap:8,padding:"7px 0",borderTop:`1px solid ${C.g100}`}}>
                    <i className={`ti ${n.method==="Email"?"ti-mail":"ti-message"}`} style={{fontSize:14,color:n.method==="Email"?C.blue:C.green,marginTop:1}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,color:C.g500}}>{n.method} to {n.contact} · {timeAgo(n.sentAt)}</div>
                      <div style={{fontSize:12,color:C.g700}}>{n.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{background:C.white,borderRadius:12,border:`1px solid ${C.g200}`,padding:16}}>
              <div style={{fontSize:12,fontWeight:600,color:C.g700,marginBottom:10}}>History</div>
              {selected.history.map((h,i)=>{
                const s=STAGES.find(x=>x.id===h.status);
                return(
                  <div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"5px 0",borderTop:i>0?`1px solid ${C.g100}`:"none"}}>
                    <i className={`ti ${s.icon}`} style={{fontSize:14,color:s.color}}/>
                    <span style={{fontSize:12,color:C.g700,flex:1}}>{s.label}</span>
                    <span style={{fontSize:11,color:C.g400}}>{timeAgo(h.at)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {tab==="notifications"&&<NotificationsTab notifications={notifications}/>}

      {tab==="staff"&&canManage&&<StaffTab staff={staff} owner={owner} onSave={(list)=>onSaveStaff(list,currentUser.username)}/>}
      {tab==="settings"&&canManage&&<EmailSetupTab config={emailConfig} onSave={onSaveEmailConfig}/>}
      {tab==="account"&&isSuperAdmin&&<AccountTab owner={owner} onSave={(data)=>onSaveOwner(data,currentUser.username)}/>}
      {tab==="auditlog"&&isSuperAdmin&&<AuditLogTab entries={auditLog} error={dataErrors?.auditlog}/>}
      </div>
    </div>
  );
}

// ── MY ACCOUNT TAB (owner only — change own username/password) ───────────────
function AccountTab({owner,onSave}){
  const [username,setUsername]=useState(owner.username);
  const [currentPwd,setCurrentPwd]=useState("");
  const [newPwd,setNewPwd]=useState("");
  const [confirmPwd,setConfirmPwd]=useState("");
  const [err,setErr]=useState("");
  const [saved,setSaved]=useState(false);

  const inp={width:"100%",padding:"9px 11px",borderRadius:7,border:`1px solid ${C.g300}`,fontSize:13,color:C.g800,outline:"none",fontFamily:"inherit",boxSizing:"border-box"};
  const lbl={fontSize:11,fontWeight:500,color:C.g600,marginBottom:4,display:"block"};

  const save=()=>{
    setErr("");
    if(!username.trim()){setErr("Username can't be empty.");return;}
    if(currentPwd!==owner.password){setErr("Current password is incorrect.");return;}
    if(newPwd||confirmPwd){
      if(newPwd.length<4){setErr("New password must be at least 4 characters.");return;}
      if(newPwd!==confirmPwd){setErr("New password and confirmation don't match.");return;}
    }
    onSave({...owner,username:username.trim(),password:newPwd||owner.password});
    setCurrentPwd("");setNewPwd("");setConfirmPwd("");
    setSaved(true);setTimeout(()=>setSaved(false),2500);
  };

  return(
    <div style={{flex:1,overflowY:"auto",padding:14}}>
      <h2 style={{fontSize:15,fontWeight:600,color:C.g800,margin:"0 0 4px"}}>My Account</h2>
      <p style={{fontSize:12,color:C.g500,margin:"0 0 14px"}}>Change your own owner login. This is separate from staff accounts.</p>

      <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.g200}`,padding:14,marginBottom:14}}>
        <div style={{marginBottom:10}}>
          <label style={lbl}>Username</label>
          <input value={username} onChange={e=>setUsername(e.target.value)} style={inp}/>
        </div>
        <div style={{marginBottom:10}}>
          <label style={lbl}>Current Password *</label>
          <input type="password" value={currentPwd} onChange={e=>setCurrentPwd(e.target.value)} placeholder="Required to confirm any change" style={inp}/>
        </div>
        <div style={{marginBottom:10}}>
          <label style={lbl}>New Password (leave blank to keep current)</label>
          <input type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="New password" style={inp}/>
        </div>
        <div style={{marginBottom:12}}>
          <label style={lbl}>Confirm New Password</label>
          <input type="password" value={confirmPwd} onChange={e=>setConfirmPwd(e.target.value)} placeholder="Retype new password" style={inp}/>
        </div>
        {err&&<p style={{fontSize:12,color:C.red,margin:"0 0 10px"}}>{err}</p>}
        <button onClick={save} style={{width:"100%",padding:11,borderRadius:8,background:C.navy,border:"none",color:C.white,fontSize:13,fontWeight:600,cursor:"pointer"}}>{saved?"✓ Saved!":"Save changes"}</button>
      </div>

      <div style={{background:C.amberBg,border:`1px solid ${C.amberBd}`,borderRadius:10,padding:"11px 13px"}}>
        <div style={{fontSize:12,color:C.g700,lineHeight:1.6}}><i className="ti ti-info-circle" style={{color:C.amber}}/> You'll need your current password to make any change here. If you forget your new one, there's no automatic recovery — write it down somewhere safe.</div>
      </div>
    </div>
  );
}

// ── NOTIFICATIONS LOG TAB ──────────────────────────────────────────────────────
function NotificationsTab({notifications}){
  return(
    <div style={{flex:1,overflowY:"auto",padding:14}}>
      <h2 style={{fontSize:15,fontWeight:600,color:C.g800,margin:"0 0 4px"}}>Notification Log</h2>
      <p style={{fontSize:12,color:C.g500,margin:"0 0 12px"}}>Every email or SMS sent automatically when a request's status changes.</p>
      {notifications.length===0?(
        <div style={{textAlign:"center",padding:"3rem",color:C.g400}}>
          <div style={{fontSize:36,marginBottom:10}}><i className="ti ti-bell-off"/></div>
          <div style={{fontSize:13}}>No notifications sent yet</div>
        </div>
      ):(
        <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.g200}`,overflow:"hidden"}}>
          {notifications.slice().reverse().map((n,i,a)=>(
            <div key={n.id} style={{padding:"11px 13px",borderBottom:i<a.length-1?`1px solid ${C.g100}`:"none",display:"flex",gap:10}}>
              <div style={{width:30,height:30,borderRadius:8,background:n.method==="Email"?C.blueBg:C.greenBg,display:"flex",alignItems:"center",justifyContent:"center",color:n.method==="Email"?C.blue:C.green,fontSize:14,flexShrink:0}}>
                <i className={`ti ${n.method==="Email"?"ti-mail":"ti-message"}`}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                  <span style={{fontSize:12,fontWeight:600,color:C.navy}}>{n.ref}</span>
                  <span style={{fontSize:10,color:C.g400,flexShrink:0}}>{timeAgo(n.sentAt)}</span>
                </div>
                <div style={{fontSize:11,color:C.g500,marginBottom:3,display:"flex",alignItems:"center",gap:6}}>
                  {n.method} · {n.contact}
                  {n.delivered==="real"&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:99,background:C.greenBg,color:C.green,fontWeight:600}}>SENT</span>}
                  {n.delivered==="simulated"&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:99,background:C.g100,color:C.g500,fontWeight:600}}>SIMULATED</span>}
                  {n.delivered==="failed"&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:99,background:C.redBg,color:C.red,fontWeight:600}}>FAILED</span>}
                </div>
                <div style={{fontSize:12,color:C.g700,lineHeight:1.5}}>{n.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AUDIT LOG TAB (owner only) ─────────────────────────────────────────────────
function AuditLogTab({entries,error}){
  return(
    <div style={{flex:1,overflowY:"auto",padding:14}}>
      <h2 style={{fontSize:15,fontWeight:600,color:C.g800,margin:"0 0 4px"}}>Audit Log</h2>
      <p style={{fontSize:12,color:C.g500,margin:"0 0 12px"}}>Every status change, deletion, and account change, with who did it and when.</p>
      {error&&(
        <div style={{background:C.redBg,border:"1px solid #FECACA",borderRadius:10,padding:"11px 13px",marginBottom:12,fontSize:12,color:C.red,display:"flex",gap:8}}>
          <i className="ti ti-alert-circle" style={{fontSize:15,flexShrink:0,marginTop:1}}/>
          <span>Couldn't load the audit log ({error}). This usually means Firestore Rules don't allow access to <code>docutrack_auditlog</code> yet — add that collection to your Rules in Firebase Console (see the comment at the bottom of firebase.js for the exact block to add), then refresh.</span>
        </div>
      )}
      {!entries||entries.length===0?(
        <div style={{textAlign:"center",padding:"3rem",color:C.g400}}>
          <div style={{fontSize:36,marginBottom:10}}><i className="ti ti-history"/></div>
          <div style={{fontSize:13}}>No actions logged yet</div>
        </div>
      ):(
        <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.g200}`,overflow:"hidden"}}>
          {entries.slice().reverse().map((e,i,a)=>(
            <div key={e.id} style={{padding:"10px 13px",borderBottom:i<a.length-1?`1px solid ${C.g100}`:"none",display:"flex",gap:9,alignItems:"flex-start"}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:C.g100,display:"flex",alignItems:"center",justifyContent:"center",color:C.g500,fontSize:12,flexShrink:0,marginTop:1}}><i className="ti ti-user"/></div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,color:C.g800}}><b style={{fontWeight:600}}>{e.actor}</b> {e.action}</div>
                <div style={{fontSize:11,color:C.g400,marginTop:1}}>{timeAgo(e.at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── STAFF MANAGEMENT TAB (super admin only) ───────────────────────────────────
function StaffTab({staff,owner,onSave}){
  const [items,setItems]=useState(staff);
  const [open,setOpen]=useState(false);
  const [editId,setEditId]=useState(null);
  const [form,setForm]=useState({name:"",position:"",username:"",password:"",role:"Staff"});
  const [err,setErr]=useState("");
  useEffect(()=>setItems(staff),[staff]);

  const inp={width:"100%",padding:"9px 11px",borderRadius:7,border:`1px solid ${C.g300}`,fontSize:13,color:C.g800,outline:"none",fontFamily:"inherit",boxSizing:"border-box"};

  const openAdd=()=>{setForm({name:"",position:"",username:"",password:"",role:"Staff"});setEditId(null);setErr("");setOpen(true);};
  const openEdit=(s)=>{setForm({name:s.name,position:s.position,username:s.username,password:s.password,role:s.role||"Staff"});setEditId(s.id);setErr("");setOpen(true);};

  const save=()=>{
    if(!form.name.trim()||!form.username.trim()||!form.password.trim()){setErr("Name, username, and password are required.");return;}
    if(form.username.trim().toLowerCase()===owner.username.toLowerCase()){setErr("That username is reserved.");return;}
    const dupe=items.find(s=>s.id!==editId&&s.username.toLowerCase()===form.username.trim().toLowerCase());
    if(dupe){setErr("That username is already taken by another staff member.");return;}
    const u=editId
      ?items.map(s=>s.id===editId?{...s,...form,username:form.username.trim()}:s)
      :[...items,{id:uid(),...form,username:form.username.trim(),active:true,addedAt:new Date().toISOString()}];
    setItems(u);onSave(u);setOpen(false);setEditId(null);
  };

  const toggleActive=(id)=>{
    const u=items.map(s=>s.id===id?{...s,active:!s.active}:s);
    setItems(u);onSave(u);
  };

  const del=(id)=>{
    if(!window.confirm("Remove this staff account permanently?"))return;
    const u=items.filter(s=>s.id!==id);
    setItems(u);onSave(u);
  };

  return(
    <div style={{flex:1,overflowY:"auto",padding:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <h2 style={{fontSize:15,fontWeight:600,color:C.g800,margin:0}}>Staff Accounts ({items.length})</h2>
        <button onClick={openAdd} style={{padding:"6px 12px",borderRadius:7,background:C.navy,border:"none",color:C.white,fontSize:12,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><i className="ti ti-user-plus" style={{fontSize:12}}/>Add staff</button>
      </div>

      {open&&(
        <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.g200}`,padding:14,marginBottom:14,boxShadow:"0 2px 10px rgba(0,0,0,.07)"}}>
          <div style={{fontSize:13,fontWeight:600,color:C.g800,marginBottom:10}}>{editId?"Edit staff account":"Add new staff"}</div>
          <div style={{marginBottom:8}}><label style={{fontSize:11,fontWeight:500,color:C.g600,marginBottom:3,display:"block"}}>Full Name *</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Maria Santos" style={inp}/></div>
          <div style={{marginBottom:8}}><label style={{fontSize:11,fontWeight:500,color:C.g600,marginBottom:3,display:"block"}}>Position</label><input value={form.position} onChange={e=>setForm(p=>({...p,position:e.target.value}))} placeholder="Registrar Staff, Records Officer..." style={inp}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            <div><label style={{fontSize:11,fontWeight:500,color:C.g600,marginBottom:3,display:"block"}}>Username *</label><input value={form.username} onChange={e=>setForm(p=>({...p,username:e.target.value}))} placeholder="msantos" style={inp}/></div>
            <div><label style={{fontSize:11,fontWeight:500,color:C.g600,marginBottom:3,display:"block"}}>Password *</label><input value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} placeholder="Temporary password" style={inp}/></div>
          </div>
          <div style={{marginBottom:10}}>
            <label style={{fontSize:11,fontWeight:500,color:C.g600,marginBottom:3,display:"block"}}>Access Level</label>
            <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} style={{...inp,cursor:"pointer"}}>
              <option value="Staff">Staff — Queue, Notifications, Stats only</option>
              <option value="Admin">Admin — full access, including Staff and Notification setup</option>
            </select>
          </div>
          {err&&<p style={{fontSize:12,color:C.red,margin:"0 0 10px"}}>{err}</p>}
          <div style={{display:"flex",gap:6}}>
            <button onClick={save} style={{padding:"7px 14px",borderRadius:7,background:C.navy,border:"none",color:C.white,fontSize:12,fontWeight:500,cursor:"pointer"}}>{editId?"Save changes":"Add staff"}</button>
            <button onClick={()=>{setOpen(false);setEditId(null);}} style={{padding:"7px 12px",borderRadius:7,background:C.g100,border:"none",color:C.g600,fontSize:12,cursor:"pointer"}}>Cancel</button>
          </div>
        </div>
      )}

      {/* Super admin row (not editable) */}
      <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.g200}`,padding:"12px 14px",marginBottom:10,display:"flex",gap:10,alignItems:"center"}}>
        <div style={{width:34,height:34,borderRadius:"50%",background:C.purpleBg,display:"flex",alignItems:"center",justifyContent:"center",color:C.purple,fontSize:15,flexShrink:0}}><i className="ti ti-crown"/></div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:500,color:C.g800}}>{owner.name}</div>
          <div style={{fontSize:11,color:C.g400}}>@{owner.username} · {owner.role}</div>
        </div>
        <span style={{fontSize:10,padding:"3px 8px",borderRadius:99,background:C.purpleBg,color:C.purple,fontWeight:500}}>Owner</span>
      </div>

      {items.length===0?(
        <div style={{textAlign:"center",padding:"2rem",color:C.g400}}>
          <div style={{fontSize:32,marginBottom:8}}><i className="ti ti-users"/></div>
          <div style={{fontSize:13}}>No staff accounts added yet</div>
        </div>
      ):(
        <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.g200}`,overflow:"hidden"}}>
          {items.map((s,i,a)=>(
            <div key={s.id} style={{padding:"12px 14px",borderBottom:i<a.length-1?`1px solid ${C.g100}`:"none",display:"flex",gap:10,alignItems:"center"}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:s.active?C.greenBg:C.g100,display:"flex",alignItems:"center",justifyContent:"center",color:s.active?C.green:C.g400,fontSize:15,flexShrink:0}}>
                <i className={`ti ${s.active?"ti-user-check":"ti-user-off"}`}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,color:C.g800,display:"flex",alignItems:"center",gap:6}}>
                  {s.name}
                  <span style={{fontSize:9,padding:"2px 7px",borderRadius:99,background:s.role==="Admin"?C.purpleBg:C.g100,color:s.role==="Admin"?C.purple:C.g500,fontWeight:600}}>{s.role||"Staff"}</span>
                </div>
                <div style={{fontSize:11,color:C.g400}}>@{s.username} {s.position?`· ${s.position}`:""}</div>
              </div>
              <button onClick={()=>toggleActive(s.id)} style={{fontSize:10,padding:"3px 8px",borderRadius:99,background:s.active?C.greenBg:C.redBg,color:s.active?C.green:C.red,border:"none",cursor:"pointer",fontWeight:500,flexShrink:0}}>{s.active?"Active":"Inactive"}</button>
              <button onClick={()=>openEdit(s)} style={{width:26,height:26,borderRadius:5,background:C.blueBg,border:"none",color:C.blue,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><i className="ti ti-pencil"/></button>
              <button onClick={()=>del(s.id)} style={{width:26,height:26,borderRadius:5,background:C.redBg,border:"none",color:C.red,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><i className="ti ti-trash"/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── NOTIFICATION SETUP TAB (real EmailJS + SMS backend, super admin only) ────
function EmailSetupTab({config,onSave}){
  const [serviceId,setServiceId]=useState(config?.serviceId||"");
  const [templateId,setTemplateId]=useState(config?.templateId||"");
  const [publicKey,setPublicKey]=useState(config?.publicKey||"");
  const [smsBackendUrl,setSmsBackendUrl]=useState(config?.smsBackendUrl||"");
  const [smsSecret,setSmsSecret]=useState(config?.smsSecret||"");
  const [testEmail,setTestEmail]=useState("");
  const [testStatus,setTestStatus]=useState(null);
  const [testMsg,setTestMsg]=useState("");
  const [testPhone,setTestPhone]=useState("");
  const [smsTestStatus,setSmsTestStatus]=useState(null);
  const [smsTestMsg,setSmsTestMsg]=useState("");
  const [saved,setSaved]=useState(false);

  const inp={width:"100%",padding:"9px 11px",borderRadius:7,border:`1px solid ${C.g300}`,fontSize:13,color:C.g800,outline:"none",fontFamily:"inherit",boxSizing:"border-box"};
  const lbl={fontSize:11,fontWeight:500,color:C.g600,marginBottom:4,display:"block"};

  const save=()=>{
    onSave({serviceId:serviceId.trim(),templateId:templateId.trim(),publicKey:publicKey.trim(),smsBackendUrl:smsBackendUrl.trim(),smsSecret:smsSecret.trim()});
    setSaved(true);setTimeout(()=>setSaved(false),2500);
  };

  const sendTest=async()=>{
    if(!testEmail.trim()){setTestMsg("Enter an email to test with.");setTestStatus("error");return;}
    if(!serviceId.trim()||!templateId.trim()||!publicKey.trim()){setTestMsg("Fill in and save all three email fields first.");setTestStatus("error");return;}
    setTestStatus("sending");setTestMsg("");
    try{
      const emailjs=await loadEmailJS();
      await emailjs.send(serviceId.trim(),templateId.trim(),{
        to_email:testEmail.trim(),
        ref_number:"DT-TEST-0001",
        student_name:"Test Student",
        status_label:"Ready for Pickup",
        message:"This is a test notification from DocuTrack. If you received this, your email setup is working correctly.",
      },{publicKey:publicKey.trim()});
      setTestStatus("ok");setTestMsg(`Test email sent to ${testEmail.trim()}. Check the inbox (and spam folder).`);
    }catch(err){
      setTestStatus("error");setTestMsg(err?.text||"Send failed. Double-check your Service ID, Template ID, and Public Key.");
    }
  };

  const sendSmsTest=async()=>{
    if(!testPhone.trim()){setSmsTestMsg("Enter a phone number to test with.");setSmsTestStatus("error");return;}
    if(!smsBackendUrl.trim()||!smsSecret.trim()){setSmsTestMsg("Fill in and save the SMS backend URL and secret first.");setSmsTestStatus("error");return;}
    setSmsTestStatus("sending");setSmsTestMsg("");
    try{
      await sendRealSMS(testPhone.trim(),"Test SMS from DocuTrack. If you received this, your SMS backend is working correctly.",smsBackendUrl.trim(),smsSecret.trim());
      setSmsTestStatus("ok");setSmsTestMsg(`Test SMS sent to ${testPhone.trim()}.`);
    }catch(err){
      setSmsTestStatus("error");setSmsTestMsg(err.message||"Send failed. Check your backend URL, secret, and that the server is running.");
    }
  };

  return(
    <div style={{flex:1,overflowY:"auto",padding:14}}>
      <h2 style={{fontSize:15,fontWeight:600,color:C.g800,margin:"0 0 4px"}}>Notification Setup</h2>
      <p style={{fontSize:12,color:C.g500,margin:"0 0 14px"}}>Connect real email and SMS delivery so DocuTrack notifies students automatically.</p>

      <div style={{fontSize:12,fontWeight:700,color:C.g500,textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>Email — via EmailJS</div>
      <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.g200}`,padding:14,marginBottom:14}}>
        <div style={{marginBottom:10}}><label style={lbl}>EmailJS Service ID</label><input value={serviceId} onChange={e=>setServiceId(e.target.value)} placeholder="service_xxxxxxx" style={inp}/></div>
        <div style={{marginBottom:10}}><label style={lbl}>EmailJS Template ID</label><input value={templateId} onChange={e=>setTemplateId(e.target.value)} placeholder="template_xxxxxxx" style={inp}/></div>
        <div style={{marginBottom:12}}><label style={lbl}>EmailJS Public Key</label><input value={publicKey} onChange={e=>setPublicKey(e.target.value)} placeholder="Your public key" style={inp}/></div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <input value={testEmail} onChange={e=>setTestEmail(e.target.value)} placeholder="your.email@example.com" style={inp}/>
          <button onClick={sendTest} disabled={testStatus==="sending"} style={{padding:"0 16px",borderRadius:7,background:C.blue,border:"none",color:C.white,fontSize:13,fontWeight:600,cursor:testStatus==="sending"?"not-allowed":"pointer",flexShrink:0,opacity:testStatus==="sending"?.6:1}}>{testStatus==="sending"?"Sending...":"Send test"}</button>
        </div>
        {testMsg&&<div style={{fontSize:12,color:testStatus==="ok"?C.green:C.red,background:testStatus==="ok"?C.greenBg:C.redBg,borderRadius:7,padding:"8px 11px",display:"flex",gap:6,marginBottom:10}}><i className={`ti ${testStatus==="ok"?"ti-check":"ti-alert-circle"}`} style={{marginTop:1,flexShrink:0}}/>{testMsg}</div>}
      </div>

      <div style={{fontSize:12,fontWeight:700,color:C.g500,textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>SMS — via your DocuTrack backend</div>
      <div style={{background:C.white,borderRadius:10,border:`1px solid ${C.g200}`,padding:14,marginBottom:14}}>
        <div style={{marginBottom:10}}><label style={lbl}>Backend URL</label><input value={smsBackendUrl} onChange={e=>setSmsBackendUrl(e.target.value)} placeholder="https://docutrack-sms-backend.onrender.com" style={inp}/></div>
        <div style={{marginBottom:12}}><label style={lbl}>Shared Secret</label><input value={smsSecret} onChange={e=>setSmsSecret(e.target.value)} placeholder="Same secret as your backend's .env" style={inp}/></div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <input value={testPhone} onChange={e=>setTestPhone(e.target.value)} placeholder="09171234567" style={inp}/>
          <button onClick={sendSmsTest} disabled={smsTestStatus==="sending"} style={{padding:"0 16px",borderRadius:7,background:C.green,border:"none",color:C.white,fontSize:13,fontWeight:600,cursor:smsTestStatus==="sending"?"not-allowed":"pointer",flexShrink:0,opacity:smsTestStatus==="sending"?.6:1}}>{smsTestStatus==="sending"?"Sending...":"Send test"}</button>
        </div>
        {smsTestMsg&&<div style={{fontSize:12,color:smsTestStatus==="ok"?C.green:C.red,background:smsTestStatus==="ok"?C.greenBg:C.redBg,borderRadius:7,padding:"8px 11px",display:"flex",gap:6}}><i className={`ti ${smsTestStatus==="ok"?"ti-check":"ti-alert-circle"}`} style={{marginTop:1,flexShrink:0}}/>{smsTestMsg}</div>}
        <div style={{fontSize:11,color:C.g400,marginTop:10,lineHeight:1.6}}>Needs the <code>docutrack-sms-backend</code> project deployed (Render/Railway). See its README for full setup steps.</div>
      </div>

      <button onClick={save} style={{width:"100%",padding:12,borderRadius:8,background:C.navy,border:"none",color:C.white,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:14}}>{saved?"✓ Saved!":"Save all configuration"}</button>

      <div style={{fontSize:11,color:C.g400,lineHeight:1.8}}>
        Email status: {config?.serviceId&&config?.templateId&&config?.publicKey?<span style={{color:C.green,fontWeight:600}}><i className="ti ti-circle-check"/> Configured</span>:<span style={{color:C.amber,fontWeight:600}}><i className="ti ti-alert-triangle"/> Not configured — simulated only</span>}<br/>
        SMS status: {config?.smsBackendUrl&&config?.smsSecret?<span style={{color:C.green,fontWeight:600}}><i className="ti ti-circle-check"/> Configured</span>:<span style={{color:C.amber,fontWeight:600}}><i className="ti ti-alert-triangle"/> Not configured — simulated only</span>}
      </div>
    </div>
  );
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
export default function DocuTrackApp(){
  // Restore the last screen and logged-in user on page load/refresh, so
  // reloading doesn't bounce everyone back to the landing page.
  const [view,setView]=useState(()=>{
    try{return localStorage.getItem("docutrack:view")||"landing";}catch{return "landing";}
  });
  const [requests,setRequests]=useState([]);
  const [staff,setStaff]=useState([]);
  const [notifications,setNotifications]=useState([]);
  const [emailConfig,setEmailConfig]=useState(null);
  const [owner,setOwner]=useState(SUPER_ADMIN);
  const [auditLog,setAuditLog]=useState([]);
  const [surveys,setSurveys]=useState([]);
  const [dataErrors,setDataErrors]=useState({});
  const [currentUser,setCurrentUser]=useState(()=>{
    try{const saved=localStorage.getItem("docutrack:user");return saved?JSON.parse(saved):null;}catch{return null;}
  });

  // Keep localStorage in sync whenever the screen or logged-in user changes.
  useEffect(()=>{
    try{localStorage.setItem("docutrack:view",view);}catch{}
  },[view]);
  useEffect(()=>{
    try{
      if(currentUser)localStorage.setItem("docutrack:user",JSON.stringify(currentUser));
      else localStorage.removeItem("docutrack:user");
    }catch{}
  },[currentUser]);

  // Safety net: if the saved screen needs a logged-in admin but there isn't
  // one (e.g. localStorage was cleared separately), fall back to landing.
  useEffect(()=>{
    if(view==="admin"&&!currentUser)setView("landing");
  },[]); // eslint-disable-line

  // Live subscriptions — every browser tab sees updates instantly, no refresh needed.
  useEffect(()=>{
    const unsubReq=subscribeCollection("requests",setRequests);
    const unsubStaff=subscribeCollection("staff",setStaff);
    const unsubNotif=subscribeCollection("notifications",setNotifications);
    const unsubAudit=subscribeCollection("auditlog",setAuditLog,(err)=>setDataErrors(p=>({...p,auditlog:err.code||"error"})));
    const unsubSurveys=subscribeCollection("surveys",setSurveys,(err)=>setDataErrors(p=>({...p,surveys:err.code||"error"})));
    (async()=>{
      try{const cfg=await loadSingleton("settings");if(cfg)setEmailConfig(cfg.value);}catch{}
      try{const own=await loadSingleton("owner");if(own)setOwner(own.value);}catch{}
    })();
    return ()=>{unsubReq();unsubStaff();unsubNotif();unsubAudit();unsubSurveys();};
  },[]);

  const logAction=useCallback(async(actor,action)=>{
    try{
      await saveItem("auditlog",{id:uid(),actor:actor||"Unknown",action,at:new Date().toISOString()});
    }catch(err){
      console.error("Failed to write audit log entry:",err);
      setDataErrors(p=>({...p,auditlog:err.code||"error"}));
    }
  },[]);

  // Attempts real delivery (EmailJS for email, backend for SMS) if configured; always logs the notification either way
  const dispatchNotification=useCallback(async(req,stage,cfg)=>{
    const method=isEmail(req.contact)?"Email":"SMS";
    const message=notifMessage(req,stage);
    let delivered="simulated";
    if(method==="Email"&&cfg?.serviceId&&cfg?.templateId&&cfg?.publicKey){
      try{
        const emailjs=await loadEmailJS();
        await emailjs.send(cfg.serviceId,cfg.templateId,{
          to_email:req.contact,ref_number:req.ref,student_name:req.name,status_label:stage.label,message,
        },{publicKey:cfg.publicKey});
        delivered="real";
      }catch{
        delivered="failed";
      }
    }
    if(method==="SMS"&&cfg?.smsBackendUrl&&cfg?.smsSecret){
      try{
        await sendRealSMS(req.contact,message,cfg.smsBackendUrl,cfg.smsSecret);
        delivered="real";
      }catch{
        delivered="failed";
      }
    }
    const notif={id:uid(),ref:req.ref,contact:req.contact,method,message,delivered,sentAt:new Date().toISOString()};
    await saveItem("notifications",notif); // triggers the live subscription above
    return notif;
  },[]);

  const addRequest=useCallback(async(req)=>{
    await saveItem("requests",req); // triggers the live subscription above
    dispatchNotification(req,STAGES[0],emailConfig);
  },[dispatchNotification,emailConfig]);

  const updateStatus=useCallback(async(req,nextStage,actor)=>{
    const updated={...req,status:nextStage.id,history:[...req.history,{status:nextStage.id,at:new Date().toISOString()}]};
    await saveItem("requests",updated);
    dispatchNotification(req,nextStage,emailConfig);
    logAction(actor,`advanced ${req.ref} to "${nextStage.label}"`);
  },[dispatchNotification,emailConfig,logAction]);

  // StaffTab hands back the whole updated list on every add/edit/delete/toggle.
  // Diff against current Firestore state so removed members actually get deleted.
  const saveStaff=useCallback(async(list,actor)=>{
    const newIds=new Set(list.map(s=>s.id));
    const removed=staff.filter(s=>!newIds.has(s.id));
    for(const member of list) await saveItem("staff",member);
    for(const gone of removed) await deleteItem("staff",gone.id);
    logAction(actor,"updated staff accounts");
  },[staff,logAction]);

  const saveEmailConfig=useCallback(async(data)=>{
    setEmailConfig(data);
    await saveSingleton("settings",data);
  },[]);

  const deleteRequest=useCallback(async(ref,actor)=>{
    await deleteItem("requests",ref);
    logAction(actor,`deleted request ${ref}`);
  },[logAction]);

  const clearQueue=useCallback(async(refs,actor)=>{
    for(const ref of refs) await deleteItem("requests",ref);
    logAction(actor,`cleared ${refs.length} request(s) from the queue`);
  },[logAction]);

  const saveOwner=useCallback(async(newOwner,actor)=>{
    setOwner(newOwner);
    await saveSingleton("owner",newOwner);
    // If the person changing their own login is currently signed in as the
    // owner, keep their active session's username/password in sync too.
    setCurrentUser(prev=>prev&&prev.role==="Super Admin"?newOwner:prev);
    logAction(actor,"updated their own owner account");
  },[logAction]);

  const submitSurvey=useCallback(async(data)=>{
    await saveItem("surveys",{id:uid(),...data});
  },[]);

  const logout=()=>{
    setCurrentUser(null);setView("landing");
    try{localStorage.removeItem("docutrack:user");localStorage.setItem("docutrack:view","landing");}catch{}
  };

  return(
    <div style={{height:"100vh",overflow:"hidden",fontFamily:"'Inter',system-ui,-apple-system,sans-serif"}}>
      {view==="landing"&&<LandingView onGo={setView}/>}
      {view==="request"&&<RequestView onSubmit={addRequest} notifyConfig={emailConfig} onBack={()=>setView("landing")}/>}
      {view==="track"&&<TrackView requests={requests} notifications={notifications} onSubmitSurvey={submitSurvey} onBack={()=>setView("landing")}/>}
      {view==="adminlogin"&&<AdminLoginView staff={staff} owner={owner} onLogin={(user)=>{setCurrentUser(user);setView("admin");}} onBack={()=>setView("landing")}/>}
      {view==="admin"&&currentUser&&<AdminView currentUser={currentUser} requests={requests} staff={staff} notifications={notifications} emailConfig={emailConfig} owner={owner} auditLog={auditLog} surveys={surveys} dataErrors={dataErrors} onUpdateStatus={updateStatus} onDeleteRequest={deleteRequest} onClearQueue={clearQueue} onSaveStaff={saveStaff} onSaveEmailConfig={saveEmailConfig} onSaveOwner={saveOwner} onLogout={logout}/>}
      <style>{`
        *{box-sizing:border-box}
        html,body{margin:0;padding:0}
        img{max-width:100%}
        input,select,textarea{min-width:0}

        /* ── Responsive content — full-bleed colored backgrounds everywhere,
           just the actual content (forms, buttons, lists) gets a comfortable
           reading width and centers itself on tablets/desktops. No boxed
           "phone mockup" card — this is a normal responsive website. ── */
        .dt-content{
          width:100%;
          max-width:520px;
          margin:0 auto;
        }
        .dt-tabscroll::-webkit-scrollbar{display:none}
        @media (min-width:900px){
          .dt-content{max-width:820px}
        }
        @media (min-width:1100px){
          .dt-stats-grid{grid-template-columns:repeat(4,1fr)!important}
        }
        @media (min-width:640px) and (max-width:1099px){
          .dt-stats-grid{grid-template-columns:repeat(3,1fr)!important}
        }
      `}</style>
    </div>
  );
}
