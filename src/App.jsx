import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const META_TOKEN   = import.meta.env.VITE_META_TOKEN;
const META_ACCOUNT = import.meta.env.VITE_META_ACCOUNT;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SUCURSALES = ["Coapa","Valle","Oriente","Polanco","Metepec"];
const COLORES    = { Coapa:"#2721E8", Valle:"#49B8D3", Oriente:"#a855f7", Polanco:"#f97316", Metepec:"#10b981" };

const fmt   = (n) => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:0}).format(n||0);
const fmtN  = (n) => new Intl.NumberFormat("es-MX").format(n||0);
const hoy   = () => new Date().toISOString().slice(0,10);
const inicioMes = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; };
const mesLabel  = () => new Date().toLocaleDateString("es-MX",{month:"long",year:"numeric"});

const ADMIN = { usuario:"cire.admin", password:"cire.admin2026" };

export default function CireDashboard() {
  const [authed, setAuthed]           = useState(false);
  const [user, setUser]               = useState("");
  const [pass, setPass]               = useState("");
  const [loginErr, setLoginErr]       = useState("");
  const [tab, setTab]                 = useState("resumen");
  const [tickets, setTickets]         = useState([]);
  const [loadingDB, setLoadingDB]     = useState(false);
  const [metaData, setMetaData]       = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [metaError, setMetaError]     = useState("");

  // ─── TICKETS ───────────────────────────────────────────────────────────────
  const cargarTickets = async () => {
    setLoadingDB(true);
    const { data, error } = await supabase
      .from("tickets").select("*")
      .gte("fecha", inicioMes()).lte("fecha", hoy())
      .order("created_at", { ascending: false });
    if (!error && data) setTickets(data);
    setLoadingDB(false);
  };

  // ─── META ADS — nivel adset agrupado por sucursal ─────────────────────────
  const cargarMeta = async () => {
    setLoadingMeta(true);
    setMetaError("");
    try {
      const since  = inicioMes();
      const until  = hoy();
      const fields = "adset_name,spend,actions,impressions,clicks,reach";
      const url    = `https://graph.facebook.com/v19.0/act_${META_ACCOUNT}/insights?fields=${fields}&time_range={"since":"${since}","until":"${until}"}&level=adset&limit=200&access_token=${META_TOKEN}`;
      const res    = await fetch(url);
      const json   = await res.json();

      if (json.error) { setMetaError(json.error.message); setLoadingMeta(false); return; }

      const rows = json.data || [];

      const getMensajes = (actions) => {
        const find = (type) => { const a=(actions||[]).find(x=>x.action_type===type); return a?Number(a.value):0; };
        return find("onsite_conversion.messaging_conversation_started_7d")
          || find("onsite_conversion.total_messaging_connection")
          || find("onsite_conversion.messaging_first_reply")
          || find("contact");
      };

      // Totales globales
      let totalSpend=0, totalMensajes=0, totalImp=0, totalClics=0, totalAlcance=0;

      // Por sucursal
      const porSuc = {};
      SUCURSALES.forEach(s => { porSuc[s] = { spend:0, mensajes:0, impresiones:0, clics:0 }; });

      rows.forEach(row => {
        const spend      = Number(row.spend||0);
        const mensajes   = getMensajes(row.actions);
        const impresiones= Number(row.impressions||0);
        const clics      = Number(row.clicks||0);
        const alcance    = Number(row.reach||0);
        const nombre     = (row.adset_name||"").toLowerCase();

        totalSpend    += spend;
        totalMensajes += mensajes;
        totalImp      += impresiones;
        totalClics    += clics;
        totalAlcance  += alcance;

        SUCURSALES.forEach(suc => {
          if (nombre.includes(suc.toLowerCase())) {
            porSuc[suc].spend      += spend;
            porSuc[suc].mensajes   += mensajes;
            porSuc[suc].impresiones+= impresiones;
            porSuc[suc].clics      += clics;
          }
        });
      });

      setMetaData({ spend:totalSpend, mensajes:totalMensajes, impresiones:totalImp, clics:totalClics, alcance:totalAlcance, porSucursal:porSuc });
    } catch(e) {
      setMetaError("Error al conectar con Meta. Verifica el token.");
    }
    setLoadingMeta(false);
  };

  useEffect(() => { if (authed) { cargarTickets(); cargarMeta(); } }, [authed]);

  // ─── MÉTRICAS GLOBALES ─────────────────────────────────────────────────────
  const ventasMes      = tickets.reduce((s,t)=>s+Number(t.total),0);
  const nuevasMes      = tickets.filter(t=>t.tipo_clienta==="Nueva").length;
  const recurrentesMes = tickets.filter(t=>t.tipo_clienta==="Recurrente").length;
  const ticketProm     = tickets.length ? ventasMes/tickets.length : 0;
  const inversion      = metaData?.spend||0;
  const mensajes       = metaData?.mensajes||0;
  const cpa            = nuevasMes>0&&inversion>0 ? inversion/nuevasMes : 0;
  const roas           = inversion>0 ? ventasMes/inversion : 0;
  const convPct        = mensajes>0 ? ((nuevasMes/mensajes)*100).toFixed(1) : "—";

  // Ventas por sucursal (Supabase)
  const ventasSuc = SUCURSALES.map(nombre => ({
    nombre,
    ventas:  tickets.filter(t=>t.sucursal_nombre===nombre).reduce((s,t)=>s+Number(t.total),0),
    nuevas:  tickets.filter(t=>t.sucursal_nombre===nombre&&t.tipo_clienta==="Nueva").length,
    tickets: tickets.filter(t=>t.sucursal_nombre===nombre).length,
  }));
  const maxVenta = Math.max(...ventasSuc.map(s=>s.ventas),1);

  // Meta por sucursal con CPA
  const metaSuc = SUCURSALES.map(nombre => {
    const vSuc    = ventasSuc.find(v=>v.nombre===nombre);
    const mSuc    = metaData?.porSucursal?.[nombre];
    const spend   = mSuc?.spend||0;
    const msg     = mSuc?.mensajes||0;
    const nuevas  = vSuc?.nuevas||0;
    return { nombre, spend, mensajes:msg, nuevas, cpa: nuevas>0&&spend>0 ? spend/nuevas : 0 };
  }).sort((a,b)=>b.mensajes-a.mensajes);
  const maxMensajes = Math.max(...metaSuc.map(s=>s.mensajes),1);

  // Servicios
  const svcsCount = {};
  tickets.forEach(t=>{ (t.servicios||[]).forEach(s=>{ svcsCount[s]=(svcsCount[s]||0)+1; }); });
  const topSvcs = Object.entries(svcsCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxSvc  = topSvcs[0]?.[1]||1;

  // Métodos de pago
  const metodos = {};
  tickets.forEach(t=>{ const m=(t.metodo_pago||"").split(" ")[0]; metodos[m]=(metodos[m]||0)+Number(t.total); });
  const topMetodos = Object.entries(metodos).sort((a,b)=>b[1]-a[1]);

  // Días
  const ventasDia = {};
  tickets.forEach(t=>{ ventasDia[t.fecha]=(ventasDia[t.fecha]||0)+Number(t.total); });
  const diasMes = Object.entries(ventasDia).sort((a,b)=>a[0].localeCompare(b[0]));
  const maxDia  = Math.max(...diasMes.map(d=>d[1]),1);

  function handleLogin() {
    if (user.trim()===ADMIN.usuario && pass===ADMIN.password) { setAuthed(true); setLoginErr(""); }
    else setLoginErr("Credenciales incorrectas");
  }

  // ─── LOGIN ─────────────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{minHeight:"100vh",background:"#0C0D1A",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Albert Sans',sans-serif",position:"relative",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Albert+Sans:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .glow{position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none;}
        .glass{background:rgba(255,255,255,0.04);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.08);border-radius:20px;}
        .inp{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:13px 16px;color:#fff;font-family:'Albert Sans',sans-serif;font-size:14px;width:100%;outline:none;transition:border 0.2s;}
        .inp:focus{border-color:#2721E8;}
        .inp::placeholder{color:rgba(255,255,255,0.25);}
        .btn{background:#2721E8;color:#fff;border:none;border-radius:12px;padding:14px 0;width:100%;font-family:'Albert Sans',sans-serif;font-size:15px;font-weight:600;cursor:pointer;transition:all 0.2s;}
        .btn:hover{background:#3d38f0;transform:translateY(-1px);}
      `}</style>
      <div className="glow" style={{width:400,height:400,background:"#2721E8",opacity:0.15,top:"-100px",left:"-100px"}}/>
      <div className="glow" style={{width:300,height:300,background:"#49B8D3",opacity:0.1,bottom:"50px",right:"50px"}}/>
      <div className="glass" style={{width:400,padding:"48px 40px"}}>
        <div style={{textAlign:"center",marginBottom:"32px"}}>
          <div style={{fontSize:"11px",letterSpacing:"4px",color:"#49B8D3",marginBottom:"8px",fontWeight:500}}>DASHBOARD EJECUTIVO</div>
          <div style={{fontSize:"36px",fontWeight:700,color:"#fff",letterSpacing:"6px"}}>CIRE</div>
          <div style={{fontSize:"13px",color:"rgba(255,255,255,0.3)",marginTop:"4px"}}>Acceso dirección general</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"12px",marginBottom:"20px"}}>
          <input className="inp" placeholder="Usuario" value={user} onChange={e=>setUser(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
          <input className="inp" type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
          {loginErr && <div style={{color:"#ff6b6b",fontSize:"13px",textAlign:"center"}}>{loginErr}</div>}
        </div>
        <button className="btn" onClick={handleLogin}>Entrar al dashboard →</button>
        <div style={{marginTop:"16px",fontSize:"11px",color:"rgba(255,255,255,0.15)",textAlign:"center",letterSpacing:"1px"}}>ACCESO RESTRINGIDO · SOLO DIRECCIÓN</div>
      </div>
    </div>
  );

  // ─── DASHBOARD ─────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"#0C0D1A",fontFamily:"'Albert Sans',sans-serif",color:"#fff"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Albert+Sans:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px;}
        .glass{background:rgba(255,255,255,0.04);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.08);border-radius:16px;}
        .glass-dark{background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:12px;}
        .kpi{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px 22px;}
        .kpi.highlight{border-color:rgba(39,33,232,0.5);background:rgba(39,33,232,0.08);}
        .kpi.green{border-color:rgba(16,185,129,0.4);background:rgba(16,185,129,0.06);}
        .kpi.orange{border-color:rgba(249,115,22,0.4);background:rgba(249,115,22,0.06);}
        .tab{padding:10px 20px;font-size:13px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;color:rgba(255,255,255,0.35);transition:all 0.18s;}
        .tab.active{color:#fff;border-bottom-color:#2721E8;}
        .tab:hover{color:rgba(255,255,255,0.7);}
        .btn-ghost{background:transparent;color:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:8px 16px;font-family:'Albert Sans',sans-serif;font-size:12px;cursor:pointer;transition:all 0.2s;}
        .btn-ghost:hover{border-color:#2721E8;color:#fff;}
        .rank-row{display:grid;grid-template-columns:32px 110px 1fr 110px 110px 100px;gap:0;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center;}
        .rank-row:hover{background:rgba(255,255,255,0.02);}
      `}</style>

      {/* TOPBAR */}
      <div style={{padding:"0 28px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"space-between",height:"60px",background:"rgba(0,0,0,0.4)",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:"20px"}}>
          <div style={{fontSize:"20px",fontWeight:700,letterSpacing:"4px"}}>CIRE</div>
          <div style={{width:"1px",height:"20px",background:"rgba(255,255,255,0.1)"}}/>
          <div style={{fontSize:"12px",color:"rgba(255,255,255,0.4)",letterSpacing:"1px"}}>DASHBOARD EJECUTIVO</div>
          <div style={{display:"flex"}}>
            {["resumen","sucursales","servicios","meta"].map(t=>(
              <div key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>
                {{resumen:"Resumen",sucursales:"Sucursales",servicios:"Servicios",meta:"Meta Ads"}[t]}
              </div>
            ))}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          {loadingMeta
            ? <div style={{fontSize:"11px",padding:"4px 10px",borderRadius:"20px",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.4)"}}>⟳ Meta...</div>
            : metaError
            ? <div style={{fontSize:"11px",padding:"4px 10px",borderRadius:"20px",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",border:"1px solid rgba(255,80,80,0.3)"}}>⚠ Meta error</div>
            : metaData
            ? <div style={{fontSize:"11px",padding:"4px 10px",borderRadius:"20px",background:"rgba(16,185,129,0.1)",color:"#10b981",border:"1px solid rgba(16,185,129,0.3)"}}>● Meta conectado</div>
            : null}
          <div style={{fontSize:"12px",color:"rgba(255,255,255,0.3)",textTransform:"capitalize"}}>{mesLabel()}</div>
          <button className="btn-ghost" onClick={()=>{ cargarTickets(); cargarMeta(); }}>↻ Actualizar</button>
          <button className="btn-ghost" onClick={()=>setAuthed(false)}>Salir</button>
        </div>
      </div>

      <div style={{padding:"24px 28px",maxWidth:"1400px",margin:"0 auto"}}>

        {/* ── RESUMEN ── */}
        {tab==="resumen" && (
          <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"14px"}}>
              {[
                { label:"VENTAS DEL MES",  value:fmt(ventasMes),  sub:`${fmtN(tickets.length)} tickets`,         cls:"highlight", color:"#2721E8" },
                { label:"NUEVAS CLIENTAS", value:nuevasMes,       sub:`${recurrentesMes} recurrentes`,            cls:"",          color:"#fff" },
                { label:"TICKET PROMEDIO", value:fmt(ticketProm), sub:"por visita",                               cls:"",          color:"#fff" },
                { label:"CONVERSIÓN ADS",  value:convPct==="—"?"—":`${convPct}%`, sub:mensajes>0?`de ${fmtN(mensajes)} mensajes`:"Cargando Meta...", cls:parseFloat(convPct)>10?"green":"orange", color:parseFloat(convPct)>10?"#10b981":"#f97316" },
              ].map(k=>(
                <div key={k.label} className={`kpi ${k.cls}`}>
                  <div style={{fontSize:"10px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"10px"}}>{k.label}</div>
                  <div style={{fontSize:"30px",fontWeight:700,color:k.color,lineHeight:1}}>{k.value}</div>
                  <div style={{fontSize:"11px",color:"rgba(255,255,255,0.3)",marginTop:"6px"}}>{k.sub}</div>
                </div>
              ))}
            </div>

            {inversion>0 && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"14px"}}>
                {[
                  { label:"INVERSIÓN META ADS",      value:fmt(inversion),       sub:"gastado este mes",    color:"#f97316" },
                  { label:"COSTO POR CLIENTA NUEVA", value:fmt(cpa),             sub:"costo de adquisición",color:"#a855f7" },
                  { label:"ROAS",                    value:`${roas.toFixed(2)}x`,sub:roas>=3?"Excelente ✓":roas>=2?"Bueno ✓":"Mejorable ⚠", color:"#10b981" },
                ].map(k=>(
                  <div key={k.label} className="glass-dark" style={{padding:"18px 22px",borderLeft:`3px solid ${k.color}`}}>
                    <div style={{fontSize:"10px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"8px"}}>{k.label}</div>
                    <div style={{fontSize:"26px",fontWeight:700,color:k.color}}>{k.value}</div>
                    <div style={{fontSize:"11px",color:"rgba(255,255,255,0.3)",marginTop:"4px"}}>{k.sub}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="glass" style={{padding:"22px"}}>
              <div style={{marginBottom:"18px",display:"flex",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:"11px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"4px"}}>VENTAS POR DÍA</div>
                  <div style={{fontSize:"18px",fontWeight:600}}>{mesLabel()}</div>
                </div>
                {loadingDB && <div style={{fontSize:"12px",color:"rgba(255,255,255,0.3)"}}>Cargando...</div>}
              </div>
              {diasMes.length===0
                ? <div style={{textAlign:"center",color:"rgba(255,255,255,0.2)",padding:"32px",fontSize:"13px"}}>No hay datos este mes aún</div>
                : <div style={{display:"flex",alignItems:"flex-end",gap:"8px",height:"140px"}}>
                    {diasMes.map(([fecha,venta])=>{
                      const h=Math.round((venta/maxDia)*100);
                      return (
                        <div key={fecha} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"4px"}} title={`${fecha}: ${fmt(venta)}`}>
                          <div style={{fontSize:"9px",color:"rgba(255,255,255,0.25)"}}>{fmt(venta).replace("MX$","$")}</div>
                          <div style={{width:"100%",height:`${h}%`,background:h>80?"#2721E8":h>50?"#49B8D3":"rgba(39,33,232,0.35)",borderRadius:"3px 3px 0 0",minHeight:"4px"}}/>
                          <div style={{fontSize:"10px",color:"rgba(255,255,255,0.3)"}}>{fecha.slice(8)}</div>
                        </div>
                      );
                    })}
                  </div>
              }
            </div>

            <div className="glass" style={{overflow:"hidden"}}>
              <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",fontSize:"13px",fontWeight:600}}>Últimas ventas del mes</div>
              <div style={{display:"grid",gridTemplateColumns:"80px 1fr 110px 110px 120px 90px",padding:"10px 20px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                {["TICKET","CLIENTA","SUCURSAL","TOTAL","MÉTODO","TIPO"].map(h=>(
                  <div key={h} style={{fontSize:"10px",letterSpacing:"1.5px",color:"rgba(255,255,255,0.2)"}}>{h}</div>
                ))}
              </div>
              {tickets.slice(0,10).map(t=>(
                <div key={t.id} style={{display:"grid",gridTemplateColumns:"80px 1fr 110px 110px 120px 90px",padding:"13px 20px",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                  <div style={{fontSize:"11px",color:"#6b66ff",fontWeight:600}}>{t.ticket_num}</div>
                  <div>
                    <div style={{fontSize:"13px"}}>{t.clienta}</div>
                    <div style={{fontSize:"10px",color:"rgba(255,255,255,0.3)",marginTop:"1px"}}>{(t.servicios||[]).slice(0,2).join(" + ")}{(t.servicios||[]).length>2?` +${(t.servicios||[]).length-2}`:""}</div>
                  </div>
                  <div style={{fontSize:"12px",color:"rgba(255,255,255,0.5)"}}>{t.sucursal_nombre}</div>
                  <div style={{fontSize:"14px",fontWeight:700,color:"#49B8D3"}}>{fmt(t.total)}</div>
                  <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)"}}>{t.metodo_pago}</div>
                  <div><span style={{background:t.tipo_clienta==="Nueva"?"rgba(39,33,232,0.2)":"rgba(73,184,211,0.15)",color:t.tipo_clienta==="Nueva"?"#6b66ff":"#49B8D3",border:`1px solid ${t.tipo_clienta==="Nueva"?"rgba(39,33,232,0.4)":"rgba(73,184,211,0.3)"}`,borderRadius:"6px",padding:"2px 8px",fontSize:"10px",fontWeight:600}}>{t.tipo_clienta}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SUCURSALES ── */}
        {tab==="sucursales" && (
          <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"14px"}}>
              {ventasSuc.map(s=>(
                <div key={s.nombre} className="kpi" style={{borderColor:`${COLORES[s.nombre]}44`}}>
                  <div style={{width:"8px",height:"8px",borderRadius:"50%",background:COLORES[s.nombre],marginBottom:"10px",boxShadow:`0 0 8px ${COLORES[s.nombre]}`}}/>
                  <div style={{fontSize:"11px",letterSpacing:"1px",color:"rgba(255,255,255,0.3)",marginBottom:"8px"}}>{s.nombre.toUpperCase()}</div>
                  <div style={{fontSize:"24px",fontWeight:700,color:COLORES[s.nombre]}}>{fmt(s.ventas)}</div>
                  <div style={{fontSize:"12px",color:"rgba(255,255,255,0.4)",marginTop:"6px"}}>{s.nuevas} nuevas · {s.tickets} tickets</div>
                </div>
              ))}
            </div>
            <div className="glass" style={{padding:"22px"}}>
              <div style={{fontSize:"11px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"20px"}}>COMPARATIVO DE VENTAS</div>
              {ventasSuc.sort((a,b)=>b.ventas-a.ventas).map(s=>(
                <div key={s.nombre} style={{marginBottom:"16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                    <div style={{fontSize:"13px",fontWeight:500}}>{s.nombre}</div>
                    <div style={{display:"flex",gap:"16px"}}>
                      <span style={{fontSize:"12px",color:"rgba(255,255,255,0.4)"}}>{s.nuevas} nuevas</span>
                      <span style={{fontSize:"14px",fontWeight:700,color:COLORES[s.nombre]}}>{fmt(s.ventas)}</span>
                    </div>
                  </div>
                  <div style={{height:"8px",background:"rgba(255,255,255,0.05)",borderRadius:"4px",overflow:"hidden"}}>
                    <div style={{width:`${Math.round((s.ventas/maxVenta)*100)}%`,height:"100%",background:COLORES[s.nombre],borderRadius:"4px",transition:"width 0.8s"}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SERVICIOS ── */}
        {tab==="servicios" && (
          <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
            <div className="glass" style={{padding:"22px"}}>
              <div style={{fontSize:"11px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"20px"}}>SERVICIOS MÁS VENDIDOS</div>
              {topSvcs.length===0
                ? <div style={{textAlign:"center",color:"rgba(255,255,255,0.2)",padding:"32px"}}>Sin datos aún</div>
                : topSvcs.map(([nombre,count],i)=>(
                  <div key={nombre} style={{marginBottom:"14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                      <div style={{display:"flex",gap:"12px",alignItems:"center"}}>
                        <div style={{width:"22px",height:"22px",borderRadius:"50%",background:"rgba(39,33,232,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",color:"#6b66ff",fontWeight:700}}>{i+1}</div>
                        <div style={{fontSize:"13px"}}>{nombre}</div>
                      </div>
                      <span style={{fontSize:"14px",fontWeight:700,color:"#49B8D3"}}>{count} ventas</span>
                    </div>
                    <div style={{height:"6px",background:"rgba(255,255,255,0.05)",borderRadius:"3px"}}>
                      <div style={{width:`${Math.round((count/maxSvc)*100)}%`,height:"100%",background:i===0?"#2721E8":i===1?"#49B8D3":"rgba(39,33,232,0.5)",borderRadius:"3px"}}/>
                    </div>
                  </div>
                ))}
            </div>
            <div className="glass" style={{padding:"22px"}}>
              <div style={{fontSize:"11px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"20px"}}>MÉTODOS DE PAGO</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"12px"}}>
                {topMetodos.map(([m,v])=>(
                  <div key={m} style={{padding:"16px",background:"rgba(0,0,0,0.3)",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:"13px"}}>{m}</div>
                    <div style={{fontSize:"16px",fontWeight:700,color:"#49B8D3"}}>{fmt(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── META ADS ── */}
        {tab==="meta" && (
          <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>

            {/* Header conexión */}
            <div className="glass-dark" style={{padding:"18px 22px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
                <div style={{width:"38px",height:"38px",borderRadius:"10px",background:"#1877F2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",fontWeight:700,color:"#fff"}}>f</div>
                <div>
                  <div style={{fontSize:"14px",fontWeight:600}}>Meta Ads · Ciredepilacion</div>
                  <div style={{fontSize:"12px",color:"rgba(255,255,255,0.4)",marginTop:"2px"}}>Cuenta {META_ACCOUNT} · {mesLabel()} · datos por conjunto de anuncios</div>
                </div>
              </div>
              <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
                {metaError
                  ? <div style={{fontSize:"12px",color:"#ff6b6b",background:"rgba(255,80,80,0.1)",padding:"6px 14px",borderRadius:"8px",border:"1px solid rgba(255,80,80,0.3)"}}>{metaError}</div>
                  : <div style={{fontSize:"12px",color:"#10b981",background:"rgba(16,185,129,0.1)",padding:"6px 14px",borderRadius:"8px",border:"1px solid rgba(16,185,129,0.3)"}}>● Conectado</div>
                }
                <button className="btn-ghost" onClick={cargarMeta}>{loadingMeta?"Cargando...":"↻ Actualizar"}</button>
              </div>
            </div>

            {metaData && (<>

              {/* KPIs globales */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"14px"}}>
                {[
                  { label:"GASTADO ESTE MES",  value:fmt(metaData.spend),              color:"#f97316" },
                  { label:"ALCANCE TOTAL",      value:fmtN(metaData.alcance),           color:"#2721E8" },
                  { label:"IMPRESIONES",        value:fmtN(metaData.impresiones),       color:"#49B8D3" },
                  { label:"MENSAJES RECIBIDOS", value:fmtN(metaData.mensajes),          color:"#a855f7" },
                ].map(k=>(
                  <div key={k.label} className="kpi">
                    <div style={{fontSize:"10px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"10px"}}>{k.label}</div>
                    <div style={{fontSize:"26px",fontWeight:700,color:k.color}}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* ROI global */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"14px"}}>
                {[
                  { label:"COSTO POR CLIENTA NUEVA", value:fmt(cpa), sub:`${nuevasMes} clientas captadas`, color:"#a855f7" },
                  { label:"ROAS GLOBAL", value:`${roas.toFixed(2)}x`, sub:roas>=3?"Excelente ✓":roas>=2?"Bueno ✓":"Mejorable ⚠", color:"#10b981" },
                  { label:"CONVERSIÓN MENSAJES→VENTA", value:convPct==="—"?"Sin datos":`${convPct}%`, sub:mensajes>0?`${fmtN(mensajes)} mensajes totales`:"", color:parseFloat(convPct)>=10?"#10b981":"#f97316" },
                ].map(k=>(
                  <div key={k.label} className="glass-dark" style={{padding:"20px 22px",borderLeft:`3px solid ${k.color}`}}>
                    <div style={{fontSize:"10px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"8px"}}>{k.label}</div>
                    <div style={{fontSize:"30px",fontWeight:700,color:k.color,lineHeight:1}}>{k.value}</div>
                    <div style={{fontSize:"12px",color:"rgba(255,255,255,0.4)",marginTop:"6px"}}>{k.sub}</div>
                  </div>
                ))}
              </div>

              {/* RANKING POR SUCURSAL */}
              <div className="glass" style={{overflow:"hidden"}}>
                <div style={{padding:"18px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:"11px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"4px"}}>RANKING DE SUCURSALES POR META ADS</div>
                    <div style={{fontSize:"15px",fontWeight:600}}>{mesLabel()}</div>
                  </div>
                </div>

                {/* Header tabla */}
                <div className="rank-row" style={{padding:"10px 20px"}}>
                  {["#","SUCURSAL","MENSAJES RECIBIDOS","INVERSIÓN","CPA","% CONV"].map(h=>(
                    <div key={h} style={{fontSize:"10px",letterSpacing:"1.5px",color:"rgba(255,255,255,0.2)"}}>{h}</div>
                  ))}
                </div>

                {metaSuc.map((s,i)=>{
                  const pctConv = s.mensajes>0&&s.nuevas>0 ? ((s.nuevas/s.mensajes)*100).toFixed(1) : "—";
                  const barW    = Math.round((s.mensajes/maxMensajes)*100);
                  return (
                    <div key={s.nombre} className="rank-row">
                      {/* # */}
                      <div style={{fontSize:"13px",fontWeight:700,color:i===0?"#f0c040":i===1?"rgba(200,200,200,0.7)":i===2?"#cd7f32":"rgba(255,255,255,0.3)"}}>
                        {i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}
                      </div>
                      {/* Sucursal */}
                      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                        <div style={{width:"8px",height:"8px",borderRadius:"50%",background:COLORES[s.nombre],flexShrink:0}}/>
                        <span style={{fontSize:"13px",fontWeight:600}}>{s.nombre}</span>
                      </div>
                      {/* Barra mensajes */}
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                          <div style={{flex:1,height:"6px",background:"rgba(255,255,255,0.05)",borderRadius:"3px",overflow:"hidden"}}>
                            <div style={{width:`${barW}%`,height:"100%",background:COLORES[s.nombre],borderRadius:"3px"}}/>
                          </div>
                          <span style={{fontSize:"13px",fontWeight:700,color:COLORES[s.nombre],minWidth:"36px"}}>{fmtN(s.mensajes)}</span>
                        </div>
                      </div>
                      {/* Inversión */}
                      <div style={{fontSize:"13px",fontWeight:600,color:"#f97316"}}>{fmt(s.spend)}</div>
                      {/* CPA */}
                      <div style={{fontSize:"13px",fontWeight:600,color: s.cpa>0&&s.cpa<40?"#10b981":s.cpa<60?"#f0c040":"#ff6b6b"}}>
                        {s.cpa>0?fmt(s.cpa):"—"}
                      </div>
                      {/* % conversión */}
                      <div style={{fontSize:"13px",fontWeight:600,color:parseFloat(pctConv)>=10?"#10b981":parseFloat(pctConv)>0?"#f0c040":"rgba(255,255,255,0.3)"}}>
                        {pctConv==="—"?"—":`${pctConv}%`}
                      </div>
                    </div>
                  );
                })}

                <div style={{padding:"12px 20px",fontSize:"11px",color:"rgba(255,255,255,0.2)",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
                  💡 CPA = Costo por Adquisición (inversión ÷ clientas nuevas cerradas). Verde &lt;$40 · Amarillo $40-$60 · Rojo &gt;$60
                </div>
              </div>

              {/* Embudo global */}
              {metaData.mensajes>0 && (
                <div className="glass" style={{padding:"24px"}}>
                  <div style={{fontSize:"11px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"20px"}}>EMBUDO GLOBAL · {mesLabel()}</div>
                  <div style={{display:"flex",alignItems:"stretch"}}>
                    {[
                      { label:"Alcance",      value:fmtN(metaData.alcance),      color:"#2721E8" },
                      { label:"Clics",        value:fmtN(metaData.clics),        color:"#49B8D3", pct:metaData.alcance>0?((metaData.clics/metaData.alcance)*100).toFixed(1):0 },
                      { label:"Mensajes",     value:fmtN(metaData.mensajes),     color:"#a855f7", pct:metaData.clics>0?((metaData.mensajes/metaData.clics)*100).toFixed(1):0 },
                      { label:"Ventas nuevas",value:fmtN(nuevasMes),             color:"#10b981", pct:metaData.mensajes>0?((nuevasMes/metaData.mensajes)*100).toFixed(1):0 },
                    ].map((e,i)=>(
                      <div key={e.label} style={{flex:1,padding:"20px 16px",background:`${e.color}12`,border:`1px solid ${e.color}33`,borderLeft:i>0?"none":"",borderRadius:i===0?"12px 0 0 12px":i===3?"0 12px 12px 0":"0",textAlign:"center"}}>
                        <div style={{fontSize:"24px",fontWeight:700,color:e.color}}>{e.value}</div>
                        <div style={{fontSize:"12px",color:"rgba(255,255,255,0.4)",margin:"4px 0"}}>{e.label}</div>
                        {i>0 && <div style={{fontSize:"11px",color:e.color,fontWeight:600}}>{e.pct}% del anterior</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </>)}

            {loadingMeta && <div style={{textAlign:"center",padding:"40px",color:"rgba(255,255,255,0.3)"}}>Conectando con Meta Ads...</div>}
            {!loadingMeta && metaError && (
              <div style={{textAlign:"center",padding:"32px",color:"#ff6b6b",background:"rgba(255,80,80,0.05)",borderRadius:"12px",border:"1px solid rgba(255,80,80,0.2)"}}>
                <div style={{fontSize:"16px",marginBottom:"8px"}}>⚠️ {metaError}</div>
                <div style={{fontSize:"12px",color:"rgba(255,255,255,0.3)"}}>Verifica que el token en Vercel sea válido y tenga permisos ads_read e read_insights</div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
