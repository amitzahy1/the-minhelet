"use client";

import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScoreInput } from "@/components/shared/ScoreInput";
import { getFlag } from "@/components/shared/TeamBadge";
import { useBracketStore } from "@/stores/bracket-store";
import { getGroupTeams } from "@/lib/tournament/groups";
import { cn } from "@/lib/utils";

interface GroupCardProps {
  groupId: string;
}

// Sortable team row for drag-and-drop ordering
function SortableTeamRow({
  teamCode,
  teamName,
  position,
}: {
  teamCode: string;
  teamName: string;
  position: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: teamCode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const positionColors = {
    1: "bg-green-50 border-green-200",
    2: "bg-green-50/60 border-green-100",
    3: "bg-amber-50 border-amber-100",
    4: "bg-red-50/50 border-red-100",
  }[position] || "";

  const positionLabels = {
    1: "עולה (1)",
    2: "עולה (2)",
    3: "אולי (3)",
    4: "נשארת (4)",
  }[position] || "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        positionColors,
        isDragging && "opacity-50 shadow-lg z-50"
      )}
      {...attributes}
      {...listeners}
    >
      <span className="text-sm font-bold text-gray-400 w-5">{position}.</span>
      <span className="text-xl">{getFlag(teamCode)}</span>
      <span className="font-medium text-sm flex-1">{teamCode}</span>
      <span className="text-xs text-gray-400">{positionLabels}</span>
      <span className="text-gray-300 cursor-grab">⠿</span>
    </div>
  );
}

export function GroupCard({ groupId }: GroupCardProps) {
  const group = useBracketStore((s) => s.groups[groupId]);
  const setGroupOrder = useBracketStore((s) => s.setGroupOrder);
  const setGroupMatchScore = useBracketStore((s) => s.setGroupMatchScore);
  const teams = getGroupTeams(groupId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = group.order.indexOf(active.id as string);
      const newIndex = group.order.indexOf(over.id as string);
      const newOrder = arrayMove(group.order, oldIndex, newIndex);
      setGroupOrder(groupId, newOrder);
    },
    [group.order, groupId, setGroupOrder]
  );

  const handleScoreChange = useCallback(
    (matchIndex: number, side: "home" | "away", value: number) => {
      const match = group.matches[matchIndex];
      if (side === "home") {
        setGroupMatchScore(groupId, matchIndex, value, match.away_goals);
      } else {
        setGroupMatchScore(groupId, matchIndex, match.home_goals, value);
      }
    },
    [group.matches, groupId, setGroupMatchScore]
  );

  const allScoresEntered = group.matches.every(
    (m) => m.home_goals > 0 || m.away_goals > 0 || (m.home_goals === 0 && m.away_goals === 0)
  );

  return (
    <Card
      className={cn(
        "transition-all",
        group.is_valid
          ? "border-green-200 bg-green-50/30"
          : "border-gray-200"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">בית {groupId}</CardTitle>
          {group.is_valid ? (
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
              ✓ תקין
            </Badge>
          ) : group.standings.length > 0 ? (
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
              ⚠ לא תואם
            </Badge>
          ) : (
            <Badge variant="outline" className="text-gray-400">
              טרם הושלם
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Team ordering (drag & drop) */}
        <div>
          <p className="text-xs text-gray-500 mb-2">גררו לסידור הסופי החזוי:</p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={group.order}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {group.order.map((code, index) => {
                  const team = teams.find((t) => t.code === code);
                  return (
                    <SortableTeamRow
                      key={code}
                      teamCode={code}
                      teamName={team?.name || code}
                      position={index + 1}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Match score predictions */}
        <div>
          <p className="text-xs text-gray-500 mb-2">הזינו תוצאות משחקים:</p>
          <div className="space-y-2">
            {group.matches.map((match, index) => (
              <div
                key={match.match_id}
                className="flex items-center justify-between gap-2 rounded-lg bg-white border border-gray-100 px-3 py-2"
              >
                <div className="flex items-center gap-1.5 min-w-[60px]">
                  <span className="text-sm">{getFlag(match.home_team_code)}</span>
                  <span className="text-xs font-medium">{match.home_team_code}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ScoreInput
                    value={match.home_goals}
                    onChange={(v) => handleScoreChange(index, "home", v)}
                    size="sm"
                  />
                  <span className="text-gray-300 text-sm">-</span>
                  <ScoreInput
                    value={match.away_goals}
                    onChange={(v) => handleScoreChange(index, "away", v)}
                    size="sm"
                  />
                </div>
                <div className="flex items-center gap-1.5 min-w-[60px] justify-end">
                  <span className="text-xs font-medium">{match.away_team_code}</span>
                  <span className="text-sm">{getFlag(match.away_team_code)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Calculated standings table */}
        {group.standings.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">טבלה מחושבת מהתוצאות:</p>
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="w-8 text-center">#</TableHead>
                  <TableHead>קבוצה</TableHead>
                  <TableHead className="text-center w-8">מש</TableHead>
                  <TableHead className="text-center w-8">נ</TableHead>
                  <TableHead className="text-center w-8">ת</TableHead>
                  <TableHead className="text-center w-8">ה</TableHead>
                  <TableHead className="text-center w-10">הש</TableHead>
                  <TableHead className="text-center w-8 font-bold">נק</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.standings.map((entry) => {
                  const predictedPos = group.order.indexOf(entry.team_code) + 1;
                  const isCorrectPos = entry.position === predictedPos;
                  return (
                    <TableRow
                      key={entry.team_code}
                      className={cn(
                        "text-xs",
                        !isCorrectPos && "bg-amber-50/50"
                      )}
                    >
                      <TableCell className="text-center font-bold">
                        {entry.position}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          {getFlag(entry.team_code)}
                          <span className="font-medium">{entry.team_code}</span>
                          {!isCorrectPos && (
                            <span className="text-amber-500 text-[10px]">
                              (חזוי: {predictedPos})
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{entry.played}</TableCell>
                      <TableCell className="text-center">{entry.won}</TableCell>
                      <TableCell className="text-center">{entry.drawn}</TableCell>
                      <TableCell className="text-center">{entry.lost}</TableCell>
                      <TableCell className="text-center">
                        {entry.goal_difference > 0
                          ? `+${entry.goal_difference}`
                          : entry.goal_difference}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {entry.points}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Validation message */}
            {!group.is_valid && (
              <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                <p className="text-xs text-amber-700">
                  ⚠️ הטבלה המחושבת לא תואמת לסדר שבחרת. שנה את הסדר או את
                  התוצאות כדי שיתאימו.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
