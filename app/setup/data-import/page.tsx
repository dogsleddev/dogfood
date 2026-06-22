import { PlaceholderPage } from "@/components/shell/placeholder-page";

export default function DataImportPage() {
  return (
    <PlaceholderPage
      kicker="Setup"
      layer="Config · feeds source records"
      title="Data Import"
      description="CSV / XLSX templates (trial balance, JEs, COA, budget, headcount, AR/AP aging, customers/vendors, FX) plus the single live ERP connection — the one and only live integration."
      queries={["ErpConnector (stub)"]}
    />
  );
}
