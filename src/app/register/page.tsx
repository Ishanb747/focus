import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
export const metadata: Metadata = { title: "Create account" };
export default function RegisterPage() { return <AuthShell mode="register" />; }
