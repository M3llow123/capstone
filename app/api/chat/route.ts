import { notFound } from "next/navigation";

// The PAGASA AI chat page is disabled: opening /chat shows the 404 page.
// (The /api/chat route stays on because the region and overview edit pages use it to generate summaries.)
export default function ChatPage() {
  return notFound();
}