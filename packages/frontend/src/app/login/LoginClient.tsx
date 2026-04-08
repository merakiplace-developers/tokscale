"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import styled from "styled-components";

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background-color: var(--color-bg-default);
`;

const CardWrapper = styled.div`
  max-width: 400px;
  width: 100%;
`;

const Card = styled.div`
  border-radius: 16px;
  border: 1px solid var(--color-border-default);
  padding: 32px;
  background-color: var(--color-bg-default);
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 32px;
`;

const IconBox = styled.div`
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(to bottom right, #53d1f3, #3bc4e8);
  box-shadow: 0 10px 15px -3px rgba(83, 209, 243, 0.25);
`;

const Icon = styled.svg`
  width: 32px;
  height: 32px;
  color: white;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: bold;
  color: var(--color-fg-default);
`;

const Subtitle = styled.p`
  margin-top: 8px;
  color: var(--color-fg-muted);
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ProviderButton = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 24px;
  font-weight: 500;
  font-size: 15px;
  border-radius: 12px;
  border: 1px solid var(--color-border-default);
  background-color: var(--color-bg-elevated);
  color: var(--color-fg-default);
  text-decoration: none;
  transition: background-color 0.2s, border-color 0.2s;
  cursor: pointer;

  &:hover {
    background-color: var(--color-bg-default);
    border-color: var(--color-fg-muted);
  }
`;

const ProviderIcon = styled.svg`
  width: 20px;
  height: 20px;
  flex-shrink: 0;
`;

function LoginContent() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/leaderboard";

  return (
    <Container>
      <CardWrapper>
        <Card>
          <Header>
            <IconBox>
              <Icon fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </Icon>
            </IconBox>
            <Title>Sign in to Tokscale</Title>
            <Subtitle>Choose your sign-in method</Subtitle>
          </Header>

          <ButtonGroup>
            <ProviderButton
              href={`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`}
            >
              <ProviderIcon viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </ProviderIcon>
              Sign in with Google
            </ProviderButton>
          </ButtonGroup>
        </Card>
      </CardWrapper>
    </Container>
  );
}

export default function LoginClient() {
  return (
    <Suspense
      fallback={
        <Container>
          <CardWrapper>
            <Card>
              <Header>
                <Title>Sign in to Tokscale</Title>
              </Header>
            </Card>
          </CardWrapper>
        </Container>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
