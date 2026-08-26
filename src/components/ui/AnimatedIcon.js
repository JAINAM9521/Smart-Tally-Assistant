"use client";
import { motion } from "framer-motion";

const animations = {
  float: { y: [0, -4, 0] },
  pulse: { scale: [1, 1.08, 1] },
  bounce: { y: [0, -5, 0] },
  shake: { x: [0, -3, 3, -2, 0] },
  spin: { rotate: 360 },
  glow: { opacity: [0.7, 1, 0.7] },
  success: { scale: [0.8, 1.08, 1] },
  error: { x: [0, -3, 3, 0] },
};

export default function AnimatedIcon({ icon: Icon, animation = "pulse", size = 18, label }) {
  return <motion.span className="animated-icon" aria-label={label} animate={animations[animation] || animations.pulse} transition={{ duration: animation === "spin" ? 1.2 : 1.8, repeat: Infinity, ease: "easeInOut" }}><Icon size={size} /></motion.span>;
}
