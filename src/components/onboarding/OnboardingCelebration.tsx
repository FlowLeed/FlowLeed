import { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PartyPopper } from "lucide-react";

interface OnboardingCelebrationProps {
  message: string;
  ctaLabel: string;
  onComplete: () => void;
}

export const OnboardingCelebration = ({
  message,
  ctaLabel,
  onComplete,
}: OnboardingCelebrationProps) => {
  const [showConfetti, setShowConfetti] = useState(true);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);

    // Stop confetti after 5 seconds
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 5000);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
        <Card className="max-w-md w-full mx-4 animate-scale-in">
          <CardContent className="pt-6 text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-6">
                <PartyPopper className="h-16 w-16 text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{message}</h2>
              <p className="text-muted-foreground">
                Every step is set — now it's time to connect, care, and lead people where God is calling them.
              </p>
            </div>
            <Button onClick={onComplete} size="lg" className="w-full">
              {ctaLabel}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
