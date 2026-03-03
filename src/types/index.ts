export interface IPO {
  id?: string;
  companyName?: string;
  ticker?: string;
  price?: number;
  ipoPrice?: number;
  totalOfferedLots?: number;
  status?: string;
  demandEndDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  priceUpdatedAt?: string;
  source?: string;
  sourceLink?: string;
  sourceStatusText?: string;
  isIpo?: boolean;
  exchange?: string;
  symbol?: string;
  ipoDateText?: string;
}

export interface Account {
  id?: string;
  ownerName?: string;
  bankName?: string;
  cashBalance?: number;
  accountNumber?: string;
  idNo?: string;
  password?: string;
  notes?: string;
  isActive?: boolean;
  updatedAt?: string;
}

export interface Participation {
  id?: string;
  accountId?: string;
  ipoId?: string;
  ticker?: string;
  requestedLots?: number;
  allottedLots?: number;
  status?: string;
  purchaseType?: 'ipo' | 'portfolio';
  lotPrice?: number;
  sellPrice?: number;
  saleDate?: string;
  notes?: string;
  updatedAt?: string;
}

export interface PortfolioItem {
  ipoId: string;
  ticker: string;
  totalLots: number;
  totalCost: number;
  types: string[];
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
