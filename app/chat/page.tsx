import { notFound } from "next/navigation";

// The PAGASA AI chat page is disabled: nothing links to it any more, and opening /chat
// directly shows a 404 page. (The /api/chat endpoint is NOT affected: the Region and Overview
// edit pages still use it to generate summaries.)
export default function ChatPage() {
  notFound();
}