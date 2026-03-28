import type { Metadata } from "next";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign In - Tokscale",
  description: "Sign in to Tokscale with GitHub or Google",
};

export default function LoginPage() {
  return <LoginClient />;
}
