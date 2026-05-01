export const TRANSACTION_SAVED_EVENT = "monqom:transaction-saved";

export function emitTransactionSaved(): void {
  window.dispatchEvent(new Event(TRANSACTION_SAVED_EVENT));
}
