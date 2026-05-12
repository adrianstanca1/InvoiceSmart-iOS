const currency = (c: string) => c === 'GBP' ? '£' : c === 'EUR' ? '€' : '$';

export const ModernTemplate = (inv: any, calc: any) => `
<!DOCTYPE html><html><head><style>body{font-family:sans-serif;padding:40px;color:#333}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px}
.title{font-size:2.5em;font-weight:300;color:${inv.brandColor||'#0f172a'};margin:0}
.info{text-align:right}
table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:12px;text-align:left;border-bottom:1px solid #e5e7eb}
th{background:#f8fafc;font-weight:600}
.total{font-size:1.5em;font-weight:700;color:${inv.brandColor||'#2563eb'};text-align:right;margin-top:20px}
</style></head><body>
  <div class="header">
    <div><h1 class="title">INVOICE</h1><p>#${inv.invoiceNumber}</p></div>
    <div class="info">
      <h3>${inv.fromName||'Your Company'}</h3>
      <p>${(inv.fromAddress||'').replace(/\n/g,'<br>')}</p>
      <p>${inv.fromEmail}</p>
    </div>
  </div>
  <div><h4>Bill To: ${inv.toName}</h4><p>${(inv.toAddress||'').replace(/\n/g,'<br>')}</p><p>${inv.toEmail}</p></div>
  <table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
    ${inv.lineItems.map((i:any)=>`<tr><td>${i.description}</td><td>${i.quantity}</td><td>${currency(inv.currency)}${i.rate.toFixed(2)}</td><td>${currency(inv.currency)}${(i.quantity*i.rate).toFixed(2)}</td></tr>`).join('')}
  </tbody></table>
  <div class="total">Total Due: ${currency(inv.currency)}${calc.amountDue.toFixed(2)}</div>
  <p>Terms: ${inv.terms}</p>
</body></html>`;

export const ClassicTemplate = (inv: any, calc: any) => ModernTemplate(inv, calc).replace('font-size:2.5em', 'font-size:2em').replace('color:#333', 'color:#1a1a1a');
export const MinimalTemplate = (inv: any, calc: any) => ModernTemplate(inv, calc).replace('padding:40px', 'padding:20px').replace('font-size:2.5em', 'font-size:1.8em');
