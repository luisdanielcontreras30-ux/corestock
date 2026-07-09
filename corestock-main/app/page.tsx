"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/AuthProvider";

export default function Home() {
  const router = useRouter();
  const { user, cargando } = useAuth();

  useEffect(() => {
    if (cargando) return;

    if (user) {
      router.push("/menu");
    } else {
      router.push("/bienvenida");
    }
  }, [cargando, user, router]);

  return null;
}