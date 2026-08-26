"use client";
import { CheckCircle2, X } from "lucide-react";

export default function Toast({ message, onClose, tone = "success" }) {
  if (!message) return null;
  return <div className={`toast toast-${tone}`} role="status"><CheckCircle2 size={16} /><span>{message}</span><button aria-label="Close notification" onClick={onClose}><X size={14} /></button></div>;
}
