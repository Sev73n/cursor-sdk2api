import { Button } from "../bflabs/Button";
import { catalogHasFable5 } from "../fable5";
import { hrefFor } from "../nav";
import { formatGrokBotQuota, formatQuota, formatQuotaBreakdown } from "../quota";
import { identityLabel, type RosterItem } from "../roster";
import { ActionLink } from "./shared";

export function AccountTable({
  items,
  quotaMissing,
  grokBotQuota,
  grokBotMissing,
  fableOn,
  fableOff,
  fableUnknown,
  testing,
  test,
  testFail,
  open,
  remove,
  orderUp,
  orderDown,
  headers,
  onTest,
  onRemove,
  onReorder,
}: {
  items: RosterItem[];
  quotaMissing: string;
  grokBotQuota: string;
  grokBotMissing: string;
  fableOn: string;
  fableOff: string;
  fableUnknown: string;
  testing: string;
  test: string;
  testFail: string;
  open: string;
  remove?: string;
  orderUp?: string;
  orderDown?: string;
  headers: [string, string, string, string];
  onTest: (id: string) => void;
  onRemove?: (id: string) => void;
  onReorder?: (id: string, direction: -1 | 1) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="grid-table">
        <thead>
          <tr>
            {headers.map((label) => <th key={label}>{label}</th>)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const quota = formatQuota(item.account);
            const quotaBreakdown = formatQuotaBreakdown(item.account);
            const grokQuota = formatGrokBotQuota(item.account);
            const fable = item.models ? (catalogHasFable5(item.models) ? fableOn : fableOff) : fableUnknown;
            const probe =
              item.testState === "testing"
                ? testing
                : item.testState === "pass"
                  ? `${item.testMs ?? 0} ms`
                  : item.testState === "fail"
                    ? item.testError || testFail
                    : "—";
            return (
              <tr key={item.id}>
                <td>
                  <a className="row-link" href={hrefFor("account", item.id)}>
                    <strong>{identityLabel(item.account, item.keyHint)}</strong>
                    <span className="sub">{item.account?.identity?.api_key_name || item.keyHint}</span>
                  </a>
                </td>
                <td>
                  <span>{quota || quotaMissing}</span>
                  {quotaBreakdown ? <span className="sub quota-breakdown">{quotaBreakdown}</span> : null}
                  <span className="sub quota-breakdown">{grokBotQuota} {grokQuota || grokBotMissing}</span>
                </td>
                <td>{fable}</td>
                <td>{probe}</td>
                <td className="row-actions">
                  <div className="row-action-group">
                    {onReorder && orderUp && orderDown ? (
                      <>
                        <Button variant="quiet" size="sm" disabled={index === 0} onClick={() => onReorder(item.id, -1)}>{orderUp}</Button>
                        <Button variant="quiet" size="sm" disabled={index === items.length - 1} onClick={() => onReorder(item.id, 1)}>{orderDown}</Button>
                      </>
                    ) : null}
                    <Button variant="secondary" size="sm" disabled={item.testState === "testing"} onClick={() => onTest(item.id)}>
                      {item.testState === "testing" ? testing : test}
                    </Button>
                    <ActionLink href={hrefFor("account", item.id)}>{open}</ActionLink>
                    {onRemove && remove ? (
                      <Button variant="quiet" size="sm" onClick={() => onRemove(item.id)}>{remove}</Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
