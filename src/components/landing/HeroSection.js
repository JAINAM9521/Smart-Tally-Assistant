"use client";
import { ArrowUpRight } from "lucide-react";
import { Button, WorkflowVisual } from "./LandingPrimitives";

export default function HeroSection() { return <section className="hero section-grid"><div className="hero-copy"><div className="eyebrow"><span className="pulse-dot" /> ACCOUNTING AUTOMATION, REIMAGINED</div><h1>Convert Excel Accounting Data into <em>Tally XML</em> — Smarter and Faster.</h1><p className="hero-lede">Upload your accounting Excel file, validate your data, fix common errors, and generate Tally-compatible XML without manually entering hundreds of transactions into Tally.</p><div className="hero-actions"><Button href="/login">Start converting</Button><a href="#how-it-works" className="text-link">See how it works <ArrowUpRight size={17} /></a></div><div className="trusted"><span>Built for teams that value clean books</span><div className="trust-avatars"><i>CA</i><i>SM</i><i>FT</i><b>+ 120 finance teams</b></div></div></div><WorkflowVisual /></section> }
