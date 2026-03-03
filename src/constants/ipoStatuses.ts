export type IpoStatus = 
  | "duyuru"        
  | "basvuru_acik"   
  | "talep_toplaniyor"  
  | "talep_kapandi"         
  | "tahsis"     
  | "sonuclar"       
  | "listeleme";

export const IPO_STATUSES: { id: string; label: string; color: string; description: string }[] = [
  { id: "duyuru", label: "Duyuru", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", description: "Halka arz duyuruldu" },
  { id: "basvuru_acik", label: "Başvuru Açık", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", description: "Başvuru dönemi başladı" },
  { id: "talep_toplaniyor", label: "Talepte", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", description: "Talep toplama süreci" },
  { id: "talep_kapandi", label: "Talep Kapandı", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", description: "Talep toplama sona erdi" },
  { id: "tahsis", label: "Tahsis", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", description: "Tahsis işlemleri yapılıyor" },
  { id: "sonuclar", label: "Sonuçlar", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", description: "Sonuçlar açıklandı" },
  { id: "listeleme", label: "Listeleme", color: "bg-green-500/20 text-green-400 border-green-500/30", description: "Hisse borsada işlem görmeye başladı" },
];

// Legacy status mapping for backward compatibility
export const LEGACY_STATUS_MAP: Record<string, string> = {
  "Duyuru": "duyuru",
  "duyuru": "duyuru",
  "Onaylandı": "basvuru_acik",
  "Basvuru Acik": "basvuru_acik",
  "Başvuru Açık": "basvuru_acik",
  "Talep Toplanıyor": "talep_toplaniyor",
  "Talep Toplaniyor": "talep_toplaniyor",
  "Yolda": "talep_toplaniyor",
  "Talep Kapandı": "talep_kapandi",
  "Talep Kapandi": "talep_kapandi",
  "Tahsis": "tahsis",
  "Sonuçlar": "sonuclar",
  "Sonuclar": "sonuclar",
  "Dağıtıldı": "sonuclar",
  "Borsada": "listeleme",
  "Borsada İşlem Görüyor": "listeleme",
  "Borsada Islem Goruyor": "listeleme",
  "Listeleme": "listeleme",
  "Kapandı": "listeleme",
  "Kapandi": "listeleme",
};

export const CAN_PARTICIPATE_STATUSES = ["basvuru_acik", "talep_toplaniyor"];
export const IS_ACTIVE_STATUSES = ["duyuru", "basvuru_acik", "talep_toplaniyor", "talep_kapandi", "tahsis"];

export const normalizeIpoStatus = (status: string): string => {
  const raw = String(status || "").trim();
  if (!raw) return "";

  const direct = IPO_STATUSES.find((s) => s.id === raw);
  if (direct) return direct.id;

  const byLabel = IPO_STATUSES.find((s) => s.label === raw);
  if (byLabel) return byLabel.id;

  const legacy = LEGACY_STATUS_MAP[raw];
  if (legacy) return legacy;

  return raw;
};

export const getStatusColor = (status: string): string => {
  const normalized = normalizeIpoStatus(status);
  const found = IPO_STATUSES.find(s => s.id === normalized);
  if (found) return found.color;
  return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
};

export const getStatusLabel = (status: string): string => {
  const normalized = normalizeIpoStatus(status);
  const found = IPO_STATUSES.find(s => s.id === normalized);
  if (found) return found.label;
  return status;
};

export const getNextStatus = (currentStatus: string): string | null => {
  const normalized = normalizeIpoStatus(currentStatus);
  const currentIndex = IPO_STATUSES.findIndex(s => s.id === normalized);
  if (currentIndex === -1 || currentIndex === IPO_STATUSES.length - 1) return null;
  return IPO_STATUSES[currentIndex + 1].id;
};

export const getStatusDescription = (status: string): string => {
  const normalized = normalizeIpoStatus(status);
  const found = IPO_STATUSES.find(s => s.id === normalized);
  return found?.description || "";
};
