"use client";

// 스크래치 부스 — 티켓 등급을 골라 사면 복권이 나오고, 긁으면 당첨 확인.
// 흐름: 구매(onPlay) → 긁기 → 공개(onWin) → 확인(onDone). 연출 중엔 부모가 locked 로 잠근다.
import { useState } from "react";
import {
  TICKET_TIERS,
  drawTicket,
  type TicketResult,
  type TicketTier,
} from "../../lib/game/rules";
import ScratchCard from "./ScratchCard";
import { burstConfetti, sfx } from "./juice";

interface Props {
  coins: number;
  locked: boolean;
  onPlay: (cost: number) => boolean; // 부모가 코인·기회 차감. 성공 여부 반환
  onWin: (win: number) => void; // 공개 순간 당첨금 지급 (0 포함)
  onDone: () => void; // 티켓 닫힘 — 부모가 잠금 해제 + 판정
}

const TIER_BADGE: Record<TicketTier["id"], { icon: string; grad: string }> = {
  bronze: { icon: "🥉", grad: "linear-gradient(135deg, #8a5a2b, #c98d4f)" },
  silver: { icon: "🥈", grad: "linear-gradient(135deg, #8d99a6, #cfd8e0)" },
  gold: { icon: "🥇", grad: "linear-gradient(135deg, #b8860b, #f5c542)" },
};

interface ActiveTicket {
  tier: TicketTier;
  result: TicketResult;
}

export default function ScratchBooth({ coins, locked, onPlay, onWin, onDone }: Props) {
  const [ticket, setTicket] = useState<ActiveTicket | null>(null);
  const [revealed, setRevealed] = useState(false);

  function buy(tier: TicketTier) {
    if (locked || ticket !== null) return;
    if (!onPlay(tier.cost)) return;
    sfx.blip();
    setTicket({ tier, result: drawTicket(tier) });
    setRevealed(false);
  }

  function handleRevealed() {
    if (ticket === null || revealed) return;
    setRevealed(true);
    const { prize } = ticket.result;
    onWin(prize);
    if (prize > 0) {
      if (prize >= ticket.tier.cost * 10) {
        sfx.jackpot();
        burstConfetti(150, 0.5, 0.4);
        setTimeout(() => burstConfetti(100, 0.3, 0.5), 300);
      } else {
        sfx.win();
        burstConfetti(70, 0.5, 0.45);
      }
      setTimeout(() => sfx.coin(), 250);
    } else {
      sfx.lose();
    }
  }

  function dismiss() {
    sfx.blip();
    setTicket(null);
    setRevealed(false);
    onDone();
  }

  const maxPrize = (tier: TicketTier) =>
    Math.max(...tier.prizes.map((p) => p.value));

  return (
    <div>
      {ticket === null ? (
        <>
          <p style={st.hint}>티켓을 고르세요 — 같은 금액 3개면 당첨!</p>
          <div style={st.tierRow}>
            {TICKET_TIERS.map((tier) => {
              const disabled = locked || coins < tier.cost;
              return (
                <button
                  key={tier.id}
                  type="button"
                  className="tier-card"
                  data-testid={`ticket-${tier.id}`}
                  disabled={disabled}
                  onClick={() => buy(tier)}
                >
                  <span style={{ ...st.tierBadge, background: TIER_BADGE[tier.id].grad }}>
                    {TIER_BADGE[tier.id].icon}
                  </span>
                  <span style={st.tierName}>{tier.name}</span>
                  <span style={st.tierCost}>🪙 {tier.cost}</span>
                  <span style={st.tierMax}>최고 {maxPrize(tier).toLocaleString()}</span>
                  {coins < tier.cost ? <span style={st.tierLack}>코인 부족</span> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="pop-in">
          <div style={st.ticketFrame} data-testid="active-ticket">
            <div style={st.ticketHead}>
              {TIER_BADGE[ticket.tier.id].icon} {ticket.tier.name} — 같은 금액 3개를 찾아라!
            </div>
            <ScratchCard onRevealed={handleRevealed} height={172}>
              <div style={st.cellGrid} data-testid="ticket-cells">
                {ticket.result.cells.map((amount, i) => {
                  const isHit = revealed && ticket.result.prize > 0 && amount === ticket.result.prize;
                  return (
                    <div key={i} style={{ ...st.cell, ...(isHit ? st.cellHit : null) }}>
                      🪙{amount.toLocaleString()}
                    </div>
                  );
                })}
              </div>
            </ScratchCard>
          </div>

          {revealed ? (
            <div style={{ textAlign: "center", marginTop: 12 }} className="pop-in">
              <div style={st.resultLine} data-testid="ticket-result">
                {ticket.result.prize > 0 ? (
                  <span style={{ color: "#f5c542", fontWeight: 800 }}>
                    당첨! +{ticket.result.prize.toLocaleString()}코인
                  </span>
                ) : (
                  <span style={{ color: "#b8a58f" }}>꽝… 다음 티켓에 몰아주자</span>
                )}
              </div>
              <button type="button" className="btn-gold" data-testid="ticket-done" onClick={dismiss}>
                확인
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  hint: { textAlign: "center", color: "#d9c9ae", fontSize: 14, margin: "4px 0 14px" },
  tierRow: { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" },
  tierBadge: {
    width: 44,
    height: 44,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    marginBottom: 8,
  },
  tierName: { fontWeight: 700, fontSize: 15, color: "#f7ecd7" },
  tierCost: { fontSize: 14, color: "#f5c542", fontWeight: 700, marginTop: 2 },
  tierMax: { fontSize: 12, color: "#b8a58f", marginTop: 4 },
  tierLack: { fontSize: 11, color: "#e07a6a", marginTop: 4, fontWeight: 700 },
  ticketFrame: {
    background: "linear-gradient(180deg, #2a2320, #1d1815)",
    border: "1px solid #6b5215",
    borderRadius: 14,
    padding: 12,
    maxWidth: 460,
    margin: "0 auto",
  },
  ticketHead: {
    textAlign: "center",
    color: "#e8c86a",
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  cellGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    padding: 10,
    width: "100%",
    boxSizing: "border-box",
    background: "#f7eed9",
    borderRadius: 8,
  },
  cell: {
    background: "#fffdf6",
    border: "1px dashed #cbb98f",
    borderRadius: 8,
    padding: "14px 4px",
    textAlign: "center",
    fontWeight: 700,
    fontSize: 14,
    color: "#5a4a2f",
  },
  cellHit: {
    background: "#fff3c9",
    border: "2px solid #d4a017",
    color: "#8a6400",
    boxShadow: "0 0 10px rgba(245,197,66,0.5)",
  },
  resultLine: { fontSize: 17, marginBottom: 10, minHeight: 24 },
};
