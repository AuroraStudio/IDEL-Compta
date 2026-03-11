import { useState, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ─── CONSTANTES FISCALES 2025 ─────────────────────────────────────────────────

const PASS_2025 = 47100;

const CARPIMKO_2025 = {
  complementaire_forfait: 2312,
  invalidite_deces: 1022,
  asv_assure: 236,
  base_taux: 0.1075,
  complementaire_taux: 0.03,
  complementaire_seuil_bas: 25246,
  complementaire_seuil_haut: 237179,
};

const URSSAF_TAUX = {
  maladie_taux_haut: 0.067,
  maladie_seuil_bas: 27821,
  maladie_seuil_haut: 51005,
  maladie_taux_bas: 0.04,
  alloc_fam_taux: 0.031,
  alloc_fam_seuil: 51005,
  csg_crds: 0.097,
  retraite_base: 0.1075,
  invalidite_deces_urssaf: 0.013,
};

const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

const CHARGES_KEYS = ["vehicule","blanchissage","materiel","assurances","comptable","divers"];
const CHARGES_LABELS = {
  vehicule: "Véhicule",
  blanchissage: "Blanchissage / Hygiène",
  materiel: "Matériel médical",
  assurances: "Assurances pro",
  comptable: "Comptable / AGA",
  divers: "Autres frais divers",
};

// ─── CALCULS ──────────────────────────────────────────────────────────────────

function calcCARPIMKO(beneficeAnnuel, annee) {
  if (annee === 1) return { total: 3570, detail: "Base forfaitaire 1ère année", mensuel: 298 };
  if (annee === 2) return { total: 3570, detail: "Base forfaitaire 2ème année (régularisation à venir)", mensuel: 298 };
  const base = Math.max(0, beneficeAnnuel);
  const retraite_base = base * CARPIMKO_2025.base_taux;
  const comp_assiette = Math.min(
    Math.max(0, base - CARPIMKO_2025.complementaire_seuil_bas),
    CARPIMKO_2025.complementaire_seuil_haut - CARPIMKO_2025.complementaire_seuil_bas
  );
  const complementaire = CARPIMKO_2025.complementaire_forfait + comp_assiette * CARPIMKO_2025.complementaire_taux;
  const total = retraite_base + complementaire + CARPIMKO_2025.invalidite_deces + CARPIMKO_2025.asv_assure;
  return { total: Math.round(total), mensuel: Math.round(total / 12), detail: "Taux réels N-1" };
}

function calcURSSAF(beneficeAnnuel, annee) {
  if (annee === 1) return { total: 971, mensuel: 81, detail: "Base forfaitaire 1ère année" };
  if (annee === 2) return { total: 4000, mensuel: 333, detail: "Estimation 2ème année (régularisation)" };
  const b = Math.max(0, beneficeAnnuel);
  let maladie;
  if (b <= URSSAF_TAUX.maladie_seuil_bas) {
    maladie = b * URSSAF_TAUX.maladie_taux_bas;
  } else if (b >= URSSAF_TAUX.maladie_seuil_haut) {
    maladie = b * URSSAF_TAUX.maladie_taux_haut;
  } else {
    const t = (b - URSSAF_TAUX.maladie_seuil_bas) / (URSSAF_TAUX.maladie_seuil_haut - URSSAF_TAUX.maladie_seuil_bas);
    maladie = b * (URSSAF_TAUX.maladie_taux_bas + t * (URSSAF_TAUX.maladie_taux_haut - URSSAF_TAUX.maladie_taux_bas));
  }
  const alloc_fam = b > URSSAF_TAUX.alloc_fam_seuil ? b * URSSAF_TAUX.alloc_fam_taux : 0;
  const csg_crds = b * URSSAF_TAUX.csg_crds;
  const retraite = b * URSSAF_TAUX.retraite_base;
  const inval = Math.min(b, PASS_2025) * URSSAF_TAUX.invalidite_deces_urssaf;
  const total = maladie + alloc_fam + csg_crds + retraite + inval;
  return { total: Math.round(total), mensuel: Math.round(total / 12), detail: "Taux réels N-1" };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const formatEur = (v) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
const parse = (v) => parseFloat(v) || 0;

const EMPTY_MOIS = () => ({ ca: "", vehicule: "", blanchissage: "", materiel: "", assurances: "", comptable: "", divers: "" });
const EMPTY_CHARGES_ANNUELLES = () => ({ vehicule: "", blanchissage: "", materiel: "", assurances: "", comptable: "", divers: "" });

// Regime fiscal par défaut selon l'année : micro pour 1-2, réel pour 3+
const regimeDefaut = (a) => (a >= 3 ? "reel" : "micro");

// Store initial : années 1 et 2 fixes, les suivantes ajoutées dynamiquement
const initStoreAnnees = () => {
  const store = {};
  [1, 2, 3].forEach(a => {
    store[a] = {
      mois: Array.from({ length: 12 }, EMPTY_MOIS),
      chargesAnnuellesBloc: EMPTY_CHARGES_ANNUELLES(),
      regime: regimeDefaut(a),
    };
  });
  return store;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0f1923", border: "1px solid #1e3a4a", borderRadius: 8, padding: "10px 16px" }}>
      <p style={{ color: "#64b5c8", margin: 0, fontSize: 12, fontFamily: "DM Mono, monospace" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "4px 0 0", fontSize: 13, fontFamily: "DM Mono, monospace" }}>
          {p.name}: {formatEur(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── APP ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [anneeExercice, setAnneeExercice] = useState(3);
  const [storeAnnees, setStoreAnnees] = useState(initStoreAnnees);
  const [nbAnnees, setNbAnnees] = useState(3);
  const [onglet, setOnglet] = useState("dashboard");
  const [moisActif, setMoisActif] = useState(new Date().getMonth());

  // Accès aux données de l'année active
  const anneeData = storeAnnees[anneeExercice];
  const donneesMois = anneeData.mois;
  const chargesAnnuellesBloc = anneeData.chargesAnnuellesBloc;
  const regimeFiscal = anneeData.regime;

  // Mutateur générique sur l'année courante
  const updateAnneeData = (patch) =>
    setStoreAnnees(prev => ({ ...prev, [anneeExercice]: { ...prev[anneeExercice], ...patch } }));

  // Changement d'année : on switche juste, les données sont conservées
  const anneeLabel = (v) => {
    if (v === 1) return "1ère année";
    if (v === 2) return "2ème année";
    return `${v}ème année (frais réels)`;
  };

  const ajouterAnnee = () => {
    const nouvelleAnnee = nbAnnees + 1;
    setStoreAnnees(prev => ({
      ...prev,
      [nouvelleAnnee]: {
        mois: Array.from({ length: 12 }, EMPTY_MOIS),
        chargesAnnuellesBloc: EMPTY_CHARGES_ANNUELLES(),
        regime: "reel",
      }
    }));
    setNbAnnees(nouvelleAnnee);
    setAnneeExercice(nouvelleAnnee);
    setMoisActif(new Date().getMonth());
  };

  const handleSelectAnnee = (val) => {
    const v = +val;
    if (v !== anneeExercice) {
      setAnneeExercice(v);
      setMoisActif(new Date().getMonth());
    }
  };

  // Charges annuelles réparties en mensuel
  const appliquerChargesAnnuelles = () => {
    const newMois = donneesMois.map(m => {
      const updated = { ...m };
      CHARGES_KEYS.forEach(key => {
        const val = parse(chargesAnnuellesBloc[key]);
        if (val > 0) updated[key] = (val / 12).toFixed(2);
      });
      return updated;
    });
    updateAnneeData({ mois: newMois });
  };

  const updateMois = (i, champ, val) => {
    const newMois = [...donneesMois];
    newMois[i] = { ...newMois[i], [champ]: val };
    updateAnneeData({ mois: newMois });
  };

  const updateChargesAnnuellesBloc = (patch) =>
    updateAnneeData({ chargesAnnuellesBloc: { ...chargesAnnuellesBloc, ...patch } });

  // ── Calculs ───────────────────────────────────────────────────────────────
  const calculs = useMemo(() => donneesMois.map(m => {
    const ca = parse(m.ca);
    const chargesReelles = CHARGES_KEYS.reduce((s, k) => s + parse(m[k]), 0);
    const chargesDeductibles = regimeFiscal === "micro" ? ca * 0.34 : chargesReelles;
    return { ca, chargesDeductibles, chargesReelles, beneficeMensuel: ca - chargesDeductibles };
  }), [donneesMois, regimeFiscal]);

  const totaux = useMemo(() => {
    const caAnnuel = calculs.reduce((s, m) => s + m.ca, 0);
    const chargesAnnuelles = calculs.reduce((s, m) => s + m.chargesDeductibles, 0);
    const beneficeAnnuel = calculs.reduce((s, m) => s + m.beneficeMensuel, 0);
    const carpimko = calcCARPIMKO(beneficeAnnuel, anneeExercice);
    const urssaf = calcURSSAF(beneficeAnnuel, anneeExercice);
    const totalCotisations = carpimko.total + urssaf.total;
    const revenuNetAnnuel = beneficeAnnuel - totalCotisations;
    return {
      caAnnuel, chargesAnnuelles, beneficeAnnuel, carpimko, urssaf,
      totalCotisations, revenuNetAnnuel,
      revenuNetMensuelLisse: revenuNetAnnuel / 12,
      provisionMensuelle: totalCotisations / 12,
    };
  }, [calculs, anneeExercice]);

  const chartData = useMemo(() => MOIS.map((m, i) => ({
    mois: m,
    ca: calculs[i].ca,
    charges: calculs[i].chargesDeductibles,
    netEstime: Math.max(0, calculs[i].beneficeMensuel - totaux.provisionMensuelle),
  })), [calculs, totaux.provisionMensuelle]);

  const moisRemplis = calculs.filter(m => m.ca > 0).length;
  const tauxChargesTotaux = totaux.caAnnuel > 0
    ? ((totaux.chargesAnnuelles + totaux.totalCotisations) / totaux.caAnnuel * 100)
    : 0;
  const totalBlocAnnuel = CHARGES_KEYS.reduce((s, k) => s + parse(chargesAnnuellesBloc[k]), 0);

  // Indicateur de données saisies par année (pour le sélecteur)
  const anneeHasDonnees = (a) => storeAnnees[a].mois.some(m => m.ca !== "");

  // ── Styles ────────────────────────────────────────────────────────────────
  const s = {
    app: { minHeight: "100vh", background: "#070d14", color: "#c8dde8", fontFamily: "'DM Sans', sans-serif", fontSize: 14 },
    header: { borderBottom: "1px solid #132030", padding: "0 24px", display: "flex", alignItems: "center", gap: 16, height: 56, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 100, background: "#070d14" },
    logo: { display: "flex", alignItems: "center", gap: 8, marginRight: 4, flexShrink: 0 },
    logoIcon: { width: 30, height: 30, background: "linear-gradient(135deg, #0e8fa0, #06d6a0)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 },
    logoText: { fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: 14, color: "#e0f0f5", letterSpacing: "0.05em" },
    nav: { display: "flex", gap: 3, marginLeft: "auto", flexShrink: 0 },
    navBtn: (active) => ({ background: active ? "#0e2a38" : "transparent", border: active ? "1px solid #1e4a5e" : "1px solid transparent", borderRadius: 8, padding: "6px 14px", color: active ? "#06d6a0" : "#6a8fa0", cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono', monospace", transition: "all 0.15s" }),
    badge: (color) => ({ background: color + "22", border: `1px solid ${color}44`, color, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontFamily: "'DM Mono', monospace", flexShrink: 0 }),
    main: { padding: "24px", width: "100%", boxSizing: "border-box" },
    card: { background: "#0a151f", border: "1px solid #132030", borderRadius: 12, padding: "20px 24px", flex: 1 },
    cardTitle: { fontSize: 11, color: "#4a7a90", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 },
    bigNum: (color = "#e0f0f5") => ({ fontSize: 26, fontWeight: 700, color, fontFamily: "'DM Mono', monospace", lineHeight: 1.1 }),
    subNum: { fontSize: 12, color: "#4a7a90", marginTop: 4, fontFamily: "'DM Mono', monospace" },
    grid4: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 14 },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 },
    sectionTitle: { fontSize: 12, color: "#4a7a90", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 },
    input: { background: "#0a1520", border: "1px solid #1a3040", borderRadius: 8, padding: "10px 14px", color: "#c8dde8", fontSize: 13, fontFamily: "'DM Mono', monospace", width: "100%", outline: "none", boxSizing: "border-box" },
    label: { fontSize: 11, color: "#4a7a90", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, display: "block" },
    moisGrid: { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 20 },
    moisBtn: (active, hasCa) => ({ background: active ? "#0e3a50" : hasCa ? "#0a2030" : "#080e16", border: `1px solid ${active ? "#06d6a0" : hasCa ? "#1e4a5e" : "#132030"}`, borderRadius: 10, padding: "10px 12px", color: active ? "#06d6a0" : hasCa ? "#7ab5c8" : "#2a4a5a", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }),
    moisBtnLabel: { fontSize: 11, fontFamily: "'DM Mono', monospace", fontWeight: 600, letterSpacing: "0.05em" },
    moisBtnCa: { fontSize: 12, fontFamily: "'DM Mono', monospace", marginTop: 2 },
    pill: (color) => ({ display: "inline-flex", alignItems: "center", gap: 6, background: color + "15", border: `1px solid ${color}30`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontFamily: "'DM Mono', monospace", color }),
    divider: { borderTop: "1px solid #132030", margin: "18px 0" },
    cotisRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #0e1e28" },
    alertBox: (color) => ({ background: color + "10", border: `1px solid ${color}30`, borderRadius: 10, padding: "14px 18px", marginBottom: 12 }),
    select: { background: "#0a151f", border: "1px solid #1a3040", borderRadius: 8, padding: "6px 12px", color: "#c8dde8", fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer", outline: "none" },
    segmented: { display: "flex", background: "#0a151f", border: "1px solid #132030", borderRadius: 8, padding: 3, gap: 2 },
    segBtn: (active) => ({ background: active ? "#0e3a50" : "transparent", border: active ? "1px solid #1e4a5e" : "1px solid transparent", borderRadius: 6, padding: "5px 14px", color: active ? "#06d6a0" : "#4a7a90", cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono', monospace", transition: "all 0.15s" }),
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.app}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=DM+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; }
        @media (max-width: 900px) {
          .grid4 { grid-template-columns: repeat(2, 1fr) !important; }
          .grid2 { grid-template-columns: 1fr !important; }
          .mois-grid { grid-template-columns: repeat(4, 1fr) !important; }
          .cotis-recap { grid-template-columns: repeat(3, 1fr) !important; }
          .header-inner { flex-wrap: wrap; height: auto !important; padding: 12px 16px !important; gap: 10px !important; }
          .charges-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .detail-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          .grid4 { grid-template-columns: 1fr 1fr !important; }
          .mois-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .cotis-recap { grid-template-columns: repeat(2, 1fr) !important; }
          .charges-grid { grid-template-columns: 1fr 1fr !important; }
          .detail-grid { grid-template-columns: 1fr !important; }
          .main-pad { padding: 14px !important; }
        }
      `}</style>

      {/* HEADER */}
      <header style={s.header}>
        <div style={s.logo}>
          <div style={s.logoIcon}>🩺</div>
          <span style={s.logoText}>IDEL Compta</span>
        </div>

        {/* Sélecteur d'année avec indicateurs de données */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#4a7a90" }}>Année</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {Array.from({ length: nbAnnees }, (_, i) => i + 1).map(a => (
              <button
                key={a}
                onClick={() => handleSelectAnnee(a)}
                style={{
                  background: anneeExercice === a ? "#0e3a50" : "#0a151f",
                  border: `1px solid ${anneeExercice === a ? "#06d6a0" : anneeHasDonnees(a) ? "#1e4a5e" : "#132030"}`,
                  borderRadius: 8, padding: "5px 12px", cursor: "pointer",
                  fontFamily: "DM Mono, monospace", fontSize: 11,
                  color: anneeExercice === a ? "#06d6a0" : anneeHasDonnees(a) ? "#7ab5c8" : "#4a7a90",
                  display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s",
                }}
              >
                Année {a}
                {a <= 2 && <span style={{ fontSize: 9, color: a === anneeExercice ? "#8abe50" : "#3a5a30" }}>M</span>}
                {anneeHasDonnees(a) && (
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: anneeExercice === a ? "#06d6a0" : "#1e8fa0", display: "inline-block" }} />
                )}
              </button>
            ))}
            {/* Bouton + pour ajouter une année */}
            <button
              onClick={ajouterAnnee}
              title={`Ajouter l'année ${nbAnnees + 1}`}
              style={{
                background: "#0a151f",
                border: "1px dashed #1e4a5e",
                borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                fontFamily: "DM Mono, monospace", fontSize: 13,
                color: "#1e6a80", transition: "all 0.15s", lineHeight: 1,
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* Régime fiscal — verrouillé selon l'année */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#4a7a90" }}>Régime fiscal</span>
          <div style={{
            background: regimeFiscal === "reel" ? "#0e3a50" : "#1a2a10",
            border: `1px solid ${regimeFiscal === "reel" ? "#1e6a80" : "#3a5a20"}`,
            borderRadius: 8, padding: "5px 14px", display: "flex", alignItems: "center", gap: 7,
          }}>
            <span style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: regimeFiscal === "reel" ? "#06d6a0" : "#8abe50", fontWeight: 600 }}>
              {regimeFiscal === "reel" ? "Réel BNC (2035)" : "Micro-BNC"}
            </span>
            <span style={{ fontSize: 10, color: "#4a6a50" }}>🔒</span>
          </div>
        </div>

        {/* Libellé année active */}
        <div style={{ fontSize: 11, color: "#4a7a90", fontFamily: "DM Mono, monospace", background: "#0a151f", border: "1px solid #132030", borderRadius: 8, padding: "5px 12px" }}>
          {anneeLabel(anneeExercice)}
        </div>

        <nav style={s.nav}>
          {[["dashboard", "📊 Dashboard"], ["saisie", "✏️ Saisie"], ["cotisations", "🧾 Cotisations"]].map(([id, label]) => (
            <button key={id} style={s.navBtn(onglet === id)} onClick={() => setOnglet(id)}>{label}</button>
          ))}
        </nav>
      </header>

      <main className="main-pad" style={{ padding: "24px", width: "100%", boxSizing: "border-box" }}>

        {/* ── DASHBOARD ──────────────────────────────────────────────────── */}
        {onglet === "dashboard" && (
          <>
            <div className="grid4" style={s.grid4}>
              {[
                { label: "CA annuel estimé", value: formatEur(totaux.caAnnuel), sub: `${moisRemplis}/12 mois saisis`, color: "#c8dde8" },
                { label: "Bénéfice BNC brut", value: formatEur(totaux.beneficeAnnuel), sub: `Charges déd. : ${formatEur(totaux.chargesAnnuelles)}`, color: "#7ab5c8" },
                { label: "Revenu net annuel", value: formatEur(totaux.revenuNetAnnuel), sub: `Après URSSAF + CARPIMKO`, color: totaux.revenuNetAnnuel > 0 ? "#06d6a0" : "#e05555" },
                { label: "Revenu net / mois lissé", value: formatEur(totaux.revenuNetMensuelLisse), sub: `Taux charges totales : ${tauxChargesTotaux.toFixed(0)}%`, color: totaux.revenuNetMensuelLisse > 0 ? "#06d6a0" : "#e05555" },
              ].map((kpi, i) => (
                <div key={i} style={{ ...s.card, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: i === 3 ? "linear-gradient(90deg, #06d6a0, #0e8fa0)" : "linear-gradient(90deg, #1e4a5e, #0e2a38)" }} />
                  <div style={s.cardTitle}>{kpi.label}</div>
                  <div style={s.bigNum(kpi.color)}>{kpi.value}</div>
                  <div style={s.subNum}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            <div className="grid2" style={s.grid2}>
              <div style={s.card}>
                <div style={s.sectionTitle}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#06d6a0", display: "inline-block" }} />
                  Évolution mensuelle CA / Net estimé
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#132030" />
                    <XAxis dataKey="mois" tick={{ fill: "#4a7a90", fontSize: 10, fontFamily: "DM Mono" }} />
                    <YAxis tick={{ fill: "#4a7a90", fontSize: 10, fontFamily: "DM Mono" }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="ca" stroke="#0e8fa0" strokeWidth={2} name="CA" dot={false} />
                    <Line type="monotone" dataKey="netEstime" stroke="#06d6a0" strokeWidth={2} name="Net estimé" dot={false} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={s.card}>
                <div style={s.sectionTitle}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                  Répartition CA / Charges / Net
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#132030" />
                    <XAxis dataKey="mois" tick={{ fill: "#4a7a90", fontSize: 10, fontFamily: "DM Mono" }} />
                    <YAxis tick={{ fill: "#4a7a90", fontSize: 10, fontFamily: "DM Mono" }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="charges" stackId="a" fill="#1e3a50" name="Charges" radius={0} />
                    <Bar dataKey="netEstime" stackId="a" fill="#06d6a0" name="Net estimé" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={s.alertBox("#f59e0b")}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div>
                  <div style={{ color: "#f59e0b", fontFamily: "DM Mono", fontSize: 13, fontWeight: 600 }}>
                    Provision à mettre de côté : {formatEur(totaux.provisionMensuelle)}/mois
                  </div>
                  <div style={{ color: "#9a7040", fontSize: 12, marginTop: 4 }}>
                    URSSAF ({formatEur(totaux.urssaf.mensuel)}/mois) + CARPIMKO ({formatEur(totaux.carpimko.mensuel)}/mois) — Total annuel estimé : {formatEur(totaux.totalCotisations)}
                  </div>
                </div>
              </div>
            </div>

            {anneeExercice <= 2 && (
              <div style={s.alertBox("#e05555")}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 20 }}>🚨</span>
                  <div>
                    <div style={{ color: "#e05555", fontFamily: "DM Mono", fontSize: 13, fontWeight: 600 }}>
                      Attention : régularisation à venir en {anneeExercice === 1 ? "2ème" : "3ème"} année !
                    </div>
                    <div style={{ color: "#904040", fontSize: 12, marginTop: 4 }}>
                      Les cotisations forfaitaires actuelles seront recalculées sur les revenus réels. La différence peut être significative — épargne au minimum 50% du CA.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── SAISIE ────────────────────────────────────────────────── */}
        {onglet === "saisie" && (
          <>
            <style>{`
              @media (min-width: 960px) {
                .saisie-layout { display: grid; grid-template-columns: 1fr 380px; gap: 16px; align-items: start; }
              }
              @media (max-width: 959px) {
                .saisie-layout { display: flex; flex-direction: column; gap: 16px; }
              }
            `}</style>
            <div className="saisie-layout">
              {/* Colonne gauche : mois + charges annuelles */}
              <div>
            {/* Grille des 12 mois — CA saisissable directement dans chaque case */}
            <div style={s.sectionTitle}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#06d6a0", display: "inline-block" }} />
              CA mensuel — saisir directement ou cliquer pour détailler les charges
            </div>
            <div className="mois-grid" style={s.moisGrid}>
              {MOIS.map((m, i) => {
                const hasCa = calculs[i].ca > 0;
                const isActive = moisActif === i;
                return (
                  <div
                    key={i}
                    onClick={() => setMoisActif(i)}
                    style={{
                      background: isActive ? "#0e3a50" : hasCa ? "#0a2030" : "#080e16",
                      border: `1px solid ${isActive ? "#06d6a0" : hasCa ? "#1e4a5e" : "#132030"}`,
                      borderRadius: 10, padding: "10px 12px", cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{
                      fontSize: 11, fontFamily: "DM Mono, monospace", fontWeight: 600,
                      letterSpacing: "0.05em", marginBottom: 8,
                      color: isActive ? "#06d6a0" : hasCa ? "#7ab5c8" : "#2a4a5a",
                    }}>{m}</div>
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      value={donneesMois[i].ca}
                      onClick={e => e.stopPropagation()}
                      onFocus={() => setMoisActif(i)}
                      onChange={e => { updateMois(i, "ca", e.target.value); setMoisActif(i); }}
                      style={{
                        background: "transparent",
                        border: "none",
                        borderBottom: `1px solid ${isActive ? "#06d6a060" : hasCa ? "#1e4a5e" : "#1a3040"}`,
                        borderRadius: 0,
                        padding: "3px 0",
                        color: isActive ? "#e0f5ec" : hasCa ? "#c8dde8" : "#3a6070",
                        fontSize: 13,
                        fontFamily: "DM Mono, monospace",
                        fontWeight: 600,
                        width: "100%",
                        outline: "none",
                      }}
                    />
                  </div>
                );
              })}
            </div>

              {/* Charges annuelles fixes — ci-dessous dans la même colonne gauche si réel BNC */}
            </div>

              {/* Colonne droite : détail du mois sélectionné */}
              <div>
            {/* Détail du mois sélectionné */}
            <div style={{ ...s.card, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ ...s.sectionTitle, margin: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#06d6a0" }} />
                  Détail — {MOIS[moisActif]}
                </div>
                {calculs[moisActif].ca > 0 && (
                  <span style={s.pill("#06d6a0")}>✓ CA saisi</span>
                )}
              </div>

              {regimeFiscal === "reel" && (
                <>
                  <div style={{ ...s.sectionTitle, margin: "0 0 16px" }}>Charges déductibles du mois</div>
                  <div className="detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {CHARGES_KEYS.map(key => (
                      <div key={key}>
                        <label style={s.label}>{CHARGES_LABELS[key]} (€)</label>
                        <input
                          style={s.input} type="number" placeholder="0" min="0"
                          value={donneesMois[moisActif][key]}
                          onChange={e => updateMois(moisActif, key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {regimeFiscal === "micro" && (
                <div style={{ background: "#0e2a38", border: "1px solid #1e4a5e", borderRadius: 8, padding: "12px 16px" }}>
                  <div style={{ fontSize: 12, color: "#4a8fa0", fontFamily: "DM Mono", lineHeight: 1.8 }}>
                    <div style={{ color: "#7ab5c8", fontWeight: 600, marginBottom: 4 }}>Micro-BNC — année {anneeExercice}</div>
                    Les charges réelles ne sont <strong style={{ color: "#e05555" }}>pas déductibles</strong> en Micro-BNC.<br />
                    Abattement forfaitaire de <strong style={{ color: "#c8dde8" }}>34%</strong> appliqué automatiquement sur le CA.<br />
                    Équivalent abattement ce mois : <strong style={{ color: "#c8dde8" }}>{formatEur(calculs[moisActif].chargesDeductibles)}</strong>
                  </div>
                </div>
              )}

              {calculs[moisActif].ca > 0 && (
                <>
                  <div style={s.divider} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    {[
                      { label: "CA", value: formatEur(calculs[moisActif].ca), color: "#7ab5c8" },
                      { label: regimeFiscal === "micro" ? "Abattement 34%" : "Charges déd.", value: formatEur(calculs[moisActif].chargesDeductibles), color: "#e05555" },
                      { label: "Bénéfice", value: formatEur(calculs[moisActif].beneficeMensuel), color: "#06d6a0" },
                    ].map((item, i) => (
                      <div key={i} style={{ textAlign: "center", background: "#070d14", borderRadius: 8, padding: "10px 6px" }}>
                        <div style={{ fontSize: 10, color: "#4a7a90", fontFamily: "DM Mono", marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: item.color, fontFamily: "DM Mono" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Bloc charges annuelles fixes — en bas, uniquement en réel BNC */}
            {regimeFiscal === "reel" && (
              <div style={s.card}>
                <div style={s.sectionTitle}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                  Charges annuelles fixes — répartition automatique sur 12 mois
                </div>
                <div className="charges-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 16 }}>
                  {CHARGES_KEYS.map(key => (
                    <div key={key}>
                      <label style={s.label}>{CHARGES_LABELS[key]} / an (€)</label>
                      <input
                        style={s.input} type="number" placeholder="0" min="0"
                        value={chargesAnnuellesBloc[key]}
                        onChange={e => updateChargesAnnuellesBloc({ [key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#4a7a90", fontFamily: "DM Mono" }}>
                    Total annuel : <strong style={{ color: "#c8dde8" }}>{formatEur(totalBlocAnnuel)}</strong>
                    {totalBlocAnnuel > 0 && <span style={{ color: "#4a7a90" }}> → {formatEur(totalBlocAnnuel / 12)}/mois</span>}
                  </span>
                  <button
                    onClick={appliquerChargesAnnuelles}
                    disabled={totalBlocAnnuel === 0}
                    style={{
                      background: totalBlocAnnuel > 0 ? "#0e3a50" : "#0a151f",
                      border: `1px solid ${totalBlocAnnuel > 0 ? "#1e6a80" : "#132030"}`,
                      borderRadius: 8, padding: "8px 18px",
                      color: totalBlocAnnuel > 0 ? "#06d6a0" : "#2a4a5a",
                      cursor: totalBlocAnnuel > 0 ? "pointer" : "default",
                      fontFamily: "DM Mono, monospace", fontSize: 12,
                    }}
                  >
                    Répartir sur les 12 mois →
                  </button>
                </div>
              </div>
            )}
              </div>{/* fin colonne droite */}
            </div>{/* fin saisie-layout */}
          </>
        )}

        {/* ── COTISATIONS ────────────────────────────────────────────────── */}
        {onglet === "cotisations" && (
          <>
            <div className="grid2" style={s.grid2}>
              <div style={s.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={s.cardTitle}>URSSAF — Estimé annuel</div>
                    <div style={s.bigNum("#0e8fa0")}>{formatEur(totaux.urssaf.total)}</div>
                    <div style={s.subNum}>{totaux.urssaf.detail} · {formatEur(totaux.urssaf.mensuel)}/mois</div>
                  </div>
                  <span style={s.badge("#0e8fa0")}>Mensuel</span>
                </div>
                <div style={s.divider} />
                {[
                  { label: "Maladie-maternité", taux: "4% → 6.7%" },
                  { label: "Allocations familiales", taux: "0% → 3.1%" },
                  { label: "CSG / CRDS", taux: "9.7%" },
                  { label: "Retraite de base", taux: "~10.75%" },
                  { label: "Invalidité-décès", taux: "1.3% (plafonné)" },
                ].map((row, i) => (
                  <div key={i} style={s.cotisRow}>
                    <span style={{ fontSize: 12, color: "#7ab5c8" }}>{row.label}</span>
                    <span style={{ fontSize: 11, fontFamily: "DM Mono", color: "#4a7a90" }}>{row.taux}</span>
                  </div>
                ))}
                <div style={{ ...s.alertBox("#0e8fa0"), marginTop: 16, marginBottom: 0 }}>
                  <div style={{ fontSize: 11, color: "#0e8fa0", fontFamily: "DM Mono" }}>
                    📅 Paiement : mensuel ou trimestriel<br />
                    ⚡ Calculé sur revenus N-1 · Régularisation en cours d'année
                  </div>
                </div>
              </div>

              <div style={s.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={s.cardTitle}>CARPIMKO — Estimé annuel</div>
                    <div style={s.bigNum("#f59e0b")}>{formatEur(totaux.carpimko.total)}</div>
                    <div style={s.subNum}>{totaux.carpimko.detail} · {formatEur(totaux.carpimko.mensuel)}/mois</div>
                  </div>
                  <span style={s.badge("#f59e0b")}>Annuel</span>
                </div>
                <div style={s.divider} />
                {[
                  { label: "Retraite de base", valeur: anneeExercice >= 3 ? `${(CARPIMKO_2025.base_taux*100).toFixed(2)}% du bénéfice` : "Forfaitaire" },
                  { label: "Retraite complémentaire", valeur: `${formatEur(CARPIMKO_2025.complementaire_forfait)} + 3%` },
                  { label: "Invalidité-décès", valeur: `${formatEur(CARPIMKO_2025.invalidite_deces)} forfait` },
                  { label: "ASV (part assurée)", valeur: `${formatEur(CARPIMKO_2025.asv_assure)} forfait` },
                ].map((row, i) => (
                  <div key={i} style={s.cotisRow}>
                    <span style={{ fontSize: 12, color: "#c8a860" }}>{row.label}</span>
                    <span style={{ fontSize: 11, fontFamily: "DM Mono", color: "#4a7a90" }}>{row.valeur}</span>
                  </div>
                ))}
                <div style={{ ...s.alertBox("#f59e0b"), marginTop: 16, marginBottom: 0 }}>
                  <div style={{ fontSize: 11, color: "#c8a050", fontFamily: "DM Mono" }}>
                    📅 Appel annuel CARPIMKO — généralement mars/avril<br />
                    {anneeExercice === 3 ? "✅ 3ème année : premières cotisations définitives" : anneeExercice <= 2 ? "⚠️ Régularisation à prévoir sur revenus réels" : "✅ Rythme de croisière"}
                  </div>
                </div>
              </div>
            </div>

            <div style={s.card}>
              <div style={s.sectionTitle}>Récapitulatif & Simulation annuelle</div>
              <div className="cotis-recap" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0 }}>
                {[
                  { label: "CA Annuel", value: totaux.caAnnuel, color: "#c8dde8", bg: "#070d14" },
                  { label: "Charges déd.", value: totaux.chargesAnnuelles, color: "#e05555", bg: "#070d14" },
                  { label: "URSSAF", value: totaux.urssaf.total, color: "#0e8fa0", bg: "#070d14" },
                  { label: "CARPIMKO", value: totaux.carpimko.total, color: "#f59e0b", bg: "#070d14" },
                  { label: "Revenu net", value: totaux.revenuNetAnnuel, color: totaux.revenuNetAnnuel > 0 ? "#06d6a0" : "#e05555", bg: "#0a1e10" },
                ].map((item, i) => (
                  <div key={i} style={{ background: item.bg, borderRight: i < 4 ? "1px solid #132030" : "none", padding: "16px 20px", textAlign: i === 4 ? "right" : "left" }}>
                    <div style={{ fontSize: 10, color: "#4a7a90", fontFamily: "DM Mono", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: item.color, fontFamily: "DM Mono" }}>{formatEur(item.value)}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "#06d6a010", border: "1px solid #06d6a030", borderRadius: 8, padding: "14px 20px", marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#4da870", fontFamily: "DM Mono" }}>
                  💚 Revenu net mensuel lissé sur 12 mois
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color: "#06d6a0", fontFamily: "DM Mono" }}>
                  {formatEur(totaux.revenuNetMensuelLisse)} / mois
                </span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
