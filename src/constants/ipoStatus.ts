export const IPO_STATUSES = [
  { id: "duyuru", label: "Duyuru", color: "blue", description: "Halka arz duyuruldu" },
  { id: "basvuru_acik", label: "Başvuru Açık", color: "cyan", description: "Başvuru dönemi başladı" },
  { id: "talep_toplaniyor", label: "Talep Toplanıyor", color: "yellow", description: "Talep toplama süreci" },
  { id: "talep_kapandi", label: "Talep Kapandı", color: "orange", description: "Talep toplama sona erdi" },
  { id: "tahsis", label: "Tahsis", color: "purple", description: "Tahsis işlemleri yapılıyor" },
  { id: "sonuclar", label: "Sonuçlar", color: "emerald", description: "Sonuçlar açıklandı" },
  { id: "listeleme", label: "Listeleme", color: "green", description: "Hisse borsada işlem görmeye başladı" },
] as const;

export type IpoStatus = typeof IPO_STATUSES[number]["id"];

export const getNextStatus = (currentStatus: IpoStatus): IpoStatus | null => {
  const currentIndex = IPO_STATUSES.findIndex((s) => s.id === currentStatus);
  if (currentIndex === -1 || currentIndex === IPO_STATUSES.length - 1) return null;
  return IPO_STATUSES[currentIndex + 1].id;
};

export const getStatusInfo = (statusId: string) => {
  return IPO_STATUSES.find((s) => s.id === statusId) || IPO_STATUSES[0];
};
