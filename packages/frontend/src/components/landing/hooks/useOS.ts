import { useState, useEffect } from "react";

export type OS = "windows" | "mac" | "linux";

export function useOS(): OS {
  const [os, setOs] = useState<OS>("mac");

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/Win/.test(ua)) setOs("windows");
    else if (/Mac/.test(ua)) setOs("mac");
    else setOs("linux");
  }, []);

  return os;
}
