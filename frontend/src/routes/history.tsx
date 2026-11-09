import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer, Navbar } from "@/components/traffic/Shell";
import { ROAD_COLORS, type Session } from "@/components/traffic/types";
import { clearSessions, getSessions } from "@/lib/api";

export const Route=createFileRoute("/history")({head:()=>({meta:[{title:"Session Archive — STC"},{name:"description",content:"Review archived smart traffic simulation sessions and performance metrics."},{property:"og:title",content:"Session Archive — STC"},{property:"og:description",content:"Detailed RR and FCFS traffic simulation reports."}]}),component:HistoryPage});

function HistoryPage(){
  const[sessions,setSessions]=useState<Session[]>([]);
  const[query,setQuery]=useState("");
  const[filter,setFilter]=useState("ALL SESSIONS");
  const[selected,setSelected]=useState<Session|null>(null);
  const[toast,setToast]=useState(false);
  const loadSessions=async()=>{try{const data=await getSessions();const rows=Array.isArray(data)?data:isRecord(data)&&Array.isArray(data.sessions)?data.sessions:[];setSessions(rows.map((row,index)=>normalizeSession(row,index)))}catch(error){console.error("Unable to load session history",error);setSessions([])}};
  useEffect(()=>{void loadSessions()},[]);
  const onClear=async()=>{try{await clearSessions();setSelected(null);await loadSessions()}catch(error){console.error("Unable to clear session history",error)}};
  const shown=useMemo(()=>sessions.filter((s,index)=>(filter==="ALL SESSIONS"||(filter==="HIGH TRAFFIC"&&s.totalCleared>350)||(filter==="LOW TRAFFIC"&&s.totalCleared<=350)||(filter==="RECENT"&&index<3))&&String(s.id).includes(query)),[sessions,query,filter]);
  return <>
    <Navbar/>
    <main className="archive-page">
      <header className="archive-header" style={{ position: "relative" }}>
        <p>SYSTEM ARCHIVE</p>
        <h1>SESSION <span className="gradient-text">HISTORY</span></h1>
        <small>Complete record of all simulation sessions</small>
        <Button variant="dangerOutline" style={{ position: "absolute", top: 0, right: 0 }} onClick={onClear}>
          <Trash2 /> CLEAR HISTORY
        </Button>
      </header>
      <div className="filters">
        <label><Search/><input aria-label="Search archive" value={query} onChange={e=>setQuery(e.target.value)} placeholder="SEARCH ARCHIVE..."/></label>
        <div>{["ALL SESSIONS","HIGH TRAFFIC","LOW TRAFFIC","RECENT"].map(f=><button className={filter===f?"active":""} onClick={()=>setFilter(f)} key={f}>{f}</button>)}</div>
      </div>
      {shown.length
        ? <section className="session-grid">{shown.map(s=><SessionCard key={s.id} session={s} onOpen={()=>setSelected(s)}/>)}</section>
        : <div className="empty">
            <div className="empty-signal"><i/><i/><i/></div>
            <h2>NO SESSIONS ARCHIVED</h2>
            <p>Initialize and save a simulation to begin recording history.</p>
            <Button asChild variant="neon"><Link to="/simulation">GO TO SIMULATION →</Link></Button>
          </div>
      }
    </main>
    <Footer/>
    <AnimatePresence>
      {selected&&<SessionModal session={selected} close={()=>setSelected(null)} exportData={()=>{setToast(true);window.setTimeout(()=>setToast(false),2500)}}/>}
      {toast&&<motion.div className="toast" initial={{x:100,opacity:0}} animate={{x:0,opacity:1}} exit={{x:100,opacity:0}}>EXPORT FEATURE COMING SOON</motion.div>}
    </AnimatePresence>
  </>;
}

function SessionCard({session:s,onOpen}:{session:Session;onOpen:()=>void}){
  const quality=s.avgWaitTime<8?"OPTIMAL":s.avgWaitTime<=15?"MODERATE":"CONGESTED";
  return <motion.article className="session-card" whileHover={{y:-5}}>
    <div className="distribution"/>
    <div className="session-body">
      <header><h3>SESSION #{s.id}</h3><span>{s.timestamp}</span></header>
      <div className="session-metrics">
        {[
          [s.totalCleared,"CLEARED"],
          [`${Math.floor(s.duration/60)}:${String(s.duration%60).padStart(2,"0")}`,"DURATION"],
          [`${Number(s.avgWaitTime).toFixed(1)}s`,"AVG WAIT"],
          [s.algorithm,"ALGORITHM"],
        ].map(([n,l])=><div key={l}><b>{n}</b><small>{l}</small></div>)}
      </div>
      <div className="mini-gantt">
        {s.perRoad.map((r,i)=><p key={r.id}><span>{r.name}</span><i style={{width:`${r.greenTimePercent*2.3}%`,background:ROAD_COLORS[i]}}/></p>)}
      </div>
      <footer>
        <span className={quality.toLowerCase()}>{quality}</span>
        <button onClick={onOpen}>VIEW DETAILS ›</button>
      </footer>
    </div>
  </motion.article>;
}

function SessionModal({session:s,close,exportData}:{session:Session;close:()=>void;exportData:()=>void}){
  const bestRoad = s.perRoad.length
    ? s.perRoad.reduce((best, r) => r.cleared > best.cleared ? r : best, s.perRoad[0])?.name ?? "—"
    : "—";

  return <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
    <motion.div className="session-modal" initial={{scale:.94,y:20}} animate={{scale:1,y:0}} exit={{scale:.94,y:20}}>
      <header>
        <div>
          <h2>SESSION #{s.id} — DETAILED ANALYSIS</h2>
          <span>{s.timestamp} · {s.algorithm}</span>
        </div>
        <button onClick={close} aria-label="Close"><X/></button>
      </header>

      <div className="modal-body">
        {/* LEFT — stats + road table */}
        <section>
          <div className="detail-metrics">
            {[
              [s.totalCleared, "TOTAL CLEARED"],
              [`${Math.floor(s.duration/60)}m ${s.duration%60}s`, "DURATION"],
              [`${Number(s.avgWaitTime).toFixed(1)}s`, "AVG WAIT"],
              [s.algorithm, "ALGORITHM"],
              [bestRoad, "BEST ROAD"],
            ].map(([n,l])=><div key={l}><b>{n}</b><small>{l}</small></div>)}
          </div>
          <div className="road-table">
            <div>ROAD <span>VEHICLES</span><span>CLEARED</span><span>AVG WAIT</span><span>GREEN %</span></div>
            {s.perRoad.map((r,i)=>(
              <div key={r.id}>
                <b style={{color:ROAD_COLORS[i]}}>● {r.name}</b>
                <span>{r.cleared + 18}</span>
                <span>{r.cleared}</span>
                <span>{Number(r.avgWait).toFixed(1)}s</span>
                <span>{r.greenTimePercent}%</span>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT — gantt only */}
        <section className="detail-gantt">
          <h3>COMPLETE SIGNAL TIMELINE</h3>
          {s.perRoad.map((r,i)=>(
            <div key={r.id}>
              <label style={{color:ROAD_COLORS[i]}}>{r.name}</label>
              <span>
                {Array.from({length:3+i%2},(_,j)=>(
                  <i key={j} style={{background:ROAD_COLORS[i],width:`${30+j*12}px`}}/>
                ))}
              </span>
            </div>
          ))}
        </section>
      </div>

      <footer>
        <Button variant="outline" onClick={close}>CLOSE SESSION</Button>
        <Button variant="neonOutline" onClick={exportData}><Download/> EXPORT DATA ▸</Button>
      </footer>
    </motion.div>
  </motion.div>;
}

function isRecord(value:unknown):value is Record<string,unknown>{
  return typeof value==="object"&&value!==null;
}

function normalizeSession(value:unknown,index:number):Session{
  const row=isRecord(value)?value:{};
  const perRoad=Array.isArray(row.perRoad)?row.perRoad:[];
  const ganttData=Array.isArray(row.ganttData)?row.ganttData:[];
  const created=typeof row.createdAt==="string"?new Date(row.createdAt):null;
  return{
    id:String(row._id??row.id??index+1),
    timestamp:typeof row.timestamp==="string"?row.timestamp:created&&!Number.isNaN(created.getTime())?created.toLocaleString("en-GB"):"SAVED SESSION",
    duration:Number(row.duration??0),
    algorithm:row.algorithm==="FCFS"?"FCFS":"RR",
    totalCleared:Number(row.totalCleared??0),
    avgWaitTime:Number(row.avgWaitTime??0),
    efficiency:Number(row.efficiency??0),
    perRoad:perRoad.map((item,i)=>{
      const road=isRecord(item)?item:{};
      return{id:Number(road.id??i),name:String(road.name??`ROAD ${i+1}`),cleared:Number(road.cleared??0),avgWait:Number(road.avgWait??0),greenTimePercent:Number(road.greenTimePercent??0)};
    }),
    ganttData:ganttData.map((item)=>{
      const entry=isRecord(item)?item:{};
      return{roadIndex:Number(entry.roadIndex??0),roadName:String(entry.roadName??"ROAD"),color:String(entry.color??ROAD_COLORS[Number(entry.roadIndex??0)%ROAD_COLORS.length]),duration:Number(entry.duration??0),startTime:Number(entry.startTime??0)};
    }),
  };
}