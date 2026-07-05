"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function verificarSesion() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        router.push("/menu");
      } else {
        router.push("/login");
      }
    }

    verificarSesion();
  }, [router]);

  return null;
}