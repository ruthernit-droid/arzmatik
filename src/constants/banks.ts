export interface Bank {
  id: string;
  name: string;
  shortName: string;
  loginUrl: string;
  logo?: string;
  isCustom?: boolean;
}

function normalizeBankKey(input: string): string {
  return String(input || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "c")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export const BANKS: Bank[] = [
  { 
    id: 'ziraat', 
    name: 'Ziraat Bankası', 
    shortName: 'Ziraat',
    loginUrl: 'https://bireysel.ziraatbank.com.tr' 
  },
  { 
    id: 'vakif', 
    name: 'VakıfBank', 
    shortName: 'VakıfBank',
    loginUrl: 'https://www.vakifbank.com.tr' 
  },
  { 
    id: 'akbank', 
    name: 'Akbank', 
    shortName: 'Akbank',
    loginUrl: 'https://www.akbank.com' 
  },
  { 
    id: 'garanti', 
    name: 'Garanti BBVA', 
    shortName: 'Garanti',
    loginUrl: 'https://www.garantibbb.com.tr' 
  },
  { 
    id: 'isbank', 
    name: 'İş Bankası', 
    shortName: 'İş Bank',
    loginUrl: 'https://www.isbank.com.tr' 
  },
  { 
    id: 'yapikredi', 
    name: 'Yapı Kredi', 
    shortName: 'Yapı Kredi',
    loginUrl: 'https://www.yapikredi.com.tr' 
  },
  { 
    id: 'halkbank', 
    name: 'Halkbank', 
    shortName: 'Halkbank',
    loginUrl: 'https://www.halkbank.com.tr' 
  },
  { 
    id: 'teb', 
    name: 'TEB', 
    shortName: 'TEB',
    loginUrl: 'https://www.teb.com.tr' 
  },
  { 
    id: 'qnb', 
    name: 'QNB Finansbank', 
    shortName: 'QNB',
    loginUrl: 'https://www.qnb.com.tr' 
  },
  { 
    id: 'ceyrel', 
    name: 'Çeyrek Yatırım', 
    shortName: 'Çeyrek',
    loginUrl: 'https://www.ceyreyatirim.com.tr' 
  },
  { 
    id: 'other', 
    name: 'Diğer', 
    shortName: 'Diğer',
    loginUrl: '' 
  },
];

export const getBankById = (id: string): Bank | undefined => {
  return BANKS.find(bank => bank.id === id);
};

export const getBankLoginUrl = (bankIdOrName: string): string => {
  const raw = String(bankIdOrName || "").trim();
  if (!raw) return "";

  // 1) Exact id match
  const byId = getBankById(raw);
  if (byId?.loginUrl) return byId.loginUrl;

  // 2) Normalized id/name/shortName match
  const key = normalizeBankKey(raw);
  for (const bank of BANKS) {
    if (!bank.loginUrl) continue;
    const idKey = normalizeBankKey(bank.id);
    const nameKey = normalizeBankKey(bank.name);
    const shortKey = normalizeBankKey(bank.shortName);
    if (key === idKey || key === nameKey || key === shortKey) return bank.loginUrl;
  }

  // 3) Contains fallback for entries like "Ziraat Bankasi", "Yapi Kredi Bank"
  for (const bank of BANKS) {
    if (!bank.loginUrl) continue;
    const nameKey = normalizeBankKey(bank.name);
    const shortKey = normalizeBankKey(bank.shortName);
    if (key.includes(nameKey) || key.includes(shortKey) || nameKey.includes(key) || shortKey.includes(key)) {
      return bank.loginUrl;
    }
  }

  return "";
};
