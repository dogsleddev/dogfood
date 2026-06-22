import { PlaceholderPage } from "@/components/shell/placeholder-page";

export default function DataImportPage() {
  return (
    <PlaceholderPage
      kicker="Setup"
      layer="Config · feeds source records"
      title="Data Import"
      description="Batch CSV / XLSX imports for every data domain on a stable-id upsert: trial balance + COA + JEs from the ERP, customers / contracts / pipeline from the CRM, staff from HRIS, vendors from AP, plus budget, AR/AP aging, and FX. Live API connectors are on the roadmap; the CSV template is the contract a connector fills."
      queries={["ErpConnector (stub)"]}
    />
  );
}
