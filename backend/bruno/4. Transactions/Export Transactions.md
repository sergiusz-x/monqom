# Export Transactions

- `Export Transactions CSV.bru` downloads a CSV attachment with display-formatted amounts.
- `Export Transactions JSON.bru` downloads a JSON attachment where `amount` is a fixed two-decimal string, for example `"10.50"`, not integer cents.
- Both requests accept optional `date_from` and `date_to` query params and only include non-deleted workspace transactions.
