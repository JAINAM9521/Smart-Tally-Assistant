"use client";
import { motion } from "framer-motion";
import { ArrowDown, ArrowRight, CheckCircle2, FileCode2, FileSpreadsheet, ShieldCheck, WandSparkles } from "lucide-react";

const mainFlow = ["USER", "SELECT VOUCHER", "DOWNLOAD TEMPLATE", "FILL EXCEL", "UPLOAD EXCEL", "VALIDATE DATA"];

export default function CompleteFlow() {
  return <section className="section complete-flow" id="complete-flow"><div className="section-heading"><div><div className="eyebrow">THE COMPLETE JOURNEY</div><h2>Every decision is<br /><em>visible.</em></h2></div><p>When errors appear, Smart Tally gives the user a clear recovery path instead of stopping at a failed import.</p></div><div className="flow-map"><div className="flow-main">{mainFlow.map((item, index) => <motion.div key={item} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .08 }} className="flow-map-node"><span>{index === 0 ? <FileSpreadsheet size={15} /> : index === 5 ? <ShieldCheck size={15} /> : String(index + 1).padStart(2, "0")}</span><b>{item}</b>{index < mainFlow.length - 1 && <ArrowDown className="flow-map-arrow" size={15} />}</motion.div>)}</div><div className="flow-branches"><div className="branch yes"><b>YES · ERRORS FOUND</b><span><FileSpreadsheet size={15} /> Error report <ArrowRight size={13} /> <WandSparkles size={15} /> Smart recommendation <ArrowRight size={13} /> <CheckCircle2 size={15} /> Auto fix</span><small>Revalidate → 100% valid → Generate XML</small></div><div className="branch no"><b>NO · CLEAN DATA</b><span><FileCode2 size={15} /> Generate XML <ArrowRight size={13} /> XML preview <ArrowRight size={13} /> Download</span><small>Import verified entries into Tally Prime</small></div></div></div></section>;
}
