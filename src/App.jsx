import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Copy,
  Dice5,
  Gift,
  HelpCircle,
  Link,
  RotateCcw,
  Save,
  Settings,
  Shuffle,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { supabase } from "./supabaseClient";

const TEAM_COUNT = 6;
const QUESTIONS_PER_TEAM = 2;
const BOARD_SIZE = 15;
const QUESTION_CELLS = 12;
const BONUS_CELLS = 3;
const WIN_SCORE = 100;
const DICE_ROLL_TIME = 1200;

const diceValues = [0, 1, 2, 3, 4, -1];

const powerUpInfo = {
  score: {
    label: "+20점",
    short: "+20",
    description: "현재 팀이 점수 20점을 얻습니다.",
  },
  jump: {
    label: "3칸 전진",
    short: "+3",
    description: "현재 팀이 앞으로 3칸 이동합니다.",
  },
  shield: {
    label: "방어막",
    short: "🛡",
    description: "다음 실패 벌칙을 한 번 막습니다.",
  },
  double: {
    label: "더블 점수",
    short: "×2",
    description: "다음 질문 성공 점수가 2배가 됩니다.",
  },
  steal: {
    label: "점수 빼앗기",
    short: "STEAL",
    description: "가장 점수가 높은 팀에게서 10점을 가져옵니다.",
  },
  swap: {
    label: "점수 교환",
    short: "SWAP",
    description: "가장 점수가 높은 팀과 점수를 바꿉니다.",
  },
};

const teamTemplate = [
  {
    id: 1,
    code: "taj-1",
    name: "Team 1",
    position: 0,
    score: 0,
    color: "bg-rose-500",
    ringColor: "ring-rose-300",
    textColor: "text-rose-600",
    icon: "🐘",
    powerUp: "score",
  },
  {
    id: 2,
    code: "lotus-2",
    name: "Team 2",
    position: 0,
    score: 0,
    color: "bg-orange-500",
    ringColor: "ring-orange-300",
    textColor: "text-orange-600",
    icon: "🪷",
    powerUp: "jump",
  },
  {
    id: 3,
    code: "peacock-3",
    name: "Team 3",
    position: 0,
    score: 0,
    color: "bg-blue-500",
    ringColor: "ring-blue-300",
    textColor: "text-blue-600",
    icon: "🦚",
    powerUp: "shield",
  },
  {
    id: 4,
    code: "spice-4",
    name: "Team 4",
    position: 0,
    score: 0,
    color: "bg-amber-500",
    ringColor: "ring-amber-300",
    textColor: "text-amber-600",
    icon: "🌶️",
    powerUp: "double",
  },
  {
    id: 5,
    code: "palace-5",
    name: "Team 5",
    position: 0,
    score: 0,
    color: "bg-purple-500",
    ringColor: "ring-purple-300",
    textColor: "text-purple-600",
    icon: "🏰",
    powerUp: "steal",
  },
  {
    id: 6,
    code: "diya-6",
    name: "Team 6",
    position: 0,
    score: 0,
    color: "bg-emerald-500",
    ringColor: "ring-emerald-300",
    textColor: "text-emerald-600",
    icon: "🪔",
    powerUp: "swap",
  },
];

function makeDefaultQuestions() {
  return teamTemplate.map((team) => ({
    teamId: team.id,
    teamCode: team.code,
    teamName: team.name,
    questions: Array.from(
      { length: QUESTIONS_PER_TEAM },
      (_, index) => `${team.name} ${index + 1}번 질문을 입력하세요.`
    ),
  }));
}

function makeDefaultSubmissions() {
  return teamTemplate.map((team) => ({
    teamId: team.id,
    submitted: false,
    submittedAt: null,
  }));
}

function getInitialView() {
  if (typeof window === "undefined") {
    return { mode: "teacher", teamCode: null };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    mode: params.get("mode") === "team" ? "team" : "teacher",
    teamCode: params.get("team"),
  };
}

function makeTeamLink(team) {
  if (typeof window === "undefined") {
    return `?mode=team&team=${team.code}`;
  }

  return `${window.location.origin}${window.location.pathname}?mode=team&team=${team.code}`;
}

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function createBoardPath() {
  const points = [];
  const rows = 3;
  const cols = 5;

  for (let row = rows - 1; row >= 0; row -= 1) {
    const rowFromBottom = rows - 1 - row;
    const colsArray = Array.from({ length: cols }, (_, col) => col);
    const orderedCols =
      rowFromBottom % 2 === 0 ? colsArray : colsArray.reverse();

    orderedCols.forEach((col) => {
      points.push({
        x: col * 20 + 10,
        y: row * 27 + 20,
      });
    });
  }

  return points;
}

const boardPath = createBoardPath();

function createBoardEvents(teamQuestions) {
  const cells = Array.from({ length: BOARD_SIZE }, (_, index) => index + 1);
  const shuffledCells = shuffleArray(cells);

  const questionEvents = teamQuestions
    .flatMap((team) =>
      team.questions
        .filter((question) => question.trim())
        .map((question) => ({
          type: "question",
          label: "Q",
          question,
          authorTeamId: team.teamId,
          authorTeamName: team.teamName,
        }))
    )
    .slice(0, QUESTION_CELLS);

  const bonusEvents = Array.from({ length: BONUS_CELLS }, (_, index) => ({
    type: "bonus",
    label: "BONUS",
    bonusNumber: index + 1,
  }));

  const events = {};

  shuffleArray([...questionEvents, ...bonusEvents]).forEach((event, index) => {
    const cell = shuffledCells[index];
    if (cell) events[cell] = event;
  });

  return events;
}

function getTileSkin(cell, boardEvents) {
  const event = boardEvents[cell];

  if (event?.type === "question") {
    return "from-indigo-300 to-violet-100 border-indigo-100 text-indigo-950";
  }

  if (event?.type === "bonus") {
    return "from-green-300 to-lime-100 border-green-100 text-green-950";
  }

  if (cell === BOARD_SIZE) {
    return "from-amber-200 to-yellow-100 border-amber-100 text-amber-950";
  }

  return cell % 2 === 0
    ? "from-orange-100 to-amber-50 border-orange-100 text-slate-900"
    : "from-cyan-200 to-sky-100 border-cyan-100 text-sky-950";
}

function playDiceRollSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const masterGain = audioContext.createGain();

    masterGain.gain.setValueAtTime(0.18, audioContext.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.75
    );
    masterGain.connect(audioContext.destination);

    const rollClicks = [0, 0.08, 0.16, 0.25, 0.34, 0.46, 0.58];

    rollClicks.forEach((delay, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = index % 2 === 0 ? "triangle" : "square";
      oscillator.frequency.setValueAtTime(
        160 + Math.random() * 220,
        audioContext.currentTime + delay
      );

      gain.gain.setValueAtTime(0.001, audioContext.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(
        0.12,
        audioContext.currentTime + delay + 0.01
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + delay + 0.08
      );

      oscillator.connect(gain);
      gain.connect(masterGain);

      oscillator.start(audioContext.currentTime + delay);
      oscillator.stop(audioContext.currentTime + delay + 0.09);
    });
  } catch {
    // 소리가 차단되어도 게임은 계속 작동합니다.
  }
}

function DiceFace({ value, rolling }) {
  const faceClass =
    "absolute flex h-24 w-24 items-center justify-center rounded-[18px] border border-slate-200 bg-white text-4xl font-black shadow-inner";

  const rotations = {
    0: { x: 0, y: 0 },
    1: { x: -90, y: 0 },
    2: { x: 0, y: -90 },
    3: { x: 0, y: 90 },
    4: { x: 90, y: 0 },
    "-1": { x: 180, y: 0 },
  };

  const result = value ?? 0;
  const baseRotation = rotations[String(result)] ?? rotations[0];

  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className="flex h-40 w-40 items-center justify-center"
        style={{ perspective: "1000px" }}
      >
        <motion.div
          className="relative h-24 w-24 cursor-pointer"
          style={{ transformStyle: "preserve-3d" }}
          animate={
            rolling
              ? {
                  rotateX: [-25, 360, 720, 1080, baseRotation.x + 1800],
                  rotateY: [25, 420, 840, 1260, baseRotation.y + 1800],
                  rotateZ: [0, 80, -120, 60, 0],
                  y: [0, -32, 16, -20, 0],
                  scale: [1, 1.15, 0.95, 1.1, 1],
                }
              : {
                  rotateX: baseRotation.x,
                  rotateY: baseRotation.y,
                  rotateZ: 0,
                  y: 0,
                  scale: 1,
                }
          }
          transition={{
            duration: 1.2,
            ease: [0.15, 0.85, 0.35, 1.15],
          }}
        >
          <div
            className={`${faceClass} text-slate-950`}
            style={{ transform: "rotateY(0deg) translateZ(48px)" }}
          >
            0
          </div>

          <div
            className={`${faceClass} text-orange-700`}
            style={{ transform: "rotateX(90deg) translateZ(48px)" }}
          >
            1
          </div>

          <div
            className={`${faceClass} text-blue-700`}
            style={{ transform: "rotateY(90deg) translateZ(48px)" }}
          >
            2
          </div>

          <div
            className={`${faceClass} text-emerald-700`}
            style={{ transform: "rotateY(-90deg) translateZ(48px)" }}
          >
            3
          </div>

          <div
            className={`${faceClass} text-purple-700`}
            style={{ transform: "rotateX(-90deg) translateZ(48px)" }}
          >
            4
          </div>

          <div
            className={`${faceClass} text-rose-700`}
            style={{ transform: "rotateY(180deg) translateZ(48px)" }}
          >
            -1
          </div>
        </motion.div>
      </div>

      <motion.div
        animate={
          rolling
            ? { scale: [0.4, 1.3, 0.8], opacity: [0.35, 0.15, 0] }
            : { scale: 1, opacity: 0.2 }
        }
        transition={{ duration: 1.2 }}
        className="-mt-6 h-6 w-28 rounded-full bg-slate-900/40 blur-md"
      />

      <div className="mt-3 h-6 text-sm font-black text-slate-600">
        {rolling
          ? "굴러가는 중..."
          : value !== null && value !== undefined
          ? `결과: ${value}`
          : "주사위를 굴려 보세요"}
      </div>
    </div>
  );
}

function TeamToken({ team, active, indexOnCell, totalOnCell }) {
  const angle = totalOnCell > 1 ? (Math.PI * 2 * indexOnCell) / totalOnCell : 0;
  const radius = totalOnCell > 1 ? 17 : 0;
  const offsetX = Math.cos(angle) * radius;
  const offsetY = Math.sin(angle) * radius;

  return (
    <motion.div
      layout
      animate={active ? { y: [0, -7, 0], scale: [1, 1.12, 1] } : {}}
      transition={active ? { repeat: Infinity, duration: 1.1 } : {}}
      className={`absolute z-40 flex h-9 w-9 items-center justify-center rounded-full border-4 border-white text-lg shadow-2xl ring-4 ${
        team.color
      } ${active ? team.ringColor : "ring-black/10"}`}
      style={{
        left: `calc(50% + ${offsetX}px)`,
        top: `calc(50% + ${offsetY}px)`,
        transform: "translate(-50%, -50%)",
      }}
      title={team.name}
    >
      <span className="-mt-0.5">{team.icon}</span>
    </motion.div>
  );
}

function IndiaBoard({ boardEvents, teams, turn }) {
  const pathPoints = boardPath.map((point) => `${point.x},${point.y}`).join(" ");
  const cells = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);
  const startTeams = teams.filter((team) => team.position === 0);

  return (
    <div className="relative h-[600px] overflow-hidden rounded-[2rem] border-8 border-orange-100 bg-orange-900 shadow-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_5%,rgba(255,247,237,0.92),transparent_26%),linear-gradient(160deg,rgba(251,146,60,0.95),rgba(245,158,11,0.75)_34%,rgba(20,184,166,0.72)_70%,rgba(88,28,135,0.85))]" />
      <div className="absolute inset-0 opacity-20 bg-[repeating-radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.8)_0_2px,transparent_3px_20px)]" />

      <div className="absolute left-1/2 top-6 -translate-x-1/2 text-center text-white/95 drop-shadow-2xl">
        <div className="text-6xl">🕌</div>
        <div className="mt-1 text-base font-black tracking-[0.35em]">
          INDIA QUEST
        </div>
      </div>

      <div className="absolute left-8 top-16 text-5xl opacity-80 drop-shadow-xl">
        🐘
      </div>
      <div className="absolute right-10 top-20 text-5xl opacity-80 drop-shadow-xl">
        🦚
      </div>
      <div className="absolute bottom-8 left-10 text-6xl opacity-90 drop-shadow-xl">
        🪷
      </div>
      <div className="absolute bottom-8 right-12 text-6xl opacity-90 drop-shadow-xl">
        🪔
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-orange-950/35 to-transparent" />

      <div className="absolute bottom-5 left-5 z-30 rounded-3xl border-4 border-white/80 bg-white/90 px-4 py-3 shadow-xl">
        <p className="text-xs font-black text-orange-900">START</p>
        <div className="relative mt-2 h-12 w-36">
          {startTeams.map((team, index) => (
            <motion.div
              key={team.id}
              className={`absolute flex h-8 w-8 items-center justify-center rounded-full border-4 border-white text-base shadow-lg ${team.color}`}
              style={{ left: `${index * 22}px`, top: 0 }}
            >
              {team.icon}
            </motion.div>
          ))}
        </div>
      </div>

      <svg
        className="absolute inset-0 z-10 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polyline
          points={pathPoints}
          fill="none"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={pathPoints}
          fill="none"
          stroke="rgba(124,45,18,0.7)"
          strokeWidth="2.8"
          strokeDasharray="1.4 2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="absolute inset-0 z-20">
        {cells.map((cell) => {
          const position = boardPath[cell - 1];
          const event = boardEvents[cell];
          const teamsOnCell = teams.filter((team) => team.position === cell);

          return (
            <motion.div
              key={cell}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: cell * 0.02 }}
              className={`absolute flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[30%] border-4 bg-gradient-to-br text-center text-[12px] font-black shadow-[0_7px_0_rgba(69,26,3,0.36),0_12px_18px_rgba(0,0,0,0.24)] ${getTileSkin(
                cell,
                boardEvents
              )}`}
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
              }}
            >
              <span className="absolute left-1.5 top-1 rounded-lg bg-white/70 px-1.5 py-0.5 text-[10px]">
                {cell}
              </span>

              {event?.type === "question" ? (
                <div className="flex flex-col items-center leading-none">
                  <HelpCircle className="h-6 w-6" />
                  <span>Q</span>
                </div>
              ) : event?.type === "bonus" ? (
                <div className="flex flex-col items-center leading-none">
                  <Gift className="h-6 w-6" />
                  <span className="text-[9px]">BONUS</span>
                </div>
              ) : (
                <span>{cell}</span>
              )}

              {cell === BOARD_SIZE && (
                <span className="absolute bottom-1 rounded-lg bg-white/70 px-1 text-[8px]">
                  FINISH
                </span>
              )}

              {teamsOnCell.map((team, index) => (
                <TeamToken
                  key={team.id}
                  team={team}
                  active={teams[turn]?.id === team.id}
                  indexOnCell={index}
                  totalOnCell={teamsOnCell.length}
                />
              ))}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function EventModal({ event, currentTeam, onSuccess, onFail, onClose }) {
  if (!event) return null;

  const isBonus = event.type === "bonus";
  const power = isBonus ? powerUpInfo[currentTeam.powerUp] : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 40, scale: 0.92, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 40, scale: 0.92, opacity: 0 }}
          className="w-full max-w-3xl overflow-hidden rounded-[2.5rem] border-8 border-white bg-white shadow-2xl"
        >
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-teal-500 p-6 text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.35em] opacity-90">
                  {currentTeam.name}
                </p>
                <h2 className="mt-1 text-3xl font-black">
                  {isBonus ? "Bonus!" : "Question"}
                </h2>
              </div>
              <span className="text-5xl drop-shadow-xl">
                {isBonus ? "🎁" : currentTeam.icon}
              </span>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div className="rounded-[2rem] bg-orange-50 p-6 text-center shadow-inner">
              {isBonus ? (
                <div>
                  <p className="text-sm font-black text-green-600">
                    Bonus Cell
                  </p>
                  <p className="mt-3 text-5xl font-black text-slate-950">
                    {power.label}
                  </p>
                  <p className="mt-3 text-lg font-bold text-slate-600">
                    {power.description}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-black text-indigo-600">
                    출제 팀: {event.authorTeamName}
                  </p>
                  <p className="mt-3 text-3xl font-black leading-relaxed text-slate-950">
                    {event.question}
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Button
                onClick={onSuccess}
                className="h-16 rounded-3xl bg-emerald-600 text-lg font-black hover:bg-emerald-700"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                {isBonus ? "보너스 사용" : "성공"}
              </Button>

              <Button
                onClick={onFail}
                variant="outline"
                className="h-16 rounded-3xl border-rose-200 bg-rose-50 text-lg font-black text-rose-700 hover:bg-rose-100"
              >
                <XCircle className="mr-2 h-5 w-5" />
                {isBonus ? "보너스 패스" : "실패 / 패스"}
              </Button>

              <Button
                onClick={onClose}
                variant="secondary"
                className="h-16 rounded-3xl text-lg font-black"
              >
                닫기
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function IndiaQuestBoardGame() {
  const initialView = getInitialView();

  const [viewMode] = useState(initialView.mode);
  const [teamCode] = useState(initialView.teamCode);
  const [teams, setTeams] = useState(teamTemplate);
  const [teamQuestions, setTeamQuestions] = useState(makeDefaultQuestions);
  const [boardEvents, setBoardEvents] = useState({});
  const [phase, setPhase] = useState("setup");
  const [turn, setTurn] = useState(0);
  const [dice, setDice] = useState(null);
  const [rollingDice, setRollingDice] = useState(false);
  const [message, setMessage] = useState(
    "팀별 링크를 배분하고, 질문과 Bonus 설정을 완료하세요."
  );
  const [currentEvent, setCurrentEvent] = useState(null);
  const [hasMoved, setHasMoved] = useState(false);
  const [winner, setWinner] = useState(null);
  const [copiedTeam, setCopiedTeam] = useState(null);
  const [teamSubmissions, setTeamSubmissions] = useState(makeDefaultSubmissions);
  const [teamStatus, setTeamStatus] = useState(
    teamTemplate.map((team) => ({
      teamId: team.id,
      shield: false,
      double: false,
    }))
  );

  const teamOnlyIndex = teams.findIndex((team) => team.code === teamCode);
  const isTeamView = viewMode === "team";
  const currentTeam = teams[turn];

  const totalQuestions = teamQuestions.reduce(
    (sum, team) => sum + team.questions.filter((q) => q.trim()).length,
    0
  );

  const submittedCount = teamSubmissions.filter((team) => team.submitted).length;

  const setupReady =
    totalQuestions === TEAM_COUNT * QUESTIONS_PER_TEAM &&
    submittedCount === TEAM_COUNT;

  const applySupabaseTeams = (savedTeams) => {
    setTeams((prevTeams) =>
      prevTeams.map((team) => {
        const savedTeam = savedTeams.find(
          (item) => item.team_code === team.code
        );

        if (!savedTeam) return team;

        return {
          ...team,
          name: savedTeam.team_name,
          powerUp: savedTeam.power_up,
        };
      })
    );

    setTeamQuestions((prevQuestions) =>
      prevQuestions.map((teamQuestion) => {
        const savedTeam = savedTeams.find(
          (item) => item.team_code === teamQuestion.teamCode
        );

        if (!savedTeam) return teamQuestion;

        return {
          ...teamQuestion,
          teamName: savedTeam.team_name,
          questions: Array.isArray(savedTeam.questions)
            ? savedTeam.questions
            : teamQuestion.questions,
        };
      })
    );

    setTeamSubmissions((prevSubmissions) =>
      prevSubmissions.map((submission) => {
        const savedTeam = savedTeams.find(
          (item) => item.team_id === submission.teamId
        );

        if (!savedTeam) return submission;

        return {
          ...submission,
          submitted: !!savedTeam.submitted,
          submittedAt: savedTeam.submitted_at
            ? new Date(savedTeam.submitted_at).toLocaleTimeString()
            : null,
        };
      })
    );
  };

  useEffect(() => {
    if (isTeamView) return;

    const loadTeams = async () => {
      const { data, error } = await supabase.from("teams").select("*");

      if (error) {
        setMessage(`Supabase 데이터를 불러오지 못했습니다: ${error.message}`);
        return;
      }

      if (data) {
        applySupabaseTeams(data);
      }
    };

    loadTeams();

    const channel = supabase
      .channel("teacher-teams-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
        },
        async () => {
          const { data } = await supabase.from("teams").select("*");
          if (data) {
            applySupabaseTeams(data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isTeamView]);

  useEffect(() => {
    if (!isTeamView || !teamCode) return;

    const loadTeam = async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("team_code", teamCode)
        .maybeSingle();

      if (error) {
        setMessage(`팀 데이터를 불러오지 못했습니다: ${error.message}`);
        return;
      }

      if (!data) return;

      setTeams((prevTeams) =>
        prevTeams.map((team) =>
          team.code === teamCode
            ? {
                ...team,
                name: data.team_name,
                powerUp: data.power_up,
              }
            : team
        )
      );

      setTeamQuestions((prevQuestions) =>
        prevQuestions.map((teamQuestion) =>
          teamQuestion.teamCode === teamCode
            ? {
                ...teamQuestion,
                teamName: data.team_name,
                questions: Array.isArray(data.questions)
                  ? data.questions
                  : teamQuestion.questions,
              }
            : teamQuestion
        )
      );

      setTeamSubmissions((prevSubmissions) =>
        prevSubmissions.map((submission) =>
          submission.teamId === data.team_id
            ? {
                ...submission,
                submitted: !!data.submitted,
                submittedAt: data.submitted_at
                  ? new Date(data.submitted_at).toLocaleTimeString()
                  : null,
              }
            : submission
        )
      );
    };

    loadTeam();
  }, [isTeamView, teamCode]);

  const copyText = async (text, teamId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTeam(teamId);
      setTimeout(() => setCopiedTeam(null), 1200);
    } catch {
      setCopiedTeam(teamId);
      setTimeout(() => setCopiedTeam(null), 1200);
    }
  };

  const markTeamUnsubmitted = (teamIndex) => {
    setTeamSubmissions((prev) =>
      prev.map((item, index) =>
        index === teamIndex
          ? {
              ...item,
              submitted: false,
              submittedAt: null,
            }
          : item
      )
    );
  };

  const submitTeamQuestions = async (teamIndex) => {
    alert("submitTeamQuestions 함수 실행됨");

    const team = teams[teamIndex];
    const teamQuestion = teamQuestions[teamIndex];

    if (!team || !teamQuestion) {
      alert("팀 정보를 찾을 수 없습니다.");
      return;
    }

    const filledCount = teamQuestion.questions.filter((q) => q.trim()).length;

    if (filledCount !== QUESTIONS_PER_TEAM) {
      alert(
        `${team.name}은/는 질문을 정확히 ${QUESTIONS_PER_TEAM}개 입력해야 제출할 수 있습니다.`
      );
      return;
    }

    const submittedTime = new Date();

    setTeamSubmissions((prev) =>
      prev.map((item, index) =>
        index === teamIndex
          ? {
              ...item,
              submitted: true,
              submittedAt: submittedTime.toLocaleTimeString(),
            }
          : item
      )
    );

    alert("화면 상태 변경 완료. 이제 Supabase 저장을 시도합니다.");

    const payload = {
      team_code: team.code,
      team_id: team.id,
      team_name: team.name,
      power_up: team.powerUp,
      questions: teamQuestion.questions,
      submitted: true,
      submitted_at: submittedTime.toISOString(),
      updated_at: submittedTime.toISOString(),
    };

    console.log("Supabase 저장 payload:", payload);

    const { data, error } = await supabase
      .from("teams")
      .upsert(payload, { onConflict: "team_code" })
      .select();

    if (error) {
      console.error("Supabase 저장 오류:", error);
      alert(`Supabase 저장 오류: ${error.message}`);

      setTeamSubmissions((prev) =>
        prev.map((item, index) =>
          index === teamIndex
            ? {
                ...item,
                submitted: false,
                submittedAt: null,
              }
            : item
        )
      );

      return;
    }

    console.log("Supabase 저장 성공:", data);
    alert(`${team.name} 문제 제출이 완료되었습니다.`);
    setMessage(`${team.name} 문제 제출이 완료되었습니다.`);
  };

  const updateTeamName = (teamIndex, value) => {
    markTeamUnsubmitted(teamIndex);

    setTeams((prev) =>
      prev.map((team, index) =>
        index === teamIndex ? { ...team, name: value } : team
      )
    );

    setTeamQuestions((prev) =>
      prev.map((team, index) =>
        index === teamIndex ? { ...team, teamName: value } : team
      )
    );
  };

  const updateTeamPowerUp = (teamIndex, value) => {
    markTeamUnsubmitted(teamIndex);

    setTeams((prev) =>
      prev.map((team, index) =>
        index === teamIndex ? { ...team, powerUp: value } : team
      )
    );
  };

  const updateQuestion = (teamIndex, questionIndex, value) => {
    markTeamUnsubmitted(teamIndex);

    setTeamQuestions((prev) =>
      prev.map((team, index) =>
        index !== teamIndex
          ? team
          : {
              ...team,
              questions: team.questions.map((question, qIndex) =>
                qIndex === questionIndex ? value : question
              ),
            }
      )
    );
  };

  const startGame = () => {
    if (!setupReady) {
      setMessage(
        "각 팀은 질문 2개를 입력한 뒤 제출 버튼을 눌러야 게임을 시작할 수 있습니다."
      );
      return;
    }

    setBoardEvents(createBoardEvents(teamQuestions));
    setTeams((prev) =>
      prev.map((team) => ({ ...team, position: 0, score: 0 }))
    );
    setTeamStatus(
      teams.map((team) => ({
        teamId: team.id,
        shield: false,
        double: false,
      }))
    );
    setTurn(0);
    setDice(null);
    setRollingDice(false);
    setCurrentEvent(null);
    setHasMoved(false);
    setWinner(null);
    setPhase("play");
    setMessage(`${teams[0].name} 차례입니다. 주사위를 굴려 주세요!`);
  };

  const resetEverything = () => {
    setTeams(teamTemplate);
    setTeamQuestions(makeDefaultQuestions());
    setBoardEvents({});
    setPhase("setup");
    setTurn(0);
    setDice(null);
    setRollingDice(false);
    setCurrentEvent(null);
    setHasMoved(false);
    setWinner(null);
    setTeamSubmissions(makeDefaultSubmissions());
    setTeamStatus(
      teamTemplate.map((team) => ({
        teamId: team.id,
        shield: false,
        double: false,
      }))
    );
    setMessage("팀별 링크를 배분하고, 질문과 Bonus 설정을 완료하세요.");
  };

  const nextTurn = () => {
    const next = (turn + 1) % TEAM_COUNT;
    setTurn(next);
    setDice(null);
    setHasMoved(false);
    setCurrentEvent(null);
    setMessage(`${teams[next].name} 차례입니다. 주사위를 굴려 주세요!`);
  };

  const checkWinner = (updatedTeams) => {
    const found = updatedTeams.find(
      (team) => team.position >= BOARD_SIZE || team.score >= WIN_SCORE
    );

    if (found) {
      setWinner(found.name);
      setMessage(`${found.icon} ${found.name} 승리! 축하합니다!`);
      return true;
    }

    return false;
  };

  const applyBonusPower = () => {
    let updatedTeams = [...teams];
    let updatedStatus = [...teamStatus];
    const power = currentTeam.powerUp;

    if (power === "score") {
      updatedTeams = updatedTeams.map((team, index) =>
        index === turn ? { ...team, score: team.score + 20 } : team
      );
    }

    if (power === "jump") {
      updatedTeams = updatedTeams.map((team, index) =>
        index === turn
          ? { ...team, position: Math.min(team.position + 3, BOARD_SIZE) }
          : team
      );
    }

    if (power === "shield") {
      updatedStatus = updatedStatus.map((status, index) =>
        index === turn ? { ...status, shield: true } : status
      );
    }

    if (power === "double") {
      updatedStatus = updatedStatus.map((status, index) =>
        index === turn ? { ...status, double: true } : status
      );
    }

    if (power === "steal") {
      const maxScore = Math.max(...updatedTeams.map((team) => team.score));
      const targetIndex = updatedTeams.findIndex(
        (team, index) => index !== turn && team.score === maxScore
      );

      if (targetIndex >= 0) {
        const amount = Math.min(10, updatedTeams[targetIndex].score);

        updatedTeams = updatedTeams.map((team, index) => {
          if (index === turn) return { ...team, score: team.score + amount };
          if (index === targetIndex) {
            return { ...team, score: team.score - amount };
          }
          return team;
        });
      }
    }

    if (power === "swap") {
      const maxScore = Math.max(...updatedTeams.map((team) => team.score));
      const targetIndex = updatedTeams.findIndex(
        (team, index) => index !== turn && team.score === maxScore
      );

      if (targetIndex >= 0) {
        const myScore = updatedTeams[turn].score;
        const targetScore = updatedTeams[targetIndex].score;

        updatedTeams = updatedTeams.map((team, index) => {
          if (index === turn) return { ...team, score: targetScore };
          if (index === targetIndex) return { ...team, score: myScore };
          return team;
        });
      }
    }

    setTeams(updatedTeams);
    setTeamStatus(updatedStatus);
    setCurrentEvent(null);
    setMessage(
      `${currentTeam.name}이/가 Bonus 칸에서 [${powerUpInfo[power].label}]을 사용했습니다.`
    );
    checkWinner(updatedTeams);
  };

  const processMove = (value) => {
    const target = Math.min(
      Math.max(teams[turn].position + value, 0),
      BOARD_SIZE
    );

    const updatedTeams = teams.map((team, index) =>
      index === turn ? { ...team, position: target } : team
    );

    setTeams(updatedTeams);
    setHasMoved(true);

    if (target === 0) {
      setMessage(`${currentTeam.name}이/가 START에 머물렀습니다.`);
      return;
    }

    const event = boardEvents[target];

    if (event) {
      setTimeout(() => setCurrentEvent(event), 250);
      setMessage(
        event.type === "bonus"
          ? `${currentTeam.name}이/가 Bonus 칸에 도착했습니다!`
          : `${currentTeam.name}이/가 질문 칸에 도착했습니다!`
      );
      return;
    }

    if (checkWinner(updatedTeams)) return;

    if (value === 0) {
      setMessage(`${currentTeam.name}이/가 제자리에 머물렀습니다.`);
    } else if (value === -1) {
      setMessage(`${currentTeam.name}이/가 한 칸 뒤로 이동했습니다.`);
    } else {
      setMessage(`${currentTeam.name}이/가 ${target}번 칸에 도착했습니다.`);
    }
  };

  const rollDice = () => {
    if (phase !== "play" || winner || hasMoved || currentEvent || rollingDice) {
      return;
    }

    setRollingDice(true);
    playDiceRollSound();
    setDice(null);
    setMessage("주사위가 굴러가는 중입니다... 🎲");

    let tempCount = 0;

    const rollInterval = setInterval(() => {
      tempCount += 1;
      setDice(diceValues[Math.floor(Math.random() * diceValues.length)]);

      if (tempCount >= 14) {
        clearInterval(rollInterval);
      }
    }, 70);

    setTimeout(() => {
      clearInterval(rollInterval);
      const value = diceValues[Math.floor(Math.random() * diceValues.length)];
      setDice(value);
      setRollingDice(false);
      processMove(value);
    }, DICE_ROLL_TIME);
  };

  const handleSuccess = () => {
    if (!currentEvent) return;

    if (currentEvent.type === "bonus") {
      applyBonusPower();
      return;
    }

    const status = teamStatus[turn];
    const gain = status.double ? 20 : 10;

    const updatedTeams = teams.map((team, index) =>
      index === turn ? { ...team, score: team.score + gain } : team
    );

    const updatedStatus = teamStatus.map((item, index) =>
      index === turn ? { ...item, double: false } : item
    );

    setTeams(updatedTeams);
    setTeamStatus(updatedStatus);
    setCurrentEvent(null);
    setMessage(
      status.double
        ? `${currentTeam.name} 성공! 더블 점수로 20점 획득!`
        : `${currentTeam.name} 성공! 10점 획득!`
    );
    checkWinner(updatedTeams);
  };

  const handleFail = () => {
    if (!currentEvent) return;

    if (currentEvent.type === "bonus") {
      setCurrentEvent(null);
      setMessage("Bonus를 사용하지 않고 넘겼습니다.");
      return;
    }

    const status = teamStatus[turn];
    const shieldActive = status.shield;

    const updatedTeams = teams.map((team, index) => {
      if (index !== turn) return team;
      if (shieldActive) return team;

      return {
        ...team,
        score: Math.max(team.score - 5, 0),
        position: Math.max(team.position - 1, 0),
      };
    });

    const updatedStatus = teamStatus.map((item, index) =>
      index === turn ? { ...item, shield: false } : item
    );

    setTeams(updatedTeams);
    setTeamStatus(updatedStatus);
    setCurrentEvent(null);
    setMessage(
      shieldActive
        ? "방어막으로 실패 벌칙을 막았습니다."
        : `${currentTeam.name} 실패 / 패스! 5점 감점, 한 칸 뒤로 이동.`
    );
    checkWinner(updatedTeams);
  };

  if (isTeamView && teamOnlyIndex === -1) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-white">
        <Card className="mx-auto max-w-xl rounded-[2rem] bg-white text-slate-900">
          <CardContent className="p-6">
            <h1 className="text-2xl font-black">
              팀 링크가 올바르지 않습니다.
            </h1>
            <p className="mt-2 text-slate-600">
              선생님 화면에서 팀별 링크를 다시 복사해 주세요.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isTeamView) {
    const team = teams[teamOnlyIndex];
    const questions = teamQuestions[teamOnlyIndex].questions;
    const submission = teamSubmissions[teamOnlyIndex];

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(255,237,213,0.95),rgba(251,146,60,0.75)_35%,rgba(20,184,166,0.85)_90%)] p-4 text-slate-900">
        <div className="mx-auto max-w-3xl space-y-4">
          <Card className="rounded-[2rem] border-8 border-orange-100 bg-white/95 shadow-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-4 border-white text-2xl shadow-xl ${team.color}`}
                >
                  {team.icon}
                </span>
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.3em] text-orange-700">
                    Private Team Page
                  </p>
                  <h1 className="text-3xl font-black text-orange-950">
                    {team.name} 질문 작성
                  </h1>
                </div>
              </div>

              <p className="mt-4 rounded-2xl bg-orange-50 p-4 text-sm font-medium text-orange-900">
                우리 팀의 질문과 Power-up만 보입니다. 질문은 정확히 2개
                작성한 뒤 제출 버튼을 누르세요.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] bg-white/95 shadow-xl">
            <CardContent className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-600">
                  팀 이름
                </label>
                <input
                  value={team.name}
                  onChange={(event) =>
                    updateTeamName(teamOnlyIndex, event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm font-bold outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-600">
                  Power-up 선택
                </label>
                <select
                  value={team.powerUp}
                  onChange={(event) =>
                    updateTeamPowerUp(teamOnlyIndex, event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-orange-500"
                >
                  {Object.entries(powerUpInfo).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.label} - {info.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl bg-slate-100 p-4 text-sm font-black text-slate-700">
                질문 수: {questions.filter((q) => q.trim()).length} / 2개
              </div>

              <div className="space-y-3">
                {questions.map((question, questionIndex) => (
                  <div
                    key={questionIndex}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <label className="mb-2 block text-sm font-bold text-slate-600">
                      {questionIndex + 1}번 질문
                    </label>

                    <textarea
                      value={question}
                      onChange={(event) =>
                        updateQuestion(
                          teamOnlyIndex,
                          questionIndex,
                          event.target.value
                        )
                      }
                      className="min-h-24 w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-orange-500"
                      placeholder={`${team.name} ${questionIndex + 1}번 질문`}
                    />
                  </div>
                ))}
              </div>

              <div
                className={`rounded-2xl p-4 text-sm font-bold ${
                  submission?.submitted
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-amber-50 text-amber-800"
                }`}
              >
                <Save className="mr-2 inline h-4 w-4" />
                {submission?.submitted
                  ? `제출 완료${
                      submission?.submittedAt
                        ? ` (${submission.submittedAt})`
                        : ""
                    }`
                  : "아직 제출하지 않았습니다. 질문을 확인한 뒤 제출을 눌러 주세요."}
              </div>

              <button
                type="button"
                onClick={() => {
                  alert("제출 버튼 클릭됨");
                  submitTeamQuestions(teamOnlyIndex);
                }}
                className="flex w-full items-center justify-center rounded-2xl bg-red-600 px-4 py-4 text-lg font-black text-white shadow-lg transition hover:bg-red-700 active:scale-[0.98]"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                제출 테스트
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-orange-950 p-4 text-slate-900">
      <div className="pointer-events-none fixed inset-0 opacity-90">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,237,213,0.95),rgba(251,146,60,0.56)_30%,rgba(20,184,166,0.58)_65%,rgba(76,29,149,0.9)_100%)]" />
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-44 w-full bg-[linear-gradient(90deg,rgba(251,191,36,0.35),rgba(244,63,94,0.25),rgba(20,184,166,0.35))] blur-2xl" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-4">
        <div className="rounded-[2rem] border-8 border-orange-100 bg-orange-900/60 p-2 shadow-2xl">
          <div className="rounded-[1.5rem] bg-white/10 p-2 backdrop-blur">
            <div className="flex flex-col gap-3 rounded-[1.25rem] bg-gradient-to-r from-orange-100/95 via-amber-100/95 to-teal-100/95 p-5 shadow-inner md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-orange-900">
                  <Sparkles className="h-6 w-6" />
                  <span className="text-sm font-bold uppercase tracking-[0.35em]">
                    India Quest Board Game
                  </span>
                </div>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-orange-950 md:text-5xl">
                  India Quest Board
                </h1>
                <p className="mt-2 text-sm font-medium text-orange-900">
                  15칸 보드판에서 12개 질문 칸과 3개 Bonus 칸으로
                  플레이합니다.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {phase === "play" && (
                  <Button
                    onClick={() => setPhase("setup")}
                    variant="outline"
                    className="rounded-2xl bg-white/80"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    설정으로
                  </Button>
                )}

                <Button
                  onClick={resetEverything}
                  variant="outline"
                  className="rounded-2xl bg-white/80"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  전체 초기화
                </Button>
              </div>
            </div>
          </div>
        </div>

        {phase === "setup" && (
          <Card className="rounded-[2rem] border-4 border-orange-200 bg-white/95 shadow-2xl">
            <CardContent className="p-5">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-orange-950">
                    1단계: 팀별 링크 배분
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    각 팀에게 자기 팀 링크만 보내면, 그 팀은 자기 질문 작성
                    화면만 볼 수 있습니다.
                  </p>
                </div>

                <div
                  className={`rounded-2xl px-4 py-2 text-sm font-bold ${
                    setupReady
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  팀 질문: {totalQuestions} / 12개 · 제출: {submittedCount} /
                  6팀 · 보드판: 15칸 중 3칸 Bonus
                </div>
              </div>

              <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {teams.map((team) => {
                  const link = makeTeamLink(team);
                  const submission = teamSubmissions[team.id - 1];
                  const questionCount = teamQuestions[
                    team.id - 1
                  ].questions.filter((q) => q.trim()).length;

                  return (
                    <div
                      key={team.id}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 font-black">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-sm shadow ${team.color}`}
                          >
                            {team.icon}
                          </span>
                          <span className={team.textColor}>{team.name}</span>
                        </div>

                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            submission?.submitted
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {submission?.submitted ? "제출 완료" : "작성 중"}
                        </span>
                      </div>

                      <div className="mb-2 break-all rounded-2xl bg-white p-3 text-xs text-slate-600 shadow-inner">
                        {link}
                      </div>

                      <div className="mb-2 rounded-2xl bg-white p-3 text-xs font-bold text-slate-600 shadow-inner">
                        문제 입력: {questionCount} / {QUESTIONS_PER_TEAM}개
                        {submission?.submittedAt
                          ? ` · 제출 시각: ${submission.submittedAt}`
                          : ""}
                      </div>

                      <Button
                        onClick={() => copyText(link, team.id)}
                        variant="outline"
                        className="w-full rounded-2xl bg-white"
                      >
                        {copiedTeam === team.id ? (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        ) : (
                          <Copy className="mr-2 h-4 w-4" />
                        )}
                        {copiedTeam === team.id ? "복사됨" : "팀 링크 복사"}
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-3xl border border-orange-100 bg-orange-50 p-4">
                <div className="mb-3 flex items-center gap-2 font-black text-orange-950">
                  <Link className="h-5 w-5" />
                  선생님 확인용 전체 설정
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {teams.map((team, teamIndex) => (
                    <div
                      key={team.id}
                      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-white text-lg shadow ${team.color}`}
                        >
                          {team.icon}
                        </span>

                        <input
                          value={team.name}
                          onChange={(event) =>
                            updateTeamName(teamIndex, event.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm font-bold outline-none focus:border-orange-500"
                        />
                      </div>

                      <label className="mb-1 block text-xs font-bold text-slate-600">
                        Power-up
                      </label>
                      <select
                        value={team.powerUp}
                        onChange={(event) =>
                          updateTeamPowerUp(teamIndex, event.target.value)
                        }
                        className="mb-3 w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-orange-500"
                      >
                        {Object.entries(powerUpInfo).map(([key, info]) => (
                          <option key={key} value={key}>
                            {info.label} - {info.description}
                          </option>
                        ))}
                      </select>

                      <div className="space-y-2">
                        {teamQuestions[teamIndex].questions.map(
                          (question, questionIndex) => (
                            <textarea
                              key={questionIndex}
                              value={question}
                              onChange={(event) =>
                                updateQuestion(
                                  teamIndex,
                                  questionIndex,
                                  event.target.value
                                )
                              }
                              className="min-h-16 w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-orange-500"
                              placeholder={`${team.name} ${
                                questionIndex + 1
                              }번 질문`}
                            />
                          )
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          alert("교사 화면 제출 처리 버튼 클릭됨");
                          submitTeamQuestions(teamIndex);
                        }}
                        className="mt-3 flex w-full items-center justify-center rounded-2xl bg-red-600 px-4 py-3 font-black text-white shadow-lg transition hover:bg-red-700 active:scale-[0.98]"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        이 팀 제출 테스트
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  onClick={startGame}
                  disabled={!setupReady}
                  className="rounded-2xl bg-orange-700 px-6 shadow-lg hover:bg-orange-800 disabled:opacity-50"
                >
                  <Shuffle className="mr-2 h-4 w-4" />
                  인도 보드게임 시작하기
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 xl:grid-cols-[1fr_410px]">
          <IndiaBoard boardEvents={boardEvents} teams={teams} turn={turn} />

          <div className="space-y-4">
            <Card className="rounded-[2rem] border-orange-200 bg-white/95 shadow-xl backdrop-blur">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-orange-950">
                    게임 진행
                  </h2>
                  {winner ? (
                    <Trophy className="h-6 w-6 text-amber-500" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-orange-500" />
                  )}
                </div>

                <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-orange-950 shadow-inner">
                  {message}
                </div>

                <div className="flex justify-center py-1">
                  <DiceFace value={dice} rolling={rollingDice} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {teams.map((team, index) => {
                    const status = teamStatus[index];

                    return (
                      <div
                        key={team.id}
                        className={`rounded-2xl border p-3 ${
                          turn === index && phase === "play" && !winner
                            ? "border-orange-900 bg-orange-50 shadow-lg"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-black">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-xs shadow ${team.color}`}
                          >
                            {team.icon}
                          </span>
                          <span className={team.textColor}>{team.name}</span>
                        </div>

                        <p className="mt-2 text-xs text-slate-600">
                          위치: {team.position === 0 ? "START" : team.position}
                        </p>
                        <p className="text-xs text-slate-600">
                          점수: {team.score}
                        </p>
                        <p className="text-xs text-slate-500">
                          {status?.shield ? "🛡 방어막 " : ""}
                          {status?.double ? "×2 더블 " : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <Button
                  onClick={rollDice}
                  disabled={
                    phase !== "play" ||
                    !!winner ||
                    hasMoved ||
                    !!currentEvent ||
                    rollingDice
                  }
                  className="w-full rounded-2xl bg-orange-700 shadow-lg hover:bg-orange-800"
                >
                  <Dice5 className="mr-2 h-4 w-4" />
                  주사위 굴리기
                </Button>

                {!currentEvent &&
                  hasMoved &&
                  !winner &&
                  phase === "play" &&
                  !rollingDice && (
                    <Button
                      onClick={nextTurn}
                      variant="secondary"
                      className="w-full rounded-2xl"
                    >
                      다음 팀으로 넘기기
                    </Button>
                  )}
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] bg-white/95 shadow-xl backdrop-blur">
              <CardContent className="p-5 text-sm text-slate-600">
                <h2 className="mb-2 text-lg font-black text-orange-950">
                  규칙
                </h2>
                <p>보드판: 1~15번까지 총 15칸</p>
                <p>질문 칸: 12개 / Bonus 칸: 3개</p>
                <p>각 팀: 질문 2개 + Power-up 1개 설정 후 제출</p>
                <p>주사위 값: 0, 1, 2, 3, 4, -1</p>
                <p>Bonus 칸: 현재 팀이 선택한 Power-up 발동</p>
                <p>성공: +10점, 더블 상태면 +20점</p>
                <p>실패 / 패스: -5점, 한 칸 뒤로 이동</p>
                <p>FINISH 도착 또는 {WIN_SCORE}점 달성 시 승리</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <EventModal
        event={currentEvent}
        currentTeam={currentTeam}
        onSuccess={handleSuccess}
        onFail={handleFail}
        onClose={() => setCurrentEvent(null)}
      />
    </div>
  );
}