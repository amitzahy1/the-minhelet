"use client";

import { useBracketStore, type BracketStep } from "@/stores/bracket-store";
import { GroupCard } from "@/components/bracket/GroupCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GROUP_LETTERS } from "@/lib/tournament/groups";
import { cn } from "@/lib/utils";

const STEP_LABELS: Record<BracketStep, string> = {
  groups: "שלב הבתים",
  "third-place": "מקום שלישי",
  knockout: "נוק-אאוט",
  specials: "הימורים מיוחדים",
  review: "סיכום",
};

const STEPS: BracketStep[] = ["groups", "third-place", "knockout", "specials", "review"];

export default function BracketPage() {
  const currentStep = useBracketStore((s) => s.currentStep);
  const setStep = useBracketStore((s) => s.setStep);
  const getCompletionStatus = useBracketStore((s) => s.getCompletionStatus);
  const status = getCompletionStatus();

  const currentStepIndex = STEPS.indexOf(currentStep);

  const canProceed = () => {
    switch (currentStep) {
      case "groups":
        return status.groupsComplete === 12;
      case "third-place":
        return status.thirdPlaceComplete;
      case "knockout":
        return status.knockoutComplete;
      case "specials":
        return true; // Optional
      case "review":
        return status.isFullyComplete;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold">בניית העץ שלך</h1>
            <Badge variant="outline" className="text-xs">
              {status.groupsComplete}/12 בתים
            </Badge>
          </div>

          {/* Step indicator */}
          <div className="flex gap-1">
            {STEPS.map((step, index) => (
              <button
                key={step}
                onClick={() => setStep(step)}
                className={cn(
                  "flex-1 rounded-full py-1.5 text-xs font-medium transition-colors",
                  index === currentStepIndex
                    ? "bg-blue-600 text-white"
                    : index < currentStepIndex
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
                )}
              >
                {STEP_LABELS[step]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {currentStep === "groups" && <GroupStageView />}
        {currentStep === "third-place" && <ThirdPlaceView />}
        {currentStep === "knockout" && <KnockoutView />}
        {currentStep === "specials" && <SpecialsView />}
        {currentStep === "review" && <ReviewView />}
      </main>

      {/* Bottom nav */}
      <div className="fixed bottom-0 inset-x-0 border-t bg-white/95 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-6xl flex gap-3">
          {currentStepIndex > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep(STEPS[currentStepIndex - 1])}
              className="flex-1"
            >
              → חזרה
            </Button>
          )}
          {currentStepIndex < STEPS.length - 1 && (
            <Button
              onClick={() => setStep(STEPS[currentStepIndex + 1])}
              disabled={!canProceed()}
              className="flex-1"
            >
              {STEP_LABELS[STEPS[currentStepIndex + 1]]} ←
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Step Views ---

function GroupStageView() {
  return (
    <div className="pb-20">
      <p className="text-sm text-gray-500 mb-4">
        סדרו את הקבוצות בכל בית לפי הסדר שאתם חושבים שייגמר, והזינו תוצאות
        לכל משחק. המערכת תוודא שהתוצאות תואמות לסדר.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GROUP_LETTERS.map((letter) => (
          <GroupCard key={letter} groupId={letter} />
        ))}
      </div>
    </div>
  );
}

function ThirdPlaceView() {
  const groups = useBracketStore((s) => s.groups);
  const thirdPlaceQualifiers = useBracketStore((s) => s.thirdPlaceQualifiers);
  const toggleThirdPlace = useBracketStore((s) => s.toggleThirdPlaceQualifier);

  return (
    <div className="pb-20 max-w-lg mx-auto">
      <p className="text-sm text-gray-500 mb-4">
        בחרו 8 נבחרות מקום שלישי שיעפילו לשלב הנוק-אאוט. הטבלה מציגה את
        הסטטיסטיקות שחזיתם.
      </p>
      <div className="space-y-2">
        {GROUP_LETTERS.map((letter) => {
          const group = groups[letter];
          const thirdTeam = group.standings.length >= 3
            ? group.standings[2]
            : null;
          const isSelected = thirdPlaceQualifiers.includes(letter);
          const teamCode = group.order[2]; // The team predicted 3rd

          return (
            <button
              key={letter}
              onClick={() => toggleThirdPlace(letter)}
              disabled={!isSelected && thirdPlaceQualifiers.length >= 8}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm transition-all",
                isSelected
                  ? "border-green-300 bg-green-50"
                  : "border-gray-200 bg-white hover:border-gray-300",
                !isSelected && thirdPlaceQualifiers.length >= 8 && "opacity-40"
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs",
                  isSelected ? "border-green-500 bg-green-500 text-white" : "border-gray-300"
                )}>
                  {isSelected && "✓"}
                </span>
                <span className="font-medium">בית {letter}</span>
                <span className="text-gray-500">—</span>
                <span>{teamCode}</span>
              </div>
              {thirdTeam && (
                <div className="text-xs text-gray-400">
                  {thirdTeam.points} נק&apos; · הש {thirdTeam.goal_difference > 0 ? `+${thirdTeam.goal_difference}` : thirdTeam.goal_difference}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-4 text-center">
        <Badge variant="outline" className={cn(
          "text-sm",
          thirdPlaceQualifiers.length === 8 ? "bg-green-100 text-green-700" : ""
        )}>
          {thirdPlaceQualifiers.length}/8 נבחרו
        </Badge>
      </div>
    </div>
  );
}

function KnockoutView() {
  return (
    <div className="pb-20 text-center">
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-12">
        <div className="text-4xl mb-4">🏆</div>
        <h2 className="text-xl font-bold mb-2">עץ הנוק-אאוט</h2>
        <p className="text-gray-500">
          יבנה בשלב הבא — כאן תזינו תוצאות לכל משחק מהשמינית ועד הגמר
        </p>
      </div>
    </div>
  );
}

function SpecialsView() {
  return (
    <div className="pb-20 text-center">
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-12">
        <div className="text-4xl mb-4">⭐</div>
        <h2 className="text-xl font-bold mb-2">הימורים מיוחדים</h2>
        <p className="text-gray-500">
          מלך שערים, מלך בישולים, ההתקפה הטובה ביותר, ועוד
        </p>
      </div>
    </div>
  );
}

function ReviewView() {
  return (
    <div className="pb-20 text-center">
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-12">
        <div className="text-4xl mb-4">📋</div>
        <h2 className="text-xl font-bold mb-2">סיכום ונעילה</h2>
        <p className="text-gray-500">
          סקירת כל ההימורים שלך לפני נעילה סופית
        </p>
      </div>
    </div>
  );
}
