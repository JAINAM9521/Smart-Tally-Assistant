"use client";
import { useState } from "react";
import { ArrowRight, Bot, Sparkles, X } from "lucide-react";
import { sendChatbotMessage } from "../../lib/api";

const questions = [
  "Why is my voucher invalid?",
  "How should I format an amount?",
  "Why is my ledger not matching?",
  "How do I import XML into Tally?",
  "What does validation check?",
  "What does Auto Fix do?"
];

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const ask = async (question) => {
    setBusy(true);
    setMessages(previous => [...previous, { role: "user", text: question }]);
    try {
      const response = await sendChatbotMessage(question);
      setMessages(previous => [...previous, { role: "bot", text: response.reply || response.message || "No response was returned." }]);
    } catch (error) {
      setMessages(previous => [...previous, { role: "bot", text: error.message }]);
    } finally {
      setBusy(false);
    }
  };
  return <div className="chatbot">
    <button className="chat-fab" aria-label={open ? "Close assistant" : "Open assistant"} onClick={() => setOpen(!open)}>{open ? <X size={20}/> : <><Bot size={20}/><Sparkles size={12}/></>}</button>
    {open && <div className="chat-window"><div className="chat-head"><span><Bot size={17}/></span><div><b>Smart Tally Assistant</b><small>Connected to the project assistant API</small></div><button aria-label="Close assistant" onClick={()=>setOpen(false)}><X size={15}/></button></div>
      <div className="chat-messages">{messages.map((message,index)=><div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>{message.text}</div>)}</div>
      <p>{busy ? "Thinking..." : "Choose a question."}</p>
      {questions.map(question=><button className="chat-question" key={question} onClick={()=>ask(question)} disabled={busy}>{question}<ArrowRight size={13}/></button>)}
    </div>}
  </div>;
}
