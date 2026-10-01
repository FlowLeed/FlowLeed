import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Section,
  Hr,
} from '@react-email/components';
import * as React from 'react';

interface PasswordResetEmailProps {
  resetUrl: string;
  email: string;
}

export const PasswordResetEmail = ({
  resetUrl,
  email,
}: PasswordResetEmailProps) => (
  <Html>
    <Head />
    <Preview>Reset your Flowleed password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Reset Your Password</Heading>
        
        <Text style={text}>
          We received a request to reset the password for your Flowleed account ({email}).
        </Text>
        
        <Text style={text}>
          Click the button below to create a new password:
        </Text>
        
        <Section style={buttonContainer}>
          <Link
            href={resetUrl}
            target="_blank"
            style={button}
          >
            Reset Password
          </Link>
        </Section>
        
        <Text style={text}>
          Or copy and paste this link into your browser:
        </Text>
        
        <Text style={link}>
          {resetUrl}
        </Text>
        
        <Hr style={hr} />
        
        <Text style={footerText}>
          This password reset link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </Text>
        
        <Text style={footer}>
          Flowleed - Church relationship management made simple
        </Text>
      </Container>
    </Body>
  </Html>
);

export default PasswordResetEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '580px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0 40px',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  padding: '0 40px',
};

const buttonContainer = {
  padding: '27px 40px',
};

const button = {
  backgroundColor: '#5469d4',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 20px',
};

const link = {
  color: '#5469d4',
  fontSize: '14px',
  textDecoration: 'underline',
  padding: '0 40px',
  wordBreak: 'break-all' as const,
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 40px',
};

const footerText = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  padding: '0 40px',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  padding: '0 40px',
  marginTop: '12px',
};
