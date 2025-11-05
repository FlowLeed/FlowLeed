import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSystemAdminCheck } from '@/hooks/useSystemAdminCheck';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import flowleedLogo from '@/assets/flowleed_logo_2-3.png';

export default function SuperAdminAuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const { isAdmin, loading: adminCheckLoading } = useSystemAdminCheck();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !adminCheckLoading) {
      if (isAdmin) {
        navigate('/fl-admin');
      }
    }
  }, [user, isAdmin, adminCheckLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      // The useEffect will handle redirect after checking admin status
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'hsl(233.33deg 100% 98.24%)' }}>
      <div className="w-full max-w-2xl space-y-8 p-8">
        <div className="text-center space-y-4">
          <img src={flowleedLogo} alt="Flowleed" className="h-6 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-purple-500 mb-2">&nbsp;</h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto italic">
            "To create a world where every church leads with clarity, every person feels known, and every step in a faith flows naturally — from guest to disciple to leader"
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@flowleed.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
