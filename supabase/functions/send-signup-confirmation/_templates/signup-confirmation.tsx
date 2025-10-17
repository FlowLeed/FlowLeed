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
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface SignupConfirmationEmailProps {
  fullName: string;
  organizationName: string;
  verificationUrl: string;
  email: string;
}

export const SignupConfirmationEmail = ({
  fullName,
  organizationName,
  verificationUrl,
  email,
}: SignupConfirmationEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to Flowleed - Verify your email to get started</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to Flowleed! 🎉</Heading>
        
        <Text style={text}>Hi {fullName},</Text>
        
        <Text style={text}>
          Thank you for signing up for Flowleed! We're excited to have {organizationName} on board.
        </Text>
        
        <Text style={text}>
          To get started, please verify your email address by clicking the button below:
        </Text>
        
        <Section style={buttonContainer}>
          <Link
            href={verificationUrl}
            target="_blank"
            style={button}
          >
            Verify Email Address
          </Link>
        </Section>
        
        <Text style={text}>
          Or copy and paste this link into your browser:
        </Text>
        
        <Text style={link}>
          {verificationUrl}
        </Text>
        
        <Hr style={hr} />
        
        <Text style={footerText}>
          This verification link will expire in 48 hours. If you didn't create a Flowleed account, you can safely ignore this email.
        </Text>
        
        <Text style={footer}>
          Flowleed - Church relationship management made simple
        </Text>
      </Container>
    </Body>
  </Html>
);

export default SignupConfirmationEmail;

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
