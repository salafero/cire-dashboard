import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── AGENDA COMPONENT ─────────────────────────────────────────────────────────
const TIPOS_SERVICIO = [
  { id:"laser",       label:"Láser",           duracion:60,  color:"#2721E8" },
  { id:"facial_baby", label:"Baby Clean",       duracion:60,  color:"#49B8D3" },
  { id:"facial_full", label:"FullFace",         duracion:90,  color:"#49B8D3" },
  { id:"corporal",    label:"Corporal/Moldeo",  duracion:60,  color:"#a855f7" },
  { id:"hifu",        label:"HIFU 4D",          duracion:90,  color:"#f97316" },
  { id:"post_op",     label:"Post operatorio",  duracion:60,  color:"#10b981" },
];
const HORARIOS = { 1:{abre:"10:00",cierra:"20:00"},2:{abre:"10:00",cierra:"20:00"},3:{abre:"10:00",cierra:"20:00"},4:{abre:"10:00",cierra:"20:00"},5:{abre:"10:00",cierra:"20:00"},6:{abre:"09:00",cierra:"16:00"},0:null };
const DIAS_LABEL = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function generarBloques(fecha, duracionMin) {
  const dia = new Date(fecha+"T12:00:00").getDay();
  const horario = HORARIOS[dia];
  if (!horario) return [];
  const bloques = [];
  const [hA,mA] = horario.abre.split(":").map(Number);
  const [hC,mC] = horario.cierra.split(":").map(Number);
  let mins = hA*60+mA;
  const fin = hC*60+mC;
  while (mins+duracionMin<=fin) {
    const h=Math.floor(mins/60),m=mins%60;
    const hf=Math.floor((mins+duracionMin)/60),mf=(mins+duracionMin)%60;
    bloques.push({ inicio:`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`, fin:`${String(hf).padStart(2,"0")}:${String(mf).padStart(2,"0")}` });
    mins+=30;
  }
  return bloques;
}
function semanaDesde(fecha) {
  const base=new Date(fecha+"T12:00:00"),dow=base.getDay();
  const lunes=new Date(base);
  lunes.setDate(base.getDate()-(dow===0?6:dow-1));
  return Array.from({length:6},(_,i)=>{ const d=new Date(lunes); d.setDate(lunes.getDate()+i); return d.toISOString().slice(0,10); });
}
const hoy=()=>new Date().toISOString().slice(0,10);
const labelFecha=(f)=>new Date(f+"T12:00:00").toLocaleDateString("es-MX",{weekday:"short",day:"numeric",month:"short"});
const colorTipo=(tipo)=>TIPOS_SERVICIO.find(t=>t.id===tipo)?.color||"#2721E8";

function Agenda({ session }) {
  const [semana,setSemana]=useState(semanaDesde(hoy()));
  const [citas,setCitas]=useState([]);
  const [modal,setModal]=useState(false);
  const [detalle,setDetalle]=useState(null);
  const [busqueda,setBusqueda]=useState("");
  const [clientasEncontradas,setClientasEncontradas]=useState([]);
  const [clientaSel,setClientaSel]=useState(null);
  const [paquetesSel,setPaquetesSel]=useState([]);
  const [paqueteElegido,setPaqueteElegido]=useState(null);
  const [tipoSvc,setTipoSvc]=useState(null);
  const [fechaCita,setFechaCita]=useState(hoy());
  const [bloqueSel,setBloqueSel]=useState(null);
  const [bloques,setBloques]=useState([]);
  const [notas,setNotas]=useState("");
  const [esNueva,setEsNueva]=useState(true);
  const [nombreNueva,setNombreNueva]=useState("");
  const [telefonoNueva,setTelefonoNueva]=useState("");
  const [saving,setSaving]=useState(false);
  const [paso,setPaso]=useState(1);

  const cargarCitas=async()=>{
    const {data}=await supabase.from("citas").select("*").eq("sucursal_id",session.id).gte("fecha",semana[0]).lte("fecha",semana[semana.length-1]).order("hora_inicio");
    if(data) setCitas(data);
  };
  useEffect(()=>{cargarCitas();},[semana,session]);
  useEffect(()=>{ if(tipoSvc&&fechaCita){setBloques(generarBloques(fechaCita,tipoSvc.duracion));setBloqueSel(null);} },[tipoSvc,fechaCita]);

  const buscarClientas=async(q)=>{
    if(q.length<2){setClientasEncontradas([]);return;}
    const {data}=await supabase.from("clientas").select("*").ilike("nombre",`%${q}%`).eq("sucursal_id",session.id).limit(5);
    setClientasEncontradas(data||[]);
  };
  const seleccionarClientaExistente=async(c)=>{
    setClientaSel(c);setClientasEncontradas([]);setBusqueda(c.nombre);setEsNueva(false);
    const {data}=await supabase.from("paquetes").select("*").eq("clienta_id",c.id).eq("activo",true);
    setPaquetesSel(data||[]);setPaqueteElegido(null);
  };
  const seleccionarPaquete=(p)=>{
    setPaqueteElegido(p);
    const n=p.servicio.toLowerCase();
    let t=TIPOS_SERVICIO[0];
    if(n.includes("baby")) t=TIPOS_SERVICIO[1];
    else if(n.includes("fullface")||n.includes("facial")) t=TIPOS_SERVICIO[2];
    else if(n.includes("hifu")) t=TIPOS_SERVICIO[4];
    else if(n.includes("post")) t=TIPOS_SERVICIO[5];
    else if(n.includes("moldeo")||n.includes("corporal")||n.includes("anticel")) t=TIPOS_SERVICIO[3];
    setTipoSvc(t);
  };
  const esBloqueOcupado=(b)=>citas.filter(c=>c.fecha===fechaCita).some(c=>(b.inicio>=c.hora_inicio&&b.inicio<c.hora_fin)||(b.fin>c.hora_inicio&&b.fin<=c.hora_fin));

  const guardarCita=async()=>{
    if(!bloqueSel) return;
    setSaving(true);
    try {
      let clientaId=clientaSel?.id,clientaNombre=clientaSel?.nombre;
      if(esNueva&&!clientaSel){
        const {data:newC}=await supabase.from("clientas").insert([{nombre:nombreNueva,telefono:telefonoNueva,sucursal_id:session.id,sucursal_nombre:session.nombre}]).select();
        clientaId=newC[0].id;clientaNombre=newC[0].nombre;
      }
      const sesionNum=paqueteElegido?paqueteElegido.sesiones_usadas+1:1;
      const esCobro=!paqueteElegido||paqueteElegido.sesiones_usadas===0;
      await supabase.from("citas").insert([{clienta_id:clientaId,clienta_nombre:clientaNombre,paquete_id:paqueteElegido?.id||null,sucursal_id:session.id,sucursal_nombre:session.nombre,servicio:paqueteElegido?.servicio||tipoSvc.label,tipo_servicio:tipoSvc.id,duracion_min:tipoSvc.duracion,fecha:fechaCita,hora_inicio:bloqueSel.inicio,hora_fin:bloqueSel.fin,sesion_numero:sesionNum,es_cobro:esCobro,estado:"agendada",notas}]);
      if(paqueteElegido){
        const ns=paqueteElegido.sesiones_usadas+1;
        await supabase.from("paquetes").update({sesiones_usadas:ns,activo:ns<paqueteElegido.total_sesiones}).eq("id",paqueteElegido.id);
      }
      resetModal();cargarCitas();
    } catch(e){console.error(e);}
    setSaving(false);
  };

  const marcarCompletada=async(id)=>{await supabase.from("citas").update({estado:"completada"}).eq("id",id);cargarCitas();};
  const cancelarCita=async(id,paqId,sesUsadas)=>{
    await supabase.from("citas").update({estado:"cancelada"}).eq("id",id);
    if(paqId) await supabase.from("paquetes").update({sesiones_usadas:Math.max(0,sesUsadas-1),activo:true}).eq("id",paqId);
    setDetalle(null);cargarCitas();
  };
  const resetModal=()=>{setModal(false);setPaso(1);setBusqueda("");setClientaSel(null);setClientasEncontradas([]);setPaquetesSel([]);setPaqueteElegido(null);setTipoSvc(null);setFechaCita(hoy());setBloqueSel(null);setBloques([]);setNotas("");setEsNueva(true);setNombreNueva("");setTelefonoNueva("");};
  const semanaAnterior=()=>{const d=new Date(semana[0]+"T12:00:00");d.setDate(d.getDate()-7);setSemana(semanaDesde(d.toISOString().slice(0,10)));};
  const semanaSiguiente=()=>{const d=new Date(semana[0]+"T12:00:00");d.setDate(d.getDate()+7);setSemana(semanaDesde(d.toISOString().slice(0,10)));};
  const citasDelDia=(fecha)=>citas.filter(c=>c.fecha===fecha).sort((a,b)=>a.hora_inicio.localeCompare(b.hora_inicio));

  return (
    <div style={{padding:"20px 24px",overflowY:"auto",height:"calc(100vh - 64px)"}}>
      <style>{`
        .bloque-btn{padding:8px 6px;border-radius:8px;font-size:11px;font-weight:500;cursor:pointer;border:1px solid;transition:all 0.15s;text-align:center;}
        .cita-card{border-radius:8px;padding:8px 10px;margin-bottom:4px;cursor:pointer;transition:opacity 0.15s;border-left:3px solid;}
        .cita-card:hover{opacity:0.8;}
        .clienta-sugg{padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.15s;}
        .clienta-sugg:hover{background:rgba(39,33,232,0.2);}
        .paq-card{padding:12px;border-radius:10px;border:1px solid;cursor:pointer;transition:all 0.15s;margin-bottom:8px;}
        .paq-card:hover{border-color:#2721E8;}
        .tipo-btn{padding:10px 14px;border-radius:10px;border:1px solid;cursor:pointer;transition:all 0.15s;text-align:center;}
        .paso-ind{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;}
      `}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px"}}>
        <div>
          <div style={{fontSize:"11px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"2px"}}>AGENDA SEMANAL</div>
          <div style={{fontSize:"16px",fontWeight:600}}>{session.nombre}</div>
        </div>
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          <button className="btn-ghost" onClick={semanaAnterior}>← Anterior</button>
          <div style={{fontSize:"12px",color:"rgba(255,255,255,0.4)",padding:"0 6px"}}>{labelFecha(semana[0])} — {labelFecha(semana[5])}</div>
          <button className="btn-ghost" onClick={semanaSiguiente}>Siguiente →</button>
          <button className="btn-blue" onClick={()=>setModal(true)}>+ Nueva cita</button>
        </div>
      </div>

      {/* Leyenda */}
      <div style={{display:"flex",gap:"12px",marginBottom:"14px",flexWrap:"wrap"}}>
        {TIPOS_SERVICIO.map(t=>(
          <div key={t.id} style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"10px",color:"rgba(255,255,255,0.35)"}}>
            <div style={{width:"8px",height:"8px",borderRadius:"2px",background:t.color}}/>{t.label}
          </div>
        ))}
        <div style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"10px",color:"rgba(255,255,255,0.35)"}}>
          <div style={{width:"8px",height:"8px",borderRadius:"2px",background:"#f0c040"}}/>💰 Con cobro
        </div>
      </div>

      {/* Calendario */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"8px"}}>
        {semana.map(fecha=>{
          const dow=new Date(fecha+"T12:00:00").getDay();
          const abierto=HORARIOS[dow]!==null;
          const esFecha=fecha===hoy();
          const citasDia=citasDelDia(fecha);
          return (
            <div key={fecha} className="glass" style={{padding:"10px",minHeight:"200px",opacity:abierto?1:0.35,borderColor:esFecha?"rgba(39,33,232,0.6)":"rgba(255,255,255,0.08)"}}>
              <div style={{marginBottom:"8px"}}>
                <div style={{fontSize:"9px",color:"rgba(255,255,255,0.3)",letterSpacing:"1px"}}>{DIAS_LABEL[dow]}</div>
                <div style={{fontSize:"15px",fontWeight:700,color:esFecha?"#49B8D3":"#fff"}}>{fecha.slice(8)}</div>
                {!abierto&&<div style={{fontSize:"9px",color:"rgba(255,80,80,0.5)"}}>Cerrado</div>}
                {abierto&&<div style={{fontSize:"8px",color:"rgba(255,255,255,0.2)"}}>{HORARIOS[dow].abre}–{HORARIOS[dow].cierra}</div>}
              </div>
              {citasDia.length===0&&abierto&&<div style={{fontSize:"10px",color:"rgba(255,255,255,0.12)",textAlign:"center",paddingTop:"16px"}}>Sin citas</div>}
              {citasDia.map(c=>(
                <div key={c.id} className="cita-card"
                  style={{background:`${colorTipo(c.tipo_servicio)}15`,borderLeftColor:c.es_cobro?"#f0c040":colorTipo(c.tipo_servicio),opacity:c.estado==="cancelada"?0.35:1}}
                  onClick={()=>setDetalle(c)}>
                  <div style={{fontSize:"9px",color:"rgba(255,255,255,0.35)"}}>{c.hora_inicio}–{c.hora_fin}</div>
                  <div style={{fontSize:"11px",fontWeight:600,lineHeight:1.2,marginTop:"1px"}}>{c.clienta_nombre}</div>
                  <div style={{fontSize:"9px",color:colorTipo(c.tipo_servicio),marginTop:"1px"}}>{c.servicio}</div>
                  <div style={{display:"flex",gap:"3px",marginTop:"3px",flexWrap:"wrap"}}>
                    {c.es_cobro&&<span style={{fontSize:"8px",background:"rgba(240,192,64,0.2)",color:"#f0c040",padding:"1px 4px",borderRadius:"3px"}}>💰</span>}
                    <span style={{fontSize:"8px",background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.35)",padding:"1px 4px",borderRadius:"3px"}}>S{c.sesion_numero}</span>
                    {c.estado==="completada"&&<span style={{fontSize:"8px",background:"rgba(16,185,129,0.2)",color:"#10b981",padding:"1px 4px",borderRadius:"3px"}}>✓</span>}
                    {c.estado==="cancelada"&&<span style={{fontSize:"8px",background:"rgba(255,80,80,0.2)",color:"#ff6b6b",padding:"1px 4px",borderRadius:"3px"}}>✗</span>}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Modal detalle */}
      {detalle&&(
        <div className="overlay" onClick={()=>setDetalle(null)}>
          <div className="glass" style={{width:360,padding:"26px",borderColor:`${colorTipo(detalle.tipo_servicio)}44`}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"18px"}}>
              <div>
                <div style={{fontSize:"10px",letterSpacing:"2px",color:"rgba(255,255,255,0.3)",marginBottom:"3px"}}>CITA</div>
                <div style={{fontSize:"17px",fontWeight:700}}>{detalle.clienta_nombre}</div>
              </div>
              <button onClick={()=>setDetalle(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:"20px"}}>×</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"9px",background:"rgba(0,0,0,0.3)",borderRadius:"10px",padding:"13px",marginBottom:"16px"}}>
              {[["Servicio",detalle.servicio],["Fecha",new Date(detalle.fecha+"T12:00:00").toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"})],["Horario",`${detalle.hora_inicio} – ${detalle.hora_fin}`],["Sesión",`${detalle.sesion_numero} de 8`]].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:"13px"}}>
                  <span style={{color:"rgba(255,255,255,0.4)"}}>{l}</span><span style={{fontWeight:500}}>{v}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:"13px"}}>
                <span style={{color:"rgba(255,255,255,0.4)"}}>Tipo</span>
                <span style={{background:detalle.es_cobro?"rgba(240,192,64,0.2)":"rgba(16,185,129,0.15)",color:detalle.es_cobro?"#f0c040":"#10b981",padding:"2px 10px",borderRadius:"6px",fontSize:"11px",fontWeight:600}}>
                  {detalle.es_cobro?"💰 Con cobro":"✓ Seguimiento"}
                </span>
              </div>
              {detalle.notas&&<div style={{fontSize:"11px",color:"rgba(255,255,255,0.3)",borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:"8px"}}>{detalle.notas}</div>}
            </div>
            {detalle.estado==="agendada"&&(
              <div style={{display:"flex",gap:"8px"}}>
                <button className="btn-ghost" style={{flex:1,color:"#ff6b6b",borderColor:"rgba(255,80,80,0.3)"}} onClick={()=>cancelarCita(detalle.id,detalle.paquete_id,detalle.sesion_numero)}>Cancelar</button>
                <button className="btn-blue" style={{flex:2}} onClick={()=>{marcarCompletada(detalle.id);setDetalle(null);}}>✓ Completada</button>
              </div>
            )}
            {detalle.estado!=="agendada"&&<div style={{textAlign:"center",fontSize:"13px",color:"rgba(255,255,255,0.3)"}}>Cita {detalle.estado}</div>}
          </div>
        </div>
      )}

      {/* Modal nueva cita */}
      {modal&&(
        <div className="overlay">
          <div className="glass" style={{width:500,maxHeight:"88vh",overflow:"auto",padding:"26px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"22px"}}>
              {[{n:1,l:"Clienta"},{n:2,l:"Servicio"},{n:3,l:"Horario"}].map((p,i)=>(
                <div key={p.n} style={{display:"flex",alignItems:"center",gap:"8px",flex:i<2?1:"auto"}}>
                  <div className="paso-ind" style={{background:paso>=p.n?"#2721E8":"rgba(255,255,255,0.06)",color:paso>=p.n?"#fff":"rgba(255,255,255,0.3)",flexShrink:0}}>{p.n}</div>
                  <div style={{fontSize:"12px",color:paso===p.n?"#fff":"rgba(255,255,255,0.3)",fontWeight:paso===p.n?600:400}}>{p.l}</div>
                  {i<2&&<div style={{flex:1,height:"1px",background:"rgba(255,255,255,0.06)"}}/>}
                </div>
              ))}
              <button onClick={resetModal} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:"20px",marginLeft:"auto"}}>×</button>
            </div>

            {/* Paso 1 */}
            {paso===1&&(
              <div>
                <div style={{fontSize:"14px",fontWeight:600,marginBottom:"14px"}}>¿Quién viene?</div>
                <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
                  <button className="btn-ghost" style={{flex:1,borderColor:!esNueva?"#2721E8":"rgba(255,255,255,0.1)",color:!esNueva?"#fff":"rgba(255,255,255,0.4)"}} onClick={()=>setEsNueva(false)}>Clienta existente</button>
                  <button className="btn-ghost" style={{flex:1,borderColor:esNueva?"#2721E8":"rgba(255,255,255,0.1)",color:esNueva?"#fff":"rgba(255,255,255,0.4)"}} onClick={()=>{setEsNueva(true);setClientaSel(null);setBusqueda("");}}>Nueva clienta</button>
                </div>
                {!esNueva?(
                  <div style={{position:"relative"}}>
                    <input className="inp" placeholder="Buscar por nombre..." value={busqueda} onChange={e=>{setBusqueda(e.target.value);buscarClientas(e.target.value);setClientaSel(null);}}/>
                    {clientasEncontradas.length>0&&(
                      <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#1a1b2e",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"10px",zIndex:10,overflow:"hidden",marginTop:"4px"}}>
                        {clientasEncontradas.map(c=>(
                          <div key={c.id} className="clienta-sugg" onClick={()=>seleccionarClientaExistente(c)}>
                            <div style={{fontSize:"13px",fontWeight:500}}>{c.nombre}</div>
                            <div style={{fontSize:"11px",color:"rgba(255,255,255,0.3)"}}>{c.telefono}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {clientaSel&&(
                      <div style={{marginTop:"10px",padding:"12px",background:"rgba(39,33,232,0.08)",border:"1px solid rgba(39,33,232,0.25)",borderRadius:"10px"}}>
                        <div style={{fontSize:"13px",fontWeight:600,marginBottom:"8px"}}>✓ {clientaSel.nombre}</div>
                        {paquetesSel.length>0?(
                          <div>
                            <div style={{fontSize:"10px",color:"rgba(255,255,255,0.4)",marginBottom:"8px",letterSpacing:"1px"}}>PAQUETES ACTIVOS</div>
                            {paquetesSel.map(p=>(
                              <div key={p.id} className="paq-card"
                                style={{borderColor:paqueteElegido?.id===p.id?"#49B8D3":"rgba(255,255,255,0.08)",background:paqueteElegido?.id===p.id?"rgba(73,184,211,0.08)":"rgba(0,0,0,0.2)"}}
                                onClick={()=>seleccionarPaquete(p)}>
                                <div style={{fontSize:"12px",fontWeight:600}}>{p.servicio}</div>
                                <div style={{fontSize:"10px",color:"rgba(255,255,255,0.4)",marginTop:"2px"}}>Sesión {p.sesiones_usadas+1} de {p.total_sesiones}</div>
                                <div style={{margin:"6px 0 3px",height:"3px",background:"rgba(255,255,255,0.06)",borderRadius:"2px"}}>
                                  <div style={{width:`${(p.sesiones_usadas/p.total_sesiones)*100}%`,height:"100%",background:"#49B8D3",borderRadius:"2px"}}/>
                                </div>
                                {paqueteElegido?.id===p.id&&<div style={{fontSize:"10px",color:p.sesiones_usadas===0?"#f0c040":"#10b981",fontWeight:600,marginTop:"4px"}}>
                                  {p.sesiones_usadas===0?"💰 Primera sesión — se cobra":"✓ Seguimiento — ya pagó"}
                                </div>}
                              </div>
                            ))}
                          </div>
                        ):(
                          <div style={{fontSize:"11px",color:"#f0c040"}}>⚠ Sin paquetes activos — se registra como nueva compra</div>
                        )}
                      </div>
                    )}
                  </div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:"9px"}}>
                    <input className="inp" placeholder="Nombre completo *" value={nombreNueva} onChange={e=>setNombreNueva(e.target.value)}/>
                    <input className="inp" placeholder="Teléfono (opcional)" value={telefonoNueva} onChange={e=>setTelefonoNueva(e.target.value)}/>
                    <div style={{fontSize:"11px",color:"#f0c040",padding:"10px",background:"rgba(240,192,64,0.06)",borderRadius:"8px",border:"1px solid rgba(240,192,64,0.15)"}}>
                      💰 Nueva clienta — cerrar ticket en POS al terminar la cita
                    </div>
                  </div>
                )}
                <button className="btn-blue" style={{width:"100%",marginTop:"18px",padding:"12px"}} disabled={esNueva?!nombreNueva:!clientaSel} onClick={()=>setPaso(2)}>Continuar →</button>
              </div>
            )}

            {/* Paso 2 */}
            {paso===2&&(
              <div>
                <div style={{fontSize:"14px",fontWeight:600,marginBottom:"4px"}}>Tipo de servicio</div>
                <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)",marginBottom:"14px"}}>{paqueteElegido?`Paquete: ${paqueteElegido.servicio}`:"Nueva clienta"}</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px",marginBottom:"16px"}}>
                  {TIPOS_SERVICIO.map(t=>(
                    <div key={t.id} className="tipo-btn"
                      style={{borderColor:tipoSvc?.id===t.id?t.color:"rgba(255,255,255,0.08)",background:tipoSvc?.id===t.id?`${t.color}15`:"rgba(0,0,0,0.2)"}}
                      onClick={()=>setTipoSvc(t)}>
                      <div style={{fontSize:"13px",fontWeight:600,color:tipoSvc?.id===t.id?t.color:"#fff"}}>{t.label}</div>
                      <div style={{fontSize:"10px",color:"rgba(255,255,255,0.3)",marginTop:"2px"}}>{t.duracion} min</div>
                    </div>
                  ))}
                </div>
                <textarea className="inp" rows={2} placeholder="Notas (zona específica, alergias...)" value={notas} onChange={e=>setNotas(e.target.value)} style={{resize:"none",marginBottom:"14px"}}/>
                <div style={{display:"flex",gap:"8px"}}>
                  <button className="btn-ghost" style={{flex:1}} onClick={()=>setPaso(1)}>← Atrás</button>
                  <button className="btn-blue" style={{flex:2,padding:"12px"}} disabled={!tipoSvc} onClick={()=>setPaso(3)}>Continuar →</button>
                </div>
              </div>
            )}

            {/* Paso 3 */}
            {paso===3&&(
              <div>
                <div style={{fontSize:"14px",fontWeight:600,marginBottom:"14px"}}>Fecha y hora</div>
                <input type="date" className="inp" value={fechaCita} min={hoy()} onChange={e=>setFechaCita(e.target.value)} style={{colorScheme:"dark",marginBottom:"14px"}}/>
                {new Date(fechaCita+"T12:00:00").getDay()===0&&<div style={{fontSize:"12px",color:"#ff6b6b",marginBottom:"10px"}}>⚠ Domingo — sucursal cerrada</div>}
                {bloques.length>0&&(
                  <div>
                    <div style={{fontSize:"10px",color:"rgba(255,255,255,0.3)",marginBottom:"8px",letterSpacing:"1px"}}>HORARIOS · {tipoSvc?.duracion} min</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"6px",maxHeight:"190px",overflowY:"auto",paddingRight:"4px",marginBottom:"14px"}}>
                      {bloques.map(b=>{
                        const ocupado=esBloqueOcupado(b);
                        const selec=bloqueSel?.inicio===b.inicio;
                        return (
                          <div key={b.inicio} className="bloque-btn"
                            style={{borderColor:ocupado?"rgba(255,80,80,0.25)":selec?"#2721E8":"rgba(255,255,255,0.08)",background:ocupado?"rgba(255,80,80,0.04)":selec?"rgba(39,33,232,0.2)":"rgba(0,0,0,0.2)",color:ocupado?"rgba(255,80,80,0.4)":selec?"#fff":"rgba(255,255,255,0.5)",cursor:ocupado?"not-allowed":"pointer"}}
                            onClick={()=>!ocupado&&setBloqueSel(b)}>
                            <div style={{fontSize:"12px",fontWeight:selec?700:400}}>{b.inicio}</div>
                            {ocupado&&<div style={{fontSize:"8px",marginTop:"1px",color:"rgba(255,80,80,0.4)"}}>Ocupado</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {bloqueSel&&(
                  <div style={{padding:"12px",background:"rgba(39,33,232,0.1)",border:"1px solid rgba(39,33,232,0.3)",borderRadius:"10px",marginBottom:"14px"}}>
                    <div style={{fontSize:"13px",fontWeight:600}}>{new Date(fechaCita+"T12:00:00").toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"})}</div>
                    <div style={{fontSize:"16px",fontWeight:700,color:"#49B8D3",marginTop:"2px"}}>{bloqueSel.inicio} – {bloqueSel.fin}</div>
                    <div style={{fontSize:"11px",marginTop:"6px",fontWeight:600,color:(!paqueteElegido||paqueteElegido.sesiones_usadas===0)?"#f0c040":"#10b981"}}>
                      {(!paqueteElegido||paqueteElegido.sesiones_usadas===0)?"💰 Se cobrará — cerrar ticket en POS":"✓ Seguimiento — no se cobra"}
                    </div>
                  </div>
                )}
                <div style={{display:"flex",gap:"8px"}}>
                  <button className="btn-ghost" style={{flex:1}} onClick={()=>setPaso(2)}>← Atrás</button>
                  <button className="btn-blue" style={{flex:2,padding:"12px"}} disabled={!bloqueSel||saving} onClick={guardarCita}>
                    {saving?"Guardando...":"✓ Confirmar cita"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── SUCURSALES ───────────────────────────────────────────────────────────────
const SUCURSALES = [
  { id: 1, nombre: "Coapa",    usuario: "coapa",    password: "cire2026", color: "#2721E8" },
  { id: 2, nombre: "Valle",    usuario: "valle",    password: "cire2026", color: "#49B8D3" },
  { id: 3, nombre: "Oriente",  usuario: "oriente",  password: "cire2026", color: "#2721E8" },
  { id: 4, nombre: "Polanco",  usuario: "polanco",  password: "cire2026", color: "#49B8D3" },
  { id: 5, nombre: "Metepec",  usuario: "metepec",  password: "cire2026", color: "#2721E8" },
];

// ─── CATÁLOGO REAL ────────────────────────────────────────────────────────────
const SERVICIOS = [
  // COMBOS
  { id: "c1",  nombre: "Full Body (8 ses.)",       precio: 10000, zona: "Combos", msi: 9  },
  { id: "c2",  nombre: "Combo Rostro (8 ses.)",    precio: 9000,  zona: "Combos", msi: 9  },
  { id: "c3",  nombre: "Combo Sexy (8 ses.)",      precio: 8000,  zona: "Combos", msi: 9  },
  { id: "c4",  nombre: "Combo Playa (8 ses.)",     precio: 6500,  zona: "Combos", msi: 6  },
  { id: "c5",  nombre: "Combo Piernas (8 ses.)",   precio: 6500,  zona: "Combos", msi: 6  },
  { id: "c6",  nombre: "Combo Bikini (8 ses.)",    precio: 5500,  zona: "Combos", msi: 6  },
  { id: "c7",  nombre: "Combo Axilas (8 ses.)",    precio: 5500,  zona: "Combos", msi: 6  },
  // ZONAS INDIVIDUALES (8 sesiones)
  { id: "z1",  nombre: "Rostro completo (8 ses.)", precio: 2500,  zona: "Rostro", msi: 3  },
  { id: "z2",  nombre: "Medio rostro (8 ses.)",    precio: 2000,  zona: "Rostro", msi: 3  },
  { id: "z3",  nombre: "Bigote/Mentón/Patillas",   precio: 1000,  zona: "Rostro", msi: 3  },
  { id: "z4",  nombre: "Axilas (8 ses.)",          precio: 1500,  zona: "Superior", msi: 3 },
  { id: "z5",  nombre: "Brazos completos (8 ses.)",precio: 3500,  zona: "Superior", msi: 3 },
  { id: "z6",  nombre: "Medios brazos (8 ses.)",   precio: 2500,  zona: "Superior", msi: 3 },
  { id: "z7",  nombre: "Pecho (8 ses.)",           precio: 2500,  zona: "Superior", msi: 3 },
  { id: "z8",  nombre: "Abdomen (8 ses.)",         precio: 2500,  zona: "Superior", msi: 3 },
  { id: "z9",  nombre: "Línea abdomen (8 ses.)",   precio: 1500,  zona: "Superior", msi: 3 },
  { id: "z10", nombre: "Espalda completa (8 ses.)",precio: 4000,  zona: "Superior", msi: 3 },
  { id: "z11", nombre: "Media espalda (8 ses.)",   precio: 2500,  zona: "Superior", msi: 3 },
  { id: "z12", nombre: "Glúteos (8 ses.)",         precio: 2500,  zona: "Inferior", msi: 3 },
  { id: "z13", nombre: "Zona interglútea (8 ses.)",precio: 1500,  zona: "Inferior", msi: 3 },
  { id: "z14", nombre: "Piernas completas (8 ses.)",precio: 3500, zona: "Inferior", msi: 3 },
  { id: "z15", nombre: "Medias piernas (8 ses.)",  precio: 2500,  zona: "Inferior", msi: 3 },
  { id: "z16", nombre: "Bikini Brazilian (8 ses.)",precio: 3500,  zona: "Bikini",  msi: 3 },
  { id: "z17", nombre: "French Bikini (8 ses.)",   precio: 3000,  zona: "Bikini",  msi: 3 },
  { id: "z18", nombre: "Sexy Bikini (8 ses.)",     precio: 2500,  zona: "Bikini",  msi: 3 },
  { id: "z19", nombre: "Bikini básico (8 ses.)",   precio: 2000,  zona: "Bikini",  msi: 3 },
  // FACIALES
  { id: "f1",  nombre: "Baby Clean (1 ses.)",      precio: 549,   zona: "Faciales", msi: 0 },
  { id: "f2",  nombre: "FullFace (1 ses.)",        precio: 849,   zona: "Faciales", msi: 0 },
  { id: "f3",  nombre: "5 ses. FullFace",          precio: 3500,  zona: "Faciales", msi: 3 },
  { id: "f4",  nombre: "10 ses. FullFace",         precio: 6000,  zona: "Faciales", msi: 3 },
  // CORPORALES
  { id: "b1",  nombre: "HIFU 4D (1 persona)",      precio: 3000,  zona: "Corporales", msi: 3 },
  { id: "b2",  nombre: "HIFU 4D (2 personas)",     precio: 5000,  zona: "Corporales", msi: 3 },
  { id: "b3",  nombre: "Moldeo corporal (1 ses.)", precio: 699,   zona: "Corporales", msi: 0 },
  { id: "b4",  nombre: "6 ses. moldeo",            precio: 3999,  zona: "Corporales", msi: 3 },
  { id: "b5",  nombre: "12 ses. moldeo + facial",  precio: 6999,  zona: "Corporales", msi: 3 },
  { id: "b6",  nombre: "Anticelulítico (1 ses.)",  precio: 699,   zona: "Corporales", msi: 0 },
  { id: "b7",  nombre: "Post operatorio (1 ses.)", precio: 999,   zona: "Corporales", msi: 3 },
  { id: "b8",  nombre: "10 ses. post operatorio",  precio: 9999,  zona: "Corporales", msi: 3 },
  { id: "b9",  nombre: "Aparatología 1 zona",      precio: 649,   zona: "Corporales", msi: 0 },
  { id: "b10", nombre: "Moldeo Brasileño (1 ses.)",precio: 699,   zona: "Corporales", msi: 0 },
];

const ZONAS   = ["Todos", "Combos", "Rostro", "Superior", "Inferior", "Bikini", "Faciales", "Corporales"];
const METODOS = ["Efectivo", "Tarjeta débito", "Tarjeta crédito", "Transferencia", "Código QR"];
const SESIONES = ["1ª sesión", "2ª sesión", "3ª sesión", "4ª sesión", "5ª sesión", "6ª sesión", "7ª sesión", "8ª sesión", "Sesión extra"];

const fmt = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(n);
const horaActual  = () => new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
const fechaActual = () => new Date().toISOString().slice(0, 10);

export default function CirePOS() {
  const [session, setSession]           = useState(null);
  const [loginUser, setLoginUser]       = useState("");
  const [loginPass, setLoginPass]       = useState("");
  const [loginErr, setLoginErr]         = useState("");
  const [view, setView]                 = useState("pos");
  const [zona, setZona]                 = useState("Todos");
  const [tickets, setTickets]           = useState([]);
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [clienta, setClienta]           = useState("");
  const [tipoClienta, setTipoClienta]   = useState("Nueva");
  const [selectedSvcs, setSelectedSvcs] = useState([]);
  const [metodo, setMetodo]             = useState("Tarjeta crédito");
  const [sesion, setSesion]             = useState("1ª sesión");
  const [descuento, setDescuento]       = useState(0);
  const [msiSel, setMsiSel]             = useState(0);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [lastTicket, setLastTicket]     = useState(null);

  const total        = selectedSvcs.reduce((s, id) => s + (SERVICIOS.find((x) => x.id === id)?.precio || 0), 0);
  const totalConDesc = total * (1 - descuento / 100);
  const maxMsi       = selectedSvcs.length > 0 ? Math.max(...selectedSvcs.map((id) => SERVICIOS.find((x) => x.id === id)?.msi || 0)) : 0;

  const cargarTickets = async (sucId) => {
    setLoading(true);
    const { data, error } = await supabase.from("tickets").select("*").eq("sucursal_id", sucId).eq("fecha", fechaActual()).order("created_at", { ascending: false });
    if (!error && data) setTickets(data);
    setLoading(false);
  };

  useEffect(() => { if (session) cargarTickets(session.id); }, [session]);

  const handleLogin = () => {
    const suc = SUCURSALES.find((s) => s.usuario === loginUser.trim().toLowerCase() && s.password === loginPass);
    if (suc) { setSession(suc); setLoginErr(""); }
    else setLoginErr("Usuario o contraseña incorrectos");
  };

  const logout = () => { setSession(null); setLoginUser(""); setLoginPass(""); setTickets([]); resetForm(); };

  const resetForm = () => {
    setClienta(""); setTipoClienta("Nueva"); setSelectedSvcs([]);
    setMetodo("Tarjeta crédito"); setSesion("1ª sesión"); setDescuento(0); setMsiSel(0);
    setShowConfirm(false);
  };

  const cerrarTicket = async () => {
    setSaving(true);
    const ticketNum = `T-${Date.now().toString().slice(-4)}`;
    const nuevoTicket = {
      ticket_num: ticketNum, sucursal_id: session.id, sucursal_nombre: session.nombre,
      clienta: clienta || "Sin nombre", tipo_clienta: tipoClienta,
      servicios: selectedSvcs.map((id) => SERVICIOS.find((s) => s.id === id)?.nombre),
      sesion, metodo_pago: msiSel > 0 ? `${metodo} ${msiSel} MSI` : metodo,
      subtotal: total, descuento, total: totalConDesc,
      fecha: fechaActual(), hora: horaActual(),
    };
    const { data, error } = await supabase.from("tickets").insert([nuevoTicket]).select();
    if (!error && data) { setLastTicket({ ...nuevoTicket }); setTickets((prev) => [data[0], ...prev]); }
    setSaving(false); setShowConfirm(false); resetForm();
    if (!error && data) setLastTicket({ ...nuevoTicket });
  };

  const toggleSvc = (id) => setSelectedSvcs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const filtrados  = zona === "Todos" ? SERVICIOS : SERVICIOS.filter((s) => s.zona === zona);
  const hoyVentas  = tickets.reduce((s, t) => s + Number(t.total), 0);
  const hoyNuevas  = tickets.filter((t) => t.tipo_clienta === "Nueva").length;

  // ─── LOGIN ────────────────────────────────────────────────────────────────
  if (!session) return (
    <div style={{ minHeight:"100vh", background:"#0C0D1A", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Albert Sans', sans-serif", position:"relative", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Albert+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .glow { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; }
        .glass { background:rgba(255,255,255,0.04); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.08); border-radius:20px; }
        .btn-primary { background:#2721E8; color:#fff; border:none; border-radius:12px; padding:14px 0; width:100%; font-family:'Albert Sans',sans-serif; font-size:15px; font-weight:600; cursor:pointer; transition:all 0.2s; }
        .btn-primary:hover { background:#3d38f0; transform:translateY(-1px); box-shadow:0 8px 30px #2721E844; }
        .input-field { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:13px 16px; color:#fff; font-family:'Albert Sans',sans-serif; font-size:14px; width:100%; outline:none; transition:border 0.2s; }
        .input-field:focus { border-color:#2721E8; }
        .input-field::placeholder { color:rgba(255,255,255,0.25); }
        .suc-pill { padding:6px 14px; border-radius:20px; font-size:12px; font-weight:500; border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.4); cursor:pointer; transition:all 0.15s; }
        .suc-pill:hover { border-color:#2721E8; color:#fff; }
      `}</style>
      <div className="glow" style={{ width:400, height:400, background:"#2721E8", opacity:0.15, top:"-100px", left:"-100px" }} />
      <div className="glow" style={{ width:300, height:300, background:"#49B8D3", opacity:0.1, bottom:"50px", right:"50px" }} />
      <div className="glass" style={{ width:420, padding:"48px 40px" }}>
        <div style={{ textAlign:"center", marginBottom:"36px" }}>
          <div style={{ fontSize:"11px", letterSpacing:"4px", color:"#49B8D3", marginBottom:"8px", fontWeight:500 }}>SISTEMA INTERNO</div>
          <div style={{ fontSize:"38px", fontWeight:700, color:"#fff", letterSpacing:"6px" }}>CIRE</div>
          <div style={{ fontSize:"13px", color:"rgba(255,255,255,0.35)", marginTop:"4px", fontWeight:300 }}>Punto de Venta · Recepción</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"14px", marginBottom:"24px" }}>
          <div>
            <div style={{ fontSize:"12px", color:"rgba(255,255,255,0.4)", marginBottom:"6px", letterSpacing:"1px" }}>SUCURSAL / USUARIO</div>
            <input className="input-field" placeholder="ej. coapa" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} onKeyDown={(e) => e.key==="Enter" && handleLogin()} />
          </div>
          <div>
            <div style={{ fontSize:"12px", color:"rgba(255,255,255,0.4)", marginBottom:"6px", letterSpacing:"1px" }}>CONTRASEÑA</div>
            <input className="input-field" type="password" placeholder="••••••••" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} onKeyDown={(e) => e.key==="Enter" && handleLogin()} />
          </div>
          {loginErr && <div style={{ color:"#ff6b6b", fontSize:"13px", textAlign:"center" }}>{loginErr}</div>}
        </div>
        <button className="btn-primary" onClick={handleLogin}>Iniciar sesión →</button>
        <div style={{ marginTop:"28px", borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:"20px" }}>
          <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.2)", marginBottom:"12px", letterSpacing:"1px", textAlign:"center" }}>ACCESOS DISPONIBLES</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", justifyContent:"center" }}>
            {SUCURSALES.map((s) => <div key={s.id} className="suc-pill" onClick={() => setLoginUser(s.usuario)}>{s.nombre}</div>)}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── APP ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#0C0D1A", fontFamily:"'Albert Sans', sans-serif", color:"#fff", display:"flex", flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Albert+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }
        .glass { background:rgba(255,255,255,0.04); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.08); border-radius:16px; }
        .glass-dark { background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.06); border-radius:12px; }
        .btn-blue { background:#2721E8; color:#fff; border:none; border-radius:10px; padding:11px 20px; font-family:'Albert Sans',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; }
        .btn-blue:hover { background:#3d38f0; }
        .btn-blue:disabled { background:rgba(39,33,232,0.3); cursor:default; }
        .btn-ghost { background:transparent; color:rgba(255,255,255,0.5); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:9px 16px; font-family:'Albert Sans',sans-serif; font-size:13px; cursor:pointer; transition:all 0.2s; }
        .btn-ghost:hover { border-color:#2721E8; color:#fff; }
        .btn-ghost.active { border-color:#2721E8; color:#2721E8; background:rgba(39,33,232,0.1); }
        .svc-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:14px; cursor:pointer; transition:all 0.18s; }
        .svc-card:hover { border-color:rgba(39,33,232,0.5); background:rgba(39,33,232,0.08); }
        .svc-card.selected { border-color:#2721E8; background:rgba(39,33,232,0.15); }
        .svc-card.combo { border-color:rgba(73,184,211,0.25); }
        .svc-card.combo.selected { border-color:#49B8D3; background:rgba(73,184,211,0.12); }
        .input-sm { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:10px 14px; color:#fff; font-family:'Albert Sans',sans-serif; font-size:13px; width:100%; outline:none; transition:border 0.2s; }
        .input-sm:focus { border-color:#2721E8; }
        .input-sm::placeholder { color:rgba(255,255,255,0.2); }
        .tipo-btn { flex:1; padding:9px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.18s; border:1px solid transparent; text-align:center; }
        .badge-nueva { background:rgba(39,33,232,0.2); color:#6b66ff; border:1px solid rgba(39,33,232,0.4); border-radius:6px; padding:2px 10px; font-size:11px; font-weight:600; }
        .badge-rec { background:rgba(73,184,211,0.15); color:#49B8D3; border:1px solid rgba(73,184,211,0.3); border-radius:6px; padding:2px 10px; font-size:11px; font-weight:600; }
        .nav-tab { padding:10px 20px; font-size:13px; font-weight:500; cursor:pointer; border-bottom:2px solid transparent; color:rgba(255,255,255,0.35); transition:all 0.18s; }
        .nav-tab.active { color:#fff; border-bottom-color:#2721E8; }
        .overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(6px); z-index:100; display:flex; align-items:center; justify-content:center; }
        .select-sm { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:10px 14px; color:#fff; font-family:'Albert Sans',sans-serif; font-size:13px; width:100%; outline:none; cursor:pointer; }
        select option { background:#161728; }
        .ticket-row { display:grid; grid-template-columns:80px 1fr 120px 130px 90px; gap:0; padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.04); transition:background 0.15s; }
        .ticket-row:hover { background:rgba(255,255,255,0.02); }
        .msi-btn { flex:1; text-align:center; padding:8px 4px; border-radius:8px; font-size:11px; font-weight:600; cursor:pointer; border:1px solid; transition:all 0.15s; }
      `}</style>

      {/* TOPBAR */}
      <div style={{ padding:"0 24px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"space-between", height:"64px", background:"rgba(0,0,0,0.3)", backdropFilter:"blur(20px)", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"20px" }}>
          <div style={{ fontSize:"22px", fontWeight:700, letterSpacing:"4px" }}>CIRE</div>
          <div style={{ width:"1px", height:"24px", background:"rgba(255,255,255,0.1)" }} />
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:session.color, boxShadow:`0 0 8px ${session.color}` }} />
            <span style={{ fontSize:"14px", fontWeight:500 }}>{session.nombre}</span>
          </div>
          <div style={{ display:"flex" }}>
            {["pos","agenda","historial"].map((v) => (
              <div key={v} className={`nav-tab ${view===v?"active":""}`} onClick={() => { setView(v); if(v==="historial") cargarTickets(session.id); }}>
                {v==="pos" ? "Punto de Venta" : v==="agenda" ? "📅 Agenda" : "Historial de Hoy"}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px" }}>HOY</div>
            <div style={{ fontSize:"15px", fontWeight:600, color:"#49B8D3" }}>{fmt(hoyVentas)}</div>
          </div>
          <button className="btn-ghost" onClick={logout} style={{ fontSize:"12px" }}>Cerrar sesión</button>
        </div>
      </div>

      {/* TOAST */}
      {lastTicket && (
        <div style={{ background:"rgba(39,33,232,0.15)", border:"1px solid rgba(39,33,232,0.4)", margin:"16px 24px 0", borderRadius:"12px", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <div style={{ fontSize:"20px" }}>✓</div>
            <div>
              <div style={{ fontSize:"13px", fontWeight:600 }}>Ticket {lastTicket.ticket_num} guardado correctamente</div>
              <div style={{ fontSize:"12px", color:"rgba(255,255,255,0.5)" }}>{lastTicket.clienta} · {fmt(lastTicket.total)} · {lastTicket.metodo_pago}</div>
            </div>
          </div>
          <button onClick={() => setLastTicket(null)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:"18px" }}>×</button>
        </div>
      )}

      {view === "agenda" && <Agenda session={session} />}
      {view === "pos" ? (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", flex:1, overflow:"hidden", height:"calc(100vh - 64px)" }}>

          {/* SERVICIOS */}
          <div style={{ padding:"20px 20px 20px 24px", overflowY:"auto", display:"flex", flexDirection:"column", gap:"16px" }}>
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
              {ZONAS.map((z) => (
                <button key={z} className={`btn-ghost ${zona===z?"active":""}`} onClick={() => setZona(z)} style={{ padding:"7px 14px", fontSize:"12px" }}>{z}</button>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"10px" }}>
              {filtrados.map((s) => (
                <div key={s.id} className={`svc-card ${selectedSvcs.includes(s.id)?"selected":""} ${s.zona==="Combos"?"combo":""}`} onClick={() => toggleSvc(s.id)}>
                  <div style={{ fontSize:"10px", color: s.zona==="Combos" ? "#49B8D3" : "rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"4px", fontWeight:500 }}>{s.zona.toUpperCase()}</div>
                  <div style={{ fontSize:"13px", fontWeight:500, lineHeight:1.3, marginBottom:"8px" }}>{s.nombre}</div>
                  <div style={{ fontSize:"17px", fontWeight:700, color: s.zona==="Combos" ? "#49B8D3" : "#2721E8" }}>{fmt(s.precio)}</div>
                  {s.msi > 0 && <div style={{ fontSize:"10px", color:"rgba(255,255,255,0.3)", marginTop:"3px" }}>Hasta {s.msi} MSI</div>}
                  {selectedSvcs.includes(s.id) && <div style={{ marginTop:"6px", fontSize:"10px", color:"#6b66ff", fontWeight:600 }}>✓ SELECCIONADO</div>}
                </div>
              ))}
            </div>
          </div>

          {/* PANEL TICKET */}
          <div style={{ borderLeft:"1px solid rgba(255,255,255,0.06)", padding:"20px", overflowY:"auto", background:"rgba(0,0,0,0.2)", display:"flex", flexDirection:"column", gap:"14px" }}>
            <div style={{ fontSize:"13px", fontWeight:600, letterSpacing:"1px", color:"rgba(255,255,255,0.4)" }}>NUEVO TICKET</div>

            {/* Clienta */}
            <div className="glass-dark" style={{ padding:"14px" }}>
              <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"8px" }}>DATOS DE CLIENTA</div>
              <input className="input-sm" placeholder="Nombre de la clienta" value={clienta} onChange={(e) => setClienta(e.target.value)} style={{ marginBottom:"8px" }} />
              <div style={{ display:"flex", gap:"6px" }}>
                {["Nueva","Recurrente"].map((t) => (
                  <div key={t} className="tipo-btn" onClick={() => setTipoClienta(t)}
                    style={{ background: tipoClienta===t ? (t==="Nueva" ? "rgba(39,33,232,0.25)" : "rgba(73,184,211,0.2)") : "rgba(255,255,255,0.03)", color: tipoClienta===t ? (t==="Nueva" ? "#6b66ff" : "#49B8D3") : "rgba(255,255,255,0.35)", borderColor: tipoClienta===t ? (t==="Nueva" ? "#2721E8" : "#49B8D3") : "rgba(255,255,255,0.08)" }}>
                    {t==="Nueva" ? "⭐ Nueva" : "↩ Recurrente"}
                  </div>
                ))}
              </div>
            </div>

            {/* Sesión */}
            <div className="glass-dark" style={{ padding:"14px" }}>
              <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"8px" }}>SESIÓN</div>
              <select className="select-sm" value={sesion} onChange={(e) => setSesion(e.target.value)}>
                {SESIONES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>

            {/* Servicios seleccionados */}
            <div className="glass-dark" style={{ padding:"14px", flex:1 }}>
              <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"10px" }}>SERVICIOS</div>
              {selectedSvcs.length === 0
                ? <div style={{ fontSize:"13px", color:"rgba(255,255,255,0.2)", textAlign:"center", padding:"16px 0" }}>Selecciona del menú</div>
                : selectedSvcs.map((id) => {
                  const s = SERVICIOS.find((x) => x.id === id);
                  return (
                    <div key={id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ fontSize:"12px", lineHeight:1.3 }}>{s.nombre}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <div style={{ fontSize:"13px", color:"#49B8D3", fontWeight:600 }}>{fmt(s.precio)}</div>
                        <div onClick={() => toggleSvc(id)} style={{ cursor:"pointer", color:"rgba(255,255,255,0.3)", fontSize:"16px" }}>×</div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Pago */}
            <div className="glass-dark" style={{ padding:"14px", display:"flex", flexDirection:"column", gap:"10px" }}>
              <div>
                <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"8px" }}>MÉTODO DE PAGO</div>
                <select className="select-sm" value={metodo} onChange={(e) => { setMetodo(e.target.value); if(e.target.value !== "Tarjeta crédito") setMsiSel(0); }}>
                  {METODOS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>

              {/* MSI — solo si es tarjeta crédito y hay servicios con MSI */}
              {metodo === "Tarjeta crédito" && maxMsi > 0 && (
                <div>
                  <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"8px" }}>MESES SIN INTERESES</div>
                  <div style={{ display:"flex", gap:"6px" }}>
                    {[0, 3, ...(maxMsi >= 6 ? [6] : []), ...(maxMsi >= 9 ? [9] : [])].map((m) => (
                      <div key={m} className="msi-btn" onClick={() => setMsiSel(m)}
                        style={{ background: msiSel===m ? "rgba(39,33,232,0.25)" : "rgba(255,255,255,0.03)", borderColor: msiSel===m ? "#2721E8" : "rgba(255,255,255,0.08)", color: msiSel===m ? "#6b66ff" : "rgba(255,255,255,0.4)" }}>
                        {m === 0 ? "Contado" : `${m} MSI`}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"8px" }}>DESCUENTO %</div>
                <div style={{ display:"flex", gap:"6px" }}>
                  {[0,5,10,15,20].map((d) => (
                    <div key={d} onClick={() => setDescuento(d)} style={{ flex:1, textAlign:"center", padding:"8px 4px", borderRadius:"8px", fontSize:"12px", fontWeight:600, cursor:"pointer", border:"1px solid", transition:"all 0.15s",
                      background: descuento===d ? "rgba(39,33,232,0.25)" : "rgba(255,255,255,0.03)",
                      borderColor: descuento===d ? "#2721E8" : "rgba(255,255,255,0.08)",
                      color: descuento===d ? "#6b66ff" : "rgba(255,255,255,0.4)" }}>
                      {d===0?"—":`${d}%`}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Total */}
            <div style={{ padding:"14px", background:"rgba(39,33,232,0.12)", border:"1px solid rgba(39,33,232,0.3)", borderRadius:"12px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", color:"rgba(255,255,255,0.4)", marginBottom:"4px" }}>
                <span>Subtotal</span><span>{fmt(total)}</span>
              </div>
              {descuento > 0 && (
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", color:"#ff8a65", marginBottom:"4px" }}>
                  <span>Descuento {descuento}%</span><span>-{fmt(total*descuento/100)}</span>
                </div>
              )}
              {msiSel > 0 && (
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", color:"#49B8D3", marginBottom:"4px" }}>
                  <span>{msiSel} MSI</span><span>{fmt(totalConDesc / msiSel)}/mes</span>
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"20px", fontWeight:700, marginTop:"6px" }}>
                <span>TOTAL</span><span style={{ color:"#49B8D3" }}>{fmt(totalConDesc)}</span>
              </div>
            </div>

            <button className="btn-blue" disabled={selectedSvcs.length===0||saving} onClick={() => setShowConfirm(true)} style={{ width:"100%", padding:"14px", fontSize:"15px", borderRadius:"12px" }}>
              {saving ? "Guardando..." : "Cerrar ticket →"}
            </button>
          </div>
        </div>
      ) : (
        /* HISTORIAL */
        <div style={{ padding:"24px", overflowY:"auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"14px", marginBottom:"24px" }}>
            {[
              { l:"Ventas de hoy", v:fmt(hoyVentas), c:"#49B8D3" },
              { l:"Tickets cerrados", v:tickets.length, c:"#fff" },
              { l:"Nuevas clientas", v:hoyNuevas, c:"#6b66ff" },
            ].map((k) => (
              <div key={k.l} className="glass" style={{ padding:"20px 24px" }}>
                <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", marginBottom:"8px" }}>{k.l.toUpperCase()}</div>
                <div style={{ fontSize:"28px", fontWeight:700, color:k.c }}>{k.v}</div>
              </div>
            ))}
          </div>
          <div className="glass" style={{ overflow:"hidden" }}>
            <div style={{ padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", fontSize:"13px", fontWeight:600 }}>
              Tickets del día — {session.nombre}
              {loading && <span style={{ fontSize:"12px", color:"rgba(255,255,255,0.3)", marginLeft:"12px" }}>Cargando...</span>}
            </div>
            <div className="ticket-row" style={{ padding:"10px 16px" }}>
              {["TICKET","CLIENTA / SERVICIOS","TOTAL","MÉTODO","TIPO"].map((h) => (
                <div key={h} style={{ fontSize:"10px", letterSpacing:"1.5px", color:"rgba(255,255,255,0.25)" }}>{h}</div>
              ))}
            </div>
            {tickets.length === 0
              ? <div style={{ padding:"32px", textAlign:"center", color:"rgba(255,255,255,0.2)", fontSize:"13px" }}>{loading?"Cargando...":"No hay tickets registrados hoy"}</div>
              : tickets.map((t) => (
                <div key={t.id} className="ticket-row">
                  <div style={{ fontSize:"12px", color:"#6b66ff", fontWeight:600 }}>{t.ticket_num}</div>
                  <div>
                    <div style={{ fontSize:"13px", fontWeight:500 }}>{t.clienta}</div>
                    <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", marginTop:"2px" }}>{(t.servicios||[]).join(" + ")}</div>
                  </div>
                  <div style={{ fontSize:"15px", fontWeight:700, color:"#49B8D3" }}>{fmt(t.total)}</div>
                  <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.4)" }}>{t.metodo_pago}</div>
                  <div><span className={t.tipo_clienta==="Nueva"?"badge-nueva":"badge-rec"}>{t.tipo_clienta}</span></div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR */}
      {showConfirm && (
        <div className="overlay">
          <div className="glass" style={{ width:420, padding:"32px", borderColor:"rgba(39,33,232,0.4)" }}>
            <div style={{ fontSize:"11px", letterSpacing:"2px", color:"#6b66ff", marginBottom:"8px" }}>CONFIRMAR TICKET</div>
            <div style={{ fontSize:"22px", fontWeight:700, marginBottom:"20px" }}>¿Cerrar venta?</div>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginBottom:"24px", background:"rgba(0,0,0,0.3)", borderRadius:"12px", padding:"16px" }}>
              {[
                ["Clienta", clienta || "Sin nombre"],
                ["Sucursal", session.nombre],
                ["Tipo", null],
                ["Servicios", selectedSvcs.map((id) => SERVICIOS.find((s) => s.id===id)?.nombre).join(", ")],
                ["Sesión", sesion],
                ["Pago", msiSel > 0 ? `${metodo} · ${msiSel} MSI` : metodo],
              ].map(([label, val]) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between", fontSize:"13px", alignItems:"center" }}>
                  <span style={{ color:"rgba(255,255,255,0.4)" }}>{label}</span>
                  {label === "Tipo"
                    ? <span className={tipoClienta==="Nueva"?"badge-nueva":"badge-rec"}>{tipoClienta}</span>
                    : <span style={{ fontWeight:500, textAlign:"right", maxWidth:"220px" }}>{val}</span>
                  }
                </div>
              ))}
              <div style={{ height:"1px", background:"rgba(255,255,255,0.08)" }} />
              {descuento > 0 && (
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"13px", color:"#ff8a65" }}>
                  <span>Descuento {descuento}%</span><span>-{fmt(total*descuento/100)}</span>
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"20px", fontWeight:700 }}>
                <span>Total</span><span style={{ color:"#49B8D3" }}>{fmt(totalConDesc)}</span>
              </div>
              {msiSel > 0 && <div style={{ fontSize:"12px", color:"#49B8D3", textAlign:"right" }}>{fmt(totalConDesc/msiSel)}/mes por {msiSel} meses</div>}
            </div>
            <div style={{ display:"flex", gap:"10px" }}>
              <button className="btn-ghost" onClick={() => setShowConfirm(false)} style={{ flex:1, padding:"13px" }}>Cancelar</button>
              <button className="btn-blue" onClick={cerrarTicket} disabled={saving} style={{ flex:2, padding:"13px", fontSize:"15px" }}>
                {saving ? "Guardando..." : "✓ Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
