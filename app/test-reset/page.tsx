import { notFound } from "next/navigation";
import TestResetClient from "./test-reset-client";

export default function TestResetPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <TestResetClient/>;
}
