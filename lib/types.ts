export type TxType = "income" | "expense";

export interface Tx {
  id: string;
  createdAt: string;
  date: string; // YYYY-MM-DD
  type: TxType;
  amount: number;
  category: string;
  note: string;
  bank: string;
  transRef: string;
  slipFileId: string;
}
