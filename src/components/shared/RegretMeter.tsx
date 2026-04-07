"use client";

// ============================================================================
// Regret Meter — shows what you COULD have earned with a different prediction
// "If you had predicted 2-0 instead of 1-0, you'd have earned +1 more point"
// ============================================================================

interface RegretMeterProps {
  yourPrediction: { home: number; away: number };
  actualResult: { home: number; away: number };
  stage: "GROUP" | "R32" | "R16" | "QF" | "SF" | "THIRD" | "FINAL";
}

const TOTO_POINTS: Record<string, number> = {
  GROUP: 2, R32: 3, R16: 3, QF: 3, SF: 3, THIRD: 3, FINAL: 4,
};
const EXACT_POINTS: Record<string, number> = {
  GROUP: 1, R32: 1, R16: 1, QF: 1, SF: 2, THIRD: 1, FINAL: 2,
};

function getResult(home: number, away: number): "1" | "X" | "2" {
  return home > away ? "1" : away > home ? "2" : "X";
}

function calcPoints(pred: { home: number; away: number }, actual: { home: number; away: number }, stage: string): number {
  let pts = 0;
  if (getResult(pred.home, pred.away) === getResult(actual.home, actual.away)) {
    pts += TOTO_POINTS[stage] || 2;
  }
  if (pred.home === actual.home && pred.away === actual.away) {
    pts += EXACT_POINTS[stage] || 1;
  }
  return pts;
}

export function RegretMeter({ yourPrediction, actualResult, stage }: RegretMeterProps) {
  const yourPoints = calcPoints(yourPrediction, actualResult, stage);
  const maxPoints = (TOTO_POINTS[stage] || 2) + (EXACT_POINTS[stage] || 1);
  const exactPoints = calcPoints(actualResult, actualResult, stage); // If you got exact

  if (yourPoints === maxPoints) {
    return null; // No regret — perfect prediction!
  }

  const missed = exactPoints - yourPoints;

  if (missed <= 0) return null;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mt-2">
      <p className="text-xs text-orange-700">
        <span className="font-bold">מטר חרטה:</span>{" "}
        {yourPoints > 0 ? (
          <>הרווחת {yourPoints} נק׳, אבל עם {actualResult.home}-{actualResult.away} היית מרוויח/ה {exactPoints} נק׳ (+{missed})</>
        ) : (
          <>לו ניחשת {actualResult.home}-{actualResult.away} היית מרוויח/ה {exactPoints} נק׳</>
        )}
      </p>
    </div>
  );
}
