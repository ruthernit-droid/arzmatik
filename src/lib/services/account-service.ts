import {
  collection,
  getDocs,
  getDoc,
  deleteDoc,
  query,
  doc,
  setDoc
} from "firebase/firestore";
import { db } from "../firebase";
import type { Account } from "@/types";

export const accountService = {
  async getAll(userId: string): Promise<Account[]> {
    const accountsRef = collection(db, `users/${userId}/accounts`);
    const querySnapshot = await getDocs(accountsRef);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Account[];
  },

  async getById(userId: string, accountId: string): Promise<Account | null> {
    const docRef = doc(db, `users/${userId}/accounts/${accountId}`);
    const snap = await getDoc(docRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } as Account : null;
  },

  async save(userId: string, account: Account): Promise<string> {
    const accountRef = account.id
      ? doc(db, `users/${userId}/accounts/${account.id}`)
      : doc(collection(db, `users/${userId}/accounts`));

    await setDoc(accountRef, {
      ownerName: account.ownerName || (account as any).name || 'İsimsiz',
      bankName: account.bankName || (account as any).bank || 'Bilinmeyen Banka',
      cashBalance: Number(account.cashBalance !== undefined ? account.cashBalance : (account as any).cash || 0),
      accountNumber: account.accountNumber || '',
      idNo: account.idNo || '',
      password: account.password || '',
      notes: account.notes || '',
      isActive: account.isActive ?? true,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return accountRef.id;
  },

  async delete(userId: string, accountId: string): Promise<void> {
    await deleteDoc(doc(db, `users/${userId}/accounts/${accountId}`));
  }
};
