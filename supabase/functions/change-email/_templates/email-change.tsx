import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface EmailChangeProps {
  verifyUrl: string;
  currentEmail: string;
  newEmail: string;
  userName?: string;
}

export const EmailChangeEmail = ({
  verifyUrl,
  currentEmail,
  newEmail,
  userName,
}: EmailChangeProps) => (
  <Html>
    <Head />
    <Preview>Verify your new email address</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Verify Your New Email</Heading>
        {userName && (
          <Text style={text}>Hi {userName},</Text>
        )}
        <Text style={text}>
          You requested to change your email address from <strong>{currentEmail}</strong> to <strong>{newEmail}</strong>.
        </Text>
        <Text style={text}>
          To complete this change, please verify your new email address by clicking the button below:
        </Text>
        <Link
          href={verifyUrl}
          target="_blank"
          style={{
            ...link,
            display: 'inline-block',
            padding: '12px 24px',
            backgroundColor: '#2754C5',
            color: '#ffffff',
            textDecoration: 'none',
            borderRadius: '5px',
            fontWeight: 'bold',
            marginTop: '16px',
            marginBottom: '16px',
          }}
        >
          Verify New Email
        </Link>
        <Text style={text}>
          Or copy and paste this link into your browser:
        </Text>
        <Text style={code}>{verifyUrl}</Text>
        <Text style={{ ...text, color: '#ababab', marginTop: '14px' }}>
          This link will expire in 24 hours. If you didn't request this change, please ignore this email and your email address will remain unchanged.
        </Text>
        <Text style={footer}>
          This email was sent to {newEmail} because you requested an email change.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default EmailChangeEmail;

const main = {
  backgroundColor: '#ffffff',
};

const container = {
  paddingLeft: '12px',
  paddingRight: '12px',
  margin: '0 auto',
};

const h1 = {
  color: '#333',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
};

const link = {
  color: '#2754C5',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '14px',
  textDecoration: 'underline',
};

const text = {
  color: '#333',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '14px',
  margin: '24px 0',
};

const footer = {
  color: '#898989',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '12px',
  lineHeight: '22px',
  marginTop: '12px',
  marginBottom: '24px',
};

const code = {
  display: 'inline-block',
  padding: '16px 4.5%',
  width: '90.5%',
  backgroundColor: '#f4f4f4',
  borderRadius: '5px',
  border: '1px solid #eee',
  color: '#333',
  fontSize: '12px',
  wordBreak: 'break-all',
};
