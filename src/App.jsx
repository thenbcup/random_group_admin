import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shuffle,
  Play,
  RotateCcw,
  Users,
  Timer,
  Grid3X3,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "./supabaseClient";

type SeatMap = Record<string, string>;

type RemoteState = {
  id: string;
  names_text: string;
  fixed_seats_text: string;
  rows: number;
  cols: number;
  countdown_seconds: number;
  excluded_text: string;
  revealed: boolean;
  seat_map: SeatMap;
  updated_at: string;
};

function shuffleArray<T>(array: T[]): T[] {
  const copied = [...array];
  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function buildSeatLabels(rows: number, cols: number): string[] {
  const seats: string[] = [];
  for (let r = 0; r < rows; r++) {
    const rowLabel = String.fromCharCode(65 + r);
    for (let c = 1; c <= cols; c++) {
      seats.push(`${rowLabel}${c}`);
    }
  }
  return seats;
}

function parseExcludedSeats(text: string): Set<string> {
  return new Set(
    text
      .split(/[\s,]+/)
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean)
  );
}

function parseFixedSeats(text: string): {
  fixedMap: Record<string, string>;
  errors: string[];
} {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const fixedMap: Record<string, string> = {};
  const errors: string[] = [];

  lines.forEach((line, index) => {
    const parts = line.split("=");
    if (parts.length !== 2) {
      errors.push(`${index + 1}번째 줄 형식 오류: ${line}`);
      return;
    }

    const seat = parts[0].trim().toUpperCase();
    const name = parts[1].trim();

    if (!seat || !name) {
      errors.push(`${index + 1}번째 줄 값 누락: ${line}`);
      return;
    }

    if (fixedMap[seat]) {
      errors.push(`${index + 1}번째 줄 중복 좌석: ${seat}`);
      return;
    }

    fixedMap[seat] = name;
  });

  return { fixedMap, errors };
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const min = String(Math.floor(s / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", backgroundColor: "#f1f5f9", padding: "24px", boxSizing: "border-box", fontFamily: "Arial, sans-serif" },
  layout: { maxWidth: "1450px", margin: "0 auto", display: "grid", gridTemplateColumns: "460px 1fr", gap: "24px" },
  card: { backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "24px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", overflow: "hidden" },
  cardHeader: { padding: "24px 24px 8px 24px" },
  cardBody: { padding: "24px" },
  titleRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" },
  title: { fontSize: "28px", fontWeight: 700, color: "#1e293b", margin: 0 },
  subText: { fontSize: "14px", color: "#64748b", margin: 0, lineHeight: 1.5 },
  field: { marginBottom: "18px" },
  label: { display: "block", fontSize: "14px", fontWeight: 600, color: "#334155", marginBottom: "8px" },
  input: { width: "100%", height: "42px", padding: "0 12px", borderRadius: "12px", border: "1px solid #cbd5e1", boxSizing: "border-box", fontSize: "14px", backgroundColor: "#ffffff" },
  textarea: { width: "100%", minHeight: "170px", padding: "12px", borderRadius: "12px", border: "1px solid #cbd5e1", boxSizing: "border-box", fontSize: "14px", backgroundColor: "#ffffff", resize: "vertical", lineHeight: 1.5 },
  helper: { fontSize: "12px", color: "#64748b", marginTop: "6px", lineHeight: 1.5 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", marginBottom: "18px" },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" },
  buttonPrimary: { height: "48px", border: "none", borderRadius: "16px", backgroundColor: "#2563eb", color: "#ffffff", fontSize: "16px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" },
  buttonSecondary: { height: "48px", border: "1px solid #cbd5e1", borderRadius: "16px", backgroundColor: "#f8fafc", color: "#0f172a", fontSize: "16px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" },
  statBox: { borderRadius: "16px", backgroundColor: "#f8fafc", padding: "16px" },
  statLabel: { display: "flex", alignItems: "center", gap: "6px", color: "#475569", fontSize: "14px", marginBottom: "6px" },
  statValue: { fontSize: "28px", fontWeight: 800, color: "#1e293b" },
  warning: { marginTop: "16px", border: "1px solid #fde68a", backgroundColor: "#fffbeb", color: "#92400e", borderRadius: "16px", padding: "14px", fontSize: "14px", lineHeight: 1.5 },
  errorBox: { marginTop: "10px", border: "1px solid #fecaca", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "16px", padding: "14px", fontSize: "13px", lineHeight: 1.6 },
  rightColumn: { display: "flex", flexDirection: "column", gap: "24px" },
  statusWrap: { minHeight: "180px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "32px", textAlign: "center" },
  statusLabel: { display: "flex", alignItems: "center", gap: "8px", color: "#64748b", fontSize: "15px" },
  countdownText: { fontSize: "64px", fontWeight: 900, color: "#1e293b", marginTop: "8px", letterSpacing: "-0.03em" },
  statusTitle: { fontSize: "40px", fontWeight: 900, color: "#1e293b", marginTop: "8px" },
  seatGridWrap: { padding: "24px" },
  seatGridTitle: { fontSize: "22px", fontWeight: 700, color: "#1e293b", margin: "0 0 18px 0" },
  tagWrap: { display: "flex", flexWrap: "wrap", gap: "8px" },
  tag: { display: "inline-block", padding: "6px 12px", borderRadius: "10px", backgroundColor: "#e2e8f0", color: "#1e293b", fontSize: "14px", fontWeight: 600 },
};

export default function App() {
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [isEditUnlocked, setIsEditUnlocked] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");

  const [namesText, setNamesText] = useState("");
  const [fixedSeatsText, setFixedSeatsText] = useState("");
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(4);
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const [excludedText, setExcludedText] = useState("");

  const [revealed, setRevealed] = useState(false);
  const [remaining, setRemaining] = useState(5);
  const [isRunning, setIsRunning] = useState(false);
  const [seatMap, setSeatMap] = useState<SeatMap>({});
  const [loading, setLoading] = useState(true);

  const timerRef = useRef<number | null>(null);

  const names = useMemo(() => {
    return namesText.split("\n").map((name) => name.trim()).filter(Boolean);
  }, [namesText]);

  const excludedSeats = useMemo(() => parseExcludedSeats(excludedText), [excludedText]);
  const { fixedMap, errors: fixedSeatErrors } = useMemo(() => parseFixedSeats(fixedSeatsText), [fixedSeatsText]);
  const allSeats = useMemo(() => buildSeatLabels(Number(rows), Number(cols)), [rows, cols]);
  const availableSeats = useMemo(() => allSeats.filter((seat) => !excludedSeats.has(seat)), [allSeats, excludedSeats]);
  const fixedSeatEntries = useMemo(() => Object.entries(fixedMap), [fixedMap]);

  const invalidFixedSeats = useMemo(() => fixedSeatEntries.filter(([seat]) => !allSeats.includes(seat)).map(([seat]) => seat), [fixedSeatEntries, allSeats]);
  const excludedFixedSeats = useMemo(() => fixedSeatEntries.filter(([seat]) => excludedSeats.has(seat)).map(([seat]) => seat), [fixedSeatEntries, excludedSeats]);

  const duplicateFixedNames = useMemo(() => {
    const countMap: Record<string, number> = {};
    Object.values(fixedMap).forEach((name) => {
      countMap[name] = (countMap[name] || 0) + 1;
    });
    return Object.keys(countMap).filter((name) => countMap[name] > 1);
  }, [fixedMap]);

  const fixedNamesNotInList = useMemo(() => Object.values(fixedMap).filter((name) => !names.includes(name)), [fixedMap, names]);

  const validFixedMap = useMemo(() => {
    const next: Record<string, string> = {};
    Object.entries(fixedMap).forEach(([seat, name]) => {
      const isSeatValid = allSeats.includes(seat);
      const isExcluded = excludedSeats.has(seat);
      const isNameInList = names.includes(name);
      if (isSeatValid && !isExcluded && isNameInList) {
        next[seat] = name;
      }
    });
    return next;
  }, [fixedMap, allSeats, excludedSeats, names]);

  const validFixedNames = useMemo(() => Object.values(validFixedMap), [validFixedMap]);
  const remainingNames = useMemo(() => names.filter((name) => !validFixedNames.includes(name)), [names, validFixedNames]);
  const remainingSeats = useMemo(() => availableSeats.filter((seat) => !validFixedMap[seat]), [availableSeats, validFixedMap]);
  const capacity = availableSeats.length;
  const overflow = names.length - capacity;

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopTimer();
  }, []);

  const loadRemoteState = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("seat_layout_state")
      .select("*")
      .eq("id", "main")
      .single();

    if (error) {
      console.error(error);
      setAdminMessage("공용 상태를 불러오지 못했습니다.");
      setLoading(false);
      return;
    }

    const state = data as RemoteState;
    setNamesText(state.names_text ?? "");
    setFixedSeatsText(state.fixed_seats_text ?? "");
    setRows(state.rows ?? 3);
    setCols(state.cols ?? 4);
    setCountdownSeconds(state.countdown_seconds ?? 5);
    setExcludedText(state.excluded_text ?? "");
    setRevealed(!!state.revealed);
    setSeatMap((state.seat_map as SeatMap) ?? {});
    setIsRunning(false);
    setRemaining(state.countdown_seconds ?? 5);
    setIsEditUnlocked(false);
    setAdminPasswordInput("");
    setAdminMessage(
      state.revealed
        ? "공용 배치 결과를 불러왔습니다. 수정하려면 관리자 비밀번호를 다시 입력해 주세요."
        : "관리자 인증 전에는 옵션 설정값이 표시되지 않습니다."
    );
    setLoading(false);
  };

  useEffect(() => {
    loadRemoteState();

    const channel = supabase
      .channel("seat-layout-state")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "seat_layout_state",
          filter: "id=eq.main",
        },
        () => {
          loadRemoteState();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const unlockEditing = () => {
    if (!adminPasswordInput.trim()) {
      setAdminMessage("관리자 비밀번호를 입력해 주세요.");
      return;
    }
    setIsEditUnlocked(true);
    setAdminMessage("관리자 인증이 완료되었습니다. 현재 설정을 수정할 수 있습니다.");
  };

  const lockEditing = (message?: string) => {
    setIsEditUnlocked(false);
    setAdminPasswordInput("");
    setAdminMessage(
      message || "관리자 잠금 상태입니다. 수정하려면 비밀번호를 다시 입력해 주세요."
    );
  };

  const saveStateViaFunction = async (payload: {
    namesText: string;
    fixedSeatsText: string;
    rows: number;
    cols: number;
    countdownSeconds: number;
    excludedText: string;
    revealed: boolean;
    seatMap: SeatMap;
  }) => {
    const { error } = await supabase.functions.invoke("seat-admin", {
      body: {
        action: "save",
        adminPassword: adminPasswordInput,
        payload,
      },
    });

    if (error) throw error;
  };

  const resetStateViaFunction = async () => {
    const { error } = await supabase.functions.invoke("seat-admin", {
      body: {
        action: "reset",
        adminPassword: adminPasswordInput,
      },
    });

    if (error) throw error;
  };

  const generateSeatMap = () => {
    const nextMap: Record<string, string> = { ...validFixedMap };
    const shuffledNames = shuffleArray(remainingNames);
    const shuffledSeats = shuffleArray(remainingSeats);

    shuffledNames.slice(0, shuffledSeats.length).forEach((name, index) => {
      nextMap[shuffledSeats[index]] = name;
    });

    return nextMap;
  };

  const startDraw = async () => {
    if (!isEditUnlocked) {
      alert("관리자 비밀번호 인증 후에만 설정 수정 및 추첨 실행이 가능합니다.");
      return;
    }

    stopTimer();

    if (!names.length) {
      alert("이름을 한 줄에 한 명씩 입력해 주세요.");
      return;
    }
    if (Number(rows) < 1 || Number(cols) < 1) {
      alert("행과 열은 1 이상이어야 합니다.");
      return;
    }
    if (!availableSeats.length) {
      alert("사용 가능한 좌석이 없습니다. 제외 좌석 설정을 확인해 주세요.");
      return;
    }
    if (fixedSeatErrors.length > 0) {
      alert("고정 좌석 입력 형식을 먼저 확인해 주세요.");
      return;
    }
    if (duplicateFixedNames.length > 0) {
      alert("고정 좌석에 같은 이름이 중복 지정되어 있습니다.");
      return;
    }

    const preparedMap = generateSeatMap();

    setSeatMap(preparedMap);
    setRevealed(false);
    setIsRunning(true);
    setRemaining(Number(countdownSeconds));

    try {
      await saveStateViaFunction({
        namesText,
        fixedSeatsText,
        rows,
        cols,
        countdownSeconds,
        excludedText,
        revealed: false,
        seatMap: preparedMap,
      });
    } catch (error) {
      console.error(error);
      alert("공용 결과 저장에 실패했습니다.");
      return;
    }

    lockEditing("추첨이 시작되어 화면이 잠겼습니다. 다시 수정하려면 관리자 비밀번호를 다시 입력해 주세요.");

    let current = Number(countdownSeconds);
    timerRef.current = window.setInterval(async () => {
      current -= 1;
      setRemaining(current);

      if (current <= 0) {
        stopTimer();
        setIsRunning(false);
        setRevealed(true);

        try {
          await saveStateViaFunction({
            namesText,
            fixedSeatsText,
            rows,
            cols,
            countdownSeconds,
            excludedText,
            revealed: true,
            seatMap: preparedMap,
          });
        } catch (error) {
          console.error(error);
        }
      }
    }, 1000);
  };

  const resetAll = async () => {
    if (!isEditUnlocked) {
      alert("관리자 비밀번호 인증 후에만 초기화할 수 있습니다.");
      return;
    }

    stopTimer();

    try {
      await resetStateViaFunction();
      setIsRunning(false);
      setRevealed(false);
      setRemaining(Number(countdownSeconds));
      setSeatMap({});
      lockEditing("초기화 후 화면이 다시 잠겼습니다. 다시 수정하려면 비밀번호를 입력해 주세요.");
    } catch (error) {
      console.error(error);
      alert("공용 상태 초기화에 실패했습니다.");
    }
  };

  const unassignedNames = useMemo(() => {
    if (overflow <= 0) return [];
    const assigned = new Set(Object.values(seatMap));
    return names.filter((name) => !assigned.has(name));
  }, [names, seatMap, overflow]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
          불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.layout}>
        {isEditUnlocked ? (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.titleRow}>
                <Shuffle size={24} />
                <h1 style={styles.title}>랜덤 자리 배치</h1>
              </div>
              <p style={styles.subText}>
                관리자 인증 후에만 모든 설정을 수정할 수 있으며, 추첨 시작 또는 초기화 후에는 다시 잠깁니다.
              </p>
            </div>

            <div style={styles.cardBody}>
              <div style={{ marginBottom: "18px", border: "1px solid #bfdbfe", backgroundColor: "#eff6ff", borderRadius: "16px", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", fontWeight: 700, color: "#1e293b" }}>
                  <ShieldCheck size={18} />
                  관리자 잠금 해제
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "center" }}>
                  <input
                    type="password"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="관리자 비밀번호 입력"
                    style={styles.input}
                  />
                  <button
                    onClick={() =>
                      lockEditing("관리자 잠금 상태입니다. 수정하려면 비밀번호를 다시 입력해 주세요.")
                    }
                    style={{ ...styles.buttonSecondary, height: "42px", padding: "0 14px" }}
                  >
                    잠금
                  </button>
                </div>

                <div style={{ marginTop: "8px", fontSize: "12px", color: "#1d4ed8" }}>
                  {adminMessage || "관리자만 옵션 설정값을 볼 수 있습니다."}
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>참여자 이름</label>
                <textarea value={namesText} onChange={(e) => setNamesText(e.target.value)} placeholder="한 줄에 한 명씩 입력" style={styles.textarea} />
                <div style={styles.helper}>예: 홍길동, 김영희, 이민수 ...</div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>고정 좌석</label>
                <textarea
                  value={fixedSeatsText}
                  onChange={(e) => setFixedSeatsText(e.target.value)}
                  placeholder={"예:\nA1=김민수\nB2=이서연"}
                  style={{ ...styles.textarea, minHeight: "130px" }}
                />
                <div style={styles.helper}>한 줄에 하나씩 입력해 주세요. 형식은 <strong>좌석=이름</strong> 입니다.</div>

                {(fixedSeatErrors.length > 0 ||
                  invalidFixedSeats.length > 0 ||
                  excludedFixedSeats.length > 0 ||
                  duplicateFixedNames.length > 0 ||
                  fixedNamesNotInList.length > 0) && (
                  <div style={styles.errorBox}>
                    {fixedSeatErrors.map((msg, idx) => <div key={`format-${idx}`}>- {msg}</div>)}
                    {invalidFixedSeats.map((seat) => <div key={`invalid-${seat}`}>- 존재하지 않는 좌석입니다: {seat}</div>)}
                    {excludedFixedSeats.map((seat) => <div key={`excluded-${seat}`}>- 제외 좌석과 중복되었습니다: {seat}</div>)}
                    {duplicateFixedNames.map((name) => <div key={`dup-${name}`}>- 같은 이름이 여러 좌석에 고정되었습니다: {name}</div>)}
                    {fixedNamesNotInList.map((name, idx) => <div key={`notin-${name}-${idx}`}>- 참여자 목록에 없는 이름입니다: {name}</div>)}
                  </div>
                )}
              </div>

              <div style={styles.grid3}>
                <div>
                  <label style={styles.label}>행</label>
                  <input type="number" min={1} value={rows} onChange={(e) => setRows(Math.max(1, Number(e.target.value) || 1))} style={styles.input} />
                </div>
                <div>
                  <label style={styles.label}>열</label>
                  <input type="number" min={1} value={cols} onChange={(e) => setCols(Math.max(1, Number(e.target.value) || 1))} style={styles.input} />
                </div>
                <div>
                  <label style={styles.label}>카운트다운(초)</label>
                  <input type="number" min={1} value={countdownSeconds} onChange={(e) => setCountdownSeconds(Math.max(1, Number(e.target.value) || 1))} style={styles.input} />
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>제외 좌석</label>
                <input value={excludedText} onChange={(e) => setExcludedText(e.target.value)} placeholder="예: A3, B4, C2" style={styles.input} />
                <div style={styles.helper}>쉼표 또는 공백으로 여러 좌석을 입력할 수 있습니다.</div>
              </div>

              <div style={{ ...styles.grid2, marginBottom: "18px" }}>
                <button onClick={startDraw} style={styles.buttonPrimary}>
                  <Play size={16} />
                  배치 시작
                </button>
                <button onClick={resetAll} style={styles.buttonSecondary}>
                  <RotateCcw size={16} />
                  초기화
                </button>
              </div>

              <div style={{ ...styles.grid2, marginBottom: "10px" }}>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>
                    <Users size={16} /> 참여자
                  </div>
                  <div style={styles.statValue}>{names.length}명</div>
                </div>
                <div style={styles.statBox}>
                  <div style={styles.statLabel}>
                    <Grid3X3 size={16} /> 사용 가능 좌석
                  </div>
                  <div style={styles.statValue}>{capacity}석</div>
                </div>
              </div>

              {overflow > 0 && (
                <div style={styles.warning}>
                  좌석보다 참여자가 {overflow}명 더 많습니다. 초과 인원은 미배정 처리됩니다.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.titleRow}>
                <ShieldAlert size={24} />
                <h1 style={styles.title}>관리자 인증</h1>
              </div>
              <p style={styles.subText}>
                비밀번호를 입력한 관리자만 옵션 설정을 보고 수정할 수 있습니다.
              </p>
            </div>

            <div style={styles.cardBody}>
              <div style={{ border: "1px solid #fecaca", backgroundColor: "#fff1f2", borderRadius: "16px", padding: "16px" }}>
                <label style={styles.label}>관리자 비밀번호</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "center" }}>
                  <input
                    type="password"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="관리자 비밀번호 입력"
                    style={styles.input}
                  />
                  <button onClick={unlockEditing} style={{ ...styles.buttonPrimary, height: "42px", padding: "0 14px" }}>
                    잠금 해제
                  </button>
                </div>
                <div style={{ marginTop: "8px", fontSize: "12px", color: "#b91c1c" }}>
                  {adminMessage || "관리자 인증 전에는 옵션 설정값이 표시되지 않습니다."}
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={styles.rightColumn}>
          <div style={styles.card}>
            <div style={styles.statusWrap}>
              <div style={styles.statusLabel}>
                <Timer size={18} /> 추첨 상태
              </div>

              <AnimatePresence mode="wait">
                {isRunning ? (
                  <motion.div key="countdown" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                    <div style={{ fontSize: "14px", color: "#64748b" }}>자리 배치 공개까지</div>
                    <div style={styles.countdownText}>{formatTime(remaining)}</div>
                  </motion.div>
                ) : revealed ? (
                  <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <div style={{ fontSize: "14px", color: "#64748b" }}>결과 공개</div>
                    <div style={styles.statusTitle}>자리 배치 완료</div>
                  </motion.div>
                ) : (
                  <motion.div key="ready" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <div style={{ fontSize: "14px", color: "#64748b" }}>준비 상태</div>
                    <div style={styles.statusTitle}>시작 버튼을 눌러 주세요</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.seatGridWrap}>
              <h2 style={styles.seatGridTitle}>좌석 배치도</h2>
              <div style={{ display: "grid", gap: "12px", gridTemplateColumns: `repeat(${Math.max(1, Number(cols))}, minmax(0, 1fr))` }}>
                {allSeats.map((seat) => {
                  const excluded = excludedSeats.has(seat);
                  const assignedName = seatMap[seat];

                  return (
                    <motion.div
                      key={seat}
                      layout
                      style={{
                        borderRadius: "16px",
                        border: excluded ? "1px dashed #cbd5e1" : "1px solid #e2e8f0",
                        backgroundColor: excluded ? "#f1f5f9" : "#ffffff",
                        color: excluded ? "#94a3b8" : "#1e293b",
                        padding: "16px",
                        textAlign: "center",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        position: "relative",
                      }}
                    >
                      <div style={{ marginBottom: "8px", fontSize: "12px", fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" }}>
                        {seat}
                      </div>

                      {excluded ? (
                        <div style={{ fontSize: "14px", fontWeight: 600 }}>사용 안 함</div>
                      ) : revealed ? (
                        <div style={{ fontSize: "16px", fontWeight: 700, wordBreak: "keep-all" }}>
                          {assignedName || "빈자리"}
                        </div>
                      ) : (
                        <div style={{ fontSize: "14px", color: "#94a3b8" }}>
                          {isRunning ? "배정 중..." : "대기"}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {revealed && unassignedNames.length > 0 && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#1e293b" }}>
                  미배정 인원
                </h2>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.tagWrap}>
                  {unassignedNames.map((name) => (
                    <span key={name} style={styles.tag}>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
