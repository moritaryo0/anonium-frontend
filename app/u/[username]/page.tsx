"use client";

export const runtime = 'edge';

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function UserProfileBlock() {
  const params = useParams<{ username: string }>();
  const router = useRouter();

  useEffect(() => {
    const me = (typeof window !== 'undefined') ? (localStorage.getItem('accessUsername') || '') : '';
    if (me && params?.username === me) {
      router.replace('/u');
    } else {
      router.replace('/');
    }
  }, [params, router]);

  return null;
}
