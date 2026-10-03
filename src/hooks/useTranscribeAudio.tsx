import { useMutation } from "@tanstack/react-query";
import { transcribeAudio } from "@/api/transcription";

interface TranscribeAudioRequest {
  file: File;
  /** Called with the transcript so far while it streams in. */
  onText: (text: string) => void;
}

export const useTranscribeAudio = () =>
  useMutation({
    mutationFn: ({ file, onText }: TranscribeAudioRequest) => transcribeAudio(file, onText),
  });
