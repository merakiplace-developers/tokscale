"use client";

import styled, { keyframes } from "styled-components";
import { useCopy } from "../hooks";
import { getSelfHostedUrl } from "@/lib/selfHosted";

export function QuickstartSection() {
  const selfHostedUrl = getSelfHostedUrl();
  const envPrefix = selfHostedUrl ? `TOKSCALE_API_URL=${selfHostedUrl} ` : "";
  const installBun = useCopy("curl -fsSL https://bun.com/install | bash");
  const viewStats = useCopy(`${envPrefix}bunx tokscale@latest`);
  const login = useCopy(`${envPrefix}bunx tokscale@latest login`);
  const submit = useCopy(`${envPrefix}bunx tokscale@latest submit`);

  return (
    <>
      <SeparatorBar />

      <QuickstartLabel>
        <QuickstartText>Quickstart</QuickstartText>
      </QuickstartLabel>

      <CardList>
        <CommandCard>
          <CardTitle>Install Bun</CardTitle>
          <CommandBox>
            <CommandInputArea>
              <CommandText>
                curl -fsSL https://bun.com/install | bash
              </CommandText>
              <GradientAccent />
            </CommandInputArea>
            <CopyBtn onClick={installBun.copy}>
              <CopyBtnText>{installBun.copied ? "Copied!" : "Copy"}</CopyBtnText>
            </CopyBtn>
          </CommandBox>
        </CommandCard>

        <CardDivider />

        <CommandCard>
          <CardTitle>View your Usage Stats</CardTitle>
          <CommandBox>
            <CommandInputArea>
              <CommandText>
                {selfHostedUrl && <EnvPrefix>TOKSCALE_API_URL={selfHostedUrl}{" "}</EnvPrefix>}
                bunx tokscale@latest
              </CommandText>
              <GradientAccent />
            </CommandInputArea>
            <CopyBtn onClick={viewStats.copy}>
              <CopyBtnText>{viewStats.copied ? "Copied!" : "Copy"}</CopyBtnText>
            </CopyBtn>
          </CommandBox>
        </CommandCard>

        <CardDivider />

        <CommandCard>
          <CardTitle>Join to Leaderboard</CardTitle>
          <CommandBox>
            <CommandInputArea>
              <CommandText>
                {selfHostedUrl && <EnvPrefix>TOKSCALE_API_URL={selfHostedUrl}{" "}</EnvPrefix>}
                bunx tokscale@latest login
              </CommandText>
              <GradientAccent $delay />
            </CommandInputArea>
            <CopyBtn onClick={login.copy}>
              <CopyBtnText>{login.copied ? "Copied!" : "Copy"}</CopyBtnText>
            </CopyBtn>
          </CommandBox>
        </CommandCard>

        <CardDivider />

        <CommandCard>
          <CardTitle>Submit Data to the Leaderboard</CardTitle>
          <CommandBox>
            <CommandInputArea>
              <CommandText>
                {selfHostedUrl && <EnvPrefix>TOKSCALE_API_URL={selfHostedUrl}{" "}</EnvPrefix>}
                bunx tokscale@latest submit
              </CommandText>
              <GradientAccent />
            </CommandInputArea>
            <CopyBtn onClick={submit.copy}>
              <CopyBtnText>{submit.copied ? "Copied!" : "Copy"}</CopyBtnText>
            </CopyBtn>
          </CommandBox>
        </CommandCard>
      </CardList>
    </>
  );
}

/* ── Separator Bar ── */
const SeparatorBar = styled.div`
  width: 100%;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-image: url("/assets/landing/separator-pattern-slash@gray.svg");
  background-size: 24px 24px;
  background-repeat: repeat;
  border-left: 1px solid #10233E;
  border-right: 1px solid #10233E;
  border-bottom: 1px solid #10233E;
`;

/* ── Quickstart Label ── */
const QuickstartLabel = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 32px;
  background: #0073ff;
  border-left: 1px solid #10233e;
  border-right: 1px solid #10233e;
`;

const QuickstartText = styled.span`
  font-family: var(--font-figtree), "Figtree", sans-serif;
  font-weight: 700;
  font-size: 20px;
  line-height: 1em;
  text-transform: uppercase;
  text-align: center;
  color: #ffffff;
`;

/* ── Card List ── */
const CardList = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  background: #01070f;
  padding: 24px 32px;

  @media (max-width: 480px) {
    padding: 20px 16px;
  }
`;

const CommandCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 0;
`;

const CardDivider = styled.div`
  width: 100%;
  height: 1px;
  background: #10233e;
`;

const CardTitle = styled.h3`
  font-family: var(--font-figtree), "Figtree", sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 1em;
  text-transform: uppercase;
  color: #ffffff;

  @media (max-width: 480px) {
    font-size: 16px;
  }
`;

const CommandBox = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 8px;
  background: #010a15;
  border: 1px solid #10233e;
  border-radius: 12px;
`;

const CommandInputArea = styled.div`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  min-width: 0;
  gap: 10px;
  padding: 0 12px;
  background: #111b2c;
  border-radius: 8px;
  height: 36px;
  overflow-x: auto;
  overflow-y: hidden;
  &::-webkit-scrollbar { display: none; }
  -ms-overflow-style: none;
  scrollbar-width: none;
`;

const CommandText = styled.span`
  font-family: "Inconsolata", monospace !important;
  font-weight: 700;
  font-size: 14px;
  line-height: 0.94em;
  letter-spacing: -0.03em;
  color: #9ad7ed;
  white-space: nowrap;

  @media (max-width: 480px) {
    font-size: 12px;
  }
`;

const EnvPrefix = styled.span`
  color: #5a7a9a;
`;

const cursorSweep = keyframes`
  0%, 100% {
    left: 0;
  }
  50% {
    left: calc(100% - 25px);
  }
`;
const GradientAccent = styled.div<{ $delay?: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 25px;
  height: 36px;
  background: linear-gradient(
    270deg,
    rgba(26, 27, 28, 0) 0%,
    rgba(1, 127, 255, 0.14) 50%,
    rgba(26, 27, 28, 0) 100%
  );
  animation: ${cursorSweep} 6s ease-in-out infinite;
  animation-delay: ${({ $delay }) => ($delay ? '-2s' : '0s')};
  pointer-events: none;
`;

const CopyBtn = styled.button`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 86px;
  height: 36px;
  background: #0073ff;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.9;
  }
  &:active {
    transform: scale(0.97);
  }
`;

const CopyBtnText = styled.span`
  font-family: var(--font-figtree), "Figtree", sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 0.94em;
  letter-spacing: -0.05em;
  text-align: center;
  color: #ffffff;
`;
