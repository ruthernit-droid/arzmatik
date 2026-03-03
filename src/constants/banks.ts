export interface Bank {
  id: string;
  name: string;
  shortName: string;
  loginUrl: string;
  logo?: string;
  isCustom?: boolean;
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

export const getBankLoginUrl = (bankId: string): string => {
  const bank = getBankById(bankId);
  return bank?.loginUrl || '';
};
