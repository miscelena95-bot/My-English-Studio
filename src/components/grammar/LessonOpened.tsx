"use client";

import { useEffect, useRef } from "react";
import { markLessonOpened } from "@/app/actions/grammar";

export function LessonOpened({ topicId }: { topicId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markLessonOpened(topicId);
  }, [topicId]);
  return null;
}
