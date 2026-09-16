export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');
  *{ box-sizing:border-box; margin:0; padding:0; }
  body{ font-family:'Poppins',sans-serif; background:#0d1f4e; }
  ::placeholder{ color:rgba(255,255,255,0.38)!important; }
  ::-webkit-scrollbar{ width:4px; }
  ::-webkit-scrollbar-thumb{ background:rgba(91,79,232,0.25); border-radius:4px; }
  input,select,textarea{ font-family:'Poppins',sans-serif; }

  @keyframes fadeUp   { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes zoomIn   { from{opacity:0;transform:scale(.75)} to{opacity:1;transform:scale(1)} }
  @keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
  @keyframes ripple   { from{transform:scale(0);opacity:.45} to{transform:scale(5);opacity:0} }
  @keyframes spin     { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  @keyframes navPop   { 0%{transform:translateY(0)} 40%{transform:translateY(-5px)} 100%{transform:translateY(0)} }
  @keyframes checkPop { 0%{transform:scale(0) rotate(-20deg)} 65%{transform:scale(1.3) rotate(4deg)} 100%{transform:scale(1)} }
  @keyframes slideUp  { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes successFlash { 0%{background:#22C55E11} 50%{background:#22C55E30} 100%{background:#22C55E11} }
  @keyframes glow     { 0%,100%{box-shadow:0 0 0 0 rgba(91,79,232,0)} 50%{box-shadow:0 0 0 8px rgba(91,79,232,.15)} }

  .fu{ animation:fadeUp  .48s cubic-bezier(.34,1.4,.64,1) both; }
  .zi{ animation:zoomIn  .42s cubic-bezier(.34,1.56,.64,1) both; }
  .d1{animation-delay:.06s} .d2{animation-delay:.12s} .d3{animation-delay:.18s}
  .d4{animation-delay:.24s} .d5{animation-delay:.30s} .d6{animation-delay:.36s}

  .logo-float{ animation:float 3.2s ease-in-out infinite; }

  /* ── every interactive element ── */
  .pressable{
    transition:transform .18s cubic-bezier(.34,1.56,.64,1),
               box-shadow .18s ease, filter .15s ease;
    cursor:pointer; user-select:none;
    -webkit-tap-highlight-color:transparent;
    position:relative; overflow:hidden;
  }
  .pressable:hover { transform:translateY(-2px) scale(1.025); filter:brightness(1.06); }
  .pressable:active{ transform:scale(.93); filter:brightness(.94); }

  .btn-white{
    transition:transform .2s cubic-bezier(.34,1.56,.64,1),
               box-shadow .2s ease, filter .18s ease;
    cursor:pointer; user-select:none;
    -webkit-tap-highlight-color:transparent;
  }
  .btn-white:hover { transform:translateY(-3px) scale(1.02); box-shadow:0 14px 36px rgba(0,0,0,.22); filter:brightness(1.04); }
  .btn-white:active{ transform:scale(.95); }

  .btn-grad{
    transition:transform .2s cubic-bezier(.34,1.56,.64,1),
               box-shadow .2s ease, filter .15s ease;
    cursor:pointer; user-select:none;
    -webkit-tap-highlight-color:transparent;
  }
  .btn-grad:hover { transform:translateY(-3px) scale(1.03); box-shadow:0 14px 36px rgba(91,79,232,.38); filter:brightness(1.08); }
  .btn-grad:active{ transform:scale(.94); }

  .role-card{
    transition:transform .25s cubic-bezier(.34,1.56,.64,1),
               border-color .2s, background .2s, box-shadow .2s;
    cursor:pointer; user-select:none;
    -webkit-tap-highlight-color:transparent;
  }
  .role-card:hover { transform:translateY(-4px) scale(1.015); box-shadow:0 16px 40px rgba(0,0,0,.22); }
  .role-card:active{ transform:scale(.96); }

  .nav-tab{
    transition:transform .2s cubic-bezier(.34,1.56,.64,1);
    cursor:pointer; user-select:none;
    -webkit-tap-highlight-color:transparent;
  }
  .nav-tab:hover { transform:translateY(-2px); }
  .nav-tab:active{ transform:scale(.88); }
  .nav-tab.act-tab{ animation:navPop .3s cubic-bezier(.34,1.56,.64,1); }

  .btn-icon{
    transition:transform .2s cubic-bezier(.34,1.56,.64,1), background .15s, opacity .15s;
    cursor:pointer; user-select:none;
  }
  .btn-icon:hover { transform:scale(1.15) rotate(-5deg); }
  .btn-icon:active{ transform:scale(.86); opacity:.7; }

  .att-btn{
    transition:transform .18s cubic-bezier(.34,1.56,.64,1),
               background .18s, color .18s, box-shadow .18s;
    cursor:pointer; user-select:none;
  }
  .att-btn:hover { transform:translateY(-2px) scale(1.08); }
  .att-btn:active{ transform:scale(.9); }
  .att-btn.sel{ animation:checkPop .38s cubic-bezier(.34,1.56,.64,1); }

  .del-btn{
    transition:transform .2s cubic-bezier(.34,1.56,.64,1), background .15s;
    cursor:pointer; user-select:none;
  }
  .del-btn:hover { transform:scale(1.18) rotate(8deg); }
  .del-btn:active{ transform:scale(.84); }

  .card-lift{ transition:transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s ease; }
  .card-lift:hover{ transform:translateY(-3px); box-shadow:0 10px 30px rgba(27,16,96,.12)!important; }

  .demo-row{ transition:background .15s, transform .14s; border-radius:8px; cursor:pointer; }
  .demo-row:hover{ background:rgba(255,255,255,.14)!important; transform:translateX(4px); }
  .demo-row:active{ transform:scale(.97); }

  .logout-btn{
    transition:background .18s, transform .18s cubic-bezier(.34,1.56,.64,1), color .15s;
    cursor:pointer; user-select:none;
  }
  .logout-btn:hover { background:rgba(239,68,68,.28)!important; transform:scale(1.05); color:#ff8080!important; }
  .logout-btn:active{ transform:scale(.93); }

  .ripple-el{
    position:absolute; border-radius:50%;
    background:rgba(255,255,255,.32);
    pointer-events:none;
    animation:ripple .52s ease-out forwards;
    transform-origin:center;
  }

  @keyframes arrowBounce{ 0%,100%{transform:translateX(0)} 50%{transform:translateX(5px)} }
  .arrow-anim{ display:inline-block; animation:arrowBounce 1.3s ease-in-out infinite; }

  .modal-sheet{ animation:slideUp .34s cubic-bezier(.34,1.4,.64,1) both; }
  .success-flash{ animation:successFlash .6s ease 2; }
  .tick-pop{ animation:checkPop .42s cubic-bezier(.34,1.56,.64,1) both; }
  .spinning{ animation:spin .7s linear infinite; display:inline-block; }
  @keyframes typing   { 0%,100%{opacity:1} 50%{opacity:0.15} }
  @keyframes slideRt  { from{opacity:0;transform:translateX(100%)} to{opacity:1;transform:translateX(0)} }
  .notif-panel{ animation:slideRt .3s cubic-bezier(.34,1.4,.64,1) both; }
`;

/* ═══════════════════════════════════════════════════════
   RIPPLE HOOK
═══════════════════════════════════════════════════════ */