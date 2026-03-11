import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SUCURSALES = ["Coapa","Valle","Oriente","Polanco","Metepec"];
const COLORES = { Coapa:"#2721E8", Valle:"#49B8D3", Oriente:"#a855f7", Polanco:"#f97316", Metepec:"#10b981" };

const fmt  = (n) => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:0}).format(n||0);
const fmtN = (n) => new Intl.NumberFormat("es-MX").format(n||0);

const hoy     = () => new Date().toISOString().slice(0,10);
const inicioMes = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; };
const mesLabel  = () => new Date().toLocaleDateString("es-MX",{month:"long",year:"numeric"});

// ─── LOGIN DATA ───────────────────────────────────────────────────────────────
const ADMIN = { usuario: "cire.admin", password: "cire.admin2026" };

export default function CireDashboard() {
  const [authed, setAuthed]         = useState(false);
  const [user, setUser]             = useState("");
  const [pass, setPass]             = useState("");
  const [loginErr, setLoginErr]     = useState("");

  // Data
  const [tickets, setTickets]       = useState([]);
  const [loading, setLoading]       = useState(false);

  // Meta Ads inputs (manual por ahora)
  const [inversion, setInversion]   = useState("");
  const [mensajes, setMensajes]     = useState("");
  const [editingMeta, setEditingMeta] = useState(false);
  const [savedMeta, setSavedMeta]   = useState({ inversion: 0, mensajes: 0 });

  const [tab, setTab]               = useState("resumen");

  // ─── CARGA DE DATOS ────────────────────────────────────────────────────────
  const cargarTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .gte("fecha", inicioMes())
      .lte("fecha", hoy())
      .order("created_at", { ascending: false });
    if (!error && data) setTickets(data);
    setLoading(false);
  };

  useEffect(() => { if (authed) cargarTickets(); }, [authed]);

  // ─── MÉTRICAS ──────────────────────────────────────────────────────────────
  const ventasMes      = tickets.reduce((s,t) => s + Number(t.total), 0);
  const nuevasMes      = tickets.filter(t => t.tipo_clienta === "Nueva").length;
  const recurrentesMes = tickets.filter(t => t.tipo_clienta === "Recurrente").length;
  const ticketProm     = tickets.length ? ventasMes / tickets.length : 0;
  const inversionNum   = Number(savedMeta.inversion) || 0;
  const mensajesNum    = Number(savedMeta.mensajes) || 0;
  const cpa            = nuevasMes > 0 && inversionNum > 0 ? inversionNum / nuevasMes : 0;
  const roas           = inversionNum > 0 ? ventasMes / inversionNum : 0;
  const convPct        = mensajesNum > 0 ? ((nuevasMes / mensajesNum) * 100).toFixed(1) : "—";

  // Ventas por sucursal
  const porSucursal = SUCURSALES.map(nombre => ({
    nombre,
    ventas:    tickets.filter(t => t.sucursal_nombre === nombre).reduce((s,t) => s+Number(t.total),0),
    nuevas:    tickets.filter(t => t.sucursal_nombre === nombre && t.tipo_clienta === "Nueva").length,
    tickets:   tickets.filter(t => t.sucursal_nombre === nombre).length,
  }));
  const maxVenta = Math.max(...porSucursal.map(s => s.ventas), 1);

  // Servicios más vendidos
  const svcsCount = {};
  tickets.forEach(t => { (t.servicios||[]).forEach(s => { svcsCount[s] = (svcsCount[s]||0)+1; }); });
  const topSvcs = Object.entries(svcsCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxSvc  = topSvcs[0]?.[1] || 1;

  // Métodos de pago
  const metodos = {};
  tickets.forEach(t => {
    const m = (t.metodo_pago||"").split(" ")[0];
    metodos[m] = (metodos[m]||0) + Number(t.total);
  });
  const topMetodos = Object.entries(metodos).sort((a,b)=>b[1]-a[1]);

  // Ventas por día (últimos 15 días del mes)
  const ventasDia = {};
  tickets.forEach(t => { ventasDia[t.fecha] = (ventasDia[t.fecha]||0) + Number(t.total); });
  const diasMes = Object.entries(ventasDia).sort((a,b)=>a[0].localeCompare(b[0]));
  const maxDia  = Math.max(...diasMes.map(d=>d[1]), 1);

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
          <input className="inp" placeholder="Usuario" value={user} onChange={e=>setUser(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()}/>
          <input className="inp" type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()}/>
          {loginErr && <div style={{color:"#ff6b6b",fontSize:"13px",textAlign:"center"}}>{loginErr}</div>}
        </div>
        <button className="btn" onClick={handleAdminLogin}>Entrar al dashboard →</button>
        <div style={{marginTop:"20px",fontSize:"11px",color:"rgba(255,255,255,0.15)",textAlign:"center",letterSpacing:"1px"}}>ACCESO RESTRINGIDO · SOLO DIRECCIÓN</div>
      </div>
    </div>
  );

  function handleAdminLogin() {
    if (user.trim() === ADMIN.usuario && pass === ADMIN.password) { setAuthed(true); setLoginErr(""); }
    else setLoginErr("Credenciales incorrectas");
  }

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
        .kpi{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px 22px;transition:border 0.2s;}
        .kpi:hover{border-color:rgba(39,33,232,0.4);}
        .kpi.highlight{border-color:rgba(39,33,232,0.5);background:rgba(39,33,232,0.08);}
        .kpi.green{border-color:rgba(16,185,129,0.4);background:rgba(16,185,129,0.06);}
        .kpi.orange{border-color:rgba(249,115,22,0.4);background:rgba(249,115,22,0.06);}
        .tab{padding:10px 20px;font-size:13px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;color:rgba(255,255,255,0.35);transition:all 0.18s;}
        .tab.active{color:#fff;border-bottom-color:#2721E8;}
        .tab:hover{color:rgba(255,255,255,0.7);}
        .btn-ghost{background:transparent;color:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:8px 16px;font-family:'Albert Sans',sans-serif;font-size:12px;cursor:pointer;transition:all 0.2s;}
        .btn-ghost:hover{border-color:#2721E8;color:#fff;}
        .inp-dark{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:9px 12px;color:#fff;font-family:'Albert Sans',sans-serif;font-size:13px;width:100%;outline:none;}
        .inp-dark:focus{border-color:#2721E8;}
        .inp-dark::placeholder{color:rgba(255,255,255,0.2);}
        .btn-save{background:#2721E8;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-family:'Albert Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;}
        .btn-save:hover{background:#3d38f0;}
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
        <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
          <div style={{fontSize:"12px",color:"rgba(255,255,255,0.3)",textTransform:"capitalize"}}>{mesLabel()}</div>
          <button className="btn-ghost" onClick={cargarTickets}>↻ Actualizar</button>
          <button className="btn-ghost" onClick={()=>setAuthed(false)}>Salir</button>
        </div>
      </div>

      <div style={{padding:"24px 28px",maxWidth:"1400px",margin:"0 auto"}}>

        {/* ── RESUMEN ── */}
        {tab === "resumen" && (
          <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>

            {/* KPIs principales */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"14px"}}>
              {[
                { label:"VENTAS DEL MES", value:fmt(ventasMes), sub:`${fmtN(tickets.length)} tickets`, cls:"highlight", icon:"◈" },
                { label:"NUEVAS CLIENTAS", value:nuevasMes, sub:`${recurrentesMes} recurrentes`, cls:"", icon:"✦" },
                { label:"TICKET PROMEDIO", value:fmt(ticketProm), sub:"por visita", cls:"", icon:"◆" },
                { label:"CONVERSIÓN ADS", value: convPct === "—" ? "—" : `${convPct}%`, sub: mensajesNum>0 ? `${fmtN(mensajesNum)} mensajes` : "Configura Meta Ads", cls: parseFloat(convPct)>10 ? "green" : "orange", icon:"◎" },
              ].map(k=>(
                <div key={k.label} className={`kpi ${k.cls}`}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"10px"}}>
                    <div style={{fontSize:"10px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)"}}>{k.label}</div>
                    <div style={{fontSize:"16px",color:"rgba(255,255,255,0.15)"}}>{k.icon}</div>
                  </div>
                  <div style={{fontSize:"30px",fontWeight:700,color: k.cls==="highlight"?"#2721E8": k.cls==="green"?"#10b981": k.cls==="orange"?"#f97316":"#fff",lineHeight:1}}>{k.value}</div>
                  <div style={{fontSize:"11px",color:"rgba(255,255,255,0.3)",marginTop:"6px"}}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* ROI Meta Ads */}
            {inversionNum > 0 && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"14px"}}>
                {[
                  { label:"INVERSIÓN META ADS", value:fmt(inversionNum), sub:"este mes", color:"#f97316" },
                  { label:"COSTO POR CLIENTA", value:fmt(cpa), sub:"costo por adquisición", color:"#a855f7" },
                  { label:"ROAS", value:`${roas.toFixed(1)}x`, sub:`${fmt(ventasMes)} generados`, color:"#10b981" },
                ].map(k=>(
                  <div key={k.label} className="glass-dark" style={{padding:"18px 22px",borderLeft:`3px solid ${k.color}`}}>
                    <div style={{fontSize:"10px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"8px"}}>{k.label}</div>
                    <div style={{fontSize:"26px",fontWeight:700,color:k.color}}>{k.value}</div>
                    <div style={{fontSize:"11px",color:"rgba(255,255,255,0.3)",marginTop:"4px"}}>{k.sub}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Gráfica ventas por día */}
            <div className="glass" style={{padding:"22px"}}>
              <div style={{marginBottom:"18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:"11px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"4px"}}>VENTAS POR DÍA</div>
                  <div style={{fontSize:"18px",fontWeight:600}}>{mesLabel()}</div>
                </div>
                {loading && <div style={{fontSize:"12px",color:"rgba(255,255,255,0.3)"}}>Cargando...</div>}
              </div>
              {diasMes.length === 0
                ? <div style={{textAlign:"center",color:"rgba(255,255,255,0.2)",padding:"32px",fontSize:"13px"}}>No hay datos este mes aún</div>
                : (
                  <div style={{display:"flex",alignItems:"flex-end",gap:"8px",height:"140px"}}>
                    {diasMes.map(([fecha,venta])=>{
                      const h = Math.round((venta/maxDia)*100);
                      const dia = fecha.slice(8);
                      return (
                        <div key={fecha} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",cursor:"default"}} title={`${fecha}: ${fmt(venta)}`}>
                          <div style={{fontSize:"9px",color:"rgba(255,255,255,0.3)",marginBottom:"2px"}}>{fmt(venta).replace("$","").replace(",000","k")}</div>
                          <div style={{width:"100%",height:`${h}%`,background: h>80?"#2721E8":h>50?"#49B8D3":"rgba(39,33,232,0.3)",borderRadius:"3px 3px 0 0",minHeight:"4px",transition:"height 0.5s"}}/>
                          <div style={{fontSize:"10px",color:"rgba(255,255,255,0.3)"}}>{dia}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>

            {/* Últimos tickets */}
            <div className="glass" style={{overflow:"hidden"}}>
              <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",fontSize:"13px",fontWeight:600}}>Últimas ventas del mes</div>
              <div style={{display:"grid",gridTemplateColumns:"80px 1fr 120px 120px 110px 90px",padding:"10px 20px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                {["TICKET","CLIENTA","SUCURSAL","TOTAL","MÉTODO","TIPO"].map(h=>(
                  <div key={h} style={{fontSize:"10px",letterSpacing:"1.5px",color:"rgba(255,255,255,0.2)"}}>{h}</div>
                ))}
              </div>
              {tickets.slice(0,10).map(t=>(
                <div key={t.id} style={{display:"grid",gridTemplateColumns:"80px 1fr 120px 120px 110px 90px",padding:"13px 20px",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                  <div style={{fontSize:"11px",color:"#6b66ff",fontWeight:600}}>{t.ticket_num}</div>
                  <div>
                    <div style={{fontSize:"13px"}}>{t.clienta}</div>
                    <div style={{fontSize:"10px",color:"rgba(255,255,255,0.3)",marginTop:"1px"}}>{(t.servicios||[]).slice(0,2).join(" + ")}{(t.servicios||[]).length>2?` +${(t.servicios||[]).length-2}`:""}</div>
                  </div>
                  <div style={{fontSize:"12px",color:"rgba(255,255,255,0.5)"}}>{t.sucursal_nombre}</div>
                  <div style={{fontSize:"14px",fontWeight:700,color:"#49B8D3"}}>{fmt(t.total)}</div>
                  <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)"}}>{t.metodo_pago}</div>
                  <div><span style={{background: t.tipo_clienta==="Nueva"?"rgba(39,33,232,0.2)":"rgba(73,184,211,0.15)", color: t.tipo_clienta==="Nueva"?"#6b66ff":"#49B8D3", border:`1px solid ${t.tipo_clienta==="Nueva"?"rgba(39,33,232,0.4)":"rgba(73,184,211,0.3)"}`, borderRadius:"6px",padding:"2px 8px",fontSize:"10px",fontWeight:600}}>{t.tipo_clienta}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SUCURSALES ── */}
        {tab === "sucursales" && (
          <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"14px"}}>
              {porSucursal.map(s=>(
                <div key={s.nombre} className="kpi" style={{borderColor:`${COLORES[s.nombre]}44`}}>
                  <div style={{width:"8px",height:"8px",borderRadius:"50%",background:COLORES[s.nombre],marginBottom:"10px",boxShadow:`0 0 8px ${COLORES[s.nombre]}`}}/>
                  <div style={{fontSize:"11px",letterSpacing:"1px",color:"rgba(255,255,255,0.3)",marginBottom:"8px"}}>{s.nombre.toUpperCase()}</div>
                  <div style={{fontSize:"24px",fontWeight:700,color:COLORES[s.nombre]}}>{fmt(s.ventas)}</div>
                  <div style={{fontSize:"12px",color:"rgba(255,255,255,0.4)",marginTop:"6px"}}>{s.nuevas} nuevas · {s.tickets} tickets</div>
                </div>
              ))}
            </div>

            {/* Barras comparativas */}
            <div className="glass" style={{padding:"22px"}}>
              <div style={{fontSize:"11px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"20px"}}>COMPARATIVO DE VENTAS</div>
              <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
                {porSucursal.sort((a,b)=>b.ventas-a.ventas).map(s=>(
                  <div key={s.nombre}>
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

            {/* Nuevas por sucursal */}
            <div className="glass" style={{padding:"22px"}}>
              <div style={{fontSize:"11px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"20px"}}>NUEVAS CLIENTAS POR SUCURSAL</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"12px"}}>
                {porSucursal.map(s=>(
                  <div key={s.nombre} style={{textAlign:"center",padding:"20px",background:"rgba(0,0,0,0.3)",borderRadius:"12px",border:`1px solid ${COLORES[s.nombre]}33`}}>
                    <div style={{fontSize:"36px",fontWeight:700,color:COLORES[s.nombre]}}>{s.nuevas}</div>
                    <div style={{fontSize:"11px",color:"rgba(255,255,255,0.3)",marginTop:"4px",letterSpacing:"1px"}}>{s.nombre.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SERVICIOS ── */}
        {tab === "servicios" && (
          <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
            <div className="glass" style={{padding:"22px"}}>
              <div style={{fontSize:"11px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"20px"}}>SERVICIOS MÁS VENDIDOS · {mesLabel()}</div>
              {topSvcs.length === 0
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
                      <div style={{width:`${Math.round((count/maxSvc)*100)}%`,height:"100%",background: i===0?"#2721E8":i===1?"#49B8D3":"rgba(39,33,232,0.5)",borderRadius:"3px"}}/>
                    </div>
                  </div>
                ))}
            </div>

            {/* Métodos de pago */}
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
        {tab === "meta" && (
          <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>

            {/* Input datos Meta */}
            <div className="glass" style={{padding:"24px"}}>
              <div style={{fontSize:"11px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"4px"}}>DATOS DE CAMPAÑA</div>
              <div style={{fontSize:"18px",fontWeight:600,marginBottom:"20px"}}>Inversión en Meta Ads · {mesLabel()}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:"12px",alignItems:"flex-end"}}>
                <div>
                  <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)",marginBottom:"6px",letterSpacing:"1px"}}>INVERSIÓN TOTAL ($MXN)</div>
                  <input className="inp-dark" type="number" placeholder="ej. 15000" value={inversion} onChange={e=>setInversion(e.target.value)}/>
                </div>
                <div>
                  <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)",marginBottom:"6px",letterSpacing:"1px"}}>MENSAJES RECIBIDOS</div>
                  <input className="inp-dark" type="number" placeholder="ej. 240" value={mensajes} onChange={e=>setMensajes(e.target.value)}/>
                </div>
                <button className="btn-save" onClick={()=>{ setSavedMeta({inversion:Number(inversion),mensajes:Number(mensajes)}); }}>
                  Guardar
                </button>
              </div>
              <div style={{marginTop:"12px",fontSize:"12px",color:"rgba(255,255,255,0.25)"}}>
                💡 Actualiza estos datos semanalmente desde tu Meta Business Manager para mantener el dashboard al día.
              </div>
            </div>

            {/* Métricas ROI */}
            {savedMeta.inversion > 0 ? (
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"14px"}}>
                {[
                  { label:"INVERSIÓN META ADS", value:fmt(savedMeta.inversion), sub:"este mes", color:"#f97316", desc:"Total gastado en campañas" },
                  { label:"COSTO POR CLIENTA NUEVA", value:fmt(cpa), sub:`${nuevasMes} clientas captadas`, color:"#a855f7", desc:"Cuánto te cuesta cada clienta nueva" },
                  { label:"ROAS", value:`${roas.toFixed(2)}x`, sub:`retorno sobre inversión`, color:"#10b981", desc: roas >= 3 ? "✓ Excelente — por encima de 3x" : roas >= 2 ? "✓ Bueno — entre 2x y 3x" : "⚠ Mejorable — menos de 2x" },
                ].map(k=>(
                  <div key={k.label} className="glass-dark" style={{padding:"22px",borderLeft:`3px solid ${k.color}`}}>
                    <div style={{fontSize:"10px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"8px"}}>{k.label}</div>
                    <div style={{fontSize:"32px",fontWeight:700,color:k.color,lineHeight:1}}>{k.value}</div>
                    <div style={{fontSize:"12px",color:"rgba(255,255,255,0.4)",marginTop:"6px"}}>{k.sub}</div>
                    <div style={{fontSize:"11px",color:"rgba(255,255,255,0.25)",marginTop:"8px",borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:"8px"}}>{k.desc}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass" style={{padding:"32px",textAlign:"center",color:"rgba(255,255,255,0.3)"}}>
                Ingresa tu inversión en Meta Ads arriba para ver el ROI
              </div>
            )}

            {/* Conversión */}
            {savedMeta.mensajes > 0 && (
              <div className="glass" style={{padding:"24px"}}>
                <div style={{fontSize:"11px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"16px"}}>EMBUDO DE CONVERSIÓN</div>
                <div style={{display:"flex",alignItems:"center",gap:"0"}}>
                  {[
                    { label:"Mensajes recibidos", value:fmtN(savedMeta.mensajes), color:"#2721E8", w:"100%" },
                    { label:"Clientas nuevas", value:fmtN(nuevasMes), color:"#49B8D3", w:`${Math.min((nuevasMes/savedMeta.mensajes)*100,100).toFixed(0)}%` },
                  ].map((e,i)=>(
                    <div key={e.label} style={{flex:1,padding:"20px",background:`${e.color}15`,border:`1px solid ${e.color}44`,borderRadius: i===0?"12px 0 0 12px":"0 12px 12px 0",borderLeft: i===1?"none":"",textAlign:"center"}}>
                      <div style={{fontSize:"28px",fontWeight:700,color:e.color}}>{e.value}</div>
                      <div style={{fontSize:"12px",color:"rgba(255,255,255,0.4)",marginTop:"4px"}}>{e.label}</div>
                    </div>
                  ))}
                  <div style={{padding:"0 24px",textAlign:"center"}}>
                    <div style={{fontSize:"32px",fontWeight:700,color: parseFloat(convPct)>10?"#10b981":"#f97316"}}>{convPct}%</div>
                    <div style={{fontSize:"11px",color:"rgba(255,255,255,0.3)",marginTop:"2px"}}>conversión</div>
                  </div>
                </div>
                <div style={{marginTop:"14px",fontSize:"12px",color:"rgba(255,255,255,0.25)",padding:"12px",background:"rgba(0,0,0,0.2)",borderRadius:"8px"}}>
                  💡 Promedio saludable para clínicas de belleza: entre 10% y 20% de conversión mensajes → ventas.
                  {parseFloat(convPct) < 10 && " Tu tasa está por debajo — revisa el seguimiento de WhatsApp."}
                  {parseFloat(convPct) >= 10 && parseFloat(convPct) < 20 && " Tu tasa está en rango saludable."}
                  {parseFloat(convPct) >= 20 && " ¡Excelente tasa de conversión!"}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
