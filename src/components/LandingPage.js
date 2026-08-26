"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  CheckCircle2,
  FileCode2,
  FileSpreadsheet,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

import { Brand, Button } from "./landing/LandingPrimitives";
import LandingNavigation from "./landing/LandingNavigation";
import HeroSection from "./landing/HeroSection";
import ValidationSection from "./landing/ValidationSection";
import FaqSection from "./landing/FaqSection";
import CompleteFlow from "./landing/CompleteFlow";
import { templateColumns } from "../lib/voucherCatalog";

const steps = [
  {
    number: "01",
    title: "Select voucher",
    description: "Pick the accounting flow you need to process.",
    icon: FileSpreadsheet,
  },
  {
    number: "02",
    title: "Download template",
    description: "Start with a clean, standardized spreadsheet.",
    icon: FileSpreadsheet,
  },
  {
    number: "03",
    title: "Fill Excel",
    description: "Add your ledgers, GST details and amounts.",
    icon: Check,
  },
  {
    number: "04",
    title: "Upload Excel",
    description: "Upload your completed file into the workspace.",
    icon: Upload,
  },
  {
    number: "05",
    title: "Validate & fix",
    description: "Find issues and resolve them with clear guidance.",
    icon: ShieldCheck,
  },
  {
    number: "06",
    title: "Generate XML",
    description: "Create Tally-compatible XML after successful validation.",
    icon: FileCode2,
  },
  {
    number: "07",
    title: "Import to Tally",
    description: "Move verified entries into Tally Prime.",
    icon: CheckCircle2,
  },
];

const voucherTypes = [
  {
    name: "Sales",
    symbol: "S",
    description: "Invoices & GST",
  },
  {
    name: "Purchase",
    symbol: "P",
    description: "Bills & vendors",
  },
  {
    name: "Payment",
    symbol: "₹",
    description: "Cash & bank",
  },
  {
    name: "Receipt",
    symbol: "R",
    description: "Collections",
  },
  {
    name: "Contra",
    symbol: "↔",
    description: "Transfers",
  },
  {
    name: "Journal",
    symbol: "J",
    description: "Adjustments",
  },
  {
    name: "Credit Note",
    symbol: "−",
    description: "Sales returns",
  },
  {
    name: "Debit Note",
    symbol: "+",
    description: "Purchase returns",
  },
];

const problems = [
  {
    number: "01",
    title: "Repetitive data entry",
    description:
      "Move hundreds of transactions by hand, one voucher at a time.",
  },
  {
    number: "02",
    title: "Human errors",
    description: "A misplaced amount, date or ledger name can stop an import.",
  },
  {
    number: "03",
    title: "XML import problems",
    description:
      "Identify and resolve data issues before the final XML is generated.",
  },
];

const autoFixExamples = [
  ["Detect", "10000", "10000"],
  ["Normalize date", "01/08/2026", "01-08-2026"],
  ["Trim spaces", "  Sales A/c  ", "Sales A/c"],
  ["Revalidate", "82%", "100%"],
];

const oldWorkflow = [
  "Excel",
  "Manual entry",
  "Repeated work",
  "Human errors",
  "Import problems",
];

const smartWorkflow = [
  "Excel",
  "Upload",
  "Validation",
  "Smart fix",
  "Tally XML",
  "Tally Prime",
];

const userTypes = [
  "CA firms",
  "Accountants",
  "Businesses",
  "Finance teams",
  "Tally users",
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const validationRef = useRef(null);

  const validationInView = useInView(validationRef, {
    amount: 0.35,
    once: false,
  });

  return (
    <main className="landing">
      {/* Navigation */}
      <LandingNavigation mobile={mobileMenu} setMobile={setMobileMenu} />

      {/* Hero */}
      <HeroSection />

      {/* Product Proof */}
      <section className="proof-strip" aria-label="Product highlights">
        <div>
          <strong>Real</strong>
          <span>Excel data validated by the backend</span>
        </div>

        <div>
          <strong>100%</strong>
          <span>Required before XML generation</span>
        </div>

        <div>
          <strong>8</strong>
          <span>Voucher types supported</span>
        </div>

        <div>
          <strong>0</strong>
          <span>Blocking errors allowed for XML</span>
        </div>
      </section>

      {/* Problem Section */}
      <section className="section" id="features">
        <div className="section-heading">
          <div>
            <div className="eyebrow">THE OLD WAY, RETIRED</div>

            <h2>
              Manual Tally entry
              <br />
              <em>takes time.</em>
            </h2>
          </div>

          <p>
            Accounting data already lives in spreadsheets. Smart Tally creates a
            structured path from those rows to validated, Tally-compatible XML.
          </p>
        </div>

        <div className="problem-grid">
          {problems.map((problem) => (
            <motion.article
              key={problem.number}
              className="problem-card"
              whileHover={{ y: -5 }}
            >
              <span className="number">{problem.number}</span>

              <h3>{problem.title}</h3>

              <p>{problem.description}</p>

              <span className="card-line" />
            </motion.article>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="section dark-section" id="how-it-works">
        <div className="section-heading light">
          <div>
            <div className="eyebrow">A BETTER BRIDGE</div>

            <h2>
              One smart workflow
              <br />
              from <em>Excel to Tally.</em>
            </h2>
          </div>

          <p>
            Every step has a purpose. Validation identifies problems before they
            reach the final XML.
          </p>
        </div>

        <div className="steps-grid">
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <motion.div
                key={step.number}
                className="step-card"
                initial={{
                  opacity: 0,
                  y: 12,
                }}
                whileInView={{
                  opacity: 1,
                  y: 0,
                }}
                viewport={{
                  once: true,
                }}
                transition={{
                  delay: index * 0.06,
                }}
              >
                <span>{step.number}</span>

                <div className="step-icon">
                  <Icon />
                </div>

                <h3>{step.title}</h3>

                <p>{step.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Complete Flow */}
      <CompleteFlow />

      {/* Validation */}
      <ValidationSection
        validationRef={validationRef}
        validationInView={validationInView}
      />

      {/* Smart Recommendations */}
      <section className="section recommendation">
        <div className="recommend-copy">
          <div className="eyebrow">EXPLAINABLE AUTOMATION</div>

          <h2>
            Fix the row.
            <br />
            <em>Keep the context.</em>
          </h2>

          <p>
            Smart recommendations explain what changed, why it matters and what
            you can do next. Nothing should be silently changed.
          </p>

          <Button href="/login">Try the workspace</Button>
        </div>

        <motion.div
          className="recommend-card"
          whileHover={{
            rotate: 1,
          }}
        >
          <div className="rec-head">
            <span className="ai-icon">
              <Sparkles size={18} />
            </span>

            <div>
              <b>Smart recommendation</b>
              <small>Ledger normalization</small>
            </div>

            <span className="confidence">Suggested</span>
          </div>

          <div className="compare">
            <div>
              <small>Current value</small>
              <strong>Sales</strong>
            </div>

            <ArrowRight />

            <div className="suggested">
              <small>Suggested value</small>
              <strong>Sales A/c</strong>
            </div>
          </div>

          <div className="rec-foot">
            <span>
              <CheckCircle2 size={15} />
              Review before applying
            </span>

            <button type="button">Apply suggestion</button>
          </div>
        </motion.div>
      </section>

      {/* Auto Fix */}
      <section className="section auto-fix">
        <div className="section-heading">
          <div>
            <div className="eyebrow">AUTOMATIC, NOT CARELESS</div>

            <h2>
              Common cleanup,
              <br />
              <em>handled for you.</em>
            </h2>
          </div>

          <p>
            Safe formatting problems can be corrected automatically, followed by
            a complete revalidation before XML generation.
          </p>
        </div>

        <div className="fix-flow">
          {autoFixExamples.map(([title, before, after], index) => (
            <div className="fix-step" key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>

              <h3>{title}</h3>

              <div className="fix-values">
                <del>{before}</del>

                <ArrowRight size={15} />

                <b>{after}</b>
              </div>

              {index < autoFixExamples.length - 1 && (
                <div className="fix-connector" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Voucher Types */}
      <section className="section voucher-section" id="vouchers">
        <div className="section-heading">
          <div>
            <div className="eyebrow">SUPPORTED FLOWS</div>

            <h2>
              One workspace.
              <br />
              <em>Every voucher type.</em>
            </h2>
          </div>

          <p>
            Start from a standardized template for the accounting flows your
            team handles every day.
          </p>
        </div>

        <div className="voucher-pills">
          {voucherTypes.map((voucher, index) => (
            <div key={voucher.name} className={`voucher-pill vp-${index}`}>
              <span>{voucher.symbol}</span>

              <b>{voucher.name}</b>

              <small>{voucher.description}</small>
            </div>
          ))}
        </div>
      </section>

      {/* Excel Template */}
      <section className="section template-section">
        <div className="template-copy">
          <div className="eyebrow">NO BLANK CANVAS</div>

          <h2>
            Templates that speak
            <br />
            <em>accounting.</em>
          </h2>

          <p>
            Skip formatting guesswork. Download the appropriate template, fill
            the required columns and let the backend validate the data.
          </p>

          <ul>
            <li>
              <Check size={15} />
              Use exact Tally ledger names
            </li>

            <li>
              <Check size={15} />
              Keep amounts numeric — no ₹ or commas
            </li>

            <li>
              <Check size={15} />
              Add correct GST and voucher details
            </li>

            <li>
              <Check size={15} />
              Never leave mandatory fields blank
            </li>
          </ul>

          <Button href="/login" secondary>
            See a template
          </Button>
        </div>

        <div className="sheet">
          <div className="sheet-top">
            <FileSpreadsheet size={18} />

            <b>sales_template.xlsx</b>

            <span>Template preview</span>
          </div>

          <div className="sheet-table">
            {/* FIX:
                Removed undefined templateRows.
                Only real templateColumns are displayed.
            */}
            <div className="sheet-row header">
              {templateColumns.map((column) => (
                <span key={column}>{column}</span>
              ))}
            </div>

            <div className="sheet-empty">
              <FileSpreadsheet size={22} />

              <b>Backend-generated template</b>

              <small>
                Download the selected voucher template and enter your real
                accounting data.
              </small>
            </div>
          </div>

          <div className="sheet-note">
            <ShieldCheck size={14} />
            Standardized columns · CSV and XLSX supported
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="section before-after" id="benefits">
        <div className="section-heading">
          <div>
            <div className="eyebrow">THE DIFFERENCE</div>

            <h2>
              From busywork to
              <br />
              <em>books-ready.</em>
            </h2>
          </div>
        </div>

        <div className="ba-grid">
          {/* Old workflow */}
          <div className="ba-card old">
            <span>WITHOUT SMART TALLY</span>

            {oldWorkflow.map((item, index) => (
              <div key={item}>
                <b>{index + 1}</b>

                {item}

                {index < oldWorkflow.length - 1 && <ArrowRight size={15} />}
              </div>
            ))}
          </div>

          {/* Smart workflow */}
          <div className="ba-card new">
            <span>WITH SMART TALLY</span>

            {smartWorkflow.map((item, index) => (
              <div key={item}>
                <b>{index + 1}</b>

                {item}

                {index < smartWorkflow.length - 1 && <ArrowRight size={15} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="section dashboard-preview">
        <div className="section-heading">
          <div>
            <div className="eyebrow">A CONTROL ROOM FOR CLEAN DATA</div>

            <h2>
              See the health of
              <br />
              <em>every conversion.</em>
            </h2>
          </div>

          <p>
            One clear workspace for files, validation results, generated XML and
            conversion history.
          </p>
        </div>

        <div className="preview-window">
          <div className="preview-side">
            <Brand />

            <small>WORKSPACE</small>

            {[
              "Overview",
              "Convert Excel",
              "Validation reports",
              "XML files",
            ].map((item, index) => (
              <div className={index === 0 ? "active" : ""} key={item}>
                {item}
              </div>
            ))}
          </div>

          <div className="preview-main">
            <div className="preview-title">
              <div>
                <small>SMART TALLY WORKSPACE</small>

                <h3>Conversion overview</h3>
              </div>

              <span>+ New conversion</span>
            </div>

            <div className="preview-stats">
              {[
                ["Files", "Processed from backend", "Live"],
                ["Validation", "Full dataset checks", "100% required"],
                ["XML", "Generated after validation", "Verified"],
                ["Tally", "Final import destination", "Ready"],
              ].map(([value, label, status]) => (
                <div key={label}>
                  <strong>{value}</strong>

                  <small>{label}</small>

                  <em>{status}</em>
                </div>
              ))}
            </div>

            <div className="preview-chart">
              <div>
                <b>Conversion workflow</b>

                <small>Excel → Validation → XML → Tally</small>
              </div>

              <div className="bars">
                {[35, 48, 42, 70, 58, 84, 63].map((height, index) => (
                  <span
                    key={index}
                    style={{
                      height: `${height}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Target Users */}
      <section className="section who">
        <div className="eyebrow">MADE FOR THE PEOPLE BEHIND THE NUMBERS</div>

        <h2>
          Built for teams that
          <br />
          <em>keep business moving.</em>
        </h2>

        <div className="who-grid">
          {userTypes.map((userType, index) => (
            <div key={userType}>
              <span>{String(index + 1).padStart(2, "0")}</span>

              <b>{userType}</b>

              <ArrowUpRight size={17} />
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <FaqSection open={openFaq} setOpen={setOpenFaq} />

      {/* Final CTA */}
      <section className="final-cta">
        <div className="eyebrow">READY WHEN YOU ARE</div>

        <h2>
          Make your next import
          <br />
          <em>the confident one.</em>
        </h2>

        <p>
          Upload your Excel data, validate it, resolve errors and prepare
          Tally-compatible XML.
        </p>

        <Button href="/login">Get started</Button>

        <small>
          Real backend workflow · MongoDB-backed data · Tally XML output
        </small>
      </section>

      {/* Footer */}
      <footer>
        <Brand />

        <span>Smart accounting data preparation from Excel to Tally.</span>

        <div>
          <a href="#how-it-works">How it works</a>

          <a href="#features">Features</a>

          <a href="#faq">Help</a>

          <Link href="/login">Login</Link>
        </div>

        <small>© 2026 Smart Tally XML Assistant</small>
      </footer>

      {/* Scroll To Top */}
      <motion.button
        type="button"
        className="scroll-top"
        aria-label="Scroll to top"
        onClick={() =>
          window.scrollTo({
            top: 0,
            behavior: "smooth",
          })
        }
        animate={{
          y: [0, -5, 0],
        }}
        transition={{
          duration: 1.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <ArrowUp size={18} />
      </motion.button>
    </main>
  );
}
