# Team Invitation System

## Overview
The team invitation system allows organization owners and admins to invite new members to join their team via email.

## How It Works

### 1. Sending Invitations
- Only **owners** and **admins** can invite new team members
- Navigate to the Team page and click "Invite Member"
- Enter the email address and select a role (Member or Admin)
- An invitation email will be sent to the specified address

### 2. Email Delivery
- Emails are sent using **Resend** email service
- The invitation includes a secure link that expires in 7 days
- Recipients receive a professional-looking email with clear instructions

### 3. Accepting Invitations
- Recipients click the invitation link in their email
- If they don't have an account, they can create one directly from the invitation page
- If they have an account, they sign in to accept the invitation
- Once accepted, they become a member of the organization

### 4. Managing Pending Invitations
- View all pending invitations on the Team page
- **Resend** invitations if needed
- **Cancel** invitations before they're accepted
- See expiration dates and who sent each invitation

## Roles

### Owner
- Full access to everything
- Can invite and manage all team members
- Can change organization settings

### Admin  
- Can invite and manage team members
- Can access all flows and contacts
- Cannot delete the organization

### Member
- Can access flows and contacts
- Cannot manage team members
- Cannot access organization settings

## Email Configuration

### For Development
- Uses `onboarding@resend.dev` as the sender address
- Works out of the box for testing

### For Production
1. **Verify your domain** in Resend
2. **Update the sender address** in the edge function
3. **Set up proper DKIM/SPF** records for better deliverability

## Security Features

- **Secure tokens** for invitation links
- **Email validation** to prevent duplicates
- **Expiration dates** (7 days) for all invitations
- **Role-based permissions** for invitation management
- **Automatic cleanup** of expired invitations

## Troubleshooting

### Email Not Received
1. Check spam/junk folders
2. Verify the email address is correct
3. Check Resend logs in the Supabase dashboard
4. Resend the invitation from the Team page

### Invitation Link Not Working
1. Check if the invitation has expired
2. Ensure the link is complete (not truncated)
3. Try resending a new invitation

### Domain Issues
1. Verify your domain is properly configured in Resend
2. Check DNS settings for DKIM and SPF records
3. Update the sender address in the edge function

## Edge Function Logs
You can monitor invitation emails in the Supabase Functions logs:
- Successful sends will show the Resend email ID
- Failed sends will show error details
- All invitation attempts are logged for debugging