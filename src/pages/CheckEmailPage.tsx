import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import flowleedLogo from '@/assets/flowleed_logo_new.png';
import { MailCheck } from 'lucide-react';

/** Shown after sign-up when the new account must confirm its email address before signing in. */
export default function CheckEmailPage() {
  // AuthPage passes the address in navigation state. Opened directly, the page has none.
  const email = (useLocation().state as { email?: string } | null)?.email;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={flowleedLogo} alt="Flowleed" className="h-8 w-auto object-contain mx-auto mb-2" />
          <MailCheck className="h-10 w-10 text-primary mx-auto mb-2" aria-hidden="true" />
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to{' '}
            {email ? <span className="font-medium text-foreground break-all">{email}</span> : 'your email address'}.
            Open it to activate your account, then sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Can't find it? Check your spam or junk folder.
          </p>
          <Button asChild className="w-full">
            <Link to="/auth?mode=signin">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
