"use client";

import styled from "styled-components";
import { QuickstartSection } from "./sections";

export function LandingPage() {
  return (
    <PageWrapper>
      <PageInner>
        <QuickstartSection />
      </PageInner>
    </PageWrapper>
  );
}

const PageWrapper = styled.div`
  min-height: 100vh;
  background: #000000;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 16px 0;
`;

const PageInner = styled.div`
  width: 1200px;
  display: flex;
  flex-direction: column;
  align-items: center;

  @media (max-width: 1200px) {
    width: 100%;
  }
`;
