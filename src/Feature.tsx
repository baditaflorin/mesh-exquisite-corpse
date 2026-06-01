import { useEffect, useRef, useState } from "react";
import { MeshNameInput, type MeshConfig, type YRoom } from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Stroke = { color: string; points: number[] };
type StripState = { name: string; strokes: Stroke[]; done: boolean };

const NAME_KEY = (prefix: string) => `${prefix}:displayName`;
const STRIP_LABELS = ["head", "body", "legs"] as const;
const STRIP_HEIGHT = 200;
const STRIP_WIDTH = 360;
const COLORS = ["#14b8a6", "#fbbf24", "#f472b6", "#60a5fa", "#ffffff"];

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="exq-screen">
        <h1>exquisite corpse</h1>
        <p className="exq-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const [name, setName] = useState(
    () => localStorage.getItem(NAME_KEY(config.storagePrefix)) ?? "",
  );
  const [color, setColor] = useState(COLORS[0]!);
  const [, rerender] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<number[] | null>(null);

  useEffect(() => {
    if (name) localStorage.setItem(NAME_KEY(config.storagePrefix), name);
  }, [name, config.storagePrefix]);

  useEffect(() => {
    const strips = room.doc.getMap<StripState>("strips");
    const meta = room.doc.getMap<string>("meta");
    const onChange = () => rerender((n) => n + 1);
    strips.observe(onChange);
    meta.observe(onChange);
    if (!meta.has("phase")) meta.set("phase", "drawing");
    return () => {
      strips.unobserve(onChange);
      meta.unobserve(onChange);
    };
  }, [room]);

  const strips = room.doc.getMap<StripState>("strips");
  const meta = room.doc.getMap<string>("meta");
  const phase = (meta.get("phase") as "drawing" | "revealed") ?? "drawing";

  // assignments map: stripIdx -> peerId
  const occupants = new Map<number, string>();
  STRIP_LABELS.forEach((_, i) => {
    const peerOnStrip = Array.from(strips.keys()).find((peerId) => {
      const s = strips.get(peerId);
      return (s as unknown as { stripIdx: number } | undefined)?.stripIdx === i;
    });
    if (peerOnStrip) occupants.set(i, peerOnStrip);
  });

  // shape the value stored:  { name, stripIdx, strokes, done }
  type StoredStrip = StripState & { stripIdx: number };
  const myStripEntry = strips.get(room.peerId) as StoredStrip | undefined;
  const myStripIdx = myStripEntry?.stripIdx ?? null;

  const claim = (idx: number) => {
    if (!name.trim()) return;
    const taken = occupants.get(idx);
    if (taken && taken !== room.peerId) return;
    room.doc.transact(() => {
      // release any other strip I had
      strips.delete(room.peerId);
      strips.set(room.peerId, {
        name: name.trim(),
        stripIdx: idx,
        strokes: [],
        done: false,
      } as StoredStrip as unknown as StripState);
    });
  };

  const release = () => strips.delete(room.peerId);

  const markDone = () => {
    if (!myStripEntry) return;
    strips.set(room.peerId, { ...myStripEntry, done: true });
  };

  const unmarkDone = () => {
    if (!myStripEntry) return;
    strips.set(room.peerId, { ...myStripEntry, done: false });
  };

  const allDone = STRIP_LABELS.every((_, i) => {
    const peer = occupants.get(i);
    if (!peer) return false;
    return (strips.get(peer) as StoredStrip | undefined)?.done;
  });

  const reveal = () => meta.set("phase", "revealed");
  const newRound = () => {
    room.doc.transact(() => {
      strips.forEach((_v, k) => strips.delete(k));
      meta.set("phase", "drawing");
    });
  };

  // Local canvas (only renders MY strip during drawing phase; full corpse during reveal)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0e1117";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawStrokes = (strokes: Stroke[]) => {
      strokes.forEach((s) => {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        if (s.points.length >= 2) {
          ctx.moveTo(s.points[0]!, s.points[1]!);
          for (let i = 2; i < s.points.length; i += 2) {
            ctx.lineTo(s.points[i]!, s.points[i + 1]!);
          }
        }
        ctx.stroke();
      });
    };

    // draw boundary lines
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1;
    for (let i = 1; i < STRIP_LABELS.length; i++) {
      const y = i * STRIP_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (phase === "revealed") {
      STRIP_LABELS.forEach((_, i) => {
        const peer = occupants.get(i);
        if (peer) {
          const s = strips.get(peer) as StoredStrip | undefined;
          if (s?.strokes) {
            ctx.save();
            ctx.translate(0, i * STRIP_HEIGHT);
            drawStrokes(s.strokes);
            ctx.restore();
          }
        }
      });
    } else if (myStripIdx !== null && myStripEntry?.strokes) {
      ctx.save();
      ctx.translate(0, myStripIdx * STRIP_HEIGHT);
      drawStrokes(myStripEntry.strokes);
      ctx.restore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, phase, myStripIdx, myStripEntry?.strokes.length]);

  const getPoint = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
    const y =
      ((ev.clientY - rect.top) / rect.height) * canvas.height - (myStripIdx ?? 0) * STRIP_HEIGHT;
    return [x, y];
  };

  const onPointerDown = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== "drawing" || myStripIdx === null || myStripEntry?.done) return;
    const [x, y] = getPoint(ev);
    if (y! < 0 || y! > STRIP_HEIGHT) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = [x!, y!];
  };

  const onPointerMove = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    const [x, y] = getPoint(ev);
    if (y! < 0 || y! > STRIP_HEIGHT) return;
    currentStrokeRef.current.push(x!, y!);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    const len = currentStrokeRef.current.length;
    ctx.moveTo(
      currentStrokeRef.current[len - 4]!,
      currentStrokeRef.current[len - 3]! + (myStripIdx ?? 0) * STRIP_HEIGHT,
    );
    ctx.lineTo(x!, y! + (myStripIdx ?? 0) * STRIP_HEIGHT);
    ctx.stroke();
  };

  const onPointerUp = () => {
    if (!drawingRef.current || !currentStrokeRef.current) {
      drawingRef.current = false;
      currentStrokeRef.current = null;
      return;
    }
    if (currentStrokeRef.current.length >= 4 && myStripEntry) {
      const newStroke: Stroke = { color, points: currentStrokeRef.current.slice() };
      strips.set(room.peerId, {
        ...myStripEntry,
        strokes: [...myStripEntry.strokes, newStroke],
      });
    }
    drawingRef.current = false;
    currentStrokeRef.current = null;
  };

  return (
    <div className="exq-screen">
      <header className="exq-header">
        <h1>exquisite corpse</h1>
        <p className="exq-tagline">
          The party drawing game: three people each draw one body part — head, body, legs — without
          seeing the others. Hit reveal and the surreal creature is stitched together.
        </p>
        <p className="exq-status">
          phase: {phase} ·{" "}
          {Array.from(occupants.entries())
            .map(([i, peer]) => {
              const s = strips.get(peer) as StoredStrip | undefined;
              return `${STRIP_LABELS[i]}: ${s?.name}${s?.done ? " ✓" : ""}`;
            })
            .join(" · ") || "no parts claimed yet"}
        </p>
      </header>

      <MeshNameInput
        className="exq-name"
        value={name}
        onChange={setName}
        placeholder="your name"
        maxLength={48}
      />

      <div className="exq-claims">
        {STRIP_LABELS.map((label, i) => {
          const occ = occupants.get(i);
          const mine = occ === room.peerId;
          const s = occ ? (strips.get(occ) as StoredStrip | undefined) : undefined;
          return (
            <button
              key={label}
              type="button"
              className={`exq-claim ${mine ? "is-mine" : occ ? "is-taken" : ""}`}
              onClick={() => (mine ? release() : claim(i))}
              disabled={!!occ && !mine}
            >
              <strong>{label}</strong>
              <span>{mine ? "you" : occ ? s?.name : "open"}</span>
            </button>
          );
        })}
      </div>

      {phase === "drawing" && (
        <p className="exq-instructions">
          {myStripIdx === null
            ? "Claim head, body, or legs above to start drawing. You need all three taken by three people (open three tabs to try solo) before the corpse can be revealed."
            : `You're drawing the ${STRIP_LABELS[myStripIdx]} — no one else sees it until reveal. Mark “done” when finished; reveal unlocks once all three parts are done.`}
        </p>
      )}

      <div className="exq-tools">
        {myStripIdx !== null &&
          phase === "drawing" &&
          COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`exq-color ${c === color ? "is-active" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`color ${c}`}
            />
          ))}
        {myStripIdx !== null && phase === "drawing" && (
          <button
            type="button"
            className="exq-done"
            onClick={myStripEntry?.done ? unmarkDone : markDone}
          >
            {myStripEntry?.done ? "↺ undo done" : "✓ I'm done"}
          </button>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={STRIP_WIDTH}
        height={STRIP_HEIGHT * STRIP_LABELS.length}
        className="exq-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      <div className="exq-phase-actions">
        {phase === "drawing" ? (
          <button type="button" className="exq-reveal-btn" onClick={reveal} disabled={!allDone}>
            🎉 reveal the corpse{!allDone && " (waiting for all 3 done)"}
          </button>
        ) : (
          <button type="button" className="exq-newround-btn" onClick={newRound}>
            new round
          </button>
        )}
      </div>
    </div>
  );
}
