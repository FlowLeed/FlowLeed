import { useCallback, useEffect, useRef } from "react";

// Voice input through the browser's own speech recognition (Web Speech API), so no server or API key
// is involved. Chrome, Edge and Safari support it; Firefox doesn't. The browser turns the speech into
// text with its own service (Google for Chrome and Edge, Apple for Safari).

interface SpeechAlternative { transcript: string }
interface SpeechResult { isFinal: boolean; 0: SpeechAlternative }
interface SpeechResultEvent { resultIndex: number; results: ArrayLike<SpeechResult> }
interface SpeechErrorEvent { error: string }

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const getRecognitionConstructor = (): SpeechRecognitionConstructor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

interface ListenHandlers {
  /** The transcript so far, including words still being recognised. */
  onText: (text: string) => void;
  /** Recognition ended without stop() — silence, the browser's own limit, or an error code such as "not-allowed". */
  onEnd: (text: string, error?: string) => void;
}

export function useSpeechRecognition() {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const textRef = useRef("");
  const stopRef = useRef<((text: string) => void) | null>(null);

  const start = useCallback(({ onText, onEnd }: ListenHandlers) => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) throw new Error("Speech recognition isn't supported in this browser.");
    recognitionRef.current?.abort();

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    let finalText = "";
    let error: string | undefined;
    textRef.current = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      textRef.current = (finalText + interim).trim();
      onText(textRef.current);
    };
    recognition.onerror = (event) => { error = event.error; };
    recognition.onend = () => {
      recognitionRef.current = null;
      const resolveStop = stopRef.current;
      stopRef.current = null;
      if (resolveStop) resolveStop(textRef.current);
      else onEnd(textRef.current, error);
    };
    recognition.start();
    recognitionRef.current = recognition;
  }, []);

  /** Stops listening and resolves with the final transcript. */
  const stop = useCallback((): Promise<string> => {
    const recognition = recognitionRef.current;
    if (!recognition) return Promise.resolve(textRef.current);
    return new Promise((resolve) => {
      stopRef.current = resolve;
      recognition.stop();
    });
  }, []);

  /** Stops listening and throws the transcript away. */
  const cancel = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    stopRef.current = null;
    if (recognition) {
      recognition.onend = null;
      recognition.abort();
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  return { supported: !!getRecognitionConstructor(), start, stop, cancel };
}
