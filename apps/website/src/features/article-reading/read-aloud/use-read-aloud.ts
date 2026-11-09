import { useEffect, useRef, useState } from "react";
import { getReadingChunks } from "./reading-text";

type Playback = "idle" | "playing" | "paused" | "finished";
type Session = {
  chunks: string[];
  index: number;
  utterance: SpeechSynthesisUtterance | null;
};

function useReadAloud(contentId: string, title: string) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [playback, setPlayback] = useState<Playback>("idle");
  const [error, setError] = useState("");
  const [position, setPosition] = useState({ current: 0, total: 0 });
  const [rate, setRate] = useState(1);
  const rateRef = useRef(1);
  const session = useRef<Session | null>(null);
  const phase = useRef<Playback>("idle");

  useEffect(() => {
    setSupported("speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
    const cancel = () => {
      if (!session.current) return;
      session.current = null; // Ignore delayed events from a cancelled utterance.
      window.speechSynthesis.cancel();
    };
    window.addEventListener("pagehide", cancel);
    const restore = () => {
      phase.current = "idle";
      setPlayback("idle");
      setPosition({ current: 0, total: 0 });
    };
    window.addEventListener("pageshow", restore);
    return () => {
      window.removeEventListener("pagehide", cancel);
      window.removeEventListener("pageshow", restore);
      cancel();
    };
  }, []);

  function updatePlayback(next: Playback) {
    phase.current = next;
    setPlayback(next);
  }

  function fail(message: string) {
    session.current = null;
    window.speechSynthesis.cancel();
    updatePlayback("idle");
    setError(message);
    setPosition({ current: 0, total: 0 });
  }

  function speakNext(current: Session) {
    if (session.current !== current || phase.current !== "playing") return;
    if (current.index >= current.chunks.length) {
      session.current = null;
      updatePlayback("finished");
      return;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(current.chunks[current.index]);
      utterance.lang = /\p{Script=Han}/u.test(utterance.text) ? "zh-CN" : "en-US";
      const voices = window.speechSynthesis.getVoices();
      const voice =
        voices.find((voice) => voice.lang === utterance.lang) ??
        voices.find((voice) => voice.lang.startsWith(utterance.lang.split("-")[0]));
      if (voice) utterance.voice = voice;
      utterance.rate = rateRef.current;
      current.utterance = utterance; // Keep the active utterance alive until it ends.
      setPosition({ current: current.index + 1, total: current.chunks.length });
      utterance.onend = () => {
        if (session.current !== current || current.utterance !== utterance) return;
        current.utterance = null;
        current.index += 1;
        speakNext(current);
      };
      utterance.onerror = () => {
        if (session.current !== current || current.utterance !== utterance) return;
        fail("朗读未能完成，请重试或检查设备的语音设置。");
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      fail("无法启动朗读，请检查设备的语音设置后重试。");
    }
  }

  function toggle() {
    if (!supported) return;
    try {
      if (phase.current === "playing") {
        window.speechSynthesis.pause();
        updatePlayback("paused");
        return;
      }
      if (phase.current === "paused" && session.current) {
        updatePlayback("playing");
        window.speechSynthesis.resume();
        if (!session.current.utterance) speakNext(session.current);
        return;
      }
      const content = document.getElementById(contentId);
      const chunks = content ? getReadingChunks(content, title) : [];
      if (!chunks.length) {
        setError("这篇文章暂无可朗读的正文。");
        return;
      }
      const current: Session = { chunks, index: 0, utterance: null };
      session.current = current;
      setError("");
      updatePlayback("playing");
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      speakNext(current);
    } catch {
      fail("无法启动朗读，请检查设备的语音设置后重试。");
    }
  }

  function stop() {
    session.current = null;
    window.speechSynthesis.cancel();
    updatePlayback("idle");
    setPosition({ current: 0, total: 0 });
    setError("");
  }

  function changeRate(value: number) {
    rateRef.current = value;
    setRate(value);
  }

  return { supported, playback, error, position, rate, toggle, stop, changeRate };
}

export { useReadAloud };
