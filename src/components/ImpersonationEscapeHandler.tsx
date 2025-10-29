import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useImpersonation } from '@/hooks/useImpersonation';

/**
 * Global escape handler for impersonation via URL parameter
 * Usage: Add ?end_impersonation=1 to any URL to immediately end impersonation
 */
export const ImpersonationEscapeHandler = () => {
  const [searchParams] = useSearchParams();
  const { endImpersonation, isImpersonating } = useImpersonation();

  useEffect(() => {
    const shouldEndImpersonation = searchParams.get('end_impersonation') === '1';
    
    if (shouldEndImpersonation && isImpersonating) {
      console.log('[ImpersonationEscapeHandler] URL escape triggered');
      endImpersonation();
    }
  }, [searchParams, isImpersonating, endImpersonation]);

  return null;
};
