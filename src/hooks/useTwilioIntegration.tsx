import { useProfile } from './useProfile';
import { useTwilioNumbers } from './useTwilioNumbers';
import { useAuth } from './useAuth';

export const useTwilioIntegration = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { numbers } = useTwilioNumbers();
  
  const assignedNumber = numbers.find(num => num.assigned_to_user_id === user?.id);
  
  // Use Twilio if:
  // 1. User has the preference enabled (default true)
  // 2. User has an assigned Twilio number
  const shouldUseTwilio = 
    profile?.use_twilio_integration !== false && 
    !!assignedNumber;
  
  return {
    shouldUseTwilio,
    assignedNumber,
    isEnabled: profile?.use_twilio_integration !== false,
  };
};
