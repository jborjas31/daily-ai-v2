"use client";
import FirebaseClientProvider from "./FirebaseClientProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <FirebaseClientProvider>{children}</FirebaseClientProvider>;
}

