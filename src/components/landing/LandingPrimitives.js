"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Database, FileCode2, FileSpreadsheet, ShieldCheck, WandSparkles, Zap } from "lucide-react";

function Brand() { return <Link href="/" className="brand"><span className="brand-mark"><Zap size={16} fill="currentColor" /></span><span>Smart Tally <b>XML Assistant</b></span></Link>; }


function Button({ children, href, secondary, onClick }) { const body = <button onClick={onClick} className={`btn ${secondary ? "btn-secondary" : "btn-primary"}`}>{children}<ArrowRight size={16} /></button>; return href ? <Link href={href}>{body}</Link> : body; }

function WorkflowVisual() { const items = [[<FileSpreadsheet key="excel" />, "Excel data", "1,250 rows"], [<ShieldCheck key="validation" />, "Smart validation", "98.6% score"], [<WandSparkles key="fix" />, "Smart fix", "3 safe fixes"], [<FileCode2 key="xml" />, "Tally XML", "Ready to import"]]; return <div className="workflow-visual"><div className="visual-orbit" /><div className="visual-label"><span className="pulse-dot" /> LIVE WORKFLOW PREVIEW</div>{items.map(([icon, title, note], i) => <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .2 + i * .18 }} className={`flow-node flow-${i}`} key={title}><span>{icon}</span><div><b>{title}</b><small>{note}</small></div>{i < 3 && <ArrowRight className="flow-arrow" size={15} />}</motion.div>)}<div className="tally-badge"><Database size={16} /><span><b>Tally Prime</b><small>Accounting, finished.</small></span><Check size={16} /></div></div> }

function ScoreRing({ active }) { return <div className="score-ring animated-score-ring"><svg viewBox="0 0 120 120" aria-label="Validation score 98.6 percent"><circle className="score-ring-track" cx="60" cy="60" r="49" transform="rotate(-90 60 60)" /><motion.circle className="score-ring-progress" cx="60" cy="60" r="49" transform="rotate(-90 60 60)" initial={{ pathLength: 0 }} animate={{ pathLength: active ? 0.986 : 0 }} transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }} /></svg><div className="score-ring-label"><b>98.6</b><small>confidence</small></div></div> }

export { Brand, Button, WorkflowVisual, ScoreRing };


