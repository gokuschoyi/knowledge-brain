import { PropsWithChildren } from "react";

export function Card({ children }: PropsWithChildren) {
  return <div className="panel p-4">{children}</div>;
}

