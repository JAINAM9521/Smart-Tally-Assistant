"use client";
import Link from "next/link";
import { Brand, Button } from "./LandingPrimitives";

export default function LandingNavigation({ mobile, setMobile }) { return <nav className="landing-nav"><Brand /><div className={`nav-links ${mobile ? "open" : ""}`}>{["How It Works", "Features", "Validation", "Vouchers", "Benefits", "FAQ"].map((item) => <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} onClick={() => setMobile(false)}>{item}</a>)}</div><div className="nav-actions"><Link href="/login" className="nav-login">Log in</Link><Button href="/login">Get started</Button></div><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobile(!mobile)}>☰</button></nav> }
