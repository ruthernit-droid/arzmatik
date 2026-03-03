import {
  collection,
  getDocs,
  getDoc,
  deleteDoc,
  updateDoc,
  query,
  doc,
  setDoc,
  orderBy,
  where
} from "firebase/firestore";
import { db } from "../firebase";
import type { IPO } from "@/types";

export const ipoService = {
  async getAll(): Promise<IPO[]> {
    const ipoRef = collection(db, "ipos");
    const q = query(ipoRef, orderBy("updatedAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as IPO[];
  },

  async getById(id: string): Promise<IPO | null> {
    const docRef = doc(db, "ipos", id);
    const snap = await getDoc(docRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } as IPO : null;
  },

  async save(ipo: IPO): Promise<string> {
    if (!ipo.id && ipo.ticker) {
      const q = query(collection(db, "ipos"), where("ticker", "==", ipo.ticker.toUpperCase()));
      const existing = await getDocs(q);
      if (!existing.empty) {
        ipo.id = existing.docs[0].id;
      }
    }

    const ipoRef = ipo.id
      ? doc(db, "ipos", ipo.id)
      : doc(collection(db, "ipos"));

    const data: Record<string, any> = {
      companyName: ipo.companyName || (ipo as any).name || 'Bilinmeyen Şirket',
      ticker: ipo.ticker || '',
      price: Number(ipo.price || 0),
      ipoPrice: Number(ipo.ipoPrice ?? ipo.price ?? 0),
      totalOfferedLots: Number(ipo.totalOfferedLots || 0),
      status: ipo.status || 'Talep Toplanıyor',
      demandEndDate: ipo.demandEndDate || null,
      updatedAt: new Date().toISOString(),
    };

    if (ipo.price !== undefined && ipo.price !== null) {
      data.priceUpdatedAt = new Date().toISOString();
    }

    if (!ipo.id) {
      data.createdAt = new Date().toISOString();
    }

    await setDoc(ipoRef, data, { merge: true });
    return ipoRef.id;
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'ipos', id));
  },

  async updatePrice(id: string, newPrice: number): Promise<void> {
    await updateDoc(doc(db, 'ipos', id), {
      price: newPrice,
      priceUpdatedAt: new Date().toISOString(),
    });
  }
};
